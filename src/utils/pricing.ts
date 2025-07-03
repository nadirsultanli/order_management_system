import { CurrencyOption } from '../types/pricing';
import { trpc } from '../lib/trpc-client';

export const getCurrencyOptions = (): CurrencyOption[] => [
  { code: 'KES', name: 'Kenyan Shilling', symbol: 'Ksh' },
];

// Note: Business logic has been moved to backend.
// These functions now use backend APIs for consistency and centralized logic.

export const formatCurrency = async (amount: number, currencyCode: string = 'KES'): Promise<string> => {
  try {
    const result = await trpc.pricing.formatCurrency.mutate({ amount, currencyCode });
    return result.formatted;
  } catch (error) {
    console.error('Failed to format currency via API:', error);
    throw new Error('Currency formatting failed. Please try again.');
  }
};

// Removed local business logic to achieve 100% UI purity.
// Use formatCurrency() async function instead.

export const calculateFinalPrice = async (unitPrice: number, surchargePercent?: number): Promise<number> => {
  try {
    const result = await trpc.pricing.calculateFinalPrice.query({ unitPrice, surchargePercent });
    return result.finalPrice;
  } catch (error) {
    console.error('Failed to calculate final price via API:', error);
    throw new Error('Price calculation failed. Please try again.');
  }
};

// Removed local business logic to achieve 100% UI purity.
// Use calculateFinalPrice() async function instead.

export const formatDateRange = (startDate: string, endDate?: string): string => {
  const start = new Date(startDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  
  if (!endDate) return `${start} - Ongoing`;
  
  const end = new Date(endDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  
  return `${start} - ${end}`;
};

export const getPriceListStatus = async (startDate: string, endDate?: string): Promise<{
  status: 'active' | 'future' | 'expired';
  label: string;
  color: string;
}> => {
  try {
    return await trpc.pricing.getPriceListStatus.query({ startDate, endDate });
  } catch (error) {
    console.error('Failed to get price list status via API:', error);
    throw new Error('Price list status check failed. Please try again.');
  }
};

// Removed local business logic to achieve 100% UI purity.
// Use getPriceListStatus() async function instead.

export const validateDateRange = async (startDate: string, endDate?: string): Promise<boolean> => {
  try {
    const result = await trpc.pricing.validateDateRange.query({ startDate, endDate });
    return result.valid;
  } catch (error) {
    console.error('Failed to validate date range via API:', error);
    throw new Error('Date range validation failed. Please try again.');
  }
};

// Removed local business logic to achieve 100% UI purity.
// Use validateDateRange() async function instead.

export const isExpiringSoon = async (endDate?: string, days: number = 30): Promise<boolean> => {
  try {
    const result = await trpc.pricing.isExpiringSoon.query({ endDate, days });
    return result.expiringSoon;
  } catch (error) {
    console.error('Failed to check expiration status via API:', error);
    throw new Error('Expiration check failed. Please try again.');
  }
};

// Removed local business logic to achieve 100% UI purity.
// Use isExpiringSoon() async function instead.