export interface Order {
  id: string;
  customer_id: string;
  delivery_address_id: string;
  order_date: string;
  scheduled_date?: string;
  status: 'draft' | 'confirmed' | 'scheduled' | 'en_route' | 'delivered' | 'invoiced' | 'cancelled' | 'completed_no_sale';
  total_amount?: number;
  tax_percent?: number;
  tax_amount?: number;
  notes?: string;
  created_at: string;
  updated_at: string;
  // Order type fields
  order_type: 'delivery' | 'visit';

  service_type: 'standard' | 'express' | 'scheduled';
  exchange_empty_qty: number; // for refill/exchange orders
  requires_pickup: boolean; // if empty pickup needed
  // Warehouse/fulfillment fields
  source_warehouse_id?: string; // Warehouse to fulfill order from
  created_by_user_id?: string;
  assigned_to_user_id?: string;
  customer?: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    account_status: 'active' | 'credit_hold' | 'closed';
    credit_terms_days: number;
  };
  delivery_address?: {
    id: string;
    line1: string;
    line2?: string;
    city: string;
    state?: string;
    postal_code?: string;
    country: string;
    instructions?: string;
  };
  source_warehouse?: {
    id: string;
    name: string;
    city?: string;
    state?: string;
  };
  order_lines?: OrderLine[];
  status_history?: OrderStatusHistory[];
}

export interface OrderLine {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  subtotal?: number;
  // Tax-related fields (fixed at order creation time)
  price_excluding_tax?: number;
  tax_amount?: number;
  price_including_tax?: number;
  tax_rate?: number;
  product?: {
    id: string;
    sku: string;
    name: string;
    unit_of_measure: string;
    tax_category?: string;
    tax_rate?: number;
  };
}

export interface OrderStatusHistory {
  id: string;
  order_id: string;
  status: OrderStatus;
  changed_by: string;
  changed_at: string;
  notes?: string;
  user_name?: string;
}

export interface CreateOrderData {
  customer_id: string;
  delivery_address_id: string;
  order_date: string;
  scheduled_date?: string;
  status: 'draft' | 'confirmed' | 'scheduled' | 'en_route' | 'delivered' | 'invoiced' | 'cancelled' | 'completed_no_sale';
  notes?: string;
  tax_percent?: number;
  tax_amount?: number;
  total_amount?: number;
  // Order type fields
  order_type: 'delivery' | 'visit';

  service_type: 'standard' | 'express' | 'scheduled';
  exchange_empty_qty: number;
  requires_pickup: boolean;
  // Warehouse/fulfillment fields
  source_warehouse_id?: string; // Warehouse to fulfill order from
  created_by_user_id?: string;
  assigned_to_user_id?: string;
  // Order lines for creating order with products in one request
  order_lines?: CreateOrderLineData[];
}

export interface UpdateOrderData extends Partial<CreateOrderData> {
  id: string;
}

export interface CreateOrderLineData {
  order_id?: string; // Optional when creating with order
  product_id: string;
  quantity: number;
  unit_price: number;
  // Tax-related fields (fixed at order creation time)
  price_excluding_tax?: number;
  tax_amount?: number;
  price_including_tax?: number;
  tax_rate?: number;
}

export interface UpdateOrderLineData extends Partial<CreateOrderLineData> {
  id: string;
}

export interface OrderFilters {
  search?: string;
  status?: string;
  customer_id?: string;
  order_date_from?: string;
  order_date_to?: string;
  scheduled_date_from?: string;
  scheduled_date_to?: string;
  amount_min?: number;
  amount_max?: number;
  delivery_area?: string;
  page?: number;
  limit?: number;
}

export interface OrderStats {
  total_orders: number;
  draft_orders: number;
  confirmed_orders: number;
  scheduled_orders: number;
  en_route_orders: number;
  delivered_orders: number;
  invoiced_orders: number;
  cancelled_orders: number;
  todays_deliveries: number;
  overdue_orders: number;
  total_revenue: number;
  avg_order_value: number;
  orders_this_month: number;
  orders_last_month: number;
  revenue_this_month: number;
  revenue_last_month: number;
}

export interface OrderStatusChange {
  order_id: string;
  new_status: string;
  notes?: string;
  scheduled_date?: string;
  delivery_notes?: string;
}

export interface StockAvailability {
  product_id: string;
  available_quantity: number;
  warehouse_id?: string;
  warehouse_name?: string;
}

export interface BulkOrderOperation {
  order_ids: string[];
  operation: 'status_change' | 'schedule' | 'export' | 'print';
  new_status?: string;
  scheduled_date?: string;
  notes?: string;
}

export interface OrderAnalytics {
  orders_by_status: { status: string; count: number; percentage: number }[];
  daily_trends: { date: string; orders: number; revenue: number }[];
  top_customers: { customer_id: string; customer_name: string; order_count: number; total_revenue: number }[];
  top_products: { product_id: string; product_name: string; quantity_sold: number; revenue: number }[];
  delivery_performance: {
    on_time_deliveries: number;
    late_deliveries: number;
    avg_fulfillment_time: number;
  };
  regional_breakdown: { region: string; order_count: number; revenue: number }[];
}

export interface DeliverySchedule {
  date: string;
  orders: Order[];
  total_orders: number;
  estimated_duration: number;
}

export interface SavedFilter {
  id: string;
  name: string;
  filters: OrderFilters;
  is_default: boolean;
  created_by: string;
}

export type OrderStatus = 'draft' | 'confirmed' | 'scheduled' | 'en_route' | 'delivered' | 'invoiced' | 'cancelled' | 'completed_no_sale';

export interface OrderWorkflowStep {
  status: OrderStatus;
  label: string;
  description: string;
  color: string;
  icon: string;
  allowedTransitions: OrderStatus[];
  estimatedDuration?: number; // in hours
}

export interface OrderValidationRule {
  rule: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface CustomerOrderSummary {
  total_orders: number;
  total_spent: number;
  avg_order_value: number;
  last_order_date?: string;
  favorite_products: { product_name: string; quantity: number }[];
  order_frequency: number; // orders per month
}