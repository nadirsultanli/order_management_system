export interface AccessoryCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface Accessory {
  id: string;
  name: string;
  sku: string;
  category_id?: string;
  category?: AccessoryCategory;
  price: number;
  vat_code: 'standard' | 'reduced' | 'zero' | 'exempt';
  deposit_amount: number;
  is_serialized: boolean;
  saleable: boolean;
  active: boolean;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateAccessoryData {
  name: string;
  sku: string;
  category_id?: string;
  price: number;
  vat_code: 'standard' | 'reduced' | 'zero' | 'exempt';
  deposit_amount: number;
  is_serialized: boolean;
  saleable: boolean;
  active: boolean;
  description?: string;
}

export interface UpdateAccessoryData extends Partial<CreateAccessoryData> {
  id: string;
}

export interface AccessoryFilters {
  search?: string;
  status?: string;
  category_id?: string;
  vat_code?: string;
  is_serialized?: boolean;
  saleable?: boolean;
  active?: boolean;
  price_min?: number;
  price_max?: number;
  created_after?: string;
  updated_after?: string;
  page?: number;
  limit?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  show_obsolete?: boolean;
}

export interface AccessoryStats {
  total: number;
  active: number;
  obsolete: number;
  saleable: number;
  serialized: number;
  categories: number;
}

export interface AccessoryOptions {
  id: string;
  name: string;
  sku: string;
  price: number;
  category?: {
    id: string;
    name: string;
  };
}

// Unified item types for combined product/accessory views
export interface UnifiedItem {
  id: string;
  item_type: 'product' | 'accessory';
  name: string;
  sku: string;
  status: string;
  created_at: string;
  // Product-specific fields
  unit_of_measure?: string;
  capacity_kg?: number;
  // Accessory-specific fields
  price?: number;
  category?: {
    id: string;
    name: string;
  };
}

export interface CreateItemData {
  item_type: 'product' | 'accessory';
  product_data?: any; // Use existing CreateProductData type
  accessory_data?: CreateAccessoryData;
}

// VAT codes for dropdown
export const VAT_CODES = [
  { value: 'standard', label: 'Standard Rate (16% VAT)' },
  { value: 'reduced', label: 'Reduced Rate (8% VAT)' },
  { value: 'zero', label: 'Zero Rate (0% VAT)' },
  { value: 'exempt', label: 'Exempt (No VAT)' },
] as const; 