import { z } from 'zod';

// ==============================================================
// ACCESSORIES INPUT SCHEMAS
// ==============================================================

// ============ Base Enums ============

export const AccessoryStatusEnum = z.enum(['active', 'obsolete']);
export const VatCodeEnum = z.enum(['standard', 'reduced', 'zero', 'exempt']);

// ============ Core Accessory Operations ============

export const AccessoryFiltersSchema = z.object({
  search: z.string().optional(),
  status: AccessoryStatusEnum.optional(),
  category_id: z.string().uuid().optional(),
  vat_code: VatCodeEnum.optional(),
  is_serialized: z.boolean().optional(),
  saleable: z.boolean().optional(),
  active: z.boolean().optional(),
  price_min: z.number().min(0).optional(),
  price_max: z.number().min(0).optional(),
  created_after: z.string().optional(),
  updated_after: z.string().optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(1000).default(50),
  sort_by: z.enum(['created_at', 'name', 'sku', 'price', 'category']).default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc'),
  show_obsolete: z.boolean().default(false),
});

export const GetAccessoryByIdSchema = z.object({
  id: z.string().uuid(),
});

export const GetAccessoryStatsSchema = z.object({});

export const GetAccessoryOptionsSchema = z.object({
  status: z.string().default('active').transform((val) => {
    const statusValues = val.split(',').map(s => s.trim()).filter(Boolean);
    const validStatuses = statusValues.every(s => ['active', 'obsolete'].includes(s));
    if (!validStatuses) {
      throw new Error('Invalid status value. Must be "active", "obsolete", or comma-separated combination.');
    }
    return statusValues;
  }),
  category_id: z.string().uuid().optional(),
  saleable_only: z.boolean().default(true),
});

export const CreateAccessorySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  sku: z.string().min(1, 'SKU is required'),
  category_id: z.string().uuid().optional(),
  price: z.number().min(0, 'Price must be non-negative'),
  vat_code: VatCodeEnum.default('standard'),
  deposit_amount: z.number().min(0).default(0),
  is_serialized: z.boolean().default(false),
  saleable: z.boolean().default(true),
  active: z.boolean().default(true),
  description: z.string().optional(),
});

export const UpdateAccessorySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).optional(),
  sku: z.string().min(1).optional(),
  category_id: z.string().uuid().optional(),
  price: z.number().min(0).optional(),
  vat_code: VatCodeEnum.optional(),
  deposit_amount: z.number().min(0).optional(),
  is_serialized: z.boolean().optional(),
  saleable: z.boolean().optional(),
  active: z.boolean().optional(),
  description: z.string().optional(),
});

export const DeleteAccessorySchema = z.object({
  id: z.string().uuid(),
});

// ============ Accessory Categories ============

export const CreateAccessoryCategorySchema = z.object({
  name: z.string().min(1, 'Category name is required'),
  slug: z.string().min(1, 'Slug is required').regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
  description: z.string().optional(),
});

export const UpdateAccessoryCategorySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).optional(),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens').optional(),
  description: z.string().optional(),
});

export const DeleteAccessoryCategorySchema = z.object({
  id: z.string().uuid(),
});

// ============ Bulk Operations ============

export const BulkAccessoryStatusUpdateSchema = z.object({
  accessory_ids: z.array(z.string().uuid()).min(1),
  active: z.boolean(),
});

// ============ Accessory Validation ============

export const ValidateAccessorySchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  exclude_id: z.string().uuid().optional(),
});

export const ValidateAccessorySkuSchema = z.object({
  sku: z.string().min(1),
  exclude_id: z.string().uuid().optional(),
});

// ============ Unified Product/Accessory Operations ============

export const CreateItemSchema = z.object({
  item_type: z.enum(['product', 'accessory']),
  // Product fields
  product_data: z.object({
    sku: z.string().min(1, 'SKU is required'),
    name: z.string().min(1, 'Name is required'),
    description: z.string().optional(),
    unit_of_measure: z.enum(['cylinder', 'kg']),
    capacity_kg: z.number().positive().optional(),
    tare_weight_kg: z.number().positive().optional(),
    gross_weight_kg: z.number().positive().optional(),
    valve_type: z.string().optional(),
    status: z.enum(['active', 'obsolete']).default('active'),
    barcode_uid: z.string().optional(),
    requires_tag: z.boolean().default(false),
    variant_type: z.enum(['cylinder', 'refillable', 'disposable']).default('cylinder'),
    variant: z.enum(['outright', 'refill']).default('outright'),
    is_variant: z.boolean().default(false),
    parent_products_id: z.string().uuid().optional(),
    sku_variant: z.enum(['EMPTY', 'FULL-XCH', 'FULL-OUT', 'DAMAGED']).optional(),
    tax_category: z.string().optional(),
    tax_rate: z.number().min(0).max(1).optional(),
  }).optional(),
  // Accessory fields
  accessory_data: z.object({
    name: z.string().min(1, 'Name is required'),
    sku: z.string().min(1, 'SKU is required'),
    category_id: z.string().uuid().optional(),
    price: z.number().min(0, 'Price must be non-negative'),
    vat_code: z.enum(['standard', 'reduced', 'zero', 'exempt']).default('standard'),
    deposit_amount: z.number().min(0).default(0),
    is_serialized: z.boolean().default(false),
    saleable: z.boolean().default(true),
    active: z.boolean().default(true),
    description: z.string().optional(),
  }).optional(),
}).refine((data) => {
  if (data.item_type === 'product' && !data.product_data) {
    return false;
  }
  if (data.item_type === 'accessory' && !data.accessory_data) {
    return false;
  }
  return true;
}, {
  message: "Product data is required when item_type is 'product', accessory data is required when item_type is 'accessory'"
});

export const GetItemsSchema = z.object({
  item_type: z.enum(['product', 'accessory', 'all']).default('all'),
  search: z.string().optional(),
  status: z.string().optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(1000).default(50),
  sort_by: z.enum(['created_at', 'name', 'sku']).default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc'),
}); 