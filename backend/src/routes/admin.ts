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
        const results = await testRLSPolicies(ctx.supabase, ctx.user.tenant_id);
        
        ctx.logger.info('RLS policy test completed', {
          tenant_id: ctx.user.tenant_id,
          success: results.success,
          results: results.results
        });

        return results;
      } catch (error) {
        ctx.logger.error('RLS policy test failed', { error, tenant_id: ctx.user.tenant_id });
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

  // Get tenant statistics (admin only)
  getTenantStats: adminProcedure
    .query(async ({ ctx }) => {
      try {
        // Get counts per tenant for monitoring
        const { data: customerStats, error: customerError } = await ctx.supabaseAdmin
          .from('customers')
          .select('tenant_id')
          .neq('tenant_id', null);

        if (customerError) {
          throw customerError;
        }

        const { data: orderStats, error: orderError } = await ctx.supabaseAdmin
          .from('orders')
          .select('tenant_id, status')
          .neq('tenant_id', null);

        if (orderError) {
          throw orderError;
        }

        // Aggregate by tenant
        const tenantStats: Record<string, {
          customers: number;
          orders: number;
          activeOrders: number;
        }> = {};

        customerStats?.forEach(record => {
          if (!tenantStats[record.tenant_id]) {
            tenantStats[record.tenant_id] = { customers: 0, orders: 0, activeOrders: 0 };
          }
          tenantStats[record.tenant_id].customers++;
        });

        orderStats?.forEach(record => {
          if (!tenantStats[record.tenant_id]) {
            tenantStats[record.tenant_id] = { customers: 0, orders: 0, activeOrders: 0 };
          }
          tenantStats[record.tenant_id].orders++;
          if (['confirmed', 'scheduled', 'en_route'].includes(record.status)) {
            tenantStats[record.tenant_id].activeOrders++;
          }
        });

        ctx.logger.info('Retrieved tenant statistics', {
          tenantCount: Object.keys(tenantStats).length
        });

        return {
          totalTenants: Object.keys(tenantStats).length,
          tenantStats
        };

      } catch (error) {
        ctx.logger.error('Failed to get tenant statistics', { error });
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve tenant statistics'
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
          tenantAccess: false
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
            const rlsTest = await testRLSPolicies(ctx.supabase, ctx.user.tenant_id);
            checks.rls = rlsTest.success;
          } catch {
            checks.rls = false;
          }

          // Test tenant access
          checks.tenantAccess = !!ctx.user.tenant_id;
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