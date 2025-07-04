import { z } from 'zod';
import { router, protectedProcedure } from '../lib/trpc';
import { requireTenantAccess } from '../lib/auth';
import { TRPCError } from '@trpc/server';
import {
  calculateOrderWeight,
  calculateTruckCapacity,
  findBestTruckForOrder,
  validateTruckAllocation,
  generateDailyTruckSchedule,
  calculateFleetUtilization,
  optimizeTruckAllocations,
  type TruckWithInventory,
  type TruckAllocation,
  type Order,
  type OrderLine,
  type Product
} from '../lib/truck-capacity';

// Validation schemas
const TruckStatusEnum = z.enum(['active', 'inactive', 'maintenance']);
const RouteStatusEnum = z.enum(['planned', 'in_progress', 'completed', 'cancelled']);
const AllocationStatusEnum = z.enum(['planned', 'loaded', 'delivered', 'cancelled']);
const MaintenanceTypeEnum = z.enum(['routine', 'repair', 'inspection', 'emergency']);
const MaintenanceStatusEnum = z.enum(['scheduled', 'in_progress', 'completed', 'cancelled']);

const CreateTruckSchema = z.object({
  fleet_number: z.string().min(1),
  license_plate: z.string().min(1),
  capacity_cylinders: z.number().positive(),
  capacity_kg: z.number().positive().optional(), // Not in database, for calculations only
  driver_name: z.string().optional(),
  active: z.boolean().default(true),
  status: TruckStatusEnum.default('active').optional(), // Not in database
  last_maintenance_date: z.string().optional(),
  next_maintenance_due: z.string().optional(),
  maintenance_interval_days: z.number().positive().optional(), // Not in database
  fuel_capacity_liters: z.number().positive().optional(),
  avg_fuel_consumption: z.number().positive().optional(),
});

const UpdateTruckSchema = z.object({
  id: z.string().uuid(),
  fleet_number: z.string().min(1).optional(),
  license_plate: z.string().min(1).optional(),
  capacity_cylinders: z.number().positive().optional(),
  capacity_kg: z.number().positive().optional(), // Not in database, for calculations only
  driver_name: z.string().optional(),
  active: z.boolean().optional(),
  status: TruckStatusEnum.optional(), // Not in database
  last_maintenance_date: z.string().optional(),
  next_maintenance_due: z.string().optional(),
  maintenance_interval_days: z.number().positive().optional(), // Not in database
  fuel_capacity_liters: z.number().positive().optional(),
  avg_fuel_consumption: z.number().positive().optional(),
});

const TruckFiltersSchema = z.object({
  search: z.string().optional(),
  status: TruckStatusEnum.optional(), // For frontend compatibility but not used in database query
  active: z.boolean().optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(50),
});

const CreateTruckRouteSchema = z.object({
  truck_id: z.string().uuid(),
  route_date: z.string(),
  planned_start_time: z.string().optional(),
  planned_end_time: z.string().optional(),
  total_distance_km: z.number().positive().optional(),
  estimated_duration_hours: z.number().positive().optional(),
});

const UpdateTruckRouteSchema = z.object({
  id: z.string().uuid(),
  actual_start_time: z.string().optional(),
  actual_end_time: z.string().optional(),
  route_status: RouteStatusEnum.optional(),
  actual_duration_hours: z.number().positive().optional(),
  fuel_used_liters: z.number().positive().optional(),
});

const TruckAllocationSchema = z.object({
  truck_id: z.string().uuid(),
  order_id: z.string().uuid(),
  allocation_date: z.string(),
  estimated_weight_kg: z.number().positive(),
  stop_sequence: z.number().positive().optional(),
});

const UpdateTruckAllocationSchema = z.object({
  id: z.string().uuid(),
  status: AllocationStatusEnum.optional(),
  stop_sequence: z.number().positive().optional(),
});

const CreateMaintenanceSchema = z.object({
  truck_id: z.string().uuid(),
  maintenance_type: MaintenanceTypeEnum,
  scheduled_date: z.string(),
  description: z.string().min(1),
  cost: z.number().positive().optional(),
  mechanic: z.string().optional(),
});

const UpdateMaintenanceSchema = z.object({
  id: z.string().uuid(),
  completed_date: z.string().optional(),
  status: MaintenanceStatusEnum.optional(),
  cost: z.number().positive().optional(),
  mechanic: z.string().optional(),
});

export const trucksRouter = router({
  // GET /trucks - List trucks with optional filters
  list: protectedProcedure
    .input(TruckFiltersSchema)
    .query(async ({ input, ctx }) => {
      const user = requireTenantAccess(ctx);
      
      ctx.logger.info('Fetching trucks with filters:', input);
      
      let query = ctx.supabase
        .from('truck')
        .select('*', { count: 'exact' })
        .order('fleet_number');

      // Apply search filter
      if (input.search) {
        query = query.or(`fleet_number.ilike.%${input.search}%,license_plate.ilike.%${input.search}%,driver_name.ilike.%${input.search}%`);
      }

      // Apply status filter using active field (status doesn't exist in database)
      if (input.status) {
        if (input.status === 'active') {
          query = query.eq('active', true);
        } else if (input.status === 'inactive') {
          query = query.eq('active', false);
        }
        // maintenance status would need additional logic if needed
      }

      // Apply active filter
      if (input.active !== undefined) {
        query = query.eq('active', input.active);
      }

      // Apply pagination
      const from = (input.page - 1) * input.limit;
      const to = from + input.limit - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) {
        ctx.logger.error('Error fetching trucks:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch trucks',
        });
      }

      // Enhance trucks with calculated fields
      const enhancedTrucks = (data || []).map(truck => ({
        ...truck,
        capacity_kg: truck.capacity_cylinders * 27, // Calculate from capacity_cylinders
        status: truck.active ? 'active' : 'inactive', // Derive from active field
      }));

      return {
        trucks: enhancedTrucks,
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / input.limit),
        currentPage: input.page,
      };
    }),

  // GET /trucks/:id - Get truck with inventory
  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const user = requireTenantAccess(ctx);
      
      ctx.logger.info('Fetching truck:', input.id);
      
      // Get truck
      const { data: truck, error: truckError } = await ctx.supabase
        .from('truck')
        .select('*')
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
      const inventory = (inventoryData || []).map((item: any) => {
        const product = item.product;
        let weight_kg = 0;
        
        if (product && product.capacity_kg && product.tare_weight_kg) {
          weight_kg = (item.qty_full * (product.capacity_kg + product.tare_weight_kg)) +
                     (item.qty_empty * product.tare_weight_kg);
        }

        return {
          product_id: item.product_id,
          product_name: product?.name || 'Unknown Product',
          product_sku: product?.sku || '',
          product_variant_name: product?.variant_name,
          qty_full: item.qty_full,
          qty_empty: item.qty_empty,
          weight_kg,
          updated_at: item.updated_at
        };
      });

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
    .input(CreateTruckSchema)
    .mutation(async ({ input, ctx }) => {
      const user = requireTenantAccess(ctx);
      
      ctx.logger.info('Creating truck:', input);
      
      // Only include columns that exist in the database
      const truckData = {
        fleet_number: input.fleet_number,
        license_plate: input.license_plate,
        capacity_cylinders: input.capacity_cylinders,
        driver_name: input.driver_name || null,
        active: input.active,
        user_id: null, // Set to null since admin users don't exist in users table
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
        ctx.logger.error('Error creating truck:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create truck',
        });
      }

      return data;
    }),

  // PUT /trucks/:id - Update truck
  update: protectedProcedure
    .input(UpdateTruckSchema)
    .mutation(async ({ input, ctx }) => {
      const user = requireTenantAccess(ctx);
      
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
        ctx.logger.error('Error updating truck:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update truck',
        });
      }

      return data;
    }),

  // DELETE /trucks/:id - Delete truck
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const user = requireTenantAccess(ctx);
      
      ctx.logger.info('Deleting truck:', input.id);
      
      const { error } = await ctx.supabase
        .from('truck')
        .delete()
        .eq('id', input.id)
        ;

      if (error) {
        ctx.logger.error('Error deleting truck:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to delete truck',
        });
      }

      return { success: true };
    }),

  // Truck Capacity Management
  getAllocations: protectedProcedure
    .input(z.object({ 
      date: z.string().optional(),
      truck_id: z.string().uuid().optional(),
    }))
    .query(async ({ input, ctx }) => {
      const user = requireTenantAccess(ctx);
      
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
        ctx.logger.error('Error fetching truck allocations:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch truck allocations',
        });
      }

      return data || [];
    }),

  // POST /trucks/allocations - Allocate order to truck
  allocateOrder: protectedProcedure
    .input(TruckAllocationSchema)
    .mutation(async ({ input, ctx }) => {
      const user = requireTenantAccess(ctx);
      
      ctx.logger.info('Creating truck allocation:', input);
      
      const { data, error } = await ctx.supabase
        .from('truck_allocations')
        .insert([{
          ...input,
          
          status: 'planned',
          created_at: new Date().toISOString(),
        }])
        .select()
        .single();

      if (error) {
        ctx.logger.error('Error creating truck allocation:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to allocate order to truck',
        });
      }

      return data;
    }),

  // PUT /trucks/allocations/:id - Update allocation
  updateAllocation: protectedProcedure
    .input(UpdateTruckAllocationSchema)
    .mutation(async ({ input, ctx }) => {
      const user = requireTenantAccess(ctx);
      
      const { id, ...updateData } = input;
      
      ctx.logger.info('Updating truck allocation:', id, updateData);
      
      const { data, error } = await ctx.supabase
        .from('truck_allocations')
        .update(updateData)
        .eq('id', id)
        
        .select()
        .single();

      if (error) {
        ctx.logger.error('Error updating truck allocation:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update truck allocation',
        });
      }

      return data;
    }),

  // Truck Routes Management
  getRoutes: protectedProcedure
    .input(z.object({ 
      truck_id: z.string().uuid().optional(),
      date: z.string().optional(),
    }))
    .query(async ({ input, ctx }) => {
      const user = requireTenantAccess(ctx);
      
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
        ctx.logger.error('Error fetching truck routes:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch truck routes',
        });
      }

      return data || [];
    }),

  // POST /trucks/routes - Create route
  createRoute: protectedProcedure
    .input(CreateTruckRouteSchema)
    .mutation(async ({ input, ctx }) => {
      const user = requireTenantAccess(ctx);
      
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
        ctx.logger.error('Error creating truck route:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create truck route',
        });
      }

      return data;
    }),

  // PUT /trucks/routes/:id - Update route
  updateRoute: protectedProcedure
    .input(UpdateTruckRouteSchema)
    .mutation(async ({ input, ctx }) => {
      const user = requireTenantAccess(ctx);
      
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
        ctx.logger.error('Error updating truck route:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update truck route',
        });
      }

      return data;
    }),

  // Truck Maintenance Management
  getMaintenance: protectedProcedure
    .input(z.object({ truck_id: z.string().uuid().optional() }))
    .query(async ({ input, ctx }) => {
      const user = requireTenantAccess(ctx);
      
      let query = ctx.supabase
        .from('truck_maintenance')
        .select('*')
        
        .order('scheduled_date', { ascending: false });

      if (input.truck_id) {
        query = query.eq('truck_id', input.truck_id);
      }

      const { data, error } = await query;

      if (error) {
        ctx.logger.error('Error fetching truck maintenance:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch truck maintenance records',
        });
      }

      return data || [];
    }),

  // POST /trucks/maintenance - Schedule maintenance
  scheduleMaintenance: protectedProcedure
    .input(CreateMaintenanceSchema)
    .mutation(async ({ input, ctx }) => {
      const user = requireTenantAccess(ctx);
      
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
        ctx.logger.error('Error scheduling truck maintenance:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to schedule truck maintenance',
        });
      }

      return data;
    }),

  // PUT /trucks/maintenance/:id - Update maintenance
  updateMaintenance: protectedProcedure
    .input(UpdateMaintenanceSchema)
    .mutation(async ({ input, ctx }) => {
      const user = requireTenantAccess(ctx);
      
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
        ctx.logger.error('Error updating truck maintenance:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update truck maintenance',
        });
      }

      return data;
    }),

  // Truck Capacity Calculation Endpoints
  calculateOrderWeight: protectedProcedure
    .input(z.object({
      order_lines: z.array(z.object({
        id: z.string(),
        order_id: z.string(),
        product_id: z.string(),
        quantity: z.number(),
        unit_price: z.number()
      })),
      product_ids: z.array(z.string()).optional()
    }))
    .mutation(async ({ input, ctx }) => {
      const user = requireTenantAccess(ctx);
      
      ctx.logger.info('Calculating order weight for order lines:', input.order_lines.length);
      
      // Get product details for weight calculation
      const productIds = input.product_ids || input.order_lines.map(line => line.product_id);
      
      const { data: products, error } = await ctx.supabase
        .from('products')
        .select('id, name, sku, is_variant, variant_name, parent_product_id, capacity_kg, tare_weight_kg')
        .in('id', productIds);

      if (error) {
        ctx.logger.error('Error fetching products for weight calculation:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch product data',
        });
      }

      const result = calculateOrderWeight(input.order_lines as OrderLine[], products || []);
      
      return result;
    }),

  calculateCapacity: protectedProcedure
    .input(z.object({
      truck_id: z.string().uuid(),
      date: z.string()
    }))
    .query(async ({ input, ctx }) => {
      const user = requireTenantAccess(ctx);
      
      ctx.logger.info('Calculating truck capacity:', input.truck_id, input.date);
      
      // Get truck details
      const { data: truck, error: truckError } = await ctx.supabase
        .from('truck')
        .select('*')
        .eq('id', input.truck_id)
        .single();

      if (truckError || !truck) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Truck not found',
        });
      }

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

      const truckWithCapacity: TruckWithInventory = {
        ...truck,
        capacity_kg: truck.capacity_cylinders * 27, // Calculate from capacity_cylinders
        status: truck.active ? 'active' : 'inactive' // Derive from active field
      };

      const result = calculateTruckCapacity(truckWithCapacity, allocations || [], input.date);
      
      return result;
    }),

  findBestAllocation: protectedProcedure
    .input(z.object({
      order_id: z.string().uuid(),
      order_weight: z.number(),
      target_date: z.string()
    }))
    .mutation(async ({ input, ctx }) => {
      const user = requireTenantAccess(ctx);
      
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
        .select('*')
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
    .input(z.object({
      truck_id: z.string().uuid(),
      order_id: z.string().uuid(),
      order_weight: z.number(),
      target_date: z.string()
    }))
    .mutation(async ({ input, ctx }) => {
      const user = requireTenantAccess(ctx);
      
      ctx.logger.info('Validating truck allocation:', input.truck_id, input.order_id);
      
      // Get truck details
      const { data: truck, error: truckError } = await ctx.supabase
        .from('truck')
        .select('*')
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
    .input(z.object({
      date: z.string()
    }))
    .query(async ({ input, ctx }) => {
      const user = requireTenantAccess(ctx);
      
      ctx.logger.info('Generating daily truck schedule for:', input.date);
      
      // Get all trucks
      const { data: trucks, error: trucksError } = await ctx.supabase
        .from('truck')
        .select('*')
        .order('fleet_number');

      if (trucksError) {
        ctx.logger.error('Error fetching trucks:', trucksError);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch trucks',
        });
      }

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

      // Enhance trucks with capacity info
      const enhancedTrucks: TruckWithInventory[] = (trucks || []).map(truck => ({
        ...truck,
        capacity_kg: truck.capacity_cylinders * 27, // Calculate from capacity_cylinders
        status: truck.active ? 'active' : 'inactive' // Derive from active field
      }));

      const schedules = generateDailyTruckSchedule(enhancedTrucks, allocations || [], input.date);
      const fleetUtilization = calculateFleetUtilization(schedules);
      
      return {
        schedules,
        fleet_utilization: fleetUtilization
      };
    }),

  optimizeAllocations: protectedProcedure
    .input(z.object({
      order_ids: z.array(z.string().uuid()),
      target_date: z.string()
    }))
    .mutation(async ({ input, ctx }) => {
      const user = requireTenantAccess(ctx);
      
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
        .select('*')
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
});