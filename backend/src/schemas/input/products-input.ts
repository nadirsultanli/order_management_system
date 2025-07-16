import { z } from 'zod';

// ==============================================================
// PRODUCTS INPUT SCHEMAS
// ==============================================================

// ============ Base Enums ============

export const ProductStatusEnum = z.enum(['active', 'obsolete']);
export const UnitOfMeasureEnum = z.enum(['cylinder', 'kg']);
export const VariantTypeEnum = z.enum(['cylinder', 'refillable', 'disposable']);
export const VariantEnum = z.enum(['outright', 'refill']);
export const SkuVariantEnum = z.enum(['EMPTY', 'FULL-XCH', 'FULL-OUT', 'DAMAGED']);

// ============ Core Product Operations ============

export const ProductFiltersSchema = z.object({
  search: z.string().optional(),
  status: ProductStatusEnum.optional(),
  unit_of_measure: UnitOfMeasureEnum.optional(),
  variant_type: VariantTypeEnum.default('cylinder'),
  has_inventory: z.boolean().optional(),
  low_stock_only: z.boolean().default(false),
  availability_status: z.enum(['available', 'low_stock', 'out_of_stock']).optional(),
  capacity_min: z.number().min(0).optional(),
  capacity_max: z.number().min(0).optional(),
  weight_min: z.number().min(0).optional(),
  weight_max: z.number().min(0).optional(),
  requires_tag: z.boolean().optional(),
  is_variant: z.boolean().optional(),
  parent_products_id: z.string().uuid().optional(),
  sku_variant: SkuVariantEnum.optional(),
  created_after: z.string().optional(),
  updated_after: z.string().optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(1000).default(50),
  sort_by: z.enum(['created_at', 'name', 'sku', 'capacity_kg', 'inventory_level', 'last_sold']).default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc'),
  show_obsolete: z.boolean().default(false),
  include_inventory_data: z.boolean().default(false),
});

export const GetProductByIdSchema = z.object({
  id: z.string().uuid(),
});

export const GetProductStatsSchema = z.object({});

export const GetProductOptionsSchema = z.object({
  status: z.string().default('active').transform((val) => {
    // Handle comma-separated values for multiple statuses
    const statusValues = val.split(',').map(s => s.trim()).filter(Boolean);
    // Validate each status value
    const validStatuses = statusValues.every(s => ['active', 'obsolete'].includes(s));
    if (!validStatuses) {
      throw new Error('Invalid status value. Must be "active", "obsolete", or comma-separated combination.');
    }
    return statusValues;
  }),
  include_variants: z.boolean().default(true),
});

export const CreateProductSchema = z.object({
  sku: z.string().min(1, 'SKU is required'),
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  unit_of_measure: UnitOfMeasureEnum,
  capacity_kg: z.number().positive().optional(),
  tare_weight_kg: z.number().positive().optional(),
  gross_weight_kg: z.number().positive().optional(),
  valve_type: z.string().optional(),
  status: ProductStatusEnum.default('active'),
  barcode_uid: z.string().optional(),
  requires_tag: z.boolean().default(false),
  variant_type: VariantTypeEnum.default('cylinder'),
  variant: VariantEnum.default('outright'),
  is_variant: z.boolean().default(false),
  parent_products_id: z.string().uuid().optional(),
  sku_variant: SkuVariantEnum.optional(),
  tax_category: z.string().optional(),
  tax_rate: z.number().min(0).max(1).optional(),
});

export const UpdateProductSchema = z.object({
  id: z.string().uuid(),
  sku: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  unit_of_measure: UnitOfMeasureEnum.optional(),
  capacity_kg: z.number().positive().optional(),
  tare_weight_kg: z.number().positive().optional(),
  gross_weight_kg: z.number().positive().optional(),
  valve_type: z.string().optional(),
  status: ProductStatusEnum.optional(),
  barcode_uid: z.string().optional(),
  requires_tag: z.boolean().optional(),
  variant: VariantEnum.optional(),
  variant_type: VariantTypeEnum.optional(),
  is_variant: z.boolean().optional(),
  tax_category: z.string().optional(),
  tax_rate: z.number().min(0).max(1).optional(),
});

export const DeleteProductSchema = z.object({
  id: z.string().uuid(),
  is_parent_product: z.boolean().default(false),
});

// ============ Product Variants ============

export const GetVariantsSchema = z.object({
  parent_products_id: z.string().uuid(),
});

export const CreateVariantSchema = z.object({
  parent_products_id: z.string().uuid(),
  sku_variant: SkuVariantEnum,
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  status: ProductStatusEnum.default('active'),
  barcode_uid: z.string().optional(),
});

// ============ Bulk Operations ============

export const BulkStatusUpdateSchema = z.object({
  product_ids: z.array(z.string().uuid()).min(1),
  status: ProductStatusEnum,
});

export const ReactivateProductSchema = z.object({
  id: z.string().uuid(),
  is_parent_product: z.boolean().default(false),
});

// ============ Product Validation ============

export const ValidateProductSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  exclude_id: z.string().uuid().optional(),
});

export const ValidateSkuSchema = z.object({
  sku: z.string().min(1),
  exclude_id: z.string().uuid().optional(),
});

export const ValidateWeightSchema = z.object({
  capacity_kg: z.number().optional(),
  tare_weight_kg: z.number().optional(),
  unit_of_measure: UnitOfMeasureEnum,
});

export const ValidateStatusChangeSchema = z.object({
  product_id: z.string().uuid(),
  new_status: ProductStatusEnum,
});

// ============ Advanced Product Analytics ============

export const GetAvailabilityMatrixSchema = z.object({
  product_ids: z.array(z.string().uuid()).optional(),
  warehouse_ids: z.array(z.string().uuid()).optional(),
  include_reserved: z.boolean().default(false),
  min_quantity: z.number().min(0).default(1),
});

export const CalculateInventoryMovementsSchema = z.object({
  order: z.object({
    id: z.string().uuid(),
    order_type: z.enum(['delivery', 'refill', 'exchange', 'pickup']),
    exchange_empty_qty: z.number().min(0).default(0),
    order_lines: z.array(z.object({
      id: z.string().uuid(),
      product_id: z.string().uuid(),
      quantity: z.number().min(1),
      product: z.object({
        id: z.string().uuid(),
        name: z.string(),
      }),
    })),
  }),
});

export const ValidateOrderTypeSchema = z.object({
  order: z.object({
    order_type: z.enum(['delivery', 'refill', 'exchange', 'pickup']),
    exchange_empty_qty: z.number().min(0).default(0),
    requires_pickup: z.boolean().default(false),
  }),
});

export const CalculateExchangeQuantitySchema = z.object({
  order: z.object({
    order_type: z.enum(['delivery', 'refill', 'exchange', 'pickup']),
    exchange_empty_qty: z.number().min(0).default(0),
  }),
});

export const ShouldRequirePickupSchema = z.object({
  order_type: z.enum(['delivery', 'refill', 'exchange', 'pickup']),
});

export const GetStandardCylinderVariantsSchema = z.object({});

export const GenerateVariantSkuSchema = z.object({
  parent_sku: z.string().min(1),
  variant_name: z.string().min(1),
});

export const CreateVariantDataSchema = z.object({
  parent_product: z.object({
    id: z.string().uuid(),
    sku: z.string(),
    name: z.string(),
    status: ProductStatusEnum,
  }),
  sku_variant: SkuVariantEnum,
  description: z.string().optional(),
});

// ============ New Hierarchical Product Schemas ============

export const CreateParentProductSchema = z.object({
  sku: z.string().min(1, 'SKU is required'),
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  capacity_kg: z.number().positive().optional(),
  tare_weight_kg: z.number().positive().optional(),
  gross_weight_kg: z.number().positive().optional(),
  valve_type: z.string().optional(),
  status: ProductStatusEnum.default('active'),
  barcode_uid: z.string().optional(),
  tax_category: z.string().optional(),
  tax_rate: z.number().min(0).max(1).optional(),
  // Allow but ignore fields that don't exist in parent_products table
  unit_of_measure: UnitOfMeasureEnum.optional(),
  requires_tag: z.boolean().optional(),
  variant_type: VariantTypeEnum.optional(),
  variant: VariantEnum.optional(),
});

export const GetGroupedProductsSchema = z.object({
  search: z.string().optional(),
  status: ProductStatusEnum.optional(),
  unit_of_measure: UnitOfMeasureEnum.optional(),
  variant_type: VariantTypeEnum.optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(1000).default(50),
  sort_by: z.enum(['created_at', 'name', 'sku']).default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc'),
  show_obsolete: z.boolean().default(false),
});

export const GetSkuVariantsSchema = z.object({});

export const ListParentProductsSchema = z.object({
  search: z.string().optional(),
  status: ProductStatusEnum.optional(),
  unit_of_measure: UnitOfMeasureEnum.optional(),
  variant_type: VariantTypeEnum.optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(1000).default(50),
  sort_by: z.enum(['created_at', 'name', 'sku']).default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc'),
  show_obsolete: z.boolean().default(false),
  include_variant_counts: z.boolean().default(true),
}); 