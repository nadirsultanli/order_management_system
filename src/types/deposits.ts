// ============ DEPOSIT RATE TYPES ============

export interface DepositRate {
  id: string;
  capacity_l: number;
  deposit_amount: number;
  currency_code: string;
  effective_date: string;
  end_date?: string | null;
  notes?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
}

export interface CreateDepositRateData {
  capacity_l: number;
  deposit_amount: number;
  currency_code: string;
  effective_date: string;
  end_date?: string;
  notes?: string;
}

export interface UpdateDepositRateData {
  id: string;
  capacity_l?: number;
  deposit_amount?: number;
  currency_code?: string;
  effective_date?: string;
  end_date?: string;
  notes?: string;
  is_active?: boolean;
}

export interface DepositRateFilters {
  search?: string;
  capacity_l?: number;
  currency_code?: string;
  is_active?: boolean;
  effective_date_from?: string;
  effective_date_to?: string;
  page?: number;
  limit?: number;
}

export interface ListDepositRatesResponse {
  rates: DepositRate[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
}

// ============ CUSTOMER DEPOSIT TYPES ============

export interface CustomerDepositBalance {
  customer_id: string;
  customer_name: string;
  total_deposit_balance: number;
  currency_code: string;
  last_updated: string;
  cylinder_breakdown?: CylinderBreakdown[];
  pending_refunds: number;
  available_for_refund: number;
}

export interface CylinderBreakdown {
  capacity_l: number;
  quantity: number;
  unit_deposit: number;
  total_deposit: number;
}

export interface DepositTransaction {
  id: string;
  customer_id: string;
  transaction_type: 'charge' | 'refund' | 'adjustment';
  amount: number;
  currency_code: string;
  transaction_date: string;
  order_id?: string | null;
  notes?: string | null;
  created_by?: string | null;
  is_voided: boolean;
  voided_at?: string | null;
  voided_by?: string | null;
  void_reason?: string | null;
  cylinder_details: CylinderTransactionDetail[];
}

export interface CylinderTransactionDetail {
  product_id: string;
  product_name: string;
  capacity_l: number;
  quantity: number;
  unit_deposit: number;
  condition?: string | null;
}

export interface CustomerDepositHistory {
  customer_id: string;
  customer_name: string;
  transactions: DepositTransaction[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  summary: {
    total_charged: number;
    total_refunded: number;
    total_adjustments: number;
    current_balance: number;
  };
}

export interface CustomerDepositFilters {
  customer_id?: string;
  search?: string;
  transaction_type?: 'charge' | 'refund' | 'adjustment';
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
}

// ============ CHARGE/REFUND TYPES ============

export interface ChargeDepositData {
  customer_id: string;
  cylinders: {
    product_id: string;
    quantity: number;
    capacity_l: number;
    unit_deposit: number;
  }[];
  order_id?: string;
  notes?: string;
}

export interface ChargeDepositResponse {
  transaction_id: string;
  customer_id: string;
  total_charged: number;
  currency_code: string;
  new_balance: number;
  cylinders_charged: {
    product_id: string;
    product_name: string;
    quantity: number;
    capacity_l: number;
    unit_deposit: number;
    total_deposit: number;
  }[];
  order_id?: string | null;
  created_at: string;
}

export interface RefundDepositData {
  customer_id: string;
  cylinders: {
    product_id: string;
    quantity: number;
    capacity_l: number;
    condition: string;
  }[];
  refund_method: string;
  order_id?: string;
  notes?: string;
}

export interface RefundDepositResponse {
  transaction_id: string;
  customer_id: string;
  total_refunded: number;
  currency_code: string;
  new_balance: number;
  cylinders_refunded: {
    product_id: string;
    product_name: string;
    quantity: number;
    capacity_l: number;
    condition: string;
    unit_refund: number;
    total_refund: number;
    damage_deduction?: number | null;
  }[];
  refund_method: string;
  order_id?: string | null;
  created_at: string;
}

export interface RefundCalculation {
  customer_id: string;
  total_refund_amount: number;
  currency_code: string;
  cylinder_calculations: {
    product_id: string;
    product_name: string;
    capacity_l: number;
    quantity: number;
    original_deposit: number;
    condition: string;
    damage_deduction: number;
    depreciation_deduction: number;
    refund_amount: number;
    refund_percentage: number;
  }[];
  deductions_summary: {
    damage_deductions: number;
    depreciation_deductions: number;
    total_deductions: number;
  };
  eligibility: {
    is_eligible: boolean;
    reasons: string[];
  };
}

// ============ TRANSACTION FILTERS ============

export interface DepositTransactionFilters {
  search?: string;
  customer_id?: string;
  transaction_type?: 'charge' | 'refund' | 'adjustment';
  date_from?: string;
  date_to?: string;
  amount_min?: number;
  amount_max?: number;
  currency_code?: string;
  is_voided?: boolean;
  page?: number;
  limit?: number;
}

export interface ListDepositTransactionsResponse {
  transactions: DepositTransaction[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  summary: {
    total_charges: number;
    total_refunds: number;
    total_adjustments: number;
    net_deposits: number;
  };
}

// ============ SUMMARY & ANALYTICS TYPES ============

export interface DepositSummaryStats {
  total_outstanding: number;
  total_customers_with_deposits: number;
  total_cylinders_on_deposit: number;
  currency_code: string;
  period_charges: number;
  period_refunds: number;
  period_adjustments: number;
  net_change: number;
}

export interface DepositAnalytics {
  period: {
    from_date: string;
    to_date: string;
  };
  summary: {
    total_charges: number;
    total_refunds: number;
    total_adjustments: number;
    net_change: number;
    ending_balance: number;
  };
  breakdown: {
    group: string;
    charges: number;
    refunds: number;
    adjustments: number;
    net_change: number;
    transaction_count: number;
  }[];
  currency_code: string;
}

// ============ UTILITY TYPES ============

export interface AdjustDepositData {
  customer_id: string;
  adjustment_amount: number;
  reason: string;
  reference_number?: string;
  notes?: string;
}

export interface AdjustDepositResponse {
  transaction_id: string;
  customer_id: string;
  adjustment_amount: number;
  currency_code: string;
  previous_balance: number;
  new_balance: number;
  reason: string;
  reference_number?: string | null;
  created_at: string;
  created_by: string;
}

export interface CylinderCondition {
  value: string;
  label: string;
  refund_percentage: number;
  description?: string;
}

// ============ ENHANCED RETURN PROCESSING TYPES ============

export interface DamageAssessment {
  damage_type: string;
  severity: 'minor' | 'moderate' | 'severe';
  repair_cost_estimate?: number;
  photos?: File[];
  description: string;
}

export interface LostCylinderFee {
  base_fee: number;
  replacement_cost: number;
  administrative_fee: number;
  total_fee: number;
  currency_code: string;
}

export interface EnhancedReturnProcessingData {
  credit_id: string;
  quantity_returned: number;
  return_reason: string;
  notes?: string;
  cylinder_status: 'good' | 'damaged' | 'lost';
  original_brand?: string;
  accepted_brand?: string;
  brand_reconciliation_status?: 'pending' | 'matched' | 'generic_accepted';
  brand_exchange_fee?: number;
  damage_assessment?: DamageAssessment;
  lost_cylinder_fee?: LostCylinderFee;
  photo_urls?: string[];
}

export interface CylinderConditionHistory {
  id: string;
  cylinder_id: string;
  condition_date: string;
  condition_status: 'good' | 'damaged' | 'lost' | 'scrap';
  damage_assessment?: DamageAssessment;
  location: string;
  recorded_by: string;
  notes?: string;
  photos?: string[];
}

export const CYLINDER_CONDITIONS: CylinderCondition[] = [
  { value: 'excellent', label: 'Excellent', refund_percentage: 100, description: 'Like new condition' },
  { value: 'good', label: 'Good', refund_percentage: 90, description: 'Minor wear, fully functional' },
  { value: 'fair', label: 'Fair', refund_percentage: 75, description: 'Noticeable wear but functional' },
  { value: 'poor', label: 'Poor', refund_percentage: 50, description: 'Significant wear, needs repair' },
  { value: 'damaged', label: 'Damaged', refund_percentage: 25, description: 'Requires major repair' },
  { value: 'scrap', label: 'Scrap', refund_percentage: 0, description: 'Beyond repair, scrap value only' },
];

export const DAMAGE_TYPES = [
  { value: 'valve_damage', label: 'Valve Damage' },
  { value: 'cylinder_dent', label: 'Cylinder Dent' },
  { value: 'rust_corrosion', label: 'Rust/Corrosion' },
  { value: 'crack_damage', label: 'Crack Damage' },
  { value: 'handle_damage', label: 'Handle Damage' },
  { value: 'thread_damage', label: 'Thread Damage' },
  { value: 'label_damage', label: 'Label/Marking Damage' },
  { value: 'other', label: 'Other' },
];

export const DAMAGE_SEVERITY_OPTIONS = [
  { value: 'minor', label: 'Minor', refund_percentage: 85, description: 'Cosmetic damage, fully functional' },
  { value: 'moderate', label: 'Moderate', refund_percentage: 60, description: 'Functional with minor repair needed' },
  { value: 'severe', label: 'Severe', refund_percentage: 25, description: 'Major repair required' },
];

export const RETURN_STATUS_OPTIONS = [
  { value: 'good', label: 'Good Condition', color: 'text-green-600', description: 'No damage, ready for reuse' },
  { value: 'damaged', label: 'Damaged', color: 'text-yellow-600', description: 'Has damage but repairable' },
  { value: 'lost', label: 'Lost/Missing', color: 'text-red-600', description: 'Cylinder not returned, charge applicable' },
];

export const REFUND_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'check', label: 'Check' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'credit_note', label: 'Credit Note' },
  { value: 'account_credit', label: 'Account Credit' },
];

export const TRANSACTION_TYPES = [
  { value: 'charge', label: 'Charge', color: 'blue' },
  { value: 'refund', label: 'Refund', color: 'green' },
  { value: 'adjustment', label: 'Adjustment', color: 'yellow' },
] as const;