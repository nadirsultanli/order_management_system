import { z } from 'zod';

// ==============================================================
// STOCK MOVEMENTS INPUT SCHEMAS
// ==============================================================

// ============ Base Enums ============

export const MovementTypeEnum = z.enum(['delivery', 'pickup', 'refill', 'exchange', 'transfer', 'adjustment']);

// ============ Core Stock Movement Operations ============

export const StockMovementFiltersSchema = z.object({
  search: z.string().optional(),
  product_id: z.string().uuid().optional(),
  warehouse_id: z.string().uuid().optional(),
  truck_id: z.string().uuid().optional(),
  order_id: z.string().uuid().optional(),
  movement_type: MovementTypeEnum.optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(50),
  sort_by: z.enum(['movement_date', 'created_at', 'movement_type']).default('movement_date'),
  sort_order: z.enum(['asc', 'desc']).default('desc'),
});

export const GetStockMovementByIdSchema = z.object({
  id: z.string().uuid(),
});

export const CreateStockMovementSchema = z.object({
  product_id: z.string().uuid(),
  warehouse_id: z.string().uuid().optional(),
  truck_id: z.string().uuid().optional(),
  order_id: z.string().uuid().optional(),
  movement_type: MovementTypeEnum,
  qty_full_in: z.number().int().min(0).default(0),
  qty_full_out: z.number().int().min(0).default(0),
  qty_empty_in: z.number().int().min(0).default(0),
  qty_empty_out: z.number().int().min(0).default(0),
  movement_date: z.string(),
  reference_number: z.string().optional(),
  notes: z.string().optional(),
});

// ============ Bulk Operations ============

export const BulkMovementSchema = z.object({
  movements: z.array(CreateStockMovementSchema).min(1),
});

// ============ Refill Order Processing ============

export const RefillOrderProcessSchema = z.object({
  order_id: z.string().uuid(),
  warehouse_id: z.string().uuid().optional(),
});

// ============ Summary and Analytics ============

export const StockMovementSummarySchema = z.object({
  date_from: z.string(),
  date_to: z.string(),
  product_id: z.string().uuid().optional(),
  warehouse_id: z.string().uuid().optional(),
  truck_id: z.string().uuid().optional(),
}); 