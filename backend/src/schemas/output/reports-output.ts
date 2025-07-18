import { z } from 'zod';

// ==============================================================
// REPORTS OUTPUT SCHEMAS
// ==============================================================

// ============ Base Entities ============

export const CustomerBaseSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().optional(),
  phone: z.string().optional(),
});

export const ProductBaseSchema = z.object({
  id: z.string(),
  sku: z.string(),
  name: z.string(),
  capacity_kg: z.number().optional(),
});

export const WarehouseBaseSchema = z.object({
  id: z.string(),
  name: z.string(),
});

// ============ Sales Reports ============

export const SalesReportItemSchema = z.object({
  date: z.string(),
  order_count: z.number(),
  total_revenue: z.number(),
  total_quantity: z.number(),
  average_order_value: z.number(),
  top_products: z.array(z.object({
    product_id: z.string(),
    product_name: z.string(),
    quantity_sold: z.number(),
    revenue: z.number(),
  })),
});

export const SalesReportResponseSchema = z.object({
  period: z.string(),
  start_date: z.string(),
  end_date: z.string(),
  summary: z.object({
    total_orders: z.number(),
    total_revenue: z.number(),
    total_quantity: z.number(),
    average_order_value: z.number(),
    growth_rate: z.number().optional(),
  }),
  daily_data: z.array(SalesReportItemSchema),
  top_customers: z.array(z.object({
    customer_id: z.string(),
    customer_name: z.string(),
    order_count: z.number(),
    total_spent: z.number(),
  })),
  top_products: z.array(z.object({
    product_id: z.string(),
    product_name: z.string(),
    quantity_sold: z.number(),
    revenue: z.number(),
    market_share: z.number(),
  })),
});

// ============ Inventory Reports ============

export const StockValuationItemSchema = z.object({
  warehouse_id: z.string(),
  warehouse_name: z.string(),
  product_id: z.string(),
  product_name: z.string(),
  product_sku: z.string(),
  capacity_kg: z.number(),
  qty_full: z.number(),
  qty_empty: z.number(),
  total_cylinders: z.number(),
  standard_cost: z.number(),
  full_valuation: z.number(),
  empty_valuation: z.number(),
  total_valuation: z.number(),
});

export const StockValuationResponseSchema = z.object({
  data: z.array(StockValuationItemSchema),
  summary: z.object({
    total_warehouses: z.number(),
    total_products: z.number(),
    total_full_cylinders: z.number(),
    total_empty_cylinders: z.number(),
    total_cylinders: z.number(),
    total_valuation: z.number(),
    full_valuation: z.number(),
    empty_valuation: z.number(),
  }).nullable(),
  grouped_data: z.array(z.any()).nullable(),
  as_of_date: z.string(),
  totalCount: z.number(),
  totalPages: z.number(),
  currentPage: z.number(),
  filters_applied: z.object({
    warehouse_id: z.string().nullable(),
    product_id: z.string().nullable(),
    group_by: z.string(),
  }),
});

// ============ Deposit Reports ============

export const DepositAnalysisItemSchema = z.object({
  customer_id: z.string(),
  customer_name: z.string(),
  outstanding_amount: z.number(),
  cylinder_count: z.number(),
  oldest_deposit_date: z.string(),
  days_outstanding: z.number(),
  aging_bucket: z.string(),
  exceeds_threshold: z.boolean(),
  last_return_date: z.string().nullable(),
});

export const DepositAnalysisResponseSchema = z.object({
  report_date: z.string(),
  total_outstanding: z.number(),
  total_customers: z.number(),
  total_cylinders: z.number(),
  aging_summary: z.object({
    current: z.number(),
    days_30: z.number(),
    days_60: z.number(),
    days_90: z.number(),
    over_90: z.number(),
  }),
  customers: z.array(DepositAnalysisItemSchema),
  summary: z.object({
    average_outstanding_per_customer: z.number(),
    customers_exceeding_threshold: z.number(),
    total_risk_amount: z.number(),
  }),
});

// ============ Margin Analysis ============

export const MarginAnalysisItemSchema = z.object({
  order_id: z.string(),
  order_type: z.string(),
  order_date: z.string(),
  customer_id: z.string(),
  customer_name: z.string(),
  product_id: z.string(),
  product_name: z.string(),
  quantity: z.number(),
  revenue: z.number(),
  gas_fill_cost: z.number(),
  cylinder_handling_cost: z.number(),
  total_cogs: z.number(),
  gross_margin: z.number(),
  margin_percentage: z.number(),
});

export const MarginAnalysisResponseSchema = z.object({
  report_date: z.string(),
  total_revenue: z.number(),
  total_cogs: z.number(),
  total_gross_margin: z.number(),
  average_margin_percentage: z.number(),
  orders: z.array(MarginAnalysisItemSchema),
  summary: z.object({
    high_margin_orders: z.number(),
    low_margin_orders: z.number(),
    negative_margin_orders: z.number(),
    top_margin_products: z.array(z.object({
      product_id: z.string(),
      product_name: z.string(),
      average_margin: z.number(),
      total_revenue: z.number(),
    })),
  }),
});

// ============ Operational KPIs ============

export const OperationalKPIItemSchema = z.object({
  metric_name: z.string(),
  metric_value: z.number(),
  metric_unit: z.string(),
  period: z.string(),
  benchmark: z.number().nullable(),
  variance: z.number().nullable(),
  trend_direction: z.enum(['up', 'down', 'stable']),
});

export const OperationalKPIsResponseSchema = z.object({
  report_date: z.string(),
  period: z.string(),
  kpis: z.array(OperationalKPIItemSchema),
  summary: z.object({
    total_metrics: z.number(),
    improving_metrics: z.number(),
    declining_metrics: z.number(),
    stable_metrics: z.number(),
  }),
});

// ============ Customer Reports ============

export const CustomerReportItemSchema = z.object({
  customer_id: z.string(),
  customer_name: z.string(),
  email: z.string().optional(),
  phone: z.string().optional(),
  total_orders: z.number(),
  total_spent: z.number(),
  average_order_value: z.number(),
  last_order_date: z.string().nullable(),
  days_since_last_order: z.number().nullable(),
  customer_segment: z.string(),
  deposit_balance: z.number(),
  outstanding_balance: z.number(),
});

export const CustomerReportResponseSchema = z.object({
  report_date: z.string(),
  total_customers: z.number(),
  active_customers: z.number(),
  customers: z.array(CustomerReportItemSchema),
  summary: z.object({
    total_revenue: z.number(),
    average_customer_value: z.number(),
    top_customers: z.array(z.object({
      customer_id: z.string(),
      customer_name: z.string(),
      total_spent: z.number(),
    })),
    customer_segments: z.array(z.object({
      segment: z.string(),
      count: z.number(),
      total_revenue: z.number(),
    })),
  }),
});

// ============ Delivery Reports ============

export const DeliveryReportItemSchema = z.object({
  delivery_id: z.string(),
  order_id: z.string(),
  customer_name: z.string(),
  delivery_date: z.string(),
  delivery_status: z.string(),
  delivery_time: z.number().optional(),
  distance_km: z.number().optional(),
  fuel_cost: z.number().optional(),
  driver_name: z.string().optional(),
  truck_id: z.string().optional(),
});

export const DeliveryReportResponseSchema = z.object({
  report_date: z.string(),
  period: z.string(),
  total_deliveries: z.number(),
  completed_deliveries: z.number(),
  pending_deliveries: z.number(),
  deliveries: z.array(DeliveryReportItemSchema),
  summary: z.object({
    average_delivery_time: z.number(),
    total_distance: z.number(),
    total_fuel_cost: z.number(),
    on_time_delivery_rate: z.number(),
    top_drivers: z.array(z.object({
      driver_name: z.string(),
      deliveries_completed: z.number(),
      average_rating: z.number(),
    })),
  }),
});

// ============ Product Performance ============

export const ProductPerformanceItemSchema = z.object({
  product_id: z.string(),
  product_name: z.string(),
  product_sku: z.string(),
  total_quantity_sold: z.number(),
  total_revenue: z.number(),
  average_price: z.number(),
  profit_margin: z.number(),
  stock_turnover: z.number(),
  days_of_inventory: z.number(),
  reorder_frequency: z.number(),
});

export const ProductPerformanceResponseSchema = z.object({
  report_date: z.string(),
  period: z.string(),
  total_products: z.number(),
  products: z.array(ProductPerformanceItemSchema),
  summary: z.object({
    total_revenue: z.number(),
    total_quantity_sold: z.number(),
    average_profit_margin: z.number(),
    top_performing_products: z.array(z.object({
      product_id: z.string(),
      product_name: z.string(),
      revenue: z.number(),
      profit_margin: z.number(),
    })),
    slow_moving_products: z.array(z.object({
      product_id: z.string(),
      product_name: z.string(),
      days_of_inventory: z.number(),
      stock_turnover: z.number(),
    })),
  }),
});

// ============ Financial Reports ============

export const FinancialReportItemSchema = z.object({
  date: z.string(),
  revenue: z.number(),
  cost_of_goods: z.number(),
  gross_profit: z.number(),
  operating_expenses: z.number(),
  net_profit: z.number(),
  cash_flow: z.number(),
  accounts_receivable: z.number(),
  accounts_payable: z.number(),
});

export const FinancialReportResponseSchema = z.object({
  report_date: z.string(),
  period: z.string(),
  total_revenue: z.number(),
  total_cost_of_goods: z.number(),
  total_gross_profit: z.number(),
  total_operating_expenses: z.number(),
  total_net_profit: z.number(),
  daily_data: z.array(FinancialReportItemSchema),
  summary: z.object({
    profit_margin: z.number(),
    gross_margin: z.number(),
    operating_margin: z.number(),
    cash_flow_trend: z.string(),
    revenue_growth: z.number(),
    profit_growth: z.number(),
  }),
});

// ============ Compliance Reports ============

export const ComplianceReportItemSchema = z.object({
  compliance_id: z.string(),
  compliance_type: z.string(),
  status: z.string(),
  due_date: z.string(),
  completion_date: z.string().nullable(),
  responsible_party: z.string(),
  description: z.string(),
  risk_level: z.string(),
});

export const ComplianceReportResponseSchema = z.object({
  report_date: z.string(),
  total_compliance_items: z.number(),
  completed_items: z.number(),
  pending_items: z.number(),
  overdue_items: z.number(),
  items: z.array(ComplianceReportItemSchema),
  summary: z.object({
    compliance_rate: z.number(),
    high_risk_items: z.number(),
    upcoming_deadlines: z.array(z.object({
      compliance_id: z.string(),
      compliance_type: z.string(),
      due_date: z.string(),
      days_remaining: z.number(),
    })),
  }),
});

// ============ Export Formats ============

export const ReportExportResponseSchema = z.object({
  success: z.boolean(),
  download_url: z.string().optional(),
  file_name: z.string().optional(),
  file_size: z.number().optional(),
  error: z.string().optional(),
});

// ============ Report Metadata ============

export const ReportMetadataSchema = z.object({
  report_id: z.string(),
  report_type: z.string(),
  generated_at: z.string(),
  generated_by: z.string(),
  parameters: z.record(z.any()),
  status: z.string(),
  file_size: z.number().optional(),
  download_url: z.string().optional(),
});

export const ReportListResponseSchema = z.object({
  reports: z.array(ReportMetadataSchema),
  total_count: z.number(),
  total_pages: z.number(),
  current_page: z.number(),
}); 