import { z } from 'zod';
import { router, protectedProcedure } from '../lib/trpc';
import { requireAuth } from '../lib/auth';
import { TRPCError } from '@trpc/server';

// Zod schemas for input validation
const PaymentMethodEnum = z.enum(['Cash', 'Mpesa', 'Card']);
const PaymentStatusEnum = z.enum(['pending', 'completed', 'failed', 'refunded']);

const RecordPaymentSchema = z.object({
  order_id: z.string().uuid(),
  amount: z.number().positive(),
  payment_method: PaymentMethodEnum,
  transaction_id: z.string().optional(),
  payment_date: z.string().datetime().optional(),
  reference_number: z.string().optional(),
  notes: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

const PaymentFiltersSchema = z.object({
  order_id: z.string().uuid().optional(),
  payment_method: PaymentMethodEnum.optional(),
  payment_status: PaymentStatusEnum.optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  amount_min: z.number().optional(),
  amount_max: z.number().optional(),
  search: z.string().optional(), // Search by payment_id, transaction_id, or reference_number
  sort_by: z.enum(['payment_date', 'amount', 'created_at', 'payment_id']).default('payment_date'),
  sort_order: z.enum(['asc', 'desc']).default('desc'),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(50),
});

const UpdatePaymentStatusSchema = z.object({
  payment_id: z.string().uuid(),
  payment_status: PaymentStatusEnum,
  transaction_id: z.string().optional(),
  notes: z.string().optional(),
});

export const paymentsRouter = router({
  // POST /payments - Record a new payment
  create: protectedProcedure
    .input(RecordPaymentSchema)
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Recording payment for order:', input.order_id);

      // Validate payment against order
      const { data: validation, error: validationError } = await ctx.supabase
        .rpc('validate_payment_for_order', {
          p_order_id: input.order_id,
          p_amount: input.amount
        });

      if (validationError) {
        ctx.logger.error('Payment validation error:', validationError);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: validationError.message
        });
      }

      if (!validation.valid) {
        const errors = validation.errors || [];
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Payment validation failed: ${errors.join(', ')}`
        });
      }

      // Create payment record
      const paymentData = {
        order_id: input.order_id,
        amount: input.amount,
        payment_method: input.payment_method,
        payment_status: 'completed' as const, // Default to completed for manual payments
        transaction_id: input.transaction_id,
        payment_date: input.payment_date || new Date().toISOString(),
        reference_number: input.reference_number,
        notes: input.notes,
        metadata: input.metadata || {},
        created_by: user.id,
      };

      const { data: payment, error: paymentError } = await ctx.supabase
        .from('payments')
        .insert(paymentData)
        .select(`
          *,
          order:orders(
            id,
            total_amount,
            status,
            customer:customers(id, name, email)
          )
        `)
        .single();

      if (paymentError) {
        ctx.logger.error('Payment creation error:', paymentError);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: paymentError.message
        });
      }

      // Update order payment date if this is the first payment
      if (payment.order && !payment.order.payment_date) {
        await ctx.supabase
          .from('orders')
          .update({ 
            payment_date: payment.payment_date,
            updated_at: new Date().toISOString()
          })
          .eq('id', input.order_id);
      }

      ctx.logger.info('Payment recorded successfully:', payment.id);
      return payment;
    }),

  // GET /payments - List payments with filtering
  list: protectedProcedure
    .input(PaymentFiltersSchema)
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Fetching payments with filters:', input);

      let query = ctx.supabase
        .from('payments')
        .select(`
          *,
          order:orders(
            id,
            total_amount,
            status,
            customer:customers(id, name, email, phone)
          )
        `, { count: 'exact' });

      // Apply filters
      if (input.order_id) {
        query = query.eq('order_id', input.order_id);
      }

      if (input.payment_method) {
        query = query.eq('payment_method', input.payment_method);
      }

      if (input.payment_status) {
        query = query.eq('payment_status', input.payment_status);
      }

      // Date range filters
      if (input.date_from) {
        query = query.gte('payment_date', input.date_from);
      }
      if (input.date_to) {
        query = query.lte('payment_date', input.date_to);
      }

      // Amount range filters
      if (input.amount_min !== undefined) {
        query = query.gte('amount', input.amount_min);
      }
      if (input.amount_max !== undefined) {
        query = query.lte('amount', input.amount_max);
      }

      // Search filter
      if (input.search) {
        query = query.or(`
          payment_id.ilike.%${input.search}%,
          transaction_id.ilike.%${input.search}%,
          reference_number.ilike.%${input.search}%,
          notes.ilike.%${input.search}%
        `);
      }

      // Apply sorting
      const sortMapping: Record<string, string> = {
        'payment_date': 'payment_date',
        'amount': 'amount',
        'created_at': 'created_at',
        'payment_id': 'payment_id'
      };
      
      const sortField = sortMapping[input.sort_by] || 'payment_date';
      query = query.order(sortField, { ascending: input.sort_order === 'asc' });

      // Apply pagination
      const from = (input.page - 1) * input.limit;
      const to = from + input.limit - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) {
        ctx.logger.error('Payments list error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message
        });
      }

      // Calculate summary statistics
      const summaryQuery = ctx.supabase
        .from('payments')
        .select('amount, payment_method, payment_status');

      // Apply same filters to summary query
      let summaryQueryFiltered = summaryQuery;
      if (input.order_id) summaryQueryFiltered = summaryQueryFiltered.eq('order_id', input.order_id);
      if (input.payment_method) summaryQueryFiltered = summaryQueryFiltered.eq('payment_method', input.payment_method);
      if (input.payment_status) summaryQueryFiltered = summaryQueryFiltered.eq('payment_status', input.payment_status);
      if (input.date_from) summaryQueryFiltered = summaryQueryFiltered.gte('payment_date', input.date_from);
      if (input.date_to) summaryQueryFiltered = summaryQueryFiltered.lte('payment_date', input.date_to);
      if (input.amount_min !== undefined) summaryQueryFiltered = summaryQueryFiltered.gte('amount', input.amount_min);
      if (input.amount_max !== undefined) summaryQueryFiltered = summaryQueryFiltered.lte('amount', input.amount_max);
      if (input.search) {
        summaryQueryFiltered = summaryQueryFiltered.or(`
          payment_id.ilike.%${input.search}%,
          transaction_id.ilike.%${input.search}%,
          reference_number.ilike.%${input.search}%,
          notes.ilike.%${input.search}%
        `);
      }

      const { data: summaryData } = await summaryQueryFiltered;
      
      const summary = calculatePaymentSummary(summaryData || []);

      return {
        payments: data || [],
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / input.limit),
        currentPage: input.page,
        summary,
      };
    }),

  // GET /payments/{id} - Get single payment
  getById: protectedProcedure
    .input(z.object({
      payment_id: z.string().uuid(),
    }))
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Fetching payment:', input.payment_id);

      const { data, error } = await ctx.supabase
        .from('payments')
        .select(`
          *,
          order:orders(
            id,
            total_amount,
            status,
            payment_status_cache,
            customer:customers(id, name, email, phone),
            delivery_address:addresses(id, line1, line2, city, state, postal_code, country)
          )
        `)
        .eq('id', input.payment_id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Payment not found'
          });
        }
        ctx.logger.error('Payment fetch error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message
        });
      }

      return data;
    }),

  // GET /orders/{id}/payments - Get payments for a specific order
  getByOrderId: protectedProcedure
    .input(z.object({
      order_id: z.string().uuid(),
      include_summary: z.boolean().default(true),
    }))
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Fetching payments for order:', input.order_id);

      // Verify order exists and user has access
      const { data: order, error: orderError } = await ctx.supabase
        .from('orders')
        .select('id, total_amount, status, payment_status_cache')
        .eq('id', input.order_id)
        .single();

      if (orderError) {
        if (orderError.code === 'PGRST116') {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Order not found'
          });
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: orderError.message
        });
      }

      // Get payments for the order
      const { data: payments, error: paymentsError } = await ctx.supabase
        .from('payments')
        .select('*')
        .eq('order_id', input.order_id)
        .order('payment_date', { ascending: false });

      if (paymentsError) {
        ctx.logger.error('Order payments fetch error:', paymentsError);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: paymentsError.message
        });
      }

      let summary = null;
      if (input.include_summary) {
        // Calculate payment summary
        const { data: balanceData, error: balanceError } = await ctx.supabase
          .rpc('calculate_order_balance', { p_order_id: input.order_id });

        if (balanceError) {
          ctx.logger.error('Balance calculation error:', balanceError);
        } else {
          const totalPayments = payments
            ?.filter(p => p.payment_status === 'completed')
            .reduce((sum, p) => sum + (p.amount || 0), 0) || 0;

          summary = {
            order_total: order.total_amount || 0,
            total_payments: totalPayments,
            balance: balanceData || 0,
            payment_status: order.payment_status_cache || 'pending',
            payment_count: payments?.length || 0,
            last_payment_date: payments?.[0]?.payment_date || null,
          };
        }
      }

      return {
        order: {
          id: order.id,
          total_amount: order.total_amount,
          status: order.status,
          payment_status: order.payment_status_cache
        },
        payments: payments || [],
        summary,
      };
    }),

  // PUT /payments/{id}/status - Update payment status
  updateStatus: protectedProcedure
    .input(UpdatePaymentStatusSchema)
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Updating payment status:', input.payment_id);

      // Get current payment
      const { data: currentPayment, error: fetchError } = await ctx.supabase
        .from('payments')
        .select('*')
        .eq('id', input.payment_id)
        .single();

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Payment not found'
          });
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: fetchError.message
        });
      }

      // Update payment
      const updateData: any = {
        payment_status: input.payment_status,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      };

      if (input.transaction_id) {
        updateData.transaction_id = input.transaction_id;
      }

      if (input.notes) {
        updateData.notes = input.notes;
      }

      const { data: updatedPayment, error: updateError } = await ctx.supabase
        .from('payments')
        .update(updateData)
        .eq('id', input.payment_id)
        .select(`
          *,
          order:orders(
            id,
            total_amount,
            status,
            customer:customers(id, name, email)
          )
        `)
        .single();

      if (updateError) {
        ctx.logger.error('Payment update error:', updateError);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: updateError.message
        });
      }

      ctx.logger.info('Payment status updated successfully:', updatedPayment.id);
      return updatedPayment;
    }),

  // GET /payments/summary - Get payment summary statistics
  getSummary: protectedProcedure
    .input(z.object({
      date_from: z.string().optional(),
      date_to: z.string().optional(),
      payment_method: PaymentMethodEnum.optional(),
    }))
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Fetching payment summary:', input);

      let query = ctx.supabase
        .from('payments')
        .select('amount, payment_method, payment_status, payment_date');

      // Apply filters
      if (input.date_from) {
        query = query.gte('payment_date', input.date_from);
      }
      if (input.date_to) {
        query = query.lte('payment_date', input.date_to);
      }
      if (input.payment_method) {
        query = query.eq('payment_method', input.payment_method);
      }

      const { data, error } = await query;

      if (error) {
        ctx.logger.error('Payment summary error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message
        });
      }

      return calculatePaymentSummary(data || []);
    }),

  // GET /payments/overdue-orders - Get orders with overdue payments
  getOverdueOrders: protectedProcedure
    .input(z.object({
      days_overdue_min: z.number().min(0).default(1),
      limit: z.number().min(1).max(100).default(50),
    }))
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Fetching overdue payment orders:', input);

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - input.days_overdue_min);

      const { data, error } = await ctx.supabase
        .from('orders')
        .select(`
          id,
          total_amount,
          status,
          payment_due_date,
          payment_status_cache,
          invoice_date,
          customer:customers(id, name, email, phone, account_status)
        `)
        .eq('payment_status_cache', 'overdue')
        .lte('payment_due_date', cutoffDate.toISOString())
        .order('payment_due_date', { ascending: true })
        .limit(input.limit);

      if (error) {
        ctx.logger.error('Overdue orders error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message
        });
      }

      // Calculate days overdue for each order
      const ordersWithOverdue = (data || []).map(order => {
        const daysOverdue = order.payment_due_date 
          ? Math.floor((new Date().getTime() - new Date(order.payment_due_date).getTime()) / (1000 * 60 * 60 * 24))
          : 0;

        return {
          ...order,
          days_overdue: daysOverdue,
          urgency_level: daysOverdue > 60 ? 'critical' : daysOverdue > 30 ? 'high' : 'medium'
        };
      });

      return {
        orders: ordersWithOverdue,
        summary: {
          total_overdue: ordersWithOverdue.length,
          total_amount: ordersWithOverdue.reduce((sum, order) => sum + (order.total_amount || 0), 0),
          critical_count: ordersWithOverdue.filter(o => o.urgency_level === 'critical').length,
          high_count: ordersWithOverdue.filter(o => o.urgency_level === 'high').length,
        }
      };
    }),
});

// Helper function to calculate payment summary
function calculatePaymentSummary(payments: any[]) {
  const summary = {
    total_amount: 0,
    total_count: payments.length,
    completed_amount: 0,
    completed_count: 0,
    pending_amount: 0,
    pending_count: 0,
    failed_amount: 0,
    failed_count: 0,
    by_method: {
      Cash: { amount: 0, count: 0 },
      Mpesa: { amount: 0, count: 0 },
      Card: { amount: 0, count: 0 },
    },
    by_status: {
      pending: { amount: 0, count: 0 },
      completed: { amount: 0, count: 0 },
      failed: { amount: 0, count: 0 },
      refunded: { amount: 0, count: 0 },
    },
  };

  payments.forEach(payment => {
    const amount = payment.amount || 0;
    
    summary.total_amount += amount;

    // By status
    if (payment.payment_status === 'completed') {
      summary.completed_amount += amount;
      summary.completed_count++;
    } else if (payment.payment_status === 'pending') {
      summary.pending_amount += amount;
      summary.pending_count++;
    } else if (payment.payment_status === 'failed') {
      summary.failed_amount += amount;
      summary.failed_count++;
    }

    // By method
    if (payment.payment_method in summary.by_method) {
      summary.by_method[payment.payment_method as keyof typeof summary.by_method].amount += amount;
      summary.by_method[payment.payment_method as keyof typeof summary.by_method].count++;
    }

    // By status (detailed)
    if (payment.payment_status in summary.by_status) {
      summary.by_status[payment.payment_status as keyof typeof summary.by_status].amount += amount;
      summary.by_status[payment.payment_status as keyof typeof summary.by_status].count++;
    }
  });

  return summary;
}