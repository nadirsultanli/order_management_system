// schemas/customers-output.ts
import { z } from 'zod';

// Base address schema (what Supabase returns)
export const AddressOutputSchema = z.object({
  id: z.string().uuid(),
  customer_id: z.string().uuid(),
  label: z.string().nullable(),
  line1: z.string(),
  line2: z.string().nullable(),
  city: z.string(),
  state: z.string().nullable(),
  postal_code: z.string().nullable(),
  country: z.string(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  delivery_window_start: z.string().nullable(),
  delivery_window_end: z.string().nullable(),
  is_primary: z.boolean(),
  instructions: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string().optional(),  // Make optional since not always returned
});

// Base customer schema (what Supabase returns)
export const CustomerOutputSchema = z.object({
  id: z.string().uuid(),
  external_id: z.string().nullable(),
  name: z.string(),
  tax_id: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  account_status: z.enum(['active', 'credit_hold', 'closed']),
  credit_terms_days: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
});

// Customer with primary address (for joins)
export const CustomerWithAddressOutputSchema = CustomerOutputSchema.extend({
  primary_address: z.array(AddressOutputSchema).nullable(), // Supabase returns array from join
});

// Simplified customer for list view - matches actual return format
export const CustomerListItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  account_status: z.enum(['active', 'credit_hold', 'closed']),
  created_at: z.string(),
  primary_address: AddressOutputSchema.nullable(),  // Full address object or null (matches Supabase join)
});

// Customer statistics response
export const CustomerStatsOutputSchema = z.object({
  total: z.number(),
  active: z.number(),
  credit_hold: z.number(),
  closed: z.number(),
});

// Paginated customer list response
export const CustomerListOutputSchema = z.object({
  customers: z.array(CustomerListItemSchema),
  totalCount: z.number(),
  totalPages: z.number(),
  currentPage: z.number(),
});

// Full customer details response (for getById) - can have single address or null
export const CustomerDetailsOutputSchema = CustomerOutputSchema.extend({
  primary_address: AddressOutputSchema.nullable(),  // Single address or null
});

// Customer creation response - returns customer with single primary address
export const CustomerCreateOutputSchema = CustomerOutputSchema.extend({
  primary_address: AddressOutputSchema,  // Single address object, not array
});

// Customer update response
export const CustomerUpdateOutputSchema = CustomerOutputSchema;

// Validation response schema (reusable)
export const ValidationOutputSchema = z.object({
  valid: z.boolean(),
  errors: z.array(z.string()),
  warnings: z.array(z.string()),
});

// Order line schema (for order history)
export const OrderLineOutputSchema = z.object({
  id: z.string().uuid(),
  product_id: z.string().uuid(),
  quantity: z.number(),
  unit_price: z.number(),
  subtotal: z.number(),
  product: z.object({
    id: z.string().uuid(),
    sku: z.string(),
    name: z.string(),
    unit_of_measure: z.string(),
  }),
});

// Order schema (for order history)
export const OrderOutputSchema = z.object({
  id: z.string().uuid(),
  customer_id: z.string().uuid(),
  status: z.enum(['draft', 'confirmed', 'scheduled', 'en_route', 'delivered', 'invoiced', 'cancelled']),
  total_amount: z.number(),
  order_date: z.string(),
  created_at: z.string(),
  customer: z.object({
    id: z.string().uuid(),
    name: z.string(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
  }),
  delivery_address: AddressOutputSchema.nullable(),
  order_lines: z.array(OrderLineOutputSchema),
});

// Customer order history response
export const CustomerOrderHistoryOutputSchema = z.object({
  orders: z.array(OrderOutputSchema),
  totalCount: z.number(),
  hasMore: z.boolean(),
});

// Customer analytics response
export const CustomerAnalyticsOutputSchema = z.object({
  customer: z.object({
    id: z.string().uuid(),
    name: z.string(),
    created_at: z.string(),
  }),
  period: z.enum(['month', 'quarter', 'year']),
  analytics: z.object({
    totalOrders: z.number(),
    totalRevenue: z.number(),
    avgOrderValue: z.number(),
    statusCounts: z.record(z.string(), z.number()),
  }),
  recentOrders: z.array(z.object({
    id: z.string().uuid(),
    status: z.enum(['draft', 'confirmed', 'scheduled', 'en_route', 'delivered', 'invoiced', 'cancelled']),
    total_amount: z.number(),
    order_date: z.string(),
  })),
});

// Address list response
export const AddressListOutputSchema = z.array(AddressOutputSchema);

// Geocoding response
export const GeocodeOutputSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  formatted_address: z.string().optional(),
});

// Address validation response
export const AddressValidationOutputSchema = z.object({
  valid: z.boolean(),
  errors: z.array(z.string()),
  warnings: z.array(z.string()),
  geocode_result: GeocodeOutputSchema.nullable(),
});

// Success response (for delete operations)
export const SuccessOutputSchema = z.object({
  success: z.boolean(),
});

// Export type helpers
export type CustomerOutput = z.infer<typeof CustomerOutputSchema>;
export type CustomerWithAddressOutput = z.infer<typeof CustomerWithAddressOutputSchema>;
export type CustomerListItem = z.infer<typeof CustomerListItemSchema>;
export type CustomerStats = z.infer<typeof CustomerStatsOutputSchema>;
export type CustomerList = z.infer<typeof CustomerListOutputSchema>;
export type ValidationOutput = z.infer<typeof ValidationOutputSchema>;
export type CustomerOrderHistory = z.infer<typeof CustomerOrderHistoryOutputSchema>;
export type CustomerAnalytics = z.infer<typeof CustomerAnalyticsOutputSchema>;
export type AddressList = z.infer<typeof AddressListOutputSchema>;
export type GeocodeOutput = z.infer<typeof GeocodeOutputSchema>;
export type AddressValidation = z.infer<typeof AddressValidationOutputSchema>;
export type SuccessOutput = z.infer<typeof SuccessOutputSchema>;