import { z } from 'zod';

// ==============================================================
// INVENTORY INPUT SCHEMAS
// ==============================================================

// ============ Core Inventory Operations ============

export const InventoryFiltersSchema = z.object({
  warehouse_id: z.string().uuid().optional(),
  product_id: z.string().uuid().optional(),
  search: z.string().optional(),
  low_stock_only: z.boolean().default(false),
  out_of_stock_only: z.boolean().default(false),
  overstocked_only: z.boolean().default(false),
  critical_stock_only: z.boolean().default(false),
  product_status: z.enum(['active', 'obsolete']).optional(),
  stock_threshold_days: z.number().min(1).max(365).default(30),
  min_qty_available: z.number().min(0).optional(),
  max_qty_available: z.number().min(0).optional(),
  include_reserved: z.boolean().default(true),
  sort_by: z.enum(['updated_at', 'qty_available', 'product_name', 'warehouse_name', 'stock_level_ratio']).default('updated_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc'),
});

export const GetByWarehouseSchema = z.object({
  warehouse_id: z.string().uuid(),
});

export const GetByProductSchema = z.object({
  product_id: z.string().uuid(),
});

export const GetStatsSchema = z.object({
  warehouse_id: z.string().uuid().optional(),
});

export const CreateInventoryBalanceSchema = z.object({
  warehouse_id: z.string().uuid(),
  product_id: z.string().uuid(),
  qty_full: z.number().min(0).default(0),
  qty_empty: z.number().min(0).default(0),
  qty_reserved: z.number().min(0).default(0),
});

// ============ Stock Adjustment Operations ============

export const StockAdjustmentSchema = z.object({
  inventory_id: z.string().uuid(),
  adjustment_type: z.enum(['received_full', 'received_empty', 'physical_count', 'damage_loss', 'other']),
  qty_full_change: z.number(),
  qty_empty_change: z.number(),
  reason: z.string().min(1, 'Reason is required'),
});

export const ValidateAdjustmentSchema = z.object({
  inventory_id: z.string().uuid(),
  qty_full_change: z.number(),
  qty_empty_change: z.number(),
  adjustment_type: z.enum(['received_full', 'received_empty', 'physical_count', 'damage_loss', 'other']),
});

// ============ Stock Transfer Operations ============

export const StockTransferSchema = z.object({
  from_warehouse_id: z.string().uuid(),
  to_warehouse_id: z.string().uuid(),
  product_id: z.string().uuid(),
  qty_full: z.number().min(0),
  qty_empty: z.number().min(0),
  notes: z.string().optional(),
});

// ============ Reservation Operations ============

export const ReservationSchema = z.object({
  order_id: z.string().uuid().optional(),
  reservations: z.array(z.object({
    product_id: z.string().uuid(),
    quantity: z.number().positive(),
    warehouse_id: z.string().uuid().optional(),
  })),
});

// ============ Movement Tracking ============

export const GetMovementsSchema = z.object({
  limit: z.number().min(1).max(100).default(10),
  warehouse_id: z.string().uuid().optional(),
  product_id: z.string().uuid().optional(),
});

// ============ Advanced Analytics ============

export const GetLowStockSchema = z.object({
  warehouse_id: z.string().uuid().optional(),
  urgency_level: z.enum(['critical', 'low', 'warning']).default('low'),
  days_ahead: z.number().min(1).max(90).default(14),
  include_seasonal: z.boolean().default(true),
});

export const CheckAvailabilitySchema = z.object({
  products: z.array(z.object({
    product_id: z.string().uuid(),
    quantity_requested: z.number().positive(),
    warehouse_preference: z.string().uuid().optional(),
  })),
  delivery_date: z.string().optional(),
  priority: z.enum(['normal', 'high', 'urgent']).default('normal'),
});

// ============ Warehouse Operations Schemas (Document Steps 3 & 4) ============

// Receipt Management (Document 4.1 - Receiving Stock)
export const CreateReceiptSchema = z.object({
  warehouse_id: z.string().uuid(),
  supplier_dn_number: z.string().optional(),
  truck_registration: z.string().optional(),
  driver_name: z.string().optional(),
  receipt_date: z.string().optional(), // ISO date string
  notes: z.string().optional(),
  receipt_lines: z.array(z.object({
    product_id: z.string().uuid(),
    qty_expected: z.number().min(0),
    qty_received_good: z.number().min(0),
    qty_received_damaged: z.number().min(0),
    condition_flag: z.enum(['good', 'damaged']),
    notes: z.string().optional(),
  })).min(1),
});

// Enhanced Transfer Management (Document 4.2 - Warehouse-to-Warehouse Transfer)
export const InitiateTransferSchema = z.object({
  source_warehouse_id: z.string().uuid(),
  destination_warehouse_id: z.string().uuid(),
  product_id: z.string().uuid(),
  qty_full: z.number().min(0),
  qty_empty: z.number().min(0),
  reference_number: z.string().optional(),
});

export const CompleteTransferSchema = z.object({
  transfer_id: z.string().uuid(),
  product_id: z.string().uuid(),
  qty_full_received: z.number().min(0),
  qty_empty_received: z.number().min(0),
});

// Cycle Count Management (Document 4.3 - Periodic Cycle Counts)
export const CreateCycleCountSchema = z.object({
  warehouse_id: z.string().uuid(),
  count_date: z.string().optional(), // ISO date string
  notes: z.string().optional(),
  cycle_count_lines: z.array(z.object({
    product_id: z.string().uuid(),
    system_qty_full: z.number().min(0),
    system_qty_empty: z.number().min(0),
    counted_qty_full: z.number().min(0),
    counted_qty_empty: z.number().min(0),
    notes: z.string().optional(),
  })).min(1),
});