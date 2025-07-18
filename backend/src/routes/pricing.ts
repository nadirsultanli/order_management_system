import { z } from 'zod';
import { router, protectedProcedure } from '../lib/trpc';
import { requireAuth } from '../lib/auth';
import { TRPCError } from '@trpc/server';
import { PricingService } from '../lib/pricing';
import { SupabaseClient } from '@supabase/supabase-js';

// Helper function for calculating empty return credit
async function calculateEmptyReturnCredit(
  capacity_l: number,
  quantity: number,
  customer_id: string | undefined,
  supabase: SupabaseClient
): Promise<any> {
  try {
    // Get deposit rate for this capacity
    const { data: depositRate, error } = await supabase
      .from('cylinder_deposit_rates')
      .select('deposit_amount')
      .eq('capacity_l', capacity_l)
      .eq('currency_code', 'KES')
      .eq('is_active', true)
      .lte('effective_date', new Date().toISOString().split('T')[0])
      .or(`end_date.is.null,end_date.gte.${new Date().toISOString().split('T')[0]}`)
      .order('effective_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !depositRate) {
      return null;
    }

    // Apply condition-based refund percentage (default to 'good' condition)
    const conditionRefunds = {
      'excellent': 1.0,   // 100% refund
      'good': 0.9,        // 90% refund
      'fair': 0.75,       // 75% refund
      'poor': 0.5,        // 50% refund
      'damaged': 0.25,    // 25% refund
      'scrap': 0.0,       // 0% refund
    };

    const refundPercentage = conditionRefunds['good']; // Default to good condition
    const creditAmount = depositRate.deposit_amount * quantity * refundPercentage;

    return {
      capacity_l,
      quantity,
      condition: 'good',
      deposit_amount_per_unit: depositRate.deposit_amount,
      refund_percentage: refundPercentage * 100,
      credit_amount: creditAmount,
      late_penalty: 0,
      is_late: false,
      return_date: new Date().toISOString().split('T')[0],
      currency_code: 'KES',
    };
  } catch (error) {
    console.error('Error calculating empty return credit:', error);
    return null;
  }
}

// Helper function to convert kg to liters for propane
function convertKgToLiters(kg: number): number {
  // Propane density: ~0.51 kg/L at 15°C
  // This is an approximation - in practice, you might want to store both values
  return kg / 0.51;
}

// Helper function to get product capacity in liters
async function getProductCapacityL(productId: string, supabase: SupabaseClient): Promise<number | null> {
  try {
    const { data: product, error } = await supabase
      .from('products')
      .select('capacity_kg, capacity_l')
      .eq('id', productId)
      .single();

    if (error || !product) {
      return null;
    }

    // If capacity_l exists, use it directly
    if (product.capacity_l) {
      return product.capacity_l;
    }

    // If only capacity_kg exists, convert to liters
    if (product.capacity_kg) {
      return convertKgToLiters(product.capacity_kg);
    }

    return null;
  } catch (error) {
    console.error('Error getting product capacity:', error);
    return null;
  }
}

// Import input schemas
import {
  PriceListFiltersSchema,
  GetPriceListByIdSchema,
  CreatePriceListSchema,
  UpdatePriceListSchema,
  DeletePriceListSchema,
  SetDefaultPriceListSchema,
  PriceListItemFiltersSchema,
  CreatePriceListItemSchema,
  UpdatePriceListItemSchema,
  DeletePriceListItemSchema,
  BulkPricingSchema,
  CalculateFinalPriceSchema,
  GetPriceListStatusSchema,
  ValidateDateRangeSchema,
  IsExpiringSoonSchema,
  GetProductPriceSchema,
  GetProductPricesSchema,
  GetProductPriceListItemsSchema,
  CalculateOrderTotalsSchema,
  ValidateProductPricingSchema,
  GetActivePriceListsSchema,
  FormatCurrencySchema,
  CalculatePricingSchema,
  ValidatePriceListSchema,
  BulkUpdatePricesSchema,
  GetCustomerPricingTiersSchema,
  LegacyPriceListFiltersSchema,
  // Weight-based pricing schemas
  CalculateWeightBasedPricingSchema,
  GetDepositRateSchema,
  CalculateTotalWithDepositsSchema,
  EnhancedCalculateFinalPriceSchema,
} from '../schemas/input/pricing-input';

// Import output schemas
import {
  PriceListListResponseSchema,
  PriceListDetailResponseSchema,
  CreatePriceListResponseSchema,
  UpdatePriceListResponseSchema,
  DeletePriceListResponseSchema,
  SetDefaultPriceListResponseSchema,
  PriceListItemsResponseSchema,
  CreatePriceListItemResponseSchema,
  UpdatePriceListItemResponseSchema,
  DeletePriceListItemResponseSchema,
  BulkAddProductsResponseSchema,
  CalculateFinalPriceResponseSchema,
  GetPriceListStatusResponseSchema,
  ValidateDateRangeResponseSchema,
  IsExpiringSoonResponseSchema,
  ProductPriceResponseSchema,
  ProductPricesResponseSchema,
  ProductPriceListItemsResponseSchema,
  OrderTotalsResponseSchema,
  ValidateProductPricingResponseSchema,
  ActivePriceListsResponseSchema,
  FormatCurrencyResponseSchema,
  PricingStatsResponseSchema,
  CalculatePricingResponseSchema,
  ValidatePriceListResponseSchema,
  BulkUpdatePricesResponseSchema,
  CustomerPricingTiersResponseSchema,
} from '../schemas/output/pricing-output';

export const pricingRouter = router({
  // Alias endpoints for frontend compatibility
  listPriceLists: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/pricing/price-lists',
        tags: ['pricing'],
        summary: 'List price lists with filtering and pagination',
        description: 'Retrieve a paginated list of price lists with optional filtering by search text, currency, and status.',
        protect: true,
      }
    })
    .input(PriceListFiltersSchema)
    .output(z.any())
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
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
    .meta({
      openapi: {
        method: 'GET',
        path: '/pricing/price-lists/{price_list_id}',
        tags: ['pricing'],
        summary: 'Get price list by ID',
        description: 'Retrieve detailed information about a specific price list.',
        protect: true,
      }
    })
    .input(LegacyPriceListFiltersSchema)
    .output(z.any())
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
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
    .meta({
      openapi: {
        method: 'POST',
        path: '/pricing/price-lists',
        tags: ['pricing'],
        summary: 'Create new price list',
        description: 'Create a new price list with validation for date ranges and name uniqueness.',
        protect: true,
      }
    })
    .input(CreatePriceListSchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
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
    .meta({
      openapi: {
        method: 'PUT',
        path: '/pricing/price-lists/{id}',
        tags: ['pricing'],
        summary: 'Update price list',
        description: 'Update price list information including name, dates, currency, and default status.',
        protect: true,
      }
    })
    .input(UpdatePriceListSchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
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
    .meta({
      openapi: {
        method: 'GET',
        path: '/pricing/price-lists/{price_list_id}/items',
        tags: ['pricing'],
        summary: 'Get price list items',
        description: 'Retrieve paginated list of items in a specific price list with product details.',
        protect: true,
      }
    })
    .input(PriceListItemFiltersSchema)
    .output(z.any())
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
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
          product:parent_products(id, name, sku, description, capacity_kg)
        `, { count: 'exact' })
        .eq('price_list_id', input.price_list_id)
        .order('unit_price', { ascending: false });

      if (input.search) {
        query = query.or(`product.name.ilike.%${input.search}%`);
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
    .meta({
      openapi: {
        method: 'POST',
        path: '/pricing/price-list-items',
        tags: ['pricing'],
        summary: 'Create price list item',
        description: 'Add a new product to a price list with pricing information.',
        protect: true,
      }
    })
    .input(CreatePriceListItemSchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
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

      // Get product details to determine capacity for deposit calculation
      const { data: product } = await ctx.supabase
        .from('products')
        .select(`
          id,
          capacity_kg,
          parent_products_id
        `)
        .eq('id', input.product_id)
        .single();

      // Determine capacity for deposit calculation
      let capacityForDeposit = 0;
      if (product) {
        // If product has direct capacity, use it
        if (product.capacity_kg) {
          capacityForDeposit = product.capacity_kg;
        }
        // If product is a variant, get capacity from parent product
        else if (product.parent_products_id) {
          const { data: parentProduct } = await ctx.supabase
            .from('parent_products')
            .select('capacity_kg')
            .eq('id', product.parent_products_id)
            .single();
          
          if (parentProduct) {
            capacityForDeposit = parentProduct.capacity_kg || 0;
          }
        }
      }

      // Get deposit amount from cylinder_deposit_rates table if capacity is available
      let depositAmount = input.deposit_amount || 0;
      if (capacityForDeposit > 0 && !input.deposit_amount) {
        const { data: depositRate } = await ctx.supabase
          .from('cylinder_deposit_rates')
          .select('deposit_amount')
          .eq('capacity_l', capacityForDeposit)
          .eq('is_active', true)
          .lte('effective_date', new Date().toISOString().split('T')[0])
          .or(`end_date.is.null,end_date.gte.${new Date().toISOString().split('T')[0]}`)
          .order('effective_date', { ascending: false })
          .limit(1)
          .single();

        if (depositRate) {
          depositAmount = depositRate.deposit_amount;
        }
      }

      // Prepare the data to insert with deposit amount
      const insertData = {
        ...input,
        deposit_amount: depositAmount
      };
      
      const { data, error } = await ctx.supabase
        .from('price_list_item')
        .insert([insertData])
        .select(`
          *,
          product:parent_products(id, name, sku, description, capacity_kg)
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
    .meta({
      openapi: {
        method: 'POST',
        path: '/pricing/calculate-final-price',
        tags: ['pricing'],
        summary: 'Calculate final price with surcharge',
        description: 'Calculate the final price for a product including any surcharge percentage.',
        protect: true,
      }
    })
    .input(CalculateFinalPriceSchema)
    .output(z.any())
    .query(({ input, ctx }) => {
      const user = requireAuth(ctx);
      const pricingService = new PricingService(ctx.supabase, ctx.logger);
      return {
        finalPrice: pricingService.calculateFinalPrice(input.unitPrice, input.surchargePercent)
      };
    }),

  getPriceListStatus: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/pricing/price-list-status',
        tags: ['pricing'],
        summary: 'Get price list status',
        description: 'Determine the status of a price list based on start and end dates.',
        protect: true,
      }
    })
    .input(GetPriceListStatusSchema)
    .output(z.any())
    .query(({ input, ctx }) => {
      const user = requireAuth(ctx);
      const pricingService = new PricingService(ctx.supabase, ctx.logger);
      return pricingService.getPriceListStatus(input.startDate, input.endDate);
    }),

  validateDateRange: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/pricing/validate-date-range',
        tags: ['pricing'],
        summary: 'Validate date range',
        description: 'Validate that a start and end date range is valid for a price list.',
        protect: true,
      }
    })
    .input(ValidateDateRangeSchema)
    .output(z.any())
    .query(({ input, ctx }) => {
      const user = requireAuth(ctx);
      const pricingService = new PricingService(ctx.supabase, ctx.logger);
      return {
        valid: pricingService.validateDateRange(input.startDate, input.endDate)
      };
    }),

  isExpiringSoon: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/pricing/is-expiring-soon',
        tags: ['pricing'],
        summary: 'Check if expiring soon',
        description: 'Check if a price list is expiring within a specified number of days.',
        protect: true,
      }
    })
    .input(IsExpiringSoonSchema)
    .output(z.any())
    .query(({ input, ctx }) => {
      const user = requireAuth(ctx);
      const pricingService = new PricingService(ctx.supabase, ctx.logger);
      return {
        expiringSoon: pricingService.isExpiringSoon(input.endDate, input.days)
      };
    }),

  getProductPrice: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/pricing/product-price/{productId}',
        tags: ['pricing'],
        summary: 'Get product price',
        description: 'Get the current price for a specific product, optionally for a specific customer and date.',
        protect: true,
      }
    })
    .input(GetProductPriceSchema)
    .output(z.any())
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      const pricingService = new PricingService(ctx.supabase, ctx.logger);
      const price = await pricingService.getProductPrice(input.productId, input.customerId, input.date);
      return price;
    }),

  getProductPrices: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/pricing/product-prices',
        tags: ['pricing'],
        summary: 'Get multiple product prices',
        description: 'Get current prices for multiple products, optionally for a specific customer and date.',
        protect: true,
      }
    })
    .input(GetProductPricesSchema)
    .output(z.any())
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Fetching prices for products:', input.productIds);
      
      const results: { [key: string]: any } = {};
      
      // Process each product individually to ensure inheritance works correctly
      for (const productId of input.productIds) {
        try {
          // Get the product details to check if it's a variant
          const { data: product, error: productError } = await ctx.supabase
            .from('products')
            .select('id, sku, name, is_variant, parent_products_id, tax_category, tax_rate')
            .eq('id', productId)
            .single();

          if (productError || !product) {
            ctx.logger.error('Product not found:', productError);
            results[productId] = null;
            continue;
          }

          // Try to get direct pricing for this product first
          const pricingService = new PricingService(ctx.supabase, ctx.logger);
          let priceResult = await pricingService.getProductPrice(productId, undefined, input.date || new Date().toISOString().split('T')[0]);
          
          // If no direct pricing found and this is a variant, try parent product pricing
          if (!priceResult && product.is_variant && product.parent_products_id) {
            ctx.logger.info(`No direct pricing found for variant ${product.sku}, trying parent product ${product.parent_products_id}`);
            priceResult = await pricingService.getProductPrice(product.parent_products_id, undefined, input.date || new Date().toISOString().split('T')[0]);
            
            if (priceResult) {
              // Mark that this price was inherited from parent
              priceResult.inheritedFromParent = true;
              priceResult.parentProductId = product.parent_products_id;
              ctx.logger.info(`Using inherited pricing from parent product for variant ${product.sku}: ${priceResult.finalPrice}`);
            } else {
              ctx.logger.warn(`No pricing found for parent product ${product.parent_products_id} either`);
            }
          } else if (priceResult) {
            ctx.logger.info(`Found direct pricing for ${product.sku}: ${priceResult.finalPrice}`);
          } else {
            ctx.logger.warn(`No pricing found for ${product.sku} (is_variant: ${product.is_variant}, parent_id: ${product.parent_products_id})`);
          }

          if (priceResult) {
            // Get product tax information (use variant's tax info, fallback to parent's)
            let taxRate = product.tax_rate || 0;
            let taxCategory = product.tax_category || 'standard';

            // If we inherited pricing and variant doesn't have tax info, get from parent
            if (priceResult.inheritedFromParent && product.parent_products_id && (!taxRate || !taxCategory)) {
              const { data: parentProduct } = await ctx.supabase
                .from('products')
                .select('tax_category, tax_rate')
                .eq('id', product.parent_products_id)
                .single();
              
              if (parentProduct) {
                taxRate = taxRate || parentProduct.tax_rate || 0;
                taxCategory = taxCategory || parentProduct.tax_category || 'standard';
              }
            }

            results[productId] = {
              ...priceResult,
              taxRate,
              taxCategory,
            };
          } else {
            results[productId] = null;
          }
        } catch (error) {
          ctx.logger.error(`Error fetching price for product ${productId}:`, error);
          results[productId] = null;
        }
      }
      
      // Debug: Log pricing results
      ctx.logger.info('getProductPrices results:', {
        requestedProductIds: input.productIds.length,
        returnedPrices: Object.keys(results).filter(key => results[key] !== null).length,
        samplePrices: Object.entries(results).slice(0, 3).map(([id, price]) => ({
          productId: id,
          hasPrice: !!price,
          finalPrice: price?.finalPrice,
          inheritedFromParent: price?.inheritedFromParent,
          unitPrice: price?.unitPrice,
          priceListName: price?.priceListName
        }))
      });
      
      ctx.logger.info('Detailed pricing for each product:', results);
      
      return results;
    }),

  getProductPriceListItems: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/pricing/product/{productId}/price-list-items',
        tags: ['pricing'],
        summary: 'Get product price list items',
        description: 'Get all price list items for a specific product across all price lists.',
        protect: true,
      }
    })
    .input(GetProductPriceListItemsSchema)
    .output(z.any())
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Fetching price list items for product:', input.productId);
      
      const { data, error } = await ctx.supabase
        .from('price_list_item')
        .select(`
          *,
          price_list:price_list(
            id,
            name,
            start_date,
            end_date,
            is_default,
            currency_code,
            pricing_method
          ),
          product:parent_products(
            id,
            name,
            sku,
            description,
            capacity_kg,
            tare_weight_kg,
            gross_weight_kg,
            tax_rate,
            tax_category
          )
        `)
        .eq('product_id', input.productId);

      if (error) {
        ctx.logger.error('Error fetching product price list items:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch product price list items'
        });
      }

      // Add status information to each price list and calculate effective prices
      const pricingService = new PricingService(ctx.supabase, ctx.logger);
      const enrichedData = await Promise.all((data || []).map(async (item: any) => {
        const statusInfo = pricingService.getPriceListStatus(
          item.price_list.start_date, 
          item.price_list.end_date
        );
        
        // Calculate net weight from product properties
        let netWeight = 0;
        if (item.product?.gross_weight_kg && item.product?.tare_weight_kg) {
          netWeight = item.product.gross_weight_kg - item.product.tare_weight_kg;
        } else if (item.product?.capacity_kg) {
          netWeight = item.product.capacity_kg;
        } else if (item.product?.sku) {
          const kgMatch = item.product.sku.match(/(\d+)KG/i);
          if (kgMatch) {
            netWeight = parseInt(kgMatch[1]);
          }
        }
        
        // Calculate the effective price based on pricing method
        let effectivePrice = 0;
        let priceDisplay = '-';
        let basePrice = 0;
        let taxAmount = 0;
        let totalWithTax = 0;
        
        if (item.pricing_method === 'per_unit' && item.unit_price) {
          basePrice = item.unit_price;
          effectivePrice = pricingService.calculateFinalPrice(item.unit_price, item.surcharge_pct || 0);
          priceDisplay = pricingService.formatCurrency(item.unit_price, item.price_list.currency_code);
        } else if (item.pricing_method === 'per_kg' && item.price_per_kg) {
          basePrice = item.price_per_kg * netWeight; // Calculate total price based on net weight
          effectivePrice = pricingService.calculateFinalPrice(basePrice, item.surcharge_pct || 0);
          priceDisplay = pricingService.formatCurrency(item.price_per_kg, item.price_list.currency_code) + '/kg';
        }
        
        // Calculate tax based on cylinder deposit rates (net weight-based)
        let depositAmount = 0;
        
        if (effectivePrice > 0) {
          // Calculate net weight from product properties
          let netWeight = 0;
          
          // Try to get net weight from product properties
          if (item.product?.gross_weight_kg && item.product?.tare_weight_kg) {
            netWeight = item.product.gross_weight_kg - item.product.tare_weight_kg;
          } else if (item.product?.capacity_kg) {
            // Fallback to capacity if net weight can't be calculated
            netWeight = item.product.capacity_kg;
          } else if (item.product?.sku) {
            // Extract from SKU as last resort
            const kgMatch = item.product.sku.match(/(\d+)KG/i);
            if (kgMatch) {
              netWeight = parseInt(kgMatch[1]);
            }
          }
          
          // Get tax rate and deposit amount from cylinder deposit rates based on capacity_kg
          // Use capacity_kg for deposit matching since cylinder_deposit_rates.capacity_l represents kg capacity
          const capacityForDeposit = item.product?.capacity_kg || 0;
          if (capacityForDeposit > 0) {
            // First try exact match
            let { data: depositRate } = await ctx.supabase
              .from('cylinder_deposit_rates')
              .select('deposit_amount')
              .eq('capacity_l', capacityForDeposit)
              .eq('is_active', true)
              .lte('effective_date', new Date().toISOString().split('T')[0])
              .or(`end_date.is.null,end_date.gte.${new Date().toISOString().split('T')[0]}`)
              .order('effective_date', { ascending: false })
              .limit(1)
              .maybeSingle();
            
            // If no exact match, try to find the closest capacity
            if (!depositRate) {
              const { data: closestRate } = await ctx.supabase
                .from('cylinder_deposit_rates')
                .select('deposit_amount, capacity_l')
                .eq('is_active', true)
                .lte('effective_date', new Date().toISOString().split('T')[0])
                .or(`end_date.is.null,end_date.gte.${new Date().toISOString().split('T')[0]}`)
                .order('capacity_l', { ascending: true })
                .limit(1)
                .maybeSingle();
              
              if (closestRate) {
                depositRate = closestRate;
                console.log(`Using closest deposit rate: ${closestRate.capacity_l}kg for ${capacityForDeposit}kg capacity`);
              }
            }
            
            // Use default tax rate since tax_rate column might not exist
            const taxRate = 0.16; // Default to 16%
            taxAmount = effectivePrice * taxRate;
            totalWithTax = effectivePrice + taxAmount;
            depositAmount = depositRate?.deposit_amount || 0;
            
            console.log(`Capacity: ${capacityForDeposit}kg, Deposit: ${depositAmount}`);
          } else {
            // Fallback to product tax rate if no capacity found
            const productTaxRate = item.product?.tax_rate || 0;
            taxAmount = effectivePrice * (productTaxRate / 100);
            totalWithTax = effectivePrice + taxAmount;
          }
        } else {
          totalWithTax = effectivePrice;
        }
        
        // Calculate total including deposit
        const totalWithDeposit = totalWithTax + depositAmount;
        
        return {
          ...item,
          effective_price: effectivePrice,
          price_display: priceDisplay,
          net_weight: netWeight,
          base_price: basePrice,
          tax_amount: taxAmount,
          total_with_tax: totalWithTax,
          total_with_deposit: totalWithDeposit,
          deposit_amount: depositAmount,
          price_list: {
            ...item.price_list,
            status: statusInfo.status,
            statusInfo,
          }
        };
      }));

      return enrichedData;
    }),

  calculateOrderTotals: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/pricing/calculate-order-totals',
        tags: ['pricing'],
        summary: 'Calculate order totals',
        description: 'Calculate subtotal, tax amount, and grand total for an order with line items.',
        protect: true,
      }
    })
    .input(CalculateOrderTotalsSchema)
    .output(z.any())
    .mutation(({ input, ctx }) => {
      const user = requireAuth(ctx);
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
    .meta({
      openapi: {
        method: 'POST',
        path: '/pricing/validate-product-pricing',
        tags: ['pricing'],
        summary: 'Validate product pricing',
        description: 'Validate if a requested price for a product is within acceptable ranges.',
        protect: true,
      }
    })
    .input(ValidateProductPricingSchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      const pricingService = new PricingService(ctx.supabase, ctx.logger);
      return await pricingService.validateProductPricing(
        input.productId,
        input.requestedPrice,
        input.quantity,
        input.priceListId
      );
    }),

  getActivePriceLists: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/pricing/active-price-lists',
        tags: ['pricing'],
        summary: 'Get active price lists',
        description: 'Get all price lists that are currently active for a specific date.',
        protect: true,
      }
    })
    .input(GetActivePriceListsSchema)
    .output(z.any())
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      const pricingService = new PricingService(ctx.supabase, ctx.logger);
      return await pricingService.getActivePriceLists(input.date);
    }),

  formatCurrency: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/pricing/format-currency',
        tags: ['pricing'],
        summary: 'Format currency',
        description: 'Format a numeric amount as a currency string.',
        protect: true,
      }
    })
    .input(FormatCurrencySchema)
    .output(z.any())
    .mutation(({ input, ctx }) => {
      const user = requireAuth(ctx);
      const pricingService = new PricingService(ctx.supabase, ctx.logger);
      return {
        formatted: pricingService.formatCurrency(input.amount, input.currencyCode)
      };
    }),
  // GET /price-lists - List price lists with filtering
  list: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/price-lists',
        tags: ['pricing'],
        summary: 'List price lists with filtering and pagination',
        description: 'Retrieve a paginated list of price lists with optional filtering by search text, currency, and status.',
        protect: true,
      }
    })
    .input(PriceListFiltersSchema.optional())
    .output(z.any())
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      // Provide default values if input is undefined
      const filters = input || {} as any;
      const page = filters.page || 1;
      const limit = filters.limit || 50;
      
      ctx.logger.info('Fetching price lists with filters:', filters);
      
      let query = ctx.supabase
        .from('price_list')
        .select(`
          *,
          price_list_item(count)
        `, { count: 'exact' })
        
        .order('created_at', { ascending: false });

      // Apply search filter
      if (filters.search) {
        query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
      }

      // Apply currency filter
      if (filters.currency_code) {
        query = query.eq('currency_code', filters.currency_code);
      }

      // Apply pagination
      const from = (page - 1) * limit;
      const to = from + limit - 1;
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
        if (filters.status) {
          return list.status === filters.status;
        }
        return true;
      });

      return {
        priceLists: processedLists,
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
        currentPage: page,
      };
    }),

  // GET /price-lists/{id} - Get single price list
  getById: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/price-lists/{id}',
        tags: ['pricing'],
        summary: 'Get price list by ID',
        description: 'Retrieve detailed information about a specific price list.',
        protect: true,
      }
    })
    .input(GetPriceListByIdSchema)
    .output(z.any())
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
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
    .meta({
      openapi: {
        method: 'POST',
        path: '/price-lists',
        tags: ['pricing'],
        summary: 'Create new price list',
        description: 'Create a new price list with validation for date ranges and name uniqueness.',
        protect: true,
      }
    })
    .input(CreatePriceListSchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
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
    .meta({
      openapi: {
        method: 'PUT',
        path: '/price-lists/{id}',
        tags: ['pricing'],
        summary: 'Update price list',
        description: 'Update price list information including name, dates, currency, and default status.',
        protect: true,
      }
    })
    .input(UpdatePriceListSchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
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
    .meta({
      openapi: {
        method: 'DELETE',
        path: '/price-lists/{id}',
        tags: ['pricing'],
        summary: 'Delete price list',
        description: 'Delete a price list after validating that it is not referenced by existing orders.',
        protect: true,
      }
    })
    .input(DeletePriceListSchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
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
    .meta({
      openapi: {
        method: 'PUT',
        path: '/price-lists/{id}/set-default',
        tags: ['pricing'],
        summary: 'Set price list as default',
        description: 'Set a specific price list as the default price list for the organization.',
        protect: true,
      }
    })
    .input(SetDefaultPriceListSchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
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
    .meta({
      openapi: {
        method: 'GET',
        path: '/price-lists/{price_list_id}/items',
        tags: ['pricing'],
        summary: 'Get price list items',
        description: 'Retrieve paginated list of items in a specific price list with product details.',
        protect: true,
      }
    })
    .input(PriceListItemFiltersSchema)
    .output(z.any())
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
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
          product:parent_products(id, name, sku, description, capacity_kg)
        `, { count: 'exact' })
        .eq('price_list_id', input.price_list_id)
        .order('unit_price', { ascending: false });

      if (input.search) {
        query = query.or(`product.name.ilike.%${input.search}%`);
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
    .meta({
      openapi: {
        method: 'POST',
        path: '/price-list-items',
        tags: ['pricing'],
        summary: 'Create price list item',
        description: 'Add a new product to a price list with pricing information.',
        protect: true,
      }
    })
    .input(CreatePriceListItemSchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
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
          product:parent_products(id, name, sku, description, capacity_kg)
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
    .meta({
      openapi: {
        method: 'PUT',
        path: '/price-list-items/{id}',
        tags: ['pricing'],
        summary: 'Update price list item',
        description: 'Update pricing information for a specific item in a price list.',
        protect: true,
      }
    })
    .input(UpdatePriceListItemSchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Updating price list item:', input.id);
      
      const { id, ...updateData } = input;
      
      // Verify item exists and belongs to tenant's price list
      const { data: item } = await ctx.supabase
        .from('price_list_item')
        .select(`
          id,
          product_id,
          price_list:price_list(*)
        `)
        .eq('id', id)
        .single();
        
      if (!item) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Price list item not found'
        });
      }

      // If deposit_amount is not provided in the update, calculate it automatically
      if (!updateData.deposit_amount) {
        // Get product details to determine capacity for deposit calculation
        const { data: product } = await ctx.supabase
          .from('products')
          .select(`
            id,
            capacity_kg,
            parent_products_id
          `)
          .eq('id', item.product_id)
          .single();

        // Determine capacity for deposit calculation
        let capacityForDeposit = 0;
        if (product) {
          // If product has direct capacity, use it
          if (product.capacity_kg) {
            capacityForDeposit = product.capacity_kg;
          }
          // If product is a variant, get capacity from parent product
          else if (product.parent_products_id) {
            const { data: parentProduct } = await ctx.supabase
              .from('parent_products')
              .select('capacity_kg')
              .eq('id', product.parent_products_id)
              .single();
            
            if (parentProduct) {
              capacityForDeposit = parentProduct.capacity_kg || 0;
            }
          }
        }

        // Get deposit amount from cylinder_deposit_rates table if capacity is available
        if (capacityForDeposit > 0) {
          const { data: depositRate } = await ctx.supabase
            .from('cylinder_deposit_rates')
            .select('deposit_amount')
            .eq('capacity_l', capacityForDeposit)
            .eq('is_active', true)
            .lte('effective_date', new Date().toISOString().split('T')[0])
            .or(`end_date.is.null,end_date.gte.${new Date().toISOString().split('T')[0]}`)
            .order('effective_date', { ascending: false })
            .limit(1)
            .single();

          if (depositRate) {
            updateData.deposit_amount = depositRate.deposit_amount;
          }
        }
      }
      
      const { data, error } = await ctx.supabase
        .from('price_list_item')
        .update(updateData)
        .eq('id', id)
        .select(`
          *,
          product:products(id, sku, name, unit_of_measure, tax_category, tax_rate)
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
    .meta({
      openapi: {
        method: 'DELETE',
        path: '/price-list-items/{id}',
        tags: ['pricing'],
        summary: 'Delete price list item',
        description: 'Remove a product from a price list.',
        protect: true,
      }
    })
    .input(DeletePriceListItemSchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Deleting price list item:', input.id);
      
      // Verify item exists and belongs to tenant's price list
      const { data: item } = await ctx.supabase
        .from('price_list_item')
        .select(`
          id,
          price_list_id,
          price_list:price_list(*)
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

  // POST /price-lists/bulk-add - Bulk add products to price list
  bulkAddProducts: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/price-lists/bulk-add',
        tags: ['pricing'],
        summary: 'Bulk add products to price list',
        description: 'Add multiple products to a price list with various pricing methods including copy from another list, markup, or fixed pricing.',
        protect: true,
      }
    })
    .input(BulkPricingSchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
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
          product:products(id, sku, name, unit_of_measure, tax_category, tax_rate)
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
    .meta({
      openapi: {
        method: 'GET',
        path: '/pricing/stats',
        tags: ['pricing'],
        summary: 'Get pricing statistics',
        description: 'Retrieve comprehensive statistics about price lists, products, and pricing coverage.',
        protect: true,
      }
    })
    .input(z.void())
    .output(z.any())
    .query(async ({ ctx }) => {
      const user = requireAuth(ctx);
      
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
    .meta({
      openapi: {
        method: 'POST',
        path: '/pricing/calculate',
        tags: ['pricing'],
        summary: 'Calculate dynamic pricing for multiple items',
        description: 'Calculate the final price for multiple products based on their pricing in active price lists.',
        protect: true,
      }
    })
    .input(CalculatePricingSchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
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
    .meta({
      openapi: {
        method: 'POST',
        path: '/price-lists/validate',
        tags: ['pricing'],
        summary: 'Validate price list items',
        description: 'Validate the pricing information for multiple items in a price list.',
        protect: true,
      }
    })
    .input(ValidatePriceListSchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
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
    .meta({
      openapi: {
        method: 'POST',
        path: '/pricing/bulk-update',
        tags: ['pricing'],
        summary: 'Bulk update prices for a price list',
        description: 'Update multiple price list items in a single price list with new pricing information.',
        protect: true,
      }
    })
    .input(BulkUpdatePricesSchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
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
              product:products(id, sku, name, tax_category, tax_rate)
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
    .meta({
      openapi: {
        method: 'GET',
        path: '/customers/{customer_id}/pricing-tiers',
        tags: ['pricing'],
        summary: 'Get customer pricing tiers',
        description: 'Get pricing tier information and applicable price lists for a specific customer.',
        protect: true,
      }
    })
    .input(GetCustomerPricingTiersSchema)
    .output(z.any())
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
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
      const { data: priceLists, error: priceListError } = await ctx.supabase
        .from('price_list')
        .select(`
          id,
          name,
          start_date,
          end_date,
          is_default,
          currency_code,
          description,
          created_at,
          updated_at
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

      // Filter out null values from special pricing rules
      const specialRules = [
        customer.customer_tier === 'premium' ? 'Free shipping on orders > 10,000 KES' : null,
        customer.customer_tier === 'gold' ? 'Priority order processing' : null,
      ].filter((rule): rule is string => rule !== null);

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
          applicable_price_lists: (priceLists || []).map(pl => ({
            id: pl.id,
            name: pl.name,
            start_date: pl.start_date,
            end_date: pl.end_date,
            is_default: pl.is_default,
            currency_code: pl.currency_code,
            description: pl.description,
            created_at: pl.created_at,
            updated_at: pl.updated_at,
          })),
          special_pricing_rules: specialRules,
        },
      };
    }),

  // ============ NEW WEIGHT-BASED PRICING ENDPOINTS ============

  // POST /pricing/calculate-weight-based - Calculate price using weight-based formula
  calculateWeightBased: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/pricing/calculate-weight-based',
        tags: ['pricing'],
        summary: 'Calculate weight-based pricing for gas cylinders',
        description: 'Calculate price using weight-based formula: netGasWeight_kg × gasPricePerKg + depositAmount + tax',
        protect: true,
      }
    })
    .input(CalculateWeightBasedPricingSchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      const pricingService = new PricingService(ctx.supabase, ctx.logger);
      
      ctx.logger.info('Calculating weight-based pricing:', input);
      
      try {
        const weightBasedPrice = await pricingService.getWeightBasedPrice(
          input.product_id,
          input.quantity,
          input.customer_id,
          input.pricing_date
        );

        if (!weightBasedPrice) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'No weight-based pricing found for this product'
          });
        }

        // Apply custom overrides if provided
        let result = weightBasedPrice;
        
        if (input.custom_gas_weight_kg || input.custom_price_per_kg) {
          // Get product details for capacity
          const { data: product } = await ctx.supabase
            .from('products')
            .select('capacity_l, tax_rate')
            .eq('id', input.product_id)
            .single();

          if (product) {
            const gasWeight = input.custom_gas_weight_kg || weightBasedPrice.netGasWeight_kg;
            const pricePerKg = input.custom_price_per_kg || weightBasedPrice.gasPricePerKg;
            const depositAmount = await pricingService.getCurrentDepositRate(product.capacity_l);
            
            result = pricingService.calculateWeightBasedTotal(
              gasWeight,
              pricePerKg,
              depositAmount * input.quantity,
              product.tax_rate || 0
            );
          }
        }

        return {
          ...result,
          product_id: input.product_id,
          quantity: input.quantity,
          calculation_date: input.pricing_date || new Date().toISOString().split('T')[0],
        };
      } catch (error) {
        ctx.logger.error('Weight-based pricing calculation error:', error);
        throw error;
      }
    }),

  // GET /pricing/deposit-rate/{capacity} - Get deposit rate for cylinder capacity
  getDepositRate: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/pricing/deposit-rate/{capacity_l}',
        tags: ['pricing'],
        summary: 'Get deposit rate for cylinder capacity',
        description: 'Retrieve the current deposit rate for a specific cylinder capacity',
        protect: true,
      }
    })
    .input(GetDepositRateSchema)
    .output(z.any())
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      const pricingService = new PricingService(ctx.supabase, ctx.logger);
      
      ctx.logger.info('Fetching deposit rate:', input);
      
      try {
        const depositAmount = await pricingService.getCurrentDepositRate(
          input.capacity_l,
          input.currency_code,
          input.as_of_date
        );

        // Also fetch the full deposit rate record for additional details
        const { data: depositRate, error } = await ctx.supabase
          .from('cylinder_deposit_rates')
          .select('*')
          .eq('capacity_l', input.capacity_l)
          .eq('currency_code', input.currency_code)
          .lte('effective_date', input.as_of_date || new Date().toISOString().split('T')[0])
          .or(`end_date.is.null,end_date.gte.${input.as_of_date || new Date().toISOString().split('T')[0]}`)
          .eq('is_active', true)
          .order('effective_date', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) {
          ctx.logger.error('Error fetching deposit rate details:', error);
        }

        return {
          capacity_l: input.capacity_l,
          deposit_amount: depositAmount,
          currency_code: input.currency_code,
          as_of_date: input.as_of_date || new Date().toISOString().split('T')[0],
          rate_details: depositRate || null,
        };
      } catch (error) {
        ctx.logger.error('Deposit rate fetch error:', error);
        throw error;
      }
    }),

  // POST /pricing/calculate-total-with-deposits - Calculate order total including deposits
  calculateTotalWithDeposits: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/pricing/calculate-total-with-deposits',
        tags: ['pricing'],
        summary: 'Calculate order total including deposits',
        description: 'Calculate comprehensive order total including gas charges, deposits, and taxes for multiple items',
        protect: true,
      }
    })
    .input(CalculateTotalWithDepositsSchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      const pricingService = new PricingService(ctx.supabase, ctx.logger);
      
      ctx.logger.info('Calculating total with deposits:', input);
      
      try {
        const itemCalculations = [];
        let totalGasCharges = 0;
        let totalDeposits = 0;
        let totalSubtotal = 0;
        let totalTax = 0;

        for (const item of input.items) {
          // Get product details
          const { data: product, error: productError } = await ctx.supabase
            .from('products')
            .select(`
              id, name, sku, capacity_l, gross_weight_kg, net_gas_weight_kg, 
              tare_weight_kg, tax_rate, tax_category
            `)
            .eq('id', item.product_id)
            .single();

          if (productError || !product) {
            ctx.logger.error('Product not found:', item.product_id);
            continue;
          }

          let itemCalculation: any = {
            product_id: item.product_id,
            product_name: product.name,
            product_sku: product.sku,
            quantity: item.quantity,
            pricing_method: item.pricing_method || 'per_unit',
          };

          // Calculate based on pricing method
          if (item.pricing_method === 'per_kg' && product.net_gas_weight_kg && product.capacity_l) {
            // Weight-based pricing
            const weightBasedPrice = await pricingService.getWeightBasedPrice(
              item.product_id,
              item.quantity,
              input.customer_id,
              input.pricing_date
            );

            if (weightBasedPrice) {
              itemCalculation = {
                ...itemCalculation,
                gas_weight_kg: weightBasedPrice.netGasWeight_kg,
                price_per_kg: weightBasedPrice.gasPricePerKg,
                gas_charge: weightBasedPrice.gasCharge,
                deposit_amount: input.include_deposits ? weightBasedPrice.depositAmount : 0,
                subtotal: weightBasedPrice.gasCharge + (input.include_deposits ? weightBasedPrice.depositAmount : 0),
                tax_amount: weightBasedPrice.taxAmount,
                total: weightBasedPrice.gasCharge + (input.include_deposits ? weightBasedPrice.depositAmount : 0) + weightBasedPrice.taxAmount,
              };

              totalGasCharges += weightBasedPrice.gasCharge;
              totalDeposits += input.include_deposits ? weightBasedPrice.depositAmount : 0;
            }
          } else {
            // Traditional per-unit pricing
            const price = await pricingService.getProductPrice(
              item.product_id,
              input.customer_id,
              input.pricing_date
            );

            if (price) {
              const unitPrice = price.finalPrice;
              const subtotal = unitPrice * item.quantity;
              const depositAmount = input.include_deposits && product.capacity_l ? 
                await pricingService.getCurrentDepositRate(product.capacity_l) * item.quantity : 0;
              
              const taxableAmount = subtotal + depositAmount;
              const taxAmount = taxableAmount * ((input.tax_rate || product.tax_rate || 0) / 100);

              itemCalculation = {
                ...itemCalculation,
                unit_price: unitPrice,
                gas_charge: subtotal,
                deposit_amount: depositAmount,
                subtotal: subtotal + depositAmount,
                tax_amount: taxAmount,
                total: subtotal + depositAmount + taxAmount,
              };

              totalGasCharges += subtotal;
              totalDeposits += depositAmount;
            }
          }

          totalSubtotal += itemCalculation.subtotal || 0;
          totalTax += itemCalculation.tax_amount || 0;
          itemCalculations.push(itemCalculation);
        }

        const grandTotal = totalSubtotal + totalTax;

        return {
          customer_id: input.customer_id,
          items: itemCalculations,
          summary: {
            total_gas_charges: totalGasCharges,
            total_deposits: totalDeposits,
            subtotal: totalSubtotal,
            tax_amount: totalTax,
            grand_total: grandTotal,
          },
          include_deposits: input.include_deposits,
          tax_rate: input.tax_rate,
          calculation_date: input.pricing_date || new Date().toISOString().split('T')[0],
        };
      } catch (error) {
        ctx.logger.error('Total calculation with deposits error:', error);
        throw error;
      }
    }),

  // POST /pricing/calculate-final-price-enhanced - Enhanced final price calculation with pricing methods
  calculateFinalPriceEnhanced: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/pricing/calculate-final-price-enhanced',
        tags: ['pricing'],
        summary: 'Calculate final price with enhanced pricing methods',
        description: 'Calculate final price supporting per_unit, per_kg, flat_rate, and tiered pricing methods',
        protect: true,
      }
    })
    .input(EnhancedCalculateFinalPriceSchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      const pricingService = new PricingService(ctx.supabase, ctx.logger);
      
      ctx.logger.info('Calculating enhanced final price:', input);
      
      try {
        const finalPrice = await pricingService.calculateFinalPriceWithMethod(
          input.product_id,
          input.quantity,
          input.pricing_method,
          input.unit_price,
          input.surcharge_percent,
          input.customer_id,
          input.date
        );

        // Get additional details for context
        const { data: product } = await ctx.supabase
          .from('products')
          .select('name, sku, capacity_l, net_gas_weight_kg')
          .eq('id', input.product_id)
          .single();

        return {
          product_id: input.product_id,
          product_name: product?.name,
          product_sku: product?.sku,
          quantity: input.quantity,
          pricing_method: input.pricing_method,
          unit_price: input.unit_price,
          surcharge_percent: input.surcharge_percent || 0,
          final_price: finalPrice,
          price_per_unit: input.pricing_method === 'flat_rate' ? finalPrice : finalPrice / input.quantity,
          calculation_date: input.date || new Date().toISOString().split('T')[0],
        };
      } catch (error) {
        ctx.logger.error('Enhanced final price calculation error:', error);
        throw error;
      }
    }),

  // ============ NEW ORDER FLOW PRICING ENDPOINTS ============

  // POST /pricing/calculate-order-flow - Calculate pricing based on order type and flow
  calculateOrderFlow: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/pricing/calculate-order-flow',
        tags: ['pricing'],
        summary: 'Calculate pricing based on order flow (Outright vs Refill/Exchange)',
        description: 'Calculate pricing according to document: Outright = Gas Fill + Cylinder Deposit, Refill/Exchange = Gas Fill only with auto-generated empty return credit',
        protect: true,
      }
    })
    .input(z.object({
      order_type: z.enum(['outright', 'refill', 'exchange', 'pickup']),
      items: z.array(z.object({
        product_id: z.string().uuid(),
        quantity: z.number().positive(),
        variant: z.enum(['FULL', 'EMPTY', 'FULL-XCH', 'FULL-OUT']).optional(),
        scenario: z.enum(['OUT', 'XCH']).optional(),
      })),
      customer_id: z.string().uuid().optional(),
      pricing_date: z.string().optional(),
      include_deposits: z.boolean().default(true),
      auto_generate_empty_returns: z.boolean().default(true),
    }))
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      const pricingService = new PricingService(ctx.supabase, ctx.logger);
      
      ctx.logger.info('Calculating order flow pricing:', input);
      
      try {
        const calculations = [];
        let totalGasCharges = 0;
        let totalDeposits = 0;
        let totalEmptyCredits = 0;
        let totalSubtotal = 0;
        let totalTax = 0;

        for (const item of input.items) {
          // Get product details including variants
          const { data: product, error: productError } = await ctx.supabase
            .from('products')
            .select(`
              id, name, sku, capacity_l, gross_weight_kg, net_gas_weight_kg, 
              tare_weight_kg, tax_rate, tax_category, variant_type, sku_variant
            `)
            .eq('id', item.product_id)
            .single();

          if (productError || !product) {
            ctx.logger.error('Product not found:', item.product_id);
            continue;
          }

          let calculation: any = {
            product_id: item.product_id,
            product_name: product.name,
            product_sku: product.sku,
            quantity: item.quantity,
            variant: item.variant || product.sku_variant || 'FULL',
            scenario: item.scenario || (input.order_type === 'outright' ? 'OUT' : 'XCH'),
          };

          // Determine pricing based on order flow
          if (input.order_type === 'outright') {
            // Outright: Gas Fill + Cylinder Deposit
            if (product.net_gas_weight_kg && product.capacity_l) {
              const weightBasedPrice = await pricingService.getWeightBasedPrice(
                item.product_id,
                item.quantity,
                input.customer_id,
                input.pricing_date
              );

              if (weightBasedPrice) {
                calculation = {
                  ...calculation,
                  pricing_method: 'outright',
                  gas_weight_kg: weightBasedPrice.netGasWeight_kg,
                  price_per_kg: weightBasedPrice.gasPricePerKg,
                  gas_charge: weightBasedPrice.gasCharge,
                  deposit_amount: input.include_deposits ? weightBasedPrice.depositAmount : 0,
                  subtotal: weightBasedPrice.gasCharge + (input.include_deposits ? weightBasedPrice.depositAmount : 0),
                  tax_amount: weightBasedPrice.taxAmount,
                  total: weightBasedPrice.gasCharge + (input.include_deposits ? weightBasedPrice.depositAmount : 0) + weightBasedPrice.taxAmount,
                };

                totalGasCharges += weightBasedPrice.gasCharge;
                totalDeposits += input.include_deposits ? weightBasedPrice.depositAmount : 0;
              }
            } else {
              // Fallback to per-unit pricing
              const price = await pricingService.getProductPrice(
                item.product_id,
                input.customer_id,
                input.pricing_date
              );

              if (price) {
                const unitPrice = price.finalPrice;
                const subtotal = unitPrice * item.quantity;
                const depositAmount = input.include_deposits && product.capacity_l ? 
                  await pricingService.getCurrentDepositRate(product.capacity_l) * item.quantity : 0;
                
                const taxableAmount = subtotal + depositAmount;
                const taxAmount = taxableAmount * ((product.tax_rate || 0) / 100);

                calculation = {
                  ...calculation,
                  pricing_method: 'outright_per_unit',
                  unit_price: unitPrice,
                  gas_charge: subtotal,
                  deposit_amount: depositAmount,
                  subtotal: subtotal + depositAmount,
                  tax_amount: taxAmount,
                  total: subtotal + depositAmount + taxAmount,
                };

                totalGasCharges += subtotal;
                totalDeposits += depositAmount;
              }
            }
          } else if (input.order_type === 'refill' || input.order_type === 'exchange') {
            // Refill/Exchange: Gas Fill only + auto-generated empty return credit
            if (product.net_gas_weight_kg && product.capacity_l) {
              const weightBasedPrice = await pricingService.getWeightBasedPrice(
                item.product_id,
                item.quantity,
                input.customer_id,
                input.pricing_date
              );

              if (weightBasedPrice) {
                calculation = {
                  ...calculation,
                  pricing_method: 'refill_exchange',
                  gas_weight_kg: weightBasedPrice.netGasWeight_kg,
                  price_per_kg: weightBasedPrice.gasPricePerKg,
                  gas_charge: weightBasedPrice.gasCharge,
                  deposit_amount: 0, // No deposit for refill/exchange
                  subtotal: weightBasedPrice.gasCharge,
                  tax_amount: weightBasedPrice.taxAmount,
                  total: weightBasedPrice.gasCharge + weightBasedPrice.taxAmount,
                };

                totalGasCharges += weightBasedPrice.gasCharge;
              }
            } else {
              // Fallback to per-unit pricing
              const price = await pricingService.getProductPrice(
                item.product_id,
                input.customer_id,
                input.pricing_date
              );

              if (price) {
                const unitPrice = price.finalPrice;
                const subtotal = unitPrice * item.quantity;
                const taxAmount = subtotal * ((product.tax_rate || 0) / 100);

                calculation = {
                  ...calculation,
                  pricing_method: 'refill_exchange_per_unit',
                  unit_price: unitPrice,
                  gas_charge: subtotal,
                  deposit_amount: 0,
                  subtotal: subtotal,
                  tax_amount: taxAmount,
                  total: subtotal + taxAmount,
                };

                totalGasCharges += subtotal;
              }
            }

            // Auto-generate empty return credit if enabled
            if (input.auto_generate_empty_returns) {
              const capacityL = await getProductCapacityL(item.product_id, ctx.supabase);
              if (capacityL) {
                const emptyCredit = await calculateEmptyReturnCredit(
                  capacityL,
                  item.quantity,
                  input.customer_id,
                  ctx.supabase
                );

                if (emptyCredit) {
                  calculation.empty_return_credit = emptyCredit;
                  totalEmptyCredits += emptyCredit.credit_amount;
                }
              }
            }
          } else if (input.order_type === 'pickup') {
            // Pickup: Empty return credit only
            const capacityL = await getProductCapacityL(item.product_id, ctx.supabase);
            if (capacityL) {
              const emptyCredit = await calculateEmptyReturnCredit(
                capacityL,
                item.quantity,
                input.customer_id,
                ctx.supabase
              );

              if (emptyCredit) {
                calculation = {
                  ...calculation,
                  pricing_method: 'pickup',
                  gas_charge: 0,
                  deposit_amount: 0,
                  empty_return_credit: emptyCredit,
                  subtotal: -emptyCredit.credit_amount,
                  tax_amount: 0,
                  total: -emptyCredit.credit_amount,
                };

                totalEmptyCredits += emptyCredit.credit_amount;
              }
            }
          }

          totalSubtotal += calculation.subtotal || 0;
          totalTax += calculation.tax_amount || 0;
          calculations.push(calculation);
        }

        const grandTotal = totalSubtotal + totalTax;

        return {
          order_type: input.order_type,
          customer_id: input.customer_id,
          items: calculations,
          summary: {
            total_gas_charges: totalGasCharges,
            total_deposits: totalDeposits,
            total_empty_credits: totalEmptyCredits,
            subtotal: totalSubtotal,
            tax_amount: totalTax,
            grand_total: grandTotal,
          },
          include_deposits: input.include_deposits,
          auto_generated_empty_returns: input.auto_generate_empty_returns,
          calculation_date: input.pricing_date || new Date().toISOString().split('T')[0],
        };
      } catch (error) {
        ctx.logger.error('Order flow pricing calculation error:', error);
        throw error;
      }
    }),

  // POST /pricing/calculate-empty-return-credit - Calculate empty return credit
  calculateEmptyReturnCredit: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/pricing/calculate-empty-return-credit',
        tags: ['pricing'],
        summary: 'Calculate empty return credit for cylinder returns',
        description: 'Calculate credit amount for returning empty cylinders (negative price)',
        protect: true,
      }
    })
    .input(z.object({
      capacity_l: z.number().positive(),
      quantity: z.number().positive(),
      customer_id: z.string().uuid().optional(),
      condition: z.enum(['excellent', 'good', 'fair', 'poor', 'damaged', 'scrap']).default('good'),
      return_date: z.string().optional(),
      expected_return_date: z.string().optional(),
    }))
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      const pricingService = new PricingService(ctx.supabase, ctx.logger);
      
      ctx.logger.info('Calculating empty return credit:', input);
      
      try {
        // Get deposit rate for this capacity
        const depositAmount = await pricingService.getCurrentDepositRate(
          input.capacity_l,
          'KES',
          input.return_date
        );

        // Apply condition-based refund percentage
        const conditionRefunds = {
          'excellent': 1.0,   // 100% refund
          'good': 0.9,        // 90% refund
          'fair': 0.75,       // 75% refund
          'poor': 0.5,        // 50% refund
          'damaged': 0.25,    // 25% refund
          'scrap': 0.0,       // 0% refund
        };

        const refundPercentage = conditionRefunds[input.condition];
        const creditAmount = depositAmount * input.quantity * refundPercentage;

        // Check if return is late (if expected return date provided)
        let latePenalty = 0;
        let isLate = false;
        
        if (input.expected_return_date && input.return_date) {
          const expectedDate = new Date(input.expected_return_date);
          const actualDate = new Date(input.return_date);
          const daysLate = Math.ceil((actualDate.getTime() - expectedDate.getTime()) / (1000 * 60 * 60 * 24));
          
          if (daysLate > 0) {
            isLate = true;
            // Apply 5% penalty per week late, max 25%
            const weeksLate = Math.ceil(daysLate / 7);
            const penaltyPercentage = Math.min(weeksLate * 0.05, 0.25);
            latePenalty = creditAmount * penaltyPercentage;
          }
        }

        const finalCreditAmount = creditAmount - latePenalty;

        return {
          capacity_l: input.capacity_l,
          quantity: input.quantity,
          condition: input.condition,
          deposit_amount_per_unit: depositAmount,
          refund_percentage: refundPercentage * 100,
          credit_amount: finalCreditAmount,
          late_penalty: latePenalty,
          is_late: isLate,
          return_date: input.return_date || new Date().toISOString().split('T')[0],
          expected_return_date: input.expected_return_date,
          currency_code: 'KES',
        };
      } catch (error) {
        ctx.logger.error('Empty return credit calculation error:', error);
        throw error;
      }
    }),

  // POST /pricing/validate-product-variant-pricing - Validate product variant pricing
  validateProductVariantPricing: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/pricing/validate-product-variant-pricing',
        tags: ['pricing'],
        summary: 'Validate product variant pricing configuration',
        description: 'Validate that product variants have proper pricing for different scenarios (FULL, EMPTY, FULL-XCH, FULL-OUT)',
        protect: true,
      }
    })
    .input(z.object({
      product_id: z.string().uuid(),
      variants: z.array(z.object({
        sku_variant: z.enum(['FULL', 'EMPTY', 'FULL-XCH', 'FULL-OUT']),
        scenario: z.enum(['OUT', 'XCH']),
        status: z.enum(['FULL', 'EMPTY']),
        expected_pricing_method: z.enum(['per_unit', 'per_kg', 'flat_rate', 'tiered']),
      })),
    }))
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Validating product variant pricing:', input);
      
      try {
        const validationResults = [];
        const errors = [];
        const warnings = [];

        // Get product details
        const { data: product, error: productError } = await ctx.supabase
          .from('products')
          .select(`
            id, name, sku, capacity_l, gross_weight_kg, net_gas_weight_kg, 
            tare_weight_kg, tax_rate, tax_category, variant_type
          `)
          .eq('id', input.product_id)
          .single();

        if (productError || !product) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Product not found'
          });
        }

        for (const variant of input.variants) {
          const validation: any = {
            sku_variant: variant.sku_variant,
            scenario: variant.scenario,
            status: variant.status,
            expected_pricing_method: variant.expected_pricing_method,
            is_valid: true,
            issues: [],
          };

          // Check if variant exists in price lists
          const { data: priceListItems } = await ctx.supabase
            .from('price_list_item')
            .select(`
              id, unit_price, surcharge_pct, min_qty,
              price_list:price_list(id, name, pricing_method, start_date, end_date)
            `)
            .eq('product_id', input.product_id)
            .eq('price_list.pricing_method', variant.expected_pricing_method);

          if (!priceListItems || priceListItems.length === 0) {
            validation.is_valid = false;
            validation.issues.push(`No ${variant.expected_pricing_method} pricing found for ${variant.sku_variant} variant`);
          }

          // Validate pricing logic based on variant type
          if (variant.sku_variant === 'EMPTY') {
            // EMPTY variants should have negative or zero pricing
            const hasNegativePricing = priceListItems?.some(item => item.unit_price <= 0);
            if (!hasNegativePricing) {
              validation.is_valid = false;
              validation.issues.push('EMPTY variant should have negative or zero pricing for return credits');
            }
          } else if (variant.sku_variant === 'FULL-XCH') {
            // FULL-XCH should not include deposits
            if (variant.scenario === 'XCH') {
              validation.warnings = validation.warnings || [];
              validation.warnings.push('FULL-XCH should not include cylinder deposits in pricing');
            }
          } else if (variant.sku_variant === 'FULL-OUT') {
            // FULL-OUT should include deposits
            if (variant.scenario === 'OUT') {
              validation.warnings = validation.warnings || [];
              validation.warnings.push('FULL-OUT should include cylinder deposits in pricing');
            }
          }

          // Check weight-based pricing requirements
          if (variant.expected_pricing_method === 'per_kg') {
            if (!product.net_gas_weight_kg || !product.capacity_l) {
              validation.is_valid = false;
              validation.issues.push('Per_kg pricing requires net_gas_weight_kg and capacity_l');
            }
          }

          validationResults.push(validation);

          if (!validation.is_valid) {
            errors.push(...validation.issues);
          }
          if (validation.warnings) {
            warnings.push(...validation.warnings);
          }
        }

        return {
          product_id: input.product_id,
          product_name: product.name,
          product_sku: product.sku,
          validation_results: validationResults,
          total_variants: input.variants.length,
          valid_variants: validationResults.filter(r => r.is_valid).length,
          errors,
          warnings,
          overall_valid: errors.length === 0,
        };
      } catch (error) {
        ctx.logger.error('Product variant pricing validation error:', error);
        throw error;
      }
    }),

  // ============ EXAMPLE: PRICING FOR SPECIFIC PRODUCT ============

  // POST /pricing/example/{product_id} - Example pricing calculation for specific product
  calculateExamplePricing: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/pricing/example/{product_id}',
        tags: ['pricing'],
        summary: 'Example pricing calculation for specific product',
        description: 'Calculate pricing for all scenarios (outright, refill, exchange, pickup) for a specific product to demonstrate the complete pricing system.',
        protect: true,
      }
    })
    .input(z.object({
      product_id: z.string().uuid(),
      quantity: z.number().positive().default(1),
      customer_id: z.string().uuid().optional(),
      pricing_date: z.string().optional(),
    }))
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      const pricingService = new PricingService(ctx.supabase, ctx.logger);

      try {
        // Get product details
        const { data: product, error: productError } = await ctx.supabase
          .from('products')
          .select(`
            id, name, sku, capacity_kg, capacity_l, tare_weight_kg, 
            gross_weight_kg, net_gas_weight_kg, sku_variant, variant,
            tax_rate, tax_category
          `)
          .eq('id', input.product_id)
          .single();

        if (productError || !product) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Product not found',
          });
        }

        // Calculate capacity in liters
        const capacityL = await getProductCapacityL(input.product_id, ctx.supabase);
        
        // Get deposit rate
        const depositRate = capacityL ? await pricingService.getCurrentDepositRate(capacityL) : 0;

        // Calculate all pricing scenarios
        const scenarios = {
          // 1. OUTRIGHT: Gas Fill + Cylinder Deposit (no empty expected back)
          outright: await pricingService.calculateOrderTotalsWithDeposits(
            [{
              product_id: input.product_id,
              quantity: input.quantity,
              unit_price: 0, // Will be calculated by weight-based pricing
              pricing_method: 'per_kg',
              include_deposit: true
            }],
            product.tax_rate || 0,
            input.customer_id,
            input.pricing_date
          ),

          // 2. REFILL: Gas Fill only + auto-generated empty return credit
          refill: await pricingService.calculateOrderTotalsWithDeposits(
            [{
              product_id: input.product_id,
              quantity: input.quantity,
              unit_price: 0, // Will be calculated by weight-based pricing
              pricing_method: 'per_kg',
              include_deposit: false
            }],
            product.tax_rate || 0,
            input.customer_id,
            input.pricing_date
          ),

          // 3. EXCHANGE: Gas Fill only + auto-generated empty return credit
          exchange: await pricingService.calculateOrderTotalsWithDeposits(
            [{
              product_id: input.product_id,
              quantity: input.quantity,
              unit_price: 0, // Will be calculated by weight-based pricing
              pricing_method: 'per_kg',
              include_deposit: false
            }],
            product.tax_rate || 0,
            input.customer_id,
            input.pricing_date
          ),

          // 4. PICKUP: Empty return credit only
          pickup: await pricingService.calculateOrderTotalsWithDeposits(
            [{
              product_id: input.product_id,
              quantity: input.quantity,
              unit_price: 0, // Will be calculated by weight-based pricing
              pricing_method: 'per_kg',
              include_deposit: false
            }],
            product.tax_rate || 0,
            input.customer_id,
            input.pricing_date
          ),

          // 5. Weight-based pricing calculation
          weight_based: await pricingService.getWeightBasedPrice(
            input.product_id,
            input.quantity,
            input.customer_id,
            input.pricing_date
          )
        };

        return {
          product: {
            id: product.id,
            name: product.name,
            sku: product.sku,
            capacity_kg: product.capacity_kg,
            capacity_l: capacityL,
            tare_weight_kg: product.tare_weight_kg,
            gross_weight_kg: product.gross_weight_kg,
            net_gas_weight_kg: product.net_gas_weight_kg,
            sku_variant: product.sku_variant,
            variant: product.variant,
            tax_rate: product.tax_rate,
            tax_category: product.tax_category
          },
          deposit_rate: {
            capacity_l: capacityL,
            deposit_amount: depositRate,
            currency: 'KES'
          },
          quantity: input.quantity,
          pricing_date: input.pricing_date || new Date().toISOString().split('T')[0],
          scenarios,
          explanation: {
            outright: "Gas Fill + Cylinder Deposit (customer keeps the cylinder)",
            refill: "Gas Fill only + Empty Return Credit (customer returns empty cylinder)",
            exchange: "Gas Fill only + Empty Return Credit (customer exchanges empty for full)",
            pickup: "Empty Return Credit only (customer returns empty cylinder)",
            weight_based: "Per-kg pricing based on net gas weight"
          }
        };

      } catch (error) {
        ctx.logger.error('Example pricing calculation error:', error);
        throw error;
      }
    }),
});