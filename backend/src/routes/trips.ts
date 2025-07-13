import { z } from 'zod';
import { router, protectedProcedure } from '../lib/trpc';
import { requireAuth } from '../lib/auth';
import { TRPCError } from '@trpc/server';
import { formatErrorMessage } from '../lib/logger';

// Import trip-related input schemas
import {
  // Trip lifecycle schemas
  CreateTripSchema,
  UpdateTripStatusSchema,
  GetTripByIdSchema,
  GetTripsSchema,
  AllocateOrdersToTripSchema,
  RemoveOrderFromTripSchema,
  // Trip loading schemas
  StartTripLoadingSchema,
  GetTripLoadingSummarySchema,
  CheckShortLoadingSchema,
  RecordLoadingDetailSchema,
  CompleteTripSchema,
  ValidateTripLoadingCapacitySchema,
  CheckTripProductAvailabilitySchema,
} from '../schemas/input/trucks-input';

export const tripsRouter = router({
  // ============ Trip Query Operations ============

  // GET /trips - List trips with filters
  list: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/trips',
        tags: ['trips'],
        summary: 'List trips with filters',
        description: 'Get paginated list of trips with optional filtering and sorting',
        protect: true,
      }
    })
    .input(GetTripsSchema)
    .output(z.any())
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Listing trips with filters:', input);
      
      let query = ctx.supabase
        .from('truck_routes')
        .select(`
          *,
          truck:truck_id (
            id,
            fleet_number,
            license_plate,
            capacity_cylinders,
            capacity_kg,
            driver_name
          )
        `)
        .order(input.sort_by || 'created_at', {
          ascending: input.sort_order === 'asc'
        });
      
      // Apply filters
      if (input.search) {
        query = query.or(`route_status.ilike.%${input.search}%,notes.ilike.%${input.search}%`);
      }
      
      if (input.status) {
        query = query.eq('route_status', input.status);
      }
      
      if (input.truck_id) {
        query = query.eq('truck_id', input.truck_id);
      }
      
      if (input.date_from) {
        query = query.gte('route_date', input.date_from);
      }
      
      if (input.date_to) {
        query = query.lte('route_date', input.date_to);
      }
      
      // Count total records
      const { count } = await ctx.supabase
        .from('truck_routes')
        .select('*', { count: 'exact', head: true });
      
      // Apply pagination
      const page = input.page || 1;
      const limit = input.limit || 15;
      const offset = (page - 1) * limit;
      
      const { data: trips, error } = await query
        .range(offset, offset + limit - 1);
      
      if (error) {
        ctx.logger.error('Error fetching trips:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to fetch trips: ${formatErrorMessage(error)}`,
        });
      }
      
      const totalCount = count || 0;
      const totalPages = Math.ceil(totalCount / limit);
      
      return {
        trips: trips || [],
        currentPage: page,
        totalPages,
        totalCount,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      };
    }),

  // GET /trips/{id} - Get trip by ID
  get: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/trips/{id}',
        tags: ['trips'],
        summary: 'Get trip by ID',
        description: 'Get detailed information about a specific trip',
        protect: true,
      }
    })
    .input(GetTripByIdSchema)
    .output(z.any())
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Getting trip by ID:', input.id);
      
      const { data: trip, error } = await ctx.supabase
        .from('truck_routes')
        .select(`
          *,
          truck:truck_id (
            id,
            fleet_number,
            license_plate,
            capacity_cylinders,
            capacity_kg,
            driver_name
          ),
          truck_allocations (
            id,
            order_id,
            stop_sequence,
            status,
            estimated_weight_kg,
            actual_weight_kg,
            order:order_id (
              id,
              order_number,
              total_amount,
              customer:customer_id (
                id,
                name,
                email
              ),
              delivery_address:delivery_address_id (
                line1,
                city,
                state,
                postal_code
              )
            )
          )
        `)
        .eq('id', input.id)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Trip not found',
          });
        }
        
        ctx.logger.error('Error fetching trip:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to fetch trip: ${formatErrorMessage(error)}`,
        });
      }
      
      return trip;
    }),

  // GET /trips/{id}/timeline - Get trip timeline
  getTimeline: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/trips/{id}/timeline',
        tags: ['trips'],
        summary: 'Get trip timeline',
        description: 'Get chronological timeline of trip events and status changes',
        protect: true,
      }
    })
    .input(z.object({ trip_id: z.string() }))
    .output(z.any())
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Getting trip timeline:', input.trip_id);
      
      // For now, return basic timeline from truck_routes timestamps
      const { data: trip, error } = await ctx.supabase
        .from('truck_routes')
        .select('*')
        .eq('id', input.trip_id)
        .single();
      
      if (error) {
        ctx.logger.error('Error fetching trip for timeline:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to fetch trip timeline: ${formatErrorMessage(error)}`,
        });
      }
      
      const timeline = [];
      
      if (trip.created_at) {
        timeline.push({
          id: '1',
          event: 'Trip Created',
          timestamp: trip.created_at,
          status: 'planned',
          user_name: 'System',
          details: 'Trip was created and is ready for planning'
        });
      }
      
      if (trip.load_started_at) {
        timeline.push({
          id: '2',
          event: 'Loading Started',
          timestamp: trip.load_started_at,
          status: 'loading',
          user_name: 'Driver',
          details: 'Truck loading process has begun'
        });
      }
      
      if (trip.load_completed_at) {
        timeline.push({
          id: '3',
          event: 'Loading Completed',
          timestamp: trip.load_completed_at,
          status: 'loaded',
          user_name: 'Driver',
          details: 'Truck loading has been completed'
        });
      }
      
      if (trip.actual_start_time) {
        timeline.push({
          id: '4',
          event: 'Trip Departed',
          timestamp: trip.actual_start_time,
          status: 'in_transit',
          user_name: 'Driver',
          details: 'Truck has departed for deliveries'
        });
      }
      
      if (trip.actual_end_time) {
        timeline.push({
          id: '5',
          event: 'Trip Completed',
          timestamp: trip.actual_end_time,
          status: 'completed',
          user_name: 'Driver',
          details: 'Trip has been completed successfully'
        });
      }
      
      return {
        trip_id: input.trip_id,
        timeline: timeline.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      };
    }),

  // GET /trips/{id}/capacity - Get trip capacity info
  getCapacity: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/trips/{id}/capacity',
        tags: ['trips'],
        summary: 'Get trip capacity information',
        description: 'Get detailed capacity utilization and loading information for a trip',
        protect: true,
      }
    })
    .input(z.object({ trip_id: z.string() }))
    .output(z.any())
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Getting trip capacity info:', input.trip_id);
      
      // Get trip with truck info
      const { data: trip, error: tripError } = await ctx.supabase
        .from('truck_routes')
        .select(`
          *,
          truck:truck_id (
            capacity_cylinders,
            capacity_kg
          )
        `)
        .eq('id', input.trip_id)
        .single();
      
      if (tripError) {
        ctx.logger.error('Error fetching trip:', tripError);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to fetch trip: ${formatErrorMessage(tripError)}`,
        });
      }
      
      // Get loading details
      const { data: loadingDetails } = await ctx.supabase
        .from('trip_loading_details')
        .select('*')
        .eq('trip_id', input.trip_id);
      
      // Calculate capacity utilization
      const totalLoadedCylinders = (loadingDetails || []).reduce((sum, item) => {
        return sum + (item.loaded_qty_full || 0) + (item.loaded_qty_empty || 0);
      }, 0);
      
      const totalLoadedWeight = (loadingDetails || []).reduce((sum, item) => {
        return sum + (item.loaded_weight_kg || 0);
      }, 0);
      
      const cylinderUtilization = trip.truck?.capacity_cylinders 
        ? (totalLoadedCylinders / trip.truck.capacity_cylinders) * 100 
        : 0;
      
      const weightUtilization = trip.truck?.capacity_kg 
        ? (totalLoadedWeight / trip.truck.capacity_kg) * 100 
        : 0;
      
      return {
        trip_id: input.trip_id,
        truck_capacity_cylinders: trip.truck?.capacity_cylinders || 0,
        truck_capacity_kg: trip.truck?.capacity_kg || 0,
        loaded_cylinders: totalLoadedCylinders,
        loaded_weight_kg: totalLoadedWeight,
        cylinder_utilization: cylinderUtilization,
        weight_utilization: weightUtilization,
        is_overloaded: cylinderUtilization > 100 || weightUtilization > 100,
        loading_details_count: (loadingDetails || []).length
      };
    }),

  // ============ Trip Lifecycle Operations ============

  // POST /trips - Create new trip
  createTrip: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/trips',
        tags: ['trips'],
        summary: 'Create new trip',
        description: 'Create a new trip for a truck with basic route information',
        protect: true,
      }
    })
    .input(CreateTripSchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Creating new trip:', input);
      
      const { data, error } = await ctx.supabase
        .from('truck_routes')
        .insert({
          truck_id: input.truck_id,
          route_date: input.route_date,
          warehouse_id: input.warehouse_id,
          driver_id: input.driver_id,
          planned_start_time: input.planned_start_time,
          planned_end_time: input.planned_end_time,
          trip_notes: input.trip_notes,
          route_status: 'planned',
          created_by_user_id: user.id,
        })
        .select('*')
        .single();

      if (error) {
        ctx.logger.error('Error creating trip:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to create trip: ${formatErrorMessage(error)}`,
        });
      }

      return data;
    }),

  // GET /trips/{id} - Get trip details
  getTripById: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/trips/{trip_id}',
        tags: ['trips'],
        summary: 'Get trip details',
        description: 'Get detailed information about a specific trip including loading details and variance records',
        protect: true,
      }
    })
    .input(GetTripByIdSchema)
    .output(z.any())
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Fetching trip details:', input.id);
      
      // Get trip details
      const { data: trip, error: tripError } = await ctx.supabase
        .from('truck_routes')
        .select(`
          *,
          truck:truck_id (id, fleet_number, license_plate, capacity_cylinders, capacity_kg),
          warehouse:warehouse_id (id, name, address),
          driver:driver_id (id, email)
        `)
        .eq('id', input.id)
        .single();

      if (tripError) {
        ctx.logger.error('Error fetching trip:', tripError);
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Trip not found: ${formatErrorMessage(tripError)}`,
        });
      }

      let result: any = trip;

      // Include loading details if requested
      if (input.include_loading_details) {
        const { data: loadingDetails, error: loadingError } = await ctx.supabase
          .from('trip_loading_details')
          .select(`
            *,
            product:product_id (name, sku)
          `)
          .eq('trip_id', input.id)
          .order('loading_sequence');

        if (!loadingError) {
          result.loading_details = loadingDetails;
          
          // Get loading summary
          const { data: loadingSummary } = await ctx.supabase.rpc('get_trip_loading_summary', {
            p_trip_id: input.id
          });
          
          if (loadingSummary && loadingSummary.length > 0) {
            result.loading_summary = loadingSummary[0];
          }
        }
      }

      // Include variance records if requested
      if (input.include_variance_records) {
        const { data: varianceRecords, error: varianceError } = await ctx.supabase
          .from('trip_variance_tracking')
          .select(`
            *,
            product:product_id (name, sku)
          `)
          .eq('trip_id', input.id);

        if (!varianceError) {
          result.variance_records = varianceRecords;
          
          // Get variance summary
          const { data: varianceSummary } = await ctx.supabase.rpc('get_trip_variance_summary', {
            p_trip_id: input.id
          });
          
          if (varianceSummary && varianceSummary.length > 0) {
            result.variance_summary = varianceSummary[0];
          }
        }
      }

      // Get trip allocations if details requested
      if (input.include_details) {
        const { data: allocations, error: allocError } = await ctx.supabase
          .from('truck_allocations')
          .select(`
            *,
            order:order_id (id, order_date, total_amount, customer_id)
          `)
          .eq('trip_id', input.id)
          .order('stop_sequence');

        if (!allocError) {
          result.allocations = allocations;
        }
      }

      return result;
    }),

  // GET /trips - List trips with filters
  getTrips: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/trips',
        tags: ['trips'],
        summary: 'List trips',
        description: 'Get a paginated list of trips with optional filtering',
        protect: true,
      }
    })
    .input(GetTripsSchema)
    .output(z.any())
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Fetching trips list:', input);
      
      let query = ctx.supabase
        .from('truck_routes')
        .select(`
          *,
          truck:truck_id (id, fleet_number, license_plate),
          warehouse:warehouse_id (id, name),
          driver:driver_id (id, email)
        `, { count: 'exact' });

      // Apply filters
      if (input.truck_id) {
        query = query.eq('truck_id', input.truck_id);
      }
      if (input.warehouse_id) {
        query = query.eq('warehouse_id', input.warehouse_id);
      }
      if (input.driver_id) {
        query = query.eq('driver_id', input.driver_id);
      }
      if (input.status) {
        query = query.eq('route_status', input.status);
      }
      if (input.date_from) {
        query = query.gte('route_date', input.date_from);
      }
      if (input.date_to) {
        query = query.lte('route_date', input.date_to);
      }

      // Apply pagination
      const offset = (input.page - 1) * input.limit;
      query = query.range(offset, offset + input.limit - 1);
      query = query.order('route_date', { ascending: false });

      const { data: trips, error, count } = await query;

      if (error) {
        ctx.logger.error('Error fetching trips:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to fetch trips: ${formatErrorMessage(error)}`,
        });
      }

      return {
        trips: trips || [],
        pagination: {
          page: input.page,
          limit: input.limit,
          total: count || 0,
          pages: Math.ceil((count || 0) / input.limit),
        },
      };
    }),

  // PUT /trips/{id}/status - Update trip status
  updateTripStatus: protectedProcedure
    .meta({
      openapi: {
        method: 'PUT',
        path: '/trips/{trip_id}/status',
        tags: ['trips'],
        summary: 'Update trip status',
        description: 'Update the status of a trip and track lifecycle timestamps',
        protect: true,
      }
    })
    .input(UpdateTripStatusSchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Updating trip status:', input);
      
      // Validate timestamp format if provided
      let timestamp: string;
      if (input.timestamp) {
        // Validate ISO 8601 format
        const iso8601Regex = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d{3})?Z?$/;
        if (!iso8601Regex.test(input.timestamp)) {
          ctx.logger.warn(`Invalid timestamp format provided: ${input.timestamp}, using current timestamp`);
          timestamp = new Date().toISOString();
        } else {
          // Additional validation - ensure the date is actually valid
          const parsedDate = new Date(input.timestamp);
          if (isNaN(parsedDate.getTime())) {
            ctx.logger.warn(`Invalid timestamp value provided: ${input.timestamp}, using current timestamp`);
            timestamp = new Date().toISOString();
          } else {
            timestamp = input.timestamp;
          }
        }
      } else {
        timestamp = new Date().toISOString();
      }
      
      const updateData: any = {
        route_status: input.status,
        updated_at: timestamp,
      };

      // Set appropriate timestamp based on status
      switch (input.status) {
        case 'loading':
          updateData.load_started_at = timestamp;
          break;
        case 'loaded':
          updateData.load_completed_at = timestamp;
          break;
        case 'in_transit':
          updateData.delivery_started_at = timestamp;
          updateData.actual_start_time = timestamp.split('T')[1];
          break;
        case 'delivering':
          // Keep delivery_started_at from in_transit
          break;
        case 'unloading':
          updateData.unload_started_at = timestamp;
          break;
        case 'completed':
          updateData.unload_completed_at = timestamp;
          updateData.actual_end_time = timestamp.split('T')[1];
          break;
      }

      if (input.notes) {
        updateData.trip_notes = input.notes;
      }

      const { data, error } = await ctx.supabase
        .from('truck_routes')
        .update(updateData)
        .eq('id', input.trip_id)
        .select('*')
        .single();

      if (error) {
        ctx.logger.error('Error updating trip status:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to update trip status: ${formatErrorMessage(error)}`,
        });
      }

      return {
        success: true,
        trip: data,
        message: `Trip status updated to ${input.status}`,
      };
    }),

  // POST /trips/{id}/allocations - Allocate orders to trip
  allocateOrdersToTrip: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/trips/{trip_id}/allocations',
        tags: ['trips'],
        summary: 'Allocate orders to trip',
        description: 'Allocate multiple orders to a trip with automatic sequencing',
        protect: true,
      }
    })
    .input(AllocateOrdersToTripSchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Allocating orders to trip:', input);
      
      const allocations = input.order_ids.map((orderId, index) => ({
        trip_id: input.trip_id,
        order_id: orderId,
        stop_sequence: input.auto_sequence ? index + 1 : null,
        status: 'planned',
        allocated_by_user_id: user.id,
        allocated_at: new Date().toISOString(),
        notes: input.notes,
      }));

      // Use a transaction to ensure atomicity and prevent race conditions
      const { data, error } = await ctx.supabase.rpc('allocate_orders_to_trip_safe', {
        p_trip_id: input.trip_id,
        p_order_ids: input.order_ids,
        p_allocated_by_user_id: user.id
      });

      // Fallback to direct upsert if the RPC function is not available
      // TODO: Remove this fallback once the RPC function is implemented
      if (error && error.code === '42883') { // Function does not exist
        ctx.logger.warn('allocate_orders_to_trip_safe RPC not available, using direct upsert with explicit validation');
        
        // First, check for existing allocations that would conflict
        const { data: existingAllocations, error: checkError } = await ctx.supabase
          .from('truck_allocations')
          .select('order_id, trip_id')
          .in('order_id', input.order_ids)
          .neq('trip_id', input.trip_id);
        
        if (checkError) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to check existing allocations: ${formatErrorMessage(checkError)}`,
          });
        }
        
        if (existingAllocations && existingAllocations.length > 0) {
          const conflictingOrders = existingAllocations.map(a => a.order_id).join(', ');
          throw new TRPCError({
            code: 'CONFLICT',
            message: `Orders already allocated to other trips: ${conflictingOrders}`,
          });
        }
        
        // Perform the upsert with validation passed
        const { data: upsertData, error: upsertError } = await ctx.supabase
          .from('truck_allocations')
          .upsert(allocations, { 
            onConflict: 'trip_id,order_id',
            ignoreDuplicates: false 
          })
          .select('*');
          
        if (upsertError) {
          ctx.logger.error('Error allocating orders to trip:', upsertError);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to allocate orders: ${formatErrorMessage(upsertError)}`,
          });
        }
        
        return upsertData;
      }

      if (error) {
        ctx.logger.error('Error allocating orders to trip using RPC:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to allocate orders: ${formatErrorMessage(error)}`,
        });
      }

      return {
        success: true,
        trip_id: input.trip_id,
        allocated_orders: input.order_ids,
        allocations: data,
        message: `${input.order_ids.length} orders allocated to trip`,
      };
    }),

  // DELETE /trips/{id}/allocations/{order_id} - Remove order from trip
  removeOrderFromTrip: protectedProcedure
    .meta({
      openapi: {
        method: 'DELETE',
        path: '/trips/{trip_id}/allocations/{order_id}',
        tags: ['trips'],
        summary: 'Remove order from trip',
        description: 'Remove an order allocation from a trip',
        protect: true,
      }
    })
    .input(RemoveOrderFromTripSchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Removing order from trip:', input);
      
      const { error } = await ctx.supabase
        .from('truck_allocations')
        .delete()
        .eq('trip_id', input.trip_id)
        .eq('order_id', input.order_id);

      if (error) {
        ctx.logger.error('Error removing order from trip:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to remove order: ${formatErrorMessage(error)}`,
        });
      }

      return {
        success: true,
        trip_id: input.trip_id,
        removed_order_id: input.order_id,
        message: 'Order removed from trip',
      };
    }),

  // ============ Trip Loading Operations (Stage 2) ============

  // POST /trips/{id}/start-loading - Begin loading process
  startTripLoading: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/trips/{trip_id}/start-loading',
        tags: ['trips', 'loading'],
        summary: 'Start trip loading process',
        description: 'Begin the loading process for a trip and transition status to loading',
        protect: true,
      }
    })
    .input(StartTripLoadingSchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Starting trip loading process:', input);
      
      // Verify trip exists and is in correct status
      const { data: trip, error: tripError } = await ctx.supabase
        .from('truck_routes')
        .select('id, route_status, truck_id, warehouse_id')
        .eq('id', input.trip_id)
        .single();

      if (tripError || !trip) {
        ctx.logger.error('Trip not found for loading start:', tripError);
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Trip not found',
        });
      }

      if (trip.route_status !== 'planned') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Cannot start loading for trip with status: ${trip.route_status}`,
        });
      }

      if (!trip.warehouse_id) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Trip must have a warehouse assigned before loading can begin',
        });
      }

      // Update trip status to loading
      const { data: updatedTrip, error: updateError } = await ctx.supabase
        .from('truck_routes')
        .update({
          route_status: 'loading',
          load_started_at: new Date().toISOString(),
          loading_notes: input.notes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.trip_id)
        .select('*')
        .single();

      if (updateError) {
        ctx.logger.error('Error updating trip status to loading:', updateError);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to start loading: ${formatErrorMessage(updateError)}`,
        });
      }

      // Initialize loading details based on allocated orders
      const { data: requiredQuantities } = await ctx.supabase.rpc('calculate_trip_required_quantities', {
        p_trip_id: input.trip_id
      });

      if (requiredQuantities && requiredQuantities.length > 0) {
        const loadingDetails = requiredQuantities.map((item: any, index: number) => ({
          trip_id: input.trip_id,
          product_id: item.product_id,
          required_qty_full: item.required_qty_full,
          required_qty_empty: item.required_qty_empty,
          loaded_qty_full: 0,
          loaded_qty_empty: 0,
          loading_sequence: index + 1,
          loading_status: 'pending',
        }));

        const { error: insertError } = await ctx.supabase
          .from('trip_loading_details')
          .upsert(loadingDetails, {
            onConflict: 'trip_id,product_id,loading_sequence',
            ignoreDuplicates: false
          });

        if (insertError) {
          ctx.logger.error('Error initializing loading details:', insertError);
          // Don't fail the operation, just log the error
        }
      }

      return {
        success: true,
        trip: updatedTrip,
        required_products: requiredQuantities?.length || 0,
        message: 'Trip loading started successfully',
      };
    }),

  // POST /trips/{id}/loading-details - Record product loading details
  recordLoadingDetails: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/trips/{trip_id}/loading-details',
        tags: ['trips', 'loading'],
        summary: 'Record loading details for trip',
        description: 'Record actual loaded quantities for products on a trip with inventory transfer',
        protect: true,
      }
    })
    .input(RecordLoadingDetailSchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Recording loading details:', input);
      
      // Verify trip is in loading status
      const { data: trip, error: tripError } = await ctx.supabase
        .from('truck_routes')
        .select('id, route_status, truck_id, warehouse_id')
        .eq('id', input.trip_id)
        .single();

      if (tripError || !trip) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Trip not found',
        });
      }

      if (trip.route_status !== 'loading') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Trip must be in loading status. Current status: ${trip.route_status}`,
        });
      }

      // Validate quantities
      if (input.qty_full === 0 && input.qty_empty === 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'At least one quantity must be greater than zero',
        });
      }

      // Use the database function to handle stock transfer and loading detail recording
      const { data: loadResult, error: loadError } = await ctx.supabase.rpc('load_trip_stock', {
        p_trip_id: input.trip_id,
        p_product_id: input.product_id,
        p_qty_full: input.qty_full,
        p_qty_empty: input.qty_empty,
        p_loading_sequence: input.loading_sequence,
        p_notes: input.notes
      });

      if (loadError) {
        // Enhanced error handling with detailed context
        const errorContext = {
          operation: 'load_trip_stock',
          trip_id: input.trip_id,
          product_id: input.product_id,
          qty_full: input.qty_full,
          qty_empty: input.qty_empty,
          loading_sequence: input.loading_sequence,
          error_details: loadError
        };
        
        ctx.logger.error('Critical error in trip stock loading operation:', errorContext);
        
        // Create detailed error message for debugging
        const detailedErrorMessage = `Failed to load stock for trip ${input.trip_id}: ${loadError.message || 'Unknown database error'}. ` +
          `Details: ${loadError.details || 'No additional details'}, Code: ${loadError.code || 'Unknown'}, ` +
          `Hint: ${loadError.hint || 'No hint available'}`;
        
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: detailedErrorMessage,
        });
      }

      if (!loadResult.success) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: loadResult.error || 'Loading operation failed',
        });
      }

      // Get updated loading details
      const { data: loadingDetails } = await ctx.supabase
        .from('trip_loading_details')
        .select(`
          *,
          product:product_id (name, sku)
        `)
        .eq('trip_id', input.trip_id)
        .eq('product_id', input.product_id)
        .single();

      return {
        success: true,
        loading_detail: loadingDetails,
        transfer_result: loadResult,
        message: 'Loading details recorded successfully',
      };
    }),

  // GET /trips/{id}/loading-summary - Get Required vs Loaded report
  getTripLoadingSummary: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/trips/{trip_id}/loading-summary',
        tags: ['trips', 'loading'],
        summary: 'Get trip loading summary',
        description: 'Get comprehensive loading summary with Required vs Loaded comparison',
        protect: true,
      }
    })
    .input(GetTripLoadingSummarySchema)
    .output(z.any())
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Fetching trip loading summary:', input.trip_id);
      
      // Get trip details
      const { data: trip, error: tripError } = await ctx.supabase
        .from('truck_routes')
        .select(`
          *,
          truck:truck_id (id, fleet_number, license_plate, capacity_cylinders)
        `)
        .eq('id', input.trip_id)
        .single();

      if (tripError || !trip) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Trip not found',
        });
      }

      // Get loading summary using database function
      const { data: loadingSummary, error: summaryError } = await ctx.supabase.rpc('get_trip_loading_summary', {
        p_trip_id: input.trip_id
      });

      if (summaryError) {
        ctx.logger.error('Error fetching loading summary:', summaryError);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to fetch loading summary: ${formatErrorMessage(summaryError)}`,
        });
      }

      // Get detailed loading information
      const { data: loadingDetails } = await ctx.supabase
        .from('trip_loading_details')
        .select(`
          *,
          product:product_id (name, sku, variant_name)
        `)
        .eq('trip_id', input.trip_id)
        .order('loading_sequence');

      // Get allocated orders for context
      const { data: allocations } = await ctx.supabase
        .from('truck_allocations')
        .select(`
          order_id,
          stop_sequence,
          order:order_id (id, order_date, customer_id)
        `)
        .eq('trip_id', input.trip_id)
        .order('stop_sequence');

      return {
        trip: trip,
        summary: loadingSummary?.[0] || {
          trip_id: input.trip_id,
          total_products: 0,
          products_loaded: 0,
          products_pending: 0,
          products_short_loaded: 0,
          total_required_cylinders: 0,
          total_loaded_cylinders: 0,
          loading_percentage: 0,
          variance_count: 0,
          has_short_loading: false
        },
        loading_details: loadingDetails || [],
        allocated_orders: allocations || [],
        timestamp: new Date().toISOString(),
      };
    }),

  // POST /trips/{id}/complete-loading - Finish loading with validation
  completeTripLoading: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/trips/{trip_id}/complete-loading',
        tags: ['trips', 'loading'],
        summary: 'Complete trip loading',
        description: 'Complete the loading process with capacity validation and status transition',
        protect: true,
      }
    })
    .input(CompleteTripSchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Completing trip loading:', input);
      
      // Verify trip is in loading status
      const { data: trip, error: tripError } = await ctx.supabase
        .from('truck_routes')
        .select(`
          *,
          truck:truck_id (id, fleet_number, capacity_cylinders, capacity_kg)
        `)
        .eq('id', input.trip_id)
        .single();

      if (tripError || !trip) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Trip not found',
        });
      }

      if (trip.route_status !== 'loading') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Trip must be in loading status. Current status: ${trip.route_status}`,
        });
      }

      // Get loading summary to validate completion
      const { data: loadingSummary } = await ctx.supabase.rpc('get_trip_loading_summary', {
        p_trip_id: input.trip_id
      });

      const summary = loadingSummary?.[0];
      
      // Validation checks
      const validationErrors = [];
      
      if (!summary) {
        validationErrors.push('No loading details found for this trip');
      } else {
        if (summary.products_pending > 0 && !input.force_complete) {
          validationErrors.push(`${summary.products_pending} products are still pending loading`);
        }
        
        if (summary.loading_percentage < 50 && !input.force_complete) {
          validationErrors.push(`Loading is only ${summary.loading_percentage}% complete`);
        }
      }

      // Capacity validation
      if (trip.truck && summary) {
        const truckCapacity = trip.truck.capacity_cylinders;
        const totalLoaded = summary.total_loaded_cylinders;
        
        if (totalLoaded > truckCapacity) {
          validationErrors.push(`Truck is overloaded: ${totalLoaded} cylinders exceeds capacity of ${truckCapacity}`);
        }
      }

      if (validationErrors.length > 0 && !input.force_complete) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Cannot complete loading: ${validationErrors.join(', ')}`,
        });
      }

      // Update trip status to loaded
      const updateData: any = {
        route_status: 'loaded',
        load_completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (input.final_notes) {
        updateData.loading_notes = input.final_notes;
      }

      if (summary) {
        updateData.total_loaded_weight_kg = summary.total_loaded_cylinders * 27; // Estimate weight
        updateData.loading_variance_count = summary.variance_count;
        updateData.short_loading_flag = summary.has_short_loading;
      }

      const { data: updatedTrip, error: updateError } = await ctx.supabase
        .from('truck_routes')
        .update(updateData)
        .eq('id', input.trip_id)
        .select('*')
        .single();

      if (updateError) {
        ctx.logger.error('Error completing trip loading:', updateError);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to complete loading: ${formatErrorMessage(updateError)}`,
        });
      }

      // Get final loading details
      const { data: finalLoadingDetails } = await ctx.supabase
        .from('trip_loading_details')
        .select(`
          *,
          product:product_id (name, sku)
        `)
        .eq('trip_id', input.trip_id)
        .order('loading_sequence');

      return {
        success: true,
        trip: updatedTrip,
        loading_summary: summary,
        loading_details: finalLoadingDetails || [],
        validation_warnings: validationErrors.length > 0 ? validationErrors : null,
        forced_completion: input.force_complete && validationErrors.length > 0,
        message: 'Trip loading completed successfully',
      };
    }),

  // GET /trips/{id}/short-loading-warnings - Get short-loading alerts
  getTripShortLoadingWarnings: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/trips/{trip_id}/short-loading-warnings',
        tags: ['trips', 'loading'],
        summary: 'Get short-loading warnings',
        description: 'Get detailed warnings about products that are short-loaded with impact analysis',
        protect: true,
      }
    })
    .input(CheckShortLoadingSchema)
    .output(z.any())
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Fetching short-loading warnings:', input.trip_id);
      
      // Verify trip exists
      const { data: trip, error: tripError } = await ctx.supabase
        .from('truck_routes')
        .select('id, route_status')
        .eq('id', input.trip_id)
        .single();

      if (tripError || !trip) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Trip not found',
        });
      }

      // Get short-loading warnings using database function
      const { data: warnings, error: warningsError } = await ctx.supabase.rpc('get_trip_short_loading_warnings', {
        p_trip_id: input.trip_id
      });

      if (warningsError) {
        ctx.logger.error('Error fetching short-loading warnings:', warningsError);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to fetch warnings: ${formatErrorMessage(warningsError)}`,
        });
      }

      // Get affected orders for each short-loaded product
      const affectedOrdersData = warnings && warnings.length > 0 ? await Promise.all(
        warnings.map(async (warning: any) => {
          const { data: orders } = await ctx.supabase
            .from('truck_allocations')
            .select(`
              order_id,
              stop_sequence,
              order:order_id (
                id,
                order_date,
                customer_id,
                delivery_address,
                order_lines!inner (
                  product_id,
                  qty_full,
                  qty_empty
                )
              )
            `)
            .eq('trip_id', input.trip_id)
            .filter('order.order_lines.product_id', 'eq', warning.product_id);

          return {
            product_id: warning.product_id,
            orders: orders || []
          };
        })
      ) : [];

      // Create a map of affected orders by product
      const affectedOrdersMap = affectedOrdersData.reduce((acc, item) => {
        acc[item.product_id] = item.orders;
        return acc;
      }, {} as Record<string, any[]>);

      // Enhance warnings with affected order details
      const enhancedWarnings = (warnings || []).map((warning: any) => ({
        ...warning,
        affected_orders: affectedOrdersMap[warning.product_id] || [],
        severity: warning.shortage_percentage > 50 ? 'high' : 
                 warning.shortage_percentage > 25 ? 'medium' : 'low'
      }));

      return {
        trip_id: input.trip_id,
        trip_status: trip.route_status,
        total_warnings: enhancedWarnings.length,
        warnings: enhancedWarnings,
        high_severity_count: enhancedWarnings.filter((w: any) => w.severity === 'high').length,
        medium_severity_count: enhancedWarnings.filter((w: any) => w.severity === 'medium').length,
        low_severity_count: enhancedWarnings.filter((w: any) => w.severity === 'low').length,
        timestamp: new Date().toISOString(),
      };
    }),

  // ============ Trip Loading Validation Operations ============

  // POST /trips/{id}/validate-loading-capacity - Validate loading capacity for trip
  validateTripLoadingCapacity: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/trips/{trip_id}/validate-loading-capacity',
        tags: ['trips', 'loading', 'validation'],
        summary: 'Validate trip loading capacity',
        description: 'Validate that the planned loading quantities for a trip do not exceed truck capacity',
        protect: true,
      }
    })
    .input(ValidateTripLoadingCapacitySchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Validating trip loading capacity:', input);
      
      // Get trip and truck details
      const { data: trip, error: tripError } = await ctx.supabase
        .from('truck_routes')
        .select(`
          *,
          truck:truck_id (
            id, 
            fleet_number, 
            license_plate, 
            capacity_cylinders, 
            capacity_kg,
            active
          )
        `)
        .eq('id', input.trip_id)
        .single();

      if (tripError || !trip) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Trip not found',
        });
      }

      if (!trip.truck.active) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot validate loading for inactive truck',
        });
      }

      // Get current truck inventory
      const { data: currentInventory } = await ctx.supabase
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
        .eq('truck_id', trip.truck.id);

      // Use provided loading plan or get existing loading details
      let loadingItems = input.loading_plan;
      
      if (!loadingItems || loadingItems.length === 0) {
        // Get existing loading details for this trip
        const { data: loadingDetails } = await ctx.supabase
          .from('trip_loading_details')
          .select('product_id, loaded_qty_full, loaded_qty_empty')
          .eq('trip_id', input.trip_id);

        loadingItems = (loadingDetails || []).map((detail: any) => ({
          product_id: detail.product_id,
          qty_full: detail.loaded_qty_full,
          qty_empty: detail.loaded_qty_empty,
        }));
      }

      // Calculate total cylinders after loading
      const currentTotalCylinders = (currentInventory || []).reduce(
        (sum, item) => sum + item.qty_full + item.qty_empty, 
        0
      );

      const additionalCylinders = loadingItems.reduce(
        (sum, item) => sum + item.qty_full + item.qty_empty, 
        0
      );

      const totalAfterLoading = currentTotalCylinders + additionalCylinders;

      // Calculate weight if possible
      let totalWeightKg = 0;
      let weightCalculationPossible = true;

      for (const inventoryItem of currentInventory || []) {
        const product = inventoryItem.product;
        if (product?.capacity_kg && product?.tare_weight_kg) {
          totalWeightKg += (inventoryItem.qty_full * (product.capacity_kg + product.tare_weight_kg)) +
                          (inventoryItem.qty_empty * product.tare_weight_kg);
        } else {
          weightCalculationPossible = false;
          totalWeightKg += (inventoryItem.qty_full * 27) + (inventoryItem.qty_empty * 14); // Default weights
        }
      }

      for (const loadingItem of loadingItems) {
        const productInventory = currentInventory?.find(inv => inv.product_id === loadingItem.product_id);
        const product = productInventory?.product;
        
        if (product?.capacity_kg && product?.tare_weight_kg) {
          totalWeightKg += (loadingItem.qty_full * (product.capacity_kg + product.tare_weight_kg)) +
                          (loadingItem.qty_empty * product.tare_weight_kg);
        } else {
          weightCalculationPossible = false;
          totalWeightKg += (loadingItem.qty_full * 27) + (loadingItem.qty_empty * 14); // Default weights
        }
      }

      // Validation checks
      const validationResult = {
        is_valid: true,
        errors: [] as string[],
        warnings: [] as string[],
        capacity_check: {
          truck_capacity_cylinders: trip.truck.capacity_cylinders,
          truck_capacity_kg: trip.truck.capacity_kg || (trip.truck.capacity_cylinders * 27),
          current_cylinders: currentTotalCylinders,
          additional_cylinders: additionalCylinders,
          total_after_loading_cylinders: totalAfterLoading,
          estimated_total_weight_kg: Math.round(totalWeightKg * 100) / 100,
          weight_calculation_accurate: weightCalculationPossible,
          utilization_percentage: Math.round((totalAfterLoading / trip.truck.capacity_cylinders) * 100 * 100) / 100,
        },
        truck: {
          id: trip.truck.id,
          fleet_number: trip.truck.fleet_number,
          license_plate: trip.truck.license_plate,
        }
      };

      // Cylinder capacity validation
      if (totalAfterLoading > trip.truck.capacity_cylinders) {
        validationResult.is_valid = false;
        validationResult.errors.push(
          `Cylinder capacity exceeded: ${totalAfterLoading} cylinders exceeds truck capacity of ${trip.truck.capacity_cylinders}`
        );
      } else if (totalAfterLoading > trip.truck.capacity_cylinders * 0.95) {
        validationResult.warnings.push(
          `Near capacity: ${totalAfterLoading} cylinders is ${Math.round((totalAfterLoading / trip.truck.capacity_cylinders) * 100)}% of capacity`
        );
      }

      // Weight capacity validation (if we have capacity_kg)
      const truckWeightCapacity = trip.truck.capacity_kg || (trip.truck.capacity_cylinders * 27);
      if (totalWeightKg > truckWeightCapacity) {
        validationResult.is_valid = false;
        validationResult.errors.push(
          `Weight capacity exceeded: ${Math.round(totalWeightKg)}kg exceeds truck weight capacity of ${truckWeightCapacity}kg`
        );
      } else if (totalWeightKg > truckWeightCapacity * 0.9) {
        validationResult.warnings.push(
          `Near weight capacity: ${Math.round(totalWeightKg)}kg is ${Math.round((totalWeightKg / truckWeightCapacity) * 100)}% of weight capacity`
        );
      }

      // Product availability validation
      const availabilityWarnings = [];
      for (const loadingItem of loadingItems) {
        if (!trip.warehouse_id) continue;

        const { data: warehouseInventory } = await ctx.supabase
          .from('inventory_balance')
          .select('qty_full, qty_empty, qty_reserved')
          .eq('warehouse_id', trip.warehouse_id)
          .eq('product_id', loadingItem.product_id)
          .single();

        if (warehouseInventory) {
          const availableFull = warehouseInventory.qty_full - warehouseInventory.qty_reserved;
          const availableEmpty = warehouseInventory.qty_empty;

          if (loadingItem.qty_full > availableFull) {
            availabilityWarnings.push(
              `Insufficient full stock for product ${loadingItem.product_id}: requested ${loadingItem.qty_full}, available ${availableFull}`
            );
          }

          if (loadingItem.qty_empty > availableEmpty) {
            availabilityWarnings.push(
              `Insufficient empty stock for product ${loadingItem.product_id}: requested ${loadingItem.qty_empty}, available ${availableEmpty}`
            );
          }
        } else if (loadingItem.qty_full > 0 || loadingItem.qty_empty > 0) {
          availabilityWarnings.push(
            `No inventory found for product ${loadingItem.product_id} at warehouse`
          );
        }
      }

      validationResult.warnings.push(...availabilityWarnings);

      return {
        ...validationResult,
        trip_id: input.trip_id,
        loading_items_count: loadingItems.length,
        timestamp: new Date().toISOString(),
      };
    }),

  // POST /trips/{id}/check-product-availability - Check product availability for loading
  checkTripProductAvailability: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/trips/{trip_id}/check-product-availability',
        tags: ['trips', 'loading', 'validation'],
        summary: 'Check product availability for trip loading',
        description: 'Check warehouse inventory availability for products required by trip orders',
        protect: true,
      }
    })
    .input(CheckTripProductAvailabilitySchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Checking product availability for trip:', input);
      
      // Get trip details
      const { data: trip, error: tripError } = await ctx.supabase
        .from('truck_routes')
        .select('id, route_status, warehouse_id')
        .eq('id', input.trip_id)
        .single();

      if (tripError || !trip) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Trip not found',
        });
      }

      if (!trip.warehouse_id) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Trip must have a warehouse assigned',
        });
      }

      // Get required quantities for the trip
      const { data: requiredQuantities, error: reqError } = await ctx.supabase.rpc('calculate_trip_required_quantities', {
        p_trip_id: input.trip_id
      });

      if (reqError) {
        ctx.logger.error('Error calculating required quantities:', reqError);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to calculate required quantities: ${formatErrorMessage(reqError)}`,
        });
      }

      if (!requiredQuantities || requiredQuantities.length === 0) {
        return {
          trip_id: input.trip_id,
          warehouse_id: trip.warehouse_id,
          products_checked: 0,
          products_available: 0,
          products_insufficient: 0,
          availability_details: [],
          overall_availability: true,
          timestamp: new Date().toISOString(),
        };
      }

      // Extract product IDs for batch querying
      const productIds = requiredQuantities.map((req: any) => req.product_id);
      
      // Batch query all inventory data in a single database call
      const { data: inventoryData, error: inventoryError } = await ctx.supabase
        .from('inventory_balance')
        .select(`
          *,
          product:product_id (name, sku, variant_name, reorder_level)
        `)
        .eq('warehouse_id', trip.warehouse_id)
        .in('product_id', productIds);
        
      if (inventoryError) {
        ctx.logger.error('Error fetching inventory data:', inventoryError);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to fetch inventory data: ${formatErrorMessage(inventoryError)}`,
        });
      }
      
      // Create a map for quick lookup of inventory by product_id
      const inventoryMap = new Map();
      (inventoryData || []).forEach(item => {
        inventoryMap.set(item.product_id, item);
      });

      // Check availability for each required product using the batched data
      const availabilityDetails = [];
      let insufficientCount = 0;

      for (const required of requiredQuantities) {
        const inventory = inventoryMap.get(required.product_id);

        const safetyStock = input.include_safety_stock && inventory?.product?.reorder_level 
          ? inventory.product.reorder_level 
          : 0;

        const availableFull = inventory 
          ? Math.max(0, inventory.qty_full - inventory.qty_reserved - safetyStock)
          : 0;
        
        const availableEmpty = inventory ? inventory.qty_empty : 0;

        const fullSufficient = availableFull >= required.required_qty_full;
        const emptySufficient = availableEmpty >= required.required_qty_empty;
        const overallSufficient = fullSufficient && emptySufficient;

        if (!overallSufficient) {
          insufficientCount++;
        }

        availabilityDetails.push({
          product_id: required.product_id,
          product_name: inventory?.product?.name || 'Unknown Product',
          product_sku: inventory?.product?.sku || '',
          required_qty_full: required.required_qty_full,
          required_qty_empty: required.required_qty_empty,
          available_qty_full: availableFull,
          available_qty_empty: availableEmpty,
          inventory_qty_full: inventory?.qty_full || 0,
          inventory_qty_empty: inventory?.qty_empty || 0,
          reserved_qty: inventory?.qty_reserved || 0,
          safety_stock: safetyStock,
          full_sufficient: fullSufficient,
          empty_sufficient: emptySufficient,
          overall_sufficient: overallSufficient,
          shortage_full: Math.max(0, required.required_qty_full - availableFull),
          shortage_empty: Math.max(0, required.required_qty_empty - availableEmpty),
          total_orders: required.total_orders,
        });
      }

      return {
        trip_id: input.trip_id,
        warehouse_id: trip.warehouse_id,
        products_checked: requiredQuantities.length,
        products_available: requiredQuantities.length - insufficientCount,
        products_insufficient: insufficientCount,
        availability_details: availabilityDetails,
        overall_availability: insufficientCount === 0,
        safety_stock_considered: input.include_safety_stock,
        timestamp: new Date().toISOString(),
      };
    }),
});