import { z } from 'zod';

// ============ DEPOSIT RATE MANAGEMENT SCHEMAS ============

// GET /deposits/rates - List all cylinder deposit rates
export const ListDepositRatesSchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(50),
  search: z.string().optional(),
  capacity_l: z.number().optional(),
  currency_code: z.string().length(3).optional(),
  is_active: z.boolean().optional(),
  effective_date: z.string().optional(), // ISO date to filter rates effective on this date
  sort_by: z.enum(['capacity_l', 'deposit_amount', 'effective_date', 'created_at']).default('capacity_l'),
  sort_order: z.enum(['asc', 'desc']).default('asc'),
});

// POST /deposits/rates - Create new deposit rate
export const CreateDepositRateSchema = z.object({
  capacity_l: z.number().positive(),
  deposit_amount: z.number().positive(),
  currency_code: z.string().length(3).default('KES'),
  effective_date: z.string(), // ISO date
  end_date: z.string().optional(), // ISO date
  notes: z.string().optional(),
  is_active: z.boolean().default(true),
});

// PUT /deposits/rates/{id} - Update deposit rate
export const UpdateDepositRateSchema = z.object({
  id: z.string().uuid(),
  deposit_amount: z.number().positive().optional(),
  end_date: z.string().optional(), // ISO date
  notes: z.string().optional(),
  is_active: z.boolean().optional(),
});

// DELETE /deposits/rates/{id} - Delete deposit rate
export const DeleteDepositRateSchema = z.object({
  id: z.string().uuid(),
});

// GET /deposits/rates/by-capacity/{capacity} - Get deposit rate for specific capacity
export const GetDepositRateByCapacitySchema = z.object({
  capacity: z.number().positive(),
  currency_code: z.string().length(3).default('KES'),
  as_of_date: z.string().optional(), // ISO date, defaults to today
});

// POST /deposits/rates/bulk-update - Bulk update deposit rates
export const BulkUpdateDepositRatesSchema = z.object({
  updates: z.array(z.object({
    capacity_l: z.number().positive(),
    deposit_amount: z.number().positive(),
    currency_code: z.string().length(3).default('KES'),
  })),
  effective_date: z.string(), // ISO date
  notes: z.string().optional(),
  end_current_rates: z.boolean().default(true), // Whether to end-date current rates
});

// ============ CUSTOMER DEPOSIT TRACKING SCHEMAS ============

// GET /customers/{id}/deposits/balance - Get customer deposit balance
export const GetCustomerDepositBalanceSchema = z.object({
  customer_id: z.string().uuid(),
  include_details: z.boolean().default(false), // Include breakdown by cylinder
});

// GET /customers/{id}/deposits/history - Get deposit transaction history
export const GetCustomerDepositHistorySchema = z.object({
  customer_id: z.string().uuid(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(50),
  transaction_type: z.enum(['charge', 'refund', 'adjustment', 'all']).default('all'),
  from_date: z.string().optional(), // ISO date
  to_date: z.string().optional(), // ISO date
  sort_by: z.enum(['transaction_date', 'amount', 'transaction_type']).default('transaction_date'),
  sort_order: z.enum(['asc', 'desc']).default('desc'),
});

// POST /customers/{id}/deposits/charge - Charge deposit to customer
export const ChargeCustomerDepositSchema = z.object({
  customer_id: z.string().uuid(),
  cylinders: z.array(z.object({
    product_id: z.string().uuid(),
    quantity: z.number().positive(),
    capacity_l: z.number().positive(),
    unit_deposit: z.number().positive().optional(), // Override default rate if needed
  })),
  order_id: z.string().uuid().optional(),
  notes: z.string().optional(),
  override_reason: z.string().optional(), // Required if overriding rates
});

// POST /customers/{id}/deposits/refund - Refund deposit to customer
export const RefundCustomerDepositSchema = z.object({
  customer_id: z.string().uuid(),
  cylinders: z.array(z.object({
    product_id: z.string().uuid(),
    quantity: z.number().positive(),
    capacity_l: z.number().positive(),
    condition: z.enum(['good', 'damaged', 'missing']).default('good'),
    damage_percentage: z.number().min(0).max(100).optional(), // For partial refunds
    serial_numbers: z.array(z.string()).optional(), // Track specific cylinders if available
  })),
  order_id: z.string().uuid().optional(),
  notes: z.string().optional(),
  refund_method: z.enum(['credit', 'cash', 'bank_transfer']).default('credit'),
});

// GET /customers/{id}/deposits/cylinders - Get cylinders customer has
export const GetCustomerCylindersSchema = z.object({
  customer_id: z.string().uuid(),
  include_history: z.boolean().default(false),
  group_by_capacity: z.boolean().default(true),
});

// ============ DEPOSIT TRANSACTION SCHEMAS ============

// GET /deposits/transactions - List deposit transactions with filtering
export const ListDepositTransactionsSchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(50),
  customer_id: z.string().uuid().optional(),
  transaction_type: z.enum(['charge', 'refund', 'adjustment']).optional(),
  from_date: z.string().optional(), // ISO date
  to_date: z.string().optional(), // ISO date
  min_amount: z.number().optional(),
  max_amount: z.number().optional(),
  currency_code: z.string().length(3).optional(),
  include_voided: z.boolean().default(false),
  sort_by: z.enum(['transaction_date', 'amount', 'customer_name']).default('transaction_date'),
  sort_order: z.enum(['asc', 'desc']).default('desc'),
});

// POST /deposits/transactions/calculate-refund - Calculate refund amount for cylinder return
export const CalculateDepositRefundSchema = z.object({
  customer_id: z.string().uuid(),
  cylinders: z.array(z.object({
    product_id: z.string().uuid(),
    quantity: z.number().positive(),
    capacity_l: z.number().positive(),
    condition: z.enum(['good', 'damaged', 'missing']).default('good'),
    damage_percentage: z.number().min(0).max(100).optional(),
    days_held: z.number().optional(), // For time-based depreciation if applicable
  })),
  apply_depreciation: z.boolean().default(false),
  depreciation_rate_per_year: z.number().min(0).max(100).optional(),
});

// ============ VALIDATION SCHEMAS ============

// POST /deposits/validate-rate - Validate deposit rate
export const ValidateDepositRateSchema = z.object({
  capacity_l: z.number().positive(),
  deposit_amount: z.number().positive(),
  currency_code: z.string().length(3).default('KES'),
  effective_date: z.string(), // ISO date
  check_conflicts: z.boolean().default(true),
});

// POST /deposits/validate-refund - Validate refund eligibility
export const ValidateDepositRefundSchema = z.object({
  customer_id: z.string().uuid(),
  cylinder_count: z.number().positive(),
  capacity_l: z.number().positive(),
  check_balance: z.boolean().default(true),
});

// ============ REPORTING SCHEMAS ============

// GET /deposits/reports/summary - Get deposit summary report
export const GetDepositSummaryReportSchema = z.object({
  from_date: z.string(), // ISO date
  to_date: z.string(), // ISO date
  group_by: z.enum(['customer', 'capacity', 'month', 'transaction_type']).default('transaction_type'),
  currency_code: z.string().length(3).optional(),
});

// GET /deposits/reports/outstanding - Get outstanding deposits report
export const GetOutstandingDepositsReportSchema = z.object({
  as_of_date: z.string().optional(), // ISO date, defaults to today
  min_days_outstanding: z.number().optional(),
  customer_id: z.string().uuid().optional(),
  group_by: z.enum(['customer', 'capacity', 'age']).default('customer'),
  include_zero_balance: z.boolean().default(false),
});

// ============ UTILITY SCHEMAS ============

// POST /deposits/adjust - Manual deposit adjustment
export const AdjustCustomerDepositSchema = z.object({
  customer_id: z.string().uuid(),
  adjustment_amount: z.number(), // Can be positive or negative
  currency_code: z.string().length(3).default('KES'),
  reason: z.string(),
  reference_number: z.string().optional(),
  approved_by: z.string().optional(),
});

// GET /deposits/audit-trail/{transaction_id} - Get audit trail for a transaction
export const GetDepositAuditTrailSchema = z.object({
  transaction_id: z.string().uuid(),
  include_related: z.boolean().default(true),
});