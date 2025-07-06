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

// Synchronous fallback for backward compatibility
export const formatCurrencySync = (amount: number, currencyCode: string = 'KES'): string => {
  const currency = getCurrencyOptions().find(c => c.code === currencyCode);
  const symbol = currency?.symbol || 'Ksh';
  return `${symbol} ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const calculateFinalPrice = async (unitPrice: number, surchargePercent?: number): Promise<number> => {
  try {
    const result = await trpc.pricing.calculateFinalPrice.query({ unitPrice, surchargePercent });
    return result.finalPrice;
  } catch (error) {
    console.error('Failed to calculate final price via API:', error);
    throw new Error('Price calculation failed. Please try again.');
  }
};

// UI-only calculation for display purposes
export const calculateFinalPriceSync = (unitPrice: number, surchargePercent?: number): number => {
  // Calculate final price with surcharge for UI display
  const surcharge = surchargePercent ? (unitPrice * surchargePercent / 100) : 0;
  return unitPrice + surcharge;
};

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

// Synchronous fallback for backward compatibility
export const getPriceListStatusSync = (startDate: string, endDate?: string): {
  status: 'active' | 'future' | 'expired';
  label: string;
  color: string;
} => {
  const today = new Date().toISOString().split('T')[0];
  
  if (startDate > today) {
    return {
      status: 'future',
      label: 'Future',
      color: 'bg-blue-100 text-blue-800 border-blue-200',
    };
  }
  
  if (endDate && endDate < today) {
    return {
      status: 'expired',
      label: 'Expired',
      color: 'bg-red-100 text-red-800 border-red-200',
    };
  }
  
  return {
    status: 'active',
    label: 'Active',
    color: 'bg-green-100 text-green-800 border-green-200',
  };
};

export const validateDateRange = async (startDate: string, endDate?: string): Promise<boolean> => {
  try {
    const result = await trpc.pricing.validateDateRange.query({ startDate, endDate });
    return result.valid;
  } catch (error) {
    console.error('Failed to validate date range via API:', error);
    throw new Error('Date range validation failed. Please try again.');
  }
};

// Synchronous fallback for immediate validation in forms
export const validateDateRangeSync = (startDate: string, endDate?: string): boolean => {
  if (!endDate) return true;
  return new Date(startDate) <= new Date(endDate);
};

export const isExpiringSoon = async (endDate?: string, days: number = 30): Promise<boolean> => {
  try {
    const result = await trpc.pricing.isExpiringSoon.query({ endDate, days });
    return result.expiringSoon;
  } catch (error) {
    console.error('Failed to check expiration status via API:', error);
    throw new Error('Expiration check failed. Please try again.');
  }
};

// Synchronous fallback for backward compatibility
export const isExpiringSoonSync = (endDate?: string, days: number = 30): boolean => {
  if (!endDate) return false;
  
  const today = new Date();
  const expiry = new Date(endDate);
  const daysUntilExpiry = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  
  return daysUntilExpiry <= days && daysUntilExpiry >= 0;
};