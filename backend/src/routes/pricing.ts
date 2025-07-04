import { z } from 'zod';
import { router, protectedProcedure } from '../lib/trpc';
import { requireTenantAccess } from '../lib/auth';
import { TRPCError } from '@trpc/server';
import { PricingService } from '../lib/pricing';

// Zod schemas for validation
const PriceListStatusEnum = z.enum(['active', 'future', 'expired']);
const PricingMethodEnum = z.enum(['fixed', 'copy_from_list', 'markup', 'cost_plus']);

const CreatePriceListSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  currency_code: z.string().length(3).default('KES'),
  start_date: z.string(),
  end_date: z.string().optional(),
  is_default: z.boolean().default(false),
});

const UpdatePriceListSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  currency_code: z.string().length(3).optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  is_default: z.boolean().optional(),
});

const CreatePriceListItemSchema = z.object({
  price_list_id: z.string().uuid(),
  product_id: z.string().uuid(),
  unit_price: z.number().positive(),
  min_qty: z.number().int().min(1).optional(),
  surcharge_pct: z.number().min(0).max(100).optional(),
});

const UpdatePriceListItemSchema = z.object({
  id: z.string().uuid(),
  unit_price: z.number().positive().optional(),
  min_qty: z.number().int().min(1).optional(),
  surcharge_pct: z.number().min(0).max(100).optional(),
});

const BulkPricingSchema = z.object({
  price_list_id: z.string().uuid(),
  product_ids: z.array(z.string().uuid()),
  pricing_method: PricingMethodEnum,
  unit_price: z.number().positive().optional(),
  source_price_list_id: z.string().uuid().optional(),
  markup_percentage: z.number().optional(),
  min_qty: z.number().int().min(1).optional(),
  surcharge_pct: z.number().min(0).max(100).optional(),
});

// Helper functions moved to PricingService

export const pricingRouter = router({
  // Alias endpoints for frontend compatibility
  listPriceLists: protectedProcedure
    .input(z.object({
      search: z.string().optional(),
      currency_code: z.string().length(3).optional(),
      status: PriceListStatusEnum.optional(),
      page: z.number().min(1).default(1),
      limit: z.number().min(1).max(1000).default(50),
    }))
    .query(async ({ input, ctx }) => {
      const user = requireTenantAccess(ctx);
      
      ctx.logger.info('Fetching price lists with filters:', input);
      
      let query = ctx.supabase
        .from('price_list')
        .select(`
          *,
          price_list_item(count)
        `, { count: 'exact' })
        
        .order('created_at', { ascending: false });

      // Apply search filter
      if (input.search) {
        query = query.or(`name.ilike.%${input.search}%,description.ilike.%${input.search}%`);
      }

      // Apply currency filter
      if (input.currency_code) {
        query = query.eq('currency_code', input.currency_code);
      }

      // Apply pagination
      const from = (input.page - 1) * input.limit;
      const to = from + input.limit - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) {
        ctx.logger.error('Supabase price lists error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message
        });
      }

      const pricingService = new PricingService(ctx.supabase, ctx.logger);
      const processedLists = (data || []).map((list: any) => {
        const statusInfo = pricingService.getPriceListStatus(list.start_date, list.end_date);
        const isExpiringSoon = pricingService.isExpiringSoon(list.end_date);
        return {
          ...list,
          product_count: list.price_list_item?.[0]?.count || 0,
          status: statusInfo.status,
          statusInfo,
          isExpiringSoon,
        };
      }).filter((list: any) => {
        if (input.status) {
          return list.status === input.status;
        }
        return true;
      });

      return {
        priceLists: processedLists,
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / input.limit),
        currentPage: input.page,
      };
    }),

  getPriceList: protectedProcedure
    .input(z.object({
      price_list_id: z.string().uuid(),
    }))
    .query(async ({ input, ctx }) => {
      const user = requireTenantAccess(ctx);
      
      ctx.logger.info('Fetching price list:', input.price_list_id);
      
      const { data, error } = await ctx.supabase
        .from('price_list')
        .select('*')
        .eq('id', input.price_list_id)
        
        .single();

      if (error) {
        ctx.logger.error('Price list fetch error:', error);
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Price list not found'
        });
      }

      return data;
    }),

  createPriceList: protectedProcedure
    .input(CreatePriceListSchema)
    .mutation(async ({ input, ctx }) => {
      const user = requireTenantAccess(ctx);
      
      ctx.logger.info('Creating price list:', input);
      
      // Validate date range
      const pricingService = new PricingService(ctx.supabase, ctx.logger);
      if (!pricingService.validateDateRange(input.start_date, input.end_date)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'End date must be after start date'
        });
      }
      
      // Check name uniqueness within tenant
      const { data: existingName } = await ctx.supabase
        .from('price_list')
        .select('id')
        .eq('name', input.name)
        
        .maybeSingle();

      if (existingName) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Price list name already exists. Please use a unique name.'
        });
      }

      // If setting as default, unset other defaults first
      if (input.is_default) {
        await ctx.supabase
          .from('price_list')
          .update({ is_default: false })
          .eq('is_default', true)
          ;
      }

      const { data, error } = await ctx.supabase
        .from('price_list')
        .insert([{
          ...input,
          
          created_at: new Date().toISOString(),
        }])
        .select()
        .single();

      if (error) {
        ctx.logger.error('Create price list error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message
        });
      }

      ctx.logger.info('Price list created successfully:', data.id);
      return data;
    }),

  updatePriceList: protectedProcedure
    .input(UpdatePriceListSchema)
    .mutation(async ({ input, ctx }) => {
      const user = requireTenantAccess(ctx);
      
      ctx.logger.info('Updating price list:', input.id);
      
      const { id, ...updateData } = input;
      
      // Validate date range if dates are being updated
      if (updateData.start_date || updateData.end_date) {
        // Get current data to validate combined dates
        const { data: current } = await ctx.supabase
          .from('price_list')
          .select('start_date, end_date')
          .eq('id', id)
          
          .single();
          
        const startDate = updateData.start_date || current?.start_date;
        const endDate = updateData.end_date || current?.end_date;
        
        const pricingService = new PricingService(ctx.supabase, ctx.logger);
        if (!pricingService.validateDateRange(startDate, endDate)) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'End date must be after start date'
          });
        }
      }
      
      // Check name uniqueness if name is being updated
      if (updateData.name) {
        const { data: existingName } = await ctx.supabase
          .from('price_list')
          .select('id')
          .eq('name', updateData.name)
          
          .neq('id', id)
          .maybeSingle();

        if (existingName) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Price list name already exists. Please use a unique name.'
          });
        }
      }

      // If setting as default, unset other defaults first
      if (updateData.is_default) {
        await ctx.supabase
          .from('price_list')
          .update({ is_default: false })
          .eq('is_default', true)
          
          .neq('id', id);
      }

      const { data, error } = await ctx.supabase
        .from('price_list')
        .update(updateData)
        .eq('id', id)
        
        .select()
        .single();

      if (error) {
        ctx.logger.error('Update price list error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message
        });
      }

      ctx.logger.info('Price list updated successfully:', data.id);
      return data;
    }),

  getPriceListItems: protectedProcedure
    .input(z.object({
      price_list_id: z.string().uuid(),
      search: z.string().optional(),
      page: z.number().min(1).default(1),
      limit: z.number().min(1).max(1000).default(50),
    }))
    .query(async ({ input, ctx }) => {
      const user = requireTenantAccess(ctx);
      
      ctx.logger.info('Fetching price list items:', input.price_list_id);
      
      // Verify price list belongs to tenant
      const { data: priceList } = await ctx.supabase
        .from('price_list')
        .select('id')
        .eq('id', input.price_list_id)
        
        .single();
        
      if (!priceList) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Price list not found'
        });
      }
      
      let query = ctx.supabase
        .from('price_list_item')
        .select(`
          *,
          product:products(id, sku, name, unit_of_measure)
        `, { count: 'exact' })
        .eq('price_list_id', input.price_list_id)
        .order('unit_price', { ascending: false });

      if (input.search) {
        query = query.or(`product.sku.ilike.%${input.search}%,product.name.ilike.%${input.search}%`);
      }

      // Apply pagination
      const from = (input.page - 1) * input.limit;
      const to = from + input.limit - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) {
        ctx.logger.error('Price list items error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message
        });
      }

      return {
        items: data || [],
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / input.limit),
        currentPage: input.page,
      };
    }),

  createPriceListItem: protectedProcedure
    .input(CreatePriceListItemSchema)
    .mutation(async ({ input, ctx }) => {
      const user = requireTenantAccess(ctx);
      
      ctx.logger.info('Creating price list item:', input);
      
      // Verify price list belongs to tenant
      const { data: priceList } = await ctx.supabase
        .from('price_list')
        .select('id')
        .eq('id', input.price_list_id)
        
        .single();
        
      if (!priceList) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Price list not found'
        });
      }
      
      // Check if product already exists in this price list
      const { data: existingItem } = await ctx.supabase
        .from('price_list_item')
        .select('id')
        .eq('price_list_id', input.price_list_id)
        .eq('product_id', input.product_id)
        .maybeSingle();

      if (existingItem) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Product already exists in this price list'
        });
      }
      
      const { data, error } = await ctx.supabase
        .from('price_list_item')
        .insert([input])
        .select(`
          *,
          product:products(id, sku, name, unit_of_measure)
        `)
        .single();

      if (error) {
        ctx.logger.error('Create price list item error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message
        });
      }

      ctx.logger.info('Price list item created successfully:', data.id);
      return data;
    }),

  // Business logic endpoints
  calculateFinalPrice: protectedProcedure
    .input(z.object({
      unitPrice: z.number().positive(),
      surchargePercent: z.number().optional(),
    }))
    .query(({ input, ctx }) => {
      const user = requireTenantAccess(ctx);
      const pricingService = new PricingService(ctx.supabase, ctx.logger);
      return {
        finalPrice: pricingService.calculateFinalPrice(input.unitPrice, input.surchargePercent)
      };
    }),

  getPriceListStatus: protectedProcedure
    .input(z.object({
      startDate: z.string(),
      endDate: z.string().optional(),
    }))
    .query(({ input, ctx }) => {
      const user = requireTenantAccess(ctx);
      const pricingService = new PricingService(ctx.supabase, ctx.logger);
      return pricingService.getPriceListStatus(input.startDate, input.endDate);
    }),

  validateDateRange: protectedProcedure
    .input(z.object({
      startDate: z.string(),
      endDate: z.string().optional(),
    }))
    .query(({ input, ctx }) => {
      const user = requireTenantAccess(ctx);
      const pricingService = new PricingService(ctx.supabase, ctx.logger);
      return {
        valid: pricingService.validateDateRange(input.startDate, input.endDate)
      };
    }),

  isExpiringSoon: protectedProcedure
    .input(z.object({
      endDate: z.string().optional(),
      days: z.number().optional().default(30),
    }))
    .query(({ input, ctx }) => {
      const user = requireTenantAccess(ctx);
      const pricingService = new PricingService(ctx.supabase, ctx.logger);
      return {
        expiringSoon: pricingService.isExpiringSoon(input.endDate, input.days)
      };
    }),

  getProductPrice: protectedProcedure
    .input(z.object({
      productId: z.string().uuid(),
      customerId: z.string().uuid().optional(),
      date: z.string().optional(),
    }))
    .query(async ({ input, ctx }) => {
      const user = requireTenantAccess(ctx);
      const pricingService = new PricingService(ctx.supabase, ctx.logger);
      const price = await pricingService.getProductPrice(input.productId, input.customerId, input.date);
      return price;
    }),

  getProductPrices: protectedProcedure
    .input(z.object({
      productIds: z.array(z.string().uuid()),
      customerId: z.string().uuid().optional(),
      date: z.string().optional(),
    }))
    .query(async ({ input, ctx }) => {
      const user = requireTenantAccess(ctx);
      const pricingService = new PricingService(ctx.supabase, ctx.logger);
      const prices = await pricingService.getProductPrices(input.productIds, input.customerId, input.date);
      return Object.fromEntries(prices);
    }),

  calculateOrderTotals: protectedProcedure
    .input(z.object({
      lines: z.array(z.object({
        quantity: z.number().positive(),
        unit_price: z.number().nonnegative(),
        subtotal: z.number().optional(),
      })),
      taxPercent: z.number().default(0),
    }))
    .mutation(({ input, ctx }) => {
      const user = requireTenantAccess(ctx);
      const pricingService = new PricingService(ctx.supabase, ctx.logger);
      // Ensure required properties are present
      const validatedLines = input.lines.map(line => ({
        quantity: line.quantity,
        unit_price: line.unit_price,
        subtotal: line.subtotal,
      }));
      return pricingService.calculateOrderTotals(validatedLines, input.taxPercent);
    }),

  validateProductPricing: protectedProcedure
    .input(z.object({
      productId: z.string().uuid(),
      requestedPrice: z.number().positive(),
      quantity: z.number().positive(),
      priceListId: z.string().uuid().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const user = requireTenantAccess(ctx);
      const pricingService = new PricingService(ctx.supabase, ctx.logger);
      return await pricingService.validateProductPricing(
        input.productId,
        input.requestedPrice,
        input.quantity,
        input.priceListId
      );
    }),

  getActivePriceLists: protectedProcedure
    .input(z.object({
      date: z.string().optional(),
    }))
    .query(async ({ input, ctx }) => {
      const user = requireTenantAccess(ctx);
      const pricingService = new PricingService(ctx.supabase, ctx.logger);
      return await pricingService.getActivePriceLists(input.date);
    }),

  formatCurrency: protectedProcedure
    .input(z.object({
      amount: z.number(),
      currencyCode: z.string().default('KES'),
    }))
    .mutation(({ input, ctx }) => {
      const user = requireTenantAccess(ctx);
      const pricingService = new PricingService(ctx.supabase, ctx.logger);
      return {
        formatted: pricingService.formatCurrency(input.amount, input.currencyCode)
      };
    }),
  // GET /price-lists - List price lists with filtering
  list: protectedProcedure
    .input(z.object({
      search: z.string().optional(),
      currency_code: z.string().length(3).optional(),
      status: PriceListStatusEnum.optional(),
      page: z.number().min(1).default(1),
      limit: z.number().min(1).max(1000).default(50),
    }))
    .query(async ({ input, ctx }) => {
      const user = requireTenantAccess(ctx);
      
      ctx.logger.info('Fetching price lists with filters:', input);
      
      let query = ctx.supabase
        .from('price_list')
        .select(`
          *,
          price_list_item(count)
        `, { count: 'exact' })
        
        .order('created_at', { ascending: false });

      // Apply search filter
      if (input.search) {
        query = query.or(`name.ilike.%${input.search}%,description.ilike.%${input.search}%`);
      }

      // Apply currency filter
      if (input.currency_code) {
        query = query.eq('currency_code', input.currency_code);
      }

      // Apply pagination
      const from = (input.page - 1) * input.limit;
      const to = from + input.limit - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) {
        ctx.logger.error('Supabase price lists error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message
        });
      }

      const pricingService = new PricingService(ctx.supabase, ctx.logger);
      const processedLists = (data || []).map((list: any) => {
        const statusInfo = pricingService.getPriceListStatus(list.start_date, list.end_date);
        const isExpiringSoon = pricingService.isExpiringSoon(list.end_date);
        return {
          ...list,
          product_count: list.price_list_item?.[0]?.count || 0,
          status: statusInfo.status,
          statusInfo,
          isExpiringSoon,
        };
      }).filter((list: any) => {
        if (input.status) {
          return list.status === input.status;
        }
        return true;
      });

      return {
        priceLists: processedLists,
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / input.limit),
        currentPage: input.page,
      };
    }),

  // GET /price-lists/{id} - Get single price list
  getById: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
    }))
    .query(async ({ input, ctx }) => {
      const user = requireTenantAccess(ctx);
      
      ctx.logger.info('Fetching price list:', input.id);
      
      const { data, error } = await ctx.supabase
        .from('price_list')
        .select('*')
        .eq('id', input.id)
        
        .single();

      if (error) {
        ctx.logger.error('Price list fetch error:', error);
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Price list not found'
        });
      }

      return data;
    }),

  // POST /price-lists - Create price list
  create: protectedProcedure
    .input(CreatePriceListSchema)
    .mutation(async ({ input, ctx }) => {
      const user = requireTenantAccess(ctx);
      
      ctx.logger.info('Creating price list:', input);
      
      // Validate date range
      const pricingService = new PricingService(ctx.supabase, ctx.logger);
      if (!pricingService.validateDateRange(input.start_date, input.end_date)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'End date must be after start date'
        });
      }
      
      // Check name uniqueness within tenant
      const { data: existingName } = await ctx.supabase
        .from('price_list')
        .select('id')
        .eq('name', input.name)
        
        .maybeSingle();

      if (existingName) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Price list name already exists. Please use a unique name.'
        });
      }

      // If setting as default, unset other defaults first
      if (input.is_default) {
        await ctx.supabase
          .from('price_list')
          .update({ is_default: false })
          .eq('is_default', true)
          ;
      }

      const { data, error } = await ctx.supabase
        .from('price_list')
        .insert([{
          ...input,
          
          created_at: new Date().toISOString(),
        }])
        .select()
        .single();

      if (error) {
        ctx.logger.error('Create price list error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message
        });
      }

      ctx.logger.info('Price list created successfully:', data.id);
      return data;
    }),

  // PUT /price-lists/{id} - Update price list
  update: protectedProcedure
    .input(UpdatePriceListSchema)
    .mutation(async ({ input, ctx }) => {
      const user = requireTenantAccess(ctx);
      
      ctx.logger.info('Updating price list:', input.id);
      
      const { id, ...updateData } = input;
      
      // Validate date range if dates are being updated
      if (updateData.start_date || updateData.end_date) {
        // Get current data to validate combined dates
        const { data: current } = await ctx.supabase
          .from('price_list')
          .select('start_date, end_date')
          .eq('id', id)
          
          .single();
          
        const startDate = updateData.start_date || current?.start_date;
        const endDate = updateData.end_date || current?.end_date;
        
        const pricingService = new PricingService(ctx.supabase, ctx.logger);
        if (!pricingService.validateDateRange(startDate, endDate)) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'End date must be after start date'
          });
        }
      }
      
      // Check name uniqueness if name is being updated
      if (updateData.name) {
        const { data: existingName } = await ctx.supabase
          .from('price_list')
          .select('id')
          .eq('name', updateData.name)
          
          .neq('id', id)
          .maybeSingle();

        if (existingName) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Price list name already exists. Please use a unique name.'
          });
        }
      }

      // If setting as default, unset other defaults first
      if (updateData.is_default) {
        await ctx.supabase
          .from('price_list')
          .update({ is_default: false })
          .eq('is_default', true)
          
          .neq('id', id);
      }

      const { data, error } = await ctx.supabase
        .from('price_list')
        .update(updateData)
        .eq('id', id)
        
        .select()
        .single();

      if (error) {
        ctx.logger.error('Update price list error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message
        });
      }

      ctx.logger.info('Price list updated successfully:', data.id);
      return data;
    }),

  // DELETE /price-lists/{id} - Delete price list
  delete: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
    }))
    .mutation(async ({ input, ctx }) => {
      const user = requireTenantAccess(ctx);
      
      ctx.logger.info('Deleting price list:', input.id);
      
      // Check if price list is referenced in active orders
      const { data: orderReferences } = await ctx.supabase
        .from('orders')
        .select('id')
        .eq('price_list_id', input.id)
        
        .limit(1);

      if (orderReferences && orderReferences.length > 0) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Cannot delete price list that is referenced by existing orders'
        });
      }
      
      const { error } = await ctx.supabase
        .from('price_list')
        .delete()
        .eq('id', input.id)
        ;

      if (error) {
        ctx.logger.error('Delete price list error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message
        });
      }

      ctx.logger.info('Price list deleted successfully:', input.id);
      return { success: true };
    }),

  // PUT /price-lists/{id}/set-default - Set as default price list
  setDefault: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
    }))
    .mutation(async ({ input, ctx }) => {
      const user = requireTenantAccess(ctx);
      
      ctx.logger.info('Setting default price list:', input.id);
      
      // Unset all other defaults first
      await ctx.supabase
        .from('price_list')
        .update({ is_default: false })
        .eq('is_default', true)
        ;

      // Set this one as default
      const { data, error } = await ctx.supabase
        .from('price_list')
        .update({ is_default: true })
        .eq('id', input.id)
        
        .select()
        .single();

      if (error) {
        ctx.logger.error('Set default price list error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message
        });
      }

      ctx.logger.info('Default price list updated successfully:', data.id);
      return data;
    }),

  // GET /price-lists/{id}/items - Get price list items
  getItems: protectedProcedure
    .input(z.object({
      price_list_id: z.string().uuid(),
      search: z.string().optional(),
      page: z.number().min(1).default(1),
      limit: z.number().min(1).max(1000).default(50),
    }))
    .query(async ({ input, ctx }) => {
      const user = requireTenantAccess(ctx);
      
      ctx.logger.info('Fetching price list items:', input.price_list_id);
      
      // Verify price list belongs to tenant
      const { data: priceList } = await ctx.supabase
        .from('price_list')
        .select('id')
        .eq('id', input.price_list_id)
        
        .single();
        
      if (!priceList) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Price list not found'
        });
      }
      
      let query = ctx.supabase
        .from('price_list_item')
        .select(`
          *,
          product:products(id, sku, name, unit_of_measure)
        `, { count: 'exact' })
        .eq('price_list_id', input.price_list_id)
        .order('unit_price', { ascending: false });

      if (input.search) {
        query = query.or(`product.sku.ilike.%${input.search}%,product.name.ilike.%${input.search}%`);
      }

      // Apply pagination
      const from = (input.page - 1) * input.limit;
      const to = from + input.limit - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) {
        ctx.logger.error('Price list items error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message
        });
      }

      return {
        items: data || [],
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / input.limit),
        currentPage: input.page,
      };
    }),

  // POST /price-list-items - Create price list item
  createItem: protectedProcedure
    .input(CreatePriceListItemSchema)
    .mutation(async ({ input, ctx }) => {
      const user = requireTenantAccess(ctx);
      
      ctx.logger.info('Creating price list item:', input);
      
      // Verify price list belongs to tenant
      const { data: priceList } = await ctx.supabase
        .from('price_list')
        .select('id')
        .eq('id', input.price_list_id)
        
        .single();
        
      if (!priceList) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Price list not found'
        });
      }
      
      // Check if product already exists in this price list
      const { data: existingItem } = await ctx.supabase
        .from('price_list_item')
        .select('id')
        .eq('price_list_id', input.price_list_id)
        .eq('product_id', input.product_id)
        .maybeSingle();

      if (existingItem) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Product already exists in this price list'
        });
      }
      
      const { data, error } = await ctx.supabase
        .from('price_list_item')
        .insert([input])
        .select(`
          *,
          product:products(id, sku, name, unit_of_measure)
        `)
        .single();

      if (error) {
        ctx.logger.error('Create price list item error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message
        });
      }

      ctx.logger.info('Price list item created successfully:', data.id);
      return data;
    }),

  // PUT /price-list-items/{id} - Update price list item
  updateItem: protectedProcedure
    .input(UpdatePriceListItemSchema)
    .mutation(async ({ input, ctx }) => {
      const user = requireTenantAccess(ctx);
      
      ctx.logger.info('Updating price list item:', input.id);
      
      const { id, ...updateData } = input;
      
      // Verify item exists and belongs to tenant's price list
      const { data: item } = await ctx.supabase
        .from('price_list_item')
        .select(`
          id,
          price_list:price_list(tenant_id)
        `)
        .eq('id', id)
        .single();
        
      if (!item) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Price list item not found'
        });
      }
      
      const { data, error } = await ctx.supabase
        .from('price_list_item')
        .update(updateData)
        .eq('id', id)
        .select(`
          *,
          product:products(id, sku, name, unit_of_measure)
        `)
        .single();

      if (error) {
        ctx.logger.error('Update price list item error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message
        });
      }

      ctx.logger.info('Price list item updated successfully:', data.id);
      return data;
    }),

  // DELETE /price-list-items/{id} - Delete price list item
  deleteItem: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
    }))
    .mutation(async ({ input, ctx }) => {
      const user = requireTenantAccess(ctx);
      
      ctx.logger.info('Deleting price list item:', input.id);
      
      // Verify item exists and belongs to tenant's price list
      const { data: item } = await ctx.supabase
        .from('price_list_item')
        .select(`
          id,
          price_list_id,
          price_list:price_list(tenant_id)
        `)
        .eq('id', input.id)
        .single();
        
      if (!item) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Price list item not found'
        });
      }
      
      const { error } = await ctx.supabase
        .from('price_list_item')
        .delete()
        .eq('id', input.id);

      if (error) {
        ctx.logger.error('Delete price list item error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message
        });
      }

      ctx.logger.info('Price list item deleted successfully:', input.id);
      return { success: true, price_list_id: item.price_list_id };
    }),

  // POST /price-lists/{id}/bulk-add - Bulk add products to price list
  bulkAddProducts: protectedProcedure
    .input(BulkPricingSchema)
    .mutation(async ({ input, ctx }) => {
      const user = requireTenantAccess(ctx);
      
      ctx.logger.info('Bulk adding products:', input);
      
      // Verify price list belongs to tenant
      const { data: priceList } = await ctx.supabase
        .from('price_list')
        .select('id')
        .eq('id', input.price_list_id)
        
        .single();
        
      if (!priceList) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Price list not found'
        });
      }
      
      const items: any[] = [];
      const errors: string[] = [];

      for (const productId of input.product_ids) {
        try {
          let unitPrice = input.unit_price || 0;

          if (input.pricing_method === 'copy_from_list' && input.source_price_list_id) {
            // Get price from source list
            const { data: sourceItem } = await ctx.supabase
              .from('price_list_item')
              .select('unit_price')
              .eq('price_list_id', input.source_price_list_id)
              .eq('product_id', productId)
              .single();

            if (sourceItem) {
              unitPrice = sourceItem.unit_price;
              if (input.markup_percentage) {
                unitPrice = unitPrice * (1 + input.markup_percentage / 100);
              }
            } else {
              errors.push(`Product ${productId} not found in source price list`);
              continue;
            }
          } else if (input.pricing_method === 'markup' && input.markup_percentage) {
            // Apply markup to base price
            unitPrice = unitPrice * (1 + input.markup_percentage / 100);
          }

          // Check if product already exists in this price list
          const { data: existingItem } = await ctx.supabase
            .from('price_list_item')
            .select('id')
            .eq('price_list_id', input.price_list_id)
            .eq('product_id', productId)
            .maybeSingle();

          if (existingItem) {
            errors.push(`Product ${productId} already exists in price list`);
            continue;
          }

          items.push({
            price_list_id: input.price_list_id,
            product_id: productId,
            unit_price: unitPrice,
            min_qty: input.min_qty,
            surcharge_pct: input.surcharge_pct,
          });
        } catch (error) {
          errors.push(`Error processing product ${productId}: ${error}`);
        }
      }

      if (items.length === 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'No valid products to add. Errors: ' + errors.join(', ')
        });
      }

      const { data, error } = await ctx.supabase
        .from('price_list_item')
        .insert(items)
        .select(`
          *,
          product:products(id, sku, name, unit_of_measure)
        `);

      if (error) {
        ctx.logger.error('Bulk add products error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message
        });
      }

      ctx.logger.info(`Bulk added ${data?.length || 0} products with ${errors.length} errors`);
      return {
        items: data || [],
        errors,
        successCount: data?.length || 0,
        errorCount: errors.length,
      };
    }),

  // GET /pricing/stats - Get pricing statistics
  getStats: protectedProcedure
    .query(async ({ ctx }) => {
      const user = requireTenantAccess(ctx);
      
      ctx.logger.info('Fetching pricing statistics');
      
      const { data: priceLists, error: priceListsError } = await ctx.supabase
        .from('price_list')
        .select('start_date, end_date')
        ;

      if (priceListsError) {
        ctx.logger.error('Pricing stats error:', priceListsError);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: priceListsError.message
        });
      }

      const pricingService = new PricingService(ctx.supabase, ctx.logger);
      const detailedStats = await pricingService.getPricingStats();
      
      const stats = {
        total_price_lists: detailedStats.totalPriceLists,
        active_price_lists: detailedStats.activePriceLists,
        future_price_lists: priceLists.filter(list => {
          const status = pricingService.getPriceListStatus(list.start_date, list.end_date);
          return status.status === 'future';
        }).length,
        expired_price_lists: priceLists.filter(list => {
          const status = pricingService.getPriceListStatus(list.start_date, list.end_date);
          return status.status === 'expired';
        }).length,
        expiring_soon: detailedStats.expiringPriceLists,
        products_without_pricing: detailedStats.productsWithoutPricing,
      };

      ctx.logger.info('Pricing stats:', stats);
      return stats;
    }),

  // POST /pricing/calculate - Calculate dynamic pricing
  calculate: protectedProcedure
    .input(z.object({
      customer_id: z.string().uuid().optional(),
      items: z.array(z.object({
        product_id: z.string().uuid(),
        quantity: z.number().positive(),
        price_list_id: z.string().uuid().optional(),
      })),
      pricing_date: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const user = requireTenantAccess(ctx);
      
      ctx.logger.info('Calculating dynamic pricing:', input);
      
      const pricingDate = input.pricing_date || new Date().toISOString().split('T')[0];
      const results: any[] = [];

      for (const item of input.items) {
        let priceListQuery = ctx.supabase
          .from('price_list')
          .select(`
            id,
            name,
            start_date,
            end_date,
            is_default,
            price_list_item!inner(
              unit_price,
              min_qty,
              surcharge_pct,
              product_id
            )
          `)
          
          .eq('price_list_item.product_id', item.product_id)
          .lte('start_date', pricingDate)
          .or(`end_date.is.null,end_date.gte.${pricingDate}`);

        // If specific price list requested, filter by it
        if (item.price_list_id) {
          priceListQuery = priceListQuery.eq('id', item.price_list_id);
        }

        const { data: applicablePriceLists, error } = await priceListQuery;

        if (error) {
          ctx.logger.error('Price calculation error:', error);
          results.push({
            product_id: item.product_id,
            quantity: item.quantity,
            error: 'Failed to fetch pricing data',
            unit_price: 0,
            final_price: 0,
          });
          continue;
        }

        if (!applicablePriceLists || applicablePriceLists.length === 0) {
          results.push({
            product_id: item.product_id,
            quantity: item.quantity,
            error: 'No applicable pricing found',
            unit_price: 0,
            final_price: 0,
          });
          continue;
        }

        // Find the best price list (prioritize specific > default > newest)
        let bestPriceList = applicablePriceLists[0];
        if (applicablePriceLists.length > 1) {
          const defaultList = applicablePriceLists.find(pl => pl.is_default);
          if (defaultList) {
            bestPriceList = defaultList;
          }
        }

        const priceItem = (bestPriceList as any).price_list_item[0];
        
        // Check minimum quantity
        if (priceItem.min_qty && item.quantity < priceItem.min_qty) {
          results.push({
            product_id: item.product_id,
            quantity: item.quantity,
            error: `Minimum quantity is ${priceItem.min_qty}`,
            unit_price: priceItem.unit_price,
            final_price: 0,
            min_qty: priceItem.min_qty,
          });
          continue;
        }

        const pricingService = new PricingService(ctx.supabase, ctx.logger);
        const finalPrice = pricingService.calculateFinalPrice(priceItem.unit_price, priceItem.surcharge_pct);
        const subtotal = finalPrice * item.quantity;

        results.push({
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: priceItem.unit_price,
          surcharge_pct: priceItem.surcharge_pct,
          final_price: finalPrice,
          subtotal,
          price_list_id: bestPriceList.id,
          price_list_name: bestPriceList.name,
          min_qty: priceItem.min_qty,
        });
      }

      const totalAmount = results.reduce((sum, result) => sum + (result.subtotal || 0), 0);

      return {
        items: results,
        totalAmount,
        currency: 'KES',
        pricing_date: pricingDate,
      };
    }),

  // POST /price-lists/validate - Validate price list
  validatePriceList: protectedProcedure
    .input(z.object({
      price_list_id: z.string().uuid(),
      items: z.array(z.object({
        product_id: z.string().uuid(),
        unit_price: z.number().positive(),
      })),
    }))
    .mutation(async ({ input, ctx }) => {
      const user = requireTenantAccess(ctx);
      
      ctx.logger.info('Validating price list:', input.price_list_id);
      
      // Verify price list belongs to tenant
      const { data: priceList } = await ctx.supabase
        .from('price_list')
        .select('id, name')
        .eq('id', input.price_list_id)
        
        .single();
        
      if (!priceList) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Price list not found'
        });
      }
      
      const validationResults: any[] = [];
      const errors: string[] = [];

      for (const item of input.items) {
        // Check if product exists
        const { data: product } = await ctx.supabase
          .from('products')
          .select('id, sku, name')
          .eq('id', item.product_id)
          
          .single();

        if (!product) {
          errors.push(`Product ${item.product_id} not found`);
          continue;
        }

        // Validate price ranges (basic business rules)
        const warnings: string[] = [];
        if (item.unit_price <= 0) {
          errors.push(`Product ${product.sku}: Price must be positive`);
        }
        if (item.unit_price < 1) {
          warnings.push(`Product ${product.sku}: Very low price (${item.unit_price})`);
        }
        if (item.unit_price > 1000000) {
          warnings.push(`Product ${product.sku}: Very high price (${item.unit_price})`);
        }

        validationResults.push({
          product_id: item.product_id,
          product_sku: product.sku,
          product_name: product.name,
          unit_price: item.unit_price,
          is_valid: errors.length === 0,
          warnings,
        });
      }

      return {
        price_list_id: input.price_list_id,
        price_list_name: priceList.name,
        validation_results: validationResults,
        total_items: input.items.length,
        valid_items: validationResults.filter(r => r.is_valid).length,
        errors,
        overall_valid: errors.length === 0,
      };
    }),

  // POST /price-lists/bulk-update - Bulk update prices
  bulkUpdatePrices: protectedProcedure
    .input(z.object({
      price_list_id: z.string().uuid(),
      updates: z.array(z.object({
        product_id: z.string().uuid(),
        unit_price: z.number().positive(),
        min_qty: z.number().int().min(1).optional(),
        surcharge_pct: z.number().min(0).max(100).optional(),
      })),
    }))
    .mutation(async ({ input, ctx }) => {
      const user = requireTenantAccess(ctx);
      
      ctx.logger.info('Bulk updating prices for list:', input.price_list_id);
      
      // Verify price list belongs to tenant
      const { data: priceList } = await ctx.supabase
        .from('price_list')
        .select('id')
        .eq('id', input.price_list_id)
        
        .single();
        
      if (!priceList) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Price list not found'
        });
      }
      
      const updateResults: any[] = [];
      const errors: string[] = [];

      for (const update of input.updates) {
        try {
          // Check if item exists in price list
          const { data: existingItem } = await ctx.supabase
            .from('price_list_item')
            .select('id')
            .eq('price_list_id', input.price_list_id)
            .eq('product_id', update.product_id)
            .single();

          if (!existingItem) {
            errors.push(`Product ${update.product_id} not found in price list`);
            continue;
          }

          const { data: updatedItem, error } = await ctx.supabase
            .from('price_list_item')
            .update({
              unit_price: update.unit_price,
              min_qty: update.min_qty,
              surcharge_pct: update.surcharge_pct,
            })
            .eq('id', existingItem.id)
            .select(`
              *,
              product:products(id, sku, name)
            `)
            .single();

          if (error) {
            errors.push(`Failed to update product ${update.product_id}: ${error.message}`);
          } else {
            updateResults.push(updatedItem);
          }
        } catch (error) {
          errors.push(`Error updating product ${update.product_id}: ${error}`);
        }
      }

      ctx.logger.info(`Bulk update completed: ${updateResults.length} successful, ${errors.length} errors`);
      return {
        updated_items: updateResults,
        errors,
        success_count: updateResults.length,
        error_count: errors.length,
      };
    }),

  // GET /customers/{id}/pricing-tiers - Get customer pricing tiers
  getCustomerPricingTiers: protectedProcedure
    .input(z.object({
      customer_id: z.string().uuid(),
    }))
    .query(async ({ input, ctx }) => {
      const user = requireTenantAccess(ctx);
      
      ctx.logger.info('Fetching customer pricing tiers:', input.customer_id);
      
      // Get customer info
      const { data: customer, error: customerError } = await ctx.supabase
        .from('customers')
        .select(`
          id,
          name,
          customer_tier,
          credit_terms_days,
          payment_terms
        `)
        .eq('id', input.customer_id)
        
        .single();

      if (customerError || !customer) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Customer not found'
        });
      }

      // Get applicable price lists based on customer tier
      // This is a placeholder - you might have specific price lists for customer tiers
      const { data: priceLists, error: priceListError } = await ctx.supabase
        .from('price_list')
        .select(`
          id,
          name,
          start_date,
          end_date,
          is_default,
          currency_code
        `)
        
        .lte('start_date', new Date().toISOString().split('T')[0])
        .or(`end_date.is.null,end_date.gte.${new Date().toISOString().split('T')[0]}`);

      if (priceListError) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: priceListError.message
        });
      }

      // Calculate potential discounts based on customer tier
      const tierDiscounts: Record<string, number> = {
        'premium': 0.10, // 10% discount
        'gold': 0.05,    // 5% discount
        'silver': 0.02,  // 2% discount
        'standard': 0,   // No discount
      };

      const customerDiscount = tierDiscounts[customer.customer_tier] || 0;

      return {
        customer: {
          id: customer.id,
          name: customer.name,
          tier: customer.customer_tier,
          credit_terms_days: customer.credit_terms_days,
          payment_terms: customer.payment_terms,
        },
        pricing_info: {
          tier_discount_percentage: customerDiscount * 100,
          applicable_price_lists: priceLists || [],
          special_pricing_rules: [
            // Add any special rules based on customer tier
            customer.customer_tier === 'premium' ? 'Free shipping on orders > 10,000 KES' : null,
            customer.customer_tier === 'gold' ? 'Priority order processing' : null,
          ].filter(Boolean),
        },
      };
    }),
});