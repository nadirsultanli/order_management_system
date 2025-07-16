import { z } from 'zod';
import { router, protectedProcedure } from '../lib/trpc';
import { requireAuth } from '../lib/auth';
import { TRPCError } from '@trpc/server';

// Input schemas
const ProcessEmptyReturnSchema = z.object({
  credit_id: z.string().uuid(),
  cylinder_condition: z.enum(['good', 'damaged', 'missing']).default('good'),
  damage_percentage: z.number().min(0).max(100).optional(),
  notes: z.string().optional(),
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
        description: 'Process the return of empty cylinders and convert credit to deposit',
        protect: true,
      }
    })
    .input(ProcessEmptyReturnSchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Processing empty return:', input);

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

      // Calculate refund amount based on condition
      let refundAmount = credit.total_credit_amount;
      if (input.cylinder_condition === 'damaged' && input.damage_percentage) {
        refundAmount = refundAmount * (1 - input.damage_percentage / 100);
      } else if (input.cylinder_condition === 'missing') {
        refundAmount = 0;
      }

      // Create deposit transaction for the refund
      const { data: depositTx, error: depositError } = await ctx.supabase
        .from('deposit_transactions')
        .insert({
          customer_id: credit.customer_id,
          transaction_type: 'refund',
          amount: refundAmount,
          currency_code: credit.currency_code,
          order_id: credit.order_id,
          notes: `Empty cylinder return - ${input.cylinder_condition} condition`,
          created_by: user.id,
        })
        .select()
        .single();

      if (depositError) {
        ctx.logger.error('Error creating deposit transaction:', depositError);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: depositError.message
        });
      }

      // Update empty return credit status
      const { error: updateError } = await ctx.supabase
        .from('empty_return_credits')
        .update({
          status: 'returned',
          actual_return_date: new Date().toISOString().split('T')[0],
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
        refund_amount: refundAmount,
        original_amount: credit.total_credit_amount,
        condition: input.cylinder_condition,
        damage_deduction: credit.total_credit_amount - refundAmount,
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
    .output(z.any())
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
}); 