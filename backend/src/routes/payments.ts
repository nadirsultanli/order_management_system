import { z } from 'zod';
import { router, protectedProcedure } from '../lib/trpc';
import { requireAuth } from '../lib/auth';
import { TRPCError } from '@trpc/server';
import axios from 'axios';

// Import input schemas
import {
  PaymentMethodEnum,
  PaymentStatusEnum,
  RecordPaymentSchema,
  PaymentFiltersSchema,
  GetPaymentByIdSchema,
  GetPaymentsByOrderSchema,
  UpdatePaymentStatusSchema,
  PaymentSummaryFiltersSchema,
  OverdueOrdersFiltersSchema,
  InitiateMpesaPaymentSchema,
  ManualStatusCheckSchema,
} from '../schemas/input/payments-input';

// Import output schemas
import {
  CreatePaymentResponseSchema,
  PaymentListResponseSchema,
  PaymentDetailResponseSchema,
  OrderPaymentsResponseSchema,
  UpdatePaymentResponseSchema,
  PaymentSummaryResponseSchema,
  OverdueOrdersResponseSchema,
  InitiateMpesaPaymentResponseSchema,
  ManualStatusCheckResponseSchema,
} from '../schemas/output/payments-output';

// Mpesa integration
import { getMpesaToken } from '../helpers/mpesa';

// Environment variables for Mpesa
const {
  MPESA_CONSUMER_KEY,
  MPESA_CONSUMER_SECRET,
  MPESA_BASE_URL,
  MPESA_SHORTCODE,
  MPESA_PASSKEY,
  MPESA_CALLBACK_URL,
} = process.env;

export const paymentsRouter = router({
  // POST /payments - Record a new payment
  create: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/payments',
        tags: ['payments'],
        summary: 'Record a new payment',
        description: 'Record a payment for an order with comprehensive validation and automatic order status updates. Supports Cash, Mpesa, and Card payments. For Mpesa payments, initiates STK push. For Cash/Card payments, immediately processes and may update order status to "paid" if full payment is received.',
        protect: true,
      }
    })
    .input(RecordPaymentSchema)
    .output(CreatePaymentResponseSchema)
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Recording payment for order:', input.order_id);

      // Fetch the order
      const { data: order, error: orderError } = await ctx.supabase
        .from('orders')
        .select('id, total_amount, status, payment_status_cache')
        .eq('id', input.order_id)
        .single();

      if (orderError || !order) {
        ctx.logger.error('Order not found:', orderError);
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Order not found' });
      }

      // Check order status
      if (!['delivered', 'invoiced'].includes(order.status)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Order must be delivered or invoiced to accept payments' });
      }

      // Check payment amount
      if (input.amount <= 0) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Payment amount must be positive' });
      }

      // Calculate total previous completed payments for this order
      const { data: previousPayments, error: paymentsError } = await ctx.supabase
        .from('payments')
        .select('amount, payment_status')
        .eq('order_id', input.order_id)
        .eq('payment_status', 'completed');

      if (paymentsError) {
        ctx.logger.error('Error fetching previous payments:', paymentsError);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: paymentsError.message });
      }

      const totalPaid = (previousPayments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
      const orderBalance = (order.total_amount || 0) - totalPaid;

      if (input.amount > orderBalance) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Payment amount (${input.amount}) exceeds order balance (${orderBalance})`
        });
      }

      // Handle different payment methods
      let paymentStatus: 'pending' | 'completed' = 'completed';
      let transactionId: string;
      let metadata = input.metadata || {};

      // For Mpesa payments, initiate payment and get transaction ID
      if (input.payment_method === 'Mpesa') {
        try {
          const mpesaResult = await initiateMpesaPayment(input, ctx);
          paymentStatus = 'pending';
          transactionId = mpesaResult.CheckoutRequestID;
          metadata = {
            ...metadata,
            mpesa_request_id: mpesaResult.CheckoutRequestID,
            mpesa_merchant_request_id: mpesaResult.MerchantRequestID,
            payment_initiated_at: new Date().toISOString(),
          };
        } catch (error) {
          ctx.logger.error('Mpesa payment initiation failed:', error);
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Failed to initiate Mpesa payment. Please try again.'
          });
        }
      } else {
        // For all other payment methods, always generate a unique transaction ID
        transactionId = generateTransactionId(input.payment_method);
      }

      // Create payment record
      try {
        const paymentData = {
          order_id: input.order_id,
          amount: input.amount,
          payment_method: input.payment_method,
          payment_status: paymentStatus,
          transaction_id: transactionId,
          payment_date: input.payment_date || new Date().toISOString(),
          reference_number: input.reference_number,
          notes: input.notes,
          metadata: metadata,
          created_by: user.id,
          paid_by: input.paid_by, // The customer making the payment
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

        if (paymentError) throw paymentError;

        // Update order payment date if this is the first payment
        if (payment.order && !payment.order.payment_date) {
          await ctx.supabase
            .from('orders')
            .update({ payment_date: payment.payment_date })
            .eq('id', payment.order_id);
        }

        // Step 12: Handle payment completion and order status updates for cash payments
        if (paymentStatus === 'completed') {
          try {
            // Handle payment completion logic inline for cash payments
            const { data: order, error: orderFetchError } = await ctx.supabase
              .from('orders')
              .select('id, status, total_amount, customer_id')
              .eq('id', payment.order_id)
              .single();

            if (!orderFetchError && order && ['invoiced', 'delivered'].includes(order.status)) {
              // Calculate total paid amount
              const { data: allPayments, error: paymentsError } = await ctx.supabase
                .from('payments')
                .select('amount')
                .eq('order_id', payment.order_id)
                .eq('payment_status', 'completed');

              if (!paymentsError && allPayments) {
                const totalPaid = allPayments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
                const orderTotal = order.total_amount || 0;
                const balance = orderTotal - totalPaid;

                // Only mark as paid if payment covers the full order amount
                if (balance <= 0) {
                  // Set payment_status_cache to 'paid'
                  const { error: statusUpdateError } = await ctx.supabase
                    .from('orders')
                    .update({
                      status: 'paid',
                      payment_status_cache: 'paid',
                      updated_at: new Date().toISOString(),
                    })
                    .eq('id', payment.order_id);

                  if (!statusUpdateError) {
                    ctx.logger.info('✅ Order automatically marked as paid for cash payment:', {
                      order_id: payment.order_id,
                      total_paid: totalPaid,
                      order_total: orderTotal,
                    });
                  }
                } else {
                  // Mark as partial_paid if not fully paid
                  const { error: partialStatusUpdateError } = await ctx.supabase
                    .from('orders')
                    .update({
                      payment_status_cache: 'partial_paid',
                      updated_at: new Date().toISOString(),
                    })
                    .eq('id', payment.order_id);

                  if (!partialStatusUpdateError) {
                    ctx.logger.info('💸 Partial payment received - order marked as partial_paid:', {
                      order_id: payment.order_id,
                      total_paid: totalPaid,
                      order_total: orderTotal,
                      remaining: balance,
                    });
                  }
                }
              }
            }
          } catch (error) {
            ctx.logger.error('Error in cash payment completion handling:', error);
            // Don't throw error here as the payment was successfully recorded
          }
        }

        ctx.logger.info('Payment recorded successfully:', payment.id);
        // Fetch latest order with payments for summary
        const { data: updatedOrder, error: updatedOrderError } = await ctx.supabase
          .from('orders')
          .select(`
            id,
            total_amount,
            status,
            payment_status_cache,
            payments(id, amount, payment_status, payment_date, payment_method)
          `)
          .eq('id', payment.order_id)
          .single();

        let payment_summary = undefined;
        let payment_balance = undefined;
        if (updatedOrder) {
          // Calculate payment summary
          const completedPayments = (updatedOrder.payments || []).filter((p: any) => p.payment_status === 'completed');
          const totalPaid = completedPayments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
          const balance = (updatedOrder.total_amount || 0) - totalPaid;
          payment_summary = {
            order_total: updatedOrder.total_amount || 0,
            total_payments: totalPaid,
            balance,
            payment_status: updatedOrder.payment_status_cache || (balance <= 0 ? 'paid' : totalPaid > 0 ? 'partial_paid' : 'pending'),
            payment_count: updatedOrder.payments.length,
            last_payment_date: completedPayments.length > 0 ? completedPayments.sort((a: any, b: any) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime())[0].payment_date : null,
          };
          payment_balance = balance;
        }
        return { ...payment, payment_summary, payment_balance };
      } catch (error: any) {
        // Handle unique constraint violations
        if (error.code === '23505') { // PostgreSQL unique violation
          if (error.message.includes('mpesa_receipt')) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'This M-Pesa payment has already been processed'
            });
          }
          if (error.message.includes('pending_mpesa_order')) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Payment already in progress for this order'
            });
          }
          if (error.message.includes('transaction_method')) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Payment with this transaction ID already exists'
            });
          }
        }
        throw error;
      }
    }),

  // POST /payments/mpesa/initiate - Initiate Mpesa payment
  initiateMpesa: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/payments/mpesa/initiate',
        tags: ['payments'],
        summary: 'Initiate Mpesa payment',
        description: 'Initiate a Mpesa payment for an order and return payment details for customer confirmation.',
        protect: true,
      }
    })
    .input(InitiateMpesaPaymentSchema)
    .output(InitiateMpesaPaymentResponseSchema)
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Initiating Mpesa payment for order:', input.order_id);

      // Validate payment against order
      const { data: validation, error: validationError } = await ctx.supabase
        .rpc('validate_payment_for_order', {
          p_order_id: input.order_id,
          p_amount: input.amount
        });

      if (validationError || !validation.valid) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Payment validation failed'
        });
      }

      // Check for existing pending M-Pesa payment for this order (prevent double STK push)
      const { data: existingPending } = await ctx.supabase
        .from('payments')
        .select('id, created_at')
        .eq('order_id', input.order_id)
        .eq('payment_method', 'Mpesa')
        .eq('payment_status', 'pending')
        .single();

      if (existingPending) {
        // Check if it's recent (within 10 minutes)
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
        if (new Date(existingPending.created_at) > tenMinutesAgo) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Payment already in progress. Please wait or check status.'
          });
        }
      }

      try {
        const mpesaResult = await initiateMpesaPayment({
          order_id: input.order_id,
          amount: input.amount,
          payment_method: 'Mpesa',
          reference_number: input.reference,
          notes: input.notes,
        }, ctx);

        // Create pending payment record
        try {
          const paymentData = {
            order_id: input.order_id,
            customer_id: input.customer_id, // Required: customer making the payment
            amount: input.amount,
            payment_method: 'Mpesa',
            payment_status: 'pending',
            transaction_id: mpesaResult.CheckoutRequestID,
            payment_date: new Date().toISOString(),
            reference_number: input.reference,
            notes: input.notes,
            metadata: {
              mpesa_request_id: mpesaResult.CheckoutRequestID,
              mpesa_merchant_request_id: mpesaResult.MerchantRequestID,
              phone_number: input.phone_number,
              payment_initiated_at: new Date().toISOString(),
            },
            created_by: user.id,
            paid_by: input.paid_by || user.id, // Who initiated the payment
          };
          const { data: payment, error: paymentError } = await ctx.supabase
            .from('payments')
            .insert(paymentData)
            .select('id')
            .single();

          if (paymentError) throw paymentError;

          return {
            checkout_request_id: mpesaResult.CheckoutRequestID,
            merchant_request_id: mpesaResult.MerchantRequestID,
            response_code: mpesaResult.ResponseCode,
            response_description: mpesaResult.ResponseDescription,
            customer_message: mpesaResult.CustomerMessage,
            payment_id: payment.id,
          };
        } catch (error: any) {
          // Handle unique constraint violations
          if (error.code === '23505') { // PostgreSQL unique violation
            if (error.message.includes('mpesa_receipt')) {
              throw new TRPCError({
                code: 'BAD_REQUEST',
                message: 'This M-Pesa payment has already been processed'
              });
            }
            if (error.message.includes('pending_mpesa_order')) {
              throw new TRPCError({
                code: 'BAD_REQUEST',
                message: 'Payment already in progress for this order'
              });
            }
            if (error.message.includes('transaction_method')) {
              throw new TRPCError({
                code: 'BAD_REQUEST',
                message: 'Payment with this transaction ID already exists'
              });
            }
          }
          throw error;
        }

      } catch (error) {
        ctx.logger.error('Mpesa payment initiation failed:', error);
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Failed to initiate Mpesa payment. Please try again.'
        });
      }
    }),

  // GET /payments/summary - Get payment summary statistics
  getSummary: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/payments/summary',
        tags: ['payments'],
        summary: 'Get payment summary statistics',
        description: 'Get comprehensive payment statistics including totals by status, payment method, and time periods with optional filtering.',
        protect: true,
      }
    })
    .input(PaymentSummaryFiltersSchema)
    .output(PaymentSummaryResponseSchema)
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
    .meta({
      openapi: {
        method: 'GET',
        path: '/payments/overdue-orders',
        tags: ['payments'],
        summary: 'Get orders with overdue payments',
        description: 'Retrieve orders that have overdue payments with urgency levels and detailed customer information for collections.',
        protect: true,
      }
    })
    .input(OverdueOrdersFiltersSchema)
    .output(OverdueOrdersResponseSchema)
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
          customer: Array.isArray(order.customer) ? order.customer[0] : order.customer,
          days_overdue: daysOverdue,
          urgency_level: (daysOverdue > 60 ? 'critical' : daysOverdue > 30 ? 'high' : 'medium') as 'critical' | 'high' | 'medium'
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

  // GET /payments - List payments with filtering
  list: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/payments',
        tags: ['payments'],
        summary: 'List payments with advanced filtering',
        description: 'Retrieve a paginated list of payments with comprehensive filtering options including date ranges, amounts, payment methods, and status.',
        protect: true,
      }
    })
    .input(PaymentFiltersSchema.optional())
    .output(PaymentListResponseSchema)
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      // Provide default values if input is undefined
      const filters = input || {} as any;
      const page = filters.page || 1;
      const limit = filters.limit || 50;
      const sort_by = filters.sort_by || 'payment_date';
      const sort_order = filters.sort_order || 'desc';
      
      ctx.logger.info('Fetching payments with filters:', filters);

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
      if (filters.order_id) {
        query = query.eq('order_id', filters.order_id);
      }

      if (filters.payment_method) {
        query = query.eq('payment_method', filters.payment_method);
      }

      if (filters.payment_status) {
        query = query.eq('payment_status', filters.payment_status);
      }

      // Date range filters
      if (filters.date_from) {
        query = query.gte('payment_date', filters.date_from);
      }
      if (filters.date_to) {
        query = query.lte('payment_date', filters.date_to);
      }

      // Amount range filters
      if (filters.amount_min !== undefined) {
        query = query.gte('amount', filters.amount_min);
      }
      if (filters.amount_max !== undefined) {
        query = query.lte('amount', filters.amount_max);
      }

      // Search filter
      if (filters.search) {
        query = query.or(`
          payment_id.ilike.%${filters.search}%,
          transaction_id.ilike.%${filters.search}%,
          reference_number.ilike.%${filters.search}%,
          notes.ilike.%${filters.search}%
        `);
      }

      // Apply sorting
      const sortMapping: Record<string, string> = {
        'payment_date': 'payment_date',
        'amount': 'amount',
        'created_at': 'created_at',
        'payment_id': 'payment_id'
      };
      
      const sortField = sortMapping[sort_by] || 'payment_date';
      query = query.order(sortField, { ascending: sort_order === 'asc' });

      // Apply pagination
      const from = (page - 1) * limit;
      const to = from + limit - 1;
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
      if (filters.order_id) summaryQueryFiltered = summaryQueryFiltered.eq('order_id', filters.order_id);
      if (filters.payment_method) summaryQueryFiltered = summaryQueryFiltered.eq('payment_method', filters.payment_method);
      if (filters.payment_status) summaryQueryFiltered = summaryQueryFiltered.eq('payment_status', filters.payment_status);
      if (filters.date_from) summaryQueryFiltered = summaryQueryFiltered.gte('payment_date', filters.date_from);
      if (filters.date_to) summaryQueryFiltered = summaryQueryFiltered.lte('payment_date', filters.date_to);
      if (filters.amount_min !== undefined) summaryQueryFiltered = summaryQueryFiltered.gte('amount', filters.amount_min);
      if (filters.amount_max !== undefined) summaryQueryFiltered = summaryQueryFiltered.lte('amount', filters.amount_max);
      if (filters.search) {
        summaryQueryFiltered = summaryQueryFiltered.or(`
          payment_id.ilike.%${filters.search}%,
          transaction_id.ilike.%${filters.search}%,
          reference_number.ilike.%${filters.search}%,
          notes.ilike.%${filters.search}%
        `);
      }

      const { data: summaryData } = await summaryQueryFiltered;
      
      const summary = calculatePaymentSummary(summaryData || []);

      return {
        payments: data || [],
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
        currentPage: page,
        summary,
      };
    }),

  // GET /payments/{payment_id} - Get single payment
  getById: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/payments/{payment_id}',
        tags: ['payments'],
        summary: 'Get payment by ID',
        description: 'Retrieve detailed information about a specific payment including associated order and customer details.',
        protect: true,
      }
    })
    .input(GetPaymentByIdSchema)
    .output(PaymentDetailResponseSchema)
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

  // GET /orders/{order_id}/payments - Get payments for a specific order
  getByOrderId: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/orders/{order_id}/payments',
        tags: ['payments'],
        summary: 'Get payments by order ID',
        description: 'Retrieve all payments for a specific order with optional payment summary including balance calculations.',
        protect: true,
      }
    })
    .input(GetPaymentsByOrderSchema)
    .output(OrderPaymentsResponseSchema)
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

  // PUT /payments/{payment_id}/status - Update payment status
  updateStatus: protectedProcedure
    .meta({
      openapi: {
        method: 'PUT',
        path: '/payments/{payment_id}/status',
        tags: ['payments'],
        summary: 'Update payment status',
        description: 'Update the status of a payment (pending, completed, failed, refunded) with optional transaction details and notes.',
        protect: true,
      }
    })
    .input(UpdatePaymentStatusSchema)
    .output(UpdatePaymentResponseSchema)
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

  manualStatusCheck: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/payments/mpesa/check-status',
        tags: ['payments'],
        summary: 'Manual M-Pesa status check',
        description: 'Manually trigger status check for a specific checkout request to verify payment status',
        protect: true,
      }
    })
    .input(ManualStatusCheckSchema)
    .output(ManualStatusCheckResponseSchema)
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      ctx.logger.info('Manual M-Pesa status check for:', input.checkout_request_id);
      const { manualStatusCheck } = await import('../helpers/mpesa');
      return await manualStatusCheck(input.checkout_request_id);
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

// Helper function to initiate Mpesa payment
async function initiateMpesaPayment(input: any, ctx: any) {
  const token = await getMpesaToken();
  
  const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, -3);
  const password = Buffer.from(`${MPESA_SHORTCODE}${MPESA_PASSKEY}${timestamp}`).toString('base64');
  
  const payload = {
    BusinessShortCode: MPESA_SHORTCODE,
    Password: password,
    Timestamp: timestamp,
    TransactionType: 'CustomerPayBillOnline',
    Amount: Math.round(input.amount),
    PartyA: input.phone_number || '254700000000', // Default phone number
    PartyB: MPESA_SHORTCODE,
    PhoneNumber: input.phone_number || '254700000000',
    CallBackURL: `${MPESA_CALLBACK_URL}/api/mpesa/confirmation`,
    AccountReference: input.order_id,
    TransactionDesc: `Payment for order ${input.order_id}`,
  };

  const response = await axios.post(
    `${MPESA_BASE_URL}/mpesa/stkpush/v1/processrequest`,
    payload,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (response.data.ResponseCode !== '0') {
    throw new Error(`Mpesa API error: ${response.data.ResponseDescription}`);
  }

  return response.data;
}

// Helper to generate a unique transaction ID
function generateTransactionId(method: string): string {
  const now = new Date();
  const datePart = now.toISOString().slice(0,10).replace(/-/g, '');
  const randomPart = Math.random().toString(36).substring(2, 10).toUpperCase();
  return `${method.toUpperCase()}-${datePart}-${randomPart}`;
}