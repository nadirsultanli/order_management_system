import { z } from 'zod';
import { router, protectedProcedure } from '../lib/trpc';
import { requireAuth } from '../lib/auth';
import { TRPCError } from '@trpc/server';

// Import output schemas
import {
  ListEmptyReturnsResponseSchema,
  EmptyReturnsSummarySchema,
  ProcessEmptyReturnResponseSchema,
  CancelEmptyReturnResponseSchema,
  GetEmptyReturnDetailsResponseSchema,
  CalculateLostCylinderFeeResponseSchema,
  ValidateEmptyReturnResponseSchema,
  BrandReconciliationResponseSchema,
  EmptyReturnStatisticsSchema,
  CustomerEmptyReturnHistorySchema,
  EmptyReturnReportSchema,
} from '../schemas/output/emptyReturns-output';

// Input schemas
const DamageAssessmentSchema = z.object({
  damage_type: z.string(),
  severity: z.enum(['minor', 'moderate', 'severe']),
  repair_cost_estimate: z.number().optional(),
  description: z.string(),
  photos: z.array(z.string()).optional(), // URLs after upload
});

const LostCylinderFeeSchema = z.object({
  base_fee: z.number(),
  replacement_cost: z.number(),
  administrative_fee: z.number(),
  total_fee: z.number(),
  currency_code: z.string(),
});

const ProcessEmptyReturnSchema = z.object({
  credit_id: z.string().uuid(),
  quantity_returned: z.number().min(1),
  return_reason: z.string(),
  notes: z.string().optional(),
  condition_at_return: z.enum(['good', 'damaged', 'unusable']).default('good'),
  cylinder_status: z.enum(['good', 'damaged', 'lost']).default('good'),
  original_brand: z.string().optional(),
  accepted_brand: z.string().optional(),
  brand_reconciliation_status: z.enum(['pending', 'matched', 'generic_accepted']).optional(),
  brand_exchange_fee: z.number().min(0).default(0),
  damage_assessment: DamageAssessmentSchema.optional(),
  lost_cylinder_fee: LostCylinderFeeSchema.optional(),
  photo_urls: z.array(z.string()).optional(),
});

const CancelEmptyReturnSchema = z.object({
  credit_id: z.string().uuid(),
  reason: z.string(),
});

const ListEmptyReturnsSchema = z.object({
  customer_id: z.string().uuid().optional(),
  order_id: z.string().uuid().optional(),
  status: z.enum(['pending', 'returned', 'cancelled', 'expired']).optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
});

export const emptyReturnsRouter = router({
  // GET /empty-returns - List empty return credits
  list: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/empty-returns',
        tags: ['empty-returns'],
        summary: 'List empty return credits',
        description: 'Get a list of empty return credits with filters',
        protect: true,
      }
    })
    .input(ListEmptyReturnsSchema)
    .output(z.any())
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Listing empty return credits:', input);

      let query = ctx.supabase
        .from('empty_return_credits')
        .select(`
          *,
          order:orders!order_id (
            id,
            order_number,
            order_date,
            delivery_date
          ),
          customer:customers!customer_id (
            id,
            name,
            phone
          ),
          product:products!product_id (
            id,
            name,
            sku,
            capacity_l
          )
        `, { count: 'exact' });

      // Apply filters
      if (input.customer_id) {
        query = query.eq('customer_id', input.customer_id);
      }
      if (input.order_id) {
        query = query.eq('order_id', input.order_id);
      }
      if (input.status) {
        query = query.eq('status', input.status);
      }

      // Pagination
      const offset = (input.page - 1) * input.limit;
      query = query.range(offset, offset + input.limit - 1);

      // Order by deadline for pending credits
      query = query.order('return_deadline', { ascending: true });

      const { data, error, count } = await query;

      if (error) {
        ctx.logger.error('Error fetching empty return credits:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message
        });
      }

      return {
        credits: data || [],
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / input.limit),
        currentPage: input.page,
      };
    }),

  // GET /empty-returns/summary - Get summary of pending returns
  summary: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/empty-returns/summary',
        tags: ['empty-returns'],
        summary: 'Get empty returns summary',
        description: 'Get summary of pending empty returns by customer',
        protect: true,
      }
    })
    .input(z.object({
      customer_id: z.string().uuid().optional(),
    }))
    .output(z.any())
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Getting empty returns summary:', input.customer_id);

      let query = ctx.supabase
        .from('empty_return_credits')
        .select('customer_id, status, total_credit_amount, quantity, return_deadline')
        .eq('status', 'pending');

      if (input.customer_id) {
        query = query.eq('customer_id', input.customer_id);
      }

      const { data, error } = await query;

      if (error) {
        ctx.logger.error('Error fetching empty returns summary:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message
        });
      }

      // Calculate summary statistics
      const summary = {
        total_pending_credits: 0,
        total_pending_quantity: 0,
        credits_expiring_soon: 0,
        credits_overdue: 0,
      };

      const today = new Date();
      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(today.getDate() + 7);

      (data || []).forEach(credit => {
        summary.total_pending_credits += credit.total_credit_amount;
        summary.total_pending_quantity += credit.quantity;

        const deadline = new Date(credit.return_deadline);
        if (deadline < today) {
          summary.credits_overdue += credit.total_credit_amount;
        } else if (deadline <= sevenDaysFromNow) {
          summary.credits_expiring_soon += credit.total_credit_amount;
        }
      });

      return summary;
    }),

  // POST /empty-returns/process - Process empty cylinder return
  processReturn: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/empty-returns/process',
        tags: ['empty-returns'],
        summary: 'Process empty return',
        description: 'Process the return of empty cylinders with enhanced damage and loss tracking',
        protect: true,
      }
    })
    .input(ProcessEmptyReturnSchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Processing enhanced empty return:', input);

      // Get credit details
      const { data: credit, error: creditError } = await ctx.supabase
        .from('empty_return_credits')
        .select('*')
        .eq('id', input.credit_id)
        .eq('status', 'pending')
        .single();

      if (creditError || !credit) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Empty return credit not found or already processed'
        });
      }

      // Validate quantity returned
      if (input.quantity_returned > credit.quantity_remaining) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Cannot return ${input.quantity_returned} cylinders. Only ${credit.quantity_remaining} remaining.`
        });
      }

      // Calculate refund/charge amount based on cylinder status
      let refundAmount = 0;
      let chargeAmount = 0;
      let brandExchangeFee = input.brand_exchange_fee || 0;
      const unitCreditAmount = credit.unit_credit_amount;

      if (input.cylinder_status === 'good') {
        refundAmount = unitCreditAmount * input.quantity_returned;
      } else if (input.cylinder_status === 'damaged' && input.damage_assessment) {
        // Apply damage deduction based on severity
        const severityMultiplier = {
          'minor': 0.85,
          'moderate': 0.60,
          'severe': 0.25
        }[input.damage_assessment.severity] || 1;
        refundAmount = unitCreditAmount * input.quantity_returned * severityMultiplier;
      } else if (input.cylinder_status === 'lost' && input.lost_cylinder_fee) {
        // Charge lost cylinder fee instead of refund
        chargeAmount = input.lost_cylinder_fee.total_fee * input.quantity_returned;
        refundAmount = 0;
      }

      // Apply brand exchange fee deduction to refund
      if (refundAmount > 0 && brandExchangeFee > 0) {
        refundAmount = Math.max(0, refundAmount - brandExchangeFee);
      }

      let depositTx = null;

      // Create appropriate deposit transaction
      if (refundAmount > 0) {
        let notes = `Empty cylinder return - ${input.cylinder_status} condition${input.damage_assessment ? ` (${input.damage_assessment.severity} damage)` : ''}. Reason: ${input.return_reason}`;
        
        // Add brand information to notes
        if (input.original_brand && input.accepted_brand) {
          notes += `. Brands: ${input.original_brand} → ${input.accepted_brand}`;
          if (brandExchangeFee > 0) {
            notes += ` (Exchange fee: ${brandExchangeFee})`;
          }
        }

        const { data: refundTx, error: refundError } = await ctx.supabase
          .from('deposit_transactions')
          .insert({
            customer_id: credit.customer_id,
            transaction_type: 'refund',
            amount: refundAmount,
            currency_code: credit.currency_code,
            order_id: credit.order_id,
            notes,
            created_by: user.id,
          })
          .select()
          .single();

        if (refundError) {
          ctx.logger.error('Error creating refund transaction:', refundError);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: refundError.message
          });
        }
        depositTx = refundTx;
      } else if (chargeAmount > 0) {
        const { data: chargeTx, error: chargeError } = await ctx.supabase
          .from('deposit_transactions')
          .insert({
            customer_id: credit.customer_id,
            transaction_type: 'charge',
            amount: chargeAmount,
            currency_code: credit.currency_code,
            order_id: credit.order_id,
            notes: `Lost cylinder fee - ${input.quantity_returned} cylinder(s) not returned. Reason: ${input.return_reason}`,
            created_by: user.id,
          })
          .select()
          .single();

        if (chargeError) {
          ctx.logger.error('Error creating charge transaction:', chargeError);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: chargeError.message
          });
        }
        depositTx = chargeTx;
      }

      // Create brand exchange fee transaction if applicable
      let brandExchangeTx = null;
      if (brandExchangeFee > 0 && input.original_brand && input.accepted_brand) {
        const { data: exchangeTx, error: exchangeError } = await ctx.supabase
          .from('deposit_transactions')
          .insert({
            customer_id: credit.customer_id,
            transaction_type: 'charge',
            amount: brandExchangeFee,
            currency_code: credit.currency_code,
            order_id: credit.order_id,
            notes: `Brand exchange fee: ${input.original_brand} → ${input.accepted_brand} (${input.quantity_returned} cylinder${input.quantity_returned > 1 ? 's' : ''})`,
            created_by: user.id,
          })
          .select()
          .single();

        if (exchangeError) {
          ctx.logger.error('Error creating brand exchange fee transaction:', exchangeError);
          // Don't fail the main transaction for brand exchange fee errors
        } else {
          brandExchangeTx = exchangeTx;
        }
      }

      // Record cylinder condition history if applicable
      if (input.cylinder_status === 'damaged' || input.cylinder_status === 'lost') {
        const { error: historyError } = await ctx.supabase
          .from('cylinder_condition_history')
          .insert({
            empty_return_credit_id: input.credit_id,
            condition_date: new Date().toISOString(),
            condition_status: input.cylinder_status === 'lost' ? 'lost' : 'damaged',
            damage_assessment: input.damage_assessment ? JSON.stringify(input.damage_assessment) : null,
            lost_cylinder_fee: input.lost_cylinder_fee ? JSON.stringify(input.lost_cylinder_fee) : null,
            location: 'customer_return',
            recorded_by: user.id,
            notes: input.notes,
            photos: input.photo_urls,
            quantity: input.quantity_returned,
          });

        if (historyError) {
          ctx.logger.warn('Error recording cylinder condition history:', historyError);
          // Don't fail the transaction for history recording errors
        }
      }

      // Handle EMPTY-SCRAP inventory for damaged/lost cylinders
      if (input.cylinder_status === 'damaged' || input.cylinder_status === 'lost') {
        const { error: inventoryError } = await ctx.supabase
          .from('inventory_movements')
          .insert({
            product_id: credit.product_id,
            movement_type: 'scrap',
            quantity: input.quantity_returned,
            location: 'EMPTY-SCRAP',
            movement_date: new Date().toISOString(),
            notes: `${input.cylinder_status === 'lost' ? 'Lost' : 'Damaged'} cylinder from return processing`,
            reference_type: 'empty_return',
            reference_id: input.credit_id,
            created_by: user.id,
          });

        if (inventoryError) {
          ctx.logger.warn('Error creating inventory movement:', inventoryError);
          // Don't fail the transaction for inventory errors
        }
      }

      // Calculate new quantities
      const newQuantityReturned = credit.quantity_returned + input.quantity_returned;
      const newQuantityRemaining = credit.quantity - newQuantityReturned;
      const newStatus = newQuantityRemaining === 0 ? 'fully_returned' : 'partial_returned';

      // Update empty return credit with enhanced data
      const { error: updateError } = await ctx.supabase
        .from('empty_return_credits')
        .update({
          status: newStatus,
          quantity_returned: newQuantityReturned,
          quantity_remaining: newQuantityRemaining,
          actual_return_date: newStatus === 'fully_returned' ? new Date().toISOString().split('T')[0] : null,
          cylinder_status: input.cylinder_status,
          original_brand: input.original_brand,
          accepted_brand: input.accepted_brand,
          brand_reconciliation_status: input.brand_reconciliation_status,
          damage_assessment: input.damage_assessment ? JSON.stringify(input.damage_assessment) : null,
          lost_cylinder_fee: input.lost_cylinder_fee ? JSON.stringify(input.lost_cylinder_fee) : null,
          return_reason: input.return_reason,
          condition_at_return: input.condition_at_return,
          photo_urls: input.photo_urls,
          deposit_transaction_id: depositTx?.id,
          updated_at: new Date().toISOString(),
          updated_by: user.id,
        })
        .eq('id', input.credit_id);

      if (updateError) {
        ctx.logger.error('Error updating empty return credit:', updateError);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: updateError.message
        });
      }

      return {
        credit_id: input.credit_id,
        deposit_transaction_id: depositTx?.id || null,
        brand_exchange_transaction_id: brandExchangeTx?.id || null,
        quantity_processed: input.quantity_returned,
        quantity_remaining: newQuantityRemaining,
        cylinder_status: input.cylinder_status,
        original_brand: input.original_brand,
        accepted_brand: input.accepted_brand,
        brand_reconciliation_status: input.brand_reconciliation_status,
        brand_exchange_fee: brandExchangeFee,
        refund_amount: refundAmount,
        charge_amount: chargeAmount,
        original_unit_amount: unitCreditAmount,
        damage_assessment: input.damage_assessment,
        lost_cylinder_fee: input.lost_cylinder_fee,
        status: newStatus,
      };
    }),

  // POST /empty-returns/cancel - Cancel empty return credit
  cancel: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/empty-returns/cancel',
        tags: ['empty-returns'],
        summary: 'Cancel empty return',
        description: 'Cancel an empty return credit (charge deposit to customer)',
        protect: true,
      }
    })
    .input(CancelEmptyReturnSchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Cancelling empty return:', input);

      // Get credit details
      const { data: credit, error: creditError } = await ctx.supabase
        .from('empty_return_credits')
        .select('*')
        .eq('id', input.credit_id)
        .eq('status', 'pending')
        .single();

      if (creditError || !credit) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Empty return credit not found or already processed'
        });
      }

      // Create deposit charge transaction
      const { data: depositTx, error: depositError } = await ctx.supabase
        .from('deposit_transactions')
        .insert({
          customer_id: credit.customer_id,
          transaction_type: 'charge',
          amount: credit.total_credit_amount,
          currency_code: credit.currency_code,
          order_id: credit.order_id,
          notes: `Empty cylinder not returned - ${input.reason}`,
          created_by: user.id,
        })
        .select()
        .single();

      if (depositError) {
        ctx.logger.error('Error creating deposit charge:', depositError);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: depositError.message
        });
      }

      // Update empty return credit status
      const { error: updateError } = await ctx.supabase
        .from('empty_return_credits')
        .update({
          status: 'cancelled',
          cancelled_reason: input.reason,
          deposit_transaction_id: depositTx.id,
          updated_at: new Date().toISOString(),
          updated_by: user.id,
        })
        .eq('id', input.credit_id);

      if (updateError) {
        ctx.logger.error('Error updating empty return credit:', updateError);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: updateError.message
        });
      }

      return {
        credit_id: input.credit_id,
        deposit_transaction_id: depositTx.id,
        charged_amount: credit.total_credit_amount,
        reason: input.reason,
      };
    }),

  // POST /empty-returns/expire - Expire overdue credits
  expireOverdue: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/empty-returns/expire',
        tags: ['empty-returns'],
        summary: 'Expire overdue credits',
        description: 'Automatically expire and charge deposits for overdue empty returns',
        protect: true,
      }
    })
    .input(z.object({}))
    .output(z.object({
      expired_count: z.number().min(0),
      processed_at: z.string().datetime(),
    }))
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Expiring overdue empty returns');

      // Call the database function to expire overdue credits
      const { data, error } = await ctx.supabase
        .rpc('cancel_expired_empty_return_credits');

      if (error) {
        ctx.logger.error('Error expiring credits:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message
        });
      }

      return {
        expired_count: data || 0,
        processed_at: new Date().toISOString(),
      };
    }),

  // GET /empty-returns/brand-reconciliation - Get brand reconciliation report
  brandReconciliation: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/empty-returns/brand-reconciliation',
        tags: ['empty-returns'],
        summary: 'Get brand reconciliation report',
        description: 'Get cross-brand cylinder exchange report and reconciliation status',
        protect: true,
      }
    })
    .input(z.object({
      from_date: z.string().optional(),
      to_date: z.string().optional(),
      brand_code: z.string().optional(),
      capacity_l: z.number().optional(),
    }))
    .output(z.object({
      period: z.object({
        from_date: z.string(),
        to_date: z.string(),
      }),
      brand_balances: z.array(z.object({
        brand_code: z.string(),
        brand_name: z.string(),
        cylinders_given: z.number().min(0),
        cylinders_received: z.number().min(0),
        net_balance: z.number(),
        capacity_l: z.number().min(0),
        pending_reconciliation: z.number().min(0),
        last_updated: z.string().datetime(),
      })),
      total_exchange_fees: z.number().min(0),
      pending_reconciliations: z.number().min(0),
      currency_code: z.string(),
    }))
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Getting brand reconciliation report:', input);

      // Get date range - default to last 30 days
      const toDate = input.to_date || new Date().toISOString().split('T')[0];
      const fromDate = input.from_date || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      // Build query for brand balances
      let query = ctx.supabase
        .from('empty_return_credits')
        .select(`
          original_brand,
          accepted_brand,
          brand_reconciliation_status,
          quantity_returned,
          product:products!product_id (
            capacity_l
          ),
          actual_return_date,
          updated_at
        `)
        .gte('updated_at', fromDate)
        .lte('updated_at', toDate + 'T23:59:59.999Z')
        .not('original_brand', 'is', null)
        .not('accepted_brand', 'is', null);

      if (input.brand_code) {
        query = query.or(`original_brand.eq.${input.brand_code},accepted_brand.eq.${input.brand_code}`);
      }

      if (input.capacity_l) {
        query = query.eq('product.capacity_l', input.capacity_l);
      }

      const { data: returns, error } = await query;

      if (error) {
        ctx.logger.error('Error fetching brand reconciliation data:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message
        });
      }

      // Calculate brand balances
      const brandBalanceMap = new Map<string, {
        brand_code: string;
        brand_name: string;
        cylinders_given: number;
        cylinders_received: number;
        net_balance: number;
        capacity_l: number;
        pending_reconciliation: number;
        last_updated: string;
      }>();

      let totalExchangeFees = 0;
      let pendingReconciliations = 0;

      (returns || []).forEach(returnRecord => {
        const originalBrand = returnRecord.original_brand;
        const acceptedBrand = returnRecord.accepted_brand;
        const capacity = (returnRecord.product as any)?.capacity_l || 0;
        const quantity = returnRecord.quantity_returned || 0;
        const reconciliationStatus = returnRecord.brand_reconciliation_status;

        if (reconciliationStatus === 'pending') {
          pendingReconciliations += quantity;
        }

        // Track what we gave out (original brand)
        const givenKey = `${originalBrand}-${capacity}`;
        if (!brandBalanceMap.has(givenKey)) {
          brandBalanceMap.set(givenKey, {
            brand_code: originalBrand,
            brand_name: originalBrand, // We'll format this properly
            cylinders_given: 0,
            cylinders_received: 0,
            net_balance: 0,
            capacity_l: capacity,
            pending_reconciliation: 0,
            last_updated: returnRecord.updated_at || returnRecord.actual_return_date
          });
        }
        const givenEntry = brandBalanceMap.get(givenKey)!;
        givenEntry.cylinders_given += quantity;

        // Track what we received back (accepted brand)
        const receivedKey = `${acceptedBrand}-${capacity}`;
        if (!brandBalanceMap.has(receivedKey)) {
          brandBalanceMap.set(receivedKey, {
            brand_code: acceptedBrand,
            brand_name: acceptedBrand, // We'll format this properly
            cylinders_given: 0,
            cylinders_received: 0,
            net_balance: 0,
            capacity_l: capacity,
            pending_reconciliation: 0,
            last_updated: returnRecord.updated_at || returnRecord.actual_return_date
          });
        }
        const receivedEntry = brandBalanceMap.get(receivedKey)!;
        receivedEntry.cylinders_received += quantity;

        if (reconciliationStatus === 'pending') {
          receivedEntry.pending_reconciliation += quantity;
        }
      });

      // Calculate net balances and update last_updated
      const brandBalances = Array.from(brandBalanceMap.values()).map(balance => ({
        ...balance,
        net_balance: balance.cylinders_received - balance.cylinders_given,
        last_updated: balance.last_updated || new Date().toISOString()
      }));

      return {
        period: {
          from_date: fromDate,
          to_date: toDate
        },
        brand_balances: brandBalances,
        total_exchange_fees: totalExchangeFees,
        pending_reconciliations: pendingReconciliations,
        currency_code: 'KES'
      };
    }),

  // POST /empty-returns/update-brand-reconciliation - Update brand reconciliation status
  updateBrandReconciliation: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/empty-returns/update-brand-reconciliation',
        tags: ['empty-returns'],
        summary: 'Update brand reconciliation status',
        description: 'Update the reconciliation status for cross-brand cylinder exchanges',
        protect: true,
      }
    })
    .input(z.object({
      credit_ids: z.array(z.string().uuid()),
      new_status: z.enum(['pending', 'matched', 'generic_accepted']),
      notes: z.string().optional(),
    }))
    .output(z.object({
      updated_count: z.number().min(0),
      new_status: z.enum(['pending', 'matched', 'generic_accepted']),
      updated_at: z.string().datetime(),
    }))
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Updating brand reconciliation status:', input);

      const { error } = await ctx.supabase
        .from('empty_return_credits')
        .update({
          brand_reconciliation_status: input.new_status,
          updated_at: new Date().toISOString(),
          updated_by: user.id,
        })
        .in('id', input.credit_ids);

      if (error) {
        ctx.logger.error('Error updating brand reconciliation status:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message
        });
      }

      return {
        updated_count: input.credit_ids.length,
        new_status: input.new_status,
        updated_at: new Date().toISOString(),
      };
    }),
}); 