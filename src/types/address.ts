export interface Address {
  id: string;
  customer_id: string;
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
  is_primary: boolean;
  instructions?: string;
  // Enhanced address management fields
  access_code?: string;
  gate_code?: string;
  special_instructions?: string;
  avoid_delivery_dates?: string[]; // Array of date strings (YYYY-MM-DD)
  preferred_delivery_time?: string; // Preferred time slot within delivery window
  delivery_notes?: string; // Specific delivery instructions
  contact_person?: string; // On-site contact person
  contact_phone?: string; // Contact phone for delivery
  building_type?: 'residential' | 'commercial' | 'industrial' | 'other';
  parking_instructions?: string;
  loading_dock_info?: string;
  security_requirements?: string;
  created_at: string;
}

export interface CreateAddressData {
  customer_id: string;
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
  is_primary: boolean;
  instructions?: string;
  // Enhanced address management fields
  access_code?: string;
  gate_code?: string;
  special_instructions?: string;
  avoid_delivery_dates?: string[];
  preferred_delivery_time?: string;
  delivery_notes?: string;
  contact_person?: string;
  contact_phone?: string;
  building_type?: 'residential' | 'commercial' | 'industrial' | 'other';
  parking_instructions?: string;
  loading_dock_info?: string;
  security_requirements?: string;
}

export interface UpdateAddressData extends Partial<CreateAddressData> {
  id: string;
}

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  formatted_address?: string;
}