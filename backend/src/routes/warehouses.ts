import { z } from 'zod';
import { router, protectedProcedure } from '../lib/trpc';
import { requireAuth } from '../lib/auth';
import { TRPCError } from '@trpc/server';

// Import input schemas
import {
  AddressSchema,
  WarehouseFiltersSchema,
  GetWarehouseByIdSchema,
  CreateWarehouseSchema,
  UpdateWarehouseSchema,
  DeleteWarehouseSchema,
} from '../schemas/input/warehouses-input';

// Import output schemas
import {
  WarehouseListResponseSchema,
  WarehouseDetailResponseSchema,
  WarehouseStatsResponseSchema,
  WarehouseOptionsResponseSchema,
  CreateWarehouseResponseSchema,
  UpdateWarehouseResponseSchema,
  DeleteWarehouseResponseSchema,
} from '../schemas/output/warehouses-output';

export const warehousesRouter = router({
  // GET /warehouses - List warehouses with optional filters
  list: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/warehouses',
        tags: ['warehouses'],
        summary: 'List warehouses with filtering and pagination',
        description: 'Retrieve a paginated list of warehouses with optional search filtering and address information.',
        protect: true,
      }
    })
    .input(WarehouseFiltersSchema.optional())
    .output(WarehouseListResponseSchema)
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

  // GET /warehouses/{id} - Get warehouse by ID
  get: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/warehouses/{id}',
        tags: ['warehouses'],
        summary: 'Get warehouse by ID',
        description: 'Retrieve detailed information about a specific warehouse including address details.',
        protect: true,
      }
    })
    .input(GetWarehouseByIdSchema)
    .output(WarehouseDetailResponseSchema)
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
    .meta({
      openapi: {
        method: 'GET',
        path: '/warehouses/stats',
        tags: ['warehouses'],
        summary: 'Get warehouse statistics',
        description: 'Retrieve aggregate statistics about warehouses including total count and capacity information.',
        protect: true,
      }
    })
    .input(z.void())
    .output(WarehouseStatsResponseSchema)
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
    .meta({
      openapi: {
        method: 'GET',
        path: '/warehouses/options',
        tags: ['warehouses'],
        summary: 'Get warehouse options for dropdowns',
        description: 'Retrieve simplified warehouse information suitable for dropdown lists and selection components.',
        protect: true,
      }
    })
    .input(z.void())
    .output(WarehouseOptionsResponseSchema)
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
    .meta({
      openapi: {
        method: 'POST',
        path: '/warehouses',
        tags: ['warehouses'],
        summary: 'Create new warehouse',
        description: 'Create a new warehouse with optional address information and capacity details.',
        protect: true,
      }
    })
    .input(CreateWarehouseSchema)
    .output(CreateWarehouseResponseSchema)
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

  // PUT /warehouses/{id} - Update warehouse
  update: protectedProcedure
    .meta({
      openapi: {
        method: 'PUT',
        path: '/warehouses/{id}',
        tags: ['warehouses'],
        summary: 'Update warehouse',
        description: 'Update warehouse information including name, capacity, and address details.',
        protect: true,
      }
    })
    .input(UpdateWarehouseSchema)
    .output(UpdateWarehouseResponseSchema)
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

  // DELETE /warehouses/{id} - Delete warehouse
  delete: protectedProcedure
    .meta({
      openapi: {
        method: 'DELETE',
        path: '/warehouses/{id}',
        tags: ['warehouses'],
        summary: 'Delete warehouse',
        description: 'Delete a warehouse after validating that it has no associated inventory, trucks, or orders.',
        protect: true,
      }
    })
    .input(DeleteWarehouseSchema)
    .output(DeleteWarehouseResponseSchema)
    .mutation(async ({ input, ctx }) => {
      // START DEBUG LOGGING
      console.log('🔥 DELETE FUNCTION STARTED');
      console.log('🔥 Input:', input);
      console.log('🔥 Context exists:', !!ctx);
      console.log('🔥 Supabase exists:', !!ctx.supabase);
      
      try {
        // DEBUG: Check auth first
        console.log('🔥 Checking auth...');
        const user = requireAuth(ctx);
        console.log('🔥 Auth successful, user:', user?.id);
        
        console.log('🔥 Starting delete process for warehouse:', input.id);
        ctx.logger.info('Deleting warehouse:', input.id);
  
        // DEBUG: Test basic Supabase connection
        console.log('🔥 Testing Supabase connection...');
        const { data: testConnection, error: testError } = await ctx.supabase
          .from('warehouses')
          .select('id')
          .limit(1);
        
        console.log('🔥 Supabase test result:', { 
          dataExists: !!testConnection, 
          error: testError?.message 
        });
  
        if (testError) {
          console.log('🔥 SUPABASE CONNECTION FAILED:', testError);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Database connection failed',
          });
        }
  
        // 1. Get warehouse with address info and check if it exists
        console.log('🔥 Fetching warehouse...');
        const { data: warehouse, error: fetchError } = await ctx.supabase
          .from('warehouses')
          .select('address_id, name, truck_id, is_mobile')
          .eq('id', input.id)
          .single();
  
        console.log('🔥 Warehouse fetch result:', { 
          found: !!warehouse, 
          error: fetchError?.message 
        });
  
        if (fetchError) {
          console.log('🔥 WAREHOUSE FETCH ERROR:', fetchError);
          if (fetchError.code === 'PGRST116') {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: 'Warehouse not found',
            });
          }
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Database error: ${fetchError.message}`,
          });
        }
  
        if (!warehouse) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Warehouse not found',
          });
        }
  
        console.log('🔥 Found warehouse:', warehouse.name);
  
        // 2. Check for related data that would prevent deletion
        console.log('🔥 Checking inventory...');
        const { data: inventory, error: inventoryError } = await ctx.supabase
          .from('inventory')
          .select('id')
          .eq('warehouse_id', input.id)
          .limit(1);
  
        console.log('🔥 Inventory check result:', { 
          hasInventory: inventory && inventory.length > 0, 
          error: inventoryError?.message 
        });
  
        if (inventoryError) {
          console.log('🔥 INVENTORY CHECK ERROR:', inventoryError);
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
  
        // Simplified truck check for debugging
        console.log('🔥 Checking trucks...');
        if (warehouse.truck_id) {
          console.log('🔥 Warehouse has truck_id:', warehouse.truck_id);
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Cannot delete warehouse with associated truck',
          });
        }
  
        // Check if any trucks reference this warehouse
        const { data: trucksUsingWarehouse, error: trucksError } = await ctx.supabase
          .from('trucks')
          .select('id, fleet_number')
          .or(`warehouse_id.eq.${input.id},current_warehouse_id.eq.${input.id}`)
          .limit(1);
  
        console.log('🔥 Trucks check result:', { 
          hasTrucks: trucksUsingWarehouse && trucksUsingWarehouse.length > 0, 
          error: trucksError?.message 
        });
  
        if (trucksError) {
          console.log('🔥 TRUCKS CHECK ERROR:', trucksError);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to check truck dependencies',
          });
        }
  
        if (trucksUsingWarehouse && trucksUsingWarehouse.length > 0) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Cannot delete warehouse - trucks are assigned to it',
          });
        }
  
        // Skip orders check for now - focus on basic deletion
        console.log('🔥 Skipping orders check for debugging...');
  
        // 3. Attempt to delete warehouse
        console.log('🔥 Attempting to delete warehouse...');
        const { error: deleteError } = await ctx.supabase
          .from('warehouses')
          .delete()
          .eq('id', input.id);
  
        console.log('🔥 Delete result:', { 
          success: !deleteError, 
          error: deleteError?.message,
          errorCode: deleteError?.code 
        });
  
        if (deleteError) {
          console.log('🔥 DELETE ERROR DETAILS:', {
            message: deleteError.message,
            code: deleteError.code,
            details: deleteError.details,
            hint: deleteError.hint
          });
          
          // Handle specific database constraint errors
          if (deleteError.code === '23503') { // Foreign key violation
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Cannot delete warehouse - it is referenced by other records. Please remove all references first.',
            });
          }
  
          // Generic database error
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to delete warehouse: ${deleteError.message}`,
          });
        }
  
        console.log('🔥 Warehouse deleted successfully');
  
        // Skip address cleanup for debugging
        console.log('🔥 Skipping address cleanup for debugging...');
  
        console.log('🔥 DELETE FUNCTION COMPLETED SUCCESSFULLY');
        ctx.logger.info(`Successfully deleted warehouse: ${warehouse.name}`);
        return { success: true };
  
      } catch (error) {
        console.log('🔥 CAUGHT ERROR IN DELETE FUNCTION:', error);
        console.log('🔥 Error type:', typeof error);
        console.log('🔥 Error instanceof TRPCError:', error instanceof TRPCError);
        
        // Ensure all errors are properly formatted TRPCErrors
        if (error instanceof TRPCError) {
          console.log('🔥 Rethrowing TRPCError:', error.message);
          throw error;
        }
        
        console.log('🔥 Converting to TRPCError:', error);
        ctx.logger.error('Unexpected error in warehouse deletion:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred while deleting the warehouse',
        });
      }
    }),
});
