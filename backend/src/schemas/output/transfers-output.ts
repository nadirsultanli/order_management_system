import { z } from 'zod';

// ==============================================================
// TRANSFERS OUTPUT SCHEMAS
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
});

export const ProductDetailSchema = z.object({
  id: z.string(),
  sku: z.string(),
  name: z.string(),
  unit_of_measure: z.string(),
  capacity_kg: z.number().nullable(),
  tare_weight_kg: z.number().nullable(),
  is_variant: z.boolean(),
  variant_name: z.string().nullable(),
  variant_type: z.string().nullable(),
});

export const TransferLineSchema = z.object({
  id: z.string(),
  product_id: z.string(),
  quantity_full: z.number(),
  quantity_empty: z.number(),
  product: ProductBaseSchema.optional(),
});

export const TransferLineDetailSchema = z.object({
  id: z.string(),
  product_id: z.string(),
  quantity_full: z.number(),
  quantity_empty: z.number(),
  product: ProductDetailSchema.optional(),
});

// ============ Core Transfer Operations ============

export const TransferSchema = z.object({
  id: z.string(),
  source_warehouse_id: z.string(),
  destination_warehouse_id: z.string(),
  transfer_date: z.string(),
  scheduled_date: z.string().nullable(),
  status: z.string(),
  transfer_type: z.string(),
  priority: z.string(),
  transfer_reference: z.string().nullable(),
  reason: z.string().nullable(),
  notes: z.string().nullable(),
  instructions: z.string().nullable(),
  total_items: z.number(),
  total_quantity: z.number(),
  total_weight_kg: z.number().nullable(),
  total_cost: z.number().nullable(),
  created_by_user_id: z.string(),
  qty_tagged: z.number(),
  qty_untagged: z.number(),
  variance_flag: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
  completed_date: z.string().nullable(),
  processed_by_user_id: z.string().nullable(),
  approved_at: z.string().nullable(),
  approved_by_user_id: z.string().nullable(),
  source_warehouse: WarehouseBaseSchema.optional(),
  destination_warehouse: WarehouseBaseSchema.optional(),
  items: z.array(TransferLineSchema).optional(),
});

export const TransferListResponseSchema = z.object({
  transfers: z.array(TransferSchema),
  totalCount: z.number(),
  totalPages: z.number(),
  currentPage: z.number(),
});

export const TransferDetailResponseSchema = TransferSchema.extend({
  items: z.array(TransferLineDetailSchema).optional(),
});

// ============ Transfer Validation ============

export const TransferValidationResponseSchema = z.object({
  is_valid: z.boolean(),
  errors: z.array(z.string()),
  warnings: z.array(z.string()),
  blocked_items: z.array(z.string()),
  total_weight_kg: z.number(),
  estimated_cost: z.number().optional(),
  source_stock: z.object({
    product_id: z.string(),
    available_qty: z.number(),
    reserved_qty: z.number(),
  }).optional(),
});

export const CreateTransferResponseSchema = TransferSchema;

export const UpdateTransferStatusResponseSchema = TransferSchema;

// ============ Transfer Management ============

export const WarehouseStockInfoSchema = z.object({
  warehouse_id: z.string(),
  warehouse_name: z.string(),
  product_id: z.string(),
  product_sku: z.string(),
  product_name: z.string(),
  variant_name: z.string().nullable(),
  qty_available: z.number(),
  qty_reserved: z.number(),
  qty_on_order: z.number(),
  qty_full: z.number(),
  qty_empty: z.number(),
  locations: z.array(z.string()),
  last_updated: z.string(),
  reorder_level: z.number(),
  max_capacity: z.number(),
});

export const WarehouseStockListResponseSchema = z.array(WarehouseStockInfoSchema);

export const CostAnalysisResponseSchema = z.object({
  transfer_id: z.string(),
  total_weight_kg: z.number(),
  total_volume_m3: z.number(),
  estimated_costs: z.object({
    handling_cost: z.number(),
    transport_cost: z.number(),
    total_cost: z.number(),
  }),
  efficiency_metrics: z.object({
    cost_per_kg: z.number(),
    cost_per_item: z.number(),
  }),
  estimated_duration: z.object({
    preparation_hours: z.number(),
    transport_hours: z.number(),
    total_hours: z.number(),
  }),
});

export const ProductSearchSchema = z.object({
  id: z.string(),
  sku: z.string(),
  name: z.string(),
  status: z.string(),
  variant_name: z.string().nullable(),
  variant_type: z.string().nullable(),
  capacity_kg: z.number().nullable(),
  tare_weight_kg: z.number().nullable(),
  is_variant: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const ProductSearchResponseSchema = z.array(ProductSearchSchema);

// ============ Advanced Transfer Operations ============

export const MultiSkuTransferItemSchema = z.object({
  product_id: z.string(),
  product_sku: z.string(),
  product_name: z.string(),
  variant_name: z.string().optional(),
  variant_type: z.string().optional(),
  quantity_to_transfer: z.number(),
  available_stock: z.number().optional(),
  reserved_stock: z.number().optional(),
  unit_weight_kg: z.number().optional(),
  total_weight_kg: z.number().optional(),
  unit_cost: z.number().optional(),
  total_cost: z.number().optional(),
  source_location: z.string().optional(),
  batch_number: z.string().optional(),
  expiry_date: z.string().optional(),
  is_valid: z.boolean(),
  validation_errors: z.array(z.string()),
  validation_warnings: z.array(z.string()),
});

export const MultiSkuValidationResponseSchema = z.object({
  is_valid: z.boolean(),
  errors: z.array(z.string()),
  warnings: z.array(z.string()),
  blocked_items: z.array(z.string()),
  total_weight_kg: z.number(),
  estimated_cost: z.number().optional(),
});

export const TransferDetailsResponseSchema = z.object({
  items: z.array(MultiSkuTransferItemSchema),
  summary: z.object({
    total_products: z.number(),
    total_quantity: z.number(),
    total_weight_kg: z.number(),
    total_cost: z.number().optional(),
    unique_variants: z.number(),
    validation_summary: z.object({
      valid_items: z.number(),
      invalid_items: z.number(),
      items_with_warnings: z.number(),
    }),
  }),
});

export const CapacityValidationResponseSchema = z.object({
  can_accommodate: z.boolean(),
  warnings: z.array(z.string()),
});

export const InventoryAvailabilityResponseSchema = z.object({
  is_available: z.boolean(),
  errors: z.array(z.string()),
  warnings: z.array(z.string()),
});

export const ConflictCheckResponseSchema = z.object({
  has_conflicts: z.boolean(),
  conflicts: z.array(z.string()),
});

export const DurationEstimateResponseSchema = z.object({
  preparation_hours: z.number(),
  transport_hours: z.number(),
  total_hours: z.number(),
});

export const FormattedValidationErrorsResponseSchema = z.array(z.object({
  severity: z.enum(['error', 'warning']),
  message: z.string(),
})); 