import { TAX_CATEGORIES, TaxCategory } from '../types/pricing';

/**
 * Calculate tax amount from a base price and tax rate
 */
export const calculateTaxAmount = (basePrice: number, taxRate: number): number => {
  return Math.round((basePrice * taxRate) * 100) / 100;
};

/**
 * Calculate price including tax from base price and tax rate
 */
export const calculatePriceIncludingTax = (basePrice: number, taxRate: number): number => {
  return basePrice + calculateTaxAmount(basePrice, taxRate);
};

/**
 * Calculate base price from price including tax and tax rate
 */
export const calculateBasePriceFromInclusivePrice = (inclusivePrice: number, taxRate: number): number => {
  return Math.round((inclusivePrice / (1 + taxRate)) * 100) / 100;
};

/**
 * Get tax category information by ID
 */
export const getTaxCategory = (categoryId: string): TaxCategory | undefined => {
  return TAX_CATEGORIES.find(cat => cat.id === categoryId);
};

/**
 * Format tax rate as percentage string
 */
export const formatTaxRate = (taxRate: number): string => {
  return `${(taxRate * 100).toFixed(1)}%`;
};

/**
 * Get tax category display name
 */
export const getTaxCategoryDisplayName = (categoryId: string): string => {
  const category = getTaxCategory(categoryId);
  return category ? `${category.name} (${formatTaxRate(category.rate)})` : categoryId;
};

/**
 * Validate tax rate (should be between 0 and 1)
 */
export const isValidTaxRate = (taxRate: number): boolean => {
  return taxRate >= 0 && taxRate <= 1;
};

/**
 * Get default tax rate for Kenya (16% VAT)
 */
export const getDefaultTaxRate = (): number => {
  return 0.16;
};

/**
 * Calculate tax breakdown for an order line
 */
export interface TaxBreakdown {
  basePrice: number;
  taxAmount: number;
  totalPrice: number;
  taxRate: number;
  taxCategory: string;
}

export const calculateOrderLineTaxBreakdown = (
  quantity: number,
  unitPriceIncludingTax: number,
  taxRate: number,
  taxCategory: string = 'standard'
): TaxBreakdown => {
  const totalIncludingTax = quantity * unitPriceIncludingTax;
  const totalBasePrice = calculateBasePriceFromInclusivePrice(totalIncludingTax, taxRate);
  const totalTaxAmount = totalIncludingTax - totalBasePrice;

  return {
    basePrice: totalBasePrice,
    taxAmount: totalTaxAmount,
    totalPrice: totalIncludingTax,
    taxRate,
    taxCategory,
  };
}; 