import { z } from 'zod';

// ==============================================================
// PRODUCTS OUTPUT SCHEMAS
// ==============================================================

// ============ Base Entities ============

export const WarehouseBaseSchema = z.object({
  id: z.string(),
  name: z.string(),
});

export const InventoryBaseSchema = z.object({
  warehouse_id: z.string(),
  qty_full: z.number(),
  qty_empty: z.number(),
  qty_reserved: z.number(),
  updated_at: z.string(),
  warehouse: WarehouseBaseSchema,
});

export const ProductBaseSchema = z.object({
  id: z.string(),
  sku: z.string(),
  name: z.string(),
  description: z.string().optional(),
  unit_of_measure: z.enum(['cylinder', 'kg']),
  capacity_kg: z.number().optional(),
  tare_weight_kg: z.number().optional(),
  valve_type: z.string().optional(),
  status: z.enum(['active', 'obsolete']),
  barcode_uid: z.string().optional(),
  requires_tag: z.boolean(),
  variant_type: z.enum(['cylinder', 'refillable', 'disposable']),
  variant: z.enum(['outright', 'refill']).optional(),
  parent_product_id: z.string().nullable(),
  variant_name: z.string().nullable(),
  is_variant: z.boolean(),
  sku_variant: z.enum(['EMPTY', 'FULL-XCH', 'FULL-OUT', 'DAMAGED']).nullable(),
  tax_category: z.string().optional(),
  tax_rate: z.number().optional(),
  created_at: z.string(),
});

export const InventorySummarySchema = z.object({
  total_stock: z.number(),
  total_available: z.number(),
  warehouse_count: z.number(),
  stock_level: z.enum(['out', 'critical', 'low', 'normal', 'high']),
  is_available: z.boolean(),
  last_restocked: z.string().nullable(),
});

export const EnhancedProductSchema = ProductBaseSchema.extend({
  inventory_summary: InventorySummarySchema.optional(),
  popularity_score: z.number(),
  compliance_score: z.number(),
  profitability_score: z.number(),
  inventory_balance: z.array(InventoryBaseSchema).optional(),
});

// ============ Core Product Operations ============

export const ProductDetailResponseSchema = ProductBaseSchema;

export const ProductStatsResponseSchema = z.object({
  total: z.number(),
  active: z.number(),
  obsolete: z.number(),
  cylinders: z.number(),
  kg_products: z.number(),
});

export const ProductOptionSchema = z.object({
  id: z.string(),
  sku: z.string(),
  name: z.string(),
  display_name: z.string(),
  is_variant: z.boolean(),
});

export const ProductOptionsResponseSchema = z.array(ProductOptionSchema);

export const CreateProductResponseSchema = ProductBaseSchema;

export const UpdateProductResponseSchema = ProductBaseSchema;

export const DeleteProductResponseSchema = z.object({
  success: z.boolean(),
  product: z.object({
    id: z.string(),
    sku: z.string(),
    name: z.string(),
    status: z.string(),
  }),
});

// ============ Product Listing ============

export const ProductSummarySchema = z.object({
  total_products: z.number().default(0),
  active_products: z.number().default(0),
  obsolete_products: z.number().default(0),
  with_inventory: z.number().default(0),
  low_stock_count: z.number().default(0),
  out_of_stock_count: z.number().default(0),
  avg_capacity: z.number().default(0),
  avg_popularity: z.number().default(0),
  compliance_rate: z.number().default(0),
});

export const ProductListResponseSchema = z.object({
  products: z.array(EnhancedProductSchema),
  totalCount: z.number(),
  totalPages: z.number(),
  currentPage: z.number(),
  summary: ProductSummarySchema,
});

// ============ Product Variants ============

export const ProductVariantsResponseSchema = z.array(ProductBaseSchema);

export const CreateVariantResponseSchema = ProductBaseSchema;

// ============ Bulk Operations ============

export const BulkUpdateErrorSchema = z.object({
  product_id: z.string(),
  error: z.string(),
});

export const BulkStatusUpdateResponseSchema = z.object({
  success: z.boolean(),
  updated_count: z.number(),
  total_requested: z.number(),
  products: z.array(ProductBaseSchema),
  errors: z.array(BulkUpdateErrorSchema).optional(),
  partial_success: z.boolean().optional(),
});

export const ReactivateProductResponseSchema = z.object({
  id: z.string(),
  sku: z.string(),
  name: z.string(),
  status: z.string(),
});

// ============ Product Validation ============

export const ValidationResponseSchema = z.object({
  valid: z.boolean(),
  errors: z.array(z.string()),
  warnings: z.array(z.string()),
});

export const ValidateProductResponseSchema = ValidationResponseSchema;
export const ValidateSkuResponseSchema = ValidationResponseSchema;
export const ValidateWeightResponseSchema = ValidationResponseSchema;
export const ValidateStatusChangeResponseSchema = ValidationResponseSchema;

// ============ Advanced Product Analytics ============

export const AvailabilityMatrixResponseSchema = z.object({
  availability_matrix: z.array(z.object({
    product_id: z.string(),
    product: z.object({
      id: z.string(),
      sku: z.string(),
      name: z.string(),
      unit_of_measure: z.string(),
      status: z.string(),
    }),
    total_available: z.number(),
    warehouse_count: z.number(),
    warehouses: z.array(z.object({
      warehouse_id: z.string(),
      warehouse: z.object({
        id: z.string(),
        name: z.string(),
      }),
      qty_available: z.number(),
      qty_reserved: z.number(),
      stock_level: z.enum(['out', 'critical', 'low', 'normal', 'high']),
    })),
  })),
  summary: z.object({
    total_products: z.number(),
    total_warehouses: z.number(),
    products_with_stock: z.number(),
    cross_warehouse_products: z.number(),
  }),
});

export const InventoryMovementsResponseSchema = z.object({
  movements: z.array(z.object({
    product_id: z.string(),
    variant_name: z.string(),
    qty_full_change: z.number(),
    qty_empty_change: z.number(),
    movement_type: z.enum(['delivery', 'pickup', 'exchange']),
    description: z.string(),
  })),
});

export const ValidateOrderTypeResponseSchema = z.object({
  valid: z.boolean(),
  errors: z.array(z.string()),
});

export const ExchangeCalculationResponseSchema = z.object({
  exchange_quantity: z.number(),
});

export const PickupRequirementResponseSchema = z.object({
  requires_pickup: z.boolean(),
});

export const StandardCylinderVariantsResponseSchema = z.object({
  variants: z.array(z.object({
    name: z.string(),
    description: z.string(),
  })),
});



// ============ Parent Products ============

export const ParentProductBaseSchema = z.object({
  id: z.string(),
  sku: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const ParentProductWithVariantsSchema = ParentProductBaseSchema.extend({
  variants: z.array(ProductBaseSchema).optional(),
  variant_count: z.number().default(0),
});

export const CreateParentProductResponseSchema = ParentProductBaseSchema;

export const UpdateParentProductResponseSchema = ParentProductBaseSchema;

export const GetParentProductByIdResponseSchema = ParentProductWithVariantsSchema;

export const ParentProductListResponseSchema = z.object({
  parent_products: z.array(ParentProductWithVariantsSchema),
  totalCount: z.number(),
  totalPages: z.number(),
  currentPage: z.number(),
  summary: z.object({
    total_parent_products: z.number(),
    products_with_variants: z.number(),
    avg_variants_per_product: z.number(),
  }),
});

export const ParentProductOptionSchema = z.object({
  id: z.string(),
  sku: z.string(),
});

export const ParentProductOptionsResponseSchema = z.array(ParentProductOptionSchema);

export const ValidateParentProductSkuResponseSchema = ValidationResponseSchema; 