import { z } from 'zod';
import { router, protectedProcedure } from '../lib/trpc';
import { requireAuth } from '../lib/auth';
import { TRPCError } from '@trpc/server';

// Import output schemas
import {
  ComplianceAlertsResponseSchema,
  ComplianceDashboardResponseSchema,
  CreateComplianceAlertResponseSchema,
  UpdateComplianceAlertResponseSchema,
  CylinderComplianceUpdateResponseSchema,
  GenerateAlertsResponseSchema,
  OverdueComplianceReportResponseSchema,
} from '../schemas/output/compliance-output';

// Input schemas
const ComplianceFiltersSchema = z.object({
  cylinder_asset_id: z.string().uuid().optional(),
  alert_type: z.enum(['inspection_due', 'pressure_test_due', 'certification_expired', 'regulatory_violation']).optional(),
  status: z.enum(['active', 'resolved', 'dismissed']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  warehouse_id: z.string().uuid().optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
});

const CreateComplianceAlertSchema = z.object({
  cylinder_asset_id: z.string().uuid(),
  alert_type: z.enum(['inspection_due', 'pressure_test_due', 'certification_expired', 'regulatory_violation']),
  alert_priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  alert_message: z.string(),
  due_date: z.string().optional(),
  escalation_date: z.string().optional(),
  assigned_to_user_id: z.string().uuid().optional(),
  compliance_notes: z.string().optional(),
});

const UpdateComplianceAlertSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['active', 'resolved', 'dismissed']).optional(),
  resolution_notes: z.string().optional(),
  resolved_by_user_id: z.string().uuid().optional(),
  resolved_at: z.string().optional(),
});

const UpdateCylinderComplianceSchema = z.object({
  id: z.string().uuid(),
  last_inspection_date: z.string().optional(),
  next_inspection_due: z.string().optional(),
  last_pressure_test_date: z.string().optional(),
  next_pressure_test_due: z.string().optional(),
  certification_number: z.string().optional(),
  regulatory_status: z.enum(['compliant', 'due_inspection', 'due_pressure_test', 'expired', 'failed']).optional(),
  compliance_notes: z.string().optional(),
});

export const complianceRouter = router({
  // GET /compliance/alerts - List compliance alerts
  listAlerts: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/compliance/alerts',
        tags: ['compliance'],
        summary: 'List compliance alerts',
        description: 'Get a list of regulatory compliance alerts with filters',
        protect: true,
      }
    })
    .input(ComplianceFiltersSchema)
    .output(z.any())
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Listing compliance alerts:', input);

      let query = ctx.supabase
        .from('compliance_alerts')
        .select(`
          id,
          cylinder_asset_id,
          alert_type,
          alert_priority,
          alert_message,
          status,
          due_date,
          escalation_date,
          created_at,
          resolved_at,
          cylinder_asset:cylinder_assets!cylinder_asset_id (
            id,
            serial_number,
            current_condition,
            regulatory_status,
            product:products (
              name,
              sku,
              capacity_l
            ),
            warehouse:warehouses (
              name
            )
          )
        `, { count: 'exact' });

      // Apply filters
      if (input.cylinder_asset_id) {
        query = query.eq('cylinder_asset_id', input.cylinder_asset_id);
      }
      if (input.alert_type) {
        query = query.eq('alert_type', input.alert_type);
      }
      if (input.status) {
        query = query.eq('status', input.status);
      }
      if (input.priority) {
        query = query.eq('alert_priority', input.priority);
      }

      // Pagination
      const offset = (input.page - 1) * input.limit;
      query = query.range(offset, offset + input.limit - 1);

      // Order by priority and due date
      query = query.order('alert_priority', { ascending: false });
      query = query.order('due_date', { ascending: true });

      const { data, error, count } = await query;

      if (error) {
        ctx.logger.error('Error fetching compliance alerts:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message
        });
      }

      return {
        alerts: (data || []).map(alert => ({
          id: alert.id,
          cylinder_asset_id: alert.cylinder_asset_id,
          alert_type: alert.alert_type,
          alert_priority: alert.alert_priority,
          alert_message: alert.alert_message,
          status: alert.status,
          due_date: alert.due_date,
          escalation_date: alert.escalation_date,
          created_at: alert.created_at,
          resolved_at: alert.resolved_at,
          cylinder_asset: alert.cylinder_asset && Array.isArray(alert.cylinder_asset) && alert.cylinder_asset.length > 0 ? {
            id: alert.cylinder_asset[0].id,
            serial_number: alert.cylinder_asset[0].serial_number,
            current_condition: alert.cylinder_asset[0].current_condition,
            regulatory_status: alert.cylinder_asset[0].regulatory_status,
            product: alert.cylinder_asset[0].product && Array.isArray(alert.cylinder_asset[0].product) && alert.cylinder_asset[0].product.length > 0 ? alert.cylinder_asset[0].product[0] : null,
            warehouse: alert.cylinder_asset[0].warehouse && Array.isArray(alert.cylinder_asset[0].warehouse) && alert.cylinder_asset[0].warehouse.length > 0 ? alert.cylinder_asset[0].warehouse[0] : null,
          } : null,
        })),
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / input.limit),
        currentPage: input.page,
      };
    }),

  // GET /compliance/dashboard - Get compliance dashboard data
  getDashboard: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/compliance/dashboard',
        tags: ['compliance'],
        summary: 'Get compliance dashboard',
        description: 'Get comprehensive compliance dashboard data and metrics',
        protect: true,
      }
    })
    .input(z.object({
      warehouse_id: z.string().uuid().optional(),
    }))
    .output(z.any())
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Getting compliance dashboard data:', input);

      // Get dashboard view data
      let query = ctx.supabase
        .from('v_cylinder_compliance_dashboard')
        .select('*');

      if (input.warehouse_id) {
        query = query.eq('warehouse_id', input.warehouse_id);
      }

      const { data: dashboardData, error } = await query;

      if (error) {
        ctx.logger.error('Error fetching compliance dashboard:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message
        });
      }

      // Get alert summary
      const { data: alertSummary } = await ctx.supabase
        .from('compliance_alerts')
        .select('alert_type, alert_priority, status')
        .eq('status', 'active');

      // Calculate summary statistics
      const summary = {
        total_cylinders: dashboardData?.length || 0,
        compliant_cylinders: dashboardData?.filter(c => c.regulatory_status === 'compliant').length || 0,
        overdue_inspections: dashboardData?.filter(c => c.inspection_status === 'overdue').length || 0,
        overdue_pressure_tests: dashboardData?.filter(c => c.pressure_test_status === 'overdue').length || 0,
        due_soon_inspections: dashboardData?.filter(c => c.inspection_status === 'due_soon').length || 0,
        due_soon_pressure_tests: dashboardData?.filter(c => c.pressure_test_status === 'due_soon').length || 0,
        active_alerts: alertSummary?.length || 0,
        critical_alerts: alertSummary?.filter(a => a.alert_priority === 'critical').length || 0,
      };

      // Calculate compliance percentage
      const compliancePercentage = summary.total_cylinders > 0 
        ? Math.round((summary.compliant_cylinders / summary.total_cylinders) * 100)
        : 100;

      return {
        summary,
        compliance_percentage: compliancePercentage,
        cylinders: dashboardData || [],
        alert_breakdown: alertSummary || [],
        last_updated: new Date().toISOString(),
      };
    }),

  // POST /compliance/alerts - Create compliance alert
  createAlert: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/compliance/alerts',
        tags: ['compliance'],
        summary: 'Create compliance alert',
        description: 'Create a new regulatory compliance alert',
        protect: true,
      }
    })
    .input(CreateComplianceAlertSchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Creating compliance alert:', input);

      // Verify cylinder asset exists
      const { data: cylinderAsset, error: assetError } = await ctx.supabase
        .from('cylinder_assets')
        .select('id, serial_number, regulatory_status')
        .eq('id', input.cylinder_asset_id)
        .single();

      if (assetError || !cylinderAsset) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Cylinder asset not found'
        });
      }

      const { data, error } = await ctx.supabase
        .from('compliance_alerts')
        .insert([{
          ...input,
          status: 'active',
          created_by_user_id: user.id,
          created_at: new Date().toISOString(),
        }])
        .select()
        .single();

      if (error) {
        ctx.logger.error('Error creating compliance alert:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message
        });
      }

      return data;
    }),

  // PUT /compliance/alerts/{id} - Update compliance alert
  updateAlert: protectedProcedure
    .meta({
      openapi: {
        method: 'PUT',
        path: '/compliance/alerts/{id}',
        tags: ['compliance'],
        summary: 'Update compliance alert',
        description: 'Update compliance alert status and resolution',
        protect: true,
      }
    })
    .input(UpdateComplianceAlertSchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Updating compliance alert:', input);

      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      if (input.status) {
        updateData.status = input.status;
        if (input.status === 'resolved') {
          updateData.resolved_at = input.resolved_at || new Date().toISOString();
          updateData.resolved_by_user_id = input.resolved_by_user_id || user.id;
          updateData.resolution_notes = input.resolution_notes;
        }
      }

      const { data, error } = await ctx.supabase
        .from('compliance_alerts')
        .update(updateData)
        .eq('id', input.id)
        .select()
        .single();

      if (error) {
        ctx.logger.error('Error updating compliance alert:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message
        });
      }

      return data;
    }),

  // PUT /compliance/cylinders/{id} - Update cylinder compliance status
  updateCylinderCompliance: protectedProcedure
    .meta({
      openapi: {
        method: 'PUT',
        path: '/compliance/cylinders/{id}',
        tags: ['compliance'],
        summary: 'Update cylinder compliance',
        description: 'Update cylinder compliance status and dates',
        protect: true,
      }
    })
    .input(UpdateCylinderComplianceSchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Updating cylinder compliance:', input);

      const { id, ...updateData } = input;
      
      const { data, error } = await ctx.supabase
        .from('cylinder_assets')
        .update({
          ...updateData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        ctx.logger.error('Error updating cylinder compliance:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message
        });
      }

      // Generate new alerts if necessary
      await ctx.supabase.rpc('generate_compliance_alerts');

      return data;
    }),

  // POST /compliance/generate-alerts - Generate compliance alerts
  generateAlerts: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/compliance/generate-alerts',
        tags: ['compliance'],
        summary: 'Generate compliance alerts',
        description: 'Generate compliance alerts for overdue cylinders',
        protect: true,
      }
    })
    .input(z.object({}))
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Generating compliance alerts');

      const { data, error } = await ctx.supabase
        .rpc('generate_compliance_alerts');

      if (error) {
        ctx.logger.error('Error generating compliance alerts:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message
        });
      }

      return {
        alerts_generated: data || 0,
        generated_at: new Date().toISOString(),
      };
    }),

  // GET /compliance/reports/overdue - Get overdue compliance report
  getOverdueReport: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/compliance/reports/overdue',
        tags: ['compliance'],
        summary: 'Get overdue compliance report',
        description: 'Get report of cylinders with overdue compliance requirements',
        protect: true,
      }
    })
    .input(z.object({
      warehouse_id: z.string().uuid().optional(),
      days_overdue: z.number().min(0).default(0),
    }))
    .output(z.any())
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Getting overdue compliance report:', input);

      // Get overdue cylinders
      let query = ctx.supabase
        .from('v_cylinder_compliance_dashboard')
        .select('*')
        .or('inspection_status.eq.overdue,pressure_test_status.eq.overdue');

      if (input.warehouse_id) {
        query = query.eq('warehouse_id', input.warehouse_id);
      }

      const { data, error } = await query;

      if (error) {
        ctx.logger.error('Error fetching overdue compliance report:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message
        });
      }

      // Filter by days overdue if specified
      const filteredData = input.days_overdue > 0 
        ? data?.filter(cylinder => {
            const inspectionOverdue = cylinder.days_until_inspection < -input.days_overdue;
            const pressureTestOverdue = cylinder.days_until_pressure_test < -input.days_overdue;
            return inspectionOverdue || pressureTestOverdue;
          })
        : data;

             // Group by warehouse and type
       const summary = {
         total_overdue: filteredData?.length || 0,
         overdue_inspections: filteredData?.filter(c => c.inspection_status === 'overdue').length || 0,
         overdue_pressure_tests: filteredData?.filter(c => c.pressure_test_status === 'overdue').length || 0,
         by_warehouse: {} as Record<string, { total: number; inspections: number; pressure_tests: number; }>,
       };

       // Group by warehouse
       (filteredData || []).forEach(cylinder => {
         const warehouse = cylinder.warehouse_name || 'Unknown';
         if (!summary.by_warehouse[warehouse]) {
           summary.by_warehouse[warehouse] = {
             total: 0,
             inspections: 0,
             pressure_tests: 0,
           };
         }
         summary.by_warehouse[warehouse].total++;
         if (cylinder.inspection_status === 'overdue') summary.by_warehouse[warehouse].inspections++;
         if (cylinder.pressure_test_status === 'overdue') summary.by_warehouse[warehouse].pressure_tests++;
       });

      return {
        summary,
        overdue_cylinders: filteredData || [],
        report_date: new Date().toISOString(),
        filter_criteria: input,
      };
    }),
}); 