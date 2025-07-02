import { z } from 'zod';
import { router, protectedProcedure } from '../lib/trpc';
import { requireTenantAccess } from '../lib/auth';
import { TRPCError } from '@trpc/server';

// Validation schemas
const ProductStatusEnum = z.enum(['active', 'end_of_sale', 'obsolete']);
const UnitOfMeasureEnum = z.enum(['cylinder', 'kg']);
const VariantTypeEnum = z.enum(['cylinder', 'refillable', 'disposable']);

const ProductFiltersSchema = z.object({
  search: z.string().optional(),
  status: ProductStatusEnum.optional(),
  unit_of_measure: UnitOfMeasureEnum.optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(50),
  sort_by: z.string().default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc'),
  show_obsolete: z.boolean().default(false),
});

const CreateProductSchema = z.object({
  sku: z.string().min(1, 'SKU is required'),
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  unit_of_measure: UnitOfMeasureEnum,
  capacity_kg: z.number().positive().optional(),
  tare_weight_kg: z.number().positive().optional(),
  valve_type: z.string().optional(),
  status: ProductStatusEnum.default('active'),
  barcode_uid: z.string().optional(),
  requires_tag: z.boolean().default(false),
  variant_type: VariantTypeEnum,
  parent_product_id: z.string().uuid().optional(),
  variant_name: z.string().optional(),
  is_variant: z.boolean().default(false),
});

const UpdateProductSchema = z.object({
  id: z.string().uuid(),
  sku: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  unit_of_measure: UnitOfMeasureEnum.optional(),
  capacity_kg: z.number().positive().optional(),
  tare_weight_kg: z.number().positive().optional(),
  valve_type: z.string().optional(),
  status: ProductStatusEnum.optional(),
  barcode_uid: z.string().optional(),
  requires_tag: z.boolean().optional(),
  variant_type: VariantTypeEnum.optional(),
  parent_product_id: z.string().uuid().optional(),
  variant_name: z.string().optional(),
  is_variant: z.boolean().optional(),
});

const CreateVariantSchema = z.object({
  parent_product_id: z.string().uuid(),
  variant_name: z.string().min(1, 'Variant name is required'),
  sku: z.string().min(1, 'SKU is required'),
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  status: ProductStatusEnum.default('active'),
  barcode_uid: z.string().optional(),
});

const BulkStatusUpdateSchema = z.object({
  product_ids: z.array(z.string().uuid()).min(1),
  status: ProductStatusEnum,
});

export const productsRouter = router({
  // GET /products - List products with filtering and pagination
  list: protectedProcedure
    .input(ProductFiltersSchema)
    .query(async ({ input, ctx }) => {
      const user = requireTenantAccess(ctx);
      
      ctx.logger.info('Fetching products with filters:', input);
      
      let query = ctx.supabase
        .from('products')
        .select('*', { count: 'exact' })
        ;

      // By default, hide obsolete products unless specifically requested
      if (!input.show_obsolete) {
        query = query.in('status', ['active', 'end_of_sale']);
      }

      // Apply search filter
      if (input.search) {
        query = query.or(`sku.ilike.%${input.search}%,name.ilike.%${input.search}%,description.ilike.%${input.search}%`);
      }

      // Apply status filter
      if (input.status) {
        query = query.eq('status', input.status);
      }

      // Apply unit of measure filter
      if (input.unit_of_measure) {
        query = query.eq('unit_of_measure', input.unit_of_measure);
      }

      // Apply sorting
      query = query.order(input.sort_by, { ascending: input.sort_order === 'asc' });

      // Apply pagination
      const from = (input.page - 1) * input.limit;
      const to = from + input.limit - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) {
        ctx.logger.error('Error fetching products:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch products',
        });
      }

      return {
        products: data || [],
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / input.limit),
        currentPage: input.page,
      };
    }),

  // GET /products/:id - Get single product by ID
  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const user = requireTenantAccess(ctx);
      
      ctx.logger.info('Fetching product:', input.id);
      
      const { data, error } = await ctx.supabase
        .from('products')
        .select('*')
        .eq('id', input.id)
        
        .single();

      if (error) {
        ctx.logger.error('Error fetching product:', error);
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Product not found',
        });
      }

      return data;
    }),

  // GET /products/stats - Get product statistics
  getStats: protectedProcedure
    .query(async ({ ctx }) => {
      const user = requireTenantAccess(ctx);
      
      ctx.logger.info('Fetching product statistics');
      
      const { data, error } = await ctx.supabase
        .from('products')
        .select('status, unit_of_measure')
        ;

      if (error) {
        ctx.logger.error('Error fetching product stats:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch product statistics',
        });
      }

      const stats = {
        total: data.length,
        active: data.filter(p => p.status === 'active').length,
        end_of_sale: data.filter(p => p.status === 'end_of_sale').length,
        obsolete: data.filter(p => p.status === 'obsolete').length,
        cylinders: data.filter(p => p.unit_of_measure === 'cylinder').length,
        kg_products: data.filter(p => p.unit_of_measure === 'kg').length,
      };

      return stats;
    }),

  // GET /products/options - Get product options for dropdowns
  getOptions: protectedProcedure
    .input(z.object({
      status: z.array(ProductStatusEnum).default(['active']),
      include_variants: z.boolean().default(true),
    }))
    .query(async ({ input, ctx }) => {
      const user = requireTenantAccess(ctx);
      
      ctx.logger.info('Fetching product options');
      
      const { data, error } = await ctx.supabase
        .from('products')
        .select('id, sku, name, variant_name, is_variant')
        
        .in('status', input.status)
        .order('name');

      if (error) {
        ctx.logger.error('Error fetching product options:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch product options',
        });
      }

      let products = data || [];

      // Filter variants if not requested
      if (!input.include_variants) {
        products = products.filter(p => !p.is_variant);
      }

      return products.map(p => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
        display_name: p.variant_name ? `${p.name} - ${p.variant_name}` : p.name,
        is_variant: p.is_variant,
      }));
    }),

  // POST /products - Create new product
  create: protectedProcedure
    .input(CreateProductSchema)
    .mutation(async ({ input, ctx }) => {
      const user = requireTenantAccess(ctx);
      
      ctx.logger.info('Creating product:', input);
      
      // Check SKU uniqueness
      const { data: existingSku } = await ctx.supabase
        .from('products')
        .select('id')
        .eq('sku', input.sku)
        
        .single();

      if (existingSku) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'SKU already exists. Please use a unique SKU.',
        });
      }

      // If creating a variant, verify parent product exists
      if (input.is_variant && input.parent_product_id) {
        const { data: parentProduct, error: parentError } = await ctx.supabase
          .from('products')
          .select('id')
          .eq('id', input.parent_product_id)
          
          .single();

        if (parentError || !parentProduct) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Parent product not found',
          });
        }
      }

      const { data, error } = await ctx.supabase
        .from('products')
        .insert([{
          ...input,
          
          created_at: new Date().toISOString(),
        }])
        .select()
        .single();

      if (error) {
        ctx.logger.error('Error creating product:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create product',
        });
      }

      return data;
    }),

  // PUT /products/:id - Update product
  update: protectedProcedure
    .input(UpdateProductSchema)
    .mutation(async ({ input, ctx }) => {
      const user = requireTenantAccess(ctx);
      
      const { id, ...updateData } = input;
      
      ctx.logger.info('Updating product:', id, updateData);
      
      // Check SKU uniqueness if SKU is being updated
      if (updateData.sku) {
        const { data: existingSku } = await ctx.supabase
          .from('products')
          .select('id')
          .eq('sku', updateData.sku)
          
          .neq('id', id)
          .single();

        if (existingSku) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'SKU already exists. Please use a unique SKU.',
          });
        }
      }

      const { data, error } = await ctx.supabase
        .from('products')
        .update({
          ...updateData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        
        .select()
        .single();

      if (error) {
        ctx.logger.error('Error updating product:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update product',
        });
      }

      return data;
    }),

  // DELETE /products/:id - Delete product (soft delete by setting status to obsolete)
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const user = requireTenantAccess(ctx);
      
      ctx.logger.info('Deleting product:', input.id);
      
      // Check if product has inventory or is used in orders
      const { data: inventoryCheck } = await ctx.supabase
        .from('inventory_balance')
        .select('id')
        .eq('product_id', input.id)
        .gt('qty_full', 0)
        .limit(1);

      if (inventoryCheck && inventoryCheck.length > 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot delete product with existing inventory. Set status to obsolete instead.',
        });
      }

      // Soft delete by setting status to obsolete
      const { data, error } = await ctx.supabase
        .from('products')
        .update({
          status: 'obsolete',
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.id)
        
        .select()
        .single();

      if (error) {
        ctx.logger.error('Error deleting product:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to delete product',
        });
      }

      return { success: true, product: data };
    }),

  // GET /products/:id/variants - Get product variants
  getVariants: protectedProcedure
    .input(z.object({ parent_product_id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const user = requireTenantAccess(ctx);
      
      const { data, error } = await ctx.supabase
        .from('products')
        .select('*')
        .eq('parent_product_id', input.parent_product_id)
        
        .eq('is_variant', true)
        .order('variant_name');

      if (error) {
        ctx.logger.error('Error fetching product variants:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch product variants',
        });
      }

      return data || [];
    }),

  // POST /products/:id/variants - Create product variant
  createVariant: protectedProcedure
    .input(CreateVariantSchema)
    .mutation(async ({ input, ctx }) => {
      const user = requireTenantAccess(ctx);
      
      ctx.logger.info('Creating product variant:', input);
      
      // Check SKU uniqueness
      const { data: existingSku } = await ctx.supabase
        .from('products')
        .select('id')
        .eq('sku', input.sku)
        
        .single();

      if (existingSku) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'SKU already exists. Please use a unique SKU.',
        });
      }

      // Get parent product info
      const { data: parentProduct, error: parentError } = await ctx.supabase
        .from('products')
        .select('*')
        .eq('id', input.parent_product_id)
        
        .single();

      if (parentError || !parentProduct) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Parent product not found',
        });
      }

      const { data, error } = await ctx.supabase
        .from('products')
        .insert([{
          ...input,
          
          is_variant: true,
          unit_of_measure: parentProduct.unit_of_measure,
          variant_type: parentProduct.variant_type,
          capacity_kg: parentProduct.capacity_kg,
          tare_weight_kg: parentProduct.tare_weight_kg,
          valve_type: parentProduct.valve_type,
          requires_tag: parentProduct.requires_tag,
          created_at: new Date().toISOString(),
        }])
        .select()
        .single();

      if (error) {
        ctx.logger.error('Error creating product variant:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create product variant',
        });
      }

      return data;
    }),

  // POST /products/bulk-update-status - Bulk update product status
  bulkUpdateStatus: protectedProcedure
    .input(BulkStatusUpdateSchema)
    .mutation(async ({ input, ctx }) => {
      const user = requireTenantAccess(ctx);
      
      ctx.logger.info('Bulk updating product status:', input);
      
      const { data, error } = await ctx.supabase
        .from('products')
        .update({
          status: input.status,
          updated_at: new Date().toISOString(),
        })
        .in('id', input.product_ids)
        
        .select();

      if (error) {
        ctx.logger.error('Error bulk updating product status:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to bulk update product status',
        });
      }

      return { 
        success: true, 
        updated_count: data?.length || 0,
        products: data || []
      };
    }),

  // POST /products/reactivate - Reactivate obsolete product
  reactivate: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const user = requireTenantAccess(ctx);
      
      ctx.logger.info('Reactivating product:', input.id);
      
      const { data, error } = await ctx.supabase
        .from('products')
        .update({
          status: 'active',
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.id)
        
        .select()
        .single();

      if (error) {
        ctx.logger.error('Error reactivating product:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to reactivate product',
        });
      }

      return data;
    }),

  // POST /products/validate - Validate product data
  validate: protectedProcedure
    .input(z.object({
      sku: z.string().min(1),
      name: z.string().min(1),
      exclude_id: z.string().uuid().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const user = requireTenantAccess(ctx);
      
      const errors: string[] = [];
      const warnings: string[] = [];

      // Check SKU uniqueness
      let skuQuery = ctx.supabase
        .from('products')
        .select('id, name')
        .eq('sku', input.sku)
        ;

      if (input.exclude_id) {
        skuQuery = skuQuery.neq('id', input.exclude_id);
      }

      const { data: existingProduct } = await skuQuery.single();

      if (existingProduct) {
        errors.push(`SKU "${input.sku}" is already used by product "${existingProduct.name}"`);
      }

      // Check name similarity (warning only)
      const { data: similarNames } = await ctx.supabase
        .from('products')
        .select('name')
        
        .ilike('name', `%${input.name}%`)
        .neq('id', input.exclude_id || '');

      if (similarNames && similarNames.length > 0) {
        warnings.push(`Similar product names found: ${similarNames.map(p => p.name).join(', ')}`);
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
      };
    }),
});