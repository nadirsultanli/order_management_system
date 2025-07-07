import { z } from 'zod';
import { router, protectedProcedure } from '../lib/trpc';
import { requireAuth } from '../lib/auth';
import { TRPCError } from '@trpc/server';

// Validation schemas
const AddressSchema = z.object({
  line1: z.string().min(1),
  line2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().optional(),
  postal_code: z.string().optional(),
  country: z.string().min(1),
  instructions: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

const CreateWarehouseSchema = z.object({
  name: z.string().min(1),
  capacity_cylinders: z.number().positive().optional(),
  address: AddressSchema.optional(),
});

const UpdateWarehouseSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).optional(),
  capacity_cylinders: z.number().positive().optional(),
  address: AddressSchema.optional(),
});

const WarehouseFiltersSchema = z.object({
  search: z.string().optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(1000).default(50),
});

export const warehousesRouter = router({
  // GET /warehouses - List warehouses with optional filters
  list: protectedProcedure
    .input(WarehouseFiltersSchema.optional())
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      // Provide default values if input is undefined
      const filters = input || {} as any;
      const page = filters.page || 1;
      const limit = filters.limit || 50;
      
      ctx.logger.info('Fetching warehouses with filters:', filters);
      
      let query = ctx.supabase
        .from('warehouses')
        .select(`
          *,
          address:addresses(
            id,
            line1,
            line2,
            city,
            state,
            postal_code,
            country,
            instructions,
            latitude,
            longitude
          )
        `, { count: 'exact' })
        
        .order('created_at', { ascending: false });

      // Apply search filter
      if (filters.search) {
        query = query.ilike('name', `%${filters.search}%`);
      }

      // Apply pagination
      const from = (page - 1) * limit;
      const to = from + limit - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) {
        ctx.logger.error('Error fetching warehouses:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch warehouses',
        });
      }

      return {
        warehouses: data || [],
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
        currentPage: page,
      };
    }),

  // GET /warehouses/:id - Get warehouse by ID
  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Fetching warehouse:', input.id);
      
      const { data, error } = await ctx.supabase
        .from('warehouses')
        .select(`
          *,
          address:addresses(
            id,
            line1,
            line2,
            city,
            state,
            postal_code,
            country,
            instructions,
            latitude,
            longitude
          )
        `)
        .eq('id', input.id)
        
        .single();

      if (error) {
        ctx.logger.error('Error fetching warehouse:', error);
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Warehouse not found',
        });
      }

      return data;
    }),

  // GET /warehouses/stats - Get warehouse statistics
  getStats: protectedProcedure
    .query(async ({ ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Fetching warehouse statistics');
      
      const { data, error } = await ctx.supabase
        .from('warehouses')
        .select('capacity_cylinders')
        ;

      if (error) {
        ctx.logger.error('Error fetching warehouse stats:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch warehouse statistics',
        });
      }

      const capacities = data
        .map(w => w.capacity_cylinders)
        .filter(c => c !== null && c !== undefined) as number[];

      const stats = {
        total: data.length,
        total_capacity: capacities.reduce((sum, cap) => sum + cap, 0),
        average_capacity: capacities.length > 0 ? Math.round(capacities.reduce((sum, cap) => sum + cap, 0) / capacities.length) : 0,
      };

      return stats;
    }),

  // GET /warehouses/options - Get warehouse options for dropdowns
  getOptions: protectedProcedure
    .query(async ({ ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Fetching warehouse options');
      
      const { data, error } = await ctx.supabase
        .from('warehouses')
        .select(`
          id,
          name,
          address:addresses(city, state)
        `)
        
        .order('name');

      if (error) {
        ctx.logger.error('Error fetching warehouse options:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch warehouse options',
        });
      }

      return (data || []).map(w => ({
        id: w.id,
        name: w.name,
        city: w.address?.[0]?.city,
        state: w.address?.[0]?.state,
      }));
    }),

  // POST /warehouses - Create warehouse
  create: protectedProcedure
    .input(CreateWarehouseSchema)
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Creating warehouse:', input);
      
      // Check name uniqueness
      const { data: existingName } = await ctx.supabase
        .from('warehouses')
        .select('id')
        .eq('name', input.name)
        
        .single();

      if (existingName) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Warehouse name already exists. Please use a unique name.',
        });
      }

      // Start transaction by creating address first if provided
      let addressId = null;
      if (input.address) {
        const { data: addressData, error: addressError } = await ctx.supabase
          .from('addresses')
          .insert([{
            ...input.address,
            
            customer_id: null, // Not linked to a customer
            is_primary: false,
            created_at: new Date().toISOString(),
          }])
          .select()
          .single();

        if (addressError) {
          ctx.logger.error('Address creation error:', addressError);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to create address: ${addressError.message}`,
          });
        }

        addressId = addressData.id;
      }

      // Create warehouse
      const { data, error } = await ctx.supabase
        .from('warehouses')
        .insert([{
          name: input.name,
          capacity_cylinders: input.capacity_cylinders,
          address_id: addressId,
          
          created_at: new Date().toISOString(),
        }])
        .select(`
          *,
          address:addresses(
            id,
            line1,
            line2,
            city,
            state,
            postal_code,
            country,
            instructions
          )
        `)
        .single();

      if (error) {
        // If warehouse creation fails but address was created, clean up
        if (addressId) {
          await ctx.supabase.from('addresses').delete().eq('id', addressId);
        }
        ctx.logger.error('Create warehouse error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create warehouse',
        });
      }

      return data;
    }),

  // PUT /warehouses/:id - Update warehouse
  update: protectedProcedure
    .input(UpdateWarehouseSchema)
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      const { id, ...updateData } = input;
      
      ctx.logger.info('Updating warehouse:', id, updateData);
      
      // Check name uniqueness if name is being updated
      if (updateData.name) {
        const { data: existingName } = await ctx.supabase
          .from('warehouses')
          .select('id')
          .eq('name', updateData.name)
          
          .neq('id', id)
          .single();

        if (existingName) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Warehouse name already exists. Please use a unique name.',
          });
        }
      }

      // Get current warehouse to check if it has an address
      const { data: currentWarehouse } = await ctx.supabase
        .from('warehouses')
        .select('address_id')
        .eq('id', id)
        
        .single();

      if (!currentWarehouse) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Warehouse not found',
        });
      }

      let addressId = currentWarehouse.address_id;

      // Handle address update/creation
      if (updateData.address) {
        if (addressId) {
          // Update existing address
          const { error: addressError } = await ctx.supabase
            .from('addresses')
            .update(updateData.address)
            .eq('id', addressId);

          if (addressError) {
            ctx.logger.error('Address update error:', addressError);
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: `Failed to update address: ${addressError.message}`,
            });
          }
        } else {
          // Create new address
          const { data: addressData, error: addressError } = await ctx.supabase
            .from('addresses')
            .insert([{
              ...updateData.address,
              
              customer_id: null,
              is_primary: false,
              created_at: new Date().toISOString(),
            }])
            .select()
            .single();

          if (addressError) {
            ctx.logger.error('Address creation error:', addressError);
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: `Failed to create address: ${addressError.message}`,
            });
          }

          addressId = addressData.id;
        }
      }

      // Update warehouse
      const warehouseUpdate: any = {
        name: updateData.name,
        capacity_cylinders: updateData.capacity_cylinders,
      };

      if (addressId) {
        warehouseUpdate.address_id = addressId;
      }

      const { data, error } = await ctx.supabase
        .from('warehouses')
        .update(warehouseUpdate)
        .eq('id', id)
        
        .select(`
          *,
          address:addresses(
            id,
            line1,
            line2,
            city,
            state,
            postal_code,
            country,
            instructions
          )
        `)
        .single();

      if (error) {
        ctx.logger.error('Update warehouse error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update warehouse',
        });
      }

      return data;
    }),

  // DELETE /warehouses/:id - Delete warehouse
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Deleting warehouse:', input.id);
      
      // Get warehouse with address info
      const { data: warehouse } = await ctx.supabase
        .from('warehouses')
        .select('address_id')
        .eq('id', input.id)
        
        .single();

      if (!warehouse) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Warehouse not found',
        });
      }

      // Delete warehouse first
      const { error } = await ctx.supabase
        .from('warehouses')
        .delete()
        .eq('id', input.id)
        ;

      if (error) {
        ctx.logger.error('Delete warehouse error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to delete warehouse',
        });
      }

      // Delete associated address if it exists
      if (warehouse.address_id) {
        await ctx.supabase
          .from('addresses')
          .delete()
          .eq('id', warehouse.address_id);
      }

      return { success: true };
    }),
});