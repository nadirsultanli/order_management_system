import { z } from 'zod';
import { createPaginatedResponseSchema } from './responses';

// Product in order line schema
const productInLineSchema = z.object({
  id: z.string(),
  sku: z.string(),
  name: z.string(),
  unit_of_measure: z.string(),
  capacity_kg: z.number().optional(),
  tare_weight_kg: z.number().optional(),
});

// Order line schema
export const orderLineSchema = z.object({
  id: z.string(),
  product_id: z.string(),
  quantity: z.number(),
  unit_price: z.number(),
  subtotal: z.number(),
  product: productInLineSchema.optional(),
});

// Customer schema
const customerSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  account_status: z.string().optional(),
  credit_terms_days: z.number().optional(),
});

// Address schema
const addressSchema = z.object({
  id: z.string(),
  line1: z.string(),
  line2: z.string().optional(),
  city: z.string(),
  state: z.string(),
  postal_code: z.string(),
  country: z.string(),
  instructions: z.string().optional(),
});

// Warehouse schema
const warehouseSchema = z.object({
  id: z.string(),
  name: z.string(),
  is_mobile: z.boolean().optional(),
});

// Payment schema
const paymentSchema = z.object({
  id: z.string(),
  amount: z.number(),
  payment_method: z.string(),
  payment_status: z.string(),
  payment_date: z.string().optional(),
  transaction_id: z.string().optional(),
  reference_number: z.string().optional(),
});

// Payment summary schema
const paymentSummarySchema = z.object({
  total_paid: z.number(),
  total_due: z.number(),
  balance: z.number(),
  status: z.string(),
  last_payment_date: z.string().optional(),
});

// Order schema
export const orderSchema = z.object({
  id: z.string(),
  order_number: z.string(),
  customer_id: z.string(),
  status: z.string(),
  order_date: z.string(),
  scheduled_date: z.string().optional(),
  delivery_date: z.string().optional(),
  delivery_method: z.enum(['pickup', 'delivery']),
  delivery_address_id: z.string().optional(),
  source_warehouse_id: z.string().optional(),
  subtotal: z.number(),
  tax_amount: z.number(),
  delivery_fee: z.number(),
  total_amount: z.number(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  notes: z.string().optional(),
  internal_notes: z.string().optional(),
  created_at: z.string(),
  updated_at: z.string(),
  customer: customerSchema.optional(),
  delivery_address: addressSchema.optional(),
  source_warehouse: warehouseSchema.optional(),
  order_lines: z.array(orderLineSchema).optional(),
  payments: z.array(paymentSchema).optional(),
  // Business logic fields
  is_high_value: z.boolean().optional(),
  days_since_order: z.number().optional(),
  estimated_delivery_window: z.any().optional(),
  risk_level: z.string().optional(),
  payment_summary: paymentSummarySchema.optional(),
  payment_balance: z.number().optional(),
  payment_status: z.string().optional(),
});

// Analytics schema
const orderAnalyticsSchema = z.object({
  total_value: z.number(),
  average_order_value: z.number(),
  order_count_by_status: z.record(z.number()),
  revenue_by_date: z.array(z.object({
    date: z.string(),
    revenue: z.number(),
  })),
  top_products: z.array(z.object({
    product_id: z.string(),
    product_name: z.string(),
    quantity_sold: z.number(),
    revenue: z.number(),
  })),
});

// List orders response schema
export const listOrdersResponseSchema = z.object({
  orders: z.array(orderSchema),
  totalCount: z.number(),
  totalPages: z.number(),
  currentPage: z.number(),
  analytics: orderAnalyticsSchema.optional(),
});

// Single order response schema
export const getOrderResponseSchema = orderSchema;

// Create order response schema
export const createOrderResponseSchema = orderSchema;

// Update order response schema
export const updateOrderResponseSchema = orderSchema;

// Delete order response schema
export const deleteOrderResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
});

// Status transition response schema
export const validateTransitionResponseSchema = z.object({
  valid: z.boolean(),
  currentStatus: z.string(),
  targetStatus: z.string(),
  errors: z.array(z.string()).optional(),
  warnings: z.array(z.string()).optional(),
  requiredFields: z.array(z.string()).optional(),
});

// Calculate totals response schema
export const calculateTotalsResponseSchema = z.object({
  subtotal: z.number(),
  taxAmount: z.number(),
  deliveryFee: z.number(),
  totalAmount: z.number(),
  taxRate: z.number(),
  breakdown: z.object({
    lines: z.array(z.object({
      product_id: z.string(),
      quantity: z.number(),
      unit_price: z.number(),
      subtotal: z.number(),
    })),
  }),
});

// Export types
export type Order = z.infer<typeof orderSchema>;
export type OrderLine = z.infer<typeof orderLineSchema>;
export type ListOrdersResponse = z.infer<typeof listOrdersResponseSchema>;
export type GetOrderResponse = z.infer<typeof getOrderResponseSchema>;
export type CreateOrderResponse = z.infer<typeof createOrderResponseSchema>;
export type UpdateOrderResponse = z.infer<typeof updateOrderResponseSchema>;
export type DeleteOrderResponse = z.infer<typeof deleteOrderResponseSchema>;
export type ValidateTransitionResponse = z.infer<typeof validateTransitionResponseSchema>;
export type CalculateTotalsResponse = z.infer<typeof calculateTotalsResponseSchema>;