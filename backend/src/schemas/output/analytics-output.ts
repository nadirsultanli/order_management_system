import { z } from 'zod';

// Base schemas
export const CustomerBaseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().nullable(),
});

export const ProductBaseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  sku: z.string(),
});

export const WarehouseBaseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
});

export const AddressBaseSchema = z.object({
  id: z.string().uuid(),
  line1: z.string(),
  city: z.string(),
  state: z.string(),
  country: z.string(),
});

// Dashboard stats response
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

// Revenue analytics response
export const RevenueAnalyticsResponseSchema = z.object({
  period: z.enum(['week', 'month', 'quarter', 'year']),
  breakdown_by: z.enum(['day', 'week', 'month']),
  totalRevenue: z.number(),
  totalOrders: z.number(),
  chartData: z.array(z.object({
    date: z.string(),
    revenue: z.number(),
    orders: z.number(),
  })),
});

// Order analytics response
export const OrderAnalyticsResponseSchema = z.object({
  period: z.enum(['week', 'month', 'quarter', 'year']),
  group_by: z.enum(['status', 'customer', 'product']).nullable(),
  totalOrders: z.number(),
  totalRevenue: z.number(),
  statusBreakdown: z.record(z.string(), z.number()),
  groupedData: z.array(z.any()).nullable(),
});

// Customer analytics response
export const CustomerAnalyticsResponseSchema = z.object({
  period: z.enum(['week', 'month', 'quarter', 'year']),
  breakdown_by: z.enum(['new', 'returning', 'top_spending']),
  totalNewCustomers: z.number().optional(),
  customersByDate: z.record(z.string(), z.array(CustomerBaseSchema)).optional(),
  customers: z.array(CustomerBaseSchema).optional(),
  totalReturningCustomers: z.number().optional(),
  returningCustomers: z.array(CustomerBaseSchema).optional(),
  topCustomers: z.array(z.object({
    customer_id: z.string().uuid(),
    customer_name: z.string(),
    customer_email: z.string(),
    total_spent: z.number(),
    order_count: z.number(),
  })).optional(),
});

// Inventory analytics response
export const InventoryAnalyticsResponseSchema = z.object({
  totalProducts: z.number(),
  totalStockValue: z.number(),
  lowStockCount: z.number(),
  outOfStockCount: z.number(),
  lowStockItems: z.array(z.object({
    qty_full: z.number(),
    qty_empty: z.number(),
    qty_reserved: z.number(),
    warehouse_id: z.string().uuid(),
    product: ProductBaseSchema,
    warehouse: WarehouseBaseSchema,
  })),
  outOfStockItems: z.array(z.object({
    qty_full: z.number(),
    qty_empty: z.number(),
    qty_reserved: z.number(),
    warehouse_id: z.string().uuid(),
    product: ProductBaseSchema,
    warehouse: WarehouseBaseSchema,
  })),
  warehouseBreakdown: z.array(z.object({
    warehouse_id: z.string().uuid(),
    warehouse_name: z.string(),
    total_products: z.number(),
    total_stock_value: z.number(),
    low_stock_count: z.number(),
    out_of_stock_count: z.number(),
  })),
});

// Comprehensive order analytics response
export const ComprehensiveOrderAnalyticsResponseSchema = z.object({
  summary: z.object({
    totalOrders: z.number(),
    totalRevenue: z.number(),
    avgOrderValue: z.number(),
    completionRate: z.number(),
  }),
  orders_by_status: z.array(z.object({
    status: z.string(),
    count: z.number(),
    percentage: z.number(),
  })),
  daily_trends: z.array(z.object({
    date: z.string(),
    orders: z.number(),
    revenue: z.number(),
  })),
  top_customers: z.array(z.object({
    customer_id: z.string().uuid(),
    customer_name: z.string(),
    order_count: z.number(),
    total_revenue: z.number(),
  })),
  top_products: z.array(z.object({
    product_id: z.string().uuid(),
    product_name: z.string(),
    quantity_sold: z.number(),
    revenue: z.number(),
  })),
  delivery_performance: z.object({
    on_time_deliveries: z.number(),
    late_deliveries: z.number(),
    avg_fulfillment_time: z.number(),
  }),
  regional_breakdown: z.array(z.object({
    region: z.string(),
    order_count: z.number(),
    revenue: z.number(),
  })),
});

// Order stats response
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