import { z } from 'zod';

// Base schemas
export const AccessoryCategorySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const AccessorySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  sku: z.string(),
  category_id: z.string().uuid().nullable(),
  price: z.number(),
  vat_code: z.string().nullable(),
  deposit_amount: z.number().nullable(),
  is_serialized: z.boolean(),
  saleable: z.boolean(),
  active: z.boolean(),
  description: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  category: AccessoryCategorySchema.nullable(),
});

// Response schemas
export const GetAccessoryResponseSchema = z.object({
  accessory: AccessorySchema,
});

export const GetAccessoriesResponseSchema = z.object({
  accessories: z.array(AccessorySchema),
  totalCount: z.number(),
  page: z.number(),
  limit: z.number(),
  totalPages: z.number(),
});

export const GetAccessoryCategoriesResponseSchema = z.object({
  categories: z.array(AccessoryCategorySchema),
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

export const BulkAccessoryStatusUpdateResponseSchema = z.object({
  success: z.boolean(),
  updated_count: z.number(),
  errors: z.array(z.string()),
});

export const CreateAccessoryResponseSchema = z.object({
  accessory: AccessorySchema,
  message: z.string(),
});

export const UpdateAccessoryResponseSchema = z.object({
  accessory: AccessorySchema,
  message: z.string(),
});

export const DeleteAccessoryResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export const CreateAccessoryCategoryResponseSchema = z.object({
  category: AccessoryCategorySchema,
  message: z.string(),
});

export const UpdateAccessoryCategoryResponseSchema = z.object({
  category: AccessoryCategorySchema,
  message: z.string(),
});

export const DeleteAccessoryCategoryResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

// Unified items schema for compatibility
export const GetUnifiedItemsResponseSchema = z.object({
  items: z.array(z.object({
    id: z.string().uuid(),
    name: z.string(),
    sku: z.string(),
    type: z.literal('accessory'),
    price: z.number(),
    category: z.object({
      id: z.string().uuid(),
      name: z.string(),
    }).nullable(),
  })),
  totalCount: z.number(),
}); 