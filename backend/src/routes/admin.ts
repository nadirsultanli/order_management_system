import { z } from 'zod';
import { router, protectedProcedure, adminProcedure } from '../lib/trpc';
import { TRPCError } from '@trpc/server';
import { 
  testRLSPolicies, 
  getRLSViolations, 
  validateRLSStatus 
} from '../lib/rls-utils';

export const adminRouter = router({
  // Test RLS policies for current tenant
  testRLSPolicies: protectedProcedure
    .query(async ({ ctx }) => {
      if (!ctx.user) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        });
      }

      try {
        const results = await testRLSPolicies(ctx.supabase, ctx.user.id);
        
        ctx.logger.info('RLS policy test completed', {
          user_id: ctx.user.id,
          success: results.success,
          results: results.results
        });

        return results;
      } catch (error) {
        ctx.logger.error('RLS policy test failed', { error, user_id: ctx.user.id });
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to test RLS policies'
        });
      }
    }),

  // Get RLS violations (admin only)
  getRLSViolations: adminProcedure
    .input(z.object({
      since: z.string().datetime().optional(),
      limit: z.number().min(1).max(1000).default(100),
    }))
    .query(async ({ input, ctx }) => {
      try {
        const since = input.since ? new Date(input.since) : undefined;
        const violations = await getRLSViolations(ctx.supabaseAdmin, since, input.limit);
        
        ctx.logger.info('Retrieved RLS violations', {
          count: violations.violations.length,
          since: since?.toISOString()
        });

        return violations;
      } catch (error) {
        ctx.logger.error('Failed to get RLS violations', { error });
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve RLS violations'
        });
      }
    }),

  // Validate RLS status across all tables (admin only)
  validateRLSStatus: adminProcedure
    .query(async ({ ctx }) => {
      try {
        const status = await validateRLSStatus(ctx.supabaseAdmin);
        
        ctx.logger.info('RLS status validation completed', {
          allEnabled: status.allEnabled,
          missingRLS: status.missingRLS
        });

        if (!status.allEnabled) {
          ctx.logger.warn('RLS not enabled on all required tables', {
            missingTables: status.missingRLS
          });
        }

        return status;
      } catch (error) {
        ctx.logger.error('RLS status validation failed', { error });
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to validate RLS status'
        });
      }
    }),

  // Get system statistics (admin only)
  getSystemStats: adminProcedure
    .query(async ({ ctx }) => {
      try {
        // Get basic system counts
        const { data: customerStats, error: customerError } = await ctx.supabaseAdmin
          .from('customers')
          .select('count', { count: 'exact', head: true });

        const { data: orderStats, error: orderError } = await ctx.supabaseAdmin
          .from('orders')
          .select('status', { count: 'exact' });

        if (customerError || orderError) {
          throw customerError || orderError;
        }

        const stats = {
          totalCustomers: (customerStats as any)?.count || 0,
          totalOrders: orderStats?.length || 0,
          activeOrders: orderStats?.filter((o: any) => ['confirmed', 'scheduled', 'en_route'].includes(o.status)).length || 0
        };

        ctx.logger.info('Retrieved system statistics', stats);

        return stats;

      } catch (error) {
        ctx.logger.error('Failed to get system statistics', { error });
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve system statistics'
        });
      }
    }),

  // Health check endpoint with RLS validation
  healthCheck: protectedProcedure
    .query(async ({ ctx }) => {
      try {
        // Basic health checks
        const checks = {
          database: false,
          rls: false,
          adminAccess: false
        };

        // Test database connection
        try {
          const { error } = await ctx.supabase
            .from('customers')
            .select('count', { count: 'exact', head: true });
          checks.database = !error;
        } catch {
          checks.database = false;
        }

        // Test RLS policies
        if (ctx.user) {
          try {
            const rlsTest = await testRLSPolicies(ctx.supabase, ctx.user.id);
            checks.rls = rlsTest.success;
          } catch {
            checks.rls = false;
          }

          // Test admin access
          checks.adminAccess = !!ctx.user.id;
        }

        const isHealthy = Object.values(checks).every(check => check === true);

        return {
          status: isHealthy ? 'healthy' : 'unhealthy',
          timestamp: new Date().toISOString(),
          checks,
          version: '1.0.0'
        };

      } catch (error) {
        ctx.logger.error('Health check failed', { error });
        return {
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          checks: { database: false, rls: false, tenantAccess: false },
          error: 'Health check failed',
          version: '1.0.0'
        };
      }
    }),
});