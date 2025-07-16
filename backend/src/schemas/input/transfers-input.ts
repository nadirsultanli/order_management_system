import { z } from 'zod';

// ==============================================================
// TRANSFERS INPUT SCHEMAS
// ==============================================================

// ============ Base Enums ============

export const TransferStatusEnum = z.enum(['draft', 'pending', 'approved', 'in_transit', 'completed', 'cancelled']);
export const TransferTypeEnum = z.enum(['internal', 'external', 'adjustment', 'return']);
export const TransferPriorityEnum = z.enum(['low', 'normal', 'high', 'urgent']);
export const VariantTypeEnum = z.enum(['cylinder', 'refillable', 'disposable']);
export const SortOrderEnum = z.enum(['asc', 'desc']);

// ============ Core Transfer Schemas ============

export const TransferItemSchema = z.object({
  product_id: z.string().uuid(),
  product_sku: z.string().optional(),
  product_name: z.string().optional(),
  variant_name: z.string().optional(),
  variant_type: VariantTypeEnum.optional(),
  quantity_to_transfer: z.number().positive(),
  available_stock: z.number().min(0).optional(),
  reserved_stock: z.number().min(0).optional(),
  unit_weight_kg: z.number().min(0).optional(),
  unit_cost: z.number().min(0).optional(),
  source_location: z.string().optional(),
  batch_number: z.string().optional(),
  expiry_date: z.string().optional(),
});

export const TransferFiltersSchema = z.object({
  source_warehouse_id: z.string().uuid().optional(),
  destination_warehouse_id: z.string().uuid().optional(),
  status: z.string().optional().transform((val) => {
    if (!val) return undefined;
    // Handle comma-separated values for multiple statuses
    const statusValues = val.split(',').map(s => s.trim()).filter(Boolean);
    // Validate each status value
    const validStatuses = statusValues.every(s => 
      ['draft', 'pending', 'approved', 'in_transit', 'completed', 'cancelled'].includes(s)
    );
    if (!validStatuses) {
      throw new Error('Invalid status value. Must be valid transfer status or comma-separated combination.');
    }
    return statusValues;
  }),
  transfer_type: TransferTypeEnum.optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  created_by_user_id: z.string().uuid().optional(),
  search_text: z.string().optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
  sort_by: z.enum(['created_at', 'transfer_date', 'total_items', 'total_weight_kg']).default('created_at'),
  sort_order: SortOrderEnum.default('desc'),
});

export const GetTransferByIdSchema = z.object({
  id: z.string().uuid(),
});

export const ValidateTransferSchema = z.object({
  source_warehouse_id: z.string().uuid(),
  destination_warehouse_id: z.string().uuid(),
  transfer_date: z.string(),
  items: z.array(TransferItemSchema).min(1),
});

export const CreateTransferSchema = z.object({
  source_warehouse_id: z.string().uuid(),
  destination_warehouse_id: z.string().uuid(),
  transfer_date: z.string().optional().default(() => {
    const today = new Date();
    return today.toISOString().slice(0, 10);
  }),
  scheduled_date: z.string().optional(),
  priority: TransferPriorityEnum.default('normal'),
  transfer_reference: z.string().optional(),
  reason: z.string().optional(),
  notes: z.string().optional(),
  instructions: z.string().optional(),
  items: z.array(TransferItemSchema).min(1),
});

export const UpdateTransferStatusSchema = z.object({
  transfer_id: z.string().uuid(),
  new_status: TransferStatusEnum,
  notes: z.string().optional(),
  completed_items: z.array(z.string().uuid()).optional(),
});

// ============ Transfer Management Schemas ============

export const GetWarehouseStockSchema = z.object({
  warehouse_id: z.string().uuid(),
  search_text: z.string().optional(),
  variant_type: VariantTypeEnum.optional(),
  variant_name: z.string().optional(),
  has_stock: z.boolean().default(true),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(50),
});

export const GetCostAnalysisSchema = z.object({
  transfer_id: z.string().uuid(),
});

export const SearchProductsSchema = z.object({
  warehouse_id: z.string().uuid().optional(),
  search_text: z.string().optional(),
  variant_type: VariantTypeEnum.optional(),
  variant_name: z.string().optional(),
  include_variants: z.boolean().default(true),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(50),
});

// ============ Advanced Transfer Operations ============

export const ValidateMultiSkuTransferSchema = z.object({
  source_warehouse_id: z.string().uuid(),
  destination_warehouse_id: z.string().uuid(),
  transfer_date: z.string(),
  items: z.array(TransferItemSchema).min(1),
  notes: z.string().optional(),
  reason: z.string().optional(),
  priority: TransferPriorityEnum.default('normal'),
});

export const CalculateTransferDetailsSchema = z.object({
  items: z.array(TransferItemSchema).min(1),
});

export const ValidateTransferCapacitySchema = z.object({
  warehouse_id: z.string().uuid(),
  items: z.array(TransferItemSchema).min(1),
  warehouse_capacity_kg: z.number().optional(),
});

export const ValidateInventoryAvailabilitySchema = z.object({
  warehouse_id: z.string().uuid(),
  items: z.array(TransferItemSchema).min(1),
});

export const CheckTransferConflictsSchema = z.object({
  source_warehouse_id: z.string().uuid(),
  destination_warehouse_id: z.string().uuid(),
  transfer_date: z.string(),
  items: z.array(TransferItemSchema).min(1),
});

export const EstimateTransferDurationSchema = z.object({
  items: z.array(TransferItemSchema).min(1),
  estimated_distance_km: z.number().optional(),
});

export const FormatValidationErrorsSchema = z.object({
  validation_result: z.object({
    is_valid: z.boolean(),
    errors: z.array(z.string()),
    warnings: z.array(z.string()),
    blocked_items: z.array(z.string()),
    total_weight_kg: z.number(),
    estimated_cost: z.number().optional(),
  }),
}); 