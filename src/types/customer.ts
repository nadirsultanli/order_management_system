export interface Customer {
  id: string;
  external_id?: string;
  name: string;
  tax_id?: string;
  phone?: string;
  email?: string;
  account_status: 'active' | 'credit_hold' | 'closed';
  credit_terms_days: number;
  created_at: string;
  updated_at: string;
  primary_address?: {
    id: string;
    line1: string;
    line2?: string;
    city: string;
    state?: string;
    postal_code?: string;
    country: string;
    label?: string;
    latitude?: number;
    longitude?: number;
    delivery_window_start?: string;
    delivery_window_end?: string;
    is_primary: boolean;
    instructions?: string;
    created_at: string;
  };
}

export interface CreateCustomerAddressInput {
  label?: string;
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postal_code?: string;
  country: string;
  latitude?: number;
  longitude?: number;
  delivery_window_start?: string;
  delivery_window_end?: string;
  is_primary?: boolean;
  instructions?: string;
}

/**
 * When creating a customer, the address property is used for atomic creation of both customer and address via a transaction (RPC).
 * Address fields are NOT inserted into the customers table directly.
 */
export interface CreateCustomerData {
  external_id?: string;
  name: string;
  tax_id?: string;
  phone?: string;
  email?: string;
  account_status: 'active' | 'credit_hold' | 'closed';
  credit_terms_days: number;
  address: CreateCustomerAddressInput;
}

export interface UpdateCustomerData extends Partial<CreateCustomerData> {
  id: string;
}

export interface CustomerFilters {
  search?: string;
  account_status?: string;
  page?: number;
  limit?: number;
}