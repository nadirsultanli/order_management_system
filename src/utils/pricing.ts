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
    console.error('Failed to format currency:', error);
    // Fallback to local formatting
    return formatCurrencySync(amount, currencyCode);
  }
};

// Synchronous version for backward compatibility
export const formatCurrencySync = (amount: number, currencyCode: string = 'KES'): string => {
  const symbol = 'Ksh';
  const formattedAmount = amount.toLocaleString('en-KE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${symbol} ${formattedAmount}`;
};

export const calculateFinalPrice = async (unitPrice: number, surchargePercent?: number): Promise<number> => {
  try {
    const result = await trpc.pricing.calculateFinalPrice.query({ unitPrice, surchargePercent });
    return result.finalPrice;
  } catch (error) {
    console.error('Failed to calculate final price:', error);
    // Fallback to local calculation
    return calculateFinalPriceSync(unitPrice, surchargePercent);
  }
};

// Synchronous version for backward compatibility
export const calculateFinalPriceSync = (unitPrice: number, surchargePercent?: number): number => {
  if (!surchargePercent) return unitPrice;
  return unitPrice * (1 + surchargePercent / 100);
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
    console.error('Failed to get price list status:', error);
    // Fallback to local logic
    return getPriceListStatusSync(startDate, endDate);
  }
};

// Synchronous version for backward compatibility
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
    console.error('Failed to validate date range:', error);
    // Fallback to local logic
    return validateDateRangeSync(startDate, endDate);
  }
};

// Synchronous version for backward compatibility
export const validateDateRangeSync = (startDate: string, endDate?: string): boolean => {
  if (!endDate) return true;
  return new Date(startDate) <= new Date(endDate);
};

export const isExpiringSoon = async (endDate?: string, days: number = 30): Promise<boolean> => {
  try {
    const result = await trpc.pricing.isExpiringSoon.query({ endDate, days });
    return result.expiringSoon;
  } catch (error) {
    console.error('Failed to check if expiring soon:', error);
    // Fallback to local logic
    return isExpiringSoonSync(endDate, days);
  }
};

// Synchronous version for backward compatibility
export const isExpiringSoonSync = (endDate?: string, days: number = 30): boolean => {
  if (!endDate) return false;
  
  const today = new Date();
  const expiry = new Date(endDate);
  const daysUntilExpiry = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  
  return daysUntilExpiry <= days && daysUntilExpiry >= 0;
};