import { z } from 'zod';

// ============ EMPTY RETURN CREDITS OUTPUT SCHEMAS ============

// Damage Assessment Output Schema
export const DamageAssessmentOutputSchema = z.object({
  damage_type: z.string(),
  severity: z.enum(['minor', 'moderate', 'severe']),
  repair_cost_estimate: z.number().optional(),
  description: z.string(),
  photos: z.array(z.string()).optional(),
});

// Lost Cylinder Fee Output Schema
export const LostCylinderFeeOutputSchema = z.object({
  base_fee: z.number(),
  replacement_cost: z.number(),
  administrative_fee: z.number(),
  total_fee: z.number(),
  currency_code: z.string(),
});

// Empty Return Credit Item Schema
export const EmptyReturnCreditItemSchema = z.object({
  id: z.string().uuid(),
  order_id: z.string().uuid(),
  customer_id: z.string().uuid(),
  product_id: z.string().uuid(),
  quantity: z.number().min(1),
  quantity_remaining: z.number().min(0),
  total_credit_amount: z.number().min(0),
  expected_return_date: z.string().datetime(),
  return_deadline: z.string().datetime(),
  status: z.enum(['pending', 'returned', 'cancelled', 'expired', 'partial_returned', 'grace_period']),
  condition_at_return: z.enum(['good', 'damaged', 'unusable']).optional(),
  cylinder_status: z.enum(['good', 'damaged', 'lost']).optional(),
  original_brand: z.string().optional(),
  accepted_brand: z.string().optional(),
  brand_reconciliation_status: z.enum(['pending', 'matched', 'generic_accepted']).optional(),
  brand_exchange_fee: z.number().min(0).optional(),
  damage_assessment: DamageAssessmentOutputSchema.optional(),
  lost_cylinder_fee: LostCylinderFeeOutputSchema.optional(),
  photo_urls: z.array(z.string()).optional(),
  notes: z.string().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  order: z.object({
    id: z.string().uuid(),
    order_number: z.string(),
    order_date: z.string().datetime(),
    delivery_date: z.string().datetime().optional(),
  }).optional(),
  customer: z.object({
    id: z.string().uuid(),
    name: z.string(),
    phone: z.string().optional(),
  }).optional(),
  product: z.object({
    id: z.string().uuid(),
    name: z.string(),
    sku: z.string(),
    capacity_l: z.number().optional(),
  }).optional(),
});

// List Empty Returns Response Schema
export const ListEmptyReturnsResponseSchema = z.object({
  credits: z.array(EmptyReturnCreditItemSchema),
  totalCount: z.number().min(0),
  totalPages: z.number().min(0),
  currentPage: z.number().min(1),
});

// Empty Returns Summary Schema
export const EmptyReturnsSummarySchema = z.object({
  total_pending_credits: z.number().min(0),
  total_pending_quantity: z.number().min(0),
  credits_expiring_soon: z.number().min(0),
  credits_overdue: z.number().min(0),
});

// Process Empty Return Response Schema
export const ProcessEmptyReturnResponseSchema = z.object({
  credit_id: z.string().uuid(),
  deposit_transaction_id: z.string().uuid().nullable(),
  brand_exchange_transaction_id: z.string().uuid().nullable(),
  quantity_processed: z.number().min(1),
  quantity_remaining: z.number().min(0),
  cylinder_status: z.enum(['good', 'damaged', 'lost']),
  original_brand: z.string().optional(),
  accepted_brand: z.string().optional(),
  brand_reconciliation_status: z.enum(['pending', 'matched', 'generic_accepted']).optional(),
  brand_exchange_fee: z.number().min(0),
  refund_amount: z.number().min(0),
  charge_amount: z.number().min(0),
  original_unit_amount: z.number().min(0),
  damage_assessment: DamageAssessmentOutputSchema.optional(),
  lost_cylinder_fee: LostCylinderFeeOutputSchema.optional(),
  status: z.enum(['partial_returned', 'fully_returned']),
});

// Cancel Empty Return Response Schema
export const CancelEmptyReturnResponseSchema = z.object({
  credit_id: z.string().uuid(),
  deposit_transaction_id: z.string().uuid(),
  charged_amount: z.number().min(0),
  reason: z.string(),
});

// Get Empty Return Details Response Schema
export const GetEmptyReturnDetailsResponseSchema = EmptyReturnCreditItemSchema;

// Calculate Lost Cylinder Fee Response Schema
export const CalculateLostCylinderFeeResponseSchema = z.object({
  base_fee: z.number().min(0),
  replacement_cost: z.number().min(0),
  administrative_fee: z.number().min(0),
  total_fee: z.number().min(0),
  currency_code: z.string(),
  calculation_notes: z.string().optional(),
});

// Validate Empty Return Response Schema
export const ValidateEmptyReturnResponseSchema = z.object({
  valid: z.boolean(),
  errors: z.array(z.string()),
  warnings: z.array(z.string()),
  credit_details: EmptyReturnCreditItemSchema.optional(),
});

// Brand Reconciliation Response Schema
export const BrandReconciliationResponseSchema = z.object({
  success: z.boolean(),
  credit_id: z.string().uuid(),
  original_brand: z.string(),
  accepted_brand: z.string(),
  brand_exchange_fee: z.number().min(0),
  reconciliation_status: z.enum(['matched', 'generic_accepted']),
  message: z.string(),
  processed_at: z.string().datetime(),
});

// Empty Return Statistics Schema
export const EmptyReturnStatisticsSchema = z.object({
  total_credits: z.number().min(0),
  pending_credits: z.number().min(0),
  returned_credits: z.number().min(0),
  cancelled_credits: z.number().min(0),
  expired_credits: z.number().min(0),
  total_value: z.number().min(0),
  pending_value: z.number().min(0),
  returned_value: z.number().min(0),
  average_return_rate: z.number().min(0).max(100),
  period: z.object({
    start_date: z.string().datetime(),
    end_date: z.string().datetime(),
  }),
});

// Customer Empty Return History Schema
export const CustomerEmptyReturnHistorySchema = z.object({
  customer_id: z.string().uuid(),
  customer_name: z.string(),
  total_credits_issued: z.number().min(0),
  total_credits_returned: z.number().min(0),
  total_credits_expired: z.number().min(0),
  return_rate_percentage: z.number().min(0).max(100),
  average_return_time_days: z.number().min(0),
  history: z.array(EmptyReturnCreditItemSchema),
  period: z.object({
    start_date: z.string().datetime(),
    end_date: z.string().datetime(),
  }),
});

// Empty Return Report Schema
export const EmptyReturnReportSchema = z.object({
  report_type: z.enum(['summary', 'detailed', 'customer_history']),
  generated_at: z.string().datetime(),
  period: z.object({
    start_date: z.string().datetime(),
    end_date: z.string().datetime(),
  }),
  data: z.union([
    EmptyReturnsSummarySchema,
    EmptyReturnStatisticsSchema,
    CustomerEmptyReturnHistorySchema,
  ]),
  filters: z.object({
    customer_id: z.string().uuid().optional(),
    status: z.enum(['pending', 'returned', 'cancelled', 'expired']).optional(),
    date_range: z.object({
      start_date: z.string().datetime().optional(),
      end_date: z.string().datetime().optional(),
    }).optional(),
  }).optional(),
}); 