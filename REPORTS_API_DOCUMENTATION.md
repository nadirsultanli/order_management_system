# Cylinder Business Reporting APIs

This document outlines the comprehensive backend report data APIs implemented for cylinder business reporting in the order management system.

## Overview

The reporting system provides four core report types designed specifically for cylinder gas distribution businesses:

1. **Stock Valuation Data** - Inventory valuation by warehouse and cylinder type
2. **Deposit Analysis Data** - Customer deposit tracking with aging and liability analysis  
3. **Margin Analysis Data** - Profitability analysis by order type and product
4. **Operational KPIs Data** - Key performance indicators for cylinder operations

## API Endpoints

All endpoints are accessible via the `/reports` namespace and require authentication.

### 1. Stock Valuation Report

**Endpoint:** `GET /reports/stock-valuation`

**Purpose:** Analyze inventory valuation across warehouses showing FULL vs EMPTY cylinder counts with standard costs.

**Key Features:**
- Join inventory_balance, warehouses, and products tables
- Calculate total valuation (quantity × standard_cost) by warehouse and cylinder type
- Support for grouping by warehouse, product, or cylinder type
- Empty cylinders valued at 70% of full cylinder cost
- Pagination and filtering support

**Parameters:**
```typescript
{
  warehouse_id?: string;        // Filter by specific warehouse
  product_id?: string;          // Filter by specific product
  as_of_date?: string;          // Valuation as of specific date
  include_summary?: boolean;    // Include summary statistics
  group_by?: 'warehouse' | 'product' | 'cylinder_type';
  page?: number;
  limit?: number;
}
```

**Response:**
```typescript
{
  data: StockValuationData[];
  summary: {
    total_warehouses: number;
    total_products: number;
    total_full_cylinders: number;
    total_empty_cylinders: number;
    total_valuation: number;
  };
  grouped_data: GroupedData[];
  as_of_date: string;
  pagination: PaginationInfo;
}
```

### 2. Deposit Analysis Report

**Endpoint:** `GET /reports/deposit-analysis`

**Purpose:** Track outstanding deposits per customer with aging analysis and threshold monitoring.

**Key Features:**
- Outstanding deposits from deposit_transactions table
- Aging buckets: 0-30, 31-60, 61-90, 90+ days overdue
- Customer deposit liability totals
- Flag customers exceeding deposit thresholds
- Integration with empty_return_credits for return tracking

**Parameters:**
```typescript
{
  start_date: string;
  end_date: string;
  customer_id?: string;         // Filter by specific customer
  aging_buckets?: boolean;      // Include aging breakdown
  include_zero_balances?: boolean;
  min_days_outstanding?: number;
  threshold_amount?: number;    // Flag customers above this amount
  as_of_date?: string;
  page?: number;
  limit?: number;
}
```

**Response:**
```typescript
{
  data: DepositAnalysisData[];
  summary: {
    total_outstanding_amount: number;
    customers_with_deposits: number;
    total_cylinders_on_deposit: number;
    customers_exceeding_threshold: number;
  };
  aging_breakdown: AgingBucket[];
  pagination: PaginationInfo;
}
```

### 3. Margin Analysis Report

**Endpoint:** `GET /reports/margin-analysis`

**Purpose:** Analyze revenue and profitability by order type (FULL-OUT vs FULL-XCH) with cost breakdowns.

**Key Features:**
- Revenue analysis from orders and order_lines tables
- Gas fill costs vs cylinder handling costs breakdown
- COGS separation for gas vs cylinder depreciation
- Profitability metrics by order flow type
- Support for grouping by order type, product, customer, or date

**Parameters:**
```typescript
{
  start_date: string;
  end_date: string;
  order_type?: 'FULL-OUT' | 'FULL-XCH' | 'all';
  product_id?: string;
  customer_id?: string;
  warehouse_id?: string;
  group_by?: 'order_type' | 'product' | 'customer' | 'date';
  include_costs_breakdown?: boolean;
  page?: number;
  limit?: number;
}
```

**Response:**
```typescript
{
  data: MarginAnalysisData[];
  summary: {
    total_revenue: number;
    total_cogs: number;
    total_gross_margin: number;
    average_margin_percentage: number;
  };
  grouped_data: GroupedMarginData[];
  costs_breakdown: CostsBreakdown;
  pagination: PaginationInfo;
}
```

### 4. Operational KPIs Report

**Endpoint:** `GET /reports/operational-kpis`

**Purpose:** Track key operational metrics for cylinder business performance.

**Key Features:**
- Empty cylinder return rates (returned/expected)
- Average days to return from empty_return_credits
- Deposit liability trends over time
- Lost cylinder tracking (expired credits)
- Aging analysis of pending returns

**Parameters:**
```typescript
{
  start_date: string;
  end_date: string;
  customer_id?: string;
  product_capacity?: number;
  include_trends?: boolean;
  kpi_types?: Array<'return_rates' | 'deposit_liability' | 'lost_cylinders' | 'aging'>;
  page?: number;
  limit?: number;
}
```

**Response:**
```typescript
{
  data: OperationalKPIData[];
  trends: TrendAnalysis;
  summary: {
    total_metrics: number;
    metrics_meeting_benchmarks: number;
  };
  period: DateRange;
}
```

### 5. Dashboard Summary

**Endpoint:** `GET /reports/dashboard-summary`

**Purpose:** Provide high-level summary metrics for dashboard display.

**Parameters:**
```typescript
{
  period_days?: number;  // Default: 30
}
```

**Response:**
```typescript
{
  stock_valuation: {
    total_value: number;
    total_cylinders: number;
  };
  deposit_liability: {
    total_outstanding: number;
  };
  operational_metrics: {
    return_rate_percentage: number;
  };
  financial_performance: {
    total_revenue: number;
    gross_margin_percentage: number;
  };
}
```

## Database Schema Dependencies

The reporting APIs utilize the following key tables:

### Core Tables
- `inventory_balance` - Current inventory quantities by warehouse and product
- `products` - Product details including standard costs and specifications
- `warehouses` - Warehouse information
- `orders` & `order_lines` - Order data for revenue and margin analysis
- `customers` - Customer information

### Deposit & Returns Tables
- `deposit_transactions` - All deposit charges, refunds, and adjustments
- `deposit_cylinder_inventory` - Current customer cylinder holdings
- `empty_return_credits` - Tracking of empty cylinder returns
- `cylinder_deposit_rates` - Historical deposit rate information

## Technical Implementation

### Authentication & Authorization
All endpoints require authentication via the `protectedProcedure` pattern using the existing tRPC setup.

### Error Handling
Comprehensive error handling with:
- Input validation using Zod schemas
- Database error logging
- Structured error responses
- Fallback values for missing data

### Performance Considerations
- Pagination support for large datasets
- Efficient SQL queries with proper joins
- Indexed date range filtering
- Optional summary calculations to reduce payload size

### Data Integrity
- Proper handling of voided transactions
- Consistent date range filtering
- Null value handling for optional relationships
- Currency standardization (KES default)

## Usage Examples

### Get Stock Valuation by Warehouse
```typescript
const stockReport = await trpc.reports.getStockValuation.query({
  group_by: 'warehouse',
  include_summary: true,
  page: 1,
  limit: 50
});
```

### Get Deposit Analysis with Aging
```typescript
const depositReport = await trpc.reports.getDepositAnalysis.query({
  start_date: '2024-01-01',
  end_date: '2024-12-31',
  aging_buckets: true,
  threshold_amount: 10000,
  page: 1,
  limit: 100
});
```

### Get Margin Analysis by Order Type
```typescript
const marginReport = await trpc.reports.getMarginAnalysis.query({
  start_date: '2024-01-01',
  end_date: '2024-12-31',
  group_by: 'order_type',
  include_costs_breakdown: true
});
```

### Get Operational KPIs
```typescript
const kpiReport = await trpc.reports.getOperationalKPIs.query({
  start_date: '2024-01-01',
  end_date: '2024-12-31',
  kpi_types: ['return_rates', 'deposit_liability', 'lost_cylinders'],
  include_trends: true
});
```

## Integration Points

The reports integrate seamlessly with existing API patterns:
- Follows same tRPC structure as other routers
- Uses existing Supabase connection and error handling
- Maintains consistent logging and authentication patterns
- Compatible with existing frontend data fetching hooks

## Future Enhancements

Potential areas for expansion:
1. **Real-time Updates** - WebSocket integration for live dashboard updates
2. **Export Functionality** - PDF/Excel export capabilities
3. **Scheduled Reports** - Automated report generation and email delivery
4. **Advanced Analytics** - Predictive analytics and forecasting
5. **Custom Dashboards** - User-configurable dashboard layouts
6. **Audit Trail** - Track report access and modifications

## Maintenance

Regular maintenance tasks:
- Monitor query performance and optimize as data grows
- Review and update cost calculation logic
- Validate report accuracy against manual calculations
- Update aging bucket thresholds based on business requirements
- Archive historical data as needed

The implementation provides a robust foundation for cylinder business reporting with room for future enhancements based on business needs.