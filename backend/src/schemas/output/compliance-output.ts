import { z } from 'zod';

// ==============================================================
// COMPLIANCE OUTPUT SCHEMAS
// ==============================================================

// ============ Base Types ============

export const CylinderAssetComplianceSchema = z.object({
  id: z.string().uuid(),
  serial_number: z.string(),
  current_condition: z.string(),
  regulatory_status: z.string(),
  product: z.object({
    name: z.string(),
    sku: z.string(),
    capacity_l: z.number(),
  }).nullable(),
  warehouse: z.object({
    name: z.string(),
  }).nullable(),
});

export const ComplianceAlertSchema = z.object({
  id: z.string().uuid(),
  cylinder_asset_id: z.string().uuid(),
  alert_type: z.enum(['inspection_due', 'pressure_test_due', 'certification_expired', 'regulatory_violation']),
  alert_priority: z.enum(['low', 'medium', 'high', 'critical']),
  alert_message: z.string(),
  status: z.enum(['active', 'resolved', 'dismissed']),
  due_date: z.string().nullable(),
  escalation_date: z.string().nullable(),
  created_at: z.string(),
  resolved_at: z.string().nullable(),
  cylinder_asset: CylinderAssetComplianceSchema.nullable(),
});

// ============ Alert List Response ============

export const ComplianceAlertsResponseSchema = z.object({
  alerts: z.array(ComplianceAlertSchema),
  totalCount: z.number(),
  totalPages: z.number(),
  currentPage: z.number(),
});

// ============ Dashboard Response ============

export const ComplianceDashboardSummarySchema = z.object({
  total_cylinders: z.number(),
  compliant_cylinders: z.number(),
  overdue_inspections: z.number(),
  overdue_pressure_tests: z.number(),
  due_soon_inspections: z.number(),
  due_soon_pressure_tests: z.number(),
  active_alerts: z.number(),
  critical_alerts: z.number(),
});

export const ComplianceDashboardResponseSchema = z.object({
  summary: ComplianceDashboardSummarySchema,
  compliance_percentage: z.number(),
  cylinders: z.array(z.any()),
  alert_breakdown: z.array(z.any()),
  last_updated: z.string(),
});

// ============ Alert Operations ============

export const CreateComplianceAlertResponseSchema = ComplianceAlertSchema;

export const UpdateComplianceAlertResponseSchema = ComplianceAlertSchema;

// ============ Cylinder Compliance ============

export const CylinderComplianceUpdateResponseSchema = z.object({
  id: z.string().uuid(),
  last_inspection_date: z.string().nullable(),
  next_inspection_due: z.string().nullable(),
  last_pressure_test_date: z.string().nullable(),
  next_pressure_test_due: z.string().nullable(),
  certification_number: z.string().nullable(),
  regulatory_status: z.enum(['compliant', 'due_inspection', 'due_pressure_test', 'expired', 'failed']).nullable(),
  compliance_notes: z.string().nullable(),
  updated_at: z.string(),
});

// ============ Alert Generation ============

export const GenerateAlertsResponseSchema = z.object({
  alerts_generated: z.number(),
  generated_at: z.string(),
});

// ============ Overdue Report ============

export const OverdueReportSummarySchema = z.object({
  total_overdue: z.number(),
  overdue_inspections: z.number(),
  overdue_pressure_tests: z.number(),
  by_warehouse: z.record(z.string(), z.object({
    total: z.number(),
    inspections: z.number(),
    pressure_tests: z.number(),
  })),
});

export const OverdueComplianceReportResponseSchema = z.object({
  summary: OverdueReportSummarySchema,
  overdue_cylinders: z.array(z.any()),
  report_date: z.string(),
  filter_criteria: z.object({
    warehouse_id: z.string().uuid().optional(),
    days_overdue: z.number(),
  }),
}); 