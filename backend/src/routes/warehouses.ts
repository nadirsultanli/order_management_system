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

  delete: protectedProcedure
  .input(z.object({ id: z.string().uuid() }))
  .mutation(async ({ input, ctx }) => {
    const user = requireAuth(ctx);
    ctx.logger.info('Deleting warehouse:', input.id);

    try {
      // 1. Get warehouse with address info and check if it exists
      const { data: warehouse, error: fetchError } = await ctx.supabase
        .from('warehouses')
        .select('address_id, name, truck_id, is_mobile')
        .eq('id', input.id)
        .single();

      if (fetchError || !warehouse) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Warehouse not found',
        });
      }

      // 2. COMPREHENSIVE Check for related data that would prevent deletion
      
      // Check if there's inventory in this warehouse
      const { data: inventory, error: inventoryError } = await ctx.supabase
        .from('inventory')
        .select('id')
        .eq('warehouse_id', input.id)
        .limit(1);

      if (inventoryError) {
        ctx.logger.error('Error checking inventory:', inventoryError);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to check warehouse dependencies',
        });
      }

      if (inventory && inventory.length > 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot delete warehouse with existing inventory',
        });
      }

      // Combined truck check - covers both directions
      const truckChecks = [];
      
      // Check if this warehouse has an associated truck
      if (warehouse.truck_id) {
        truckChecks.push('This warehouse has an associated truck');
      }
      
      // Check if any trucks reference this warehouse
      const { data: trucksUsingWarehouse, error: trucksError } = await ctx.supabase
        .from('trucks')
        .select('id, fleet_number')
        .or(`warehouse_id.eq.${input.id},current_warehouse_id.eq.${input.id}`)
        .limit(1);

      if (trucksError) {
        ctx.logger.error('Error checking trucks:', trucksError);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to check truck dependencies',
        });
      }

      if (trucksUsingWarehouse && trucksUsingWarehouse.length > 0) {
        truckChecks.push('Trucks are assigned to this warehouse');
      }

      if (truckChecks.length > 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Cannot delete warehouse: ${truckChecks.join('. ')}. Remove truck associations first.`,
        });
      }

      // Check for pending orders/transfers
      const { data: pendingOrders, error: ordersError } = await ctx.supabase
        .from('orders')
        .select('id')
        .or(`pickup_warehouse_id.eq.${input.id},delivery_warehouse_id.eq.${input.id}`)
        .eq('status', 'pending')
        .limit(1);

      if (ordersError) {
        ctx.logger.error('Error checking orders:', ordersError);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to check order dependencies',
        });
      }

      if (pendingOrders && pendingOrders.length > 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot delete warehouse with pending orders',
        });
      }

      // NEW: Check for any other foreign key references that might exist
      // Add checks for any other tables that might reference this warehouse
      const { data: customerReferences, error: customerError } = await ctx.supabase
        .from('customers')
        .select('id')
        .eq('preferred_warehouse_id', input.id)
        .limit(1);

      if (customerError) {
        ctx.logger.warn('Error checking customer references:', customerError);
        // Don't fail here, just log
      } else if (customerReferences && customerReferences.length > 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot delete warehouse - customers have this as preferred warehouse',
        });
      }

      // 3. Delete warehouse with better error handling
      const { error: deleteError } = await ctx.supabase
        .from('warehouses')
        .delete()
        .eq('id', input.id);

      if (deleteError) {
        ctx.logger.error('Delete warehouse error:', deleteError);
        
        // Handle specific database constraint errors
        if (deleteError.code === '23503') { // Foreign key violation
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Cannot delete warehouse - it is referenced by other records. Please remove all references first.',
          });
        }
        
        if (deleteError.code === '23505') { // Unique violation (shouldn't happen on delete)
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Database constraint violation during deletion.',
          });
        }

        // Generic database error
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to delete warehouse: ${deleteError.message}`,
        });
      }

      // 4. Delete associated address if it exists and is not used by other warehouses
      if (warehouse.address_id) {
        try {
          const { data: otherWarehousesWithSameAddress } = await ctx.supabase
            .from('warehouses')
            .select('id')
            .eq('address_id', warehouse.address_id)
            .limit(1);

          if (!otherWarehousesWithSameAddress || otherWarehousesWithSameAddress.length === 0) {
            const { error: addressError } = await ctx.supabase
              .from('addresses')
              .delete()
              .eq('id', warehouse.address_id);

            if (addressError) {
              ctx.logger.warn('Failed to delete associated address:', addressError);
              // Don't throw error since warehouse deletion succeeded
            } else {
              ctx.logger.info('Successfully deleted associated address');
            }
          } else {
            ctx.logger.info('Address retained - used by other warehouses');
          }
        } catch (addressCleanupError) {
          ctx.logger.warn('Error during address cleanup:', addressCleanupError);
          // Don't fail the whole operation
        }
      }

      ctx.logger.info(`Successfully deleted warehouse: ${warehouse.name}`);
      return { success: true };

    } catch (error) {
      // Ensure all errors are properly formatted TRPCErrors
      if (error instanceof TRPCError) {
        throw error;
      }
      
      ctx.logger.error('Unexpected error in warehouse deletion:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred while deleting the warehouse',
      });
    }
  })
});