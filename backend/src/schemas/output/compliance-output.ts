import { z } from 'zod';

// Base schemas
export const CylinderAssetBaseSchema = z.object({
  id: z.string().uuid(),
  serial_number: z.string(),
  current_condition: z.string(),
  regulatory_status: z.enum(['compliant', 'due_inspection', 'due_pressure_test', 'expired', 'failed']),
});

export const ProductBaseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  sku: z.string(),
  capacity_l: z.number().nullable(),
});

export const WarehouseBaseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
});

// Compliance alert schema
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
  cylinder_asset: z.object({
    id: z.string().uuid(),
    serial_number: z.string(),
    current_condition: z.string(),
    regulatory_status: z.enum(['compliant', 'due_inspection', 'due_pressure_test', 'expired', 'failed']),
    product: ProductBaseSchema.nullable(),
    warehouse: WarehouseBaseSchema.nullable(),
  }).nullable(),
});

// Compliance dashboard cylinder schema
export const ComplianceDashboardCylinderSchema = z.object({
  id: z.string().uuid(),
  serial_number: z.string(),
  product_name: z.string(),
  warehouse_name: z.string(),
  warehouse_id: z.string().uuid(),
  regulatory_status: z.enum(['compliant', 'due_inspection', 'due_pressure_test', 'expired', 'failed']),
  last_inspection_date: z.string().nullable(),
  next_inspection_due: z.string().nullable(),
  days_until_inspection: z.number(),
  inspection_status: z.enum(['compliant', 'due_soon', 'overdue']),
  last_pressure_test_date: z.string().nullable(),
  next_pressure_test_due: z.string().nullable(),
  days_until_pressure_test: z.number(),
  pressure_test_status: z.enum(['compliant', 'due_soon', 'overdue']),
  certification_number: z.string().nullable(),
  compliance_notes: z.string().nullable(),
});

// Alert summary schema
export const AlertSummarySchema = z.object({
  alert_type: z.enum(['inspection_due', 'pressure_test_due', 'certification_expired', 'regulatory_violation']),
  alert_priority: z.enum(['low', 'medium', 'high', 'critical']),
  status: z.enum(['active', 'resolved', 'dismissed']),
});

// Response schemas
export const ComplianceAlertsResponseSchema = z.object({
  alerts: z.array(ComplianceAlertSchema),
  totalCount: z.number(),
  totalPages: z.number(),
  currentPage: z.number(),
});

export const ComplianceDashboardResponseSchema = z.object({
  summary: z.object({
    total_cylinders: z.number(),
    compliant_cylinders: z.number(),
    overdue_inspections: z.number(),
    overdue_pressure_tests: z.number(),
    due_soon_inspections: z.number(),
    due_soon_pressure_tests: z.number(),
    active_alerts: z.number(),
    critical_alerts: z.number(),
  }),
  compliance_percentage: z.number(),
  cylinders: z.array(ComplianceDashboardCylinderSchema),
  alert_breakdown: z.array(AlertSummarySchema),
  last_updated: z.string(),
});

export const CreateComplianceAlertResponseSchema = ComplianceAlertSchema;

export const UpdateComplianceAlertResponseSchema = ComplianceAlertSchema;

export const CylinderComplianceUpdateResponseSchema = z.object({
  id: z.string().uuid(),
  serial_number: z.string(),
  last_inspection_date: z.string().nullable(),
  next_inspection_due: z.string().nullable(),
  last_pressure_test_date: z.string().nullable(),
  next_pressure_test_due: z.string().nullable(),
  certification_number: z.string().nullable(),
  regulatory_status: z.enum(['compliant', 'due_inspection', 'due_pressure_test', 'expired', 'failed']),
  compliance_notes: z.string().nullable(),
  updated_at: z.string(),
});

export const GenerateAlertsResponseSchema = z.object({
  alerts_generated: z.number(),
  generated_at: z.string(),
});

export const OverdueComplianceReportResponseSchema = z.object({
  summary: z.object({
    total_overdue: z.number(),
    overdue_inspections: z.number(),
    overdue_pressure_tests: z.number(),
    by_warehouse: z.record(z.string(), z.object({
      total: z.number(),
      inspections: z.number(),
      pressure_tests: z.number(),
    })),
  }),
  overdue_cylinders: z.array(ComplianceDashboardCylinderSchema),
  report_date: z.string(),
  filter_criteria: z.object({
    warehouse_id: z.string().uuid().optional(),
    days_overdue: z.number(),
  }),
}); 