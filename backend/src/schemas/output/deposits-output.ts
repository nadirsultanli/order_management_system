import { z } from 'zod';

// ============ DEPOSIT RATE MANAGEMENT OUTPUT SCHEMAS ============

export const DepositRateSchema = z.object({
  id: z.string().uuid(),
  capacity_l: z.number(),
  deposit_amount: z.number(),
  currency_code: z.string(),
  effective_date: z.string(),
  end_date: z.string().nullable(),
  notes: z.string().nullable(),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
  created_by: z.string().nullable(),
});

export const ListDepositRatesResponseSchema = z.object({
  rates: z.array(DepositRateSchema),
  totalCount: z.number(),
  totalPages: z.number(),
  currentPage: z.number(),
});

export const CreateDepositRateResponseSchema = DepositRateSchema;

export const UpdateDepositRateResponseSchema = DepositRateSchema;

export const DeleteDepositRateResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export const GetDepositRateByCapacityResponseSchema = z.object({
  capacity_l: z.number(),
  deposit_amount: z.number(),
  currency_code: z.string(),
  effective_date: z.string(),
  rate_id: z.string().uuid(),
  is_default: z.boolean(),
});

export const BulkUpdateDepositRatesResponseSchema = z.object({
  created_rates: z.array(DepositRateSchema),
  ended_rates: z.array(z.string().uuid()),
  success_count: z.number(),
  error_count: z.number(),
  errors: z.array(z.string()),
});

// ============ CUSTOMER DEPOSIT TRACKING OUTPUT SCHEMAS ============

export const CustomerDepositBalanceResponseSchema = z.object({
  customer_id: z.string().uuid(),
  customer_name: z.string(),
  total_deposit_balance: z.number(),
  currency_code: z.string(),
  last_updated: z.string(),
  cylinder_breakdown: z.array(z.object({
    capacity_l: z.number(),
    quantity: z.number(),
    unit_deposit: z.number(),
    total_deposit: z.number(),
  })).optional(),
  pending_refunds: z.number(),
  available_for_refund: z.number(),
});

export const DepositTransactionSchema = z.object({
  id: z.string().uuid(),
  customer_id: z.string().uuid(),
  transaction_type: z.enum(['charge', 'refund', 'adjustment']),
  amount: z.number(),
  currency_code: z.string(),
  transaction_date: z.string(),
  order_id: z.string().uuid().nullable(),
  notes: z.string().nullable(),
  created_by: z.string().nullable(),
  is_voided: z.boolean(),
  voided_at: z.string().nullable(),
  voided_by: z.string().nullable(),
  void_reason: z.string().nullable(),
  cylinder_details: z.array(z.object({
    product_id: z.string().uuid(),
    product_name: z.string(),
    capacity_l: z.number(),
    quantity: z.number(),
    unit_deposit: z.number(),
    condition: z.string().nullable(),
  })),
});

export const CustomerDepositHistoryResponseSchema = z.object({
  customer_id: z.string().uuid(),
  customer_name: z.string(),
  transactions: z.array(DepositTransactionSchema),
  totalCount: z.number(),
  totalPages: z.number(),
  currentPage: z.number(),
  summary: z.object({
    total_charged: z.number(),
    total_refunded: z.number(),
    total_adjustments: z.number(),
    current_balance: z.number(),
  }),
});

export const ChargeCustomerDepositResponseSchema = z.object({
  transaction_id: z.string().uuid(),
  customer_id: z.string().uuid(),
  total_charged: z.number(),
  currency_code: z.string(),
  new_balance: z.number(),
  cylinders_charged: z.array(z.object({
    product_id: z.string().uuid(),
    product_name: z.string(),
    quantity: z.number(),
    capacity_l: z.number(),
    unit_deposit: z.number(),
    total_deposit: z.number(),
  })),
  order_id: z.string().uuid().nullable(),
  created_at: z.string(),
});

export const RefundCustomerDepositResponseSchema = z.object({
  transaction_id: z.string().uuid(),
  customer_id: z.string().uuid(),
  total_refunded: z.number(),
  currency_code: z.string(),
  new_balance: z.number(),
  cylinders_refunded: z.array(z.object({
    product_id: z.string().uuid(),
    product_name: z.string(),
    quantity: z.number(),
    capacity_l: z.number(),
    condition: z.string(),
    unit_refund: z.number(),
    total_refund: z.number(),
    damage_deduction: z.number().nullable(),
  })),
  refund_method: z.string(),
  order_id: z.string().uuid().nullable(),
  created_at: z.string(),
});

export const CustomerCylindersResponseSchema = z.object({
  customer_id: z.string().uuid(),
  customer_name: z.string(),
  total_cylinders: z.number(),
  total_deposit_value: z.number(),
  currency_code: z.string(),
  cylinders_by_capacity: z.array(z.object({
    capacity_l: z.number(),
    quantity: z.number(),
    unit_deposit: z.number(),
    total_deposit: z.number(),
    last_charged_date: z.string().nullable(),
  })),
  recent_activity: z.array(z.object({
    date: z.string(),
    type: z.string(),
    capacity_l: z.number(),
    quantity: z.number(),
    amount: z.number(),
  })).optional(),
});

// ============ DEPOSIT TRANSACTION OUTPUT SCHEMAS ============

export const ListDepositTransactionsResponseSchema = z.object({
  transactions: z.array(DepositTransactionSchema),
  totalCount: z.number(),
  totalPages: z.number(),
  currentPage: z.number(),
  summary: z.object({
    total_charges: z.number(),
    total_refunds: z.number(),
    total_adjustments: z.number(),
    net_deposits: z.number(),
  }),
});

export const CalculateDepositRefundResponseSchema = z.object({
  customer_id: z.string().uuid(),
  total_refund_amount: z.number(),
  currency_code: z.string(),
  cylinder_calculations: z.array(z.object({
    product_id: z.string().uuid(),
    product_name: z.string(),
    capacity_l: z.number(),
    quantity: z.number(),
    original_deposit: z.number(),
    condition: z.string(),
    damage_deduction: z.number(),
    depreciation_deduction: z.number(),
    refund_amount: z.number(),
    refund_percentage: z.number(),
  })),
  deductions_summary: z.object({
    damage_deductions: z.number(),
    depreciation_deductions: z.number(),
    total_deductions: z.number(),
  }),
  eligibility: z.object({
    is_eligible: z.boolean(),
    reasons: z.array(z.string()),
  }),
});

// ============ VALIDATION OUTPUT SCHEMAS ============

export const ValidateDepositRateResponseSchema = z.object({
  is_valid: z.boolean(),
  errors: z.array(z.string()),
  warnings: z.array(z.string()),
  conflicts: z.array(z.object({
    existing_rate_id: z.string().uuid(),
    capacity_l: z.number(),
    effective_date: z.string(),
    end_date: z.string().nullable(),
    conflict_type: z.string(),
  })),
});

export const ValidateDepositRefundResponseSchema = z.object({
  is_eligible: z.boolean(),
  customer_balance: z.number(),
  requested_refund: z.number(),
  available_cylinders: z.number(),
  validation_errors: z.array(z.string()),
  validation_warnings: z.array(z.string()),
});

// ============ REPORTING OUTPUT SCHEMAS ============

export const DepositSummaryReportResponseSchema = z.object({
  period: z.object({
    from_date: z.string(),
    to_date: z.string(),
  }),
  summary: z.object({
    total_charges: z.number(),
    total_refunds: z.number(),
    total_adjustments: z.number(),
    net_change: z.number(),
    ending_balance: z.number(),
  }),
  breakdown: z.array(z.object({
    group: z.string(),
    charges: z.number(),
    refunds: z.number(),
    adjustments: z.number(),
    net_change: z.number(),
    transaction_count: z.number(),
  })),
  currency_code: z.string(),
});

export const OutstandingDepositsReportResponseSchema = z.object({
  as_of_date: z.string(),
  total_outstanding: z.number(),
  currency_code: z.string(),
  customer_count: z.number(),
  cylinder_count: z.number(),
  breakdown: z.array(z.object({
    group: z.string(),
    outstanding_amount: z.number(),
    customer_count: z.number(),
    cylinder_count: z.number(),
    average_days_outstanding: z.number(),
    oldest_deposit_date: z.string(),
  })),
  top_customers: z.array(z.object({
    customer_id: z.string().uuid(),
    customer_name: z.string(),
    outstanding_amount: z.number(),
    cylinder_count: z.number(),
    oldest_deposit_date: z.string(),
    days_outstanding: z.number(),
  })),
});

// ============ UTILITY OUTPUT SCHEMAS ============

export const AdjustCustomerDepositResponseSchema = z.object({
  transaction_id: z.string().uuid(),
  customer_id: z.string().uuid(),
  adjustment_amount: z.number(),
  currency_code: z.string(),
  previous_balance: z.number(),
  new_balance: z.number(),
  reason: z.string(),
  reference_number: z.string().nullable(),
  created_at: z.string(),
  created_by: z.string(),
});

export const DepositAuditTrailResponseSchema = z.object({
  transaction_id: z.string().uuid(),
  transaction_type: z.string(),
  amount: z.number(),
  currency_code: z.string(),
  created_at: z.string(),
  created_by: z.string(),
  audit_entries: z.array(z.object({
    id: z.string().uuid(),
    action: z.string(),
    field_name: z.string().nullable(),
    old_value: z.string().nullable(),
    new_value: z.string().nullable(),
    changed_at: z.string(),
    changed_by: z.string(),
    ip_address: z.string().nullable(),
    user_agent: z.string().nullable(),
  })),
  related_transactions: z.array(z.object({
    id: z.string().uuid(),
    type: z.string(),
    amount: z.number(),
    created_at: z.string(),
  })).optional(),
});