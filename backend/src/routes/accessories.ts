import { z } from 'zod';
import { router, protectedProcedure } from '../lib/trpc';
import { requireAuth } from '../lib/auth';
import { TRPCError } from '@trpc/server';

// Import input schemas
import {
  AccessoryFiltersSchema,
  GetAccessoryByIdSchema,
  GetAccessoryStatsSchema,
  GetAccessoryOptionsSchema,
  CreateAccessorySchema,
  UpdateAccessorySchema,
  DeleteAccessorySchema,
  CreateAccessoryCategorySchema,
  UpdateAccessoryCategorySchema,
  DeleteAccessoryCategorySchema,
  BulkAccessoryStatusUpdateSchema,
  ValidateAccessorySchema,
  ValidateAccessorySkuSchema,
  CreateItemSchema,
  GetItemsSchema,
} from '../schemas/input/accessories-input';

// Import output schemas
import {
  GetAccessoryResponseSchema,
  GetAccessoriesResponseSchema,
  GetAccessoryCategoriesResponseSchema,
  GetAccessoryStatsResponseSchema,
  GetAccessoryOptionsResponseSchema,
  ValidateAccessoryResponseSchema,
  ValidateAccessorySkuResponseSchema,
  BulkAccessoryStatusUpdateResponseSchema,
  CreateAccessoryResponseSchema,
  UpdateAccessoryResponseSchema,
  DeleteAccessoryResponseSchema,
  CreateAccessoryCategoryResponseSchema,
  UpdateAccessoryCategoryResponseSchema,
  DeleteAccessoryCategoryResponseSchema,
  GetUnifiedItemsResponseSchema,
} from '../schemas/output/accessories-output';

export const accessoriesRouter = router({
  // GET /accessories - List accessories with filtering
  list: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/accessories',
        tags: ['accessories'],
        summary: 'List accessories with filtering',
        description: 'Retrieve a list of accessories with filtering and pagination.',
        protect: true,
      }
    })
    .input(AccessoryFiltersSchema.optional())
    .output(z.any())
    .query(async ({ input, ctx }) => {
      try {
        const user = requireAuth(ctx);
        
        const filters = input || {};
        const page = (filters as any).page || 1;
        const limit = (filters as any).limit || 50;
        const sort_by = (filters as any).sort_by || 'created_at';
        const sort_order = (filters as any).sort_order || 'desc';
        const show_obsolete = (filters as any).show_obsolete || false;
        
        ctx.logger.info('Fetching accessories with filters:', filters);
      
        let query = ctx.supabase
          .from('accessories')
          .select('*, category:accessory_categories(*)', { count: 'exact' })
          .throwOnError();

        // By default, hide obsolete accessories unless specifically requested
        if (!show_obsolete) {
          query = query.eq('active', true);
        }

        // Apply search filter
        if ((filters as any).search) {
          const searchTerm = (filters as any).search.replace(/[%_]/g, '\\$&');
          query = query.or(`sku.ilike.%${searchTerm}%,name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`);
        }

        // Apply status filter
        if ((filters as any).status) {
          query = query.eq('active', (filters as any).status === 'active');
        }

        // Apply category filter
        if ((filters as any).category_id) {
          query = query.eq('category_id', (filters as any).category_id);
        }

        // Apply VAT code filter
        if ((filters as any).vat_code) {
          query = query.eq('vat_code', (filters as any).vat_code);
        }

        // Apply serialized filter
        if ((filters as any).is_serialized !== undefined) {
          query = query.eq('is_serialized', (filters as any).is_serialized);
        }

        // Apply saleable filter
        if ((filters as any).saleable !== undefined) {
          query = query.eq('saleable', (filters as any).saleable);
        }

        // Apply price range filters
        if ((filters as any).price_min !== undefined) {
          query = query.gte('price', (filters as any).price_min);
        }
        if ((filters as any).price_max !== undefined) {
          query = query.lte('price', (filters as any).price_max);
        }

        // Apply date filters
        if ((filters as any).created_after) {
          query = query.gte('created_at', (filters as any).created_after);
        }
        if ((filters as any).updated_after) {
          query = query.gte('updated_at', (filters as any).updated_after);
        }

        // Apply sorting
        query = query.order(sort_by, { ascending: sort_order === 'asc' });

        // Apply pagination
        const from = (page - 1) * limit;
        const to = from + limit - 1;
        query = query.range(from, to);

        const { data, error, count } = await query;

        if (error) {
          ctx.logger.error('Error fetching accessories:', error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to fetch accessories',
          });
        }

        const totalCount = count || 0;
        const totalPages = Math.ceil(totalCount / limit);

        return {
          accessories: data || [],
          totalCount,
          page,
          limit,
          totalPages,
        };
      } catch (error) {
        ctx.logger.error('Error in accessories list query:', error);
        throw error;
      }
    }),

  // GET /accessories/{id} - Get accessory by ID
  getById: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/accessories/{id}',
        tags: ['accessories'],
        summary: 'Get accessory by ID',
        description: 'Retrieve a specific accessory by its ID.',
        protect: true,
      }
    })
    .input(GetAccessoryByIdSchema)
    .output(z.any())
    .query(async ({ input, ctx }) => {
      try {
        const user = requireAuth(ctx);
        const { id } = input;

        const { data, error } = await ctx.supabase
          .from('accessories')
          .select('*, category:accessory_categories(*)')
          .eq('id', id)
          .single();

        if (error) {
          ctx.logger.error('Error fetching accessory:', error);
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Accessory not found',
          });
        }

        return {
          accessory: data,
        };
      } catch (error) {
        ctx.logger.error('Error in accessory getById query:', error);
        throw error;
      }
    }),

  // GET /accessories/stats - Get accessory statistics
  getStats: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/accessories/stats',
        tags: ['accessories'],
        summary: 'Get accessory statistics',
        description: 'Retrieve statistics about accessories.',
        protect: true,
      }
    })
    .input(z.object({}).optional())
    .output(z.any())
    .query(async ({ ctx }) => {
      try {
        const user = requireAuth(ctx);

        const [
          { count: total },
          { count: active },
          { count: obsolete },
          { count: saleable },
          { count: serialized },
          { count: categories },
        ] = await Promise.all([
          ctx.supabase.from('accessories').select('*', { count: 'exact', head: true }),
          ctx.supabase.from('accessories').select('*', { count: 'exact', head: true }).eq('active', true),
          ctx.supabase.from('accessories').select('*', { count: 'exact', head: true }).eq('active', false),
          ctx.supabase.from('accessories').select('*', { count: 'exact', head: true }).eq('saleable', true),
          ctx.supabase.from('accessories').select('*', { count: 'exact', head: true }).eq('is_serialized', true),
          ctx.supabase.from('accessory_categories').select('*', { count: 'exact', head: true }),
        ]);

        return {
          total: total || 0,
          active: active || 0,
          obsolete: obsolete || 0,
          saleable: saleable || 0,
          serialized: serialized || 0,
          categories: categories || 0,
        };
      } catch (error) {
        ctx.logger.error('Error in accessories stats query:', error);
        throw error;
      }
    }),

  // GET /accessories/options - Get accessory options for dropdowns
  getOptions: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/accessories/options',
        tags: ['accessories'],
        summary: 'Get accessory options',
        description: 'Retrieve accessory options for dropdowns and selections.',
        protect: true,
      }
    })
    .input(GetAccessoryOptionsSchema)
    .output(z.any())
    .query(async ({ input, ctx }) => {
      try {
        const user = requireAuth(ctx);
        const { status, category_id, saleable_only = true } = input;

        let query = ctx.supabase
          .from('accessories')
          .select('id, name, sku, price, category:accessory_categories(id, name)');

        // Apply status filter
        if (status) {
          const statusArray = Array.isArray(status) ? status : [status];
          const activeCondition = statusArray.includes('active');
          const obsoleteCondition = statusArray.includes('obsolete');
          
          if (activeCondition && obsoleteCondition) {
            // No filter needed - show both
          } else if (activeCondition) {
            query = query.eq('active', true);
          } else if (obsoleteCondition) {
            query = query.eq('active', false);
          }
        }

        // Apply category filter
        if (category_id) {
          query = query.eq('category_id', category_id);
        }

        // Apply saleable filter
        if (saleable_only) {
          query = query.eq('saleable', true);
        }

        const { data, error } = await query.order('name');

        if (error) {
          ctx.logger.error('Error fetching accessory options:', error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to fetch accessory options',
          });
        }

        return {
          accessories: (data || []).map(item => ({
            id: item.id,
            name: item.name,
            sku: item.sku,
            price: item.price,
            category: item.category && Array.isArray(item.category) && item.category.length > 0 ? {
              id: item.category[0].id,
              name: item.category[0].name,
            } : null,
          })),
        };
      } catch (error) {
        ctx.logger.error('Error in accessories options query:', error);
        throw error;
      }
    }),

  // POST /accessories - Create new accessory
  create: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/accessories',
        tags: ['accessories'],
        summary: 'Create new accessory',
        description: 'Create a new accessory item.',
        protect: true,
      }
    })
    .input(CreateAccessorySchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      try {
        const user = requireAuth(ctx);
        const {
          name,
          sku,
          category_id,
          price,
          vat_code,
          deposit_amount,
          is_serialized,
          saleable,
          active,
          description,
        } = input;

        const { data, error } = await ctx.supabase
          .from('accessories')
          .insert({
            name,
            sku: sku.toUpperCase(),
            category_id,
            price,
            vat_code,
            deposit_amount,
            is_serialized,
            saleable,
            active,
            description,
          })
          .select()
          .single();

        if (error) {
          ctx.logger.error('Error creating accessory:', error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to create accessory',
          });
        }

        return {
          accessory: data,
          message: 'Accessory created successfully',
        };
      } catch (error) {
        ctx.logger.error('Error in accessories create mutation:', error);
        throw error;
      }
    }),

  // PUT /accessories/{id} - Update accessory
  update: protectedProcedure
    .meta({
      openapi: {
        method: 'PUT',
        path: '/accessories/{id}',
        tags: ['accessories'],
        summary: 'Update accessory',
        description: 'Update an existing accessory item.',
        protect: true,
      }
    })
    .input(UpdateAccessorySchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      try {
        const user = requireAuth(ctx);
        const {
          id,
          name,
          sku,
          category_id,
          price,
          vat_code,
          deposit_amount,
          is_serialized,
          saleable,
          active,
          description,
        } = input;

        const updateData: any = {};
        if (name !== undefined) updateData.name = name;
        if (sku !== undefined) updateData.sku = sku.toUpperCase();
        if (category_id !== undefined) updateData.category_id = category_id;
        if (price !== undefined) updateData.price = price;
        if (vat_code !== undefined) updateData.vat_code = vat_code;
        if (deposit_amount !== undefined) updateData.deposit_amount = deposit_amount;
        if (is_serialized !== undefined) updateData.is_serialized = is_serialized;
        if (saleable !== undefined) updateData.saleable = saleable;
        if (active !== undefined) updateData.active = active;
        if (description !== undefined) updateData.description = description;

        const { data, error } = await ctx.supabase
          .from('accessories')
          .update(updateData)
          .eq('id', id)
          .select()
          .single();

        if (error) {
          ctx.logger.error('Error updating accessory:', error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to update accessory',
          });
        }

        return {
          accessory: data,
          message: 'Accessory updated successfully',
        };
      } catch (error) {
        ctx.logger.error('Error in accessories update mutation:', error);
        throw error;
      }
    }),

  // DELETE /accessories/{id} - Delete accessory
  delete: protectedProcedure
    .meta({
      openapi: {
        method: 'DELETE',
        path: '/accessories/{id}',
        tags: ['accessories'],
        summary: 'Delete accessory',
        description: 'Delete an accessory item.',
        protect: true,
      }
    })
    .input(DeleteAccessorySchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      try {
        const user = requireAuth(ctx);
        const { id } = input;

        const { error } = await ctx.supabase
          .from('accessories')
          .delete()
          .eq('id', id);

        if (error) {
          ctx.logger.error('Error deleting accessory:', error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to delete accessory',
          });
        }

        return {
          success: true,
          message: 'Accessory deleted successfully',
        };
      } catch (error) {
        ctx.logger.error('Error in accessories delete mutation:', error);
        throw error;
      }
    }),

  // GET /accessories/categories - Get accessory categories
  getCategories: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/accessories/categories',
        tags: ['accessories'],
        summary: 'Get accessory categories',
        description: 'Retrieve all accessory categories.',
        protect: true,
      }
    })
    .input(z.object({}).optional())
    .output(z.any())
    .query(async ({ ctx }) => {
      try {
        const user = requireAuth(ctx);

        const { data, error } = await ctx.supabase
          .from('accessory_categories')
          .select('*')
          .order('name');

        if (error) {
          ctx.logger.error('Error fetching accessory categories:', error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to fetch accessory categories',
          });
        }

        return {
          categories: data || [],
          totalCount: data?.length || 0,
        };
      } catch (error) {
        ctx.logger.error('Error in accessories categories query:', error);
        throw error;
      }
    }),

  // POST /accessories/categories - Create accessory category
  createCategory: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/accessories/categories',
        tags: ['accessories'],
        summary: 'Create accessory category',
        description: 'Create a new accessory category.',
        protect: true,
      }
    })
    .input(CreateAccessoryCategorySchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      try {
        const user = requireAuth(ctx);
        const { name, slug, description } = input;

        const { data, error } = await ctx.supabase
          .from('accessory_categories')
          .insert({
            name,
            slug: slug.toLowerCase(),
            description,
          })
          .select()
          .single();

        if (error) {
          ctx.logger.error('Error creating accessory category:', error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to create accessory category',
          });
        }

        return {
          category: data,
          message: 'Accessory category created successfully',
        };
      } catch (error) {
        ctx.logger.error('Error in accessories createCategory mutation:', error);
        throw error;
      }
    }),

  // PUT /accessories/categories/{id} - Update accessory category
  updateCategory: protectedProcedure
    .meta({
      openapi: {
        method: 'PUT',
        path: '/accessories/categories/{id}',
        tags: ['accessories'],
        summary: 'Update accessory category',
        description: 'Update an existing accessory category.',
        protect: true,
      }
    })
    .input(UpdateAccessoryCategorySchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      try {
        const user = requireAuth(ctx);
        const { id, name, slug, description } = input;

        const updateData: any = {};
        if (name !== undefined) updateData.name = name;
        if (slug !== undefined) updateData.slug = slug.toLowerCase();
        if (description !== undefined) updateData.description = description;

        const { data, error } = await ctx.supabase
          .from('accessory_categories')
          .update(updateData)
          .eq('id', id)
          .select()
          .single();

        if (error) {
          ctx.logger.error('Error updating accessory category:', error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to update accessory category',
          });
        }

        return {
          category: data,
          message: 'Accessory category updated successfully',
        };
      } catch (error) {
        ctx.logger.error('Error in accessories updateCategory mutation:', error);
        throw error;
      }
    }),

  // DELETE /accessories/categories/{id} - Delete accessory category
  deleteCategory: protectedProcedure
    .meta({
      openapi: {
        method: 'DELETE',
        path: '/accessories/categories/{id}',
        tags: ['accessories'],
        summary: 'Delete accessory category',
        description: 'Delete an accessory category.',
        protect: true,
      }
    })
    .input(DeleteAccessoryCategorySchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      try {
        const user = requireAuth(ctx);
        const { id } = input;

        const { error } = await ctx.supabase
          .from('accessory_categories')
          .delete()
          .eq('id', id);

        if (error) {
          ctx.logger.error('Error deleting accessory category:', error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to delete accessory category',
          });
        }

        return {
          success: true,
          message: 'Accessory category deleted successfully',
        };
      } catch (error) {
        ctx.logger.error('Error in accessories deleteCategory mutation:', error);
        throw error;
      }
    }),

  // POST /accessories/bulk-status - Bulk update accessory status
  bulkStatusUpdate: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/accessories/bulk-status',
        tags: ['accessories'],
        summary: 'Bulk update accessory status',
        description: 'Update the status of multiple accessories at once.',
        protect: true,
      }
    })
    .input(BulkAccessoryStatusUpdateSchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      try {
        const user = requireAuth(ctx);
        const { accessory_ids, active } = input;

        const { error } = await ctx.supabase
          .from('accessories')
          .update({ active })
          .in('id', accessory_ids);

        if (error) {
          ctx.logger.error('Error bulk updating accessory status:', error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to update accessory status',
          });
        }

        return {
          success: true,
          updated_count: accessory_ids.length,
          errors: [],
        };
      } catch (error) {
        ctx.logger.error('Error in accessories bulkStatusUpdate mutation:', error);
        throw error;
      }
    }),

  // POST /accessories/validate - Validate accessory data
  validate: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/accessories/validate',
        tags: ['accessories'],
        summary: 'Validate accessory data',
        description: 'Validate accessory data before creation or update.',
        protect: true,
      }
    })
    .input(ValidateAccessorySchema)
    .output(z.any())
    .query(async ({ input, ctx }) => {
      try {
        const user = requireAuth(ctx);
        const { sku, name, exclude_id } = input;
        const errors: string[] = [];
        const warnings: string[] = [];

        // Check SKU uniqueness
        let skuQuery = ctx.supabase
          .from('accessories')
          .select('id')
          .eq('sku', sku.toUpperCase());

        if (exclude_id) {
          skuQuery = skuQuery.neq('id', exclude_id);
        }

        const { data: existingSku } = await skuQuery.limit(1);

        if (existingSku && existingSku.length > 0) {
          errors.push('SKU already exists');
        }

        // Check name uniqueness
        let nameQuery = ctx.supabase
          .from('accessories')
          .select('id')
          .eq('name', name);

        if (exclude_id) {
          nameQuery = nameQuery.neq('id', exclude_id);
        }

        const { data: existingName } = await nameQuery.limit(1);

        if (existingName && existingName.length > 0) {
          warnings.push('Name already exists (may be intentional)');
        }

        // SKU format validation
        if (!/^[A-Z0-9-]+$/.test(sku.toUpperCase())) {
          errors.push('SKU must contain only uppercase letters, numbers, and hyphens');
        }

        if (sku.length < 3) {
          errors.push('SKU must be at least 3 characters long');
        }

        if (sku.length > 50) {
          errors.push('SKU must be 50 characters or less');
        }

        return {
          valid: errors.length === 0,
          errors,
          warnings,
        };
      } catch (error) {
        ctx.logger.error('Error in accessories validate query:', error);
        throw error;
      }
    }),

  // POST /accessories/validate-sku - Validate accessory SKU
  validateSku: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/accessories/validate-sku',
        tags: ['accessories'],
        summary: 'Validate accessory SKU',
        description: 'Validate accessory SKU format and uniqueness.',
        protect: true,
      }
    })
    .input(ValidateAccessorySkuSchema)
    .output(z.any())
    .query(async ({ input, ctx }) => {
      try {
        const user = requireAuth(ctx);
        const { sku, exclude_id } = input;
        const errors: string[] = [];
        const warnings: string[] = [];

        // Check SKU uniqueness
        let skuQuery = ctx.supabase
          .from('accessories')
          .select('id')
          .eq('sku', sku.toUpperCase());

        if (exclude_id) {
          skuQuery = skuQuery.neq('id', exclude_id);
        }

        const { data: existingSku } = await skuQuery.limit(1);

        if (existingSku && existingSku.length > 0) {
          errors.push('SKU already exists');
        }

        // SKU format validation
        if (!/^[A-Z0-9-]+$/.test(sku.toUpperCase())) {
          errors.push('SKU must contain only uppercase letters, numbers, and hyphens');
        }

        if (sku.length < 3) {
          errors.push('SKU must be at least 3 characters long');
        }

        if (sku.length > 50) {
          errors.push('SKU must be 50 characters or less');
        }

        return {
          valid: errors.length === 0,
          errors,
          warnings,
        };
      } catch (error) {
        ctx.logger.error('Error in accessories validateSku query:', error);
        throw error;
      }
    }),
}); 