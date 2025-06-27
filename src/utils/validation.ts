// Consolidated form validation utilities

export interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  min?: number;
  max?: number;
  custom?: (value: any) => string | null;
}

export interface ValidationSchema {
  [fieldName: string]: ValidationRule;
}

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

// Generic validation function
export const validateField = (value: any, rule: ValidationRule, fieldName: string): string | null => {
  // Required check
  if (rule.required && (value === undefined || value === null || value === '')) {
    return `${fieldName} is required`;
  }

  // Skip other validations if value is empty and not required
  if (!rule.required && (value === undefined || value === null || value === '')) {
    return null;
  }

  // String validations
  if (typeof value === 'string') {
    if (rule.minLength && value.length < rule.minLength) {
      return `${fieldName} must be at least ${rule.minLength} characters`;
    }
    if (rule.maxLength && value.length > rule.maxLength) {
      return `${fieldName} must be no more than ${rule.maxLength} characters`;
    }
    if (rule.pattern && !rule.pattern.test(value)) {
      return `${fieldName} format is invalid`;
    }
  }

  // Number validations
  if (typeof value === 'number') {
    if (rule.min !== undefined && value < rule.min) {
      return `${fieldName} must be at least ${rule.min}`;
    }
    if (rule.max !== undefined && value > rule.max) {
      return `${fieldName} must be no more than ${rule.max}`;
    }
  }

  // Custom validation
  if (rule.custom) {
    return rule.custom(value);
  }

  return null;
};

// Validate entire form data against schema
export const validateForm = (data: Record<string, any>, schema: ValidationSchema): ValidationResult => {
  const errors: Record<string, string> = {};

  Object.entries(schema).forEach(([fieldName, rule]) => {
    const error = validateField(data[fieldName], rule, fieldName);
    if (error) {
      errors[fieldName] = error;
    }
  });

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

// Common validation patterns
export const validationPatterns = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  phone: /^\+?[\d\s-()]+$/,
  postalCode: /^[\w\s-]+$/,
  sku: /^[A-Za-z0-9-_]+$/,
  licensePlate: /^[A-Za-z0-9\s-]+$/,
  currency: /^\d+(\.\d{1,2})?$/,
};

// Pre-built validation schemas for common entities
export const customerValidationSchema: ValidationSchema = {
  name: { required: true, minLength: 2, maxLength: 100 },
  email: { pattern: validationPatterns.email },
  phone: { pattern: validationPatterns.phone },
  tax_id: { maxLength: 50 },
  credit_terms_days: { min: 0, max: 365 }
};

export const productValidationSchema: ValidationSchema = {
  sku: { required: true, pattern: validationPatterns.sku, maxLength: 50 },
  name: { required: true, minLength: 2, maxLength: 100 },
  description: { maxLength: 500 },
  capacity_kg: { min: 0, max: 1000 },
  tare_weight_kg: { min: 0, max: 100 },
  valve_type: { maxLength: 50 }
};

export const addressValidationSchema: ValidationSchema = {
  label: { maxLength: 50 },
  line1: { required: true, maxLength: 100 },
  line2: { maxLength: 100 },
  city: { required: true, maxLength: 50 },
  state: { maxLength: 50 },
  postal_code: { required: true, pattern: validationPatterns.postalCode, maxLength: 20 },
  instructions: { maxLength: 200 }
};

export const warehouseValidationSchema: ValidationSchema = {
  name: { required: true, minLength: 2, maxLength: 100 },
  capacity_cylinders: { min: 0, max: 100000 }
};

export const orderValidationSchema: ValidationSchema = {
  customer_id: { required: true },
  delivery_address_id: { required: true },
  order_date: { required: true },
  tax_percent: { min: 0, max: 100 },
  notes: { maxLength: 500 }
};

export const truckValidationSchema: ValidationSchema = {
  fleet_number: { required: true, maxLength: 20 },
  license_plate: { required: true, pattern: validationPatterns.licensePlate, maxLength: 20 },
  capacity_cylinders: { required: true, min: 1, max: 1000 },
  driver_name: { maxLength: 100 }
};

export const priceListValidationSchema: ValidationSchema = {
  name: { required: true, minLength: 2, maxLength: 100 },
  description: { maxLength: 500 },
  start_date: { required: true },
  currency_code: { required: true, minLength: 3, maxLength: 3 }
};

export const priceListItemValidationSchema: ValidationSchema = {
  product_id: { required: true },
  unit_price: { required: true, min: 0 },
  min_qty: { min: 1, max: 10000 },
  surcharge_pct: { min: 0, max: 100 }
};

// Helper functions for specific validations
export const validateQuantity = (value: number, fieldName = 'Quantity'): string | null => {
  if (value < 0) return `${fieldName} cannot be negative`;
  if (!Number.isInteger(value)) return `${fieldName} must be a whole number`;
  return null;
};

export const validateCurrency = (value: string | number, fieldName = 'Amount'): string | null => {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(numValue)) return `${fieldName} must be a valid number`;
  if (numValue < 0) return `${fieldName} cannot be negative`;
  if (numValue > 999999.99) return `${fieldName} is too large`;
  return null;
};

export const validateDateRange = (startDate: string, endDate: string): string | null => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  if (start >= end) {
    return 'End date must be after start date';
  }
  return null;
};

export const validateTimeWindow = (startTime?: string, endTime?: string): string | null => {
  if (!startTime || !endTime) return null;
  
  const start = new Date(`2000-01-01 ${startTime}`);
  const end = new Date(`2000-01-01 ${endTime}`);
  
  if (start >= end) {
    return 'End time must be after start time';
  }
  return null;
};

export const validateInventoryTransfer = (fromQty: number, transferQty: number): string | null => {
  if (transferQty <= 0) return 'Transfer quantity must be greater than 0';
  if (transferQty > fromQty) return 'Cannot transfer more than available quantity';
  return null;
};

// React Hook Form integration helper
export const createFormValidator = (schema: ValidationSchema) => {
  return (data: Record<string, any>) => {
    const result = validateForm(data, schema);
    return result.isValid ? true : result.errors;
  };
}; 