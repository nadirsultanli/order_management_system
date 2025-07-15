export interface Product {
  id: string;
  sku: string;
  name: string;
  description?: string;
  unit_of_measure: 'cylinder' | 'kg';
  capacity_kg?: number;
  tare_weight_kg?: number;
  gross_weight_kg?: number;
  net_gas_weight_kg?: number; // computed field: gross_weight_kg - tare_weight_kg
  valve_type?: string;
  status: 'active' | 'obsolete';
  barcode_uid?: string;
  requires_tag: boolean;
  created_at: string;
  // Product variant fields
  variant_type: 'cylinder' | 'refillable' | 'disposable';
  parent_products_id?: string; // null for parent products
  sku_variant?: 'EMPTY' | 'FULL-XCH' | 'FULL-OUT' | 'DAMAGED'; // SKU variant type
  is_variant: boolean; // true for variants, false for parents
  // Tax-related fields
  tax_category?: string;
  tax_rate?: number;
  // Variant field for Outright/Refill
  variant?: 'outright' | 'refill';
  // Pricing method for weight-based pricing
  pricing_method: 'per_unit' | 'per_kg' | 'flat_rate' | 'tiered';
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
  gross_weight_kg?: number;
  valve_type?: string;
  status: 'active' | 'obsolete';
  barcode_uid?: string;
  requires_tag: boolean;
  // Product variant fields
  variant_type: 'cylinder' | 'refillable' | 'disposable';
  parent_products_id?: string;
  sku_variant?: 'EMPTY' | 'FULL-XCH' | 'FULL-OUT' | 'DAMAGED';
  is_variant: boolean;
  // Tax-related fields
  tax_category?: string;
  tax_rate?: number;
  // Variant field for Outright/Refill
  variant?: 'outright' | 'refill';
  // Pricing method for weight-based pricing
  pricing_method: 'per_unit' | 'per_kg' | 'flat_rate' | 'tiered';
}

export interface UpdateProductData extends Partial<CreateProductData> {
  id: string;
}

export interface ProductFilters {
  search?: string;
  status?: string;
  variant?: 'outright' | 'refill';
  pricing_method?: 'per_unit' | 'per_kg' | 'flat_rate' | 'tiered';
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
  parent_products_id: string;
  sku_variant: 'EMPTY' | 'FULL-XCH' | 'FULL-OUT' | 'DAMAGED';
  sku: string;
  name: string;
  status: 'active' | 'obsolete';
  created_at: string;
}

export interface CreateVariantData {
  parent_products_id: string;
  sku_variant: 'EMPTY' | 'FULL-XCH' | 'FULL-OUT' | 'DAMAGED';
  name: string;
  description?: string;
  status: 'active' | 'obsolete';
  barcode_uid?: string;
  // SKU will be auto-generated as {parent_sku}-{sku_variant}
}

export interface ProductWithVariants extends Product {
  variants: Product[]; // Use full Product type for variants
  total_stock?: number; // sum of all variant stock
  available_stock?: number; // sum of available variant stock
}

// Inventory with variant support
export interface VariantInventory {
  product_id: string;
  sku_variant: 'EMPTY' | 'FULL-XCH' | 'FULL-OUT' | 'DAMAGED';
  warehouse_id: string;
  qty_full: number;
  qty_empty: number;
  qty_reserved: number;
}

// ============ New Hierarchical Parent-Child Types ============

export type SkuVariant = 'EMPTY' | 'FULL-XCH' | 'FULL-OUT' | 'DAMAGED';

export interface SkuVariantOption {
  value: SkuVariant;
  label: string;
  description: string;
}

export interface ParentProduct {
  id: string;
  sku: string;
  name: string;
  description?: string;
  unit_of_measure: 'cylinder' | 'kg';
  capacity_kg?: number;
  tare_weight_kg?: number;
  valve_type?: string;
  status: 'active' | 'obsolete';
  variant_type: 'cylinder' | 'refillable' | 'disposable';
  requires_tag: boolean;
  tax_category?: string;
  tax_rate?: number;
  created_at: string;
  variant_count: number;
}

export interface GroupedProduct {
  parent: ParentProduct;
  variants: Product[];
}

export interface GroupedProductsResponse {
  grouped_products: GroupedProduct[];
  summary: {
    total_parent_products: number;
    total_variants: number;
    active_parent_products: number;
    active_variants: number;
  };
}

export interface CreateParentProductData {
  sku: string;
  name: string;
  description?: string;
  unit_of_measure: 'cylinder' | 'kg';
  capacity_kg?: number;
  tare_weight_kg?: number;
  valve_type?: string;
  status: 'active' | 'obsolete';
  variant_type: 'cylinder' | 'refillable' | 'disposable';
  requires_tag: boolean;
  tax_category?: string;
  tax_rate?: number;
}

export interface ParentProductsResponse {
  parent_products: ParentProduct[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
}