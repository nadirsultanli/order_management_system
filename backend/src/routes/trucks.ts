import { z } from 'zod';
import { router, protectedProcedure } from '../lib/trpc';
import { requireAuth } from '../lib/auth';
import { TRPCError } from '@trpc/server';
import { formatErrorMessage } from '../lib/logger';
import { TruckReservationService } from '../lib/truck-reservation';

// Import input schemas
import {
  TruckFiltersSchema,
  GetTruckByIdSchema,
  CreateTruckSchema,
  UpdateTruckSchema,
  DeleteTruckSchema,
  GetAllocationsSchema,
  TruckAllocationSchema,
  UpdateTruckAllocationSchema,
  GetRoutesSchema,
  CreateTruckRouteSchema,
  UpdateTruckRouteSchema,
  GetMaintenanceSchema,
  CreateMaintenanceSchema,
  UpdateMaintenanceSchema,
  CalculateOrderWeightSchema,
  CalculateCapacitySchema,
  FindBestAllocationSchema,
  ValidateAllocationSchema,
  GenerateScheduleSchema,
  OptimizeAllocationsSchema,
  LoadInventorySchema,
  UnloadInventorySchema,
  GetInventorySchema,
  ValidateLoadingCapacitySchema,
} from '../schemas/input/trucks-input';

// Import output schemas
import {
  TruckListResponseSchema,
  TruckDetailResponseSchema,
  CreateTruckResponseSchema,
  UpdateTruckResponseSchema,
  DeleteTruckResponseSchema,
  GetAllocationsResponseSchema,
  CreateAllocationResponseSchema,
  UpdateAllocationResponseSchema,
  GetRoutesResponseSchema,
  CreateRouteResponseSchema,
  UpdateRouteResponseSchema,
  GetMaintenanceResponseSchema,
  CreateMaintenanceResponseSchema,
  UpdateMaintenanceResponseSchema,
  OrderWeightResponseSchema,
  TruckCapacityResponseSchema,
  BestAllocationResponseSchema,
  AllocationValidationResponseSchema,
  TruckScheduleResponseSchema,
  OptimizedAllocationsResponseSchema,
  LoadInventoryResponseSchema,
  UnloadInventoryResponseSchema,
  TruckInventoryResponseSchema,
  ValidateLoadingCapacityResponseSchema,
  ReserveInventoryResponseSchema,
  ReleaseReservationResponseSchema,
  CheckAvailabilityResponseSchema,
} from '../schemas/output/trucks-output';

import {
  calculateOrderWeight,
  calculateTruckCapacity,
  findBestTruckForOrder,
  validateTruckAllocation,
  validateTruckLoadingCapacity,
  generateDailyTruckSchedule,
  calculateFleetUtilization,
  optimizeTruckAllocations,
  processTruckInventory,
  type TruckWithInventory,
  type TruckAllocation,
  type Order,
  type OrderLine,
  type Product
} from '../lib/truck-capacity';

// Validation schemas
const TruckStatusEnum = z.enum(['active', 'inactive', 'maintenance']);
const RouteStatusEnum = z.enum(['planned', 'unloaded', 'loaded', 'in_transit', 'completed', 'cancelled']);
const AllocationStatusEnum = z.enum(['planned', 'loaded', 'delivered', 'cancelled']);
const MaintenanceTypeEnum = z.enum(['routine', 'repair', 'inspection', 'emergency']);
const MaintenanceStatusEnum = z.enum(['scheduled', 'in_progress', 'completed', 'cancelled']);

export const trucksRouter = router({
  // GET /trucks - List trucks with optional filters
  list: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/trucks',
        tags: ['trucks'],
        summary: 'List trucks with filtering and pagination',
        description: 'Retrieve a paginated list of trucks with optional filtering by search text, status, and active state. Includes inventory data for each truck.',
        protect: true,
      }
    })
    .input(TruckFiltersSchema.optional())
    .output(z.any())
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      // Provide default values if input is undefined
      const filters = input || {} as any;
      const page = filters.page || 1;
      const limit = filters.limit || 50;
      
      ctx.logger.info('Fetching trucks with filters:', filters);
      
      let query = ctx.supabase
        .from('truck')
        .select(`
          *,
          driver:driver_id (
            id,
            name,
            email,
            phone
          )
        `, { count: 'exact' })
        .order('fleet_number');

      // Apply search filter
      if (filters.search) {
        query = query.or(`fleet_number.ilike.%${filters.search}%,license_plate.ilike.%${filters.search}%,driver.name.ilike.%${filters.search}%`);
      }

      // Apply status filter using active field (status doesn't exist in database)
      if (filters.status) {
        if (filters.status === 'active') {
          query = query.eq('active', true);
        } else if (filters.status === 'inactive') {
          query = query.eq('active', false);
        }
        // maintenance status would need additional logic if needed
      }

      // Apply active filter
      if (filters.active !== undefined) {
        query = query.eq('active', filters.active);
      }

      // Apply pagination
      const from = (page - 1) * limit;
      const to = from + limit - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) {
        ctx.logger.error('Error fetching trucks:', {
          error: formatErrorMessage(error),
          code: error.code,
          details: error.details,
          hint: error.hint,
          user_id: user.id,
          filters: filters
        });
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to fetch trucks: ${formatErrorMessage(error)}`,
        });
      }

      // Get inventory data for all trucks to calculate current load
      const truckIds = (data || []).map(truck => truck.id);
      const { data: inventoryData } = await ctx.supabase
        .from('truck_inventory')
        .select(`
          truck_id,
          product_id,
          qty_full,
          qty_empty,
          qty_reserved,
          product:product_id (
            name,
            sku,
            variant_name
          )
        `)
        .in('truck_id', truckIds);

      // Group inventory by truck_id
      const inventoryByTruck = (inventoryData || []).reduce((acc: any, item: any) => {
        if (!acc[item.truck_id]) {
          acc[item.truck_id] = [];
        }
        const qty_reserved = item.qty_reserved || 0;
        const qty_available = item.qty_full - qty_reserved;
        
        acc[item.truck_id].push({
          product_id: item.product_id,
          product_name: item.product?.name || 'Unknown Product',
          product_sku: item.product?.sku || '',
          product_variant_name: item.product?.variant_name,
          qty_full: item.qty_full,
          qty_empty: item.qty_empty,
          qty_reserved: qty_reserved,
          qty_available: qty_available,
        });
        return acc;
      }, {});

      // Enhance trucks with calculated fields and inventory
      const enhancedTrucks = (data || []).map(truck => ({
        ...truck,
        capacity_kg: truck.capacity_cylinders * 27, // Calculate from capacity_cylinders
        status: truck.active ? 'active' : 'inactive', // Derive from active field
        inventory: inventoryByTruck[truck.id] || [], // Add inventory data
      }));

      return {
        trucks: enhancedTrucks,
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
        currentPage: page,
      };
    }),

  // GET /trucks/{id} - Get truck with inventory
  get: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/trucks/{id}',
        tags: ['trucks'],
        summary: 'Get truck details with inventory',
        description: 'Retrieve detailed information about a specific truck including current inventory, route information, and capacity calculations.',
        protect: true,
      }
    })
    .input(GetTruckByIdSchema)
    .output(z.any())
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Fetching truck:', input.id);
      
      // Get truck with driver information
      const { data: truck, error: truckError } = await ctx.supabase
        .from('truck')
        .select(`
          *,
          driver:driver_id (
            id,
            name,
            email,
            phone
          )
        `)
        .eq('id', input.id)
        .single();

      if (truckError) {
        ctx.logger.error('Error fetching truck:', truckError);
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Truck not found',
        });
      }

      // Get truck inventory
      const { data: inventoryData } = await ctx.supabase
        .from('truck_inventory')
        .select(`
          *,
          product:product_id (
            name,
            sku,
            variant_name,
            capacity_kg,
            tare_weight_kg
          )
        `)
        .eq('truck_id', input.id);

      // Get current route
      const { data: routeData } = await ctx.supabase
        .from('truck_routes')
        .select('*')
        .eq('truck_id', input.id)
        .eq('route_date', new Date().toISOString().split('T')[0])
        .maybeSingle();

      // Process inventory with weight calculations
      const inventory = processTruckInventory(inventoryData);

      const enhancedTruck = {
        ...truck,
        capacity_kg: truck.capacity_cylinders * 27, // Calculate from capacity_cylinders
        status: truck.active ? 'active' : 'inactive', // Derive from active field
        inventory,
        current_route: routeData
      };

      return enhancedTruck;
    }),

  // POST /trucks - Create truck
  create: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/trucks',
        tags: ['trucks'],
        summary: 'Create new truck',
        description: 'Create a new truck with fleet information, capacity details, and driver assignment.',
        protect: true,
      }
    })
    .input(CreateTruckSchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Creating truck:', input);
      
      // Only include columns that exist in the database
      const truckData = {
        fleet_number: input.fleet_number,
        license_plate: input.license_plate,
        capacity_cylinders: input.capacity_cylinders,
        active: input.active,
        last_maintenance_date: input.last_maintenance_date || null,
        next_maintenance_due: input.next_maintenance_due || null,
        fuel_capacity_liters: input.fuel_capacity_liters || null,
        avg_fuel_consumption: input.avg_fuel_consumption || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await ctx.supabase
        .from('truck')
        .insert([truckData])
        .select()
        .single();

      if (error) {
        ctx.logger.error('Error creating truck:', {
          error: formatErrorMessage(error),
          code: error.code,
          details: error.details,
          hint: error.hint,
          user_id: user.id,
          truck_data: truckData
        });
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to create truck: ${formatErrorMessage(error)}`,
        });
      }

      return data;
    }),

  // PUT /trucks/{id} - Update truck
  update: protectedProcedure
    .meta({
      openapi: {
        method: 'PUT',
        path: '/trucks/{id}',
        tags: ['trucks'],
        summary: 'Update truck information',
        description: 'Update truck details including fleet number, capacity, driver information, and maintenance schedules.',
        protect: true,
      }
    })
    .input(UpdateTruckSchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      const { id, capacity_kg, status, maintenance_interval_days, ...updateData } = input;
      
      ctx.logger.info('Updating truck:', id, updateData);
      
      // Only include columns that exist in the database
      const cleanUpdateData = {
        ...updateData,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await ctx.supabase
        .from('truck')
        .update(cleanUpdateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        ctx.logger.error('Error updating truck:', {
          error: formatErrorMessage(error),
          code: error.code,
          details: error.details,
          hint: error.hint,
          user_id: user.id,
          truck_id: id,
          update_data: cleanUpdateData
        });
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to update truck: ${formatErrorMessage(error)}`,
        });
      }

      return data;
    }),

  // DELETE /trucks/{id} - Delete truck
  delete: protectedProcedure
    .meta({
      openapi: {
        method: 'DELETE',
        path: '/trucks/{id}',
        tags: ['trucks'],
        summary: 'Delete truck',
        description: 'Delete a truck from the fleet. This action cannot be undone.',
        protect: true,
      }
    })
    .input(DeleteTruckSchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Deleting truck:', input.id);
      
      const { error } = await ctx.supabase
        .from('truck')
        .delete()
        .eq('id', input.id)
        ;

      if (error) {
        ctx.logger.error('Error deleting truck:', {
          error: formatErrorMessage(error),
          code: error.code,
          details: error.details,
          hint: error.hint,
          user_id: user.id,
          truck_id: input.id
        });
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to delete truck: ${formatErrorMessage(error)}`,
        });
      }

      return { success: true };
    }),

  // Truck Capacity Management
  getAllocations: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/trucks/allocations',
        tags: ['trucks'],
        summary: 'Get truck allocations',
        description: 'Retrieve truck allocations for a specific date and/or truck with order assignments and capacity information.',
        protect: true,
      }
    })
    .input(GetAllocationsSchema)
    .output(z.any())
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      const targetDate = input.date || new Date().toISOString().split('T')[0];
      
      let query = ctx.supabase
        .from('truck_allocations')
        .select('*')
        .eq('allocation_date', targetDate)
        .neq('status', 'cancelled');

      if (input.truck_id) {
        query = query.eq('truck_id', input.truck_id);
      }

      const { data, error } = await query;

      if (error) {
        ctx.logger.error('Error fetching truck allocations:', {
          error: formatErrorMessage(error),
          code: error.code,
          details: error.details,
          hint: error.hint,
          user_id: user.id,
          truck_id: input.truck_id,
          target_date: targetDate
        });
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to fetch truck allocations: ${formatErrorMessage(error)}`,
        });
      }

      return data || [];
    }),

  // POST /trucks/allocations - Allocate order to truck
  allocateOrder: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/trucks/allocations',
        tags: ['trucks'],
        summary: 'Allocate order to truck',
        description: 'Assign an order to a specific truck with estimated weight and delivery sequence information. Automatically reserves inventory on the truck.',
        protect: true,
      }
    })
    .input(TruckAllocationSchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Creating truck allocation:', input);
      
      // First, get order details to reserve inventory
      const { data: order, error: orderError } = await ctx.supabase
        .from('orders')
        .select(`
          id,
          order_lines (
            product_id,
            quantity
          )
        `)
        .eq('id', input.order_id)
        .single();

      if (orderError || !order) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Order not found',
        });
      }

      // Create truck allocation
      const { data: allocation, error } = await ctx.supabase
        .from('truck_allocations')
        .insert([{
          ...input,
          status: 'planned',
          created_at: new Date().toISOString(),
        }])
        .select()
        .single();

      if (error) {
        ctx.logger.error('Error creating truck allocation:', {
          error: formatErrorMessage(error),
          code: error.code,
          details: error.details,
          hint: error.hint,
          user_id: user.id,
          allocation_data: input
        });
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to allocate order to truck: ${formatErrorMessage(error)}`,
        });
      }

      // Reserve inventory on truck for each order line
      const reservationService = new TruckReservationService(ctx.supabase, ctx.logger);
      const reservationResults = [];

      try {
        for (const line of order.order_lines || []) {
          const reservationResult = await reservationService.reserveInventory({
            truck_id: input.truck_id,
            product_id: line.product_id,
            quantity: line.quantity,
            order_id: input.order_id,
            user_id: user.id,
          });
          reservationResults.push(reservationResult);
        }

        ctx.logger.info('Truck allocation and inventory reservations completed:', {
          allocation_id: allocation.id,
          order_id: input.order_id,
          truck_id: input.truck_id,
          reservations_count: reservationResults.length,
        });

        return {
          ...allocation,
          reservations: reservationResults,
        };

      } catch (reservationError) {
        // If reservation fails, rollback the allocation
        ctx.logger.error('Reservation failed, rolling back allocation:', reservationError);
        
        await ctx.supabase
          .from('truck_allocations')
          .delete()
          .eq('id', allocation.id);

        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Failed to reserve inventory on truck: ${reservationError instanceof Error ? reservationError.message : 'Unknown error'}`,
        });
      }
    }),

  // PUT /trucks/allocations/:id - Update allocation
  updateAllocation: protectedProcedure
    .meta({
      openapi: {
        method: 'PUT',
        path: '/trucks/allocations/{id}',
        tags: ['trucks'],
        summary: 'Update truck allocation',
        description: 'Update the status or sequence of an existing truck allocation.',
        protect: true,
      }
    })
    .input(UpdateTruckAllocationSchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      const { id, ...updateData } = input;
      
      ctx.logger.info('Updating truck allocation:', id, updateData);
      
      const { data, error } = await ctx.supabase
        .from('truck_allocations')
        .update(updateData)
        .eq('id', id)
        
        .select()
        .single();

      if (error) {
        ctx.logger.error('Error updating truck allocation:', {
          error: formatErrorMessage(error),
          code: error.code,
          details: error.details,
          hint: error.hint,
          user_id: user.id,
          allocation_id: id,
          update_data: updateData
        });
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to update truck allocation: ${formatErrorMessage(error)}`,
        });
      }

      return data;
    }),

  // Truck Routes Management
  getRoutes: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/trucks/routes',
        tags: ['trucks'],
        summary: 'Get truck routes',
        description: 'Retrieve planned and actual routes for trucks on a specific date with timing and distance information.',
        protect: true,
      }
    })
    .input(GetRoutesSchema)
    .output(z.any())
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      const targetDate = input.date || new Date().toISOString().split('T')[0];
      
      let query = ctx.supabase
        .from('truck_routes')
        .select('*')
        .eq('route_date', targetDate)
        .order('planned_start_time');

      if (input.truck_id) {
        query = query.eq('truck_id', input.truck_id);
      }

      const { data, error } = await query;

      if (error) {
        ctx.logger.error('Error fetching truck routes:', {
          error: formatErrorMessage(error),
          code: error.code,
          details: error.details,
          hint: error.hint,
          user_id: user.id,
          truck_id: input.truck_id,
          target_date: targetDate
        });
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to fetch truck routes: ${formatErrorMessage(error)}`,
        });
      }

      return data || [];
    }),

  // POST /trucks/routes - Create route
  createRoute: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/trucks/routes',
        tags: ['trucks'],
        summary: 'Create truck route',
        description: 'Create a new route plan for a truck with scheduled times and distance estimates.',
        protect: true,
      }
    })
    .input(CreateTruckRouteSchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Creating truck route:', input);
      
      const { data, error } = await ctx.supabase
        .from('truck_routes')
        .insert([{
          ...input,
          
          route_status: 'planned',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }])
        .select()
        .single();

      if (error) {
        ctx.logger.error('Error creating truck route:', {
          error: formatErrorMessage(error),
          code: error.code,
          details: error.details,
          hint: error.hint,
          user_id: user.id,
          route_data: input
        });
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to create truck route: ${formatErrorMessage(error)}`,
        });
      }

      return data;
    }),

  // PUT /trucks/routes/{id} - Update route
  updateRoute: protectedProcedure
    .meta({
      openapi: {
        method: 'PUT',
        path: '/trucks/routes/{id}',
        tags: ['trucks'],
        summary: 'Update truck route',
        description: 'Update route information with actual times, status changes, and fuel consumption data.',
        protect: true,
      }
    })
    .input(UpdateTruckRouteSchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      const { id, ...updateData } = input;
      
      ctx.logger.info('Updating truck route:', id, updateData);
      
      const { data, error } = await ctx.supabase
        .from('truck_routes')
        .update({
          ...updateData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        
        .select()
        .single();

      if (error) {
        ctx.logger.error('Error updating truck route:', {
          error: formatErrorMessage(error),
          code: error.code,
          details: error.details,
          hint: error.hint,
          user_id: user.id,
          route_id: id,
          update_data: updateData
        });
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to update truck route: ${formatErrorMessage(error)}`,
        });
      }

      return data;
    }),

  // Truck Maintenance Management
  getMaintenance: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/trucks/maintenance',
        tags: ['trucks'],
        summary: 'Get maintenance records',
        description: 'Retrieve maintenance records for trucks with scheduling, completion status, and cost information.',
        protect: true,
      }
    })
    .input(GetMaintenanceSchema)
    .output(z.any())
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      let query = ctx.supabase
        .from('truck_maintenance')
        .select('*')
        
        .order('scheduled_date', { ascending: false });

      if (input.truck_id) {
        query = query.eq('truck_id', input.truck_id);
      }

      const { data, error } = await query;

      if (error) {
        ctx.logger.error('Error fetching truck maintenance:', {
          error: formatErrorMessage(error),
          code: error.code,
          details: error.details,
          hint: error.hint,
          user_id: user.id,
          truck_id: input.truck_id
        });
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to fetch truck maintenance records: ${formatErrorMessage(error)}`,
        });
      }

      return data || [];
    }),

  // POST /trucks/maintenance - Schedule maintenance
  scheduleMaintenance: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/trucks/maintenance',
        tags: ['trucks'],
        summary: 'Schedule truck maintenance',
        description: 'Schedule maintenance for a truck with type, date, description, and mechanic assignment.',
        protect: true,
      }
    })
    .input(CreateMaintenanceSchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Scheduling truck maintenance:', input);
      
      const { data, error } = await ctx.supabase
        .from('truck_maintenance')
        .insert([{
          ...input,
          
          status: 'scheduled',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }])
        .select()
        .single();

      if (error) {
        ctx.logger.error('Error scheduling truck maintenance:', {
          error: formatErrorMessage(error),
          code: error.code,
          details: error.details,
          hint: error.hint,
          user_id: user.id,
          maintenance_data: input
        });
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to schedule truck maintenance: ${formatErrorMessage(error)}`,
        });
      }

      return data;
    }),

  // PUT /trucks/maintenance/{id} - Update maintenance
  updateMaintenance: protectedProcedure
    .meta({
      openapi: {
        method: 'PUT',
        path: '/trucks/maintenance/{id}',
        tags: ['trucks'],
        summary: 'Update maintenance record',
        description: 'Update maintenance record with completion status, actual costs, and mechanic notes.',
        protect: true,
      }
    })
    .input(UpdateMaintenanceSchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      const { id, ...updateData } = input;
      
      ctx.logger.info('Updating truck maintenance:', id, updateData);
      
      const { data, error } = await ctx.supabase
        .from('truck_maintenance')
        .update({
          ...updateData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        
        .select()
        .single();

      if (error) {
        ctx.logger.error('Error updating truck maintenance:', {
          error: formatErrorMessage(error),
          code: error.code,
          details: error.details,
          hint: error.hint,
          user_id: user.id,
          maintenance_id: id,
          update_data: updateData
        });
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to update truck maintenance: ${formatErrorMessage(error)}`,
        });
      }

      return data;
    }),

  // Truck Capacity Calculation Endpoints
  calculateOrderWeight: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/trucks/calculate-order-weight',
        tags: ['trucks'],
        summary: 'Calculate order weight',
        description: 'Calculate the total weight of an order for truck capacity planning and allocation decisions.',
        protect: true,
      }
    })
    .input(CalculateOrderWeightSchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Calculating order weight for order lines:', input.order_lines.length);
      
      // Get product details for weight calculation
      const productIds = input.product_ids || input.order_lines.map(line => line.product_id);
      
      const { data: products, error } = await ctx.supabase
        .from('products')
        .select('id, name, sku, is_variant, variant_name, parent_product_id, capacity_kg, tare_weight_kg')
        .in('id', productIds);

      if (error) {
        ctx.logger.error('Error fetching products for weight calculation:', {
          error: formatErrorMessage(error),
          code: error.code,
          details: error.details,
          hint: error.hint,
          user_id: user.id,
          product_ids: productIds,
          order_lines_count: input.order_lines.length
        });
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to fetch product data: ${formatErrorMessage(error)}`,
        });
      }

      const result = calculateOrderWeight(input.order_lines as OrderLine[], products || []);
      
      return result;
    }),

  calculateCapacity: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/trucks/{truck_id}/capacity',
        tags: ['trucks'],
        summary: 'Calculate truck capacity',
        description: 'Calculate current capacity utilization for a truck on a specific date including existing allocations.',
        protect: true,
      }
    })
    .input(CalculateCapacitySchema)
    .output(z.any())
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Calculating truck capacity:', input.truck_id, input.date);
      
      // Get truck details
      const { data: truck, error: truckError } = await ctx.supabase
        .from('truck')
        .select(`
          *,
          driver:driver_id (
            id,
            name,
            email,
            phone
          )
        `)
        .eq('id', input.truck_id)
        .single();

      if (truckError || !truck) {
        ctx.logger.error('Truck validation error for capacity calculation:', {
          error: formatErrorMessage(truckError),
          code: truckError?.code,
          details: truckError?.details,
          hint: truckError?.hint,
          user_id: user.id,
          truck_id: input.truck_id
        });
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Truck not found',
        });
      }

      // CRITICAL FIX: Get truck inventory for proper capacity calculation
      const { data: inventoryData } = await ctx.supabase
        .from('truck_inventory')
        .select(`
          *,
          product:product_id (
            name,
            sku,
            variant_name,
            capacity_kg,
            tare_weight_kg
          )
        `)
        .eq('truck_id', input.truck_id);

      // Get truck allocations for the date
      const { data: allocations, error: allocError } = await ctx.supabase
        .from('truck_allocations')
        .select('*')
        .eq('allocation_date', input.date)
        .neq('status', 'cancelled');

      if (allocError) {
        ctx.logger.error('Error fetching truck allocations:', allocError);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch truck allocations',
        });
      }

      // Process inventory with weight calculations
      const inventory = processTruckInventory(inventoryData);

      const truckWithCapacity: TruckWithInventory = {
        ...truck,
        capacity_kg: truck.capacity_cylinders * 27, // Calculate from capacity_cylinders
        status: truck.active ? 'active' : 'inactive', // Derive from active field
        inventory // Include actual inventory for capacity calculation
      };

      const result = calculateTruckCapacity(truckWithCapacity, allocations || [], input.date);
      
      return result;
    }),

  findBestAllocation: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/trucks/find-best-allocation',
        tags: ['trucks'],
        summary: 'Find best truck allocation',
        description: 'Find the most suitable truck for an order based on capacity, efficiency, and utilization optimization.',
        protect: true,
      }
    })
    .input(FindBestAllocationSchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Finding best truck allocation for order:', input.order_id);
      
      // Get order details
      const { data: order, error: orderError } = await ctx.supabase
        .from('orders')
        .select('*')
        .eq('id', input.order_id)
        .single();

      if (orderError || !order) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Order not found',
        });
      }

      // Get all active trucks
      const { data: trucks, error: trucksError } = await ctx.supabase
        .from('truck')
        .select(`
          *,
          driver:driver_id (
            id,
            name,
            email,
            phone
          )
        `)
        .eq('active', true);

      if (trucksError) {
        ctx.logger.error('Error fetching trucks:', trucksError);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch trucks',
        });
      }

      // Get all allocations for the target date
      const { data: allocations, error: allocError } = await ctx.supabase
        .from('truck_allocations')
        .select('*')
        .eq('allocation_date', input.target_date)
        .neq('status', 'cancelled');

      if (allocError) {
        ctx.logger.error('Error fetching allocations:', allocError);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch allocations',
        });
      }

      // Enhance trucks with capacity info
      const enhancedTrucks: TruckWithInventory[] = (trucks || []).map(truck => ({
        ...truck,
        capacity_kg: truck.capacity_cylinders * 27, // Calculate from capacity_cylinders
        status: truck.active ? 'active' : 'inactive' // Derive from active field
      }));

      const result = findBestTruckForOrder(
        order,
        input.order_weight,
        enhancedTrucks,
        allocations || [],
        input.target_date
      );
      
      return result;
    }),

  validateAllocation: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/trucks/validate-allocation',
        tags: ['trucks'],
        summary: 'Validate truck allocation',
        description: 'Validate if a specific truck can accommodate an order considering capacity constraints and existing allocations.',
        protect: true,
      }
    })
    .input(ValidateAllocationSchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Validating truck allocation:', input.truck_id, input.order_id);
      
      // Get truck details
      const { data: truck, error: truckError } = await ctx.supabase
        .from('truck')
        .select(`
          *,
          driver:driver_id (
            id,
            name,
            email,
            phone
          )
        `)
        .eq('id', input.truck_id)
        .single();

      if (truckError || !truck) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Truck not found',
        });
      }

      // Get order details
      const { data: order, error: orderError } = await ctx.supabase
        .from('orders')
        .select('*')
        .eq('id', input.order_id)
        .single();

      if (orderError || !order) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Order not found',
        });
      }

      // Get existing allocations
      const { data: existingAllocations, error: allocError } = await ctx.supabase
        .from('truck_allocations')
        .select('*')
        .eq('truck_id', input.truck_id)
        .eq('allocation_date', input.target_date)
        .neq('status', 'cancelled');

      if (allocError) {
        ctx.logger.error('Error fetching existing allocations:', allocError);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch existing allocations',
        });
      }

      const truckWithCapacity: TruckWithInventory = {
        ...truck,
        capacity_kg: truck.capacity_cylinders * 27, // Calculate from capacity_cylinders
        status: truck.active ? 'active' : 'inactive' // Derive from active field
      };

      const result = validateTruckAllocation(
        truckWithCapacity,
        order,
        input.order_weight,
        existingAllocations || [],
        input.target_date
      );
      
      return result;
    }),

  generateSchedule: protectedProcedure
    // .meta({
    //   openapi: {
    //     method: 'GET',
    //     path: '/trucks/schedule/{date}',
    //     tags: ['trucks'],
    //     summary: 'Generate daily truck schedule',
    //     description: 'Generate optimized daily schedules for all trucks with capacity utilization and fleet efficiency metrics.',
    //     protect: true,
    //   }
    // })
    .input(GenerateScheduleSchema)
    .output(z.any())
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Generating daily truck schedule for:', input.date);
      
      // Get all trucks
      const { data: trucks, error: trucksError } = await ctx.supabase
        .from('truck')
        .select(`
          *,
          driver:driver_id (
            id,
            name,
            email,
            phone
          )
        `)
        .order('fleet_number');

      if (trucksError) {
        ctx.logger.error('Error fetching trucks:', trucksError);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch trucks',
        });
      }

      // CRITICAL FIX: Get all truck inventories for proper capacity calculation
      const { data: allInventoryData } = await ctx.supabase
        .from('truck_inventory')
        .select(`
          *,
          product:product_id (
            name,
            sku,
            variant_name,
            capacity_kg,
            tare_weight_kg
          )
        `);

      // Get all allocations for the date
      const { data: allocations, error: allocError } = await ctx.supabase
        .from('truck_allocations')
        .select('*')
        .eq('allocation_date', input.date);

      if (allocError) {
        ctx.logger.error('Error fetching allocations:', allocError);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch allocations',
        });
      }

      // Enhance trucks with capacity info and inventory
      const enhancedTrucks: TruckWithInventory[] = (trucks || []).map(truck => {
        // Get inventory for this truck
        const truckInventoryData = (allInventoryData || []).filter(item => item.truck_id === truck.id);
        
        const inventory = processTruckInventory(truckInventoryData);

        return {
          ...truck,
          capacity_kg: truck.capacity_cylinders * 27, // Calculate from capacity_cylinders
          status: truck.active ? 'active' : 'inactive', // Derive from active field
          inventory // Include inventory for proper capacity calculation
        };
      });

      const schedules = generateDailyTruckSchedule(enhancedTrucks, allocations || [], input.date);
      const fleetUtilization = calculateFleetUtilization(schedules);
      
      return {
        schedules,
        fleet_utilization: fleetUtilization
      };
    }),

  optimizeAllocations: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/trucks/optimize-allocations',
        tags: ['trucks'],
        summary: 'Optimize truck allocations',
        description: 'Optimize truck allocations for multiple orders to maximize efficiency and minimize costs.',
        protect: true,
      }
    })
    .input(OptimizeAllocationsSchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Optimizing truck allocations for orders:', input.order_ids.length);
      
      // Get orders
      const { data: orders, error: ordersError } = await ctx.supabase
        .from('orders')
        .select('*')
        .in('id', input.order_ids);

      if (ordersError) {
        ctx.logger.error('Error fetching orders:', ordersError);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch orders',
        });
      }

      // Get order lines to calculate weights
      const { data: orderLines, error: linesError } = await ctx.supabase
        .from('order_lines')
        .select('*')
        .in('order_id', input.order_ids);

      if (linesError) {
        ctx.logger.error('Error fetching order lines:', linesError);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch order lines',
        });
      }

      // Get products for weight calculation
      const productIds = [...new Set(orderLines?.map(line => line.product_id) || [])];
      const { data: products, error: productsError } = await ctx.supabase
        .from('products')
        .select('id, name, sku, is_variant, variant_name, parent_product_id, capacity_kg, tare_weight_kg')
        .in('id', productIds);

      if (productsError) {
        ctx.logger.error('Error fetching products:', productsError);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch products',
        });
      }

      // Calculate weights for each order
      const orderWeights = new Map<string, number>();
      for (const order of orders || []) {
        const orderLinesForOrder = orderLines?.filter(line => line.order_id === order.id) || [];
        const { total_weight_kg } = calculateOrderWeight(orderLinesForOrder, products || []);
        orderWeights.set(order.id, total_weight_kg);
      }

      // Get trucks
      const { data: trucks, error: trucksError } = await ctx.supabase
        .from('truck')
        .select(`
          *,
          driver:driver_id (
            id,
            name,
            email,
            phone
          )
        `)
        .eq('active', true);

      if (trucksError) {
        ctx.logger.error('Error fetching trucks:', trucksError);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch trucks',
        });
      }

      // Enhance trucks with capacity info
      const enhancedTrucks: TruckWithInventory[] = (trucks || []).map(truck => ({
        ...truck,
        capacity_kg: truck.capacity_cylinders * 27, // Calculate from capacity_cylinders
        status: truck.active ? 'active' : 'inactive' // Derive from active field
      }));

      const result = optimizeTruckAllocations(
        orders || [],
        orderWeights,
        enhancedTrucks,
        input.target_date
      );
      
      return result;
    }),

  // CAPACITY VALIDATION ENDPOINT
  validateLoadingCapacity: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/trucks/{truck_id}/validate-loading-capacity',
        tags: ['trucks'],
        summary: 'Validate truck loading capacity',
        description: 'Validate if a truck can accommodate the specified items without exceeding capacity constraints.',
        protect: true,
      }
    })
    .input(ValidateLoadingCapacitySchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Validating truck loading capacity:', input);

      // Get truck details with current inventory
      const { data: truck, error: truckError } = await ctx.supabase
        .from('truck')
        .select(`
          id, 
          fleet_number, 
          license_plate, 
          capacity_cylinders, 
          capacity_kg, 
          active, 
          driver_id,
          driver:driver_id (
            id,
            name,
            email,
            phone
          )
        `)
        .eq('id', input.truck_id)
        .single();

      if (truckError || !truck) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Truck not found',
        });
      }

      // Get current truck inventory
      const { data: inventoryData } = await ctx.supabase
        .from('truck_inventory')
        .select(`
          *,
          product:product_id (
            name,
            sku,
            variant_name,
            capacity_kg,
            tare_weight_kg
          )
        `)
        .eq('truck_id', input.truck_id);

      // Process inventory with weight calculations
      const inventory = processTruckInventory(inventoryData);

      const truckWithInventory: TruckWithInventory = {
        ...truck,
        capacity_kg: truck.capacity_kg || (truck.capacity_cylinders * 27),
        status: truck.active ? 'active' : 'inactive',
        inventory
      };

      // Validate capacity constraints
      const validationResult = validateTruckLoadingCapacity(truckWithInventory, input.items);
      
      return {
        ...validationResult,
        truck: {
          id: truck.id,
          fleet_number: truck.fleet_number,
          license_plate: truck.license_plate,
          capacity_cylinders: truck.capacity_cylinders,
          capacity_kg: truck.capacity_kg || (truck.capacity_cylinders * 27)
        }
      };
    }),

  // Truck Inventory Transfer Endpoints
    loadInventory: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/trucks/{truck_id}/load-inventory',
        tags: ['trucks'],
        summary: 'Load truck inventory',
        description: 'Load inventory from warehouse to truck with atomic transfer validation and comprehensive logging.',
        protect: true,
      }
    })
    .input(LoadInventorySchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
        const user = requireAuth(ctx);
      
      ctx.logger.info('Loading truck inventory:', input);

      // Validate truck exists and is active
      const { data: truck, error: truckError } = await ctx.supabase
        .from('truck')
        .select(`
          id, 
          fleet_number, 
          license_plate, 
          capacity_cylinders, 
          capacity_kg, 
          active, 
          driver_id,
          driver:driver_id (
            id,
            name,
            email,
            phone
          )
        `)
        .eq('id', input.truck_id)
        .single();

      if (truckError || !truck) {
        ctx.logger.error('Truck validation error for loading inventory:', {
          error: formatErrorMessage(truckError),
          code: truckError?.code,
          details: truckError?.details,
          hint: truckError?.hint,
          user_id: user.id,
          truck_id: input.truck_id
        });
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Truck not found',
        });
      }

      if (!truck.active) {
        ctx.logger.error('Attempted to load inactive truck:', {
          user_id: user.id,
          truck_id: input.truck_id,
          fleet_number: truck.fleet_number,
          active: truck.active
        });
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot load inactive truck',
        });
      }

      // Validate warehouse exists
      const { data: warehouse, error: warehouseError } = await ctx.supabase
        .from('warehouses')
        .select('id, name')
        .eq('id', input.warehouse_id)
        .single();

      if (warehouseError || !warehouse) {
        ctx.logger.error('Warehouse validation error for truck loading:', {
          error: formatErrorMessage(warehouseError),
          code: warehouseError?.code,
          details: warehouseError?.details,
          hint: warehouseError?.hint,
          user_id: user.id,
          warehouse_id: input.warehouse_id
        });
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Warehouse not found',
        });
      }

      // CRITICAL VALIDATION: Check truck capacity constraints before loading
      // Get current truck inventory for capacity validation
      const { data: inventoryData } = await ctx.supabase
        .from('truck_inventory')
        .select(`
          *,
          product:product_id (
            name,
            sku,
            variant_name,
            capacity_kg,
            tare_weight_kg
          )
        `)
        .eq('truck_id', input.truck_id);

      // Process inventory with weight calculations
      const inventory = processTruckInventory(inventoryData);

      const truckWithInventory: TruckWithInventory = {
        ...truck,
        capacity_kg: truck.capacity_kg || (truck.capacity_cylinders * 27), // Calculate from capacity_cylinders if not set
        status: truck.active ? 'active' : 'inactive', // Derive from active field
        inventory // Include actual inventory for capacity calculation
      };

      // Validate capacity constraints
      const validationResult = validateTruckLoadingCapacity(truckWithInventory, input.items);
      
      if (!validationResult.is_valid) {
        const errorMessage = `Truck loading capacity validation failed: ${validationResult.errors.join(', ')}`;
        ctx.logger.error('Truck loading capacity validation failed:', {
          loadingId: `load_${Date.now()}`,
          truckId: input.truck_id,
          fleetNumber: truck.fleet_number,
          capacityCheck: validationResult.capacity_check,
          errors: validationResult.errors,
          warnings: validationResult.warnings,
          user_id: user.id
        });
        
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: errorMessage,
        });
      }

      // Log warnings if any
      if (validationResult.warnings.length > 0) {
        ctx.logger.warn('Truck loading capacity warnings:', {
          truckId: input.truck_id,
          fleetNumber: truck.fleet_number,
          warnings: validationResult.warnings,
          capacityCheck: validationResult.capacity_check
        });
      }

      const results = [];
      const processedItems = [];
      let completedItems = 0;
      let failedItems = 0;
      
      // Enhanced logging for truck loading process
      const loadingId = `load_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
      ctx.logger.info(`[${loadingId}] 🚀 Starting truck loading process (CAPACITY VALIDATED)`, {
        loadingId,
        truckId: input.truck_id,
        warehouseId: input.warehouse_id,
        itemCount: input.items.length,
        truckFleetNumber: truck.fleet_number,
        warehouseName: warehouse.name,
        capacityCheck: validationResult.capacity_check,
        validationWarnings: validationResult.warnings
      });
      
      // Process each item using the atomic transfer function
      for (const [index, item] of input.items.entries()) {
        if (item.qty_full === 0 && item.qty_empty === 0) {
          ctx.logger.info(`[${loadingId}] ⏭️ Skipping empty item ${index + 1}/${input.items.length}`, {
            loadingId,
            productId: item.product_id,
            reason: 'zero_quantities'
          });
          continue; // Skip empty items
        }

        try {
          ctx.logger.info(`[${loadingId}] 🔄 Processing item ${index + 1}/${input.items.length}`, {
            loadingId,
            itemIndex: index + 1,
            totalItems: input.items.length,
            productId: item.product_id,
            qtyFull: item.qty_full,
            qtyEmpty: item.qty_empty
          });

          const { data: transferResult, error: transferError } = await ctx.supabase.rpc('transfer_stock_to_truck', {
            p_from_warehouse_id: input.warehouse_id,
            p_to_truck_id: input.truck_id,
            p_product_id: item.product_id,
            p_qty_full: item.qty_full,
            p_qty_empty: item.qty_empty,
          });

          if (transferError) {
            throw transferError;
          }

          if (!transferResult || !transferResult.success) {
            throw new Error(`Transfer function reported failure: ${transferResult?.error || 'Unknown error'}`);
          }

          results.push(transferResult);
          processedItems.push({
            ...item,
            success: true,
            transferResult
          });
          completedItems++;
          
          ctx.logger.info(`[${loadingId}] ✅ Item ${index + 1}/${input.items.length} transferred successfully`, {
            loadingId,
            productId: item.product_id,
            transferResult,
            completedSoFar: completedItems
          });
          
        } catch (error) {
          failedItems++;
          const errorMessage = formatErrorMessage(error);
          
          ctx.logger.error(`[${loadingId}] ❌ Item ${index + 1}/${input.items.length} transfer failed`, {
            loadingId,
            productId: item.product_id,
            error: errorMessage,
            failedSoFar: failedItems
          });

          processedItems.push({
            ...item,
            success: false,
            error: errorMessage
          });
          
          // Throw error to stop processing and rollback if needed
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to transfer ${item.product_id}: ${errorMessage}`,
          });
        }
      }
      
      // Verify all items were processed successfully
      if (failedItems > 0) {
        ctx.logger.error(`[${loadingId}] ❌ LOADING FAILED: ${failedItems} items failed out of ${input.items.length}`, {
          loadingId,
          totalItems: input.items.length,
          completedItems,
          failedItems,
          successRate: completedItems / input.items.length * 100
        });
        
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Truck loading failed: ${failedItems} of ${input.items.length} items failed to transfer`,
        });
      }

      // Final verification step - check database state
      const finalVerificationStart = Date.now();
      try {
        // Wait a brief moment for database consistency
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Verify truck inventory was updated
        const { data: updatedTruckInventory } = await ctx.supabase
          .from('truck_inventory')
          .select('product_id, qty_full, qty_empty')
          .eq('truck_id', input.truck_id)
          .in('product_id', input.items.map(item => item.product_id));
        
        // Verify warehouse inventory was decremented
        const { data: updatedWarehouseInventory } = await ctx.supabase
          .from('inventory_balance')
          .select('product_id, qty_full, qty_empty')
          .eq('warehouse_id', input.warehouse_id)
          .in('product_id', input.items.map(item => item.product_id));
        
        const verificationResults = input.items.map(item => {
          const truckItem = updatedTruckInventory?.find(inv => inv.product_id === item.product_id);
          const warehouseItem = updatedWarehouseInventory?.find(inv => inv.product_id === item.product_id);
          
          return {
            product_id: item.product_id,
            requested_full: item.qty_full,
            requested_empty: item.qty_empty,
            truck_inventory_exists: !!truckItem,
            warehouse_inventory_exists: !!warehouseItem,
            verification_passed: !!truckItem || (item.qty_full === 0 && item.qty_empty === 0)
          };
        });
        
        const verificationDuration = Date.now() - finalVerificationStart;
        
        ctx.logger.info(`[${loadingId}] 🎉 TRUCK LOADING COMPLETED SUCCESSFULLY`, {
          loadingId,
          truckId: input.truck_id,
          warehouseId: input.warehouse_id,
          totalItems: input.items.length,
          completedItems,
          failedItems,
          successRate: 100,
          verificationResults,
          verificationDuration,
          totalDuration: Date.now() - parseInt(loadingId.split('_')[1])
        });
        
        return {
          success: true,
          truck_id: input.truck_id,
          warehouse_id: input.warehouse_id,
          items_transferred: completedItems,
          total_items_requested: input.items.length,
          loading_id: loadingId,
          verification: {
            passed: verificationResults.every(v => v.verification_passed),
            details: verificationResults,
            duration_ms: verificationDuration
          },
          results,
          processedItems,
          timestamp: new Date().toISOString(),
          truck_fleet_number: truck.fleet_number,
          warehouse_name: warehouse.name
        };
        
      } catch (verificationError) {
        ctx.logger.error(`[${loadingId}] ⚠️ VERIFICATION FAILED (but transfer may have succeeded)`, {
          loadingId,
          verificationError: formatErrorMessage(verificationError),
          completedItems,
          totalItems: input.items.length
        });
        
        // Return success but with verification warning
        return {
          success: true,
          truck_id: input.truck_id,
          warehouse_id: input.warehouse_id,
          items_transferred: completedItems,
          total_items_requested: input.items.length,
          loading_id: loadingId,
          verification: {
            passed: false,
            error: formatErrorMessage(verificationError),
            warning: 'Transfer completed but post-transfer verification failed'
          },
          results,
          processedItems,
          timestamp: new Date().toISOString(),
          truck_fleet_number: truck.fleet_number,
          warehouse_name: warehouse.name
        };
      }
    }),

  unloadInventory: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/trucks/{truck_id}/unload-inventory',
        tags: ['trucks'],
        summary: 'Unload truck inventory',
        description: 'Unload inventory from truck to warehouse with transfer validation and tracking.',
        protect: true,
      }
    })
    .input(UnloadInventorySchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Unloading truck inventory:', input);

      // Validate truck exists and is active
      const { data: truck, error: truckError } = await ctx.supabase
        .from('truck')
        .select('id, fleet_number, active')
        .eq('id', input.truck_id)
        .single();

      if (truckError || !truck) {
        ctx.logger.error('Truck validation error for unloading inventory:', {
          error: formatErrorMessage(truckError),
          code: truckError?.code,
          details: truckError?.details,
          hint: truckError?.hint,
          user_id: user.id,
          truck_id: input.truck_id
        });
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Truck not found',
        });
      }

      if (!truck.active) {
        ctx.logger.error('Attempted to unload inactive truck:', {
          user_id: user.id,
          truck_id: input.truck_id,
          fleet_number: truck.fleet_number,
          active: truck.active
        });
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot unload inactive truck',
        });
      }

      // Validate warehouse exists
      const { data: warehouse, error: warehouseError } = await ctx.supabase
        .from('warehouses')
        .select('id, name')
        .eq('id', input.warehouse_id)
        .single();

      if (warehouseError || !warehouse) {
        ctx.logger.error('Warehouse validation error for truck unloading:', {
          error: formatErrorMessage(warehouseError),
          code: warehouseError?.code,
          details: warehouseError?.details,
          hint: warehouseError?.hint,
          user_id: user.id,
          warehouse_id: input.warehouse_id
        });
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Warehouse not found',
        });
      }

      const results = [];
      
      // Process each item using the atomic transfer function
      for (const item of input.items) {
        if (item.qty_full === 0 && item.qty_empty === 0) {
          continue; // Skip empty items
        }

        try {
          const { data: transferResult, error: transferError } = await ctx.supabase.rpc('transfer_stock_from_truck', {
            p_from_truck_id: input.truck_id,
            p_to_warehouse_id: input.warehouse_id,
            p_product_id: item.product_id,
            p_qty_full: item.qty_full,
            p_qty_empty: item.qty_empty,
          });

          if (transferError) {
            throw transferError;
          }

          results.push(transferResult);
          ctx.logger.info('Item transferred successfully:', transferResult);
        } catch (error) {
          const errorMessage = formatErrorMessage(error);
          ctx.logger.error('Item transfer failed:', {
            error: errorMessage,
            user_id: user.id,
            truck_id: input.truck_id,
            warehouse_id: input.warehouse_id,
            item: {
              product_id: item.product_id,
              qty_full: item.qty_full,
              qty_empty: item.qty_empty
            }
          });
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to transfer ${item.product_id}: ${errorMessage}`,
          });
        }
      }

      ctx.logger.info('Truck unloading completed successfully');
      return {
        success: true,
        truck_id: input.truck_id,
        warehouse_id: input.warehouse_id,
        items_transferred: results.length,
        results
      };
    }),

  // GET /trucks/{truck_id}/inventory - Get truck current inventory
  getInventory: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/trucks/{truck_id}/inventory',
        tags: ['trucks'],
        summary: 'Get truck inventory',
        description: 'Retrieve current inventory status for a truck with capacity utilization and product details.',
        protect: true,
      }
    })
    .input(GetInventorySchema)
    .output(z.any())
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Fetching truck inventory:', { truck_id: input.truck_id });
      
      // Validate truck exists
      const { data: truck, error: truckError } = await ctx.supabase
        .from('truck')
        .select('id, fleet_number, license_plate, active, capacity_cylinders')
        .eq('id', input.truck_id)
        .single();

      if (truckError || !truck) {
        ctx.logger.error('Truck not found for inventory fetch:', {
          error: formatErrorMessage(truckError),
          truck_id: input.truck_id,
          user_id: user.id
        });
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Truck not found',
        });
      }

      // Build inventory query with optional product details
      let inventoryQuery = ctx.supabase
        .from('truck_inventory')
        .select(input.include_product_details 
          ? `
            id,
            truck_id,
            product_id,
            qty_full,
            qty_empty,
            qty_reserved,
            created_at,
            updated_at,
            product:product_id (
              id,
              name,
              sku,
              variant_name,
              capacity_kg,
              tare_weight_kg,
              unit_of_measure,
              status
            )
          `
          : `
            id,
            truck_id,
            product_id,
            qty_full,
            qty_empty,
            qty_reserved,
            created_at,
            updated_at
          `
        )
        .eq('truck_id', input.truck_id)
        .order('updated_at', { ascending: false });

      const { data: inventoryData, error: inventoryError } = await inventoryQuery;

      if (inventoryError) {
        ctx.logger.error('Error fetching truck inventory:', {
          error: formatErrorMessage(inventoryError),
          truck_id: input.truck_id,
          user_id: user.id
        });
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to fetch truck inventory: ${formatErrorMessage(inventoryError)}`,
        });
      }

      // Process inventory data and calculate weights
      const inventory = (inventoryData || []).map((item: any) => {
        const product = item.product;
        let weight_kg = 0;
        let total_cylinders = item.qty_full + item.qty_empty;
        const qty_reserved = item.qty_reserved || 0;
        const qty_available = item.qty_full - qty_reserved;
        
        if (product && product.capacity_kg && product.tare_weight_kg) {
          weight_kg = (item.qty_full * (product.capacity_kg + product.tare_weight_kg)) +
                     (item.qty_empty * product.tare_weight_kg);
        }

        const inventoryItem: any = {
          id: item.id,
          product_id: item.product_id,
          qty_full: item.qty_full,
          qty_empty: item.qty_empty,
          qty_reserved: qty_reserved,
          qty_available: qty_available,
          total_cylinders,
          weight_kg,
          updated_at: item.updated_at
        };

        if (input.include_product_details && product) {
          inventoryItem.product = {
            id: product.id,
            name: product.name,
            sku: product.sku,
            variant_name: product.variant_name,
            capacity_kg: product.capacity_kg,
            tare_weight_kg: product.tare_weight_kg,
            unit_of_measure: product.unit_of_measure,
            status: product.status
          };
        }

        return inventoryItem;
      });

      // Calculate summary statistics
      const totalFullCylinders = inventory.reduce((sum, item) => sum + item.qty_full, 0);
      const totalEmptyCylinders = inventory.reduce((sum, item) => sum + item.qty_empty, 0);
      const totalReservedCylinders = inventory.reduce((sum, item) => sum + item.qty_reserved, 0);
      const totalAvailableCylinders = inventory.reduce((sum, item) => sum + item.qty_available, 0);
      const totalCylinders = totalFullCylinders + totalEmptyCylinders;
      const totalWeightKg = inventory.reduce((sum, item) => sum + item.weight_kg, 0);
      const capacityUtilization = truck.capacity_cylinders > 0 
        ? (totalCylinders / truck.capacity_cylinders) * 100 
        : 0;

      const result = {
        truck: {
          id: truck.id,
          fleet_number: truck.fleet_number,
          license_plate: truck.license_plate,
          active: truck.active,
          capacity_cylinders: truck.capacity_cylinders,
          capacity_kg: truck.capacity_cylinders * 27 // Standard cylinder weight assumption
        },
        inventory: inventory,
        summary: {
          total_products: inventory.length,
          total_full_cylinders: totalFullCylinders,
          total_empty_cylinders: totalEmptyCylinders,
          total_reserved_cylinders: totalReservedCylinders,
          total_available_cylinders: totalAvailableCylinders,
          total_cylinders: totalCylinders,
          total_weight_kg: Math.round(totalWeightKg * 100) / 100, // Round to 2 decimal places
          capacity_utilization_percent: Math.round(capacityUtilization * 100) / 100,
          is_overloaded: totalCylinders > truck.capacity_cylinders,
          last_updated: inventory.length > 0 ? inventory[0].updated_at : null
        },
        timestamp: new Date().toISOString()
      };

      ctx.logger.info('Truck inventory fetched successfully:', {
        truck_id: input.truck_id,
        inventory_items: result.inventory.length,
        total_cylinders: result.summary.total_cylinders,
        capacity_utilization: result.summary.capacity_utilization_percent
      });

      return result;
    }),

  // POST /trucks/{truck_id}/reserve - Reserve inventory on truck
  reserveInventory: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/trucks/{truck_id}/reserve',
        tags: ['trucks'],
        summary: 'Reserve inventory on truck',
        description: 'Reserve specific quantity of inventory on a truck for an order.',
        protect: true,
      }
    })
    .input(z.object({
      truck_id: z.string().uuid(),
      product_id: z.string().uuid(),
      quantity: z.number().positive(),
      order_id: z.string().uuid(),
    }))
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Reserving truck inventory:', input);
      
      const reservationService = new TruckReservationService(ctx.supabase, ctx.logger);
      
      try {
        const result = await reservationService.reserveInventory({
          ...input,
          user_id: user.id,
        });
        
        return result;
      } catch (error) {
        ctx.logger.error('Error reserving truck inventory:', error);
        throw error;
      }
    }),

  // POST /trucks/{truck_id}/release - Release reserved inventory on truck
  releaseReservation: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/trucks/{truck_id}/release',
        tags: ['trucks'],
        summary: 'Release reserved inventory on truck',
        description: 'Release previously reserved inventory on a truck.',
        protect: true,
      }
    })
    .input(z.object({
      truck_id: z.string().uuid(),
      product_id: z.string().uuid(),
      quantity: z.number().positive(),
      order_id: z.string().uuid(),
    }))
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Releasing truck inventory reservation:', input);
      
      const reservationService = new TruckReservationService(ctx.supabase, ctx.logger);
      
      try {
        const result = await reservationService.releaseReservation(
          input.truck_id,
          input.product_id,
          input.quantity,
          input.order_id,
          user.id
        );
        
        return result;
      } catch (error) {
        ctx.logger.error('Error releasing truck inventory reservation:', error);
        throw error;
      }
    }),

  // GET /trucks/{truck_id}/availability - Check truck inventory availability
  checkAvailability: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/trucks/{truck_id}/availability',
        tags: ['trucks'],
        summary: 'Check truck inventory availability',
        description: 'Check if a truck has sufficient available inventory for a specific product.',
        protect: true,
      }
    })
    .input(z.object({
      truck_id: z.string().uuid(),
      product_id: z.string().uuid(),
      quantity: z.number().positive(),
    }))
    .output(z.any())
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Checking truck inventory availability:', input);
      
      const reservationService = new TruckReservationService(ctx.supabase, ctx.logger);
      
      try {
        const result = await reservationService.checkAvailability(
          input.truck_id,
          input.product_id,
          input.quantity
        );
        
        return result;
      } catch (error) {
        ctx.logger.error('Error checking truck inventory availability:', error);
        throw error;
      }
    }),

});