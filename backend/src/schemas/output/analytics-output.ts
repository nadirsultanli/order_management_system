import { z } from 'zod';

// ==============================================================
// ANALYTICS OUTPUT SCHEMAS
// ==============================================================

// ============ Dashboard Stats ============

export const DashboardStatsResponseSchema = z.object({
  period: z.enum(['today', 'week', 'month', 'quarter', 'year']),
  totalOrders: z.number(),
  totalRevenue: z.number(),
  avgOrderValue: z.number(),
  newCustomers: z.number(),
  uniqueCustomers: z.number(),
  statusCounts: z.record(z.string(), z.number()),
  totalCustomers: z.number(),
  activeCustomers: z.number(),
  totalProducts: z.number(),
  activeProducts: z.number(),
  totalWarehouses: z.number(),
  totalCylinders: z.number(),
  lowStockProducts: z.number(),
});

// ============ Revenue Analytics ============

export const RevenueChartDataSchema = z.object({
  date: z.string(),
  revenue: z.number(),
  orders: z.number(),
});

export const RevenueAnalyticsResponseSchema = z.object({
  period: z.enum(['week', 'month', 'quarter', 'year']),
  breakdown_by: z.enum(['day', 'week', 'month']),
  totalRevenue: z.number(),
  totalOrders: z.number(),
  chartData: z.array(RevenueChartDataSchema),
});

// ============ Order Analytics ============

export const OrderAnalyticsResponseSchema = z.object({
  period: z.enum(['week', 'month', 'quarter', 'year']),
  group_by: z.enum(['status', 'customer', 'product']).optional(),
  totalOrders: z.number(),
  totalRevenue: z.number(),
  statusBreakdown: z.record(z.string(), z.number()),
  groupedData: z.array(z.any()).nullable(),
});

// ============ Customer Analytics ============

export const CustomerAnalyticsResponseSchema = z.object({
  period: z.enum(['week', 'month', 'quarter', 'year']),
  breakdown_by: z.enum(['new', 'returning', 'top_spending']),
  totalNewCustomers: z.number().optional(),
  customersByDate: z.record(z.string(), z.array(z.any())).optional(),
  customers: z.array(z.any()).optional(),
  totalReturningCustomers: z.number().optional(),
  returningCustomers: z.array(z.any()).optional(),
  topCustomers: z.array(z.any()).optional(),
});

// ============ Inventory Analytics ============

export const InventoryAnalyticsResponseSchema = z.object({
  totalProducts: z.number(),
  totalStockValue: z.number(),
  lowStockCount: z.number(),
  outOfStockCount: z.number(),
  lowStockItems: z.array(z.any()),
  outOfStockItems: z.array(z.any()),
  warehouseBreakdown: z.array(z.any()),
});

// ============ Comprehensive Order Analytics ============

export const OrderStatusBreakdownSchema = z.object({
  status: z.string(),
  count: z.number(),
  percentage: z.number(),
});

export const DailyTrendSchema = z.object({
  date: z.string(),
  orders: z.number(),
  revenue: z.number(),
});

export const TopCustomerSchema = z.object({
  customer_id: z.string(),
  customer_name: z.string(),
  order_count: z.number(),
  total_revenue: z.number(),
});

export const TopProductSchema = z.object({
  product_id: z.string(),
  product_name: z.string(),
  quantity_sold: z.number(),
  revenue: z.number(),
});

export const DeliveryPerformanceSchema = z.object({
  on_time_deliveries: z.number(),
  late_deliveries: z.number(),
  avg_fulfillment_time: z.number(),
});

export const RegionalBreakdownSchema = z.object({
  region: z.string(),
  order_count: z.number(),
  revenue: z.number(),
});

export const ComprehensiveOrderAnalyticsResponseSchema = z.object({
  summary: z.object({
    totalOrders: z.number(),
    totalRevenue: z.number(),
    avgOrderValue: z.number(),
    completionRate: z.number(),
  }),
  orders_by_status: z.array(OrderStatusBreakdownSchema),
  daily_trends: z.array(DailyTrendSchema),
  top_customers: z.array(TopCustomerSchema),
  top_products: z.array(TopProductSchema),
  delivery_performance: DeliveryPerformanceSchema,
  regional_breakdown: z.array(RegionalBreakdownSchema),
});

// ============ Order Stats ============

export const OrderStatsResponseSchema = z.object({
  total_orders: z.number(),
  draft_orders: z.number(),
  confirmed_orders: z.number(),
  scheduled_orders: z.number(),
  en_route_orders: z.number(),
  delivered_orders: z.number(),
  invoiced_orders: z.number(),
  cancelled_orders: z.number(),
  todays_deliveries: z.number(),
  overdue_orders: z.number(),
  total_revenue: z.number(),
  avg_order_value: z.number(),
  orders_this_month: z.number(),
  orders_last_month: z.number(),
  revenue_this_month: z.number(),
  revenue_last_month: z.number(),
}); 