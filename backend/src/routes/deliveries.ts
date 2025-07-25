import { z } from 'zod';
import { router, protectedProcedure } from '../lib/trpc';
import { requireAuth } from '../lib/auth';
import { TRPCError } from '@trpc/server';
import { formatErrorMessage } from '../lib/logger';
import {
  ProcessSchema,
  CompleteSchema,
  ListDeliveriesSchema,
  ListPickupsSchema,
  CustomerBalanceSchema,
  DeliveryIdSchema,
  PickupIdSchema,
  CustomerTransactionsSchema,
  ProcessDeliverySchema,
  ProcessPickupSchema,
  CompleteDeliverySchema,
  CompletePickupSchema,
} from '../schemas/input/deliveries-input';
import {
  ProcessResultSchema,
  CompleteResultSchema,
  DeliveriesListSchema,
  PickupsListSchema,
  CustomerBalanceOutputSchema,
  DeliveryDetailsSchema,
  PickupDetailsSchema,
  CustomerTransactionsOutputSchema,
} from '../schemas/output/deliveries-output';

export const deliveriesRouter = router({
  // Process delivery/pickup in a unified endpoint
  process: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/deliveries/process',
        tags: ['deliveries'],
        summary: 'Process delivery or pickup',
        description: 'Process a delivery or pickup operation with items and location data',
        protect: true,
      }
    })
    .input(ProcessSchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Processing ' + input.type, { 
        type: input.type,
        user_id: user.id 
      });

      try {
        let result;
        
        if (input.type === 'delivery') {
          const deliveryData = input.data as z.infer<typeof ProcessDeliverySchema>;
          
          // Call the stored procedure
          const { data, error } = await ctx.supabase.rpc('process_delivery', {
            p_order_id: deliveryData.order_id || null,
            p_customer_id: deliveryData.customer_id,
            p_delivery_address_id: deliveryData.delivery_address_id || null,
            p_truck_id: deliveryData.truck_id,
            p_delivery_items: JSON.stringify(deliveryData.delivery_items),
            p_driver_name: deliveryData.driver_name || null,
            p_driver_notes: deliveryData.driver_notes || null,
            p_delivery_latitude: deliveryData.delivery_latitude || null,
            p_delivery_longitude: deliveryData.delivery_longitude || null,
          });

          if (error) {
            ctx.logger.error('Failed to process delivery:', error);
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: formatErrorMessage(error),
            });
          }

          result = data;
        } else {
          const pickupData = input.data as z.infer<typeof ProcessPickupSchema>;
          
          // Call the stored procedure
          const { data, error } = await ctx.supabase.rpc('process_pickup', {
            p_customer_id: pickupData.customer_id,
            p_pickup_address_id: pickupData.pickup_address_id || null,
            p_truck_id: pickupData.truck_id,
            p_pickup_items: JSON.stringify(pickupData.pickup_items),
            p_driver_name: pickupData.driver_name || null,
            p_driver_notes: pickupData.driver_notes || null,
            p_pickup_latitude: pickupData.pickup_latitude || null,
            p_pickup_longitude: pickupData.pickup_longitude || null,
          });

          if (error) {
            ctx.logger.error('Failed to process pickup:', error);
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: formatErrorMessage(error),
            });
          }

          result = data;
        }

        if (!result.success) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: result.message || 'Operation failed',
          });
        }

        ctx.logger.info(`${input.type} processed successfully`, {
          type: input.type,
          id: result.delivery_id || result.pickup_id,
          number: result.delivery_number || result.pickup_number,
        });

        return result;
      } catch (error) {
        ctx.logger.error(`Failed to process ${input.type}:`, error);
        throw error;
      }
    }),

  // Complete delivery/pickup
  complete: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/deliveries/complete',
        tags: ['deliveries'],
        summary: 'Complete delivery or pickup',
        description: 'Mark a delivery or pickup as completed with optional signature and photo proof',
        protect: true,
      }
    })
    .input(CompleteSchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Completing ' + input.type, { 
        type: input.type,
        user_id: user.id 
      });

      try {
        let result;
        
        if (input.type === 'delivery') {
          const deliveryData = input.data as z.infer<typeof CompleteDeliverySchema>;
          
          const { data, error } = await ctx.supabase.rpc('complete_delivery', {
            p_delivery_id: deliveryData.delivery_id,
            p_customer_signature: deliveryData.customer_signature || null,
            p_photo_proof: deliveryData.photo_proof || null,
            p_delivery_latitude: deliveryData.delivery_latitude || null,
            p_delivery_longitude: deliveryData.delivery_longitude || null,
          });

          if (error) {
            ctx.logger.error('Failed to complete delivery:', error);
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: formatErrorMessage(error),
            });
          }

          result = data;
        } else {
          const pickupData = input.data as z.infer<typeof CompletePickupSchema>;
          
          const { data, error } = await ctx.supabase.rpc('complete_pickup', {
            p_pickup_id: pickupData.pickup_id,
            p_customer_signature: pickupData.customer_signature || null,
            p_photo_proof: pickupData.photo_proof || null,
            p_pickup_latitude: pickupData.pickup_latitude || null,
            p_pickup_longitude: pickupData.pickup_longitude || null,
          });

          if (error) {
            ctx.logger.error('Failed to complete pickup:', error);
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: formatErrorMessage(error),
            });
          }

          result = data;
        }

        if (!result.success) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: result.message || 'Operation failed',
          });
        }

        ctx.logger.info(`${input.type} completed successfully`, {
          type: input.type,
          id: input.type === 'delivery' 
            ? (input.data as z.infer<typeof CompleteDeliverySchema>).delivery_id 
            : (input.data as z.infer<typeof CompletePickupSchema>).pickup_id,
        });

        return result;
      } catch (error) {
        ctx.logger.error(`Failed to complete ${input.type}:`, error);
        throw error;
      }
    }),

  // List deliveries
  listDeliveries: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/deliveries',
        tags: ['deliveries'],
        summary: 'List deliveries',
        description: 'Get a paginated list of deliveries with optional filtering',
        protect: true,
      }
    })
    .input(ListDeliveriesSchema)
    .output(z.any())
    .query(async ({ input, ctx }) => {
      requireAuth(ctx);
      
      let query = ctx.supabase
        .from('recent_deliveries_view')
        .select('*', { count: 'exact' });

      if (input.customer_id) {
        query = query.eq('customer_id', input.customer_id);
      }
      if (input.truck_id) {
        query = query.eq('truck_id', input.truck_id);
      }
      if (input.status) {
        query = query.eq('status', input.status);
      }
      if (input.date_from) {
        query = query.gte('delivery_date', input.date_from);
      }
      if (input.date_to) {
        query = query.lte('delivery_date', input.date_to);
      }

      // Pagination
      const from = (input.page - 1) * input.limit;
      const to = from + input.limit - 1;
      
      query = query
        .order('delivery_date', { ascending: false })
        .order('created_at', { ascending: false })
        .range(from, to);

      const { data, error, count } = await query;

      if (error) {
        ctx.logger.error('Failed to list deliveries:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: formatErrorMessage(error),
        });
      }

      return {
        deliveries: data || [],
        total: count || 0,
        page: input.page,
        limit: input.limit,
        totalPages: Math.ceil((count || 0) / input.limit),
      };
    }),

  // List pickups
  listPickups: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/pickups',
        tags: ['deliveries', 'pickups'],
        summary: 'List pickups',
        description: 'Get a paginated list of pickups with optional filtering',
        protect: true,
      }
    })
    .input(ListPickupsSchema)
    .output(z.any())
    .query(async ({ input, ctx }) => {
      requireAuth(ctx);
      
      let query = ctx.supabase
        .from('recent_pickups_view')
        .select('*', { count: 'exact' });

      if (input.customer_id) {
        query = query.eq('customer_id', input.customer_id);
      }
      if (input.truck_id) {
        query = query.eq('truck_id', input.truck_id);
      }
      if (input.status) {
        query = query.eq('status', input.status);
      }
      if (input.date_from) {
        query = query.gte('pickup_date', input.date_from);
      }
      if (input.date_to) {
        query = query.lte('pickup_date', input.date_to);
      }

      // Pagination
      const from = (input.page - 1) * input.limit;
      const to = from + input.limit - 1;
      
      query = query
        .order('pickup_date', { ascending: false })
        .order('created_at', { ascending: false })
        .range(from, to);

      const { data, error, count } = await query;

      if (error) {
        ctx.logger.error('Failed to list pickups:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: formatErrorMessage(error),
        });
      }

      return {
        pickups: data || [],
        total: count || 0,
        page: input.page,
        limit: input.limit,
        totalPages: Math.ceil((count || 0) / input.limit),
      };
    }),

  // Get customer cylinder balance
  getCustomerBalance: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/customers/{customer_id}/cylinder-balance',
        tags: ['deliveries', 'customers'],
        summary: 'Get customer cylinder balance',
        description: 'Get the current cylinder balance for a customer',
        protect: true,
      }
    })
    .input(CustomerBalanceSchema)
    .output(z.any())
    .query(async ({ input, ctx }) => {
      requireAuth(ctx);
      
      const { data, error } = await ctx.supabase.rpc('get_customer_cylinder_balance', {
        p_customer_id: input.customer_id,
        p_product_id: input.product_id || null,
      });

      if (error) {
        ctx.logger.error('Failed to get customer balance:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: formatErrorMessage(error),
        });
      }

      return data || [];
    }),

  // Get delivery details
  getDelivery: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/deliveries/{delivery_id}',
        tags: ['deliveries'],
        summary: 'Get delivery details',
        description: 'Get detailed information about a specific delivery including items',
        protect: true,
      }
    })
    .input(DeliveryIdSchema)
    .output(z.any())
    .query(async ({ input, ctx }) => {
      requireAuth(ctx);
      
      const { data: delivery, error: deliveryError } = await ctx.supabase
        .from('deliveries')
        .select(`
          *,
          customer:customers(id, name, phone, email),
          delivery_address:addresses(id, line1, line2, city, state, postal_code),
          truck:truck(id, fleet_number, driver_name)
        `)
        .eq('id', input.delivery_id)
        .single();

      if (deliveryError) {
        ctx.logger.error('Failed to get delivery:', deliveryError);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: formatErrorMessage(deliveryError),
        });
      }

      if (!delivery) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Delivery not found',
        });
      }

      // Get delivery items
      const { data: items, error: itemsError } = await ctx.supabase
        .from('delivery_items')
        .select(`
          *,
          product:products(id, name, sku)
        `)
        .eq('delivery_id', input.delivery_id);

      if (itemsError) {
        ctx.logger.error('Failed to get delivery items:', itemsError);
      }

      return {
        ...delivery,
        items: items || [],
      };
    }),

  // Get pickup details
  getPickup: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/pickups/{pickup_id}',
        tags: ['deliveries', 'pickups'],
        summary: 'Get pickup details',
        description: 'Get detailed information about a specific pickup including items',
        protect: true,
      }
    })
    .input(PickupIdSchema)
    .output(z.any())
    .query(async ({ input, ctx }) => {
      requireAuth(ctx);
      
      const { data: pickup, error: pickupError } = await ctx.supabase
        .from('pickups')
        .select(`
          *,
          customer:customers(id, name, phone, email),
          pickup_address:addresses(id, line1, line2, city, state, postal_code),
          truck:truck(id, fleet_number, driver_name)
        `)
        .eq('id', input.pickup_id)
        .single();

      if (pickupError) {
        ctx.logger.error('Failed to get pickup:', pickupError);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: formatErrorMessage(pickupError),
        });
      }

      if (!pickup) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Pickup not found',
        });
      }

      // Get pickup items
      const { data: items, error: itemsError } = await ctx.supabase
        .from('pickup_items')
        .select(`
          *,
          product:products(id, name, sku)
        `)
        .eq('pickup_id', input.pickup_id);

      if (itemsError) {
        ctx.logger.error('Failed to get pickup items:', itemsError);
      }

      return {
        ...pickup,
        items: items || [],
      };
    }),

  // Get customer transaction history
  getCustomerTransactions: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/customers/{customer_id}/transactions',
        tags: ['deliveries', 'customers'],
        summary: 'Get customer transactions',
        description: 'Get paginated transaction history for a customer with optional filtering',
        protect: true,
      }
    })
    .input(CustomerTransactionsSchema)
    .output(z.any())
    .query(async ({ input, ctx }) => {
      requireAuth(ctx);
      
      let query = ctx.supabase
        .from('customer_transactions')
        .select(`
          *,
          product:products(id, name, sku)
        `, { count: 'exact' })
        .eq('customer_id', input.customer_id);

      if (input.product_id) {
        query = query.eq('product_id', input.product_id);
      }
      if (input.date_from) {
        query = query.gte('transaction_date', input.date_from);
      }
      if (input.date_to) {
        query = query.lte('transaction_date', input.date_to);
      }

      // Pagination
      const from = (input.page - 1) * input.limit;
      const to = from + input.limit - 1;
      
      query = query
        .order('transaction_date', { ascending: false })
        .range(from, to);

      const { data, error, count } = await query;

      if (error) {
        ctx.logger.error('Failed to get customer transactions:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: formatErrorMessage(error),
        });
      }

      return {
        transactions: data || [],
        total: count || 0,
        page: input.page,
        limit: input.limit,
        totalPages: Math.ceil((count || 0) / input.limit),
      };
    }),
}); 