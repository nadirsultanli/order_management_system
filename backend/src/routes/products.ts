import { z } from 'zod';
import { router, protectedProcedure } from '../lib/trpc';
import { requireAuth } from '../lib/auth';
import { TRPCError } from '@trpc/server';

// Validation schemas
const ProductStatusEnum = z.enum(['active', 'end_of_sale', 'obsolete']);
const UnitOfMeasureEnum = z.enum(['cylinder', 'kg']);
const VariantTypeEnum = z.enum(['cylinder', 'refillable', 'disposable']);

const ProductFiltersSchema = z.object({
  search: z.string().optional(),
  status: ProductStatusEnum.optional(),
  unit_of_measure: UnitOfMeasureEnum.optional(),
  variant_type: VariantTypeEnum.optional(),
  has_inventory: z.boolean().optional(),
  low_stock_only: z.boolean().default(false),
  availability_status: z.enum(['available', 'low_stock', 'out_of_stock']).optional(),
  capacity_min: z.number().min(0).optional(),
  capacity_max: z.number().min(0).optional(),
  weight_min: z.number().min(0).optional(),
  weight_max: z.number().min(0).optional(),
  requires_tag: z.boolean().optional(),
  is_variant: z.boolean().optional(),
  created_after: z.string().optional(),
  updated_after: z.string().optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(1000).default(50),
  sort_by: z.enum(['created_at', 'name', 'sku', 'capacity_kg', 'inventory_level', 'last_sold']).default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc'),
  show_obsolete: z.boolean().default(false),
  include_inventory_data: z.boolean().default(false),
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
  // GET /products - List products with advanced filtering and business logic
  list: protectedProcedure
    .input(ProductFiltersSchema)
    .query(async ({ input, ctx }) => {
      try {
        const user = requireAuth(ctx);
        
        ctx.logger.info('Fetching products with advanced filters:', input);
      
      // Start with basic product fields
      let selectClause = '*';
      
      // Only include inventory data if explicitly requested
      // Note: When using nested selects in PostgREST, we can't use '*' in combination with nested fields
      if (input.include_inventory_data) {
        selectClause = 'id, sku, name, description, unit_of_measure, capacity_kg, tare_weight_kg, valve_type, status, barcode_uid, created_at, requires_tag, variant_type, parent_product_id, variant_name, is_variant, inventory_balance:inventory_balance(warehouse_id, qty_full, qty_empty, qty_reserved, updated_at, warehouse:warehouses(name))';
      }
      
      let query = ctx.supabase
        .from('products')
        .select(selectClause, { count: 'exact' })
        .throwOnError();

      // By default, hide obsolete products unless specifically requested
      if (!input.show_obsolete) {
        query = query.in('status', ['active', 'end_of_sale']);
      }

      // Apply search filter with enhanced logic
      if (input.search) {
        const searchTerm = input.search.replace(/[%_]/g, '\\$&'); // Escape special characters
        query = query.or(`sku.ilike.%${searchTerm}%,name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,barcode_uid.ilike.%${searchTerm}%`);
      }

      // Apply status filter
      if (input.status) {
        query = query.eq('status', input.status);
      }

      // Apply unit of measure filter
      if (input.unit_of_measure) {
        query = query.eq('unit_of_measure', input.unit_of_measure);
      }

      // Apply variant type filter
      if (input.variant_type) {
        query = query.eq('variant_type', input.variant_type);
      }

      // Apply capacity range filters
      if (input.capacity_min !== undefined) {
        query = query.gte('capacity_kg', input.capacity_min);
      }
      if (input.capacity_max !== undefined) {
        query = query.lte('capacity_kg', input.capacity_max);
      }

      // Apply weight range filters
      if (input.weight_min !== undefined) {
        query = query.gte('tare_weight_kg', input.weight_min);
      }
      if (input.weight_max !== undefined) {
        query = query.lte('tare_weight_kg', input.weight_max);
      }

      // Apply tag requirement filter
      if (input.requires_tag !== undefined) {
        query = query.eq('requires_tag', input.requires_tag);
      }

      // Apply variant filter
      if (input.is_variant !== undefined) {
        query = query.eq('is_variant', input.is_variant);
      }

      // Apply date filters
      if (input.created_after) {
        query = query.gte('created_at', input.created_after);
      }
      if (input.updated_after) {
        // Note: products table doesn't have updated_at column, treating as created_after
        query = query.gte('created_at', input.updated_after);
      }

      // Apply sorting
      query = query.order(input.sort_by, { ascending: input.sort_order === 'asc' });

      // Apply pagination
      const from = (input.page - 1) * input.limit;
      const to = from + input.limit - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) {
        const errorObj = error as any;
        ctx.logger.error('Error fetching products:', {
          error,
          errorMessage: errorObj.message,
          errorCode: errorObj.code,
          errorDetails: errorObj.details,
          errorHint: errorObj.hint,
          filters: input
        });
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to fetch products: ${errorObj.message}`,
        });
      }

      let products = (data || []).map((product: any) => {
        const inventoryData = (product as any).inventory_balance || [];
        const totalStock = inventoryData.reduce((sum: number, inv: any) => sum + inv.qty_full, 0);
        const totalAvailable = inventoryData.reduce((sum: number, inv: any) => sum + (inv.qty_full - inv.qty_reserved), 0);
        
        return {
          ...(product as any),
          inventory_summary: input.include_inventory_data ? {
            total_stock: totalStock,
            total_available: totalAvailable,
            warehouse_count: inventoryData.length,
            stock_level: calculateProductStockLevel(totalAvailable),
            is_available: totalAvailable > 0,
            last_restocked: getLastRestockedDate(inventoryData),
          } : undefined,
          // Business logic fields
          popularity_score: calculatePopularity(product),
          compliance_score: calculateComplianceScore(product),
          profitability_score: calculateProfitabilityScore(product),
        };
      });

      // Apply business logic filters that require calculated data
      if (input.has_inventory !== undefined) {
        products = products.filter(product => {
          const hasStock = (product.inventory_summary?.total_available || 0) > 0;
          return input.has_inventory ? hasStock : !hasStock;
        });
      }

      if (input.low_stock_only) {
        products = products.filter(product => 
          product.inventory_summary?.stock_level === 'low' || 
          product.inventory_summary?.stock_level === 'critical'
        );
      }

      if (input.availability_status) {
        products = products.filter(product => {
          const stockLevel = product.inventory_summary?.stock_level || 'unknown';
          switch (input.availability_status) {
            case 'available':
              return ['high', 'normal'].includes(stockLevel);
            case 'low_stock':
              return stockLevel === 'low';
            case 'out_of_stock':
              return ['critical', 'out'].includes(stockLevel);
            default:
              return true;
          }
        });
      }

      // Apply custom sorting for calculated fields
      if (['inventory_level', 'last_sold'].includes(input.sort_by)) {
        products = products.sort((a, b) => {
          let aValue, bValue;
          
          if (input.sort_by === 'inventory_level') {
            aValue = a.inventory_summary?.total_available || 0;
            bValue = b.inventory_summary?.total_available || 0;
          } else if (input.sort_by === 'last_sold') {
            aValue = new Date(a.inventory_summary?.last_restocked || '1970-01-01').getTime();
            bValue = new Date(b.inventory_summary?.last_restocked || '1970-01-01').getTime();
          }
          
          return input.sort_order === 'asc' ? aValue - bValue : bValue - aValue;
        });
      }

      return {
        products,
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / input.limit),
        currentPage: input.page,
        summary: await generateProductSummary(ctx, products),
      };
      } catch (error) {
        ctx.logger.error('Unexpected error in products.list:', {
          error,
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          errorStack: error instanceof Error ? error.stack : undefined,
          filters: input
        });
        
        if (error instanceof TRPCError) {
          throw error;
        }
        
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred while fetching products',
        });
      }
    }),

  // GET /products/:id - Get single product by ID
  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
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
      const user = requireAuth(ctx);
      
      ctx.logger.info('Fetching product statistics');
      
      const { data, error } = await ctx.supabase
        .from('products')
        .select('status, unit_of_measure');

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
      const user = requireAuth(ctx);
      
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
      const user = requireAuth(ctx);
      
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
      const user = requireAuth(ctx);
      
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
      const user = requireAuth(ctx);
      
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
      const user = requireAuth(ctx);
      
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
      const user = requireAuth(ctx);
      
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
      const user = requireAuth(ctx);
      
      ctx.logger.info('Bulk updating product status:', input);
      
      const { data, error } = await ctx.supabase
        .from('products')
        .update({
          status: input.status,
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
      const user = requireAuth(ctx);
      
      ctx.logger.info('Reactivating product:', input.id);
      
      const { data, error } = await ctx.supabase
        .from('products')
        .update({
          status: 'active',
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
      const user = requireAuth(ctx);
      
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

  // POST /products/validate-sku - Validate SKU format and uniqueness
  validateSku: protectedProcedure
    .input(z.object({
      sku: z.string().min(1),
      exclude_id: z.string().uuid().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      const errors: string[] = [];
      const warnings: string[] = [];

      // Business rule: SKU format validation
      const skuPattern = /^[A-Z0-9-]+$/;
      if (!skuPattern.test(input.sku)) {
        errors.push('SKU must contain only uppercase letters, numbers, and hyphens');
      }

      // Business rule: SKU length constraints
      if (input.sku.length < 3) {
        errors.push('SKU must be at least 3 characters long');
      }
      
      if (input.sku.length > 50) {
        errors.push('SKU must be 50 characters or less');
      }

      // Business rule: Check for reserved SKU patterns
      const reservedPrefixes = ['SYS-', 'ADMIN-', 'TEST-'];
      const hasReservedPrefix = reservedPrefixes.some(prefix => input.sku.startsWith(prefix));
      if (hasReservedPrefix) {
        errors.push('SKU cannot start with reserved prefixes: ' + reservedPrefixes.join(', '));
      }

      // Check SKU uniqueness
      let skuQuery = ctx.supabase
        .from('products')
        .select('id, name, status')
        .eq('sku', input.sku)
        ;

      if (input.exclude_id) {
        skuQuery = skuQuery.neq('id', input.exclude_id);
      }

      const { data: existingProduct } = await skuQuery.single();

      if (existingProduct) {
        if (existingProduct.status === 'obsolete') {
          warnings.push(`SKU "${input.sku}" was previously used by obsolete product "${existingProduct.name}"`);
        } else {
          errors.push(`SKU "${input.sku}" is already used by active product "${existingProduct.name}"`);
        }
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
      };
    }),

  // POST /products/validate-weight - Validate weight constraints
  validateWeight: protectedProcedure
    .input(z.object({
      capacity_kg: z.number().optional(),
      tare_weight_kg: z.number().optional(),
      unit_of_measure: UnitOfMeasureEnum,
    }))
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      const errors: string[] = [];
      const warnings: string[] = [];

      if (input.unit_of_measure === 'cylinder') {
        // Business rule: Cylinder capacity constraints
        if (input.capacity_kg !== undefined) {
          if (input.capacity_kg <= 0) {
            errors.push('Cylinder capacity must be greater than 0');
          }
          if (input.capacity_kg > 500) {
            errors.push('Cylinder capacity must be 500 kg or less');
          }
          if (input.capacity_kg < 1) {
            warnings.push('Very small cylinder capacity - please verify this is correct');
          }
          if (input.capacity_kg > 100) {
            warnings.push('Large cylinder capacity - may require special handling permits');
          }
        }

        // Business rule: Tare weight constraints
        if (input.tare_weight_kg !== undefined) {
          if (input.tare_weight_kg <= 0) {
            errors.push('Tare weight must be greater than 0');
          }
          if (input.tare_weight_kg > 100) {
            errors.push('Tare weight must be 100 kg or less');
          }
        }

        // Business rule: Capacity vs tare weight ratio
        if (input.capacity_kg && input.tare_weight_kg) {
          const ratio = input.capacity_kg / input.tare_weight_kg;
          if (ratio < 0.5) {
            warnings.push('Capacity to tare weight ratio is unusually low - please verify');
          }
          if (ratio > 20) {
            warnings.push('Capacity to tare weight ratio is unusually high - please verify');
          }
        }
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
      };
    }),

  // POST /products/validate-status-change - Validate status change business rules
  validateStatusChange: protectedProcedure
    .input(z.object({
      product_id: z.string().uuid(),
      new_status: ProductStatusEnum,
    }))
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      const errors: string[] = [];
      const warnings: string[] = [];

      // Get current product data
      const { data: product, error: productError } = await ctx.supabase
        .from('products')
        .select('*')
        .eq('id', input.product_id)
        .single();

      if (productError || !product) {
        errors.push('Product not found');
        return { valid: false, errors, warnings };
      }

      // Business rule: Cannot reactivate if there are variants
      if (product.status === 'obsolete' && input.new_status === 'active') {
        const { data: variants } = await ctx.supabase
          .from('products')
          .select('id')
          .eq('parent_product_id', input.product_id)
          .eq('is_variant', true);

        if (variants && variants.length > 0) {
          warnings.push('Product has variants that may also need to be reactivated');
        }
      }

      // Business rule: Check inventory before making obsolete
      if (input.new_status === 'obsolete') {
        const { data: inventory } = await ctx.supabase
          .from('inventory_balance')
          .select('qty_full, qty_empty, warehouse:warehouses(name)')
          .eq('product_id', input.product_id)
          .gt('qty_full', 0);

        if (inventory && inventory.length > 0) {
          const totalStock = inventory.reduce((sum, inv) => sum + inv.qty_full, 0);
          warnings.push(`Product has ${totalStock} units in stock across ${inventory.length} warehouses`);
          
          const warehouseNames = inventory.map((inv: any) => inv.warehouse?.name || 'Unknown').filter(Boolean).join(', ');
          warnings.push(`Stock locations: ${warehouseNames}`);
        }

        // Check pending orders
        const { data: pendingOrders } = await ctx.supabase
          .from('order_lines')
          .select('orders(id, status, customer:customers(name))')
          .eq('product_id', input.product_id)
          .in('orders.status', ['draft', 'confirmed', 'scheduled']);

        if (pendingOrders && pendingOrders.length > 0) {
          errors.push(`Cannot make product obsolete - it has ${pendingOrders.length} pending order lines`);
        }
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        current_status: product.status,
      };
    }),

  // GET /products/availability-matrix - Get product availability across warehouses
  getAvailabilityMatrix: protectedProcedure
    .input(z.object({
      product_ids: z.array(z.string().uuid()).optional(),
      warehouse_ids: z.array(z.string().uuid()).optional(),
      include_reserved: z.boolean().default(false),
      min_quantity: z.number().min(0).default(1),
    }))
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Fetching product availability matrix:', input);
      
      let query = ctx.supabase
        .from('inventory_balance')
        .select(`
          *,
          product:products(id, sku, name, unit_of_measure, status),
          warehouse:warehouses(id, name)
        `);

      if (input.product_ids && input.product_ids.length > 0) {
        query = query.in('product_id', input.product_ids);
      }

      if (input.warehouse_ids && input.warehouse_ids.length > 0) {
        query = query.in('warehouse_id', input.warehouse_ids);
      }

      const { data, error } = await query;

      if (error) {
        ctx.logger.error('Availability matrix error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message
        });
      }

      const matrix = buildAvailabilityMatrix(data || [], input.include_reserved, input.min_quantity);

      return {
        availability_matrix: matrix,
        summary: {
          total_products: matrix.length,
          total_warehouses: matrix[0]?.warehouses?.length || 0,
          products_with_stock: matrix.filter(product => product.total_available > 0).length,
          cross_warehouse_products: matrix.filter(product => product.warehouse_count > 1).length,
        }
      };
    }),

  // POST /products/calculate-inventory-movements - Calculate inventory movements for orders
  calculateInventoryMovements: protectedProcedure
    .input(z.object({
      order: z.object({
        id: z.string().uuid(),
        order_type: z.enum(['delivery', 'refill', 'exchange', 'pickup']),
        exchange_empty_qty: z.number().min(0).default(0),
        order_lines: z.array(z.object({
          id: z.string().uuid(),
          product_id: z.string().uuid(),
          quantity: z.number().min(1),
          product: z.object({
            id: z.string().uuid(),
            name: z.string(),
          }),
        })),
      }),
    }))
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Calculating inventory movements for order:', input.order.id);
      
      const movements: Array<{
        product_id: string;
        variant_name: string;
        qty_full_change: number;
        qty_empty_change: number;
        movement_type: 'delivery' | 'pickup' | 'exchange';
        description: string;
      }> = [];
      
      if (!input.order.order_lines) return { movements };
      
      for (const line of input.order.order_lines) {
        if (!line.product) continue;
        
        const product = line.product;
        const quantity = line.quantity;
        
        switch (input.order.order_type) {
          case 'delivery':
            // Standard delivery: deduct full cylinders
            movements.push({
              product_id: product.id,
              variant_name: 'full',
              qty_full_change: -quantity,
              qty_empty_change: 0,
              movement_type: 'delivery',
              description: `Delivered ${quantity} full ${product.name}`,
            });
            break;
            
          case 'refill':
            // Refill: deduct full, add empty
            movements.push({
              product_id: product.id,
              variant_name: 'full',
              qty_full_change: -quantity,
              qty_empty_change: 0,
              movement_type: 'delivery',
              description: `Delivered ${quantity} full ${product.name}`,
            });
            movements.push({
              product_id: product.id,
              variant_name: 'empty',
              qty_full_change: 0,
              qty_empty_change: quantity, // Picked up empties
              movement_type: 'pickup',
              description: `Picked up ${quantity} empty ${product.name}`,
            });
            break;
            
          case 'exchange':
            // Exchange: deduct full, add empty
            movements.push({
              product_id: product.id,
              variant_name: 'full',
              qty_full_change: -quantity,
              qty_empty_change: 0,
              movement_type: 'delivery',
              description: `Exchanged ${quantity} full ${product.name}`,
            });
            movements.push({
              product_id: product.id,
              variant_name: 'empty',
              qty_full_change: 0,
              qty_empty_change: input.order.exchange_empty_qty,
              movement_type: 'exchange',
              description: `Collected ${input.order.exchange_empty_qty} empty ${product.name}`,
            });
            break;
            
          case 'pickup':
            // Pickup only: add empty cylinders
            movements.push({
              product_id: product.id,
              variant_name: 'empty',
              qty_full_change: 0,
              qty_empty_change: input.order.exchange_empty_qty,
              movement_type: 'pickup',
              description: `Picked up ${input.order.exchange_empty_qty} empty ${product.name}`,
            });
            break;
        }
      }
      
      return { movements };
    }),

  // POST /products/validate-order-type - Validate order type business rules
  validateOrderType: protectedProcedure
    .input(z.object({
      order: z.object({
        order_type: z.enum(['delivery', 'refill', 'exchange', 'pickup']),
        exchange_empty_qty: z.number().min(0).default(0),
        requires_pickup: z.boolean().default(false),
      }),
    }))
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Validating order type:', input.order.order_type);
      
      const errors: string[] = [];
      
      // Validate refill orders
      if (input.order.order_type === 'refill') {
        if (input.order.exchange_empty_qty <= 0) {
          errors.push('Refill orders must specify quantity of empty cylinders to exchange');
        }
      }
      
      // Validate exchange orders
      if (input.order.order_type === 'exchange') {
        if (!input.order.requires_pickup) {
          errors.push('Exchange orders must require pickup of empty cylinders');
        }
        if (input.order.exchange_empty_qty <= 0) {
          errors.push('Exchange orders must specify quantity of empty cylinders');
        }
      }
      
      // Validate pickup orders
      if (input.order.order_type === 'pickup') {
        if (input.order.exchange_empty_qty <= 0) {
          errors.push('Pickup orders must specify quantity of cylinders to collect');
        }
      }
      
      return {
        valid: errors.length === 0,
        errors,
      };
    }),

  // POST /products/calculate-exchange-quantity - Calculate exchange quantity for order types
  calculateExchangeQuantity: protectedProcedure
    .input(z.object({
      order: z.object({
        order_type: z.enum(['delivery', 'refill', 'exchange', 'pickup']),
        exchange_empty_qty: z.number().min(0).default(0),
      }),
    }))
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Calculating exchange quantity for order type:', input.order.order_type);
      
      let exchange_quantity = 0;
      
      if (input.order.order_type === 'refill' || input.order.order_type === 'exchange') {
        // For refill orders, exchange quantity equals delivery quantity
        exchange_quantity = input.order.exchange_empty_qty || 0;
      }
      
      return { exchange_quantity };
    }),

  // POST /products/should-require-pickup - Determine if order type requires pickup
  shouldRequirePickup: protectedProcedure
    .input(z.object({
      order_type: z.enum(['delivery', 'refill', 'exchange', 'pickup']),
    }))
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Checking pickup requirement for order type:', input.order_type);
      
      const requires_pickup = input.order_type === 'exchange' || input.order_type === 'pickup';
      
      return { requires_pickup };
    }),

  // GET /products/standard-cylinder-variants - Get standard cylinder variants
  getStandardCylinderVariants: protectedProcedure
    .query(async ({ ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Fetching standard cylinder variants');
      
      return {
        variants: [
          { name: 'full', description: 'Full cylinder ready for delivery' },
          { name: 'empty', description: 'Empty cylinder for exchange/pickup' },
        ]
      };
    }),

  // POST /products/generate-variant-sku - Generate SKU for product variant
  generateVariantSku: protectedProcedure
    .input(z.object({
      parent_sku: z.string().min(1),
      variant_name: z.string().min(1),
    }))
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Generating variant SKU for:', input.parent_sku, input.variant_name);
      
      const variant_sku = `${input.parent_sku}-${input.variant_name.toLowerCase()}`;
      
      return { variant_sku };
    }),

  // POST /products/create-variant-data - Create variant product data
  createVariantData: protectedProcedure
    .input(z.object({
      parent_product: z.object({
        id: z.string().uuid(),
        sku: z.string(),
        name: z.string(),
        status: ProductStatusEnum,
      }),
      variant_name: z.string().min(1),
      description: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Creating variant data for parent product:', input.parent_product.id);
      
      const variant_sku = `${input.parent_product.sku}-${input.variant_name.toLowerCase()}`;
      
      return {
        parent_product_id: input.parent_product.id,
        variant_name: input.variant_name,
        sku: variant_sku,
        name: `${input.parent_product.name} (${input.variant_name})`,
        description: input.description || `${input.variant_name} variant of ${input.parent_product.name}`,
        status: input.parent_product.status,
        barcode_uid: undefined,
      };
    }),
});

// Helper functions for products business logic

function calculateProductStockLevel(totalAvailable: number): 'out' | 'critical' | 'low' | 'normal' | 'high' {
  if (totalAvailable <= 0) return 'out';
  if (totalAvailable <= 5) return 'critical';
  if (totalAvailable <= 20) return 'low';
  if (totalAvailable <= 100) return 'normal';
  return 'high';
}

function getLastRestockedDate(inventoryData: any[]): string | null {
  if (!inventoryData || inventoryData.length === 0) return null;
  
  const dates = inventoryData
    .map(inv => inv.updated_at)
    .filter(date => date)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  
  return dates[0] || null;
}

function calculatePopularity(product: any): number {
  if (!product) return 0;
  
  // Mock calculation - in production, this would use sales data
  // Higher score = more popular
  let score = 5; // Base score
  
  // Products with variants tend to be more popular
  if (product.is_variant) score += 1;
  
  // Active products are more popular than end_of_sale
  if (product.status === 'active') score += 2;
  else if (product.status === 'end_of_sale') score += 1;
  
  // Certain types are more popular
  if (product.variant_type === 'refillable') score += 2;
  
  return Math.min(score, 10);
}

function calculateComplianceScore(product: any): number {
  if (!product) return 0;
  
  let score = 10; // Start with perfect score
  
  // Deduct points for missing data
  if (!product.sku) score -= 2;
  if (!product.description) score -= 1;
  if (!product.capacity_kg && product.unit_of_measure === 'cylinder') score -= 2;
  if (!product.tare_weight_kg && product.unit_of_measure === 'cylinder') score -= 1;
  if (!product.valve_type && product.variant_type === 'cylinder') score -= 1;
  
  // Deduct points for business rule violations
  if (product.requires_tag && !product.barcode_uid) score -= 3;
  
  return Math.max(score, 0);
}

function calculateProfitabilityScore(product: any): number {
  if (!product) return 0;
  
  // Mock calculation - in production, this would use cost and pricing data
  let score = 5; // Base score
  
  // Larger cylinders typically have better margins
  if (product.capacity_kg) {
    if (product.capacity_kg >= 50) score += 3;
    else if (product.capacity_kg >= 20) score += 2;
    else if (product.capacity_kg >= 10) score += 1;
  }
  
  // Refillable products have better long-term profitability
  if (product.variant_type === 'refillable') score += 2;
  
  // End of sale products might have clearance pricing
  if (product.status === 'end_of_sale') score -= 1;
  
  return Math.min(score, 10);
}

async function generateProductSummary(ctx: any, products: any[]): Promise<any> {
  const summary = {
    total_products: products.length,
    status_breakdown: {} as Record<string, number>,
    unit_breakdown: {} as Record<string, number>,
    variant_breakdown: {} as Record<string, number>,
    with_inventory: products.filter(p => p.inventory_summary?.is_available).length,
    low_stock: products.filter(p => ['low', 'critical'].includes(p.inventory_summary?.stock_level || '')).length,
    popular_products: products.filter(p => (p.popularity_score || 0) >= 7).length,
    compliance_issues: products.filter(p => (p.compliance_score || 0) < 8).length,
    avg_compliance_score: products.length > 0 ? products.reduce((sum, p) => sum + (p.compliance_score || 0), 0) / products.length : 0,
    avg_profitability_score: products.length > 0 ? products.reduce((sum, p) => sum + (p.profitability_score || 0), 0) / products.length : 0,
  };

  // Calculate breakdowns
  products.forEach(product => {
    if (product) {
      if (product.status) {
        summary.status_breakdown[product.status] = (summary.status_breakdown[product.status] || 0) + 1;
      }
      if (product.unit_of_measure) {
        summary.unit_breakdown[product.unit_of_measure] = (summary.unit_breakdown[product.unit_of_measure] || 0) + 1;
      }
      if (product.variant_type) {
        summary.variant_breakdown[product.variant_type] = (summary.variant_breakdown[product.variant_type] || 0) + 1;
      }
    }
  });

  return summary;
}

function buildAvailabilityMatrix(inventoryData: any[], includeReserved: boolean, minQuantity: number): any[] {
  const productMap = new Map();
  
  inventoryData.forEach(item => {
    const productId = item.product_id;
    const available = includeReserved ? item.qty_full : (item.qty_full - item.qty_reserved);
    
    if (!productMap.has(productId)) {
      productMap.set(productId, {
        product_id: productId,
        product: item.product,
        total_available: 0,
        warehouse_count: 0,
        warehouses: [],
      });
    }
    
    const productData = productMap.get(productId);
    
    if (available >= minQuantity) {
      productData.total_available += available;
      productData.warehouse_count++;
      productData.warehouses.push({
        warehouse_id: item.warehouse_id,
        warehouse: item.warehouse,
        qty_available: available,
        qty_reserved: item.qty_reserved,
        stock_level: calculateProductStockLevel(available),
      });
    }
  });
  
  return Array.from(productMap.values()).sort((a, b) => b.total_available - a.total_available);
}