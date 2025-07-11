import { z } from 'zod';

// ==============================================================
// INVENTORY OUTPUT SCHEMAS
// ==============================================================

// ============ Base Entities ============

export const WarehouseBaseSchema = z.object({
  id: z.string(),
  name: z.string(),
});

export const ProductBaseSchema = z.object({
  id: z.string(),
  sku: z.string(),
  name: z.string(),
  unit_of_measure: z.string(),
  status: z.string().optional(),
  capacity_kg: z.number().optional(),
});

export const InventoryBalanceSchema = z.object({
  id: z.string(),
  warehouse_id: z.string(),
  product_id: z.string(),
  qty_full: z.number(),
  qty_empty: z.number(),
  qty_reserved: z.number(),
  updated_at: z.string(),
  warehouse: WarehouseBaseSchema,
  product: ProductBaseSchema,
});

// ============ Enhanced Inventory Item Schema ============

export const EnhancedInventoryItemSchema = z.object({
  id: z.string(),
  warehouse_id: z.string(),
  product_id: z.string(),
  qty_full: z.number(),
  qty_empty: z.number(),
  qty_reserved: z.number(),
  updated_at: z.string(),
  warehouse: WarehouseBaseSchema,
  product: ProductBaseSchema,
  // Calculated fields
  qty_available: z.number(),
  stock_level: z.enum(['critical', 'low', 'normal', 'overstocked']),
  stock_level_ratio: z.number(),
  days_of_stock: z.number(),
  is_critical: z.boolean(),
  is_low: z.boolean(),
  is_out_of_stock: z.boolean(),
  is_overstocked: z.boolean(),
  turnover_rate: z.number(),
  storage_cost: z.number(),
});

// ============ Core Inventory Operations ============

export const InventorySummarySchema = z.object({
  total_cylinders: z.number(),
  total_full: z.number(),
  total_empty: z.number(),
  total_available: z.number(),
  low_stock_items: z.number(),
});

export const InventoryListResponseSchema = z.object({
  inventory: z.array(EnhancedInventoryItemSchema),
  totalCount: z.number(),
  summary: InventorySummarySchema,
});

export const InventoryByWarehouseResponseSchema = z.array(InventoryBalanceSchema);

export const InventoryByProductResponseSchema = z.array(z.object({
  id: z.string(),
  warehouse_id: z.string(),
  product_id: z.string(),
  qty_full: z.number(),
  qty_empty: z.number(),
  qty_reserved: z.number(),
  updated_at: z.string(),
  warehouse: WarehouseBaseSchema,
}));

export const InventoryStatsResponseSchema = z.object({
  total_cylinders: z.number(),
  total_full: z.number(),
  total_empty: z.number(),
  total_available: z.number(),
  low_stock_products: z.number(),
});

export const CreateInventoryResponseSchema = InventoryBalanceSchema;

// ============ Stock Adjustment Operations ============

export const StockAdjustmentResponseSchema = z.object({
  id: z.string(),
  warehouse_id: z.string(),
  product_id: z.string(),
  qty_full: z.number(),
  qty_empty: z.number(),
  qty_reserved: z.number(),
  updated_at: z.string(),
  warehouse: WarehouseBaseSchema,
  product: ProductBaseSchema,
});

export const ValidateAdjustmentResponseSchema = z.object({
  valid: z.boolean(),
  errors: z.array(z.string()),
  warnings: z.array(z.string()),
  current_stock: z.object({
    qty_full: z.number(),
    qty_empty: z.number(),
    qty_reserved: z.number(),
  }),
  resulting_stock: z.object({
    qty_full: z.number(),
    qty_empty: z.number(),
    qty_reserved: z.number(),
  }),
});

// Legacy alias for backward compatibility
export const AdjustmentValidationResponseSchema = ValidateAdjustmentResponseSchema;

// ============ Stock Transfer Operations ============

export const StockTransferResponseSchema = z.object({
  success: z.boolean(),
  transfer_result: z.object({
    success: z.boolean(),
    message: z.string(),
    transferred_full: z.number(),
    transferred_empty: z.number(),
    from_warehouse_id: z.string(),
    to_warehouse_id: z.string(),
    product_id: z.string(),
    timestamp: z.string(),
  }),
  transfer: z.object({
    from_warehouse_id: z.string(),
    to_warehouse_id: z.string(),
    product_id: z.string(),
    qty_full: z.number(),
    qty_empty: z.number(),
    notes: z.string().optional(),
    timestamp: z.string(),
  }),
  source_inventory: InventoryBalanceSchema,
  destination_inventory: InventoryBalanceSchema,
});

// ============ Reservation Operations ============

export const ReservationItemSchema = z.object({
  inventory_id: z.string(),
  warehouse_id: z.string(),
  product_id: z.string(),
  quantity_reserved: z.number(),
});

export const ReservationResponseSchema = z.object({
  reservations: z.array(ReservationItemSchema),
});

// ============ Movement Tracking ============

export const MovementsResponseSchema = z.array(z.unknown()); // Empty array for now

// ============ Advanced Analytics ============

export const StockAnalysisSchema = z.object({
  current_stock: z.number(),
  projected_stock: z.number(),
  projected_days_remaining: z.number(),
  urgency_level: z.enum(['critical', 'low', 'warning', 'ok']),
  suggested_reorder_quantity: z.number(),
  suggested_reorder_cost: z.number(),
  stockout_risk_cost: z.number(),
});

export const LowStockItemSchema = z.object({
  id: z.string(),
  warehouse_id: z.string(),
  product_id: z.string(),
  qty_full: z.number(),
  qty_empty: z.number(),
  qty_reserved: z.number(),
  updated_at: z.string(),
  warehouse: WarehouseBaseSchema,
  product: ProductBaseSchema,
}).merge(StockAnalysisSchema);

export const LowStockSummarySchema = z.object({
  total_items: z.number(),
  critical_items: z.number(),
  total_reorder_cost: z.number(),
  total_potential_stockout_cost: z.number(),
});

export const LowStockResponseSchema = z.object({
  low_stock_items: z.array(LowStockItemSchema),
  summary: LowStockSummarySchema,
});

export const AllocationPlanSchema = z.object({
  warehouse_id: z.string(),
  warehouse_name: z.string().optional(),
  quantity: z.number(),
  estimated_availability_date: z.string(),
});

export const ProductAvailabilitySchema = z.object({
  can_fulfill: z.boolean(),
  total_available: z.number(),
  partial_quantity: z.number(),
  allocation_plan: z.array(AllocationPlanSchema),
  estimated_fulfillment_date: z.string(),
  alternative_products: z.array(z.unknown()),
});

export const AvailabilityResultSchema = z.object({
  product_id: z.string(),
  quantity_requested: z.number(),
}).merge(ProductAvailabilitySchema);

export const OverallFulfillmentSchema = z.object({
  can_fulfill_all: z.boolean(),
  partial_fulfillment_possible: z.boolean(),
  recommended_action: z.string(),
});

export const AvailabilityResponseSchema = z.object({
  availability_results: z.array(AvailabilityResultSchema),
  overall_fulfillment: OverallFulfillmentSchema,
}); 