import { z } from 'zod';

// ==============================================================
// PRICING INPUT SCHEMAS
// ==============================================================

// ============ Base Enums ============

export const PriceListStatusEnum = z.enum(['active', 'future', 'expired']);
export const PricingMethodEnum = z.enum(['per_unit', 'per_kg', 'flat_rate', 'tiered']);

// ============ Core Price List Operations ============

export const PriceListFiltersSchema = z.object({
  search: z.string().optional(),
  currency_code: z.string().length(3).optional(),
  status: PriceListStatusEnum.optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(1000).default(50),
});

export const GetPriceListByIdSchema = z.object({
  id: z.string().uuid(),
});

export const CreatePriceListSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  currency_code: z.string().length(3).default('KES'),
  start_date: z.string(),
  end_date: z.string().optional(),
  is_default: z.boolean().default(false),
  pricing_method: PricingMethodEnum.default('per_unit'),
});

export const UpdatePriceListSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  currency_code: z.string().length(3).optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  is_default: z.boolean().optional(),
  pricing_method: PricingMethodEnum.optional(),
});

export const DeletePriceListSchema = z.object({
  id: z.string().uuid(),
});

export const SetDefaultPriceListSchema = z.object({
  id: z.string().uuid(),
});

// ============ Price List Items ============

export const PriceListItemFiltersSchema = z.object({
  price_list_id: z.string().uuid(),
  search: z.string().optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(1000).default(50),
});

export const CreatePriceListItemSchema = z.object({
  price_list_id: z.string().uuid(),
  product_id: z.string().uuid(),
  unit_price: z.number().positive().optional(),
  price_per_kg: z.number().positive().optional(),
  min_qty: z.number().int().min(1).optional(),
  surcharge_pct: z.number().min(0).max(100).optional(),
  pricing_method: PricingMethodEnum.default('per_unit'),
  // Tax-related fields (optional, calculated if not provided)
  price_excluding_tax: z.number().positive().optional(),
  tax_amount: z.number().min(0).optional(),
  price_including_tax: z.number().positive().optional(),
}).refine((data) => {
  // Ensure either unit_price or price_per_kg is provided based on pricing_method
  if (data.pricing_method === 'per_unit') {
    return data.unit_price !== undefined && data.unit_price > 0;
  } else if (data.pricing_method === 'per_kg') {
    return data.price_per_kg !== undefined && data.price_per_kg > 0;
  }
  return true;
}, {
  message: "Unit price is required for per_unit method, price per kg is required for per_kg method"
});

export const UpdatePriceListItemSchema = z.object({
  id: z.string().uuid(),
  unit_price: z.number().positive().optional(),
  price_per_kg: z.number().positive().optional(),
  min_qty: z.number().int().min(1).optional(),
  surcharge_pct: z.number().min(0).max(100).optional(),
  pricing_method: PricingMethodEnum.optional(),
  // Tax-related fields (optional, calculated if not provided)
  price_excluding_tax: z.number().positive().optional(),
  tax_amount: z.number().min(0).optional(),
  price_including_tax: z.number().positive().optional(),
});

export const DeletePriceListItemSchema = z.object({
  id: z.string().uuid(),
});

export const BulkPricingSchema = z.object({
  price_list_id: z.string().uuid(),
  product_ids: z.array(z.string().uuid()),
  pricing_method: PricingMethodEnum,
  unit_price: z.number().positive().optional(),
  source_price_list_id: z.string().uuid().optional(),
  markup_percentage: z.number().optional(),
  min_qty: z.number().int().min(1).optional(),
  surcharge_pct: z.number().min(0).max(100).optional(),
});

// ============ Business Logic Operations ============

export const CalculateFinalPriceSchema = z.object({
  unitPrice: z.number().positive(),
  surchargePercent: z.number().optional(),
});

export const GetPriceListStatusSchema = z.object({
  startDate: z.string(),
  endDate: z.string().optional(),
});

export const ValidateDateRangeSchema = z.object({
  startDate: z.string(),
  endDate: z.string().optional(),
});

export const IsExpiringSoonSchema = z.object({
  endDate: z.string().optional(),
  days: z.number().optional().default(30),
});

export const GetProductPriceSchema = z.object({
  productId: z.string().uuid(),
  customerId: z.string().uuid().optional(),
  date: z.string().optional(),
});

export const GetProductPricesSchema = z.object({
  productIds: z.array(z.string().uuid()),
  customerId: z.string().uuid().optional(),
  date: z.string().optional(),
});

export const GetProductPriceListItemsSchema = z.object({
  productId: z.string().uuid(),
});

export const CalculateOrderTotalsSchema = z.object({
  lines: z.array(z.object({
    quantity: z.number().positive(),
    unit_price: z.number().nonnegative(),
    subtotal: z.number().optional(),
  })),
  taxPercent: z.number().default(0),
});

export const ValidateProductPricingSchema = z.object({
  productId: z.string().uuid(),
  requestedPrice: z.number().positive(),
  quantity: z.number().positive(),
  priceListId: z.string().uuid().optional(),
});

export const GetActivePriceListsSchema = z.object({
  date: z.string().optional(),
});

export const FormatCurrencySchema = z.object({
  amount: z.number(),
  currencyCode: z.string().default('KES'),
});

// ============ Advanced Pricing Operations ============

export const CalculatePricingSchema = z.object({
  customer_id: z.string().uuid().optional(),
  items: z.array(z.object({
    product_id: z.string().uuid(),
    quantity: z.number().positive(),
    price_list_id: z.string().uuid().optional(),
  })),
  pricing_date: z.string().optional(),
});

export const ValidatePriceListSchema = z.object({
  price_list_id: z.string().uuid(),
  items: z.array(z.object({
    product_id: z.string().uuid(),
    unit_price: z.number().positive(),
  })),
});

export const BulkUpdatePricesSchema = z.object({
  price_list_id: z.string().uuid(),
  updates: z.array(z.object({
    product_id: z.string().uuid(),
    unit_price: z.number().positive(),
    min_qty: z.number().int().min(1).optional(),
    surcharge_pct: z.number().min(0).max(100).optional(),
  })),
});

export const GetCustomerPricingTiersSchema = z.object({
  customer_id: z.string().uuid(),
});

// ============ Weight-Based Pricing Schemas ============

export const CalculateWeightBasedPricingSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().positive().default(1),
  custom_gas_weight_kg: z.number().positive().optional(), // Override product weight
  custom_price_per_kg: z.number().positive().optional(), // Override price list
  customer_id: z.string().uuid().optional(),
  pricing_date: z.string().optional(),
});

export const GetDepositRateSchema = z.object({
  capacity_l: z.number().positive(),
  currency_code: z.string().length(3).default('KES'),
  as_of_date: z.string().optional(),
});

export const CalculateTotalWithDepositsSchema = z.object({
  customer_id: z.string().uuid().optional(),
  items: z.array(z.object({
    product_id: z.string().uuid(),
    quantity: z.number().positive(),
    pricing_method: z.enum(['per_unit', 'per_kg', 'flat_rate', 'tiered']).optional(),
    price_list_id: z.string().uuid().optional(),
  })),
  include_deposits: z.boolean().default(true),
  tax_rate: z.number().min(0).max(100).optional(),
  pricing_date: z.string().optional(),
});

export const EnhancedCalculateFinalPriceSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().positive(),
  pricing_method: z.enum(['per_unit', 'per_kg', 'flat_rate', 'tiered']),
  unit_price: z.number().positive(),
  surcharge_percent: z.number().optional(),
  customer_id: z.string().uuid().optional(),
  date: z.string().optional(),
});

// ============ Legacy Compatibility Schemas ============

export const LegacyPriceListFiltersSchema = z.object({
  price_list_id: z.string().uuid(),
}); 