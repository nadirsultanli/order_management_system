import { z } from 'zod';
import { router, protectedProcedure } from '../lib/trpc';
import { requireTenantAccess } from '../lib/auth';
import { TRPCError } from '@trpc/server';
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

const OrderStatusEnum = z.enum(['draft', 'confirmed', 'scheduled', 'en_route', 'delivered', 'invoiced', 'cancelled']);

export const ordersRouter = router({
  // GET /orders - List orders with advanced filtering and business logic
  list: protectedProcedure
    .input(z.object({
      status: OrderStatusEnum.optional(),
      customer_id: z.string().uuid().optional(),
      search: z.string().optional(),
      order_date_from: z.string().optional(),
      order_date_to: z.string().optional(),
      scheduled_date_from: z.string().optional(),
      scheduled_date_to: z.string().optional(),
      amount_min: z.number().optional(),
      amount_max: z.number().optional(),
      delivery_area: z.string().optional(),
      is_overdue: z.boolean().optional(),
      delivery_method: z.enum(['pickup', 'delivery']).optional(),
      priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
      customer_type: z.enum(['retail', 'wholesale', 'government']).optional(),
      payment_status: z.enum(['pending', 'paid', 'overdue']).optional(),
      sort_by: z.enum(['created_at', 'order_date', 'scheduled_date', 'total_amount', 'customer_name']).default('created_at'),
      sort_order: z.enum(['asc', 'desc']).default('desc'),
      include_analytics: z.boolean().default(false),
      page: z.number().min(1).default(1),
      limit: z.number().min(1).max(100).default(50),
    }))
    .query(async ({ input, ctx }) => {
      const user = requireTenantAccess(ctx);
      
      ctx.logger.info('Fetching orders with advanced filters:', input);
      
      let query = ctx.supabase
        .from('orders')
        .select(`
          *,
          customer:customers(id, name, email, phone, account_status, credit_terms_days, customer_type),
          delivery_address:addresses(id, line1, line2, city, state, postal_code, country, instructions),
          order_lines(
            id,
            product_id,
            quantity,
            unit_price,
            subtotal,
            product:products(id, sku, name, unit_of_measure)
          )
        `, { count: 'exact' });

      // Enhanced search with multi-field support including product SKU
      if (input.search) {
        query = query.or(`
          id.ilike.%${input.search}%,
          customer.name.ilike.%${input.search}%,
          customer.email.ilike.%${input.search}%,
          order_lines.product.sku.ilike.%${input.search}%,
          order_lines.product.name.ilike.%${input.search}%,
          delivery_address.city.ilike.%${input.search}%
        `);
      }

      // Apply status filter
      if (input.status) {
        query = query.eq('status', input.status);
      }

      // Apply customer filter
      if (input.customer_id) {
        query = query.eq('customer_id', input.customer_id);
      }

      // Apply customer type filter (business logic)
      if (input.customer_type) {
        query = query.eq('customer.customer_type', input.customer_type);
      }

      // Apply date filters
      if (input.order_date_from) {
        query = query.gte('order_date', input.order_date_from);
      }
      if (input.order_date_to) {
        query = query.lte('order_date', input.order_date_to);
      }
      if (input.scheduled_date_from) {
        query = query.gte('scheduled_date', input.scheduled_date_from);
      }
      if (input.scheduled_date_to) {
        query = query.lte('scheduled_date', input.scheduled_date_to);
      }

      // Apply amount range filter (business logic)
      if (input.amount_min !== undefined) {
        query = query.gte('total_amount', input.amount_min);
      }
      if (input.amount_max !== undefined) {
        query = query.lte('total_amount', input.amount_max);
      }

      // Apply delivery area filter (business logic)
      if (input.delivery_area) {
        query = query.or(`
          delivery_address.city.ilike.%${input.delivery_area}%,
          delivery_address.state.ilike.%${input.delivery_area}%,
          delivery_address.postal_code.ilike.%${input.delivery_area}%
        `);
      }

      // Apply overdue filter (complex business logic)
      if (input.is_overdue) {
        const today = new Date().toISOString().split('T')[0];
        query = query
          .eq('status', 'scheduled')
          .lt('scheduled_date', today);
      }

      // Apply delivery method filter
      if (input.delivery_method) {
        query = query.eq('delivery_method', input.delivery_method);
      }

      // Apply priority filter
      if (input.priority) {
        query = query.eq('priority', input.priority);
      }

      // Apply payment status filter (business logic)
      if (input.payment_status) {
        if (input.payment_status === 'overdue') {
          // Orders that are invoiced but past due date
          const overdueDate = new Date();
          overdueDate.setDate(overdueDate.getDate() - 30); // 30 days overdue
          query = query
            .eq('status', 'invoiced')
            .lt('invoice_date', overdueDate.toISOString());
        } else if (input.payment_status === 'paid') {
          query = query.not('payment_date', 'is', null);
        } else if (input.payment_status === 'pending') {
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
      
      const sortField = sortMapping[input.sort_by] || 'created_at';
      query = query.order(sortField, { ascending: input.sort_order === 'asc' });

      // Apply pagination
      const from = (input.page - 1) * input.limit;
      const to = from + input.limit - 1;
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
      orders = orders.map(order => ({
        ...order,
        // Calculate business metrics
        is_high_value: (order.total_amount || 0) > 1000,
        days_since_order: Math.floor((new Date().getTime() - new Date(order.order_date).getTime()) / (1000 * 60 * 60 * 24)),
        estimated_delivery_window: calculateDeliveryWindow(order),
        risk_level: calculateOrderRisk(order),
      }));

      return {
        orders,
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / input.limit),
        currentPage: input.page,
        // Include analytics if requested
        analytics: input.include_analytics ? await generateOrderAnalytics(ctx, orders) : undefined,
      };
    }),

  // GET /orders/{id} - Get single order
  getById: protectedProcedure
    .input(z.object({
      order_id: z.string().uuid(),
    }))
    .query(async ({ input, ctx }) => {
      const user = requireTenantAccess(ctx);
      
      ctx.logger.info('Fetching order:', input.order_id);
      
      const { data, error } = await ctx.supabase
        .from('orders')
        .select(`
          *,
          customer:customers(id, name, email, phone, account_status, credit_terms_days, 
            billing_address:addresses!customers_billing_address_id_fkey(id, line1, line2, city, state, postal_code, country)),
          delivery_address:addresses(id, line1, line2, city, state, postal_code, country, instructions),
          order_lines(
            id,
            product_id,
            quantity,
            unit_price,
            subtotal,
            product:products(id, sku, name, unit_of_measure, weight, volume)
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

      return data;
    }),

  // GET /orders/overdue - Get overdue orders with business logic
  getOverdue: protectedProcedure
    .input(z.object({
      days_overdue_min: z.number().min(0).default(1),
      include_cancelled: z.boolean().default(false),
      priority_filter: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
    }))
    .query(async ({ input, ctx }) => {
      const user = requireTenantAccess(ctx);
      
      ctx.logger.info('Fetching overdue orders with criteria:', input);
      
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - input.days_overdue_min);
      
      let query = ctx.supabase
        .from('orders')
        .select(`
          *,
          customer:customers(id, name, email, phone, account_status),
          delivery_address:addresses(id, line1, line2, city, state, postal_code, country)
        `)
        .eq('status', 'scheduled')
        .lt('scheduled_date', cutoffDate.toISOString().split('T')[0]);

      if (!input.include_cancelled) {
        query = query.neq('status', 'cancelled');
      }

      if (input.priority_filter) {
        query = query.eq('priority', input.priority_filter);
      }

      query = query.order('scheduled_date', { ascending: true });

      const { data, error } = await query;

      if (error) {
        ctx.logger.error('Overdue orders error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message
        });
      }

      const orders = (data || []).map(order => ({
        ...order,
        days_overdue: Math.floor((new Date().getTime() - new Date(order.scheduled_date).getTime()) / (1000 * 60 * 60 * 24)),
        urgency_score: calculateUrgencyScore(order),
      }));

      return {
        orders,
        summary: {
          total_overdue: orders.length,
          total_value: orders.reduce((sum, order) => sum + (order.total_amount || 0), 0),
          avg_days_overdue: orders.length > 0 ? orders.reduce((sum, order) => sum + order.days_overdue, 0) / orders.length : 0,
          high_priority_count: orders.filter(order => order.urgency_score >= 8).length,
        }
      };
    }),

  // GET /orders/delivery-calendar - Get orders by delivery date with route optimization data
  getDeliveryCalendar: protectedProcedure
    .input(z.object({
      date_from: z.string(),
      date_to: z.string(),
      delivery_area: z.string().optional(),
      truck_capacity_filter: z.boolean().default(false),
      optimize_routes: z.boolean().default(false),
    }))
    .query(async ({ input, ctx }) => {
      const user = requireTenantAccess(ctx);
      
      ctx.logger.info('Fetching delivery calendar:', input);
      
      let query = ctx.supabase
        .from('orders')
        .select(`
          *,
          customer:customers(id, name, email, phone),
          delivery_address:addresses(id, line1, line2, city, state, postal_code, country, latitude, longitude),
          order_lines(
            id,
            product_id,
            quantity,
            product:products(id, sku, name, weight, volume)
          )
        `)
        .gte('scheduled_date', input.date_from)
        .lte('scheduled_date', input.date_to)
        .in('status', ['scheduled', 'en_route']);

      if (input.delivery_area) {
        query = query.or(`
          delivery_address.city.ilike.%${input.delivery_area}%,
          delivery_address.state.ilike.%${input.delivery_area}%
        `);
      }

      query = query.order('scheduled_date', { ascending: true });

      const { data, error } = await query;

      if (error) {
        ctx.logger.error('Delivery calendar error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message
        });
      }

      const orders = data || [];
      
      // Group by date and calculate logistics metrics
      const deliveryDays = orders.reduce((acc, order) => {
        const date = order.scheduled_date;
        if (!acc[date]) {
          acc[date] = {
            date,
            orders: [],
            total_orders: 0,
            total_value: 0,
            total_weight: 0,
            total_volume: 0,
            estimated_route_time: 0,
            delivery_areas: new Set(),
          };
        }

        const orderWeight = calculateOrderWeight(order);
        const orderVolume = calculateOrderVolume(order);
        
        acc[date].orders.push({
          ...order,
          order_weight: orderWeight,
          order_volume: orderVolume,
          estimated_service_time: calculateServiceTime(order),
        });

        acc[date].total_orders++;
        acc[date].total_value += order.total_amount || 0;
        acc[date].total_weight += orderWeight;
        acc[date].total_volume += orderVolume;
        acc[date].delivery_areas.add(order.delivery_address?.city || 'Unknown');

        return acc;
      }, {} as Record<string, any>);

      // Convert Sets to arrays for JSON serialization
      Object.values(deliveryDays).forEach((day: any) => {
        day.delivery_areas = Array.from(day.delivery_areas);
        day.estimated_route_time = calculateRouteTime(day.orders);
        day.truck_requirements = calculateTruckRequirements(day.total_weight, day.total_volume);
      });

      return {
        delivery_schedule: Object.values(deliveryDays),
        summary: {
          total_delivery_days: Object.keys(deliveryDays).length,
          total_orders: orders.length,
          total_value: orders.reduce((sum, order) => sum + (order.total_amount || 0), 0),
          peak_day: Object.values(deliveryDays).sort((a: any, b: any) => b.total_orders - a.total_orders)[0],
        }
      };
    }),

  // POST /orders - Create new order
  create: protectedProcedure
    .input(z.object({
      customer_id: z.string().uuid(),
      delivery_address_id: z.string().uuid().optional(),
      scheduled_date: z.string().datetime().optional(),
      notes: z.string().optional(),
      order_lines: z.array(z.object({
        product_id: z.string().uuid(),
        quantity: z.number().positive(),
        unit_price: z.number().positive().optional(),
      })),
    }))
    .mutation(async ({ input, ctx }) => {
      const user = requireTenantAccess(ctx);
      
      ctx.logger.info('Creating order for customer:', input.customer_id);

      // Verify customer belongs to user's tenant
      const { data: customer, error: customerError } = await ctx.supabase
        .from('customers')
        .select('id, name')
        .eq('id', input.customer_id)
        
        .single();

      if (customerError || !customer) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Customer not found'
        });
      }

      // Create order
      const orderData = {
        customer_id: input.customer_id,
        delivery_address_id: input.delivery_address_id,
        scheduled_date: input.scheduled_date,
        notes: input.notes,
        status: 'draft' as const,
        order_date: new Date().toISOString(),
        
        created_by: user.id,
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

      // Create order lines
      const orderLinesData = input.order_lines.map(line => ({
        order_id: order.id,
        product_id: line.product_id,
        quantity: line.quantity,
        unit_price: line.unit_price || 0,
        subtotal: (line.unit_price || 0) * line.quantity,
        
      }));

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

      // Calculate and update order total
      await calculateOrderTotal(ctx, order.id, user.id);

      // Return complete order with relations
      return await getOrderById(ctx, order.id, user.id);
    }),

  // POST /orders/{id}/calculate-total - Calculate order total
  calculateTotal: protectedProcedure
    .input(z.object({
      order_id: z.string().uuid(),
    }))
    .mutation(async ({ input, ctx }) => {
      const user = requireTenantAccess(ctx);
      
      return await calculateOrderTotal(ctx, input.order_id, user.id);
    }),

  // POST /orders/{id}/status - Update order status
  updateStatus: protectedProcedure
    .input(z.object({
      order_id: z.string().uuid(),
      new_status: OrderStatusEnum,
      scheduled_date: z.string().datetime().optional(),
      reason: z.string().optional(),
      metadata: z.record(z.any()).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const user = requireTenantAccess(ctx);
      
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
        // Reserve inventory
        if (currentOrder.order_lines) {
          for (const line of currentOrder.order_lines) {
            await ctx.supabase.rpc('reserve_stock', {
              p_product_id: line.product_id,
              p_quantity: line.quantity,
              
            });
          }
        }
      } else if (input.new_status === 'delivered' && 
                 ['confirmed', 'scheduled', 'en_route'].includes(currentOrder.status)) {
        // Deduct actual stock and release reserved
        if (currentOrder.order_lines) {
          for (const line of currentOrder.order_lines) {
            await ctx.supabase.rpc('fulfill_order_line', {
              p_product_id: line.product_id,
              p_quantity: line.quantity,
              
            });
          }
        }
      } else if (input.new_status === 'cancelled' && currentOrder.status === 'confirmed') {
        // Release reserved stock
        if (currentOrder.order_lines) {
          for (const line of currentOrder.order_lines) {
            await ctx.supabase.rpc('release_reserved_stock', {
              p_product_id: line.product_id,
              p_quantity: line.quantity,
              
            });
          }
        }
      }

      // Update order status
      const updateData: any = {
        status: input.new_status,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
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
    .input(z.object({
      order_id: z.string().uuid(),
      tax_percent: z.number().min(0).max(100),
    }))
    .mutation(async ({ input, ctx }) => {
      const user = requireTenantAccess(ctx);
      
      return await updateOrderTax(ctx, input.order_id, input.tax_percent, user.id);
    }),

  // Workflow endpoints
  
  // GET /orders/workflow - Get order workflow steps
  getWorkflow: protectedProcedure
    .query(async ({ ctx }) => {
      requireTenantAccess(ctx);
      
      ctx.logger.info('Fetching order workflow');
      
      return getOrderWorkflow();
    }),

  // POST /orders/workflow/validate-transition - Validate status transition
  validateTransition: protectedProcedure
    .input(StatusTransitionSchema)
    .mutation(async ({ input, ctx }) => {
      requireTenantAccess(ctx);
      
      ctx.logger.info('Validating status transition:', input);
      
      return validateTransition(input.current_status, input.new_status);
    }),

  // POST /orders/workflow/calculate-totals - Calculate order totals with tax
  calculateTotals: protectedProcedure
    .input(CalculateTotalsSchema)
    .mutation(async ({ input, ctx }) => {
      requireTenantAccess(ctx);
      
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
    .input(z.object({
      order: z.any(), // We'll validate the structure in the function
    }))
    .mutation(async ({ input, ctx }) => {
      requireTenantAccess(ctx);
      
      ctx.logger.info('Validating order for confirmation:', input.order.id);
      
      return validateOrderForConfirmation(input.order);
    }),

  // POST /orders/workflow/validate-for-scheduling - Validate order for scheduling
  validateForScheduling: protectedProcedure
    .input(z.object({
      order: z.any(), // We'll validate the structure in the function
    }))
    .mutation(async ({ input, ctx }) => {
      requireTenantAccess(ctx);
      
      ctx.logger.info('Validating order for scheduling:', input.order.id);
      
      return validateOrderForScheduling(input.order);
    }),

  // POST /orders/workflow/validate-delivery-window - Validate order delivery window
  validateDeliveryWindow: protectedProcedure
    .input(z.object({
      order: z.any(), // We'll validate the structure in the function
    }))
    .mutation(async ({ input, ctx }) => {
      requireTenantAccess(ctx);
      
      ctx.logger.info('Validating order delivery window:', input.order.id);
      
      return validateOrderDeliveryWindow(input.order);
    }),

  // GET /orders/{id}/workflow-info - Get workflow information for a specific order
  getWorkflowInfo: protectedProcedure
    .input(z.object({
      order_id: z.string().uuid(),
    }))
    .query(async ({ input, ctx }) => {
      const user = requireTenantAccess(ctx);
      
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

  // Utility endpoints for formatting
  
  // POST /orders/workflow/format-order-id - Format order ID for display
  formatOrderId: protectedProcedure
    .input(z.object({
      order_id: z.string().uuid(),
    }))
    .mutation(async ({ input, ctx }) => {
      requireTenantAccess(ctx);
      
      return {
        formatted_id: formatOrderId(input.order_id),
      };
    }),

  // POST /orders/workflow/format-currency - Format currency amount
  formatCurrency: protectedProcedure
    .input(z.object({
      amount: z.number(),
    }))
    .mutation(async ({ input, ctx }) => {
      requireTenantAccess(ctx);
      
      return {
        formatted_amount: formatCurrency(input.amount),
      };
    }),

  // POST /orders/workflow/format-date - Format date for display
  formatDate: protectedProcedure
    .input(z.object({
      date: z.string().datetime(),
    }))
    .mutation(async ({ input, ctx }) => {
      requireTenantAccess(ctx);
      
      return {
        formatted_date: formatDate(input.date),
      };
    }),
});

// Helper function to calculate order total
async function calculateOrderTotal(ctx: any, orderId: string, tenantId: string) {
  ctx.logger.info('Calculating order total for:', orderId);

  // Get order lines with quantity and unit_price
  const { data: lines, error: linesError } = await ctx.supabase
    .from('order_lines')
    .select('quantity, unit_price, subtotal')
    .eq('order_id', orderId)
    .eq('tenant_id', tenantId);

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
    .eq('tenant_id', tenantId)
    .single();

  if (orderError) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: orderError.message
    });
  }

  if (lines) {
    const subtotal = lines.reduce((sum, line) => {
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
      .eq('id', orderId)
      .eq('tenant_id', tenantId);

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
      breakdown: lines.map(line => ({
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
async function updateOrderTax(ctx: any, orderId: string, taxPercent: number, tenantId: string) {
  ctx.logger.info('Updating order tax:', { orderId, taxPercent });

  // Get order lines with quantity and unit_price
  const { data: lines, error: linesError } = await ctx.supabase
    .from('order_lines')
    .select('quantity, unit_price, subtotal')
    .eq('order_id', orderId)
    .eq('tenant_id', tenantId);

  if (linesError) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: linesError.message
    });
  }

  if (lines) {
    const subtotal = lines.reduce((sum, line) => {
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
      .eq('id', orderId)
      .eq('tenant_id', tenantId);

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
async function getOrderById(ctx: any, orderId: string, tenantId: string) {
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
    .eq('tenant_id', tenantId)
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