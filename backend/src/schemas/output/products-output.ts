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
  parent_products_id: z.string().nullable(),
  sku_variant: z.enum(['EMPTY', 'FULL-XCH', 'FULL-OUT', 'DAMAGED']).nullable(),
  is_variant: z.boolean(),
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

export const DeleteProductResponseSchema = z.union([
  z.object({
    success: z.boolean(),
    product: z.object({
      id: z.string(),
      sku: z.string(),
      name: z.string(),
      status: z.string(),
    }),
  }),
  z.object({
    success: z.boolean(),
    parent_product: z.object({
      id: z.string(),
      sku: z.string(),
      name: z.string(),
      status: z.string(),
    }),
    deleted_children: z.array(z.object({
      id: z.string(),
      sku: z.string(),
      name: z.string(),
      status: z.string(),
    })),
    deleted_type: z.string(),
    children_count: z.number(),
  }),
]);

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

export const UpdateVariantResponseSchema = ProductBaseSchema;

// ============ Bulk Operations ============

export const BulkUpdateErrorSchema = z.object({
  product_id: z.string(),
  error: z.string(),
});

export const BulkStatusUpdateResponseSchema = z.object({
  success: z.boolean(),
  updated_count: z.number(),
  total_requested: z.number(),
  products: z.array(z.object({
    id: z.string(),
    sku: z.string(),
    name: z.string(),
    status: z.string(),
    parent_products_id: z.string().optional(),
  })),
  errors: z.array(BulkUpdateErrorSchema).optional(),
  partial_success: z.boolean().optional(),
});

export const ReactivateProductResponseSchema = z.union([
  z.object({
    id: z.string(),
    sku: z.string(),
    name: z.string(),
    status: z.string(),
  }),
  z.object({
    success: z.boolean(),
    parent_product: z.object({
      id: z.string(),
      sku: z.string(),
      name: z.string(),
      status: z.string(),
    }),
    reactivated_children: z.array(z.object({
      id: z.string(),
      sku: z.string(),
      name: z.string(),
      status: z.string(),
    })),
    reactivated_type: z.string(),
    children_count: z.number(),
  }),
]);

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
    sku_variant: z.enum(['EMPTY', 'FULL-XCH', 'FULL-OUT', 'DAMAGED']),
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

export const GeneratedSkuResponseSchema = z.object({
  variant_sku: z.string(),
});

export const CreateVariantDataResponseSchema = z.object({
  parent_products_id: z.string(),
  sku_variant: z.enum(['EMPTY', 'FULL-XCH', 'FULL-OUT', 'DAMAGED']),
  sku: z.string(),
  name: z.string(),
  description: z.string(),
  status: z.enum(['active', 'obsolete']),
  barcode_uid: z.undefined(),
});

// ============ New Hierarchical Product Schemas ============

export const ParentProductSchema = z.object({
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
  tax_category: z.string().optional(),
  tax_rate: z.number().optional(),
  created_at: z.string(),
  variant_count: z.number().optional(),
});

export const GroupedProductSchema = z.object({
  parent: ParentProductSchema,
  variants: z.array(ProductBaseSchema),
});

export const GetGroupedProductsResponseSchema = z.object({
  products: z.array(GroupedProductSchema),
  totalCount: z.number(),
  totalPages: z.number(),
  currentPage: z.number(),
  summary: z.object({
    total_parent_products: z.number(),
    total_variants: z.number(),
    active_parent_products: z.number(),
    obsolete_parent_products: z.number(),
  }),
});

export const CreateParentProductResponseSchema = ParentProductSchema;

export const UpdateParentProductResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(['active', 'obsolete']),
  sku: z.string(),
  description: z.string().optional(),
  capacity_kg: z.number().optional(),
  tare_weight_kg: z.number().optional(),
  valve_type: z.string().optional(),
  gross_weight_kg: z.number().optional(),
  children_updated: z.number(),
  updated_children: z.array(z.object({
    id: z.string(),
    sku: z.string(),
    name: z.string(),
    sku_variant: z.string(),
    status: z.string(),
  })),
});

export const GetSkuVariantsResponseSchema = z.object({
  variants: z.array(z.object({
    value: z.enum(['EMPTY', 'FULL-XCH', 'FULL-OUT', 'DAMAGED']),
    label: z.string(),
    description: z.string(),
  })),
});

export const ListParentProductsResponseSchema = z.object({
  products: z.array(ParentProductSchema),
  totalCount: z.number(),
  totalPages: z.number(),
  currentPage: z.number(),
  summary: z.object({
    total_parent_products: z.number(),
    active_parent_products: z.number(),
    obsolete_parent_products: z.number(),
    total_variants: z.number(),
  }),
}); 