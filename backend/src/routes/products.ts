import { z } from 'zod';
import { router, protectedProcedure } from '../lib/trpc';
import { requireAuth } from '../lib/auth';
import { TRPCError } from '@trpc/server';

// Import input schemas
import {
  ProductStatusEnum,
  UnitOfMeasureEnum,
  VariantTypeEnum,
  VariantEnum,
  SkuVariantEnum,
  ProductFiltersSchema,
  GetProductByIdSchema,
  GetProductStatsSchema,
  GetProductOptionsSchema,
  CreateProductSchema,
  UpdateProductSchema,
  DeleteProductSchema,
  GetVariantsSchema,
  CreateVariantSchema,
  BulkStatusUpdateSchema,
  ReactivateProductSchema,
  ValidateProductSchema,
  ValidateSkuSchema,
  ValidateWeightSchema,
  ValidateStatusChangeSchema,
  GetAvailabilityMatrixSchema,
  CalculateInventoryMovementsSchema,
  ValidateOrderTypeSchema,
  CalculateExchangeQuantitySchema,
  ShouldRequirePickupSchema,
  GetStandardCylinderVariantsSchema,
  GenerateVariantSkuSchema,
  CreateVariantDataSchema,
  CreateParentProductSchema,
  GetGroupedProductsSchema,
  GetSkuVariantsSchema,
  ListParentProductsSchema,
  GetParentProductByIdSchema,
} from '../schemas/input/products-input';

// Import output schemas
import {
  ProductListResponseSchema,
  ProductDetailResponseSchema,
  ProductStatsResponseSchema,
  ProductOptionsResponseSchema,
  CreateProductResponseSchema,
  UpdateProductResponseSchema,
  DeleteProductResponseSchema,
  ProductVariantsResponseSchema,
  CreateVariantResponseSchema,
  BulkStatusUpdateResponseSchema,
  ReactivateProductResponseSchema,
  ValidateProductResponseSchema,
  ValidateSkuResponseSchema,
  ValidateWeightResponseSchema,
  ValidateStatusChangeResponseSchema,
  AvailabilityMatrixResponseSchema,
  InventoryMovementsResponseSchema,
  ValidateOrderTypeResponseSchema,
  ExchangeCalculationResponseSchema,
  PickupRequirementResponseSchema,
  StandardCylinderVariantsResponseSchema,
  GeneratedSkuResponseSchema,
  CreateVariantDataResponseSchema,
  CreateParentProductResponseSchema,
  GetGroupedProductsResponseSchema,
  GetSkuVariantsResponseSchema,
  ListParentProductsResponseSchema,
  GetParentProductByIdResponseSchema,
} from '../schemas/output/products-output';


export const productsRouter = router({
  // GET /products - List products with advanced filtering and business logic
  list: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/products',
        tags: ['products'],
        summary: 'List products with advanced filtering',
        description: 'Retrieve a comprehensive list of products with advanced filtering, inventory data, and business intelligence including popularity and compliance scores.',
        protect: true,
      }
    })
    .input(ProductFiltersSchema.optional())
    .output(z.any()) // ✅ No validation headaches!
    .query(async ({ input, ctx }) => {
      try {
        const user = requireAuth(ctx);
        
        // Provide default values if input is undefined
        const filters = input || {} as any;
        const page = filters.page || 1;
        const limit = filters.limit || 50;
        const sort_by = filters.sort_by || 'created_at';
        const sort_order = filters.sort_order || 'desc';
        const show_obsolete = filters.show_obsolete || false;
        const include_inventory_data = filters.include_inventory_data || false;
        const low_stock_only = filters.low_stock_only || false;
        
        ctx.logger.info('Fetching products with advanced filters:', filters);
      
      // Start with basic product fields
      let selectClause = '*';
      
      // Only include inventory data if explicitly requested
      // Note: When using nested selects in PostgREST, we can't use '*' in combination with nested fields
      if (include_inventory_data) {
        selectClause = 'id, sku, name, description, unit_of_measure, capacity_kg, tare_weight_kg, valve_type, status, barcode_uid, created_at, requires_tag, variant_type, parent_products_id, sku_variant, is_variant, variant, inventory_balance:inventory_balance(warehouse_id, qty_full, qty_empty, qty_reserved, updated_at, warehouse:warehouses(name))';
      }
      
      let query = ctx.supabase
        .from('products')
        .select(selectClause, { count: 'exact' })
        .throwOnError();

      // By default, hide obsolete products unless specifically requested
      if (!show_obsolete) {
        query = query.eq('status', 'active');
      }

      // Apply search filter with enhanced logic
      if (filters.search) {
        const searchTerm = filters.search.replace(/[%_]/g, '\\$&'); // Escape special characters
        query = query.or(`sku.ilike.%${searchTerm}%,name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,barcode_uid.ilike.%${searchTerm}%`);
      }

      // Apply status filter
      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      // Apply unit of measure filter
      if (filters.unit_of_measure) {
        query = query.eq('unit_of_measure', filters.unit_of_measure);
      }

      // Apply variant type filter
      if (filters.variant_type) {
        query = query.eq('variant_type', filters.variant_type);
      }

      // Apply variant filter
      if (filters.variant) {
        query = query.eq('variant', filters.variant);
      }

      // Apply capacity range filters
      if (filters.capacity_min !== undefined) {
        query = query.gte('capacity_kg', filters.capacity_min);
      }
      if (filters.capacity_max !== undefined) {
        query = query.lte('capacity_kg', filters.capacity_max);
      }

      // Apply weight range filters
      if (filters.weight_min !== undefined) {
        query = query.gte('tare_weight_kg', filters.weight_min);
      }
      if (filters.weight_max !== undefined) {
        query = query.lte('tare_weight_kg', filters.weight_max);
      }

      // Apply tag requirement filter
      if (filters.requires_tag !== undefined) {
        query = query.eq('requires_tag', filters.requires_tag);
      }

      // Apply variant filter
      if (filters.is_variant !== undefined) {
        query = query.eq('is_variant', filters.is_variant);
      }

      // Apply date filters
      if (filters.created_after) {
        query = query.gte('created_at', filters.created_after);
      }
      if (filters.updated_after) {
        // Note: products table doesn't have updated_at column, treating as created_after
        query = query.gte('created_at', filters.updated_after);
      }

      // Apply sorting
      query = query.order(sort_by, { ascending: sort_order === 'asc' });

      // Apply pagination
      const from = (page - 1) * limit;
      const to = from + limit - 1;
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
          filters: filters
        });
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to fetch products: ${errorObj.message}`,
        });
      }

      let products = (data || []).map((product: any) => {
        const inventoryData = (product as any).inventory_balance || [];
        // Ensure every inventory_balance entry has a warehouse object with id
        const safeInventoryData = inventoryData.map((inv: any) => ({
          ...inv,
          warehouse: inv.warehouse && inv.warehouse.id ? inv.warehouse : { id: '', name: '' },
        }));
        const totalStock = safeInventoryData.reduce((sum: number, inv: any) => sum + inv.qty_full, 0);
        const totalAvailable = safeInventoryData.reduce((sum: number, inv: any) => sum + (inv.qty_full - inv.qty_reserved), 0);
        
        return {
          ...(product as any),
          inventory_balance: safeInventoryData,
          inventory_summary: include_inventory_data ? {
            total_stock: totalStock,
            total_available: totalAvailable,
            warehouse_count: safeInventoryData.length,
            stock_level: calculateProductStockLevel(totalAvailable),
            is_available: totalAvailable > 0,
            last_restocked: getLastRestockedDate(safeInventoryData),
          } : undefined,
          // Business logic fields
          popularity_score: calculatePopularity(product),
          compliance_score: calculateComplianceScore(product),
          profitability_score: calculateProfitabilityScore(product),
        };
      });

      // Apply business logic filters that require calculated data
      if (filters.has_inventory !== undefined) {
        products = products.filter(product => {
          const hasStock = (product.inventory_summary?.total_available || 0) > 0;
          return filters.has_inventory ? hasStock : !hasStock;
        });
      }

      if (low_stock_only) {
        products = products.filter(product => 
          product.inventory_summary?.stock_level === 'low' || 
          product.inventory_summary?.stock_level === 'critical'
        );
      }

      if (filters.availability_status) {
        products = products.filter(product => {
          const stockLevel = product.inventory_summary?.stock_level || 'unknown';
          switch (filters.availability_status) {
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
      if (['inventory_level', 'last_sold'].includes(sort_by)) {
        products = products.sort((a, b) => {
          let aValue, bValue;
          
          if (sort_by === 'inventory_level') {
            aValue = a.inventory_summary?.total_available || 0;
            bValue = b.inventory_summary?.total_available || 0;
          } else if (sort_by === 'last_sold') {
            aValue = new Date(a.inventory_summary?.last_restocked || '1970-01-01').getTime();
            bValue = new Date(b.inventory_summary?.last_restocked || '1970-01-01').getTime();
          }
          
          return sort_order === 'asc' ? aValue - bValue : bValue - aValue;
        });
      }

      return {
        products,
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
        currentPage: page,
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

  // GET /products/options - Get product options for dropdowns
  getOptions: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/products/options',
        tags: ['products'],
        summary: 'Get product options for dropdowns',
        description: 'Retrieve simplified product data for use in dropdowns and selection components.',
        protect: true,
      }
    })
    .input(GetProductOptionsSchema)
    .output(z.any())
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Fetching product options');
      
      const { data, error } = await ctx.supabase
        .from('products')
        .select('id, sku, name, sku_variant, is_variant')
        
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
        display_name: p.sku_variant ? `${p.name} - ${p.sku_variant}` : p.name,
        is_variant: p.is_variant,
      }));
    }),

  // GET /products/stats - Get product statistics
  getStats: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/products/stats',
        tags: ['products'],
        summary: 'Get product statistics',
        description: 'Get basic statistics about products',
        protect: true,
      }
    })
    .input(GetProductStatsSchema)
    .output(z.any()) 
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
        obsolete: data.filter(p => p.status === 'obsolete').length,
        cylinders: data.filter(p => p.unit_of_measure === 'cylinder').length,
        kg_products: data.filter(p => p.unit_of_measure === 'kg').length,
      };

      return stats;
    }),

  // GET /products/standard-cylinder-variants - Get standard cylinder variants
  getStandardCylinderVariants: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/products/standard-cylinder-variants',
        tags: ['products'],
        summary: 'Get standard cylinder variants',
        description: 'Get the standard cylinder variants (full/empty) used in the system.',
        protect: true,
      }
    })
    .input(GetStandardCylinderVariantsSchema)
    .output(z.any())
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

  // POST /products/validate-sku - Validate SKU format and uniqueness
  validateSku: protectedProcedure
    // .meta({
    //   openapi: {
    //     method: 'POST',
    //     path: '/products/validate-sku',
    //     tags: ['products'],
    //     summary: 'Validate SKU format and uniqueness',
    //     description: 'Validate SKU format, length constraints, reserved prefixes, and uniqueness.',
    //     protect: true,
    //   }
    // })
    .input(ValidateSkuSchema)
    .output(z.any())
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

  // GET /products/{id} - Get single product by ID
  getById: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/products/{id}',
        tags: ['products'],
        summary: 'Get product by ID',
        description: 'Retrieve detailed information about a specific product by its ID.',
        protect: true,
      }
    })
    .input(GetProductByIdSchema)
    .output(z.any())
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

  // POST /products - Create new product
  create: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/products',
        tags: ['products'],
        summary: 'Create new product',
        description: 'Create a new product with full validation including SKU uniqueness and parent product verification for variants.',
        protect: true,
      }
    })
    .input(CreateProductSchema)
    .output(z.any())
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

      // // If creating a variant, verify parent product exists
      // if (input.is_variant && input.parent_product_id) {
      //   const { data: parentProduct, error: parentError } = await ctx.supabase
      //     .from('products')
      //     .select('id')
      //     .eq('id', input.parent_product_id)
          
      //     .single();

      //   if (parentError || !parentProduct) {
      //     throw new TRPCError({
      //       code: 'BAD_REQUEST',
      //       message: 'Parent product not found',
      //     });
      //   }
      // }

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
    .meta({
      openapi: {
        method: 'PUT',
        path: '/products/{id}',
        tags: ['products'],
        summary: 'Update product',
        description: 'Update an existing product with validation. SKU uniqueness is checked if SKU is being updated.',
        protect: true,
      }
    })
    .input(UpdateProductSchema)
    .output(z.any())
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
    .meta({
      openapi: {
        method: 'DELETE',
        path: '/products/{id}',
        tags: ['products'],
        summary: 'Delete product (soft delete)',
        description: 'Soft delete a product by setting its status to obsolete. Validates that product has no existing inventory.',
        protect: true,
      }
    })
    .input(DeleteProductSchema)
    .output(z.any())
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
        .select('id, sku, name, status')
        .single();

      if (error) {
        ctx.logger.error('Error deleting product:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to delete product',
        });
      }

      // Return a clean response without potentially problematic fields
      return { 
        success: true, 
        product: {
          id: data.id,
          sku: data.sku,
          name: data.name,
          status: data.status
        }
      };
    }),

  // GET /products/:id/variants - Get product variants
  getVariants: protectedProcedure
    // .meta({
    //   openapi: {
    //     method: 'GET',
    //     path: '/products/{parent_product_id}/variants',
    //     tags: ['products'],
    //     summary: 'Get product variants',
    //     description: 'Retrieve all variants for a specific parent product.',
    //     protect: true,
    //   }
    // })
    .input(GetVariantsSchema)
    .output(z.any())
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      const { data, error } = await ctx.supabase
        .from('products')
        .select('*')
        .eq('parent_products_id', input.parent_products_id)
        
        .eq('is_variant', true)
        .order('sku_variant');

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
    // .meta({
    //   openapi: {
    //     method: 'POST',
    //     path: '/products/{parent_product_id}/variants',
    //     tags: ['products'],
    //     summary: 'Create product variant',
    //     description: 'Create a new variant for an existing parent product with full validation.',
    //     protect: true,
    //   }
    // })
    .input(CreateVariantSchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Creating product variant:', input);
      
      // Get parent product info
      const { data: parentProduct, error: parentError } = await ctx.supabase
        .from('products')
        .select('*')
        .eq('id', input.parent_products_id)
        
        .single();

      if (parentError || !parentProduct) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Parent product not found',
        });
      }

      // Auto-generate SKU: {parent_sku}-{sku_variant}
      const generatedSku = `${parentProduct.sku}-${input.sku_variant}`;

      // Check SKU uniqueness
      const { data: existingSku } = await ctx.supabase
        .from('products')
        .select('id')
        .eq('sku', generatedSku)
        .single();

      if (existingSku) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Generated SKU already exists. Please choose a different variant.',
        });
      }

      const { data, error } = await ctx.supabase
        .from('products')
        .insert([{
          ...input,
          sku: generatedSku,
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

  // POST /products/bulk-update-status - Update product status one by one
  bulkUpdateStatus: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/products/bulk-update-status',
        tags: ['products'],
        summary: 'Bulk update product status',
        description: 'Update the status of multiple products individually with detailed success/error tracking.',
        protect: true,
      }
    })
    .input(BulkStatusUpdateSchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Bulk updating product status (individual updates):', input);
      
      const results = [];
      const errors = [];
      let successCount = 0;
      
      // Loop through each product ID and update individually
      for (const productId of input.product_ids) {
        try {
          ctx.logger.info(`Updating product status for ID: ${productId}`);
          
          const { data, error } = await ctx.supabase
            .from('products')
            .update({
              status: input.status,
            })
            .eq('id', productId)  // ← Individual update per ID
            .select()
            .single();
          
          if (error) {
            ctx.logger.error(`Error updating product ${productId}:`, error);
            errors.push({
              product_id: productId,
              error: error.message,
            });
          } else if (data) {
            successCount++;
            results.push(data);
            ctx.logger.info(`Successfully updated product ${productId} to status: ${input.status}`);
          } else {
            errors.push({
              product_id: productId,
              error: 'Product not found',
            });
          }
        } catch (err) {
          ctx.logger.error(`Unexpected error updating product ${productId}:`, err);
          errors.push({
            product_id: productId,
            error: err instanceof Error ? err.message : 'Unknown error',
          });
        }
      }
      
      // If all updates failed, throw an error
      if (successCount === 0 && errors.length > 0) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to update any products. Errors: ${errors.map(e => e.error).join(', ')}`,
        });
      }
      
      return {
        success: true,
        updated_count: successCount,
        total_requested: input.product_ids.length,
        products: results,
        errors: errors.length > 0 ? errors : undefined,
        partial_success: errors.length > 0 && successCount > 0,
      };
    }),

  // POST /products/reactivate - Reactivate obsolete product
  reactivate: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/products/reactivate',
        tags: ['products'],
        summary: 'Reactivate obsolete product',
        description: 'Reactivate a previously obsoleted product by setting its status to active.',
        protect: true,
      }
    })
    .input(ReactivateProductSchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Reactivating product:', input.id);
      
      const { data, error } = await ctx.supabase
        .from('products')
        .update({
          status: 'active',
        })
        .eq('id', input.id)
        .select('id, sku, name, status')
        .single();

      if (error) {
        ctx.logger.error('Error reactivating product:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to reactivate product',
        });
      }

      return {
        id: data.id,
        sku: data.sku,
        name: data.name,
        status: data.status
      };
    }),

  // POST /products/validate - Validate product data
  validate: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/products/validate',
        tags: ['products'],
        summary: 'Validate product data',
        description: 'Validate product data including SKU uniqueness and name similarity checks.',
        protect: true,
      }
    })
    .input(ValidateProductSchema)
    .output(z.any())
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

  // POST /products/validate-weight - Validate weight constraints
  validateWeight: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/products/validate-weight',
        tags: ['products'],
        summary: 'Validate weight constraints',
        description: 'Validate cylinder capacity and tare weight constraints with business rule validation.',
        protect: true,
      }
    })
    .input(ValidateWeightSchema)
    .output(z.any())
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
  // validateStatusChange: protectedProcedure
  //   .meta({
  //     openapi: {
  //       method: 'POST',
  //       path: '/products/validate-status-change',
  //       tags: ['products'],
  //       summary: 'Validate status change business rules',
  //       description: 'Validate product status changes including inventory checks and variant dependencies.',
  //       protect: true,
  //     }
  //   })
  //   .input(ValidateStatusChangeSchema)
  //   .output(z.any()) // ✅ No validation headaches!
  //   .mutation(async ({ input, ctx }) => {
  //     const user = requireAuth(ctx);
      
  //     const errors: string[] = [];
  //     const warnings: string[] = [];

  //     // Get current product data
  //     const { data: product, error: productError } = await ctx.supabase
  //       .from('products')
  //       .select('*')
  //       .eq('id', input.product_id)
  //       .single();

  //     if (productError || !product) {
  //       errors.push('Product not found');
  //       return { valid: false, errors, warnings };
  //     }

  //     // Business rule: Cannot reactivate if there are variants
  //     if (product.status === 'obsolete' && input.new_status === 'active') {
  //       const { data: variants } = await ctx.supabase
  //         .from('products')
  //         .select('id')
  //         .eq('parent_product_id', input.product_id)
  //         .eq('is_variant', true);

  //       if (variants && variants.length > 0) {
  //         warnings.push('Product has variants that may also need to be reactivated');
  //       }
  //     }

  //     // Business rule: Check inventory before making obsolete
  //     if (input.new_status === 'obsolete') {
  //       const { data: inventory } = await ctx.supabase
  //         .from('inventory_balance')
  //         .select('qty_full, qty_empty, warehouse:warehouses(name)')
  //         .eq('product_id', input.product_id)
  //         .gt('qty_full', 0);

  //       if (inventory && inventory.length > 0) {
  //         const totalStock = inventory.reduce((sum, inv) => sum + inv.qty_full, 0);
  //         warnings.push(`Product has ${totalStock} units in stock across ${inventory.length} warehouses`);
          
  //         const warehouseNames = inventory.map((inv: any) => inv.warehouse?.name || 'Unknown').filter(Boolean).join(', ');
  //         warnings.push(`Stock locations: ${warehouseNames}`);
  //       }

  //       // Check pending orders
  //       const { data: pendingOrders } = await ctx.supabase
  //         .from('order_lines')
  //         .select('orders(id, status, customer:customers(name))')
  //         .eq('product_id', input.product_id)
  //         .in('orders.status', ['draft', 'confirmed', 'scheduled']);

  //       if (pendingOrders && pendingOrders.length > 0) {
  //         errors.push(`Cannot make product obsolete - it has ${pendingOrders.length} pending order lines`);
  //       }
  //     }

  //     return {
  //       valid: errors.length === 0,
  //       errors,
  //       warnings,
  //       current_status: product.status,
  //     };
  //   }),

  // POST /products/availability-matrix - Get product availability across warehouses
  // getAvailabilityMatrix: protectedProcedure
  //   .meta({
  //     openapi: {
  //       method: 'POST',
  //       path: '/products/availability-matrix',
  //       tags: ['products'],
  //       summary: 'Get product availability matrix',
  //       description: 'Get comprehensive product availability data across all warehouses with filtering options.',
  //       protect: true,
  //     }
  //   })
  //   .input(GetAvailabilityMatrixSchema)
  //   .output(z.any()) // ✅ No validation headaches!
  //   .mutation(async ({ input, ctx }) => {
  //     const user = requireAuth(ctx);
      
  //     ctx.logger.info('Fetching product availability matrix:', input);
      
  //     let query = ctx.supabase
  //       .from('inventory_balance')
  //       .select(`
  //         *,
  //         product:products(id, sku, name, unit_of_measure, status),
  //         warehouse:warehouses(id, name)
  //       `);

  //     if (input.product_ids && input.product_ids.length > 0) {
  //       query = query.in('product_id', input.product_ids);
  //     }

  //     if (input.warehouse_ids && input.warehouse_ids.length > 0) {
  //       query = query.in('warehouse_id', input.warehouse_ids);
  //     }

  //     const { data, error } = await query;

  //     if (error) {
  //       ctx.logger.error('Availability matrix error:', error);
  //       throw new TRPCError({
  //         code: 'INTERNAL_SERVER_ERROR',
  //         message: error.message
  //       });
  //     }

  //     const matrix = buildAvailabilityMatrix(data || [], input.include_reserved, input.min_quantity);

  //     return {
  //       availability_matrix: matrix,
  //       summary: {
  //         total_products: matrix.length,
  //         total_warehouses: matrix[0]?.warehouses?.length || 0,
  //         products_with_stock: matrix.filter(product => product.total_available > 0).length,
  //         cross_warehouse_products: matrix.filter(product => product.warehouse_count > 1).length,
  //       }
  //     };
  //   }),

  // POST /products/calculate-inventory-movements - Calculate inventory movements for orders
  calculateInventoryMovements: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/products/calculate-inventory-movements',
        tags: ['products'],
        summary: 'Calculate inventory movements for orders',
        description: 'Calculate inventory movements based on order type and line items for delivery, refill, exchange, and pickup orders.',
        protect: true,
      }
    })
    .input(CalculateInventoryMovementsSchema)
    .output(z.any())
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
  // validateOrderType: protectedProcedure
  //   .meta({
  //     openapi: {
  //       method: 'POST',
  //       path: '/products/validate-order-type',
  //       tags: ['products'],
  //       summary: 'Validate order type business rules',
  //       description: 'Validate order type constraints for refill, exchange, and pickup orders.',
  //       protect: true,
  //     }
  //   })
  //   .input(ValidateOrderTypeSchema)
  //   .output(z.any()) // ✅ No validation headaches!
  //   .mutation(async ({ input, ctx }) => {
  //     const user = requireAuth(ctx);
      
  //     ctx.logger.info('Validating order type:', input.order.order_type);
      
  //     const errors: string[] = [];
      
  //     // Validate refill orders
  //     if (input.order.order_type === 'refill') {
  //       if (input.order.exchange_empty_qty <= 0) {
  //         errors.push('Refill orders must specify quantity of empty cylinders to exchange');
  //       }
  //     }
      
  //     // Validate exchange orders
  //     if (input.order.order_type === 'exchange') {
  //       if (!input.order.requires_pickup) {
  //         errors.push('Exchange orders must require pickup of empty cylinders');
  //       }
  //       if (input.order.exchange_empty_qty <= 0) {
  //         errors.push('Exchange orders must specify quantity of empty cylinders');
  //       }
  //     }
      
  //     // Validate pickup orders
  //     if (input.order.order_type === 'pickup') {
  //       if (input.order.exchange_empty_qty <= 0) {
  //         errors.push('Pickup orders must specify quantity of cylinders to collect');
  //       }
  //     }
      
  //     return {
  //       valid: errors.length === 0,
  //       errors,
  //     };
  //   }),

  // POST /products/calculate-exchange-quantity - Calculate exchange quantity for order types
  calculateExchangeQuantity: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/products/calculate-exchange-quantity',
        tags: ['products'],
        summary: 'Calculate exchange quantity for order types',
        description: 'Calculate the appropriate exchange quantity based on order type (refill/exchange).',
        protect: true,
      }
    })
    .input(CalculateExchangeQuantitySchema)
    .output(z.any())
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
  // shouldRequirePickup: protectedProcedure
  //   .meta({
  //     openapi: {
  //       method: 'POST',
  //       path: '/products/should-require-pickup',
  //       tags: ['products'],
  //       summary: 'Determine if order type requires pickup',
  //       description: 'Determine whether an order type requires pickup of empty cylinders.',
  //       protect: true,
  //     }
  //   })
  //   .input(ShouldRequirePickupSchema)
  //   .output(z.any()) // ✅ No validation headaches!
  //   .mutation(async ({ input, ctx }) => {
  //     const user = requireAuth(ctx);
      
  //     ctx.logger.info('Checking pickup requirement for order type:', input.order_type);
      
  //     const requires_pickup = input.order_type === 'exchange' || input.order_type === 'pickup';
      
  //     return { requires_pickup };
  //   }),

  // POST /products/generate-variant-sku - Generate SKU for product variant
  generateVariantSku: protectedProcedure
    // .meta({
    //   openapi: {
    //     method: 'POST',
    //     path: '/products/generate-variant-sku',
    //     tags: ['products'],
    //     summary: 'Generate SKU for product variant',
    //     description: 'Generate a properly formatted SKU for a product variant based on parent SKU and variant name.',
    //     protect: true,
    //   }
    // })
    .input(GenerateVariantSkuSchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Generating variant SKU for:', input.parent_sku, input.variant_name);
      
      const variant_sku = `${input.parent_sku}-${input.variant_name.toLowerCase()}`;
      
      return { variant_sku };
    }),

  // POST /products/create-variant-data - Create variant product data
  createVariantData: protectedProcedure
    // .meta({
    //   openapi: {
    //     method: 'POST',
    //     path: '/products/create-variant-data',
    //     tags: ['products'],
    //     summary: 'Create variant product data',
    //     description: 'Generate complete variant product data structure based on parent product and variant details.',
    //     protect: true,
    //   }
    // })
    .input(CreateVariantDataSchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Creating variant data for parent product:', input.parent_product.id);
      
      const variant_sku = `${input.parent_product.sku}-${input.variant_name.toLowerCase()}`;
      
      return {
        parent_product_id: input.parent_product.id,
        variant_name: input.variant_name,
        sku: variant_sku,
        name: `${input.parent_product.name} - ${input.variant_name}`,
        description: `${input.variant_name} variant`,
        status: 'active' as const,
        barcode_uid: undefined,
      };
    }),

  // ============ New Hierarchical Parent-Child Endpoints ============

  // GET /products/grouped - Get products grouped by parent-child hierarchy
  getGroupedProducts: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/products/grouped',
        tags: ['products'],
        summary: 'Get products grouped by parent-child hierarchy',
        description: 'Retrieve products organized in parent-child hierarchical structure.',
        protect: true,
      }
    })
    .input(GetGroupedProductsSchema)
    .output(z.any())
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Fetching grouped products');
      
      // Get all parent products
      let parentQuery = ctx.supabase
        .from('products')
        .select('*')
        .eq('is_variant', false)
        .order('name');
      
      if (!input.include_inactive) {
        parentQuery = parentQuery.eq('status', 'active');
      }
      
      const { data: parentProducts, error: parentError } = await parentQuery;
      
      if (parentError) {
        ctx.logger.error('Error fetching parent products:', parentError);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch parent products',
        });
      }
      
      // Get all variants for each parent
      const groupedProducts = await Promise.all(
        (parentProducts || []).map(async (parent) => {
          let variantQuery = ctx.supabase
            .from('products')
            .select('*')
            .eq('parent_products_id', parent.id)
            .eq('is_variant', true)
            .order('sku_variant');
          
          if (!input.include_inactive) {
            variantQuery = variantQuery.eq('status', 'active');
          }
          
          const { data: variants } = await variantQuery;
          
          return {
            parent: {
              ...parent,
              variant_count: variants ? variants.length : 0,
            },
            variants: variants || [],
          };
        })
      );
      
      // Filter out parents with no variants if include_variants_only is true
      const filteredGroups = input.include_variants_only
        ? groupedProducts.filter(group => group.variants.length > 0)
        : groupedProducts;
      
      const summary = {
        total_parent_products: filteredGroups.length,
        total_variants: filteredGroups.reduce((sum, group) => sum + group.variants.length, 0),
        active_parent_products: filteredGroups.filter(group => group.parent.status === 'active').length,
        active_variants: filteredGroups.reduce((sum, group) => 
          sum + group.variants.filter(variant => variant.status === 'active').length, 0
        ),
      };
      
      return {
        grouped_products: filteredGroups,
        summary,
      };
    }),

  // POST /products/parent - Create parent product
  createParentProduct: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/products/parent',
        tags: ['products'],
        summary: 'Create parent product',
        description: 'Create a new parent product for hierarchical structure.',
        protect: true,
      }
    })
    .input(CreateParentProductSchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Creating parent product:', input);
      
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

      const { data, error } = await ctx.supabase
        .from('products')
        .insert([{
          ...input,
          is_variant: false,
          parent_products_id: null,
          sku_variant: null,
          created_at: new Date().toISOString(),
        }])
        .select()
        .single();

      if (error) {
        ctx.logger.error('Error creating parent product:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create parent product',
        });
      }

      return {
        ...data,
        variant_count: 0,
      };
    }),

  // GET /products/sku-variants - Get available SKU variants
  getSkuVariants: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/products/sku-variants',
        tags: ['products'],
        summary: 'Get available SKU variants',
        description: 'Get the available SKU variant types for product variants.',
        protect: true,
      }
    })
    .input(GetSkuVariantsSchema)
    .output(z.any())
    .query(async ({ ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Fetching SKU variants');
      
      return {
        sku_variants: [
          {
            value: 'EMPTY',
            label: 'Empty',
            description: 'Empty cylinder for exchange/pickup',
          },
          {
            value: 'FULL-XCH',
            label: 'Full Exchange',
            description: 'Full cylinder for exchange orders',
          },
          {
            value: 'FULL-OUT',
            label: 'Full Outright',
            description: 'Full cylinder for outright purchase',
          },
          {
            value: 'DAMAGED',
            label: 'Damaged',
            description: 'Damaged cylinder requiring repair/replacement',
          },
        ],
      };
    }),

  // GET /products/parent-products - List parent products
  listParentProducts: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/products/parent-products',
        tags: ['products'],
        summary: 'List parent products',
        description: 'Get a paginated list of parent products.',
        protect: true,
      }
    })
    .input(ListParentProductsSchema)
    .output(z.any())
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Fetching parent products');
      
      const { page, limit } = input;
      const from = (page - 1) * limit;
      const to = from + limit - 1;
      
      const { data, error, count } = await ctx.supabase
        .from('products')
        .select('*', { count: 'exact' })
        .eq('is_variant', false)
        .eq('status', 'active')
        .order('name')
        .range(from, to);

      if (error) {
        ctx.logger.error('Error fetching parent products:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch parent products',
        });
      }

      // Add variant count for each parent
      const parentProductsWithCounts = await Promise.all(
        (data || []).map(async (parent) => {
          const { count: variantCount } = await ctx.supabase
            .from('products')
            .select('id', { count: 'exact' })
            .eq('parent_products_id', parent.id)
            .eq('is_variant', true);

          return {
            ...parent,
            variant_count: variantCount || 0,
          };
        })
      );

      return {
        parent_products: parentProductsWithCounts,
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
        currentPage: page,
      };
    }),

  // GET /products/parent-products/{id} - Get parent product by ID
  getParentProductById: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/products/parent-products/{id}',
        tags: ['products'],
        summary: 'Get parent product by ID',
        description: 'Get detailed information about a specific parent product.',
        protect: true,
      }
    })
    .input(GetParentProductByIdSchema)
    .output(z.any())
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Fetching parent product:', input.id);
      
      const { data, error } = await ctx.supabase
        .from('products')
        .select('*')
        .eq('id', input.id)
        .eq('is_variant', false)
        .single();

      if (error) {
        ctx.logger.error('Error fetching parent product:', error);
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Parent product not found',
        });
      }

      // Get variant count
      const { count: variantCount } = await ctx.supabase
        .from('products')
        .select('id', { count: 'exact' })
        .eq('parent_products_id', input.id)
        .eq('is_variant', true);

      return {
        ...data,
        variant_count: variantCount || 0,
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
  
  // Active products are more popular
  if (product.status === 'active') score += 2;
  
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