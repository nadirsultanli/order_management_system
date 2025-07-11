import { z } from 'zod';

// ==============================================================
// PRICING OUTPUT SCHEMAS
// ==============================================================

// ============ Base Entities ============

export const ProductBaseSchema = z.object({
  id: z.string(),
  sku: z.string(),
  name: z.string(),
  unit_of_measure: z.string(),
  tax_category: z.string().nullable(),
  tax_rate: z.number().nullable(),
});

export const PriceListStatusInfoSchema = z.object({
  status: z.enum(['active', 'future', 'expired']),
  daysUntilStart: z.number().optional(),
  daysUntilEnd: z.number().optional(),
});

export const PriceListSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  currency_code: z.string(),
  start_date: z.string(),
  end_date: z.string().nullable(),
  is_default: z.boolean(),
  created_at: z.string(),
  updated_at: z.string().nullable(),
  product_count: z.number().optional(),
  status: z.string().optional(),
  statusInfo: PriceListStatusInfoSchema.optional(),
  isExpiringSoon: z.boolean().optional(),
});

export const PriceListItemSchema = z.object({
  id: z.string(),
  price_list_id: z.string(),
  product_id: z.string(),
  unit_price: z.number(),
  min_qty: z.number().nullable(),
  surcharge_pct: z.number().nullable(),
  price_excluding_tax: z.number().nullable(),
  tax_amount: z.number().nullable(),
  price_including_tax: z.number().nullable(),
  created_at: z.string(),
  updated_at: z.string().nullable(),
  product: ProductBaseSchema.optional(),
  price_list: PriceListSchema.optional(),
});

// ============ Core Price List Operations ============

export const PriceListListResponseSchema = z.object({
  priceLists: z.array(PriceListSchema),
  totalCount: z.number(),
  totalPages: z.number(),
  currentPage: z.number(),
});

export const PriceListDetailResponseSchema = PriceListSchema;

export const CreatePriceListResponseSchema = PriceListSchema;

export const UpdatePriceListResponseSchema = PriceListSchema;

export const DeletePriceListResponseSchema = z.object({
  success: z.boolean(),
});

export const SetDefaultPriceListResponseSchema = PriceListSchema;

// ============ Price List Items ============

export const PriceListItemsResponseSchema = z.object({
  items: z.array(PriceListItemSchema),
  totalCount: z.number(),
  totalPages: z.number(),
  currentPage: z.number(),
});

export const CreatePriceListItemResponseSchema = PriceListItemSchema;

export const UpdatePriceListItemResponseSchema = PriceListItemSchema;

export const DeletePriceListItemResponseSchema = z.object({
  success: z.boolean(),
  price_list_id: z.string(),
});

export const BulkAddProductsResponseSchema = z.object({
  items: z.array(PriceListItemSchema),
  errors: z.array(z.string()),
  successCount: z.number(),
  errorCount: z.number(),
});

// ============ Business Logic Operations ============

export const CalculateFinalPriceResponseSchema = z.object({
  finalPrice: z.number(),
});

export const GetPriceListStatusResponseSchema = PriceListStatusInfoSchema;

export const ValidateDateRangeResponseSchema = z.object({
  valid: z.boolean(),
});

export const IsExpiringSoonResponseSchema = z.object({
  expiringSoon: z.boolean(),
});

// Fix ProductPriceResponseSchema to match actual PriceCalculationResult interface
export const ProductPriceResponseSchema = z.object({
  // These match the actual PriceCalculationResult interface fields
  unitPrice: z.number(),
  surchargePercent: z.number(),
  finalPrice: z.number(),
  priceListId: z.string(),
  priceListName: z.string(),
  // Tax-related fields (optional)
  priceExcludingTax: z.number().optional(),
  taxAmount: z.number().optional(),
  priceIncludingTax: z.number().optional(),
  taxRate: z.number().optional(),
  taxCategory: z.string().optional(),
}).nullable(); // PricingService can return null

export const ProductPricesResponseSchema = z.record(z.string(), ProductPriceResponseSchema);

export const ProductPriceListItemsResponseSchema = z.array(PriceListItemSchema.extend({
  price_list: PriceListSchema.extend({
    status: z.string(),
    statusInfo: PriceListStatusInfoSchema,
  }),
}));

export const OrderTotalsResponseSchema = z.object({
  subtotal: z.number(),
  taxAmount: z.number(),
  grandTotal: z.number(),
});

export const ValidateProductPricingResponseSchema = z.object({
  valid: z.boolean(), // Match the actual return from PricingService
  errors: z.array(z.string()),
  actualPrice: z.number().optional(), // Match the actual field name
});

export const ActivePriceListsResponseSchema = z.array(PriceListSchema);

export const FormatCurrencyResponseSchema = z.object({
  formatted: z.string(),
});

// ============ Statistics ============

export const PricingStatsResponseSchema = z.object({
  total_price_lists: z.number(),
  active_price_lists: z.number(),
  future_price_lists: z.number(),
  expired_price_lists: z.number(),
  expiring_soon: z.number(),
  products_without_pricing: z.number(),
});

// ============ Advanced Pricing Operations ============

export const PricingCalculationItemSchema = z.object({
  product_id: z.string(),
  quantity: z.number(),
  unit_price: z.number(),
  surcharge_pct: z.number().nullable(),
  final_price: z.number(),
  subtotal: z.number(),
  price_list_id: z.string(),
  price_list_name: z.string(),
  min_qty: z.number().nullable(),
  error: z.string().optional(),
});

export const CalculatePricingResponseSchema = z.object({
  items: z.array(PricingCalculationItemSchema),
  totalAmount: z.number(),
  currency: z.string(),
  pricing_date: z.string(),
});

export const ValidationResultSchema = z.object({
  product_id: z.string(),
  product_sku: z.string(),
  product_name: z.string(),
  unit_price: z.number(),
  is_valid: z.boolean(),
  warnings: z.array(z.string()),
});

export const ValidatePriceListResponseSchema = z.object({
  price_list_id: z.string(),
  price_list_name: z.string(),
  validation_results: z.array(ValidationResultSchema),
  total_items: z.number(),
  valid_items: z.number(),
  errors: z.array(z.string()),
  overall_valid: z.boolean(),
});

export const BulkUpdatePricesResponseSchema = z.object({
  updated_items: z.array(PriceListItemSchema),
  errors: z.array(z.string()),
  success_count: z.number(),
  error_count: z.number(),
});

// Fix CustomerPricingTiersResponseSchema to match actual return structure
export const CustomerPricingTiersResponseSchema = z.object({
  customer: z.object({
    id: z.string(), // Change from any to string
    name: z.string(), // Change from any to string
    tier: z.string(), // Change from any to string
    credit_terms_days: z.number().nullable(), // Change from any to number | null
    payment_terms: z.string().nullable(), // Change from any to string | null
  }),
  pricing_info: z.object({
    tier_discount_percentage: z.number(),
    applicable_price_lists: z.array(z.object({
      id: z.string(), // Change from any to string
      name: z.string(), // Change from any to string
      start_date: z.string(), // Change from any to string
      end_date: z.string().nullable(), // Change from any to string | null
      is_default: z.boolean(), // Change from any to boolean
      currency_code: z.string(), // Change from any to string
      // Add missing required fields to match PriceListSchema
      description: z.string().nullable(),
      created_at: z.string(),
      updated_at: z.string().nullable(),
    })),
    special_pricing_rules: z.array(z.string()), // Remove null from array elements
  }),
}); 