// ============ Stock Valuation Report Types ============

export interface StockValuationData {
  warehouse_id: string;
  warehouse_name: string;
  product_id: string;
  product_name: string;
  product_sku: string;
  capacity_kg: number;
  qty_full: number;
  qty_empty: number;
  total_cylinders: number;
  standard_cost: number;
  full_valuation: number;
  empty_valuation: number;
  total_valuation: number;
}

export interface StockValuationSummary {
  total_warehouses: number;
  total_products: number;
  total_full_cylinders: number;
  total_empty_cylinders: number;
  total_cylinders: number;
  total_valuation: number;
  full_valuation: number;
  empty_valuation: number;
}

export interface StockValuationGroupedData {
  warehouse_id?: string;
  warehouse_name?: string;
  product_id?: string;
  product_name?: string;
  product_sku?: string;
  cylinder_type?: string;
  capacity_kg?: number;
  total_valuation: number;
  total_cylinders: number;
  products_count?: number;
  warehouses_count?: number;
  items: StockValuationData[];
}

export interface StockValuationReport {
  data: StockValuationData[];
  summary: StockValuationSummary | null;
  grouped_data: StockValuationGroupedData[] | null;
  as_of_date: string;
  totalCount: number;
  totalPages: number;
  currentPage: number;
  filters_applied: {
    warehouse_id?: string;
    product_id?: string;
    group_by: 'warehouse' | 'product' | 'cylinder_type';
  };
}

export interface StockValuationParams {
  warehouse_id?: string;
  product_id?: string;
  as_of_date?: string;
  include_summary?: boolean;
  group_by?: 'warehouse' | 'product' | 'cylinder_type';
  page?: number;
  limit?: number;
}

// ============ Deposit Analysis Report Types ============

export interface DepositAnalysisData {
  customer_id: string;
  customer_name: string;
  outstanding_amount: number;
  cylinder_count: number;
  oldest_deposit_date: string;
  days_outstanding: number;
  aging_bucket: string;
  exceeds_threshold: boolean;
  last_return_date: string | null;
}

export interface DepositAnalysisSummary {
  total_outstanding_amount: number;
  customers_with_deposits: number;
  total_cylinders_on_deposit: number;
  average_outstanding_per_customer: number;
  customers_exceeding_threshold: number;
}

export interface AgingBreakdown {
  bucket: string;
  customer_count: number;
  total_amount: number;
  cylinder_count: number;
}

export interface DepositAnalysisReport {
  data: DepositAnalysisData[];
  summary: DepositAnalysisSummary;
  aging_breakdown: AgingBreakdown[] | null;
  as_of_date: string;
  totalCount: number;
  totalPages: number;
  currentPage: number;
  filters_applied: {
    customer_id?: string;
    threshold_amount?: number;
    min_days_outstanding?: number;
    date_range: { start_date: string; end_date: string };
  };
}

export interface DepositAnalysisParams {
  customer_id?: string;
  aging_buckets?: boolean;
  include_zero_balances?: boolean;
  min_days_outstanding?: number;
  threshold_amount?: number;
  as_of_date?: string;
  start_date: string;
  end_date: string;
  page?: number;
  limit?: number;
}

// ============ Margin Analysis Report Types ============

export interface MarginAnalysisData {
  order_id: string;
  order_type: string;
  order_date: string;
  customer_id: string;
  customer_name: string;
  product_id: string;
  product_name: string;
  quantity: number;
  revenue: number;
  gas_fill_cost: number;
  cylinder_handling_cost: number;
  total_cogs: number;
  gross_margin: number;
  margin_percentage: number;
}

export interface MarginAnalysisSummary {
  total_revenue: number;
  total_cogs: number;
  total_gas_fill_costs: number;
  total_handling_costs: number;
  total_gross_margin: number;
  average_margin_percentage: number;
  order_count: number;
}

export interface MarginAnalysisGroupedData {
  order_type?: string;
  product_id?: string;
  customer_id?: string;
  revenue: number;
  cogs: number;
  gross_margin: number;
  order_count: number;
  margin_percentage: number;
}

export interface CostsBreakdown {
  gas_fill_percentage: number;
  handling_percentage: number;
  cogs_to_revenue_ratio: number;
}

export interface MarginAnalysisReport {
  data: MarginAnalysisData[];
  summary: MarginAnalysisSummary;
  grouped_data: MarginAnalysisGroupedData[] | null;
  costs_breakdown: CostsBreakdown | null;
  totalCount: number;
  totalPages: number;
  currentPage: number;
  filters_applied: {
    order_type: 'FULL-OUT' | 'FULL-XCH' | 'all';
    product_id?: string;
    customer_id?: string;
    warehouse_id?: string;
    date_range: { start_date: string; end_date: string };
  };
}

export interface MarginAnalysisParams {
  order_type?: 'FULL-OUT' | 'FULL-XCH' | 'all';
  product_id?: string;
  customer_id?: string;
  warehouse_id?: string;
  group_by?: 'order_type' | 'product' | 'customer' | 'date';
  include_costs_breakdown?: boolean;
  start_date: string;
  end_date: string;
  page?: number;
  limit?: number;
}

// ============ Operational KPIs Report Types ============

export interface OperationalKPIData {
  metric_name: string;
  metric_value: number;
  metric_unit: string;
  period: string;
  benchmark: number | null;
  variance: number | null;
  trend_direction: 'up' | 'down' | 'stable';
}

export interface OperationalKPITrends {
  period_comparison: string;
  metrics_improving: number;
  metrics_declining: number;
  metrics_stable: number;
}

export interface OperationalKPISummary {
  total_metrics: number;
  metrics_with_benchmarks: number;
  metrics_meeting_benchmarks: number;
}

export interface OperationalKPIReport {
  data: OperationalKPIData[];
  trends: OperationalKPITrends | null;
  summary: OperationalKPISummary;
  period: {
    start_date: string;
    end_date: string;
  };
  filters_applied: {
    customer_id?: string;
    product_capacity?: number;
    kpi_types: ('return_rates' | 'deposit_liability' | 'lost_cylinders' | 'aging')[];
  };
}

export interface OperationalKPIParams {
  customer_id?: string;
  product_capacity?: number;
  include_trends?: boolean;
  kpi_types?: ('return_rates' | 'deposit_liability' | 'lost_cylinders' | 'aging')[];
  start_date: string;
  end_date: string;
  page?: number;
  limit?: number;
}

// ============ Dashboard Summary Types ============

export interface StockValuationSummaryData {
  total_value: number;
  total_cylinders: number;
  currency: string;
}

export interface DepositLiabilitySummaryData {
  total_outstanding: number;
  currency: string;
}

export interface OperationalMetricsSummaryData {
  return_rate_percentage: number;
  period_days: number;
}

export interface FinancialPerformanceSummaryData {
  total_revenue: number;
  gross_margin_percentage: number;
  period_days: number;
  currency: string;
}

export interface DashboardSummary {
  stock_valuation: StockValuationSummaryData;
  deposit_liability: DepositLiabilitySummaryData;
  operational_metrics: OperationalMetricsSummaryData;
  financial_performance: FinancialPerformanceSummaryData;
  generated_at: string;
  period: {
    start_date: string;
    end_date: string;
  };
}

// ============ Common Types ============

export interface DateRange {
  start: string;
  end: string;
}

export type ReportTab = 'stock-valuation' | 'deposit-analysis' | 'margin-analysis' | 'operational-kpis';

export interface ExportOptions {
  format: 'csv' | 'pdf';
  filename?: string;
  includeCharts?: boolean;
}

// ============ Chart Data Types ============

export interface ChartDataPoint {
  name: string;
  value: number;
  fill?: string;
  label?: string;
}

export interface BarChartData {
  warehouse_name: string;
  full_value: number;
  empty_value: number;
  total_value: number;
}

export interface PieChartData {
  name: string;
  value: number;
  percentage: number;
  fill: string;
}

export interface TableColumn {
  key: string;
  label: string;
  sortable?: boolean;
  formatter?: (value: any, row?: any) => string;
  align?: 'left' | 'center' | 'right';
}

export interface SortConfig {
  key: string;
  direction: 'asc' | 'desc';
}