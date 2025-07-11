// schemas/input/customers-input.ts
import { z } from 'zod';

// Base schemas for reusability
export const AddressInputSchema = z.object({
  line1: z.string().min(1, 'Address line 1 is required'),
  line2: z.string().optional(),
  city: z.string().min(1, 'City is required'),
  state: z.string().optional(),
  postal_code: z.string().optional(),
  country: z.string().min(2, 'Country is required'),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  delivery_window_start: z.string().optional(),
  delivery_window_end: z.string().optional(),
  instructions: z.string().optional(),
});

// Customer filtering and pagination
export const CustomerFiltersSchema = z.object({
  search: z.string().optional(),
  account_status: z.enum(['active', 'credit_hold', 'closed']).optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(1000).default(50),
}).default({});

// Customer creation with required address
export const CreateCustomerSchema = z.object({
  external_id: z.string().optional(),
  name: z.string().min(1, 'Name is required'),
  tax_id: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  account_status: z.enum(['active', 'credit_hold', 'closed']).default('active'),
  credit_terms_days: z.number().int().min(0).default(30),
  address: AddressInputSchema,
});

// Customer update with optional address
export const UpdateCustomerSchema = z.object({
  id: z.string().uuid(),
  external_id: z.string().optional(),
  name: z.string().min(1).optional(),
  tax_id: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  account_status: z.enum(['active', 'credit_hold', 'closed']).optional(),
  credit_terms_days: z.number().int().min(0).optional(),
  address: AddressInputSchema.optional(),
});

// Customer ID parameter
export const CustomerIdSchema = z.object({
  customer_id: z.string().uuid(),
});

// Customer ID optional (for getById)
export const CustomerIdOptionalSchema = z.object({
  customer_id: z.string().uuid(),
}).optional();

// Customer deletion
export const DeleteCustomerSchema = z.object({
  customer_id: z.string().uuid(),
});

// Customer order history filters
export const CustomerOrderHistorySchema = z.object({
  customer_id: z.string().uuid(),
  limit: z.number().min(1).max(1000).default(50),
  offset: z.number().min(0).default(0),
  status: z.enum(['draft', 'confirmed', 'scheduled', 'en_route', 'delivered', 'invoiced', 'cancelled']).optional(),
}).optional();

// Customer analytics filters
export const CustomerAnalyticsSchema = z.object({
  customer_id: z.string().uuid(),
  period: z.enum(['month', 'quarter', 'year']).default('year'),
}).optional();

// Customer validation input
export const CustomerValidationSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  external_id: z.string().optional(),
  tax_id: z.string().optional(),
  exclude_id: z.string().uuid().optional(),
});

// Credit terms validation
export const CreditTermsValidationSchema = z.object({
  credit_terms_days: z.number(),
  account_status: z.enum(['active', 'credit_hold', 'closed']),
  customer_id: z.string().uuid().optional(),
});

// Address management schemas
export const AddressSchema = z.object({
  customer_id: z.string().uuid(),
  label: z.string().optional(),
  line1: z.string().min(1, 'Address line 1 is required'),
  line2: z.string().optional(),
  city: z.string().min(1, 'City is required'),
  state: z.string().optional(),
  postal_code: z.string().optional(),
  country: z.string().min(2, 'Country is required'),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  delivery_window_start: z.string().optional(),
  delivery_window_end: z.string().optional(),
  is_primary: z.boolean().default(false),
  instructions: z.string().optional(),
});

// Address update schema (with extra fields)
export const UpdateAddressSchema = z.object({
  address_id: z.string().uuid(),
  customer_id: z.string().uuid(),
  label: z.string().optional(),
  line1: z.string().optional(),
  line2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postal_code: z.string().optional(),
  country: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  delivery_window_start: z.string().optional(),
  delivery_window_end: z.string().optional(),
  is_primary: z.boolean().optional(),
  instructions: z.string().optional(),
  special_instructions: z.string().optional(),
  preferred_delivery_days: z.string().optional(),
  avoid_delivery_dates: z.string().optional(),
  access_code: z.string().optional(),
  gate_code: z.string().optional(),
});

// Address ID parameter
export const AddressIdSchema = z.object({
  address_id: z.string().uuid(),
});

// Set primary address
export const SetPrimaryAddressSchema = z.object({
  address_id: z.string().uuid(),
  customer_id: z.string().uuid(),
});

// Geocoding input
export const GeocodeAddressSchema = z.object({
  line1: z.string().min(1),
  line2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().optional(),
  country: z.string().min(2),
  postal_code: z.string().optional(),
});

// Address validation input
export const AddressValidationSchema = z.object({
  line1: z.string().min(1),
  line2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().optional(),
  country: z.string().min(2),
  postal_code: z.string().optional(),
});

// Delivery window validation
export const DeliveryWindowValidationSchema = z.object({
  delivery_window_start: z.string().optional(),
  delivery_window_end: z.string().optional(),
});

// Empty object for endpoints with no input
export const EmptyInputSchema = z.object({});

// Export types for TypeScript usage
export type CustomerFilters = z.infer<typeof CustomerFiltersSchema>;
export type CreateCustomer = z.infer<typeof CreateCustomerSchema>;
export type UpdateCustomer = z.infer<typeof UpdateCustomerSchema>;
export type CustomerValidation = z.infer<typeof CustomerValidationSchema>;
export type CreditTermsValidation = z.infer<typeof CreditTermsValidationSchema>;
export type AddressInput = z.infer<typeof AddressInputSchema>;
export type AddressCreate = z.infer<typeof AddressSchema>;
export type AddressUpdate = z.infer<typeof UpdateAddressSchema>;
export type GeocodeAddress = z.infer<typeof GeocodeAddressSchema>;
export type AddressValidation = z.infer<typeof AddressValidationSchema>;
export type DeliveryWindowValidation = z.infer<typeof DeliveryWindowValidationSchema>; 