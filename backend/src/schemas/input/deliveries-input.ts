// schemas/input/deliveries-input.ts
import { z } from 'zod';

// Base item schemas
export const DeliveryItemSchema = z.object({
  product_id: z.string().uuid(),
  quantity_delivered: z.number().int().min(0),
  quantity_returned: z.number().int().min(0).optional(),
  unit_price: z.number().optional(),
});

export const PickupItemSchema = z.object({
  product_id: z.string().uuid(),
  quantity_picked_up: z.number().int().min(0),
  condition: z.enum(['good', 'damaged', 'needs_repair']).optional(),
});

// Process schemas
export const ProcessDeliverySchema = z.object({
  order_id: z.string().uuid().optional(),
  customer_id: z.string().uuid(),
  delivery_address_id: z.string().uuid().optional(),
  truck_id: z.string().uuid(),
  delivery_items: z.array(DeliveryItemSchema).min(1),
  driver_name: z.string().optional(),
  driver_notes: z.string().optional(),
  delivery_latitude: z.number().optional(),
  delivery_longitude: z.number().optional(),
});

export const ProcessPickupSchema = z.object({
  customer_id: z.string().uuid(),
  pickup_address_id: z.string().uuid().optional(),
  truck_id: z.string().uuid(),
  pickup_items: z.array(PickupItemSchema).min(1),
  driver_name: z.string().optional(),
  driver_notes: z.string().optional(),
  pickup_latitude: z.number().optional(),
  pickup_longitude: z.number().optional(),
});

// Union schema for process endpoint
export const ProcessSchema = z.object({
  type: z.enum(['delivery', 'pickup']),
  data: z.union([ProcessDeliverySchema, ProcessPickupSchema]),
});

// Complete schemas
export const CompleteDeliverySchema = z.object({
  delivery_id: z.string().uuid(),
  customer_signature: z.string().optional(),
  photo_proof: z.string().optional(),
  delivery_latitude: z.number().optional(),
  delivery_longitude: z.number().optional(),
});

export const CompletePickupSchema = z.object({
  pickup_id: z.string().uuid(),
  customer_signature: z.string().optional(),
  photo_proof: z.string().optional(),
  pickup_latitude: z.number().optional(),
  pickup_longitude: z.number().optional(),
});

// Union schema for complete endpoint
export const CompleteSchema = z.object({
  type: z.enum(['delivery', 'pickup']),
  data: z.union([CompleteDeliverySchema, CompletePickupSchema]),
});

// List filters
export const ListDeliveriesSchema = z.object({
  customer_id: z.string().uuid().optional(),
  truck_id: z.string().uuid().optional(),
  status: z.enum(['pending', 'in_transit', 'delivered', 'failed', 'cancelled']).optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
});

export const ListPickupsSchema = z.object({
  customer_id: z.string().uuid().optional(),
  truck_id: z.string().uuid().optional(),
  status: z.enum(['pending', 'in_transit', 'completed', 'failed', 'cancelled']).optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
});

// Customer balance schema
export const CustomerBalanceSchema = z.object({
  customer_id: z.string().uuid(),
  product_id: z.string().uuid().optional(),
});

// Get delivery/pickup details
export const DeliveryIdSchema = z.object({
  delivery_id: z.string().uuid(),
});

export const PickupIdSchema = z.object({
  pickup_id: z.string().uuid(),
});

// Customer transactions schema
export const CustomerTransactionsSchema = z.object({
  customer_id: z.string().uuid(),
  product_id: z.string().uuid().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
});

// Export types for TypeScript usage
export type DeliveryItem = z.infer<typeof DeliveryItemSchema>;
export type PickupItem = z.infer<typeof PickupItemSchema>;
export type ProcessDelivery = z.infer<typeof ProcessDeliverySchema>;
export type ProcessPickup = z.infer<typeof ProcessPickupSchema>;
export type Process = z.infer<typeof ProcessSchema>;
export type CompleteDelivery = z.infer<typeof CompleteDeliverySchema>;
export type CompletePickup = z.infer<typeof CompletePickupSchema>;
export type Complete = z.infer<typeof CompleteSchema>;
export type ListDeliveries = z.infer<typeof ListDeliveriesSchema>;
export type ListPickups = z.infer<typeof ListPickupsSchema>;
export type CustomerBalance = z.infer<typeof CustomerBalanceSchema>;
export type DeliveryId = z.infer<typeof DeliveryIdSchema>;
export type PickupId = z.infer<typeof PickupIdSchema>;
export type CustomerTransactions = z.infer<typeof CustomerTransactionsSchema>; 