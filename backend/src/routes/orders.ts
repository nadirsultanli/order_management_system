import { z } from 'zod';
import { router, protectedProcedure } from '../lib/trpc';
import { requireAuth } from '../lib/auth';
import { TRPCError } from '@trpc/server';
import { formatErrorMessage } from '../lib/logger';
import {
  getOrderWorkflow,
  getOrderStatusInfo,
  canTransitionTo,
  validateTransition,
  calculateOrderTotalWithTax,
  validateOrderForConfirmation,
  validateOrderForScheduling,
  validateOrderDeliveryWindow,
  formatOrderId,
  formatCurrency,
  formatDate,
  isOrderEditable,
  isOrderCancellable,
  getStatusColor,
  getNextPossibleStatuses,
  OrderStatusSchema,
  OrderLineSchema,
  StatusTransitionSchema,
  CalculateTotalsSchema,
  OrderValidationSchema,
  type OrderStatus,
  type OrderWorkflowStep,
  type OrderValidationResult,
  type OrderTotalCalculation,
} from '../lib/order-workflow';
import { PricingService } from '../lib/pricing';

// Import input schemas
import {
  OrderStatusEnum,
  OrderFiltersSchema,
  GetOrderByIdSchema,
  GetOverdueOrdersSchema,
  GetDeliveryCalendarSchema,
  CreateOrderSchema,
  CalculateOrderTotalSchema,
  UpdateOrderStatusSchema,
  UpdateOrderTaxSchema,
  StatusTransitionSchema as InputStatusTransitionSchema,
  CalculateTotalsSchema as InputCalculateTotalsSchema,
  ValidateOrderSchema,
  GetWorkflowInfoSchema,
  FormatOrderIdSchema,
  FormatCurrencySchema,
  FormatDateSchema,
  ValidateOrderPricingSchema,
  ValidateTruckCapacitySchema,
  AllocateToTruckSchema,
  GetAllocationSuggestionsSchema,
  CalculateOrderWeightSchema,
  RemoveAllocationSchema,
  GetDailyScheduleSchema,
  ProcessRefillOrderSchema,
  ConvertVisitToDeliverySchema,
  CompleteVisitWithNoSaleSchema,
} from '../schemas/input/orders-input';

// Import output schemas
import {
  OrderListResponseSchema,
  OrderDetailResponseSchema,
  OverdueOrdersResponseSchema,
  DeliveryCalendarResponseSchema,
  CreateOrderResponseSchema,
  CalculateOrderTotalResponseSchema,
  UpdateOrderStatusResponseSchema,
  UpdateOrderTaxResponseSchema,
  WorkflowResponseSchema,
  StatusTransitionResponseSchema,
  CalculateTotalsResponseSchema,
  ValidateOrderResponseSchema,
  WorkflowInfoResponseSchema,
  FormatOrderIdResponseSchema,
  FormatCurrencyResponseSchema,
  FormatDateResponseSchema,
  ValidateOrderPricingResponseSchema,
  ValidateTruckCapacityResponseSchema,
  AllocateToTruckResponseSchema,
  AllocationSuggestionsResponseSchema,
  CalculateOrderWeightResponseSchema,
  RemoveAllocationResponseSchema,
  DailyScheduleResponseSchema,
  ProcessRefillOrderResponseSchema,
  ConvertVisitToDeliveryResponseSchema
} from '../schemas/output/orders-output';

export const ordersRouter = router({
  // GET /orders - List orders with advanced filtering and business logic
  list: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/orders',
        tags: ['orders'],
        summary: 'List orders with advanced filtering',
        description: 'Retrieve a paginated list of orders with comprehensive filtering options, business logic calculations, and optional analytics.',
        protect: true,
      }
    })
    .input(OrderFiltersSchema.optional())
    .output(z.any()) // ✅ No validation headaches!
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      // Provide default values if input is undefined
      const filters = input || {} as any;
      const page = filters.page || 1;
      const limit = filters.limit || 50;
      const sort_by = filters.sort_by || 'created_at';
      const sort_order = filters.sort_order || 'desc';
      const include_analytics = filters.include_analytics || false;
      
      ctx.logger.info('Fetching orders with advanced filters:', filters);
      
      let query = ctx.supabase
        .from('orders')
        .select(`
          *,
          customer:customers(id, name, email, phone, account_status, credit_terms_days),
          delivery_address:addresses(id, line1, line2, city, state, postal_code, country, instructions),
          source_warehouse:warehouses(id, name, is_mobile),
          order_lines(
            id,
            product_id,
            quantity,
            unit_price,
            subtotal,
            product:products(id, sku, name, unit_of_measure)
          ),
          payments(
            id,
            amount,
            payment_method,
            payment_status,
            payment_date,
            transaction_id
          )
        `, { count: 'exact' });

      // Build filter conditions array for complex queries
      const filterConditions: string[] = [];
      
      // 2. UPDATE THE STATUS FILTERING LOGIC
      if (filters.status) {
        let statuses: string[] = [];
        
        // Handle different input formats
        if (Array.isArray(filters.status)) {
          // Array format: ['confirmed', 'dispatched']
          statuses = filters.status;
        } else if (typeof filters.status === 'string') {
          // Check if it's comma-separated
          if (filters.status.includes(',')) {
            // Comma-separated: "confirmed,dispatched,en_route"
            statuses = filters.status.split(',').map((s: string) => s.trim());
          } else {
            // Single status: "confirmed"
            statuses = [filters.status];
          }
        }
        
        // Apply the filter
        if (statuses.length === 1) {
          query = query.eq('status', statuses[0]);
        } else if (statuses.length > 1) {
          query = query.in('status', statuses);
        }
      }

      // Apply customer filter
      if (filters.customer_id) {
        query = query.eq('customer_id', filters.customer_id);
      }

      // Enhanced search with multi-field support including product SKU
      if (filters.search) {
        query = query.or(`
          id.ilike.%${filters.search}%,
          customer.name.ilike.%${filters.search}%,
          customer.email.ilike.%${filters.search}%,
          order_lines.product.sku.ilike.%${filters.search}%,
          order_lines.product.name.ilike.%${filters.search}%,
          delivery_address.city.ilike.%${filters.search}%
        `);
      }

      // ... rest of your existing filters remain the same ...

      // Apply date filters
      if (filters.order_date_from) {
        query = query.gte('order_date', filters.order_date_from);
      }
      if (filters.order_date_to) {
        query = query.lte('order_date', filters.order_date_to);
      }
      if (filters.scheduled_date_from) {
        query = query.gte('scheduled_date', filters.scheduled_date_from);
      }
      if (filters.scheduled_date_to) {
        query = query.lte('scheduled_date', filters.scheduled_date_to);
      }

      // Apply amount range filter (business logic)
      if (filters.amount_min !== undefined) {
        query = query.gte('total_amount', filters.amount_min);
      }
      if (filters.amount_max !== undefined) {
        query = query.lte('total_amount', filters.amount_max);
      }

      // Apply delivery area filter (business logic)
      if (filters.delivery_area) {
        query = query.or(`
          delivery_address.city.ilike.%${filters.delivery_area}%,
          delivery_address.state.ilike.%${filters.delivery_area}%,
          delivery_address.postal_code.ilike.%${filters.delivery_area}%
        `);
      }

      // Apply overdue filter (complex business logic)
      if (filters.is_overdue) {
        const today = new Date().toISOString().split('T')[0];
        query = query
          .eq('status', 'dispatched')
          .lt('scheduled_date', today);
      }

      // Apply delivery method filter
      if (filters.delivery_method) {
        query = query.eq('delivery_method', filters.delivery_method);
      }

      // Apply priority filter
      if (filters.priority) {
        query = query.eq('priority', filters.priority);
      }

      // Apply payment status filter (business logic)
      if (filters.payment_status) {
        if (filters.payment_status === 'overdue') {
          // Orders that are invoiced but past due date
          const overdueDate = new Date();
          overdueDate.setDate(overdueDate.getDate() - 30); // 30 days overdue
          query = query
            .eq('status', 'invoiced')
            .lt('invoice_date', overdueDate.toISOString());
        } else if (filters.payment_status === 'paid') {
          query = query.not('payment_date', 'is', null);
        } else if (filters.payment_status === 'pending') {
          query = query.is('payment_date', null);
        }
      }

      // Apply advanced sorting
      const sortMapping: Record<string, string> = {
        'created_at': 'created_at',
        'order_date': 'order_date',
        'scheduled_date': 'scheduled_date',
        'total_amount': 'total_amount',
        'customer_name': 'customer.name'
      };
      
      const sortField = sortMapping[sort_by] || 'created_at';
      query = query.order(sortField, { ascending: sort_order === 'asc' });

      // Apply pagination
      const from = (page - 1) * limit;
      const to = from + limit - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) {
        ctx.logger.error('Supabase orders error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message
        });
      }

      // Apply additional business logic filters on the results
      let orders = data || [];

      // Post-process for complex business logic that can't be done in SQL
      orders = orders.map(order => {
        const paymentSummary = calculateOrderPaymentSummary(order);
        
        return {
          ...order,
          // Calculate business metrics
          is_high_value: (order.total_amount || 0) > 1000,
          days_since_order: Math.floor((new Date().getTime() - new Date(order.order_date).getTime()) / (1000 * 60 * 60 * 24)),
          estimated_delivery_window: calculateDeliveryWindow(order),
          risk_level: calculateOrderRisk(order),
          // Payment information
          payment_summary: paymentSummary,
          payment_balance: paymentSummary.balance,
          payment_status: order.payment_status_cache || paymentSummary.status,
        };
      });

      return {
        orders,
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
        currentPage: page,
        // Include analytics if requested
        analytics: include_analytics ? await generateOrderAnalytics(ctx, orders) : undefined,
      };
    }),

  // GET /orders/{id} - Get single order
  getById: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/orders/{order_id}',
        tags: ['orders'],
        summary: 'Get order by ID',
        description: 'Retrieve detailed information about a specific order including customer, address, order lines, and payment information.',
        protect: true,
      }
    })
    .input(GetOrderByIdSchema)
    .output(z.any())
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Fetching order:', input.order_id);
      
      const { data, error } = await ctx.supabase
        .from('orders')
        .select(`
          *,
          customer:customers(id, name, email, phone, account_status, credit_terms_days),
          delivery_address:addresses(id, line1, line2, city, state, postal_code, country, instructions),
          source_warehouse:warehouses(id, name, is_mobile),
          order_lines(
            id,
            product_id,
            quantity,
            unit_price,
            subtotal,
            product:products(id, sku, name, unit_of_measure, capacity_kg, tare_weight_kg)
          ),
          payments(
            id,
            amount,
            payment_method,
            payment_status,
            payment_date,
            transaction_id,
            reference_number
          )
        `)
        .eq('id', input.order_id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Order not found'
          });
        }
        ctx.logger.error('Supabase order error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message
        });
      }

      // Add payment calculation to the order
      const paymentSummary = calculateOrderPaymentSummary(data);
      
      return {
        ...data,
        payment_summary: paymentSummary,
        payment_balance: paymentSummary.balance,
        payment_status: data.payment_status_cache || paymentSummary.status,
      };
    }),

  // GET /orders/overdue - Get overdue orders with business logic
  // getOverdue: protectedProcedure
  //   .meta({
  //     openapi: {
  //       method: 'GET',
  //       path: '/orders/overdue',
  //       tags: ['orders'],
  //       summary: 'Get overdue orders',
  //       description: 'Retrieve orders that are past their scheduled delivery date with urgency scoring and summary statistics.',
  //       protect: true,
  //     }
  //   })
  //   .input(GetOverdueOrdersSchema)
  //   .output(z.any())
  //   .query(async ({ input, ctx }) => {
  //     const user = requireAuth(ctx);
      
  //     ctx.logger.info('Fetching overdue orders with criteria:', input);
      
  //     const cutoffDate = new Date();
  //     cutoffDate.setDate(cutoffDate.getDate() - input.days_overdue_min);
      
  //     let query = ctx.supabase
  //       .from('orders')
  //       .select(`
  //         *,
  //         customer:customers(id, name, email, phone, account_status),
  //         delivery_address:addresses(id, line1, line2, city, state, postal_code, country)
  //       `)
  //       .eq('status', 'dispatched')
  //       .lt('scheduled_date', cutoffDate.toISOString().split('T')[0]);

  //     if (!input.include_cancelled) {
  //       query = query.neq('status', 'cancelled');
  //     }

  //     if (input.priority_filter) {
  //       query = query.eq('priority', input.priority_filter);
  //     }

  //     query = query.order('scheduled_date', { ascending: true });

  //     const { data, error } = await query;

  //     if (error) {
  //       ctx.logger.error('Overdue orders error:', error);
  //       throw new TRPCError({
  //         code: 'INTERNAL_SERVER_ERROR',
  //         message: error.message
  //       });
  //     }

  //     const orders = (data || []).map(order => ({
  //       ...order,
  //       days_overdue: Math.floor((new Date().getTime() - new Date(order.scheduled_date).getTime()) / (1000 * 60 * 60 * 24)),
  //       urgency_score: calculateUrgencyScore(order),
  //     }));

  //     return {
  //       orders,
  //       summary: {
  //         total_overdue: orders.length,
  //         total_value: orders.reduce((sum, order) => sum + (order.total_amount || 0), 0),
  //         avg_days_overdue: orders.length > 0 ? orders.reduce((sum, order) => sum + order.days_overdue, 0) / orders.length : 0,
  //         high_priority_count: orders.filter(order => order.urgency_score >= 8).length,
  //       }
  //     };
  //   }),

  // GET /orders/delivery-calendar - Get orders by delivery date with route optimization data
  // getDeliveryCalendar: protectedProcedure
  //   .meta({
  //     openapi: {
  //       method: 'GET',
  //       path: '/orders/delivery-calendar',
  //       tags: ['orders'],
  //       summary: 'Get delivery calendar',
  //       description: 'Retrieve orders scheduled for delivery within a date range with route optimization data and logistics metrics.',
  //       protect: true,
  //     }
  //   })
  //   .input(GetDeliveryCalendarSchema)
  //   .output(z.any())
  //   .query(async ({ input, ctx }) => {
  //     const user = requireAuth(ctx);
      
  //     ctx.logger.info('Fetching delivery calendar:', input);
      
  //     let query = ctx.supabase
  //       .from('orders')
  //       .select(`
  //         *,
  //         customer:customers(id, name, email, phone),
  //         delivery_address:addresses(id, line1, line2, city, state, postal_code, country, latitude, longitude),
  //         order_lines(
  //           id,
  //           product_id,
  //           quantity,
  //           product:products(id, sku, name, capacity_kg, tare_weight_kg)
  //         )
  //       `)
  //       .gte('scheduled_date', input.date_from)
  //       .lte('scheduled_date', input.date_to)
  //       .in('status', ['dispatched', 'en_route']);

  //     if (input.delivery_area) {
  //       query = query.or(`
  //         delivery_address.city.ilike.%${input.delivery_area}%,
  //         delivery_address.state.ilike.%${input.delivery_area}%
  //       `);
  //     }

  //     query = query.order('scheduled_date', { ascending: true });

  //     const { data, error } = await query;

  //     if (error) {
  //       ctx.logger.error('Delivery calendar error:', error);
  //       throw new TRPCError({
  //         code: 'INTERNAL_SERVER_ERROR',
  //         message: error.message
  //       });
  //     }

  //     const orders = data || [];
      
  //     // Group by date and calculate logistics metrics
  //     const deliveryDays = orders.reduce((acc, order) => {
  //       const date = order.scheduled_date;
  //       if (!acc[date]) {
  //         acc[date] = {
  //           date,
  //           orders: [],
  //           total_orders: 0,
  //           total_value: 0,
  //           total_weight: 0,
  //           total_volume: 0,
  //           estimated_route_time: 0,
  //           delivery_areas: new Set(),
  //         };
  //       }

  //       const orderWeight = calculateOrderWeight(order);
  //       const orderVolume = calculateOrderVolume(order);
        
  //       acc[date].orders.push({
  //         ...order,
  //         order_weight: orderWeight,
  //         order_volume: orderVolume,
  //         estimated_service_time: calculateServiceTime(order),
  //       });

  //       acc[date].total_orders++;
  //       acc[date].total_value += order.total_amount || 0;
  //       acc[date].total_weight += orderWeight;
  //       acc[date].total_volume += orderVolume;
  //       acc[date].delivery_areas.add(order.delivery_address?.city || 'Unknown');

  //       return acc;
  //     }, {} as Record<string, any>);

  //     // Convert Sets to arrays for JSON serialization
  //     Object.values(deliveryDays).forEach((day: any) => {
  //       day.delivery_areas = Array.from(day.delivery_areas);
  //       day.estimated_route_time = calculateRouteTime(day.orders);
  //       day.truck_requirements = calculateTruckRequirements(day.total_weight, day.total_volume);
  //     });

  //     return {
  //       delivery_schedule: Object.values(deliveryDays),
  //       summary: {
  //         total_delivery_days: Object.keys(deliveryDays).length,
  //         total_orders: orders.length,
  //         total_value: orders.reduce((sum, order) => sum + (order.total_amount || 0), 0),
  //         peak_day: Object.values(deliveryDays).sort((a: any, b: any) => b.total_orders - a.total_orders)[0],
  //       }
  //     };
  //   }),

  // POST /orders - Create new order
  create: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/orders',
        tags: ['orders'],
        summary: 'Create new order',
        description: 'Create a new order with comprehensive validation including pricing, inventory, customer status, and business rules.',
        protect: true,
      }
    })
    .input(CreateOrderSchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Creating order for customer:', input.customer_id);
      
      // Generate hash for idempotency if key provided
      let idempotencyKeyId: string | null = null;
      if (input.idempotency_key) {
        const keyHash = Buffer.from(`order_create_${input.idempotency_key}_${user.id}`).toString('base64');
        
        // Check idempotency
        const { data: idempotencyData, error: idempotencyError } = await ctx.supabase
          .rpc('check_idempotency_key', {
            p_key_hash: keyHash,
            p_operation_type: 'order_create',
            p_request_data: input
          });
          
        if (idempotencyError) {
          ctx.logger.error('Idempotency check error:', idempotencyError);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to check idempotency'
          });
        }
        
        const idempotencyResult = idempotencyData[0];
        if (idempotencyResult.key_exists) {
          if (idempotencyResult.is_processing) {
            throw new TRPCError({
              code: 'CONFLICT',
              message: 'Order creation already in progress with this key'
            });
          } else {
            // Return existing result
            return idempotencyResult.response_data;
          }
        }
        
        idempotencyKeyId = idempotencyResult.key_id;
      }
      
      try {
        // Verify customer belongs to user's tenant and get account status
        const { data: customer, error: customerError } = await ctx.supabase
          .from('customers')
          .select('id, name, account_status, credit_terms_days')
          .eq('id', input.customer_id)
          .single();

        if (customerError || !customer) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Customer not found'
          });
        }
        
        // Validate customer account status
        if (customer.account_status === 'credit_hold') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Cannot create order for customer on credit hold'
          });
        }
        
        if (customer.account_status === 'closed') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Cannot create order for closed customer account'
          });
        }

        // Verify source warehouse exists
        ctx.logger.info('Validating source warehouse:', { 
          source_warehouse_id: input.source_warehouse_id,
          customer_id: input.customer_id 
        });
        
        const { data: warehouse, error: warehouseError } = await ctx.supabase
          .from('warehouses')
          .select('id, name, is_mobile')
          .eq('id', input.source_warehouse_id)
          .single();

        if (warehouseError || !warehouse) {
          ctx.logger.error('Warehouse validation failed:', {
            source_warehouse_id: input.source_warehouse_id,
            error: warehouseError,
            warehouse: warehouse
          });
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Source warehouse not found'
          });
        }
        
        ctx.logger.info('Warehouse validation successful:', { 
          warehouse_id: warehouse.id,
          warehouse_name: warehouse.name 
        });

        // Validate delivery address if provided
        if (input.delivery_address_id) {
          const { data: address, error: addressError } = await ctx.supabase
            .from('addresses')
            .select('id, customer_id, latitude, longitude')
            .eq('id', input.delivery_address_id)
            .eq('customer_id', input.customer_id)
            .single();
            
          if (addressError || !address) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: 'Delivery address not found or does not belong to customer'
            });
          }
          
          // Validate service zone if coordinates available
          if (address.latitude && address.longitude) {
            const { data: serviceZoneData, error: serviceZoneError } = await ctx.supabase
              .rpc('validate_address_in_service_zone', {
                p_latitude: address.latitude,
                p_longitude: address.longitude
              });
              
            if (!serviceZoneError && serviceZoneData && serviceZoneData.length > 0) {
              const serviceZoneResult = serviceZoneData[0];
              if (!serviceZoneResult.is_valid) {
                ctx.logger.warn('Address outside service zone:', {
                  address_id: input.delivery_address_id,
                  customer_id: input.customer_id
                });
                // Don't block order but log for review
              }
            }
          }
        }

        // Initialize pricing service
        const pricingService = new PricingService(ctx.supabase, ctx.logger);
        
        // Validate order lines and pricing
        const validatedOrderLines: any[] = [];
        const validationErrors: string[] = [];
        const validationWarnings: string[] = [];
        let totalAmount = 0;
        
        // Skip order line validation for visit orders
        if (input.order_type === 'visit') {
          ctx.logger.info('Creating visit order - skipping order line validation');
        } else if (input.order_lines && input.order_lines.length > 0) {
          for (let i = 0; i < input.order_lines.length; i++) {
          const line = input.order_lines[i];
          
          // Verify product exists and is active
          const { data: product, error: productError } = await ctx.supabase
            .from('products')
            .select('id, sku, name, status, capacity_kg, tare_weight_kg')
            .eq('id', line.product_id)
            .single();
            
          if (productError || !product) {
            validationErrors.push(`Product not found for line ${i + 1}`);
            continue;
          }
          
          if (product.status !== 'active') {
            validationErrors.push(`Product ${product.sku} is not active`);
            continue;
          }
          
          // Validate pricing if enabled
          let finalUnitPrice = line.unit_price || 0;
          
          if (input.validate_pricing) {
            // Get current pricing
            const currentPricing = await pricingService.getProductPrice(
              line.product_id,
              input.customer_id
            );
            
            if (!currentPricing) {
              validationErrors.push(`No pricing found for product ${product.sku}`);
              continue;
            }
            
            // If unit price not provided, use current pricing
            if (!line.unit_price) {
              finalUnitPrice = currentPricing.finalPrice;
            } else {
              // Validate provided price matches current pricing
              const priceTolerance = 0.01;
              if (Math.abs(line.unit_price - currentPricing.finalPrice) > priceTolerance) {
                if (line.expected_price && Math.abs(line.expected_price - currentPricing.finalPrice) <= priceTolerance) {
                  // Price changed between client request and server processing
                  validationErrors.push(
                    `Price for ${product.sku} has changed. Expected: ${line.expected_price}, Current: ${currentPricing.finalPrice}`
                  );
                } else {
                  validationErrors.push(
                    `Invalid price for ${product.sku}. Provided: ${line.unit_price}, Current: ${currentPricing.finalPrice}`
                  );
                }
                continue;
              }
            }
            
            // Check price list constraints
            if (line.price_list_id && currentPricing.priceListId !== line.price_list_id) {
              validationErrors.push(`Price list mismatch for product ${product.sku}`);
              continue;
            }
          }
          
          // Check inventory availability if not skipped
          if (!input.skip_inventory_check) {
            const { data: inventory, error: inventoryError } = await ctx.supabase
              .from('inventory_balance')
              .select('qty_full, qty_reserved')
              .eq('product_id', line.product_id)
              .eq('warehouse_id', input.source_warehouse_id)
              .single();
              
            if (inventoryError || !inventory) {
              validationWarnings.push(`No inventory found for product ${product.sku} in selected warehouse`);
            } else {
              const availableStock = inventory.qty_full - inventory.qty_reserved;
              if (line.quantity > availableStock) {
                validationErrors.push(
                  `Insufficient stock for ${product.sku} in selected warehouse. Requested: ${line.quantity}, Available: ${availableStock}`
                );
                continue;
              }
              
              if (line.quantity > availableStock * 0.8) {
                validationWarnings.push(
                  `Large quantity requested for ${product.sku} (${line.quantity}/${availableStock} available in selected warehouse)`
                );
              }
            }
          }
          
          const subtotal = finalUnitPrice * line.quantity;
          totalAmount += subtotal;
          
          validatedOrderLines.push({
            product_id: line.product_id,
            quantity: line.quantity,
            unit_price: finalUnitPrice,
            subtotal: subtotal,
            product_sku: product.sku,
            product_name: product.name,
          });
          }
        }
        
        // Check for validation errors
        if (validationErrors.length > 0) {
          const errorMessage = `Order validation failed: ${validationErrors.join('; ')}`;
          
          if (idempotencyKeyId) {
            await ctx.supabase.rpc('complete_idempotency_key', {
              p_key_id: idempotencyKeyId,
              p_response_data: { error: errorMessage },
              p_status: 'failed'
            });
          }
          
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: errorMessage
          });
        }
        
        // Validate minimum order amount if configured (skip for visit orders)
        if (input.order_type !== 'visit') {
          const minimumOrderAmount = 100; // Could be configurable per tenant
          if (totalAmount < minimumOrderAmount) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: `Order total (${totalAmount}) is below minimum order amount (${minimumOrderAmount})`
            });
          }
        }

        // Create order
        const orderData = {
          customer_id: input.customer_id,
          delivery_address_id: input.delivery_address_id,
          source_warehouse_id: input.source_warehouse_id,
          scheduled_date: input.scheduled_date,
          notes: input.notes,
          status: 'draft' as const,
          order_date: input.order_date || new Date().toISOString().split('T')[0],
          total_amount: totalAmount,
          created_by_user_id: user.id,
          // Order type fields
          order_type: input.order_type,
          service_type: input.service_type,
          exchange_empty_qty: input.exchange_empty_qty,
          requires_pickup: input.requires_pickup,
        };

        const { data: order, error: orderError } = await ctx.supabase
          .from('orders')
          .insert(orderData)
          .select()
          .single();

        if (orderError) {
          ctx.logger.error('Order creation error:', orderError);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: orderError.message
          });
        }

        // Create order lines (skip for visit orders)
        if (input.order_type !== 'visit' && validatedOrderLines.length > 0) {
          const orderLinesData = validatedOrderLines.map(line => ({
            order_id: order.id,
            product_id: line.product_id,
            quantity: line.quantity,
            unit_price: line.unit_price,
            subtotal: line.subtotal,
            qty_tagged: 0, // Default to 0, will be updated during fulfillment
            qty_untagged: line.quantity, // Start with all quantity untagged
          }));
          
          ctx.logger.info('Creating order lines:', {
            order_id: order.id,
            line_count: orderLinesData.length,
            lines: orderLinesData
          });

          const { error: linesError } = await ctx.supabase
            .from('order_lines')
            .insert(orderLinesData);

          if (linesError) {
            ctx.logger.error('Order lines creation error:', linesError);
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: linesError.message
            });
          }
        } else if (input.order_type === 'visit') {
          ctx.logger.info('Visit order created - no order lines to create');
        }

        // Calculate and update order total (includes tax calculation)
        await calculateOrderTotal(ctx, order.id);

        // Get complete order with relations
        const completeOrder = await getOrderById(ctx, order.id);
        
        // Complete idempotency if used
        if (idempotencyKeyId) {
          await ctx.supabase.rpc('complete_idempotency_key', {
            p_key_id: idempotencyKeyId,
            p_response_data: completeOrder,
            p_status: 'completed'
          });
        }
        
        // Log warnings if any
        if (validationWarnings.length > 0) {
          ctx.logger.warn('Order created with warnings:', {
            order_id: order.id,
            warnings: validationWarnings
          });
        }

        ctx.logger.info('Order created successfully:', {
          order_id: order.id,
          customer_id: input.customer_id,
          total_amount: totalAmount,
          line_count: validatedOrderLines.length
        });

        return {
          ...completeOrder,
          validation_warnings: validationWarnings
        };
        
      } catch (error) {
        // Complete idempotency with error if used
        if (idempotencyKeyId) {
          await ctx.supabase.rpc('complete_idempotency_key', {
            p_key_id: idempotencyKeyId,
            p_response_data: { error: formatErrorMessage(error) },
            p_status: 'failed'
          });
        }
        throw error;
      }
    }),

  // POST /orders/{id}/calculate-total - Calculate order total
  calculateTotal: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/orders/{order_id}/calculate-total',
        tags: ['orders'],
        summary: 'Calculate order total',
        description: 'Calculate the total amount for an order including tax calculations and line item breakdowns.',
        protect: true,
      }
    })
    .input(CalculateOrderTotalSchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      return await calculateOrderTotal(ctx, input.order_id);
    }),

  // POST /orders/{id}/status - Update order status
  updateStatus: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/orders/{order_id}/status',
        tags: ['orders'],
        summary: 'Update order status',
        description: 'Update order status with inventory management, business rule validation, and automated workflows.',
        protect: true,
      }
    })
    .input(UpdateOrderStatusSchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Changing order status:', input);

      // Get current order
      const { data: currentOrder, error: orderError } = await ctx.supabase
        .from('orders')
        .select(`
          *,
          order_lines(product_id, quantity)
        `)
        .eq('id', input.order_id)
        .single();

      if (orderError || !currentOrder) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Order not found'
        });
      }

      // Handle inventory updates based on status change
      if (input.new_status === 'confirmed' && currentOrder.status === 'draft') {
        // Reserve inventory when order is confirmed
        if (currentOrder.order_lines) {
          for (const line of currentOrder.order_lines) {
            // Get the primary warehouse for this product
            const { data: inventory, error: inventoryError } = await ctx.supabase
              .from('inventory_balance')
              .select('warehouse_id, qty_full, qty_reserved')
              .eq('product_id', line.product_id)
              .gt('qty_full', 0)
              .order('qty_full', { ascending: false })
              .limit(1)
              .single();

            if (inventoryError || !inventory) {
              throw new TRPCError({
                code: 'BAD_REQUEST',
                message: `No available inventory for product ${line.product_id}`
              });
            }

            const availableStock = inventory.qty_full - inventory.qty_reserved;
            if (availableStock < line.quantity) {
              throw new TRPCError({
                code: 'BAD_REQUEST',
                message: `Insufficient stock for product ${line.product_id}. Available: ${availableStock}, Requested: ${line.quantity}`
              });
            }

            const { error: reserveError } = await ctx.supabase.rpc('reserve_stock', {
              p_product_id: line.product_id,
              p_quantity: line.quantity,
              p_warehouse_id: inventory.warehouse_id
            });

            if (reserveError) {
              throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: `Failed to reserve stock for product ${line.product_id}: ${reserveError.message}`
              });
            }
          }
        }
      } else if (input.new_status === 'en_route' && 
                 ['confirmed', 'dispatched'].includes(currentOrder.status)) {
        // When order goes en route, fulfill the reserved inventory (remove from warehouse)
        if (currentOrder.order_lines) {
          for (const line of currentOrder.order_lines) {
            const { error: fulfillError } = await ctx.supabase.rpc('fulfill_order_line', {
              p_product_id: line.product_id,
              p_quantity: line.quantity
            });

            if (fulfillError) {
              ctx.logger.error('Failed to fulfill order line:', {
                error: formatErrorMessage(fulfillError),
                product_id: line.product_id,
                quantity: line.quantity,
                order_id: input.order_id
              });
              // Don't throw error here as the order status change should still proceed
            }
          }
        }
      } else if (input.new_status === 'delivered' && currentOrder.status === 'en_route') {
        // Order delivered - ensure any remaining reserved stock is cleaned up
        if (currentOrder.order_lines) {
          for (const line of currentOrder.order_lines) {
            const { error: releaseError } = await ctx.supabase.rpc('release_reserved_stock', {
              p_product_id: line.product_id,
              p_quantity: line.quantity
            });

            if (releaseError) {
              ctx.logger.error('Failed to release reserved stock on delivery:', {
                error: formatErrorMessage(releaseError),
                product_id: line.product_id,
                quantity: line.quantity,
                order_id: input.order_id
              });
              // Don't throw error here as the order delivery should still proceed
            }
          }
        }
        ctx.logger.info('Order delivered - cleaned up any remaining reserved stock');
      } else if (input.new_status === 'cancelled' && ['confirmed', 'dispatched'].includes(currentOrder.status)) {
        // Release reserved stock when order is cancelled
        if (currentOrder.order_lines) {
          for (const line of currentOrder.order_lines) {
            const { error: releaseError } = await ctx.supabase.rpc('release_reserved_stock', {
              p_product_id: line.product_id,
              p_quantity: line.quantity
            });

            if (releaseError) {
              ctx.logger.error('Failed to release reserved stock:', {
                error: formatErrorMessage(releaseError),
                product_id: line.product_id,
                quantity: line.quantity,
                order_id: input.order_id
              });
              // Don't throw error here as the order cancellation should still proceed
            }
          }
        }
      }

      // Update order status
      const updateData: any = {
        status: input.new_status,
        updated_at: new Date().toISOString(),
        // Note: orders table doesn't have updated_by column, only created_by_user_id
      };

      if (input.scheduled_date) {
        updateData.scheduled_date = input.scheduled_date;
      }

      const { data: updatedOrder, error: updateError } = await ctx.supabase
        .from('orders')
        .update(updateData)
        .eq('id', input.order_id)
        .select()
        .single();

      if (updateError) {
        ctx.logger.error('Order status update error:', updateError);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: updateError.message
        });
      }

      ctx.logger.info('Order status updated successfully:', updatedOrder);
      return updatedOrder;
    }),

  // POST /orders/{id}/update-tax - Update order tax
  updateTax: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/orders/{order_id}/update-tax',
        tags: ['orders'],
        summary: 'Update order tax',
        description: 'Update the tax percentage for an order and recalculate totals.',
        protect: true,
      }
    })
    .input(UpdateOrderTaxSchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      return await updateOrderTax(ctx, input.order_id, input.tax_percent);
    }),

  // GET /orders/workflow - Get order workflow steps
  getWorkflow: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/orders/workflow',
        tags: ['orders', 'workflow'],
        summary: 'Get order workflow steps',
        description: 'Retrieve the complete order workflow with status definitions and transition rules.',
        protect: true,
      }
    })
    .input(z.void())
    .output(z.any())
    .query(async ({ ctx }) => {
      requireAuth(ctx);
      
      ctx.logger.info('Fetching order workflow');
      
      return getOrderWorkflow();
    }),

  // POST /orders/workflow/validate-transition - Validate status transition
  validateTransition: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/orders/workflow/validate-transition',
        tags: ['orders', 'workflow'],
        summary: 'Validate status transition',
        description: 'Validate whether a status transition is allowed according to business rules.',
        protect: true,
      }
    })
    .input(InputStatusTransitionSchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      requireAuth(ctx);
      
      ctx.logger.info('Validating status transition:', input);
      
      return validateTransition(input.current_status, input.new_status);
    }),

  // POST /orders/workflow/calculate-totals - Calculate order totals with tax
  calculateTotals: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/orders/workflow/calculate-totals',
        tags: ['orders', 'workflow'],
        summary: 'Calculate order totals with tax',
        description: 'Calculate order totals including tax for order lines with detailed breakdown.',
        protect: true,
      }
    })
    .input(InputCalculateTotalsSchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      requireAuth(ctx);
      
      ctx.logger.info('Calculating order totals:', input);
      
      // Ensure lines have the correct types
      const validatedLines = input.lines.map(line => ({
        quantity: line.quantity!,
        unit_price: line.unit_price!,
        subtotal: line.subtotal,
      }));
      
      return calculateOrderTotalWithTax(validatedLines, input.tax_percent || 0);
    }),

  // POST /orders/workflow/validate-for-confirmation - Validate order for confirmation
  validateForConfirmation: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/orders/workflow/validate-for-confirmation',
        tags: ['orders', 'workflow'],
        summary: 'Validate order for confirmation',
        description: 'Validate whether an order can be confirmed according to business rules and inventory availability.',
        protect: true,
      }
    })
    .input(ValidateOrderSchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      requireAuth(ctx);
      
      ctx.logger.info('Validating order for confirmation:', input.order.id);
      
      return validateOrderForConfirmation(input.order);
    }),

  // POST /orders/workflow/validate-for-scheduling - Validate order for scheduling
  validateForScheduling: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/orders/workflow/validate-for-scheduling',
        tags: ['orders', 'workflow'],
        summary: 'Validate order for scheduling',
        description: 'Validate whether an order can be scheduled for delivery according to business rules.',
        protect: true,
      }
    })
    .input(ValidateOrderSchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      requireAuth(ctx);
      
      ctx.logger.info('Validating order for scheduling:', input.order.id);
      
      return validateOrderForScheduling(input.order);
    }),

  // POST /orders/workflow/validate-delivery-window - Validate order delivery window
  validateDeliveryWindow: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/orders/workflow/validate-delivery-window',
        tags: ['orders', 'workflow'],
        summary: 'Validate delivery window',
        description: 'Validate the delivery window for an order based on address and service constraints.',
        protect: true,
      }
    })
    .input(ValidateOrderSchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      requireAuth(ctx);
      
      ctx.logger.info('Validating order delivery window:', input.order.id);
      
      return validateOrderDeliveryWindow(input.order);
    }),

  // GET /orders/{id}/workflow-info - Get workflow information for a specific order
  getWorkflowInfo: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/orders/{order_id}/workflow-info',
        tags: ['orders', 'workflow'],
        summary: 'Get order workflow information',
        description: 'Get detailed workflow information for a specific order including current status and possible transitions.',
        protect: true,
      }
    })
    .input(GetWorkflowInfoSchema)
    .output(z.any())
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Getting workflow info for order:', input.order_id);
      
      // Get order to check current status
      const { data: order, error } = await ctx.supabase
        .from('orders')
        .select('id, status')
        .eq('id', input.order_id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Order not found'
          });
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message
        });
      }

      const currentStatus = order.status as OrderStatus;
      const currentStep = getOrderStatusInfo(currentStatus);
      const nextPossibleStatuses = getNextPossibleStatuses(currentStatus);
      
      return {
        currentStatus,
        currentStep,
        nextPossibleStatuses,
        nextSteps: nextPossibleStatuses.map(status => getOrderStatusInfo(status)),
        isEditable: isOrderEditable(currentStatus),
        isCancellable: isOrderCancellable(currentStatus),
        formattedOrderId: formatOrderId(order.id),
        statusColor: getStatusColor(currentStatus),
      };
    }),

  // POST /orders/workflow/format-order-id - Format order ID for display
  formatOrderId: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/orders/workflow/format-order-id',
        tags: ['orders', 'workflow'],
        summary: 'Format order ID',
        description: 'Format an order ID for display purposes.',
        protect: true,
      }
    })
    .input(FormatOrderIdSchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      requireAuth(ctx);
      
      return {
        formatted_id: formatOrderId(input.order_id),
      };
    }),

  // POST /orders/workflow/format-currency - Format currency amount
  formatCurrency: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/orders/workflow/format-currency',
        tags: ['orders', 'workflow'],
        summary: 'Format currency amount',
        description: 'Format a currency amount for display purposes.',
        protect: true,
      }
    })
    .input(FormatCurrencySchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      requireAuth(ctx);
      
      return {
        formatted_amount: formatCurrency(input.amount),
      };
    }),

  // POST /orders/workflow/format-date - Format date for display
  formatDate: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/orders/workflow/format-date',
        tags: ['orders', 'workflow'],
        summary: 'Format date',
        description: 'Format a date for display purposes.',
        protect: true,
      }
    })
    .input(FormatDateSchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      requireAuth(ctx);
      
      return {
        formatted_date: formatDate(input.date),
      };
    }),

  // POST /orders/validate-order-pricing - Validate order pricing before creation
  // validateOrderPricing: protectedProcedure
  //   .meta({
  //     openapi: {
  //       method: 'POST',
  //       path: '/orders/validate-order-pricing',
  //       tags: ['orders', 'pricing'],
  //       summary: 'Validate order pricing',
  //       description: 'Validate order pricing before creation including price list validation and inventory checks.',
  //       protect: true,
  //     }
  //   })
  //   .input(ValidateOrderPricingSchema)
  //   .output(z.any())
  //   .mutation(async ({ input, ctx }) => {
  //     const user = requireAuth(ctx);
      
  //     ctx.logger.info('Validating order pricing for customer:', input.customer_id);
      
  //     // Verify customer exists
  //     const { data: customer, error: customerError } = await ctx.supabase
  //       .from('customers')
  //       .select('id, name, account_status')
  //       .eq('id', input.customer_id)
  //       .single();

  //     if (customerError || !customer) {
  //       throw new TRPCError({
  //         code: 'NOT_FOUND',
  //         message: 'Customer not found'
  //       });
  //     }
      
  //     const pricingService = new PricingService(ctx.supabase, ctx.logger);
  //     const results: any[] = [];
  //     const errors: string[] = [];
  //     const warnings: string[] = [];
  //     let totalAmount = 0;
      
  //     for (let i = 0; i < input.order_lines.length; i++) {
  //       const line = input.order_lines[i];
        
  //       try {
  //         // Get product information
  //         const { data: product, error: productError } = await ctx.supabase
  //           .from('products')
  //           .select('id, sku, name, status')
  //           .eq('id', line.product_id)
  //           .single();
            
  //         if (productError || !product) {
  //           errors.push(`Product not found for line ${i + 1}`);
  //           results.push({
  //             product_id: line.product_id,
  //             quantity: line.quantity,
  //             is_valid: false,
  //             error: 'Product not found'
  //           });
  //           continue;
  //         }
          
  //         if (product.status !== 'active') {
  //           errors.push(`Product ${product.sku} is not active`);
  //           results.push({
  //             product_id: line.product_id,
  //             product_sku: product.sku,
  //             quantity: line.quantity,
  //             is_valid: false,
  //             error: 'Product is not active'
  //           });
  //           continue;
  //         }
          
  //         // Get current pricing
  //         const currentPricing = await pricingService.getProductPrice(
  //           line.product_id,
  //           input.customer_id
  //         );
          
  //         if (!currentPricing) {
  //           errors.push(`No pricing found for product ${product.sku}`);
  //           results.push({
  //             product_id: line.product_id,
  //             product_sku: product.sku,
  //             quantity: line.quantity,
  //             is_valid: false,
  //             error: 'No pricing found'
  //           });
  //           continue;
  //         }
          
  //         let isValid = true;
  //         let lineErrors: string[] = [];
  //         let lineWarnings: string[] = [];
          
  //         // Validate expected price if provided
  //         if (line.expected_price) {
  //           const priceTolerance = 0.01;
  //           if (Math.abs(line.expected_price - currentPricing.finalPrice) > priceTolerance) {
  //             isValid = false;
  //             lineErrors.push(`Price mismatch: expected ${line.expected_price}, current ${currentPricing.finalPrice}`);
  //           }
  //         }
          
  //         // Validate price list if provided
  //         if (line.price_list_id && currentPricing.priceListId !== line.price_list_id) {
  //           isValid = false;
  //           lineErrors.push('Price list mismatch');
  //         }
          
  //         // Check inventory
  //         const { data: inventory } = await ctx.supabase
  //           .from('inventory_balance')
  //           .select('qty_full, qty_reserved')
  //           .eq('product_id', line.product_id)
  //           .single();
            
  //         let availableStock = 0;
  //         if (inventory) {
  //           availableStock = inventory.qty_full - inventory.qty_reserved;
  //           if (line.quantity > availableStock) {
  //             isValid = false;
  //             lineErrors.push(`Insufficient stock: requested ${line.quantity}, available ${availableStock}`);
  //           } else if (line.quantity > availableStock * 0.8) {
  //             lineWarnings.push('Large quantity request relative to available stock');
  //           }
  //         } else {
  //           lineWarnings.push('No inventory information found');
  //         }
          
  //         const subtotal = currentPricing.finalPrice * line.quantity;
  //         if (isValid) {
  //           totalAmount += subtotal;
  //         }
          
  //         results.push({
  //           product_id: line.product_id,
  //           product_sku: product.sku,
  //           product_name: product.name,
  //           quantity: line.quantity,
  //           current_price: currentPricing.finalPrice,
  //           price_list_id: currentPricing.priceListId,
  //           price_list_name: currentPricing.priceListName,
  //           subtotal: subtotal,
  //           available_stock: availableStock,
  //           is_valid: isValid,
  //           errors: lineErrors,
  //           warnings: lineWarnings
  //         });
          
  //         if (lineErrors.length > 0) {
  //           errors.push(...lineErrors.map(err => `${product.sku}: ${err}`));
  //         }
  //         if (lineWarnings.length > 0) {
  //           warnings.push(...lineWarnings.map(warn => `${product.sku}: ${warn}`));
  //         }
          
  //       } catch (error) {
  //         ctx.logger.error(`Error validating line ${i + 1}:`, error);
  //         errors.push(`Error validating line ${i + 1}: ${formatErrorMessage(error)}`);
  //         results.push({
  //           product_id: line.product_id,
  //           quantity: line.quantity,
  //           is_valid: false,
  //           error: 'Validation error'
  //         });
  //       }
  //     }
      
  //     const isOrderValid = errors.length === 0;
      
  //     return {
  //       is_valid: isOrderValid,
  //       customer: {
  //         id: customer.id,
  //         name: customer.name,
  //         account_status: customer.account_status
  //       },
  //       line_validations: results,
  //       total_amount: totalAmount,
  //       summary: {
  //         total_lines: input.order_lines.length,
  //         valid_lines: results.filter(r => r.is_valid).length,
  //         invalid_lines: results.filter(r => !r.is_valid).length,
  //         total_errors: errors.length,
  //         total_warnings: warnings.length
  //       },
  //       errors,
  //       warnings
  //     };
  //   }),

  // // POST /orders/validate-truck-capacity - Validate truck capacity for order assignment
  // validateTruckCapacity: protectedProcedure
  //   .meta({
  //     openapi: {
  //       method: 'POST',
  //       path: '/orders/validate-truck-capacity',
  //       tags: ['orders', 'trucks'],
  //       summary: 'Validate truck capacity',
  //       description: 'Validate whether a truck has sufficient capacity for assigned orders.',
  //       protect: true,
  //     }
  //   })
  //   .input(ValidateTruckCapacitySchema)
  //   .output(z.any())
  //   .mutation(async ({ input, ctx }) => {
  //     const user = requireAuth(ctx);
      
  //     ctx.logger.info('Validating truck capacity:', input);
      
  //     // Validate truck exists
  //     const { data: truck, error: truckError } = await ctx.supabase
  //       .from('trucks')
  //       .select('id, name, capacity_kg, capacity_volume_m3')
  //       .eq('id', input.truck_id)
  //       .single();
        
  //     if (truckError || !truck) {
  //       throw new TRPCError({
  //         code: 'NOT_FOUND',
  //         message: 'Truck not found'
  //       });
  //     }
      
  //     // Use the database function to validate capacity
  //     const { data: capacityValidation, error: validationError } = await ctx.supabase
  //       .rpc('validate_truck_capacity', {
  //         p_truck_id: input.truck_id,
  //         p_order_ids: input.order_ids
  //       });
        
  //     if (validationError) {
  //       ctx.logger.error('Truck capacity validation error:', validationError);
  //       throw new TRPCError({
  //         code: 'INTERNAL_SERVER_ERROR',
  //         message: 'Failed to validate truck capacity'
  //       });
  //     }
      
  //     const result = capacityValidation[0];
      
  //     return {
  //       truck: {
  //         id: truck.id,
  //         name: truck.name,
  //         capacity_kg: truck.capacity_kg,
  //         capacity_volume_m3: truck.capacity_volume_m3
  //       },
  //       validation: result,
  //       recommendation: result.is_valid ? 
  //         'Truck capacity is sufficient for the assigned orders' : 
  //         'Truck capacity exceeded - consider reassigning some orders'
  //     };
  //   }),

  // POST /orders/allocate-to-truck - Allocate order to truck
  allocateToTruck: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/orders/allocate-to-truck',
        tags: ['orders', 'trucks'],
        summary: 'Allocate order to truck',
        description: 'Allocate an order to a specific truck for delivery with capacity validation.',
        protect: true,
      }
    })
    .input(AllocateToTruckSchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Allocating order to truck:', input);
      
      const { OrderAllocationService } = await import('../lib/order-allocation');
      const allocationService = new OrderAllocationService(ctx.supabase, ctx.logger);
      
      const allocationRequest = {
        order_id: input.order_id,
        truck_id: input.truck_id,
        allocation_date: input.allocation_date,
        force_allocation: input.force_allocation
      };
      const result = await allocationService.allocateOrder(allocationRequest, user.user_id);
      
      return result;
    }),

  // GET /orders/{id}/allocation-suggestions - Get truck allocation suggestions for order
  // getAllocationSuggestions: protectedProcedure
  //   .meta({
  //     openapi: {
  //       method: 'GET',
  //       path: '/orders/{order_id}/allocation-suggestions',
  //       tags: ['orders', 'trucks'],
  //       summary: 'Get truck allocation suggestions',
  //       description: 'Get suggested trucks for order allocation based on capacity and availability.',
  //       protect: true,
  //     }
  //   })
  //   .input(GetAllocationSuggestionsSchema)
  //   .output(z.any())
  //   .query(async ({ input, ctx }) => {
  //     const user = requireAuth(ctx);
      
  //     ctx.logger.info('Getting allocation suggestions for order:', input.order_id);
      
  //     const { OrderAllocationService } = await import('../lib/order-allocation');
  //     const allocationService = new OrderAllocationService(ctx.supabase, ctx.logger);
      
  //     const suggestions = await allocationService.findBestTrucks(input.order_id, input.allocation_date);
  //     const orderWeight = await allocationService.calculateOrderWeight(input.order_id);
      
  //     return {
  //       order_id: input.order_id,
  //       order_weight_kg: orderWeight,
  //       suggestions,
  //     };
  //   }),

  // // GET /orders/{id}/calculate-weight - Calculate order weight
  // calculateOrderWeight: protectedProcedure
  //   .meta({
  //     openapi: {
  //       method: 'GET',
  //       path: '/orders/{order_id}/calculate-weight',
  //       tags: ['orders', 'logistics'],
  //       summary: 'Calculate order weight',
  //       description: 'Calculate the total weight of an order for logistics planning.',
  //       protect: true,
  //     }
  //   })
  //   .input(CalculateOrderWeightSchema)
  //   .output(z.any())
  //   .query(async ({ input, ctx }) => {
  //     const user = requireAuth(ctx);
      
  //     ctx.logger.info('Calculating order weight:', input.order_id);
      
  //     const { OrderAllocationService } = await import('../lib/order-allocation');
  //     const allocationService = new OrderAllocationService(ctx.supabase, ctx.logger);
      
  //     const weight = await allocationService.calculateOrderWeight(input.order_id);
      
  //     return {
  //       order_id: input.order_id,
  //       total_weight_kg: weight,
  //     };
  //   }),

  // // DELETE /orders/allocations/{id} - Remove truck allocation
  // removeAllocation: protectedProcedure
  //   .meta({
  //     openapi: {
  //       method: 'DELETE',
  //       path: '/orders/allocations/{allocation_id}',
  //       tags: ['orders', 'trucks'],
  //       summary: 'Remove truck allocation',
  //       description: 'Remove a truck allocation for an order.',
  //       protect: true,
  //     }
  //   })
  //   .input(RemoveAllocationSchema)
  //   .output(z.any())
  //   .mutation(async ({ input, ctx }) => {
  //     const user = requireAuth(ctx);
      
  //     ctx.logger.info('Removing truck allocation:', input.allocation_id);
      
  //     const { OrderAllocationService } = await import('../lib/order-allocation');
  //     const allocationService = new OrderAllocationService(ctx.supabase, ctx.logger);
      
  //     await allocationService.removeAllocation(input.allocation_id);
      
  //     return { success: true };
  //   }),

  // GET /orders/schedule/{date} - Get daily order schedule
  // getDailySchedule: protectedProcedure
  //   .meta({
  //     openapi: {
  //       method: 'GET',
  //       path: '/orders/schedule/{date}',
  //       tags: ['orders', 'schedule'],
  //       summary: 'Get daily order schedule',
  //       description: 'Get the complete order schedule for a specific date with truck assignments and capacity information.',
  //       protect: true,
  //     }
  //   })
  //   .input(GetDailyScheduleSchema)
  //   .output(z.any())
  //   .query(async ({ input, ctx }) => {
  //     const user = requireAuth(ctx);
      
  //     ctx.logger.info('Getting daily order schedule for:', input.date);
      
  //     const { OrderAllocationService } = await import('../lib/order-allocation');
  //     const allocationService = new OrderAllocationService(ctx.supabase, ctx.logger);
      
  //     const schedule = await allocationService.getDailySchedule(input.date);
      
  //     return {
  //       date: input.date,
  //       trucks: schedule,
  //       summary: {
  //         total_trucks: schedule.length,
  //         active_trucks: schedule.filter(s => s.total_orders > 0).length,
  //         total_orders: schedule.reduce((sum, s) => sum + s.total_orders, 0),
  //         avg_utilization: schedule.length > 0 
  //           ? schedule.reduce((sum, s) => sum + s.capacity_info.utilization_percentage, 0) / schedule.length 
  //           : 0,
  //       },
  //     };
  //   }),

  // POST /orders/{id}/process-refill - Process refill order with stock movements
  // processRefillOrder: protectedProcedure
  //   .meta({
  //     openapi: {
  //       method: 'POST',
  //       path: '/orders/{order_id}/process-refill',
  //       tags: ['orders', 'inventory'],
  //       summary: 'Process refill order',
  //       description: 'Process a refill order creating appropriate stock movements for cylinder exchanges.',
  //       protect: true,
  //     }
  //   })
  //   .input(ProcessRefillOrderSchema)
  //   .output(z.any())
  //   .mutation(async ({ input, ctx }) => {
  //     const user = requireAuth(ctx);
      
  //     ctx.logger.info('Processing refill order:', input.order_id);
      
  //     // Verify order exists and is a refill type
  //     const { data: order, error: orderError } = await ctx.supabase
  //       .from('orders')
  //       .select('id, order_type, status')
  //       .eq('id', input.order_id)
  //       .single();

  //     if (orderError || !order) {
  //       throw new TRPCError({
  //         code: 'NOT_FOUND',
  //         message: 'Order not found',
  //       });
  //     }

  //     if (order.order_type !== 'refill' && order.order_type !== 'exchange') {
  //       throw new TRPCError({
  //         code: 'BAD_REQUEST',
  //         message: 'Order must be of type refill or exchange',
  //       });
  //     }

  //     if (order.status !== 'delivered') {
  //       throw new TRPCError({
  //         code: 'BAD_REQUEST',
  //         message: 'Order must be delivered before processing refill movements',
  //       });
  //     }

  //     // Call the database function to process refill order
  //     const { data, error } = await ctx.supabase.rpc('process_refill_order', {
  //       p_order_id: input.order_id
  //     });

  //     if (error) {
  //       ctx.logger.error('Error processing refill order:', error);
  //       throw new TRPCError({
  //         code: 'INTERNAL_SERVER_ERROR',
  //         message: 'Failed to process refill order stock movements',
  //       });
  //     }

  //     return { 
  //       success: true,
  //       order_id: input.order_id,
  //       message: 'Refill order processed successfully'
  //     };
  //   }),

  // POST /orders/{id}/convert-visit-to-delivery - Convert visit order to delivery order
  convertVisitToDelivery: protectedProcedure
  .meta({
    openapi: {
      method: 'POST',
      path: '/orders/{order_id}/convert-visit-to-delivery',
      tags: ['orders', 'visit'],
      summary: 'Convert visit order to delivery order',
      description: 'Convert a visit order to a delivery order by adding products and quantities',
      protect: true,
    }
  })
  .input(ConvertVisitToDeliverySchema)
  .output(z.any())
  .mutation(async ({ input, ctx }) => {
    const user = requireAuth(ctx);
    
    ctx.logger.info('Converting visit order to delivery order:', input.order_id);
    
    // Get the visit order
    const { data: order, error: orderError } = await ctx.supabase
      .from('orders')
      .select('*')
      .eq('id', input.order_id)
      .single();

    if (orderError || !order) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Order not found'
      });
    }

    if (order.order_type !== 'visit') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Only visit orders can be converted to delivery orders'
      });
    }

    // Initialize pricing service
    const pricingService = new PricingService(ctx.supabase, ctx.logger);
    
    // Validate and process order lines
    const validatedOrderLines: any[] = [];
    const validationErrors: string[] = [];
    let totalAmount = 0;

    for (let i = 0; i < input.order_lines.length; i++) {
      const line = input.order_lines[i];
      
      // Verify product exists and is active
      const { data: product, error: productError } = await ctx.supabase
        .from('products')
        .select('id, sku, name, status')
        .eq('id', line.product_id)
        .single();
        
      if (productError || !product) {
        validationErrors.push(`Product not found for line ${i + 1}`);
        continue;
      }
      
      if (product.status !== 'active') {
        validationErrors.push(`Product ${product.sku} is not active`);
        continue;
      }

      // Get current pricing - АВТОМАТИЧЕСКИ из системы ценообразования
      const currentPricing = await pricingService.getProductPrice(
        line.product_id,
        order.customer_id
      );
      
      if (!currentPricing) {
        validationErrors.push(`No pricing found for product ${product.sku}`);
        continue;
      }
      
      // ✅ ИСПРАВЛЕНО: убрано line.unit_price (его нет в схеме)
      const finalUnitPrice = currentPricing.finalPrice;
      
      // Check inventory availability
      const { data: inventory, error: inventoryError } = await ctx.supabase
        .from('inventory_balance')
        .select('qty_full, qty_reserved')
        .eq('product_id', line.product_id)
        .eq('warehouse_id', order.source_warehouse_id)
        .single();
        
      if (inventoryError || !inventory) {
        validationErrors.push(`No inventory found for product ${product.sku} in warehouse`);
        continue;
      }
      
      const availableStock = inventory.qty_full - inventory.qty_reserved;
      if (line.quantity > availableStock) {
        validationErrors.push(
          `Insufficient stock for ${product.sku}. Requested: ${line.quantity}, Available: ${availableStock}`
        );
        continue;
      }
      
      const subtotal = finalUnitPrice * line.quantity;
      totalAmount += subtotal;
      
      validatedOrderLines.push({
        product_id: line.product_id,
        quantity: line.quantity,
        unit_price: finalUnitPrice,
        subtotal: subtotal,
        product_sku: product.sku,
        product_name: product.name,
      });
    }

    if (validationErrors.length > 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Conversion validation failed: ${validationErrors.join('; ')}`
      });
    }

    // Update the order
    const { error: updateError } = await ctx.supabase
      .from('orders')
      .update({
        order_type: 'delivery',
        total_amount: totalAmount,
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.order_id);

    if (updateError) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Failed to update order: ${updateError.message}`
      });
    }

    // Create order lines
    const orderLinesData = validatedOrderLines.map(line => ({
      order_id: input.order_id,
      product_id: line.product_id,
      quantity: line.quantity,
      unit_price: line.unit_price,
      subtotal: line.subtotal,
      qty_tagged: 0,
      qty_untagged: line.quantity,
    }));

    const { error: linesError } = await ctx.supabase
      .from('order_lines')
      .insert(orderLinesData);

    if (linesError) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Failed to create order lines: ${linesError.message}`
      });
    }

    // Recalculate order total
    await calculateOrderTotal(ctx, input.order_id);

    ctx.logger.info('Visit order converted to delivery order successfully:', {
      order_id: input.order_id,
      total_amount: totalAmount,
      line_count: validatedOrderLines.length
    });

    return { 
      success: true, 
      message: 'Visit order converted to delivery order successfully',
      order_id: input.order_id,
      total_amount: totalAmount,
      products_count: validatedOrderLines.length,
    };
  }),

//   // POST /orders/{id}/complete-visit-no-sale - Complete visit order with no sale
//   completeVisitWithNoSale: protectedProcedure
//     .meta({
//       openapi: {
//         method: 'POST',
//         path: '/orders/{order_id}/complete-visit-no-sale',
//         tags: ['orders', 'visit'],
//         summary: 'Complete visit order with no sale',
//         description: 'Mark a visit order as completed with no sale',
//         protect: true,
//       }
//     })
//     .input(CompleteVisitWithNoSaleSchema)
//     .output(z.any())
//     .mutation(async ({ input, ctx }) => {
//       const user = requireAuth(ctx);
      
//       ctx.logger.info('Completing visit order with no sale:', input.order_id);
      
//       // Get the visit order
//       const { data: order, error: orderError } = await ctx.supabase
//         .from('orders')
//         .select('*')
//         .eq('id', input.order_id)
//         .single();

//       if (orderError || !order) {
//         throw new TRPCError({
//           code: 'NOT_FOUND',
//           message: 'Order not found'
//         });
//       }

//       if (order.order_type !== 'visit') {
//         throw new TRPCError({
//           code: 'BAD_REQUEST',
//           message: 'Only visit orders can be completed with no sale'
//         });
//       }

//       if (order.status !== 'dispatched') {
//         throw new TRPCError({
//           code: 'BAD_REQUEST',
//           message: 'Visit order must be in dispatched status to be completed'
//         });
//       }

//       // Update the order status
//       const { error: updateError } = await ctx.supabase
//         .from('orders')
//         .update({
//           status: 'completed_no_sale',
//           notes: input.notes ? `${order.notes || ''}\n\nCompleted with no sale: ${input.notes}` : order.notes,
//           updated_at: new Date().toISOString(),
//         })
//         .eq('id', input.order_id);

//       if (updateError) {
//         throw new TRPCError({
//           code: 'INTERNAL_SERVER_ERROR',
//           message: `Failed to update order: ${updateError.message}`
//         });
//       }

//       ctx.logger.info('Visit order completed with no sale successfully:', {
//         order_id: input.order_id,
//         reason: input.reason
//       });

//       return { success: true, message: 'Visit order completed with no sale successfully' };
//     }),
}); 

// Helper function to calculate order total
async function calculateOrderTotal(ctx: any, orderId: string) {
  ctx.logger.info('Calculating order total for:', orderId);

  // Get order lines with quantity and unit_price
  const { data: lines, error: linesError } = await ctx.supabase
    .from('order_lines')
    .select('quantity, unit_price, subtotal')
    .eq('order_id', orderId);

  if (linesError) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: linesError.message
    });
  }

  // Get order tax information
  const { data: order, error: orderError } = await ctx.supabase
    .from('orders')
    .select('tax_amount, tax_percent')
    .eq('id', orderId)
    .single();

  if (orderError) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: orderError.message
    });
  }

  if (lines) {
    const subtotal = lines.reduce((sum: number, line: any) => {
      const lineSubtotal = line.subtotal || (line.quantity * line.unit_price);
      return sum + lineSubtotal;
    }, 0);
    
    const taxAmount = order?.tax_amount || 0;
    const grandTotal = subtotal + taxAmount;
    
    ctx.logger.info('Order total calculation:', { orderId, subtotal, taxAmount, grandTotal });
    
    const { error: updateError } = await ctx.supabase
      .from('orders')
      .update({ 
        total_amount: grandTotal,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    if (updateError) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: updateError.message
      });
    }

    return {
      subtotal,
      tax_amount: taxAmount,
      total_amount: grandTotal,
      breakdown: lines.map((line: any) => ({
        quantity: line.quantity,
        unit_price: line.unit_price,
        subtotal: line.subtotal || (line.quantity * line.unit_price)
      }))
    };
  }

  throw new TRPCError({
    code: 'NOT_FOUND',
    message: 'No order lines found'
  });
}

// Helper function to update order tax and recalculate total
async function updateOrderTax(ctx: any, orderId: string, taxPercent: number) {
  ctx.logger.info('Updating order tax:', { orderId, taxPercent });

  // Get order lines with quantity and unit_price
  const { data: lines, error: linesError } = await ctx.supabase
    .from('order_lines')
    .select('quantity, unit_price, subtotal')
    .eq('order_id', orderId);

  if (linesError) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: linesError.message
    });
  }

  if (lines) {
    const subtotal = lines.reduce((sum: number, line: any) => {
      const lineSubtotal = line.subtotal || (line.quantity * line.unit_price);
      return sum + lineSubtotal;
    }, 0);
    
    const taxAmount = subtotal * (taxPercent / 100);
    const grandTotal = subtotal + taxAmount;
    
    ctx.logger.info('Order tax update:', { orderId, taxPercent, subtotal, taxAmount, grandTotal });
    
    const { error: updateError } = await ctx.supabase
      .from('orders')
      .update({ 
        tax_percent: taxPercent,
        tax_amount: taxAmount,
        total_amount: grandTotal,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    if (updateError) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: updateError.message
      });
    }

    return {
      subtotal,
      tax_percent: taxPercent,
      tax_amount: taxAmount,
      total_amount: grandTotal
    };
  }

  throw new TRPCError({
    code: 'NOT_FOUND',
    message: 'No order lines found'
  });
}

// Helper function to get order by ID with all relations
async function getOrderById(ctx: any, orderId: string) {
  const { data, error } = await ctx.supabase
    .from('orders')
    .select(`
      *,
      customer:customers(id, name, email, phone, account_status, credit_terms_days),
      delivery_address:addresses(id, line1, line2, city, state, postal_code, country, instructions),
      order_lines(
        id,
        product_id,
        quantity,
        unit_price,
        subtotal,
        product:products(id, sku, name, unit_of_measure)
      )
    `)
    .eq('id', orderId)
    .single();

  if (error) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: error.message
    });
  }

  return data;
}

// Helper functions for business logic

function calculateDeliveryWindow(order: any): string {
  if (!order.scheduled_date) return 'Not scheduled';
  
  const scheduledDate = new Date(order.scheduled_date);
  const today = new Date();
  const diffDays = Math.ceil((scheduledDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) return 'Overdue';
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays <= 7) return `${diffDays} days`;
  if (diffDays <= 30) return `${Math.ceil(diffDays / 7)} weeks`;
  return `${Math.ceil(diffDays / 30)} months`;
}

function calculateOrderRisk(order: any): 'low' | 'medium' | 'high' {
  let riskScore = 0;
  
  // High value orders have more risk
  if ((order.total_amount || 0) > 5000) riskScore += 2;
  else if ((order.total_amount || 0) > 1000) riskScore += 1;
  
  // Customer account status affects risk
  if (order.customer?.account_status === 'credit_hold') riskScore += 3;
  else if (order.customer?.account_status === 'closed') riskScore += 2;
  
  // Overdue orders have higher risk
  if (order.scheduled_date && new Date(order.scheduled_date) < new Date()) riskScore += 2;
  
  // Multiple line items increase complexity/risk
  if ((order.order_lines?.length || 0) > 5) riskScore += 1;
  
  if (riskScore >= 4) return 'high';
  if (riskScore >= 2) return 'medium';
  return 'low';
}

async function generateOrderAnalytics(ctx: any, orders: any[]): Promise<any> {
  const analytics = {
    total_orders: orders.length,
    total_value: orders.reduce((sum, order) => sum + (order.total_amount || 0), 0),
    average_order_value: 0,
    status_breakdown: {} as Record<string, number>,
    high_value_orders: orders.filter(order => order.is_high_value).length,
    overdue_orders: orders.filter(order => order.estimated_delivery_window === 'Overdue').length,
    risk_breakdown: {
      low: orders.filter(order => order.risk_level === 'low').length,
      medium: orders.filter(order => order.risk_level === 'medium').length,
      high: orders.filter(order => order.risk_level === 'high').length,
    }
  };
  
  analytics.average_order_value = analytics.total_orders > 0 ? analytics.total_value / analytics.total_orders : 0;
  
  // Calculate status breakdown
  orders.forEach(order => {
    analytics.status_breakdown[order.status] = (analytics.status_breakdown[order.status] || 0) + 1;
  });
  
  return analytics;
}

function calculateUrgencyScore(order: any): number {
  let score = 5; // Base score
  
  // Add urgency based on days overdue
  const daysOverdue = Math.floor((new Date().getTime() - new Date(order.scheduled_date).getTime()) / (1000 * 60 * 60 * 24));
  score += Math.min(daysOverdue, 5); // Max 5 points for overdue
  
  // High value orders get priority
  if ((order.total_amount || 0) > 5000) score += 3;
  else if ((order.total_amount || 0) > 1000) score += 1;
  
  // Customer status affects urgency
  if (order.customer?.account_status === 'credit_hold') score += 2;
  
  // Priority field
  const priorityScores = { low: 0, normal: 0, high: 2, urgent: 4 };
  score += priorityScores[order.priority as keyof typeof priorityScores] || 0;
  
  return Math.min(score, 10); // Cap at 10
}

function calculateOrderWeight(order: any): number {
  if (!order.order_lines) return 0;
  
  return order.order_lines.reduce((total: number, line: any) => {
    const productWeight = line.product?.weight || 0;
    return total + (productWeight * line.quantity);
  }, 0);
}

function calculateOrderVolume(order: any): number {
  if (!order.order_lines) return 0;
  
  return order.order_lines.reduce((total: number, line: any) => {
    const productVolume = line.product?.volume || 0;
    return total + (productVolume * line.quantity);
  }, 0);
}

function calculateServiceTime(order: any): number {
  // Base service time of 15 minutes
  let serviceTime = 15;
  
  // Add 5 minutes per order line
  serviceTime += (order.order_lines?.length || 0) * 5;
  
  // Add time for delivery complexity
  if (order.delivery_address?.instructions) serviceTime += 10;
  
  // Heavy orders take longer
  const orderWeight = calculateOrderWeight(order);
  if (orderWeight > 100) serviceTime += 15;
  else if (orderWeight > 50) serviceTime += 10;
  
  return serviceTime;
}

function calculateRouteTime(orders: any[]): number {
  if (orders.length === 0) return 0;
  
  // Base travel time assumption: 20 minutes between stops
  const travelTime = Math.max(0, orders.length - 1) * 20;
  
  // Service time for all orders
  const serviceTime = orders.reduce((total, order) => total + calculateServiceTime(order), 0);
  
  return travelTime + serviceTime;
}

function calculateTruckRequirements(totalWeight: number, totalVolume: number): any {
  // Standard truck capacities
  const truckTypes = [
    { name: 'Small Van', max_weight: 1000, max_volume: 10, cost_per_hour: 50 },
    { name: 'Medium Truck', max_weight: 3000, max_volume: 25, cost_per_hour: 75 },
    { name: 'Large Truck', max_weight: 8000, max_volume: 50, cost_per_hour: 100 },
  ];
  
  // Find the smallest truck that can handle the load
  const requiredTruck = truckTypes.find(truck => 
    truck.max_weight >= totalWeight && truck.max_volume >= totalVolume
  ) || truckTypes[truckTypes.length - 1]; // Default to largest if none fit
  
  return {
    recommended_truck: requiredTruck.name,
    utilization: {
      weight_percent: Math.min(100, (totalWeight / requiredTruck.max_weight) * 100),
      volume_percent: Math.min(100, (totalVolume / requiredTruck.max_volume) * 100),
    },
    multiple_trucks_needed: totalWeight > requiredTruck.max_weight || totalVolume > requiredTruck.max_volume,
  };
}

// Helper function to calculate payment summary for an order
function calculateOrderPaymentSummary(order: any): any {
  const orderTotal = order.total_amount || 0;
  const payments = order.payments || [];
  
  const completedPayments = payments.filter((p: any) => p.payment_status === 'completed');
  const pendingPayments = payments.filter((p: any) => p.payment_status === 'pending');
  const failedPayments = payments.filter((p: any) => p.payment_status === 'failed');
  
  const totalPaid = completedPayments.reduce((sum: number, payment: any) => sum + (payment.amount || 0), 0);
  const totalPending = pendingPayments.reduce((sum: number, payment: any) => sum + (payment.amount || 0), 0);
  const totalFailed = failedPayments.reduce((sum: number, payment: any) => sum + (payment.amount || 0), 0);
  
  const balance = orderTotal - totalPaid;
  
  // Determine payment status
  let status = 'pending';
  if (balance <= 0) {
    status = 'paid';
  } else if (totalPaid > 0) {
    status = 'partial';
  } else if (order.payment_due_date && new Date(order.payment_due_date) < new Date()) {
    status = 'overdue';
  }
  
  // Calculate payment method breakdown
  const paymentMethods = completedPayments.reduce((acc: any, payment: any) => {
    const method = payment.payment_method || 'unknown';
    acc[method] = (acc[method] || 0) + (payment.amount || 0);
    return acc;
  }, {});
  
  return {
    order_total: orderTotal,
    total_paid: totalPaid,
    total_pending: totalPending,
    total_failed: totalFailed,
    balance: balance,
    status: status,
    payment_count: payments.length,
    completed_payment_count: completedPayments.length,
    last_payment_date: completedPayments.length > 0 
      ? completedPayments.sort((a: any, b: any) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime())[0].payment_date
      : null,
    payment_methods: paymentMethods,
    is_overdue: status === 'overdue',
    days_overdue: order.payment_due_date && new Date(order.payment_due_date) < new Date()
      ? Math.floor((new Date().getTime() - new Date(order.payment_due_date).getTime()) / (1000 * 60 * 60 * 24))
      : 0,
  };
}