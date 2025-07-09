export interface PriceList {
  id: string;
  name: string;
  description?: string;
  currency_code: string;
  start_date: string;
  end_date?: string;
  is_default: boolean;
  created_at: string;
  product_count?: number;
}

export interface PriceListItem {
  id: string;
  price_list_id: string;
  product_id: string;
  unit_price: number;
  min_qty: number;
  surcharge_pct?: number;
  // Tax-related fields (pre-calculated, not dynamic)
  price_excluding_tax?: number;
  tax_amount?: number;
  price_including_tax?: number;
  product?: {
    id: string;
    sku: string;
    name: string;
    unit_of_measure: string;
    tax_category?: string;
    tax_rate?: number;
  };
}

export interface CreatePriceListData {
  name: string;
  description?: string;
  currency_code: string;
  start_date: string;
  end_date?: string;
  is_default: boolean;
}

export interface UpdatePriceListData extends Partial<CreatePriceListData> {
  id: string;
}

export interface CreatePriceListItemData {
  price_list_id: string;
  product_id: string;
  unit_price: number;
  min_qty: number;
  surcharge_pct?: number;
  // Tax-related fields (optional, calculated if not provided)
  price_excluding_tax?: number;
  tax_amount?: number;
  price_including_tax?: number;
}

export interface UpdatePriceListItemData extends Partial<CreatePriceListItemData> {
  id: string;
}

export interface PriceListFilters {
  search?: string;
  currency_code?: string;
  status?: 'active' | 'future' | 'expired';
  page?: number;
  limit?: number;
}

export interface PricingStats {
  total_price_lists: number;
  active_price_lists: number;
  future_price_lists: number;
  expired_price_lists: number;
  products_without_pricing: number;
  expiring_soon: number;
}

export interface BulkPricingData {
  price_list_id: string;
  product_ids: string[];
  pricing_method: 'fixed' | 'markup' | 'copy_from_list';
  unit_price?: number;
  markup_percentage?: number;
  source_price_list_id?: string;
  min_qty: number;
  surcharge_pct?: number;
}

export type PriceListStatus = 'active' | 'future' | 'expired';

export interface CurrencyOption {
  code: string;
  name: string;
  symbol: string;
}

// Tax-related interfaces
export interface TaxCalculation {
  priceExcludingTax: number;
  taxAmount: number;
  priceIncludingTax: number;
  taxRate: number;
  taxCategory: string;
}

export interface ProductPricing {
  unitPrice: number;
  surchargePercent: number;
  finalPrice: number;
  priceListId: string;
  priceListName: string;
  // Tax breakdown
  priceExcludingTax?: number;
  taxAmount?: number;
  priceIncludingTax?: number;
  taxRate?: number;
  taxCategory?: string;
}

export interface TaxCategory {
  id: string;
  name: string;
  rate: number;
  description?: string;
}

// Common tax categories for Kenya
export const TAX_CATEGORIES: TaxCategory[] = [
  { id: 'standard', name: 'Standard Rate (16% VAT)', rate: 0.16, description: '16% VAT' },
  { id: 'exempt', name: 'VAT Exempt', rate: 0, description: 'VAT Exempt' },
  { id: 'zero_rated', name: 'Zero Rated (0% VAT)', rate: 0, description: '0% VAT' },
  { id: 'luxury', name: 'Luxury (25% luxury tax)', rate: 0.25, description: '25% luxury tax' },
  { id: 'reduced', name: 'Reduced Rate (8% reduced)', rate: 0.08, description: '8% reduced' },
];