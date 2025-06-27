// Consolidated API and data handling utilities

// Common ID validation
export const validateId = (id: string | undefined | null, fieldName = 'ID'): void => {
  if (!id || id === 'null' || id === 'undefined') {
    throw new Error(`Invalid ${fieldName} provided`);
  }
};

// Safe number parsing with defaults
export const safeParseNumber = (value: any, defaultValue = 0): number => {
  if (value === null || value === undefined || value === '') return defaultValue;
  const parsed = typeof value === 'string' ? parseFloat(value) : Number(value);
  return isNaN(parsed) ? defaultValue : parsed;
};

// Safe integer parsing with defaults
export const safeParseInt = (value: any, defaultValue = 0): number => {
  if (value === null || value === undefined || value === '') return defaultValue;
  const parsed = typeof value === 'string' ? parseInt(value, 10) : Math.floor(Number(value));
  return isNaN(parsed) ? defaultValue : parsed;
};

// Clean undefined/null values from objects before API calls
export const cleanObjectForAPI = <T extends Record<string, any>>(obj: T): Partial<T> => {
  const cleaned: Partial<T> = {};
  
  Object.entries(obj).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      (cleaned as any)[key] = value;
    }
  });
  
  return cleaned;
};

// Add timestamp fields for create operations
export const addCreateTimestamps = <T extends Record<string, any>>(data: T): T & {
  created_at: string;
  updated_at: string;
} => ({
  ...data,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
});

// Add update timestamp for update operations
export const addUpdateTimestamp = <T extends Record<string, any>>(data: T): T & {
  updated_at: string;
} => ({
  ...data,
  updated_at: new Date().toISOString()
});

// Convert string values to appropriate types based on schema
export const convertToTypedValues = <T extends Record<string, any>>(
  data: Record<string, any>,
  schema: Record<keyof T, 'string' | 'number' | 'boolean' | 'date'>
): Partial<T> => {
  const converted: Partial<T> = {};
  
  Object.entries(schema).forEach(([key, type]) => {
    const value = data[key];
    if (value === undefined || value === null || value === '') return;
    
    switch (type) {
      case 'number':
        (converted as any)[key] = safeParseNumber(value);
        break;
      case 'boolean':
        (converted as any)[key] = Boolean(value);
        break;
      case 'date':
        (converted as any)[key] = typeof value === 'string' ? value : new Date(value).toISOString();
        break;
      default:
        (converted as any)[key] = String(value);
    }
  });
  
  return converted;
};

// Calculate totals for order-like structures
export const calculateLineItemTotals = (
  lines: Array<{ quantity: number; unit_price: number; subtotal?: number }>
): {
  subtotal: number;
  itemCount: number;
  averagePrice: number;
} => {
  if (!lines || lines.length === 0) {
    return { subtotal: 0, itemCount: 0, averagePrice: 0 };
  }
  
  let subtotal = 0;
  let totalQuantity = 0;
  
  lines.forEach(line => {
    const lineTotal = line.subtotal || (line.quantity * line.unit_price);
    subtotal += lineTotal;
    totalQuantity += line.quantity;
  });
  
  return {
    subtotal,
    itemCount: totalQuantity,
    averagePrice: totalQuantity > 0 ? subtotal / totalQuantity : 0
  };
};

// Calculate tax and grand total
export const calculateOrderTotal = (
  subtotal: number,
  taxPercent: number = 0,
  taxAmount?: number
): {
  subtotal: number;
  taxAmount: number;
  grandTotal: number;
} => {
  const calculatedTaxAmount = taxAmount !== undefined ? taxAmount : (subtotal * taxPercent / 100);
  
  return {
    subtotal,
    taxAmount: calculatedTaxAmount,
    grandTotal: subtotal + calculatedTaxAmount
  };
};

// Sort arrays by multiple criteria
export const multiSort = <T>(
  array: T[],
  sortBy: Array<{
    key: keyof T;
    direction: 'asc' | 'desc';
  }>
): T[] => {
  return [...array].sort((a, b) => {
    for (const sort of sortBy) {
      const aVal = a[sort.key];
      const bVal = b[sort.key];
      
      let comparison = 0;
      if (aVal < bVal) comparison = -1;
      else if (aVal > bVal) comparison = 1;
      
      if (comparison !== 0) {
        return sort.direction === 'desc' ? -comparison : comparison;
      }
    }
    return 0;
  });
};

// Paginate arrays
export const paginateArray = <T>(
  array: T[],
  page: number,
  limit: number
): {
  items: T[];
  total: number;
  page: number;
  totalPages: number;
  hasMore: boolean;
} => {
  const start = (page - 1) * limit;
  const end = start + limit;
  const items = array.slice(start, end);
  
  return {
    items,
    total: array.length,
    page,
    totalPages: Math.ceil(array.length / limit),
    hasMore: end < array.length
  };
};

// Filter array by search terms
export const searchFilter = <T extends Record<string, any>>(
  items: T[],
  searchTerm: string,
  searchFields: (keyof T)[]
): T[] => {
  if (!searchTerm.trim()) return items;
  
  const term = searchTerm.toLowerCase();
  
  return items.filter(item =>
    searchFields.some(field => {
      const value = item[field];
      if (value === null || value === undefined) return false;
      return String(value).toLowerCase().includes(term);
    })
  );
};

// Group array by field
export const groupBy = <T extends Record<string, any>, K extends keyof T>(
  array: T[],
  key: K
): Record<string, T[]> => {
  return array.reduce((groups, item) => {
    const groupKey = String(item[key]);
    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(item);
    return groups;
  }, {} as Record<string, T[]>);
};

// Calculate statistics for numeric arrays
export const calculateStats = (numbers: number[]): {
  count: number;
  sum: number;
  average: number;
  min: number;
  max: number;
  median: number;
} => {
  if (numbers.length === 0) {
    return { count: 0, sum: 0, average: 0, min: 0, max: 0, median: 0 };
  }
  
  const sorted = [...numbers].sort((a, b) => a - b);
  const sum = numbers.reduce((acc, val) => acc + val, 0);
  const median = sorted.length % 2 === 0
    ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    : sorted[Math.floor(sorted.length / 2)];
  
  return {
    count: numbers.length,
    sum,
    average: sum / numbers.length,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    median
  };
};

// Debounce function for search inputs
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: number;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait) as any;
  };
};

// Check if value is empty (null, undefined, empty string, empty array)
export const isEmpty = (value: any): boolean => {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  if (Array.isArray(value) && value.length === 0) return true;
  if (typeof value === 'object' && Object.keys(value).length === 0) return true;
  return false;
};

// Generate unique keys for React components
export const generateKey = (prefix: string, index?: number, id?: string): string => {
  const parts = [prefix];
  if (id) parts.push(id);
  if (index !== undefined) parts.push(index.toString());
  parts.push(Date.now().toString(36));
  return parts.join('-');
};

// Common query parameter builders
export const buildQueryParams = (params: Record<string, any>): string => {
  const searchParams = new URLSearchParams();
  
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.append(key, String(value));
    }
  });
  
  const result = searchParams.toString();
  return result ? `?${result}` : '';
};

// Deep clone objects (simple version)
export const deepClone = <T>(obj: T): T => {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime()) as any;
  if (Array.isArray(obj)) return obj.map(deepClone) as any;
  
  const cloned = {} as T;
  Object.keys(obj).forEach(key => {
    (cloned as any)[key] = deepClone((obj as any)[key]);
  });
  
  return cloned;
}; 