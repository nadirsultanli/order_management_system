// ============ BRAND MANAGEMENT TYPES ============

export interface GasBrand {
  id: string;
  name: string;
  code: string;
  color: string;
  logo_url?: string;
  is_generic: boolean;
  exchange_fee?: number;
  country_code?: string;
  description?: string;
}

export interface BrandReconciliation {
  id: string;
  original_brand: string;
  accepted_brand: string;
  exchange_fee: number;
  exchange_rate: number;
  currency_code: string;
  created_at: string;
  created_by: string;
  notes?: string;
}

export interface BrandBalance {
  brand_code: string;
  brand_name: string;
  cylinders_given: number;
  cylinders_received: number;
  net_balance: number;
  capacity_l: number;
  pending_reconciliation: number;
  last_updated: string;
}

export interface BrandReconciliationSummary {
  period: {
    from_date: string;
    to_date: string;
  };
  brand_balances: BrandBalance[];
  total_exchange_fees: number;
  pending_reconciliations: number;
  currency_code: string;
}

export interface BrandExchangeTransaction {
  id: string;
  from_brand: string;
  to_brand: string;
  quantity: number;
  capacity_l: number;
  exchange_fee: number;
  transaction_date: string;
  customer_id: string;
  order_id: string;
  empty_return_credit_id: string;
  reconciliation_status: 'pending' | 'matched' | 'generic_accepted';
  notes?: string;
}

// ============ BRAND CONSTANTS ============

export const GAS_BRANDS: GasBrand[] = [
  {
    id: 'total',
    name: 'Total',
    code: 'TOTAL',
    color: '#D50000',
    is_generic: false,
    exchange_fee: 50,
    country_code: 'KE',
    description: 'Total Kenya Limited'
  },
  {
    id: 'shell',
    name: 'Shell',
    code: 'SHELL',
    color: '#FFEB3B',
    is_generic: false,
    exchange_fee: 50,
    country_code: 'KE',
    description: 'Shell Gas Kenya'
  },
  {
    id: 'petrogas',
    name: 'Petrogas',
    code: 'PETROGAS',
    color: '#4CAF50',
    is_generic: false,
    exchange_fee: 50,
    country_code: 'KE',
    description: 'Petrogas East Africa'
  },
  {
    id: 'oil_libya',
    name: 'Oil Libya',
    code: 'OIL_LIBYA',
    color: '#2196F3',
    is_generic: false,
    exchange_fee: 50,
    country_code: 'KE',
    description: 'Oil Libya Kenya'
  },
  {
    id: 'kenol_kobil',
    name: 'Kenol Kobil',
    code: 'KENOL_KOBIL',
    color: '#FF5722',
    is_generic: false,
    exchange_fee: 50,
    country_code: 'KE',
    description: 'Kenol Kobil Limited'
  },
  {
    id: 'rubis',
    name: 'Rubis',
    code: 'RUBIS',
    color: '#E91E63',
    is_generic: false,
    exchange_fee: 50,
    country_code: 'KE',
    description: 'Rubis Energy Kenya'
  },
  {
    id: 'gas_plus',
    name: 'Gas Plus',
    code: 'GAS_PLUS',
    color: '#9C27B0',
    is_generic: false,
    exchange_fee: 50,
    country_code: 'KE',
    description: 'Gas Plus Kenya'
  },
  {
    id: 'lake_gas',
    name: 'Lake Gas',
    code: 'LAKE_GAS',
    color: '#00BCD4',
    is_generic: false,
    exchange_fee: 50,
    country_code: 'KE',
    description: 'Lake Gas Limited'
  },
  {
    id: 'african_gas',
    name: 'African Gas',
    code: 'AFRICAN_GAS',
    color: '#795548',
    is_generic: false,
    exchange_fee: 50,
    country_code: 'KE',
    description: 'African Gas & Oil Limited'
  },
  {
    id: 'pro_gas',
    name: 'Pro Gas',
    code: 'PRO_GAS',
    color: '#607D8B',
    is_generic: false,
    exchange_fee: 50,
    country_code: 'KE',
    description: 'Pro Gas Kenya'
  },
  {
    id: 'generic',
    name: 'Generic/Unbranded',
    code: 'GENERIC',
    color: '#9E9E9E',
    is_generic: true,
    exchange_fee: 0,
    description: 'Generic or unbranded cylinders'
  },
  {
    id: 'unknown',
    name: 'Unknown Brand',
    code: 'UNKNOWN',
    color: '#424242',
    is_generic: true,
    exchange_fee: 100,
    description: 'Brand not identified or unclear markings'
  }
];

export const BRAND_RECONCILIATION_STATUSES = [
  { 
    value: 'pending', 
    label: 'Pending Reconciliation', 
    color: 'text-yellow-600',
    description: 'Cross-brand exchange pending reconciliation'
  },
  { 
    value: 'matched', 
    label: 'Matched', 
    color: 'text-green-600',
    description: 'Brands match, no reconciliation needed'
  },
  { 
    value: 'generic_accepted', 
    label: 'Generic Accepted', 
    color: 'text-blue-600',
    description: 'Generic cylinder accepted without brand reconciliation'
  }
] as const;

export const EXCHANGE_FEE_REASONS = [
  { value: 'brand_mismatch', label: 'Brand Mismatch', default_fee: 50 },
  { value: 'unknown_brand', label: 'Unknown Brand', default_fee: 100 },
  { value: 'damaged_marking', label: 'Damaged Brand Marking', default_fee: 75 },
  { value: 'generic_acceptance', label: 'Generic Cylinder Acceptance', default_fee: 0 },
  { value: 'administrative', label: 'Administrative Fee', default_fee: 25 },
] as const;

// ============ UTILITY FUNCTIONS ============

export const getBrandByCode = (code: string): GasBrand | undefined => {
  return GAS_BRANDS.find(brand => brand.code === code);
};

export const getBrandById = (id: string): GasBrand | undefined => {
  return GAS_BRANDS.find(brand => brand.id === id);
};

export const getBrandOptions = (includeGeneric: boolean = true) => {
  return GAS_BRANDS
    .filter(brand => includeGeneric || !brand.is_generic)
    .map(brand => ({
      value: brand.code,
      label: brand.name,
      color: brand.color
    }));
};

export const calculateExchangeFee = (
  originalBrand: string, 
  acceptedBrand: string, 
  quantity: number = 1
): number => {
  if (originalBrand === acceptedBrand) return 0;
  
  const originalBrandData = getBrandByCode(originalBrand);
  const acceptedBrandData = getBrandByCode(acceptedBrand);
  
  // If either brand is generic, use lower fee
  if (originalBrandData?.is_generic || acceptedBrandData?.is_generic) {
    return Math.min(
      originalBrandData?.exchange_fee || 0,
      acceptedBrandData?.exchange_fee || 0
    ) * quantity;
  }
  
  // For brand-to-brand exchange, use higher fee
  return Math.max(
    originalBrandData?.exchange_fee || 50,
    acceptedBrandData?.exchange_fee || 50
  ) * quantity;
};

export const getBrandReconciliationStatus = (
  originalBrand: string,
  acceptedBrand: string
): 'pending' | 'matched' | 'generic_accepted' => {
  if (originalBrand === acceptedBrand) return 'matched';
  
  const acceptedBrandData = getBrandByCode(acceptedBrand);
  if (acceptedBrandData?.is_generic) return 'generic_accepted';
  
  return 'pending';
};

export const formatBrandName = (brandCode: string): string => {
  const brand = getBrandByCode(brandCode);
  return brand?.name || brandCode;
};

export const getBrandColor = (brandCode: string): string => {
  const brand = getBrandByCode(brandCode);
  return brand?.color || '#9E9E9E';
};

// ============ VALIDATION FUNCTIONS ============

export const isValidBrandCode = (code: string): boolean => {
  return GAS_BRANDS.some(brand => brand.code === code);
};

export const requiresBrandReconciliation = (
  originalBrand: string,
  acceptedBrand: string
): boolean => {
  if (originalBrand === acceptedBrand) return false;
  
  const acceptedBrandData = getBrandByCode(acceptedBrand);
  return !acceptedBrandData?.is_generic;
};

export const getBrandExchangePolicy = (brandCode: string) => {
  const brand = getBrandByCode(brandCode);
  if (!brand) return null;
  
  return {
    accepts_other_brands: !brand.is_generic,
    exchange_fee: brand.exchange_fee || 0,
    requires_reconciliation: !brand.is_generic
  };
};