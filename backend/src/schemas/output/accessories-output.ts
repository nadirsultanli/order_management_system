import { z } from 'zod';

// ==============================================================
// ACCESSORIES OUTPUT SCHEMAS
// ==============================================================

// ============ Base Types ============

export const AccessoryCategoryOutputSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const AccessoryOutputSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  sku: z.string(),
  category_id: z.string().uuid().nullable(),
  category: AccessoryCategoryOutputSchema.nullable(),
  price: z.number(),
  vat_code: z.enum(['standard', 'reduced', 'zero', 'exempt']),
  deposit_amount: z.number(),
  is_serialized: z.boolean(),
  saleable: z.boolean(),
  active: z.boolean(),
  description: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

// ============ Response Types ============

export const GetAccessoryResponseSchema = z.object({
  accessory: AccessoryOutputSchema,
});

export const GetAccessoriesResponseSchema = z.object({
  accessories: z.array(AccessoryOutputSchema),
  totalCount: z.number(),
  page: z.number(),
  limit: z.number(),
  totalPages: z.number(),
});

export const GetAccessoryCategoriesResponseSchema = z.object({
  categories: z.array(AccessoryCategoryOutputSchema),
  totalCount: z.number(),
});

export const GetAccessoryStatsResponseSchema = z.object({
  total: z.number(),
  active: z.number(),
  obsolete: z.number(),
  saleable: z.number(),
  serialized: z.number(),
  categories: z.number(),
});

export const GetAccessoryOptionsResponseSchema = z.object({
  accessories: z.array(z.object({
    id: z.string().uuid(),
    name: z.string(),
    sku: z.string(),
    price: z.number(),
    category: z.object({
      id: z.string().uuid(),
      name: z.string(),
    }).nullable(),
  })),
});

// ============ Unified Item Types ============

export const UnifiedItemOutputSchema = z.object({
  id: z.string().uuid(),
  item_type: z.enum(['product', 'accessory']),
  name: z.string(),
  sku: z.string(),
  status: z.string(),
  created_at: z.string(),
  // Product-specific fields
  unit_of_measure: z.string().nullable(),
  capacity_kg: z.number().nullable(),
  // Accessory-specific fields
  price: z.number().nullable(),
  category: z.object({
    id: z.string().uuid(),
    name: z.string(),
  }).nullable(),
});

export const GetUnifiedItemsResponseSchema = z.object({
  items: z.array(UnifiedItemOutputSchema),
  totalCount: z.number(),
  page: z.number(),
  limit: z.number(),
  totalPages: z.number(),
});

// ============ Validation Response Types ============

export const ValidateAccessoryResponseSchema = z.object({
  valid: z.boolean(),
  errors: z.array(z.string()),
  warnings: z.array(z.string()),
});

export const ValidateAccessorySkuResponseSchema = z.object({
  valid: z.boolean(),
  errors: z.array(z.string()),
  warnings: z.array(z.string()),
});

// ============ Bulk Operation Response Types ============

export const BulkAccessoryStatusUpdateResponseSchema = z.object({
  success: z.boolean(),
  updated_count: z.number(),
  errors: z.array(z.string()),
});

// ============ Success Response Types ============

export const CreateAccessoryResponseSchema = z.object({
  accessory: AccessoryOutputSchema,
  message: z.string(),
});

export const UpdateAccessoryResponseSchema = z.object({
  accessory: AccessoryOutputSchema,
  message: z.string(),
});

export const DeleteAccessoryResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export const CreateAccessoryCategoryResponseSchema = z.object({
  category: AccessoryCategoryOutputSchema,
  message: z.string(),
});

export const UpdateAccessoryCategoryResponseSchema = z.object({
  category: AccessoryCategoryOutputSchema,
  message: z.string(),
});

export const DeleteAccessoryCategoryResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
}); 