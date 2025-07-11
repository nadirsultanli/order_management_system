// schemas/output/deliveries-output.ts
import { z } from 'zod';

// Base schemas for nested objects
export const CustomerInfoSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
});

export const AddressInfoSchema = z.object({
  id: z.string().uuid(),
  line1: z.string(),
  line2: z.string().nullable(),
  city: z.string(),
  state: z.string().nullable(),
  postal_code: z.string().nullable(),
});

export const TruckInfoSchema = z.object({
  id: z.string().uuid(),
  fleet_number: z.string(),
  driver_name: z.string().nullable(),
});

export const ProductInfoSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  sku: z.string(),
});

// Process result schemas
export const ProcessResultSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  delivery_id: z.string().uuid().optional(),
  pickup_id: z.string().uuid().optional(),
  delivery_number: z.string().optional(),
  pickup_number: z.string().optional(),
});

// Complete result schemas
export const CompleteResultSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
});

// Delivery item schema (for delivery details)
export const DeliveryItemOutputSchema = z.object({
  id: z.string().uuid(),
  delivery_id: z.string().uuid(),
  product_id: z.string().uuid(),
  quantity_delivered: z.number(),
  quantity_returned: z.number().nullable(),
  unit_price: z.number().nullable(),
  created_at: z.string(),
  updated_at: z.string().optional(),
  product: ProductInfoSchema,
});

// Pickup item schema (for pickup details)
export const PickupItemOutputSchema = z.object({
  id: z.string().uuid(),
  pickup_id: z.string().uuid(),
  product_id: z.string().uuid(),
  quantity_picked_up: z.number(),
  condition: z.enum(['good', 'damaged', 'needs_repair']).nullable(),
  created_at: z.string(),
  updated_at: z.string().optional(),
  product: ProductInfoSchema,
});

// Delivery details schema
export const DeliveryDetailsSchema = z.object({
  id: z.string().uuid(),
  delivery_number: z.string(),
  order_id: z.string().uuid().nullable(),
  customer_id: z.string().uuid(),
  delivery_address_id: z.string().uuid().nullable(),
  truck_id: z.string().uuid(),
  status: z.enum(['pending', 'in_transit', 'delivered', 'failed', 'cancelled']),
  delivery_date: z.string().nullable(),
  driver_name: z.string().nullable(),
  driver_notes: z.string().nullable(),
  customer_signature: z.string().nullable(),
  photo_proof: z.string().nullable(),
  delivery_latitude: z.number().nullable(),
  delivery_longitude: z.number().nullable(),
  created_at: z.string(),
  updated_at: z.string().optional(),
  customer: CustomerInfoSchema,
  delivery_address: AddressInfoSchema.nullable(),
  truck: TruckInfoSchema,
  items: z.array(DeliveryItemOutputSchema),
});

// Pickup details schema
export const PickupDetailsSchema = z.object({
  id: z.string().uuid(),
  pickup_number: z.string(),
  customer_id: z.string().uuid(),
  pickup_address_id: z.string().uuid().nullable(),
  truck_id: z.string().uuid(),
  status: z.enum(['pending', 'in_transit', 'completed', 'failed', 'cancelled']),
  pickup_date: z.string().nullable(),
  driver_name: z.string().nullable(),
  driver_notes: z.string().nullable(),
  customer_signature: z.string().nullable(),
  photo_proof: z.string().nullable(),
  pickup_latitude: z.number().nullable(),
  pickup_longitude: z.number().nullable(),
  created_at: z.string(),
  updated_at: z.string().optional(),
  customer: CustomerInfoSchema,
  pickup_address: AddressInfoSchema.nullable(),
  truck: TruckInfoSchema,
  items: z.array(PickupItemOutputSchema),
});

// List delivery item schema (simplified for list view)
export const DeliveryListItemSchema = z.object({
  id: z.string().uuid(),
  delivery_number: z.string(),
  customer_id: z.string().uuid(),
  truck_id: z.string().uuid(),
  status: z.enum(['pending', 'in_transit', 'delivered', 'failed', 'cancelled']),
  delivery_date: z.string().nullable(),
  driver_name: z.string().nullable(),
  created_at: z.string(),
  // Add any other fields that come from the view
});

// List pickup item schema (simplified for list view)
export const PickupListItemSchema = z.object({
  id: z.string().uuid(),
  pickup_number: z.string(),
  customer_id: z.string().uuid(),
  truck_id: z.string().uuid(),
  status: z.enum(['pending', 'in_transit', 'completed', 'failed', 'cancelled']),
  pickup_date: z.string().nullable(),
  driver_name: z.string().nullable(),
  created_at: z.string(),
  // Add any other fields that come from the view
});

// Paginated list schemas
export const DeliveriesListSchema = z.object({
  deliveries: z.array(DeliveryListItemSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  totalPages: z.number(),
});

export const PickupsListSchema = z.object({
  pickups: z.array(PickupListItemSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  totalPages: z.number(),
});

// Customer balance schema
export const CustomerBalanceItemSchema = z.object({
  product_id: z.string().uuid(),
  product_name: z.string(),
  product_sku: z.string(),
  balance: z.number(),
  delivered: z.number(),
  picked_up: z.number(),
  last_transaction_date: z.string().nullable(),
});

export const CustomerBalanceOutputSchema = z.array(CustomerBalanceItemSchema);

// Customer transaction schema
export const CustomerTransactionSchema = z.object({
  id: z.string().uuid(),
  customer_id: z.string().uuid(),
  product_id: z.string().uuid(),
  transaction_type: z.enum(['delivery', 'pickup']),
  quantity: z.number(),
  transaction_date: z.string(),
  delivery_id: z.string().uuid().nullable(),
  pickup_id: z.string().uuid().nullable(),
  notes: z.string().nullable(),
  created_at: z.string(),
  product: ProductInfoSchema,
});

export const CustomerTransactionsOutputSchema = z.object({
  transactions: z.array(CustomerTransactionSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  totalPages: z.number(),
});

// Export types for TypeScript usage
export type ProcessResult = z.infer<typeof ProcessResultSchema>;
export type CompleteResult = z.infer<typeof CompleteResultSchema>;
export type DeliveryDetails = z.infer<typeof DeliveryDetailsSchema>;
export type PickupDetails = z.infer<typeof PickupDetailsSchema>;
export type DeliveriesList = z.infer<typeof DeliveriesListSchema>;
export type PickupsList = z.infer<typeof PickupsListSchema>;
export type CustomerBalanceOutput = z.infer<typeof CustomerBalanceOutputSchema>;
export type CustomerTransactionsOutput = z.infer<typeof CustomerTransactionsOutputSchema>;
export type CustomerInfo = z.infer<typeof CustomerInfoSchema>;
export type AddressInfo = z.infer<typeof AddressInfoSchema>;
export type TruckInfo = z.infer<typeof TruckInfoSchema>;
export type ProductInfo = z.infer<typeof ProductInfoSchema>; 