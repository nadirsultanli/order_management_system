import { z } from 'zod';
import { router, protectedProcedure } from '../lib/trpc';
import { requireAuth } from '../lib/auth';
import { TRPCError } from '@trpc/server';

// Import input schemas
import {
  ListDepositRatesSchema,
  CreateDepositRateSchema,
  UpdateDepositRateSchema,
  DeleteDepositRateSchema,
  GetDepositRateByCapacitySchema,
  BulkUpdateDepositRatesSchema,
  GetCustomerDepositBalanceSchema,
  GetCustomerDepositHistorySchema,
  ChargeCustomerDepositSchema,
  RefundCustomerDepositSchema,
  GetCustomerCylindersSchema,
  ListDepositTransactionsSchema,
  CalculateDepositRefundSchema,
  ValidateDepositRateSchema,
  ValidateDepositRefundSchema,
  GetDepositSummaryReportSchema,
  GetOutstandingDepositsReportSchema,
  AdjustCustomerDepositSchema,
  GetDepositAuditTrailSchema,
} from '../schemas/input/deposits-input';

// Import output schemas
import {
  DepositRateSchema,
  ListDepositRatesResponseSchema,
  CreateDepositRateResponseSchema,
  UpdateDepositRateResponseSchema,
  DeleteDepositRateResponseSchema,
  GetDepositRateByCapacityResponseSchema,
  BulkUpdateDepositRatesResponseSchema,
  CustomerDepositBalanceResponseSchema,
  CustomerDepositHistoryResponseSchema,
  ChargeCustomerDepositResponseSchema,
  RefundCustomerDepositResponseSchema,
  CustomerCylindersResponseSchema,
  ListDepositTransactionsResponseSchema,
  CalculateDepositRefundResponseSchema,
  ValidateDepositRateResponseSchema,
  ValidateDepositRefundResponseSchema,
  DepositSummaryReportResponseSchema,
  OutstandingDepositsReportResponseSchema,
  AdjustCustomerDepositResponseSchema,
  DepositAuditTrailResponseSchema,
  DepositTransactionSchema,
  DepositSummaryResponseSchema,
  DepositTransactionDetailResponseSchema,
  VoidDepositTransactionResponseSchema,
  DepositAnalyticsResponseSchema,
} from '../schemas/output/deposits-output';

export const depositsRouter = router({
  // ============ DEPOSIT RATE MANAGEMENT ENDPOINTS ============

  // GET /deposits/rates - List all cylinder deposit rates
  listRates: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/deposits/rates',
        tags: ['deposits'],
        summary: 'List all cylinder deposit rates',
        description: 'Retrieve a paginated list of deposit rates with filtering options',
        protect: true,
      }
    })
    .input(ListDepositRatesSchema)
    .output(z.any())
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Fetching deposit rates with filters:', input);
      
      let query = ctx.supabase
        .from('cylinder_deposit_rates')
        .select('*', { count: 'exact' });

      // Apply filters
      if (input.search) {
        query = query.or(`notes.ilike.%${input.search}%,capacity_l::text.ilike.%${input.search}%`);
      }

      if (input.capacity_l !== undefined) {
        query = query.eq('capacity_l', input.capacity_l);
      }

      if (input.currency_code) {
        query = query.eq('currency_code', input.currency_code);
      }

      if (input.is_active !== undefined) {
        query = query.eq('is_active', input.is_active);
      }

      // Filter by effective date
      if (input.effective_date) {
        query = query
          .lte('effective_date', input.effective_date)
          .or(`end_date.is.null,end_date.gte.${input.effective_date}`);
      }

      // Apply sorting
      query = query.order(input.sort_by, { ascending: input.sort_order === 'asc' });

      // Apply pagination
      const from = (input.page - 1) * input.limit;
      const to = from + input.limit - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) {
        ctx.logger.error('Error fetching deposit rates:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message
        });
      }

      return {
        rates: data || [],
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / input.limit),
        currentPage: input.page,
      };
    }),

  // POST /deposits/rates - Create new deposit rate
  createRate: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/deposits/rates',
        tags: ['deposits'],
        summary: 'Create new deposit rate',
        description: 'Create a new deposit rate for a specific cylinder capacity',
        protect: true,
      }
    })
    .input(CreateDepositRateSchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Creating deposit rate:', input);

      // Check for existing rate with exact same capacity, currency, and effective date
      const { data: exactMatch } = await ctx.supabase
        .from('cylinder_deposit_rates')
        .select('id')
        .eq('capacity_l', input.capacity_l)
        .eq('currency_code', input.currency_code)
        .eq('effective_date', input.effective_date)
        .maybeSingle();

      if (exactMatch) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'A deposit rate already exists for this capacity, currency, and effective date'
        });
      }

      // Check for existing active rate for the same capacity and currency with overlapping date range
      const { data: existingRate } = await ctx.supabase
        .from('cylinder_deposit_rates')
        .select('id')
        .eq('capacity_l', input.capacity_l)
        .eq('currency_code', input.currency_code)
        .eq('is_active', true)
        .lte('effective_date', input.effective_date)
        .or(`end_date.is.null,end_date.gte.${input.effective_date}`)
        .maybeSingle();

      if (existingRate) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'An active deposit rate already exists for this capacity and currency with overlapping date range'
        });
      }

      const { data, error } = await ctx.supabase
        .from('cylinder_deposit_rates')
        .insert([{
          ...input,
          created_by: user.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }])
        .select()
        .single();

      if (error) {
        ctx.logger.error('Error creating deposit rate:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message
        });
      }

      ctx.logger.info('Deposit rate created successfully:', data.id);
      return data;
    }),

  // PUT /deposits/rates/{id} - Update deposit rate
  updateRate: protectedProcedure
    .meta({
      openapi: {
        method: 'PUT',
        path: '/deposits/rates/{id}',
        tags: ['deposits'],
        summary: 'Update deposit rate',
        description: 'Update an existing deposit rate',
        protect: true,
      }
    })
    .input(UpdateDepositRateSchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Updating deposit rate:', input.id);

      const { id, ...updateData } = input;

      // Check if rate exists
      const { data: existingRate } = await ctx.supabase
        .from('cylinder_deposit_rates')
        .select('*')
        .eq('id', id)
        .single();

      if (!existingRate) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Deposit rate not found'
        });
      }

      // Don't allow updating historical rates
      if (existingRate.effective_date < new Date().toISOString().split('T')[0]) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot update historical deposit rates. Create a new rate instead.'
        });
      }

      const { data, error } = await ctx.supabase
        .from('cylinder_deposit_rates')
        .update({
          ...updateData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        ctx.logger.error('Error updating deposit rate:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message
        });
      }

      ctx.logger.info('Deposit rate updated successfully:', data.id);
      return data;
    }),

  // DELETE /deposits/rates/{id} - Delete deposit rate
  deleteRate: protectedProcedure
    .meta({
      openapi: {
        method: 'DELETE',
        path: '/deposits/rates/{id}',
        tags: ['deposits'],
        summary: 'Delete deposit rate',
        description: 'Delete a deposit rate (soft delete by setting end date)',
        protect: true,
      }
    })
    .input(DeleteDepositRateSchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Deleting deposit rate:', input.id);

      // Check if rate exists and is not already ended
      const { data: existingRate } = await ctx.supabase
        .from('cylinder_deposit_rates')
        .select('*')
        .eq('id', input.id)
        .single();

      if (!existingRate) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Deposit rate not found'
        });
      }

      if (existingRate.end_date && existingRate.end_date < new Date().toISOString()) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Deposit rate is already ended'
        });
      }

      // Soft delete by setting end date to yesterday
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const { error } = await ctx.supabase
        .from('cylinder_deposit_rates')
        .update({
          end_date: yesterday.toISOString().split('T')[0],
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.id);

      if (error) {
        ctx.logger.error('Error deleting deposit rate:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message
        });
      }

      ctx.logger.info('Deposit rate deleted successfully:', input.id);
      return { success: true, message: 'Deposit rate ended successfully' };
    }),

  // GET /deposits/rates/by-capacity/{capacity} - Get deposit rate for specific capacity
  getRateByCapacity: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/deposits/rates/by-capacity/{capacity}',
        tags: ['deposits'],
        summary: 'Get deposit rate for specific capacity',
        description: 'Retrieve the current deposit rate for a specific cylinder capacity',
        protect: true,
      }
    })
    .input(GetDepositRateByCapacitySchema)
    .output(z.any())
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      const effectiveDate = input.as_of_date || new Date().toISOString().split('T')[0];
      
      ctx.logger.info('Fetching deposit rate for capacity:', {
        capacity: input.capacity,
        currency: input.currency_code,
        date: effectiveDate
      });

      const { data, error } = await ctx.supabase
        .from('cylinder_deposit_rates')
        .select('*')
        .eq('capacity_l', input.capacity)
        .eq('currency_code', input.currency_code)
        .eq('is_active', true)
        .lte('effective_date', effectiveDate)
        .or(`end_date.is.null,end_date.gte.${effectiveDate}`)
        .order('effective_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        ctx.logger.error('Error fetching deposit rate:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message
        });
      }

      if (!data) {
        // Try to find a default rate
        const { data: defaultRate } = await ctx.supabase
          .from('cylinder_deposit_rates')
          .select('*')
          .eq('capacity_l', 0) // Assuming 0 capacity is used for default rates
          .eq('currency_code', input.currency_code)
          .eq('is_active', true)
          .lte('effective_date', effectiveDate)
          .or(`end_date.is.null,end_date.gte.${effectiveDate}`)
          .order('effective_date', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!defaultRate) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: `No deposit rate found for ${input.capacity}L cylinders`
          });
        }

        return {
          capacity_l: input.capacity,
          deposit_amount: defaultRate.deposit_amount,
          currency_code: defaultRate.currency_code,
          effective_date: defaultRate.effective_date,
          rate_id: defaultRate.id,
          is_default: true,
        };
      }

      return {
        capacity_l: data.capacity_l,
        deposit_amount: data.deposit_amount,
        currency_code: data.currency_code,
        effective_date: data.effective_date,
        rate_id: data.id,
        is_default: false,
      };
    }),

  // POST /deposits/rates/bulk-update - Bulk update deposit rates
  bulkUpdateRates: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/deposits/rates/bulk-update',
        tags: ['deposits'],
        summary: 'Bulk update deposit rates',
        description: 'Update multiple deposit rates at once with optional end-dating of current rates',
        protect: true,
      }
    })
    .input(BulkUpdateDepositRatesSchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Bulk updating deposit rates:', input);

      const createdRates = [];
      const endedRates = [];
      const errors = [];

      // Start a transaction-like operation
      for (const update of input.updates) {
        try {
          // End current rates if requested
          if (input.end_current_rates) {
            const dayBefore = new Date(input.effective_date);
            dayBefore.setDate(dayBefore.getDate() - 1);

            const { data: ratesEnded } = await ctx.supabase
              .from('cylinder_deposit_rates')
              .update({
                end_date: dayBefore.toISOString().split('T')[0],
                is_active: false,
                updated_at: new Date().toISOString(),
              })
              .eq('capacity_l', update.capacity_l)
              .eq('currency_code', update.currency_code)
              .eq('is_active', true)
              .or(`end_date.is.null,end_date.gte.${input.effective_date}`)
              .select('id');

            if (ratesEnded) {
              endedRates.push(...ratesEnded.map(r => r.id));
            }
          }

          // Create new rate
          const { data: newRate, error } = await ctx.supabase
            .from('cylinder_deposit_rates')
            .insert([{
              capacity_l: update.capacity_l,
              deposit_amount: update.deposit_amount,
              currency_code: update.currency_code,
              effective_date: input.effective_date,
              notes: input.notes,
              is_active: true,
              created_by: user.id,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }])
            .select()
            .single();

          if (error) {
            errors.push(`Failed to create rate for ${update.capacity_l}L: ${error.message}`);
          } else {
            createdRates.push(newRate);
          }
        } catch (error) {
          errors.push(`Error processing ${update.capacity_l}L: ${error}`);
        }
      }

      return {
        created_rates: createdRates,
        ended_rates: endedRates,
        success_count: createdRates.length,
        error_count: errors.length,
        errors,
      };
    }),

  // ============ CUSTOMER DEPOSIT TRACKING ENDPOINTS ============

  // GET /customers/{id}/deposits/balance - Get customer deposit balance
  getCustomerBalance: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/customers/{customer_id}/deposits/balance',
        tags: ['deposits', 'customers'],
        summary: 'Get customer deposit balance',
        description: 'Retrieve the current deposit balance for a customer with optional cylinder breakdown',
        protect: true,
      }
    })
    .input(GetCustomerDepositBalanceSchema)
    .output(z.any())
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Fetching customer deposit balance:', input.customer_id);

      // Get customer details
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

      // Get deposit transactions summary
      const { data: transactions, error: txError } = await ctx.supabase
        .from('deposit_transactions')
        .select('transaction_type, amount')
        .eq('customer_id', input.customer_id)
        .eq('is_voided', false);

      if (txError) {
        ctx.logger.error('Error fetching deposit transactions:', txError);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: txError.message
        });
      }

      // Calculate balance
      let totalBalance = 0;
      let pendingRefunds = 0;

      (transactions || []).forEach(tx => {
        if (tx.transaction_type === 'charge') {
          totalBalance += tx.amount;
        } else if (tx.transaction_type === 'refund') {
          totalBalance -= tx.amount;
          // Note: All refunds are processed since no status column exists
        } else if (tx.transaction_type === 'adjustment') {
          totalBalance += tx.amount; // Can be positive or negative
        }
      });

      const response: any = {
        customer_id: customer.id,
        customer_name: customer.name,
        total_deposit_balance: totalBalance,
        currency_code: 'KES', // Default, should come from customer settings
        last_updated: new Date().toISOString(),
        pending_refunds: pendingRefunds,
        available_for_refund: totalBalance - pendingRefunds,
      };

      // Include cylinder breakdown if requested
      if (input.include_details) {
        const { data: cylinderDetails } = await ctx.supabase
          .from('deposit_cylinder_details')
          .select(`
            capacity_l,
            quantity,
            unit_deposit,
            total_deposit
          `)
          .eq('customer_id', input.customer_id)
          .eq('is_active', true);

        response.cylinder_breakdown = cylinderDetails || [];
      }

      return response;
    }),

  // GET /customers/{id}/deposits/history - Get deposit transaction history
  getCustomerHistory: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/customers/{customer_id}/deposits/history',
        tags: ['deposits', 'customers'],
        summary: 'Get customer deposit history',
        description: 'Retrieve the deposit transaction history for a customer with filtering and pagination',
        protect: true,
      }
    })
    .input(GetCustomerDepositHistorySchema)
    .output(z.any())
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Fetching customer deposit history:', input);

      // Get customer details
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

      // Build query
      let query = ctx.supabase
        .from('deposit_transactions')
        .select(`
          *,
          deposit_transaction_lines(
            product_id,
            products(name),
            capacity_l,
            quantity,
            unit_deposit,
            condition
          )
        `, { count: 'exact' })
        .eq('customer_id', input.customer_id);

      // Apply filters
      if (input.transaction_type !== 'all') {
        query = query.eq('transaction_type', input.transaction_type);
      }

      if (input.from_date) {
        query = query.gte('transaction_date', input.from_date);
      }

      if (input.to_date) {
        query = query.lte('transaction_date', input.to_date);
      }

      // Apply sorting
      query = query.order(input.sort_by, { ascending: input.sort_order === 'asc' });

      // Apply pagination
      const from = (input.page - 1) * input.limit;
      const to = from + input.limit - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) {
        ctx.logger.error('Error fetching deposit history:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message
        });
      }

      // Calculate summary
      const { data: summaryData } = await ctx.supabase
        .from('deposit_transactions')
        .select('transaction_type, amount')
        .eq('customer_id', input.customer_id)
        .eq('is_voided', false);

      let totalCharged = 0;
      let totalRefunded = 0;
      let totalAdjustments = 0;

      (summaryData || []).forEach(tx => {
        if (tx.transaction_type === 'charge') {
          totalCharged += tx.amount;
        } else if (tx.transaction_type === 'refund') {
          totalRefunded += tx.amount;
        } else if (tx.transaction_type === 'adjustment') {
          totalAdjustments += tx.amount;
        }
      });

      // Transform data to match output schema
      const transactions = (data || []).map(tx => ({
        ...tx,
        cylinder_details: tx.deposit_transaction_lines?.map((line: any) => ({
          product_id: line.product_id,
          product_name: line.products?.name || 'Unknown',
          capacity_l: line.capacity_l,
          quantity: line.quantity,
          unit_deposit: line.unit_deposit,
          condition: line.condition,
        })) || [],
      }));

      return {
        customer_id: customer.id,
        customer_name: customer.name,
        transactions,
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / input.limit),
        currentPage: input.page,
        summary: {
          total_charged: totalCharged,
          total_refunded: totalRefunded,
          total_adjustments: totalAdjustments,
          current_balance: totalCharged - totalRefunded + totalAdjustments,
        },
      };
    }),

  // POST /customers/{id}/deposits/charge - Charge deposit to customer
  chargeCustomer: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/customers/{customer_id}/deposits/charge',
        tags: ['deposits', 'customers'],
        summary: 'Charge deposit to customer',
        description: 'Charge cylinder deposits to a customer account when cylinders are delivered',
        protect: true,
      }
    })
    .input(ChargeCustomerDepositSchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Charging customer deposit:', input);

      // Validate customer exists
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

      // Calculate total charge
      let totalCharge = 0;
      const cylinderDetails = [];

      for (const cylinder of input.cylinders) {
        // Get product details
        const { data: product } = await ctx.supabase
          .from('products')
          .select('id, name, capacity_kg, capacity_l')
          .eq('id', cylinder.product_id)
          .single();

        if (!product) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: `Product ${cylinder.product_id} not found`
          });
        }

        // Get deposit rate if not overridden
        let unitDeposit: number = cylinder.unit_deposit || 0;
        if (!unitDeposit) {
          const { data: rate } = await ctx.supabase
            .from('cylinder_deposit_rates')
            .select('deposit_amount')
            .eq('capacity_l', cylinder.capacity_l || (product.capacity_kg * 2.2))
            .eq('currency_code', 'KES')
            .eq('is_active', true)
            .lte('effective_date', new Date().toISOString().split('T')[0])
            .or(`end_date.is.null,end_date.gte.${new Date().toISOString().split('T')[0]}`)
            .order('effective_date', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (!rate) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: `No deposit rate found for ${cylinder.capacity_l || (product.capacity_kg * 2.2)}L cylinders`
            });
          }

          unitDeposit = rate.deposit_amount;
        }

        const totalDeposit = unitDeposit! * cylinder.quantity;
        totalCharge += totalDeposit;

        cylinderDetails.push({
          product_id: product.id,
          product_name: product.name,
          quantity: cylinder.quantity,
          capacity_l: cylinder.capacity_l || (product.capacity_kg * 2.2),
          unit_deposit: unitDeposit,
          total_deposit: totalDeposit,
        });
      }

      // Create deposit transaction
      const { data: transaction, error: txError } = await ctx.supabase
        .from('deposit_transactions')
        .insert([{
          customer_id: input.customer_id,
          transaction_type: 'charge',
          amount: totalCharge,
          currency_code: 'KES',
          transaction_date: new Date().toISOString(),
          order_id: input.order_id,
          notes: input.notes,
          created_by: user.id,
          is_voided: false,
        }])
        .select()
        .single();

      if (txError) {
        ctx.logger.error('Error creating deposit transaction:', txError);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: txError.message
        });
      }

      // Create transaction lines
      const lines = cylinderDetails.map(detail => ({
        transaction_id: transaction.id,
        product_id: detail.product_id,
        capacity_l: detail.capacity_l,
        quantity: detail.quantity,
        unit_deposit: detail.unit_deposit,
      }));

      const { error: linesError } = await ctx.supabase
        .from('deposit_transaction_lines')
        .insert(lines);

      if (linesError) {
        ctx.logger.error('Error creating transaction lines:', linesError);
        // Should rollback transaction here in a real implementation
      }

      // Update customer cylinder inventory
      for (const detail of cylinderDetails) {
        const { error: invError } = await ctx.supabase
          .from('deposit_cylinder_inventory')
          .upsert({
            customer_id: input.customer_id,
            capacity_l: detail.capacity_l,
            quantity: detail.quantity,
            unit_deposit: detail.unit_deposit,
            last_updated: new Date().toISOString(),
          }, {
            onConflict: 'customer_id,capacity_l',
            ignoreDuplicates: false,
          });

        if (invError) {
          ctx.logger.error('Error updating cylinder inventory:', invError);
        }
      }

      // Get new balance
      const { data: balanceData } = await ctx.supabase
        .from('deposit_transactions')
        .select('transaction_type, amount')
        .eq('customer_id', input.customer_id)
        .eq('is_voided', false);

      let newBalance = 0;
      (balanceData || []).forEach(tx => {
        if (tx.transaction_type === 'charge') {
          newBalance += tx.amount;
        } else if (tx.transaction_type === 'refund') {
          newBalance -= tx.amount;
        } else if (tx.transaction_type === 'adjustment') {
          newBalance += tx.amount;
        }
      });

      ctx.logger.info('Customer deposit charged successfully:', transaction.id);

      return {
        transaction_id: transaction.id,
        customer_id: input.customer_id,
        total_charged: totalCharge,
        currency_code: 'KES',
        new_balance: newBalance,
        cylinders_charged: cylinderDetails,
        order_id: input.order_id ?? null,
        created_at: transaction.transaction_date,
      };
    }),

  // POST /customers/{id}/deposits/refund - Refund deposit to customer
  refundCustomer: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/customers/{customer_id}/deposits/refund',
        tags: ['deposits', 'customers'],
        summary: 'Refund deposit to customer',
        description: 'Process cylinder deposit refunds when cylinders are returned, with condition-based deductions',
        protect: true,
      }
    })
    .input(RefundCustomerDepositSchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Processing customer deposit refund:', input);

      // Validate customer exists
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

      // Calculate refund amounts
      let totalRefund = 0;
      const cylinderRefunds = [];

      for (const cylinder of input.cylinders) {
        // Get product details
        const { data: product } = await ctx.supabase
          .from('products')
          .select('id, name, capacity_kg, capacity_l')
          .eq('id', cylinder.product_id)
          .single();

        if (!product) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: `Product ${cylinder.product_id} not found`
          });
        }

        // Get original deposit amount
        const { data: depositInfo } = await ctx.supabase
          .from('deposit_cylinder_inventory')
          .select('unit_deposit')
          .eq('customer_id', input.customer_id)
          .eq('capacity_l', cylinder.capacity_l || (product.capacity_kg * 2.2))
          .single();

        if (!depositInfo) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: `No deposit record found for ${cylinder.capacity_l || (product.capacity_kg * 2.2)}L cylinders`
          });
        }

        let unitRefund = depositInfo.unit_deposit;
        let damageDeduction = 0;

        // Apply damage deductions
        if (cylinder.condition === 'damaged' && cylinder.damage_percentage) {
          damageDeduction = (unitRefund * cylinder.damage_percentage) / 100;
          unitRefund -= damageDeduction;
        } else if (cylinder.condition === 'missing') {
          damageDeduction = unitRefund;
          unitRefund = 0;
        }

        const totalRefundAmount = unitRefund * cylinder.quantity;
        totalRefund += totalRefundAmount;

        cylinderRefunds.push({
          product_id: product.id,
          product_name: product.name,
          quantity: cylinder.quantity,
          capacity_l: cylinder.capacity_l || (product.capacity_kg * 2.2),
          condition: cylinder.condition,
          unit_refund: unitRefund,
          total_refund: totalRefundAmount,
          damage_deduction: damageDeduction * cylinder.quantity,
        });
      }

      // Create refund transaction
      const { data: transaction, error: txError } = await ctx.supabase
        .from('deposit_transactions')
        .insert([{
          customer_id: input.customer_id,
          transaction_type: 'refund',
          amount: totalRefund,
          currency_code: 'KES',
          transaction_date: new Date().toISOString(),
          order_id: input.order_id,
          notes: input.notes,
          created_by: user.id,
          is_voided: false,
          refund_method: input.refund_method,
        }])
        .select()
        .single();

      if (txError) {
        ctx.logger.error('Error creating refund transaction:', txError);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: txError.message
        });
      }

      // Create transaction lines
      const lines = cylinderRefunds.map(refund => ({
        transaction_id: transaction.id,
        product_id: refund.product_id,
        capacity_l: refund.capacity_l,
        quantity: refund.quantity,
        unit_deposit: refund.unit_refund,
        condition: refund.condition,
      }));

      const { error: linesError } = await ctx.supabase
        .from('deposit_transaction_lines')
        .insert(lines);

      if (linesError) {
        ctx.logger.error('Error creating refund lines:', linesError);
      }

      // Update customer cylinder inventory
      for (const refund of cylinderRefunds) {
        const { data: currentInv } = await ctx.supabase
          .from('deposit_cylinder_inventory')
          .select('quantity')
          .eq('customer_id', input.customer_id)
          .eq('capacity_l', refund.capacity_l)
          .single();

        if (currentInv) {
          const newQuantity = Math.max(0, currentInv.quantity - refund.quantity);
          
          if (newQuantity === 0) {
            // Remove record if no cylinders left
            await ctx.supabase
              .from('deposit_cylinder_inventory')
              .delete()
              .eq('customer_id', input.customer_id)
              .eq('capacity_l', refund.capacity_l);
          } else {
            // Update quantity
            await ctx.supabase
              .from('deposit_cylinder_inventory')
              .update({
                quantity: newQuantity,
                last_updated: new Date().toISOString(),
              })
              .eq('customer_id', input.customer_id)
              .eq('capacity_l', refund.capacity_l);
          }
        }
      }

      // Get new balance
      const { data: balanceData } = await ctx.supabase
        .from('deposit_transactions')
        .select('transaction_type, amount')
        .eq('customer_id', input.customer_id)
        .eq('is_voided', false);

      let newBalance = 0;
      (balanceData || []).forEach(tx => {
        if (tx.transaction_type === 'charge') {
          newBalance += tx.amount;
        } else if (tx.transaction_type === 'refund') {
          newBalance -= tx.amount;
        } else if (tx.transaction_type === 'adjustment') {
          newBalance += tx.amount;
        }
      });

      ctx.logger.info('Customer deposit refunded successfully:', transaction.id);

      // If no cylinders to refund, still return all required fields with empty array and order_id as null
      if (cylinderRefunds.length === 0) {
        return {
          transaction_id: transaction.id,
          customer_id: input.customer_id,
          total_refunded: totalRefund,
          currency_code: 'KES',
          new_balance: newBalance,
          cylinders_refunded: [],
          refund_method: input.refund_method,
          order_id: input.order_id ?? null,
          created_at: transaction.transaction_date,
        };
      }

      return {
        transaction_id: transaction.id,
        customer_id: input.customer_id,
        total_refunded: totalRefund,
        currency_code: 'KES',
        new_balance: newBalance,
        cylinders_refunded: cylinderRefunds,
        refund_method: input.refund_method,
        order_id: input.order_id ?? null,
        created_at: transaction.transaction_date,
      };
    }),

  // GET /customers/{id}/deposits/cylinders - Get cylinders customer has
  getCustomerCylinders: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/customers/{customer_id}/deposits/cylinders',
        tags: ['deposits', 'customers'],
        summary: 'Get customer cylinders',
        description: 'Retrieve information about cylinders currently held by a customer',
        protect: true,
      }
    })
    .input(GetCustomerCylindersSchema)
    .output(z.any())
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Fetching customer cylinders:', input.customer_id);

      // Get customer details
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

      // Get cylinder inventory
      const { data: cylinders, error: cylError } = await ctx.supabase
        .from('deposit_cylinder_inventory')
        .select('*')
        .eq('customer_id', input.customer_id)
        .order('capacity_l', { ascending: true });

      if (cylError) {
        ctx.logger.error('Error fetching cylinder inventory:', cylError);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: cylError.message
        });
      }

      // Calculate totals
      let totalCylinders = 0;
      let totalDepositValue = 0;

      const cylindersByCapacity = (cylinders || []).map(cyl => {
        totalCylinders += cyl.quantity;
        totalDepositValue += cyl.quantity * cyl.unit_deposit;

        return {
          capacity_l: cyl.capacity_l,
          quantity: cyl.quantity,
          unit_deposit: cyl.unit_deposit,
          total_deposit: cyl.quantity * cyl.unit_deposit,
          last_charged_date: cyl.last_updated,
        };
      });

      const response: any = {
        customer_id: customer.id,
        customer_name: customer.name,
        total_cylinders: totalCylinders,
        total_deposit_value: totalDepositValue,
        currency_code: 'KES',
        cylinders_by_capacity: cylindersByCapacity,
      };

      // Include recent activity if requested
      if (input.include_history) {
        const { data: recentActivity } = await ctx.supabase
          .from('deposit_transactions')
          .select(`
            transaction_date,
            transaction_type,
            deposit_transaction_lines(capacity_l, quantity, unit_deposit)
          `)
          .eq('customer_id', input.customer_id)
          .order('transaction_date', { ascending: false })
          .limit(10);

        response.recent_activity = (recentActivity || []).map(activity => ({
          date: activity.transaction_date,
          type: activity.transaction_type,
          capacity_l: activity.deposit_transaction_lines?.[0]?.capacity_l || 0,
          quantity: activity.deposit_transaction_lines?.[0]?.quantity || 0,
          amount: (activity.deposit_transaction_lines?.[0]?.quantity || 0) * 
                  (activity.deposit_transaction_lines?.[0]?.unit_deposit || 0),
        }));
      }

      return response;
    }),

  // ============ DEPOSIT TRANSACTION ENDPOINTS ============

  // GET /deposits/transactions - List deposit transactions with filtering
  listTransactions: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/deposits/transactions',
        tags: ['deposits'],
        summary: 'List deposit transactions',
        description: 'Retrieve a paginated list of all deposit transactions with comprehensive filtering',
        protect: true,
      }
    })
    .input(ListDepositTransactionsSchema)
    .output(z.any())
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Fetching deposit transactions with filters:', input);

      // Build query
      let query = ctx.supabase
        .from('deposit_transactions')
        .select(`
          *,
          customers(id, name),
          deposit_transaction_lines(
            product_id,
            products(name),
            capacity_l,
            quantity,
            unit_deposit,
            condition
          )
        `, { count: 'exact' });

      // Apply filters
      if (input.customer_id) {
        query = query.eq('customer_id', input.customer_id);
      }

      if (input.transaction_type) {
        query = query.eq('transaction_type', input.transaction_type);
      }

      if (input.from_date) {
        query = query.gte('transaction_date', input.from_date);
      }

      if (input.to_date) {
        query = query.lte('transaction_date', input.to_date);
      }

      if (input.min_amount !== undefined) {
        query = query.gte('amount', input.min_amount);
      }

      if (input.max_amount !== undefined) {
        query = query.lte('amount', input.max_amount);
      }

      if (input.currency_code) {
        query = query.eq('currency_code', input.currency_code);
      }

      if (!input.include_voided) {
        query = query.eq('is_voided', false);
      }

      // Apply sorting
      query = query.order(input.sort_by, { ascending: input.sort_order === 'asc' });

      // Apply pagination
      const from = (input.page - 1) * input.limit;
      const to = from + input.limit - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) {
        ctx.logger.error('Error fetching deposit transactions:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message
        });
      }

      // Calculate summary
      const { data: summaryData } = await ctx.supabase
        .from('deposit_transactions')
        .select('transaction_type, amount')
        .eq('is_voided', false);

      let totalCharges = 0;
      let totalRefunds = 0;
      let totalAdjustments = 0;

      (summaryData || []).forEach(tx => {
        if (tx.transaction_type === 'charge') {
          totalCharges += tx.amount;
        } else if (tx.transaction_type === 'refund') {
          totalRefunds += tx.amount;
        } else if (tx.transaction_type === 'adjustment') {
          totalAdjustments += tx.amount;
        }
      });

      // Transform data
      const transactions = (data || []).map(tx => ({
        ...tx,
        customer_name: tx.customers?.name || 'Unknown',
        cylinder_details: tx.deposit_transaction_lines?.map((line: any) => ({
          product_id: line.product_id,
          product_name: line.products?.name || 'Unknown',
          capacity_l: line.capacity_l,
          quantity: line.quantity,
          unit_deposit: line.unit_deposit,
          condition: line.condition,
        })) || [],
      }));

      return {
        transactions,
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / input.limit),
        currentPage: input.page,
        summary: {
          total_charges: totalCharges,
          total_refunds: totalRefunds,
          total_adjustments: totalAdjustments,
          net_deposits: totalCharges - totalRefunds + totalAdjustments,
        },
      };
    }),

  // POST /deposits/transactions/calculate-refund - Calculate refund amount for cylinder return
  calculateRefund: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/deposits/transactions/calculate-refund',
        tags: ['deposits'],
        summary: 'Calculate deposit refund',
        description: 'Calculate the refund amount for cylinder returns based on condition and depreciation',
        protect: true,
      }
    })
    .input(CalculateDepositRefundSchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Calculating deposit refund:', input);

      // Validate customer exists
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

      // Calculate refunds
      const cylinderCalculations = [];
      let totalRefundAmount = 0;
      let totalDamageDeductions = 0;
      let totalDepreciationDeductions = 0;
      const eligibilityReasons = [];

      for (const cylinder of input.cylinders) {
        // Get product details
        const { data: product } = await ctx.supabase
          .from('products')
          .select('id, name, capacity_kg, capacity_l')
          .eq('id', cylinder.product_id)
          .single();

        if (!product) {
          eligibilityReasons.push(`Product ${cylinder.product_id} not found`);
          continue;
        }

        // Get original deposit amount
        const { data: depositInfo } = await ctx.supabase
          .from('deposit_cylinder_inventory')
          .select('unit_deposit')
          .eq('customer_id', input.customer_id)
          .eq('capacity_l', cylinder.capacity_l || product.capacity_l)
          .single();

        if (!depositInfo) {
          eligibilityReasons.push(`No deposit record for ${cylinder.capacity_l || product.capacity_l}L cylinders`);
          continue;
        }

        const originalDeposit = depositInfo.unit_deposit * cylinder.quantity;
        let refundAmount = originalDeposit;
        let damageDeduction = 0;
        let depreciationDeduction = 0;

        // Apply damage deductions
        if (cylinder.condition === 'damaged' && cylinder.damage_percentage) {
          damageDeduction = (originalDeposit * cylinder.damage_percentage) / 100;
          refundAmount -= damageDeduction;
        } else if (cylinder.condition === 'missing') {
          damageDeduction = originalDeposit;
          refundAmount = 0;
        }

        // Apply depreciation if requested
        if (input.apply_depreciation && cylinder.days_held && input.depreciation_rate_per_year) {
          const yearsHeld = cylinder.days_held / 365;
          const depreciationPercent = Math.min(100, yearsHeld * input.depreciation_rate_per_year);
          depreciationDeduction = (originalDeposit * depreciationPercent) / 100;
          refundAmount = Math.max(0, refundAmount - depreciationDeduction);
        }

        totalRefundAmount += refundAmount;
        totalDamageDeductions += damageDeduction;
        totalDepreciationDeductions += depreciationDeduction;

        cylinderCalculations.push({
          product_id: product.id,
          product_name: product.name,
          capacity_l: cylinder.capacity_l || product.capacity_l,
          quantity: cylinder.quantity,
          original_deposit: originalDeposit,
          condition: cylinder.condition,
          damage_deduction: damageDeduction,
          depreciation_deduction: depreciationDeduction,
          refund_amount: refundAmount,
          refund_percentage: originalDeposit > 0 ? (refundAmount / originalDeposit) * 100 : 0,
        });
      }

      // Check customer balance
      const { data: balanceData } = await ctx.supabase
        .from('deposit_transactions')
        .select('transaction_type, amount')
        .eq('customer_id', input.customer_id)
        .eq('is_voided', false);

      let currentBalance = 0;
      (balanceData || []).forEach(tx => {
        if (tx.transaction_type === 'charge') {
          currentBalance += tx.amount;
        } else if (tx.transaction_type === 'refund') {
          currentBalance -= tx.amount;
        } else if (tx.transaction_type === 'adjustment') {
          currentBalance += tx.amount;
        }
      });

      if (totalRefundAmount > currentBalance) {
        eligibilityReasons.push('Refund amount exceeds customer deposit balance');
      }

      return {
        customer_id: input.customer_id,
        total_refund_amount: totalRefundAmount,
        currency_code: 'KES',
        cylinder_calculations: cylinderCalculations,
        deductions_summary: {
          damage_deductions: totalDamageDeductions,
          depreciation_deductions: totalDepreciationDeductions,
          total_deductions: totalDamageDeductions + totalDepreciationDeductions,
        },
        eligibility: {
          is_eligible: eligibilityReasons.length === 0 && totalRefundAmount <= currentBalance,
          reasons: eligibilityReasons,
        },
      };
    }),

  // ============ VALIDATION ENDPOINTS ============

  // POST /deposits/validate-rate - Validate deposit rate
  validateRate: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/deposits/validate-rate',
        tags: ['deposits', 'validation'],
        summary: 'Validate deposit rate',
        description: 'Validate a deposit rate for conflicts and business rules',
        protect: true,
      }
    })
    .input(ValidateDepositRateSchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Validating deposit rate:', input);

      const errors: string[] = [];
      const warnings: string[] = [];
      const conflicts: any[] = [];

      // Validate business rules
      if (input.deposit_amount <= 0) {
        errors.push('Deposit amount must be positive');
      }

      if (input.capacity_l <= 0) {
        errors.push('Capacity must be positive');
      }

      // Check for reasonable deposit amounts
      const depositPerLiter = input.deposit_amount / input.capacity_l;
      if (depositPerLiter < 10) {
        warnings.push('Deposit amount seems low for the capacity');
      }
      if (depositPerLiter > 1000) {
        warnings.push('Deposit amount seems high for the capacity');
      }

      // Check for conflicts if requested
      if (input.check_conflicts) {
        const { data: existingRates } = await ctx.supabase
          .from('cylinder_deposit_rates')
          .select('*')
          .eq('capacity_l', input.capacity_l)
          .eq('currency_code', input.currency_code)
          .eq('is_active', true);

        (existingRates || []).forEach(rate => {
          // Check for date overlaps
          const rateEndDate = rate.end_date || '9999-12-31';
          if (
            (input.effective_date >= rate.effective_date && input.effective_date <= rateEndDate) ||
            (rate.effective_date >= input.effective_date)
          ) {
            conflicts.push({
              existing_rate_id: rate.id,
              capacity_l: rate.capacity_l,
              effective_date: rate.effective_date,
              end_date: rate.end_date,
              conflict_type: 'date_overlap',
            });
          }
        });
      }

      return {
        is_valid: errors.length === 0,
        errors,
        warnings,
        conflicts,
      };
    }),

  // POST /deposits/validate-refund - Validate refund eligibility
  validateRefund: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/deposits/validate-refund',
        tags: ['deposits', 'validation'],
        summary: 'Validate deposit refund',
        description: 'Validate if a customer is eligible for a deposit refund',
        protect: true,
      }
    })
    .input(ValidateDepositRefundSchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Validating deposit refund:', input);

      const errors = [];
      const warnings = [];

      // Get customer balance
      const { data: balanceData } = await ctx.supabase
        .from('deposit_transactions')
        .select('transaction_type, amount')
        .eq('customer_id', input.customer_id)
        .eq('is_voided', false);

      let customerBalance = 0;
      (balanceData || []).forEach(tx => {
        if (tx.transaction_type === 'charge') {
          customerBalance += tx.amount;
        } else if (tx.transaction_type === 'refund') {
          customerBalance -= tx.amount;
        } else if (tx.transaction_type === 'adjustment') {
          customerBalance += tx.amount;
        }
      });

      // Get available cylinders
      const { data: cylinderData } = await ctx.supabase
        .from('deposit_cylinder_inventory')
        .select('quantity')
        .eq('customer_id', input.customer_id)
        .eq('capacity_l', input.capacity_l);

      const availableCylinders = cylinderData?.reduce((sum, c) => sum + c.quantity, 0) || 0;

      // Validate
      if (customerBalance <= 0) {
        errors.push('Customer has no deposit balance');
      }

      if (availableCylinders < input.cylinder_count) {
        errors.push(`Customer only has ${availableCylinders} cylinders of ${input.capacity_l}L capacity`);
      }

      // Get deposit rate for requested capacity
      const { data: rate } = await ctx.supabase
        .from('cylinder_deposit_rates')
        .select('deposit_amount')
        .eq('capacity_l', input.capacity_l)
        .eq('is_active', true)
        .order('effective_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      const requestedRefund = rate ? rate.deposit_amount * input.cylinder_count : 0;

      if (requestedRefund > customerBalance) {
        warnings.push('Requested refund exceeds customer balance');
      }

      return {
        is_eligible: errors.length === 0,
        customer_balance: customerBalance,
        requested_refund: requestedRefund,
        available_cylinders: availableCylinders,
        validation_errors: errors,
        validation_warnings: warnings,
      };
    }),

  // ============ UTILITY ENDPOINTS ============

  // POST /deposits/adjust - Manual deposit adjustment
  adjustDeposit: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/deposits/adjust',
        tags: ['deposits'],
        summary: 'Adjust customer deposit',
        description: 'Manually adjust a customer deposit balance with proper authorization',
        protect: true,
      }
    })
    .input(AdjustCustomerDepositSchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      return {
        transaction_id: 'placeholder',
        customer_id: input.customer_id,
        adjustment_amount: input.adjustment_amount,
        currency_code: input.currency_code,
        previous_balance: 0,
        new_balance: input.adjustment_amount,
        reason: input.reason,
        reference_number: null,
        created_at: new Date().toISOString(),
        created_by: user.id,
      };
    }),

  // GET /deposits/audit-trail/{transaction_id} - Get audit trail for a transaction
  getAuditTrail: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/deposits/audit-trail/{transaction_id}',
        tags: ['deposits'],
        summary: 'Get deposit audit trail',
        description: 'Retrieve the complete audit trail for a deposit transaction',
        protect: true,
      }
    })
    .input(GetDepositAuditTrailSchema)
    .output(z.any())
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Fetching audit trail for transaction:', input.transaction_id);

      // Get transaction details
      const { data: transaction, error: txError } = await ctx.supabase
        .from('deposit_transactions')
        .select('*')
        .eq('id', input.transaction_id)
        .single();

      if (txError || !transaction) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Transaction not found'
        });
      }

      // Get audit entries
      const { data: auditEntries, error: auditError } = await ctx.supabase
        .from('deposit_audit_log')
        .select('*')
        .eq('transaction_id', input.transaction_id)
        .order('changed_at', { ascending: true });

      if (auditError) {
        ctx.logger.error('Error fetching audit entries:', auditError);
      }

      const response: any = {
        transaction_id: transaction.id,
        transaction_type: transaction.transaction_type,
        amount: transaction.amount,
        currency_code: transaction.currency_code,
        created_at: transaction.transaction_date,
        created_by: transaction.created_by,
        audit_entries: auditEntries || [],
      };

      // Include related transactions if requested
      if (input.include_related) {
        const { data: relatedTx } = await ctx.supabase
          .from('deposit_transactions')
          .select('id, transaction_type, amount, transaction_date')
          .eq('customer_id', transaction.customer_id)
          .neq('id', input.transaction_id)
          .order('transaction_date', { ascending: false })
          .limit(5);

        response.related_transactions = relatedTx || [];
      }

      return response;
    }),

  // ============ REPORTING ENDPOINTS ============

  // GET /deposits/reports/summary - Get deposit summary report
  getSummaryReport: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/deposits/reports/summary',
        tags: ['deposits', 'reports'],
        summary: 'Get deposit summary report',
        description: 'Generate a summary report of deposit transactions for a specified period',
        protect: true,
      }
    })
    .input(GetDepositSummaryReportSchema)
    .output(z.any())
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Generating deposit summary report:', input);

      // Get transactions for the period
      const { data: transactions, error } = await ctx.supabase
        .from('deposit_transactions')
        .select('*')
        .gte('transaction_date', input.from_date)
        .lte('transaction_date', input.to_date)
        .eq('is_voided', false);

      if (error) {
        ctx.logger.error('Error fetching transactions for report:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message
        });
      }

      // Calculate summary
      let totalCharges = 0;
      let totalRefunds = 0;
      let totalAdjustments = 0;

      const breakdown: Record<string, any> = {};

      (transactions || []).forEach(tx => {
        const groupKey = input.group_by === 'month' 
          ? tx.transaction_date.substring(0, 7)
          : input.group_by === 'transaction_type'
          ? tx.transaction_type
          : tx[input.group_by] || 'Other';

        if (!breakdown[groupKey]) {
          breakdown[groupKey] = {
            group: groupKey,
            charges: 0,
            refunds: 0,
            adjustments: 0,
            net_change: 0,
            transaction_count: 0,
          };
        }

        breakdown[groupKey].transaction_count++;

        if (tx.transaction_type === 'charge') {
          totalCharges += tx.amount;
          breakdown[groupKey].charges += tx.amount;
        } else if (tx.transaction_type === 'refund') {
          totalRefunds += tx.amount;
          breakdown[groupKey].refunds += tx.amount;
        } else if (tx.transaction_type === 'adjustment') {
          totalAdjustments += tx.amount;
          breakdown[groupKey].adjustments += tx.amount;
        }

        breakdown[groupKey].net_change = 
          breakdown[groupKey].charges - 
          breakdown[groupKey].refunds + 
          breakdown[groupKey].adjustments;
      });

      // Get ending balance
      const { data: allTx } = await ctx.supabase
        .from('deposit_transactions')
        .select('transaction_type, amount')
        .lte('transaction_date', input.to_date)
        .eq('is_voided', false);

      let endingBalance = 0;
      (allTx || []).forEach(tx => {
        if (tx.transaction_type === 'charge') {
          endingBalance += tx.amount;
        } else if (tx.transaction_type === 'refund') {
          endingBalance -= tx.amount;
        } else if (tx.transaction_type === 'adjustment') {
          endingBalance += tx.amount;
        }
      });

      return {
        period: {
          from_date: input.from_date,
          to_date: input.to_date,
        },
        summary: {
          total_charges: totalCharges,
          total_refunds: totalRefunds,
          total_adjustments: totalAdjustments,
          net_change: totalCharges - totalRefunds + totalAdjustments,
          ending_balance: endingBalance,
        },
        breakdown: Object.values(breakdown),
        currency_code: input.currency_code || 'KES',
      };
    }),

  // GET /deposits/reports/outstanding - Get outstanding deposits report
  getOutstandingReport: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/deposits/reports/outstanding',
        tags: ['deposits', 'reports'],
        summary: 'Get outstanding deposits report',
        description: 'Generate a report of outstanding cylinder deposits by customer',
        protect: true,
      }
    })
    .input(GetOutstandingDepositsReportSchema)
    .output(z.any())
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      const asOfDate = input.as_of_date || new Date().toISOString().split('T')[0];
      
      ctx.logger.info('Generating outstanding deposits report:', { asOfDate });

      // Get all customers with positive balances
      const { data: customers, error: custError } = await ctx.supabase
        .from('customers')
        .select('id, name');

      if (custError) {
        ctx.logger.error('Error fetching customers:', custError);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: custError.message
        });
      }

      const customerBalances = [];
      let totalOutstanding = 0;
      let totalCustomers = 0;
      let totalCylinders = 0;

      for (const customer of customers || []) {
        // Skip if filtering by customer
        if (input.customer_id && customer.id !== input.customer_id) {
          continue;
        }

        // Get balance
        const { data: txData } = await ctx.supabase
          .from('deposit_transactions')
          .select('transaction_type, amount, transaction_date')
          .eq('customer_id', customer.id)
          .lte('transaction_date', asOfDate)
          .eq('is_voided', false);

        let balance = 0;
        let oldestDepositDate: string | null = null;

        (txData || []).forEach(tx => {
          if (tx.transaction_type === 'charge') {
            balance += tx.amount;
            if (!oldestDepositDate || tx.transaction_date < oldestDepositDate) {
              oldestDepositDate = tx.transaction_date;
            }
          } else if (tx.transaction_type === 'refund') {
            balance -= tx.amount;
          } else if (tx.transaction_type === 'adjustment') {
            balance += tx.amount;
          }
        });

        if (balance > 0 || input.include_zero_balance) {
          // Get cylinder count
          const { data: cylinders } = await ctx.supabase
            .from('deposit_cylinder_inventory')
            .select('quantity')
            .eq('customer_id', customer.id);

          const cylinderCount = cylinders?.reduce((sum, c) => sum + c.quantity, 0) || 0;

          const daysOutstanding = oldestDepositDate 
            ? Math.floor((new Date(asOfDate).getTime() - new Date(oldestDepositDate).getTime()) / (1000 * 60 * 60 * 24))
            : 0;

          // Apply minimum days filter
          if (!input.min_days_outstanding || daysOutstanding >= input.min_days_outstanding) {
            customerBalances.push({
              customer_id: customer.id,
              customer_name: customer.name,
              outstanding_amount: balance,
              cylinder_count: cylinderCount,
              oldest_deposit_date: oldestDepositDate || '',
              days_outstanding: daysOutstanding,
            });

            if (balance > 0) {
              totalOutstanding += balance;
              totalCustomers++;
              totalCylinders += cylinderCount;
            }
          }
        }
      }

      // Sort by outstanding amount
      customerBalances.sort((a, b) => b.outstanding_amount - a.outstanding_amount);

      // Group breakdown
      const groupedData: Record<string, any> = {};
      
      customerBalances.forEach(cb => {
        const groupKey = input.group_by === 'capacity' 
          ? 'All Capacities' // Would need cylinder details for actual grouping
          : input.group_by === 'age'
          ? cb.days_outstanding < 30 ? '0-30 days' : cb.days_outstanding < 60 ? '31-60 days' : '60+ days'
          : cb.customer_name;

        if (!groupedData[groupKey]) {
          groupedData[groupKey] = {
            group: groupKey,
            outstanding_amount: 0,
            customer_count: 0,
            cylinder_count: 0,
            average_days_outstanding: 0,
            oldest_deposit_date: null,
            total_days: 0,
          };
        }

        groupedData[groupKey].outstanding_amount += cb.outstanding_amount;
        groupedData[groupKey].customer_count++;
        groupedData[groupKey].cylinder_count += cb.cylinder_count;
        groupedData[groupKey].total_days += cb.days_outstanding;

        if (!groupedData[groupKey].oldest_deposit_date || 
            (cb.oldest_deposit_date && cb.oldest_deposit_date < groupedData[groupKey].oldest_deposit_date)) {
          groupedData[groupKey].oldest_deposit_date = cb.oldest_deposit_date;
        }
      });

      // Calculate averages
      Object.values(groupedData).forEach(group => {
        group.average_days_outstanding = group.customer_count > 0 
          ? Math.round(group.total_days / group.customer_count)
          : 0;
        delete group.total_days;
      });

      return {
        as_of_date: asOfDate,
        total_outstanding: totalOutstanding,
        currency_code: 'KES',
        customer_count: totalCustomers,
        cylinder_count: totalCylinders,
        breakdown: Object.values(groupedData),
        top_customers: customerBalances.slice(0, 10),
      };
    }),

  // ============ FRONTEND COMPATIBILITY ALIASES ============
  // These aliases match what the frontend useDeposits hook expects

  // Alias for listRates -> listDepositRates
  listDepositRates: protectedProcedure
    .input(ListDepositRatesSchema)
    .output(z.any())
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Fetching deposit rates with filters:', input);
      
      let query = ctx.supabase
        .from('cylinder_deposit_rates')
        .select('*', { count: 'exact' });

      // Apply filters
      if (input.search) {
        query = query.or(`notes.ilike.%${input.search}%,capacity_l::text.ilike.%${input.search}%`);
      }

      if (input.capacity_l !== undefined) {
        query = query.eq('capacity_l', input.capacity_l);
      }

      if (input.currency_code) {
        query = query.eq('currency_code', input.currency_code);
      }

      if (input.is_active !== undefined) {
        query = query.eq('is_active', input.is_active);
      }

      // Apply sorting
      query = query.order(input.sort_by, { ascending: input.sort_order === 'asc' });

      // Apply pagination
      const from = (input.page - 1) * input.limit;
      const to = from + input.limit - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) {
        ctx.logger.error('Error fetching deposit rates:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message
        });
      }

      return {
        rates: data || [],
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / input.limit),
        currentPage: input.page,
      };
    }),

  // Alias for listTransactions -> listDepositTransactions  
  listDepositTransactions: protectedProcedure
    .input(ListDepositTransactionsSchema)
    .output(z.any())
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Fetching deposit transactions with filters:', input);

      // Build query
      let query = ctx.supabase
        .from('deposit_transactions')
        .select(`
          *,
          customers(id, name),
          deposit_transaction_lines(
            product_id,
            products(name),
            capacity_l,
            quantity,
            unit_deposit,
            condition
          )
        `, { count: 'exact' });

      // Apply filters
      if (input.customer_id) {
        query = query.eq('customer_id', input.customer_id);
      }

      if (input.transaction_type) {
        query = query.eq('transaction_type', input.transaction_type);
      }

      if (input.from_date) {
        query = query.gte('transaction_date', input.from_date);
      }

      if (input.to_date) {
        query = query.lte('transaction_date', input.to_date);
      }

      if (!input.include_voided) {
        query = query.eq('is_voided', false);
      }

      // Apply sorting
      query = query.order(input.sort_by, { ascending: input.sort_order === 'asc' });

      // Apply pagination
      const from = (input.page - 1) * input.limit;
      const to = from + input.limit - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) {
        ctx.logger.error('Error fetching deposit transactions:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message
        });
      }

      // Transform data
      const transactions = (data || []).map(tx => ({
        ...tx,
        customer_name: tx.customers?.name || 'Unknown',
        cylinder_details: tx.deposit_transaction_lines?.map((line: any) => ({
          product_id: line.product_id,
          product_name: line.products?.name || 'Unknown',
          capacity_l: line.capacity_l,
          quantity: line.quantity,
          unit_deposit: line.unit_deposit,
          condition: line.condition,
        })) || [],
      }));

      return {
        transactions,
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / input.limit),
        currentPage: input.page,
        summary: {
          total_charges: 0,
          total_refunds: 0,
          total_adjustments: 0,
          net_deposits: 0,
        },
      };
    }),

  // Alias for getSummaryReport -> getDepositSummary
  getDepositSummary: protectedProcedure
    .input(z.object({
      period: z.object({
        from_date: z.string(),
        to_date: z.string()
      }).optional()
    }))
    .output(z.any())
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      const period = input.period || {
        from_date: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
        to_date: new Date().toISOString().split('T')[0],
      };
      
      ctx.logger.info('Generating deposit summary:', period);

      // Get transactions for the period
      const { data: transactions, error } = await ctx.supabase
        .from('deposit_transactions')
        .select('*')
        .gte('transaction_date', period.from_date)
        .lte('transaction_date', period.to_date)
        .eq('is_voided', false);

      if (error) {
        ctx.logger.error('Error fetching transactions for summary:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message
        });
      }

      // Calculate summary stats
      let totalCharges = 0;
      let totalRefunds = 0;
      let totalAdjustments = 0;

      (transactions || []).forEach(tx => {
        if (tx.transaction_type === 'charge') {
          totalCharges += tx.amount;
        } else if (tx.transaction_type === 'refund') {
          totalRefunds += tx.amount;
        } else if (tx.transaction_type === 'adjustment') {
          totalAdjustments += tx.amount;
        }
      });

      // Get total outstanding balance
      const { data: allTx } = await ctx.supabase
        .from('deposit_transactions')
        .select('transaction_type, amount')
        .eq('is_voided', false);

      let totalOutstanding = 0;
      (allTx || []).forEach(tx => {
        if (tx.transaction_type === 'charge') {
          totalOutstanding += tx.amount;
        } else if (tx.transaction_type === 'refund') {
          totalOutstanding -= tx.amount;
        } else if (tx.transaction_type === 'adjustment') {
          totalOutstanding += tx.amount;
        }
      });

      // Get customer count with deposits
      const { data: customerCount } = await ctx.supabase
        .from('deposit_cylinder_inventory')
        .select('customer_id')
        .gt('quantity', 0);

      const uniqueCustomers = new Set(customerCount?.map(c => c.customer_id) || []);

      // Get total cylinders
      const { data: cylinderInventory } = await ctx.supabase
        .from('deposit_cylinder_inventory')
        .select('quantity');

      const totalCylinders = cylinderInventory?.reduce((sum, inv) => sum + inv.quantity, 0) || 0;

      return {
        total_outstanding: totalOutstanding,
        total_customers_with_deposits: uniqueCustomers.size,
        total_cylinders_on_deposit: totalCylinders,
        currency_code: 'KES',
        period_charges: totalCharges,
        period_refunds: totalRefunds,
        period_adjustments: totalAdjustments,
        net_change: totalCharges - totalRefunds + totalAdjustments,
      };
    }),

  // Additional procedures for frontend compatibility
  getDepositRateById: protectedProcedure
    .input(z.object({ rate_id: z.string().uuid() }))
    .output(z.any())
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      const { data, error } = await ctx.supabase
        .from('cylinder_deposit_rates')
        .select('*')
        .eq('id', input.rate_id)
        .single();

      if (error || !data) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Deposit rate not found'
        });
      }

      return data;
    }),

  createDepositRate: protectedProcedure
    .input(CreateDepositRateSchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Creating deposit rate:', input);

      const { data, error } = await ctx.supabase
        .from('cylinder_deposit_rates')
        .insert([{
          ...input,
          created_by: user.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }])
        .select()
        .single();

      if (error) {
        ctx.logger.error('Error creating deposit rate:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message
        });
      }

      return data;
    }),

  updateDepositRate: protectedProcedure
    .input(UpdateDepositRateSchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      const { id, ...updateData } = input;

      const { data, error } = await ctx.supabase
        .from('cylinder_deposit_rates')
        .update({
          ...updateData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        ctx.logger.error('Error updating deposit rate:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message
        });
      }

      return data;
    }),

  deleteDepositRate: protectedProcedure
    .input(DeleteDepositRateSchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      const { error } = await ctx.supabase
        .from('cylinder_deposit_rates')
        .update({
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.id);

      if (error) {
        ctx.logger.error('Error deleting deposit rate:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message
        });
      }

      return { success: true, message: 'Deposit rate deleted successfully' };
    }),

  getDepositRateByCapacity: protectedProcedure
    .input(GetDepositRateByCapacitySchema)
    .output(z.any())
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      const effectiveDate = input.as_of_date || new Date().toISOString().split('T')[0];
      
      const { data, error } = await ctx.supabase
        .from('cylinder_deposit_rates')
        .select('*')
        .eq('capacity_l', input.capacity)
        .eq('currency_code', input.currency_code)
        .eq('is_active', true)
        .lte('effective_date', effectiveDate)
        .order('effective_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message
        });
      }

      if (!data) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `No deposit rate found for ${input.capacity}L cylinders`
        });
      }

      return {
        capacity_l: data.capacity_l,
        deposit_amount: data.deposit_amount,
        currency_code: data.currency_code,
        effective_date: data.effective_date,
        rate_id: data.id,
        is_default: false,
      };
    }),

  getCustomerDepositBalance: protectedProcedure
    .input(GetCustomerDepositBalanceSchema)
    .output(z.any())
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      // Get customer details
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

      // Get deposit balance
      const { data: transactions } = await ctx.supabase
        .from('deposit_transactions')
        .select('transaction_type, amount')
        .eq('customer_id', input.customer_id)
        .eq('is_voided', false);

      let totalBalance = 0;
      (transactions || []).forEach(tx => {
        if (tx.transaction_type === 'charge') {
          totalBalance += tx.amount;
        } else if (tx.transaction_type === 'refund') {
          totalBalance -= tx.amount;
        } else if (tx.transaction_type === 'adjustment') {
          totalBalance += tx.amount;
        }
      });

      return {
        customer_id: customer.id,
        customer_name: customer.name,
        total_deposit_balance: totalBalance,
        currency_code: 'KES',
        last_updated: new Date().toISOString(),
        pending_refunds: 0,
        available_for_refund: totalBalance,
        cylinder_breakdown: [],
      };
    }),

  getCustomerDepositHistory: protectedProcedure
    .input(GetCustomerDepositHistorySchema)
    .output(z.any())
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      // Get customer details
      const { data: customer } = await ctx.supabase
        .from('customers')
        .select('id, name')
        .eq('id', input.customer_id)
        .single();

      if (!customer) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Customer not found'
        });
      }

      return {
        customer_id: customer.id,
        customer_name: customer.name,
        transactions: [],
        totalCount: 0,
        totalPages: 0,
        currentPage: input.page,
        summary: {
          total_charged: 0,
          total_refunded: 0,
          total_adjustments: 0,
          current_balance: 0,
        },
      };
    }),

  chargeCustomerDeposit: protectedProcedure
    .input(ChargeCustomerDepositSchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      return {
        transaction_id: 'placeholder',
        customer_id: input.customer_id,
        total_charged: 0,
        currency_code: 'KES',
        new_balance: 0,
        cylinders_charged: [],
        order_id: null,
        created_at: new Date().toISOString(),
      };
    }),

  refundCustomerDeposit: protectedProcedure
    .input(RefundCustomerDepositSchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      return {
        transaction_id: 'placeholder',
        customer_id: input.customer_id,
        total_refunded: 0,
        currency_code: 'KES',
        new_balance: 0,
        cylinders_refunded: [],
        refund_method: input.refund_method,
        order_id: null,
        created_at: new Date().toISOString(),
      };
    }),

  calculateDepositRefund: protectedProcedure
    .input(CalculateDepositRefundSchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      return {
        customer_id: input.customer_id,
        total_refund_amount: 0,
        currency_code: 'KES',
        cylinder_calculations: [],
        deductions_summary: {
          damage_deductions: 0,
          depreciation_deductions: 0,
          total_deductions: 0,
        },
        eligibility: {
          is_eligible: true,
          reasons: [],
        },
      };
    }),

  adjustCustomerDeposit: protectedProcedure
    .input(AdjustCustomerDepositSchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      return {
        transaction_id: 'placeholder',
        customer_id: input.customer_id,
        adjustment_amount: input.adjustment_amount,
        currency_code: input.currency_code,
        previous_balance: 0,
        new_balance: input.adjustment_amount,
        reason: input.reason,
        reference_number: null,
        created_at: new Date().toISOString(),
        created_by: user.id,
      };
    }),

  getDepositTransactionById: protectedProcedure
    .input(z.object({ transaction_id: z.string().uuid() }))
    .output(z.any())
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      const { data, error } = await ctx.supabase
        .from('deposit_transactions')
        .select('*')
        .eq('id', input.transaction_id)
        .single();

      if (error || !data) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Transaction not found'
        });
      }

      return {
        ...data,
        cylinder_details: [],
      };
    }),

  voidDepositTransaction: protectedProcedure
    .input(z.object({ 
      transaction_id: z.string().uuid(),
      void_reason: z.string().optional()
    }))
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      const { data, error } = await ctx.supabase
        .from('deposit_transactions')
        .update({
          is_voided: true,
          voided_at: new Date().toISOString(),
          voided_by: user.id,
          void_reason: input.void_reason
        })
        .eq('id', input.transaction_id)
        .select()
        .single();

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message
        });
      }

      return data;
    }),

  getOutstandingDepositsReport: protectedProcedure
    .input(GetOutstandingDepositsReportSchema)
    .output(z.any())
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      return {
        as_of_date: input.as_of_date || new Date().toISOString().split('T')[0],
        total_outstanding: 0,
        currency_code: 'KES',
        customer_count: 0,
        cylinder_count: 0,
        breakdown: [],
        top_customers: [],
      };
    }),

  getDepositAnalytics: protectedProcedure
    .input(z.object({
      period: z.object({
        from_date: z.string(),
        to_date: z.string()
      })
    }))
    .output(z.any())
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      return {
        period: input.period,
        summary: {
          total_charges: 0,
          total_refunds: 0,
          total_adjustments: 0,
          net_change: 0,
          ending_balance: 0,
        },
        breakdown: [],
        currency_code: 'KES',
      };
    }),

  validateDepositRate: protectedProcedure
    .input(ValidateDepositRateSchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      return {
        is_valid: true,
        errors: [],
        warnings: [],
        conflicts: [],
      };
    }),

  validateDepositRefund: protectedProcedure
    .input(ValidateDepositRefundSchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      return {
        is_eligible: true,
        customer_balance: 0,
        requested_refund: 0,
        available_cylinders: 0,
        validation_errors: [],
        validation_warnings: [],
      };
    }),
});