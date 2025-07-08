// Base types for deliveries and pickups
export interface DeliveryItem {
  id: string;
  delivery_id: string;
  product_id: string;
  quantity_delivered: number;
  quantity_returned: number;
  unit_price?: number;
  total_price?: number;
  notes?: string;
  created_at: string;
  product?: {
    id: string;
    name: string;
    sku: string;
  };
}

export interface PickupItem {
  id: string;
  pickup_id: string;
  product_id: string;
  quantity_picked_up: number;
  condition?: 'good' | 'damaged' | 'needs_repair';
  notes?: string;
  created_at: string;
  product?: {
    id: string;
    name: string;
    sku: string;
  };
}

export interface Delivery {
  id: string;
  delivery_number: string;
  order_id?: string;
  customer_id: string;
  delivery_address_id?: string;
  truck_id?: string;
  delivery_date: string;
  delivery_time?: string;
  status: 'pending' | 'in_transit' | 'delivered' | 'failed' | 'cancelled';
  driver_name?: string;
  driver_notes?: string;
  customer_signature?: string;
  photo_proof?: string;
  delivery_latitude?: number;
  delivery_longitude?: number;
  delivery_accuracy?: number;
  scheduled_at?: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
  created_by_user_id?: string;
  
  // Relations
  customer?: {
    id: string;
    name: string;
    phone?: string;
    email?: string;
  };
  delivery_address?: {
    id: string;
    line1: string;
    line2?: string;
    city: string;
    state?: string;
    postal_code: string;
  };
  truck?: {
    id: string;
    fleet_number: string;
    driver_name?: string;
  };
  items?: DeliveryItem[];
}

export interface Pickup {
  id: string;
  pickup_number: string;
  customer_id: string;
  pickup_address_id?: string;
  truck_id?: string;
  pickup_date: string;
  pickup_time?: string;
  status: 'pending' | 'in_transit' | 'completed' | 'failed' | 'cancelled';
  driver_name?: string;
  driver_notes?: string;
  customer_signature?: string;
  photo_proof?: string;
  pickup_latitude?: number;
  pickup_longitude?: number;
  pickup_accuracy?: number;
  scheduled_at?: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
  created_by_user_id?: string;
  
  // Relations
  customer?: {
    id: string;
    name: string;
    phone?: string;
    email?: string;
  };
  pickup_address?: {
    id: string;
    line1: string;
    line2?: string;
    city: string;
    state?: string;
    postal_code: string;
  };
  truck?: {
    id: string;
    fleet_number: string;
    driver_name?: string;
  };
  items?: PickupItem[];
}

// Customer balance types
export interface CustomerBalance {
  id: string;
  customer_id: string;
  product_id: string;
  cylinders_with_customer: number;
  cylinders_to_return: number;
  deposit_amount: number;
  credit_balance: number;
  last_transaction_date?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  
  // From view
  customer_name?: string;
  product_name?: string;
  product_sku?: string;
}

export interface CustomerTransaction {
  id: string;
  customer_id: string;
  product_id: string;
  transaction_type: 'delivery' | 'pickup' | 'exchange' | 'deposit' | 'refund' | 'adjustment';
  cylinders_delivered: number;
  cylinders_picked_up: number;
  amount: number;
  reference_type?: 'order' | 'delivery' | 'pickup' | 'manual';
  reference_id?: string;
  transaction_date: string;
  description?: string;
  notes?: string;
  created_by_user_id?: string;
  created_at: string;
  
  // Relations
  product?: {
    id: string;
    name: string;
    sku: string;
  };
}

// Input types for creating/processing
export interface ProcessDeliveryData {
  order_id?: string;
  customer_id: string;
  delivery_address_id?: string;
  truck_id: string;
  delivery_items: {
    product_id: string;
    quantity_delivered: number;
    quantity_returned?: number;
    unit_price?: number;
  }[];
  driver_name?: string;
  driver_notes?: string;
  delivery_latitude?: number;
  delivery_longitude?: number;
}

export interface ProcessPickupData {
  customer_id: string;
  pickup_address_id?: string;
  truck_id: string;
  pickup_items: {
    product_id: string;
    quantity_picked_up: number;
    condition?: 'good' | 'damaged' | 'needs_repair';
  }[];
  driver_name?: string;
  driver_notes?: string;
  pickup_latitude?: number;
  pickup_longitude?: number;
}

export interface CompleteDeliveryData {
  delivery_id: string;
  customer_signature?: string;
  photo_proof?: string;
  delivery_latitude?: number;
  delivery_longitude?: number;
}

export interface CompletePickupData {
  pickup_id: string;
  customer_signature?: string;
  photo_proof?: string;
  pickup_latitude?: number;
  pickup_longitude?: number;
}

// View types
export interface DeliveryView {
  id: string;
  delivery_number: string;
  order_id?: string;
  customer_id: string;
  delivery_address_id?: string;
  truck_id?: string;
  delivery_date: string;
  delivery_time?: string;
  status: 'pending' | 'in_transit' | 'delivered' | 'failed' | 'cancelled';
  driver_name?: string;
  driver_notes?: string;
  customer_signature?: string;
  photo_proof?: string;
  delivery_latitude?: number;
  delivery_longitude?: number;
  delivery_accuracy?: number;
  scheduled_at?: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
  created_by_user_id?: string;
  
  // View-specific fields
  customer_name: string;
  customer_phone?: string;
  delivery_address: string;
  truck_number?: string;
  item_count: number;
  total_delivered: number;
  total_returned: number;
}

export interface PickupView {
  id: string;
  pickup_number: string;
  customer_id: string;
  pickup_address_id?: string;
  truck_id?: string;
  pickup_date: string;
  pickup_time?: string;
  status: 'pending' | 'in_transit' | 'completed' | 'failed' | 'cancelled';
  driver_name?: string;
  driver_notes?: string;
  customer_signature?: string;
  photo_proof?: string;
  pickup_latitude?: number;
  pickup_longitude?: number;
  pickup_accuracy?: number;
  scheduled_at?: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
  created_by_user_id?: string;
  
  // View-specific fields
  customer_name: string;
  customer_phone?: string;
  pickup_address: string;
  truck_number?: string;
  item_count: number;
  total_picked_up: number;
} 