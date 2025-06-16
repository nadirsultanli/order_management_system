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
  delivery_window_start?: string;
  delivery_window_end?: string;
  is_primary?: boolean;
  instructions?: string;
}

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