export interface Product {
  id: string;
  sku: string;
  name: string;
  description?: string;
  unit_of_measure: 'cylinder' | 'kg';
  capacity_kg?: number;
  tare_weight_kg?: number;
  valve_type?: string;
  status: 'active' | 'obsolete';
  barcode_uid?: string;
  requires_tag: boolean;
  created_at: string;
  // Product variant fields
  variant_type: 'cylinder' | 'refillable' | 'disposable';
  parent_product_id?: string; // null for parent products
  variant_name?: string; // 'full', 'empty', etc.
  is_variant: boolean; // true for variants, false for parents
  // Tax-related fields
  tax_category?: string;
  tax_rate?: number;
  // Derived fields for UI
  parent_product?: Product; // populated when fetching variants
  variants?: Product[]; // populated when fetching parent products
}

export interface CreateProductData {
  sku: string;
  name: string;
  description?: string;
  unit_of_measure: 'cylinder' | 'kg';
  capacity_kg?: number;
  tare_weight_kg?: number;
  valve_type?: string;
  status: 'active' | 'obsolete';
  barcode_uid?: string;
  requires_tag: boolean;
  // Product variant fields
  variant_type: 'cylinder' | 'refillable' | 'disposable';
  parent_product_id?: string;
  variant_name?: string;
  is_variant: boolean;
  // Tax-related fields
  tax_category?: string;
  tax_rate?: number;
}

export interface UpdateProductData extends Partial<CreateProductData> {
  id: string;
}

export interface ProductFilters {
  search?: string;
  status?: string;
  unit_of_measure?: string;
  page?: number;
  limit?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  show_obsolete?: boolean; // New filter to show/hide obsolete products
}

export interface ProductStats {
  total: number;
  active: number;
  obsolete: number;
  cylinders: number;
  kg_products: number;
}

// Product variant-specific interfaces
export interface ProductVariant {
  id: string;
  parent_product_id: string;
  variant_name: string;
  sku: string;
  name: string;
  status: 'active' | 'obsolete';
  created_at: string;
}

export interface CreateVariantData {
  parent_product_id: string;
  variant_name: string;
  sku: string;
  name: string;
  description?: string;
  status: 'active' | 'obsolete';
  barcode_uid?: string;
}

export interface ProductWithVariants extends Product {
  variants: Product[]; // Use full Product type for variants
  total_stock?: number; // sum of all variant stock
  available_stock?: number; // sum of available variant stock
}

// Inventory with variant support
export interface VariantInventory {
  product_id: string;
  variant_name: string;
  warehouse_id: string;
  qty_full: number;
  qty_empty: number;
  qty_reserved: number;
}