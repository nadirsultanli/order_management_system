import { z } from 'zod';

// ==============================================================
// STOCK MOVEMENTS OUTPUT SCHEMAS
// ==============================================================

// ============ Base Entities ============

export const ProductBaseSchema = z.object({
  id: z.string(),
  sku: z.string(),
  name: z.string(),
  variant_name: z.string().nullable(),
  is_variant: z.boolean(),
});

export const ProductDetailSchema = z.object({
  id: z.string(),
  sku: z.string(),
  name: z.string(),
  variant_name: z.string().nullable(),
  is_variant: z.boolean(),
  capacity_kg: z.number().nullable(),
  tare_weight_kg: z.number().nullable(),
});

export const WarehouseBaseSchema = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string(),
});

export const TruckBaseSchema = z.object({
  id: z.string(),
  fleet_number: z.string(),
  license_plate: z.string(),
});

export const OrderBaseSchema = z.object({
  id: z.string(),
  order_date: z.string(),
  status: z.string(),
});

export const OrderDetailSchema = z.object({
  id: z.string(),
  order_date: z.string(),
  status: z.string(),
  order_type: z.string(),
});

export const StockMovementSchema = z.object({
  id: z.string(),
  product_id: z.string(),
  warehouse_id: z.string().nullable(),
  truck_id: z.string().nullable(),
  order_id: z.string().nullable(),
  movement_type: z.enum(['delivery', 'pickup', 'refill', 'exchange', 'transfer', 'adjustment']),
  qty_full_in: z.number(),
  qty_full_out: z.number(),
  qty_empty_in: z.number(),
  qty_empty_out: z.number(),
  movement_date: z.string(),
  reference_number: z.string().nullable(),
  notes: z.string().nullable(),
  created_by_user_id: z.string(),
  created_at: z.string(),
  product: ProductBaseSchema.nullable(),
  warehouse: WarehouseBaseSchema.nullable(),
  truck: TruckBaseSchema.nullable(),
  order: OrderBaseSchema.nullable(),
});

export const StockMovementDetailSchema = z.object({
  id: z.string(),
  product_id: z.string(),
  warehouse_id: z.string().nullable(),
  truck_id: z.string().nullable(),
  order_id: z.string().nullable(),
  movement_type: z.enum(['delivery', 'pickup', 'refill', 'exchange', 'transfer', 'adjustment']),
  qty_full_in: z.number(),
  qty_full_out: z.number(),
  qty_empty_in: z.number(),
  qty_empty_out: z.number(),
  movement_date: z.string(),
  reference_number: z.string().nullable(),
  notes: z.string().nullable(),
  created_by_user_id: z.string(),
  created_at: z.string(),
  product: ProductDetailSchema.nullable(),
  warehouse: WarehouseBaseSchema.nullable(),
  truck: TruckBaseSchema.nullable(),
  order: OrderDetailSchema.nullable(),
});

// ============ Core Operations Responses ============

export const StockMovementListResponseSchema = z.object({
  movements: z.array(StockMovementSchema),
  totalCount: z.number(),
  totalPages: z.number(),
  currentPage: z.number(),
});

export const StockMovementDetailResponseSchema = StockMovementDetailSchema;

export const CreateStockMovementResponseSchema = z.object({
  id: z.string(),
  product_id: z.string(),
  warehouse_id: z.string().nullable(),
  truck_id: z.string().nullable(),
  order_id: z.string().nullable(),
  movement_type: z.enum(['delivery', 'pickup', 'refill', 'exchange', 'transfer', 'adjustment']),
  qty_full_in: z.number(),
  qty_full_out: z.number(),
  qty_empty_in: z.number(),
  qty_empty_out: z.number(),
  movement_date: z.string(),
  reference_number: z.string().nullable(),
  notes: z.string().nullable(),
  created_by_user_id: z.string(),
  created_at: z.string(),
});

export const BulkStockMovementResponseSchema = z.array(CreateStockMovementResponseSchema);

export const RefillOrderProcessResponseSchema = z.object({
  success: z.boolean(),
});

// ============ Summary and Analytics ============

export const MovementTypeSummarySchema = z.object({
  count: z.number(),
  qty_full_in: z.number(),
  qty_full_out: z.number(),
  qty_empty_in: z.number(),
  qty_empty_out: z.number(),
});

export const ProductSummarySchema = z.object({
  product: ProductBaseSchema,
  count: z.number(),
  qty_full_in: z.number(),
  qty_full_out: z.number(),
  qty_empty_in: z.number(),
  qty_empty_out: z.number(),
});

export const StockMovementSummaryResponseSchema = z.object({
  total_movements: z.number(),
  total_full_in: z.number(),
  total_full_out: z.number(),
  total_empty_in: z.number(),
  total_empty_out: z.number(),
  by_movement_type: z.record(z.string(), MovementTypeSummarySchema),
  by_product: z.record(z.string(), ProductSummarySchema),
}); 