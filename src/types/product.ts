export interface Product {
  id: string;
  sku: string;
  name: string;
  description?: string;
  unit_of_measure: 'cylinder' | 'kg' | 'unit';
  // Product type - NEW field to distinguish between cylinders and accessories
  product_type: 'cylinder' | 'accessory';
  // Cylinder-specific fields
  capacity_kg?: number;
  tare_weight_kg?: number;
  gross_weight_kg?: number;
  net_gas_weight_kg?: number; // computed field: gross_weight_kg - tare_weight_kg
  valve_type?: string;
  // Accessory-specific fields
  category_id?: string;
  is_serialized?: boolean;
  brand?: string;
  max_pressure?: number;
  wattage?: number;
  length_m?: number;
  connection_type?: string;
  outlet_pressure?: string;
  fuel_type?: string;
  // Common fields
  status: 'active' | 'obsolete';
  barcode_uid?: string;
  requires_tag: boolean;
  saleable?: boolean;
  created_at: string;
  updated_at?: string;
  // Product variant fields
  variant_type: 'cylinder' | 'refillable' | 'disposable';
  parent_products_id?: string; // null for parent products
  sku_variant?: SkuVariant; // 'EMPTY', 'FULL-XCH', etc.
  is_variant: boolean; // true for variants, false for parents
  has_variants?: boolean; // true for parent products that have variants
  // Tax-related fields
  tax_category?: string;
  tax_rate?: number;
  vat_code?: string;
  deposit_amount?: number;
  // Variant field for Outright/Refill
  variant?: 'outright' | 'refill';
  // Pricing method for weight-based pricing
  pricing_method?: 'per_unit' | 'per_kg' | 'flat_rate' | 'tiered';
  // Derived fields for UI
  parent_product?: Product; // populated when fetching variants
  variants?: Product[]; // populated when fetching parent products
}

export interface CreateProductData {
  sku: string;
  name: string;
  description?: string;
  unit_of_measure: 'cylinder' | 'kg' | 'unit';
  // Product type - NEW field to distinguish between cylinders and accessories
  product_type: 'cylinder' | 'accessory';
  // Cylinder-specific fields
  capacity_kg?: number;
  tare_weight_kg?: number;
  gross_weight_kg?: number;
  valve_type?: string;
  // Accessory-specific fields
  category_id?: string;
  is_serialized?: boolean;
  brand?: string;
  max_pressure?: number;
  wattage?: number;
  length_m?: number;
  connection_type?: string;
  outlet_pressure?: string;
  fuel_type?: string;
  // Common fields
  status: 'active' | 'obsolete';
  barcode_uid?: string;
  requires_tag: boolean;
  saleable?: boolean;
  // Product variant fields
  variant_type: 'cylinder' | 'refillable' | 'disposable';
  parent_products_id?: string;
  sku_variant?: SkuVariant;
  is_variant: boolean;
  has_variants?: boolean;
  // Tax-related fields
  tax_category?: string;
  tax_rate?: number;
  vat_code?: string;
  deposit_amount?: number;
  // Variant field for Outright/Refill
  variant?: 'outright' | 'refill';
  // Pricing method for weight-based pricing
  pricing_method?: 'per_unit' | 'per_kg' | 'flat_rate' | 'tiered';
}

export interface UpdateProductData extends Partial<CreateProductData> {
  id: string;
}

export interface ProductFilters {
  search?: string;
  status?: string;
  variant?: 'outright' | 'refill';
  pricing_method?: 'per_unit' | 'per_kg' | 'flat_rate' | 'tiered';
  product_type?: 'cylinder' | 'accessory'; // NEW filter for product type
  category_id?: string; // NEW filter for accessory categories
  is_variant?: boolean; // Filter for variants vs parent products
  parent_products_id?: string; // Filter variants by parent product ID
  sku_variant?: SkuVariant; // Filter by specific SKU variant
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
  accessories: number; // NEW - count of accessories
  kg_products: number;
}

// Product variant-specific interfaces
export interface ProductVariant {
  id: string;
  parent_products_id: string;
  sku_variant: SkuVariant;
  sku: string;
  name: string;
  status: 'active' | 'obsolete';
  created_at: string;
}

export interface CreateVariantData {
  parent_products_id: string;
  sku_variant: SkuVariant;
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

// New types for hierarchical product structure
export type SkuVariant = 'EMPTY' | 'FULL-XCH' | 'FULL-OUT' | 'DAMAGED';

export interface SkuVariantOption {
  value: SkuVariant;
  label: string;
  description?: string;
}

export interface ParentProduct {
  id: string;
  sku: string;
  name: string;
  description?: string;
  unit_of_measure: 'cylinder' | 'kg' | 'unit';
  // Product type - NEW field to distinguish between cylinders and accessories
  product_type?: 'cylinder' | 'accessory';
  // Cylinder-specific fields
  capacity_kg?: number;
  tare_weight_kg?: number;
  gross_weight_kg?: number;
  valve_type?: string;
  // Accessory-specific fields
  category_id?: string;
  is_serialized?: boolean;
  brand?: string;
  max_pressure?: number;
  wattage?: number;
  length_m?: number;
  connection_type?: string;
  outlet_pressure?: string;
  fuel_type?: string;
  // Common fields
  status: 'active' | 'obsolete';
  variant_type: 'cylinder' | 'refillable' | 'disposable';
  tax_category?: string;
  tax_rate?: number;
  vat_code?: string;
  deposit_amount?: number;
  variant?: 'outright' | 'refill';
  pricing_method: 'per_unit' | 'per_kg' | 'flat_rate' | 'tiered';
  created_at: string;
  updated_at: string;
}

export interface GroupedProduct {
  parent_product: ParentProduct;
  variants: Product[];
}

export interface GroupedProductsResponse {
  products: GroupedProduct[];
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CreateParentProductData {
  sku: string;
  name: string;
  description?: string;
  unit_of_measure: 'cylinder' | 'kg' | 'unit';
  // Product type - NEW field to distinguish between cylinders and accessories
  product_type: 'cylinder' | 'accessory';
  // Cylinder-specific fields
  capacity_kg?: number;
  tare_weight_kg?: number;
  gross_weight_kg?: number;
  valve_type?: string;
  // Accessory-specific fields
  category_id?: string;
  is_serialized?: boolean;
  brand?: string;
  max_pressure?: number;
  wattage?: number;
  length_m?: number;
  connection_type?: string;
  outlet_pressure?: string;
  fuel_type?: string;
  // Common fields
  status: 'active' | 'obsolete';
  variant_type: 'cylinder' | 'refillable' | 'disposable';
  tax_category?: string;
  tax_rate?: number;
  vat_code?: string;
  deposit_amount?: number;
  variant?: 'outright' | 'refill';
  pricing_method: 'per_unit' | 'per_kg' | 'flat_rate' | 'tiered';
}

export interface ParentProductsResponse {
  products: ParentProduct[];
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
}

// NEW - Accessory Category interfaces
export interface AccessoryCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

// NEW - Product Attribute interfaces
export interface ProductAttribute {
  id: string;
  product_id: string;
  attribute_id: string;
  value: string;
  created_at: string;
  updated_at: string;
}

export interface AttributeDefinition {
  id: string;
  attribute_set_id: string;
  name: string;
  key: string;
  data_type: 'text' | 'number' | 'date' | 'boolean';
  is_required: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface AttributeSet {
  id: string;
  name: string;
  product_type: 'cylinder' | 'accessory';
  created_at: string;
  updated_at: string;
}

// NEW - Helper interface for products with attributes
export interface ProductWithAttributes extends Product {
  attributes?: { [key: string]: string };
}

// NEW - Utility types for product type checking
export type CylinderProduct = Product & {
  product_type: 'cylinder';
  capacity_kg: number;
  tare_weight_kg: number;
  gross_weight_kg: number;
};

export type AccessoryProduct = Product & {
  product_type: 'accessory';
  category_id: string;
};

// NEW - Type guard functions
export const isCylinderProduct = (product: Product): product is CylinderProduct => {
  return product.product_type === 'cylinder';
};

export const isAccessoryProduct = (product: Product): product is AccessoryProduct => {
  return product.product_type === 'accessory';
};