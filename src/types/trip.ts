export interface Trip {
  id: string;
  truck_id: string;
  driver_id?: string;
  driver_name?: string;
  route_date: string; // Changed from trip_date to match backend
  planned_start_time?: string;
  actual_start_time?: string;
  planned_end_time?: string;
  actual_end_time?: string;
  route_status: 'planned' | 'unloaded' | 'loaded' | 'in_transit' | 'completed' | 'cancelled'; // Updated to match backend
  total_distance_km?: number;
  estimated_duration_hours?: number;
  actual_duration_hours?: number;
  fuel_used_liters?: number;
  trip_notes?: string; // Changed from notes to trip_notes
  created_at: string;
  updated_at: string;
  created_by_user_id?: string;
  
  // Populated fields
  truck?: {
    id: string;
    fleet_number: string;
    license_plate: string;
    capacity_cylinders: number;
    capacity_kg: number;
    driver_name?: string;
  };
  
  // Backend returns truck_allocations instead of trip_orders
  truck_allocations?: any[];
}

export interface TripOrder {
  id: string;
  trip_id: string;
  order_id: string;
  stop_sequence: number;
  estimated_weight_kg: number;
  actual_weight_kg?: number;
  loading_status: 'pending' | 'loaded' | 'short_loaded' | 'not_loaded';
  loading_notes?: string;
  delivery_status: 'pending' | 'delivered' | 'failed' | 'cancelled';
  delivery_notes?: string;
  created_at: string;
  updated_at: string;
  
  // Populated fields
  order?: {
    id: string;
    customer_id: string;
    order_date: string;
    scheduled_date?: string;
    status: string;
    total_amount?: number;
    order_type: string;
    customer?: {
      name: string;
      phone?: string;
    };
    delivery_address?: {
      line1: string;
      city: string;
      postal_code?: string;
    };
    order_items?: TripOrderItem[];
  };
}

export interface TripOrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  unit_weight_kg?: number;
  total_weight_kg?: number;
  loaded_quantity?: number;
  short_load_reason?: string;
  
  // Populated fields
  product?: {
    id: string;
    sku: string;
    name: string;
    variant_name?: string;
    is_variant: boolean;
  };
}

export interface TripWithDetails extends Trip {
  truck_allocations: any[]; // Changed from trip_orders to truck_allocations
  capacity_info: TripCapacityInfo;
  loading_progress: TripLoadingProgress;
}

export interface TripCapacityInfo {
  trip_id: string;
  total_capacity_kg: number;
  total_capacity_cylinders: number;
  allocated_weight_kg: number;
  allocated_cylinders: number;
  available_weight_kg: number;
  available_cylinders: number;
  utilization_percentage: number;
  orders_count: number;
  is_overallocated: boolean;
  short_loading_warnings: ShortLoadingWarning[];
}

export interface ShortLoadingWarning {
  order_id: string;
  customer_name: string;
  product_name: string;
  requested_quantity: number;
  available_quantity: number;
  shortage: number;
  reason: 'insufficient_inventory' | 'capacity_limit' | 'weight_limit';
}

export interface TripLoadingProgress {
  trip_id: string;
  total_orders: number;
  orders_loaded: number;
  orders_short_loaded: number;
  orders_not_loaded: number;
  total_weight_required: number;
  total_weight_loaded: number;
  total_cylinders_required: number;
  total_cylinders_loaded: number;
  completion_percentage: number;
  loading_status: 'not_started' | 'in_progress' | 'completed' | 'completed_with_shorts';
}

export interface LoadingAction {
  trip_order_id: string;
  product_id: string;
  quantity_to_load: number;
  actual_weight_kg?: number;
  notes?: string;
}

export interface TripTimelineEntry {
  id: string;
  trip_id: string;
  event_type: 'created' | 'planned' | 'loading_started' | 'loading_completed' | 'departed' | 'arrived' | 'delivered' | 'completed' | 'cancelled';
  event_description: string;
  event_timestamp: string;
  user_id?: string;
  metadata?: Record<string, any>;
  
  // Populated fields
  user?: {
    id: string;
    name: string;
  };
}

export interface DailyTripSchedule {
  date: string;
  trips: TripWithDetails[];
  summary: TripScheduleSummary;
}

export interface TripScheduleSummary {
  date: string;
  total_trips: number;
  active_trips: number;
  completed_trips: number;
  cancelled_trips: number;
  total_orders: number;
  total_weight_kg: number;
  avg_utilization: number;
  on_time_deliveries: number;
  delayed_deliveries: number;
}

export interface TripMetrics {
  trip_id: string;
  fleet_number: string;
  trip_date: string;
  
  // Loading metrics
  loading_efficiency: number; // percentage of successful loads
  short_load_rate: number; // percentage of short loads
  loading_time_minutes: number;
  
  // Delivery metrics
  total_deliveries: number;
  successful_deliveries: number;
  failed_deliveries: number;
  on_time_deliveries: number;
  delivery_success_rate: number;
  
  // Efficiency metrics
  distance_traveled_km: number;
  fuel_efficiency: number; // km per liter
  capacity_utilization: number; // percentage
  time_efficiency: number; // actual vs planned time
  
  // Customer satisfaction
  delivery_rating?: number;
  customer_complaints: number;
}

// Enums for better type safety
export const TripStatus = {
  DRAFT: 'draft',
  PLANNED: 'planned',
  UNLOADED: 'unloaded',
  IN_TRANSIT: 'in_transit',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
} as const;

export const LoadingStatus = {
  PENDING: 'pending',
  LOADED: 'loaded',
  SHORT_LOADED: 'short_loaded',
  NOT_LOADED: 'not_loaded'
} as const;

export const DeliveryStatus = {
  PENDING: 'pending',
  DELIVERED: 'delivered',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
} as const;

export const TripEventType = {
  CREATED: 'created',
  PLANNED: 'planned',
  LOADING_STARTED: 'loading_started',
  LOADING_COMPLETED: 'loading_completed',
  DEPARTED: 'departed',
  ARRIVED: 'arrived',
  DELIVERED: 'delivered',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
} as const;

// Filter types
export interface TripFilters {
  search?: string; // Search by trip ID, truck fleet number, driver name
  status?: 'planned' | 'unloaded' | 'loaded' | 'in_transit' | 'completed' | 'cancelled';
  truck_id?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
  sort_by?: 'trip_date' | 'created_at' | 'status' | 'truck_fleet_number';
  sort_order?: 'asc' | 'desc';
}

export interface TripOrderFilters {
  trip_id?: string;
  loading_status?: 'pending' | 'loaded' | 'short_loaded' | 'not_loaded';
  delivery_status?: 'pending' | 'delivered' | 'failed' | 'cancelled';
  customer_id?: string;
  page?: number;
  limit?: number;
}

// API Request/Response types
export interface CreateTripData {
  truck_id: string;
  driver_name?: string;
  trip_date: string;
  planned_start_time?: string;
  planned_end_time?: string;
  estimated_duration_hours?: number;
  notes?: string;
  order_ids: string[]; // Orders to assign to this trip
}

export interface UpdateTripData {
  driver_name?: string;
  route_date?: string; // Changed from trip_date
  planned_start_time?: string;
  actual_start_time?: string;
  planned_end_time?: string;
  actual_end_time?: string;
  route_status?: 'planned' | 'unloaded' | 'loaded' | 'in_transit' | 'completed' | 'cancelled'; // Updated to match backend
  total_distance_km?: number;
  actual_duration_hours?: number;
  fuel_used_liters?: number;
  trip_notes?: string; // Changed from notes
}

export interface TripAllocationRequest {
  trip_id: string;
  order_ids: string[];
  stop_sequences?: Record<string, number>; // order_id -> sequence number
}

export interface TripLoadingRequest {
  trip_id: string;
  loading_actions: LoadingAction[];
  completion_notes?: string;
}

export interface TripResponse {
  trips: Trip[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
}

export interface TripOrderResponse {
  trip_orders: TripOrder[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
}

// Enhanced types for new features
export interface TripOptimizationSuggestion {
  trip_id: string;
  suggestion_type: 'route_optimization' | 'capacity_optimization' | 'time_optimization';
  description: string;
  potential_savings: {
    distance_km?: number;
    time_minutes?: number;
    fuel_liters?: number;
    cost_amount?: number;
  };
  implementation_difficulty: 'easy' | 'medium' | 'hard';
}

export interface LoadingEfficiencyReport {
  date_from: string;
  date_to: string;
  total_trips: number;
  avg_loading_time_minutes: number;
  avg_loading_efficiency: number;
  short_load_rate: number;
  most_common_short_load_reasons: Array<{
    reason: string;
    count: number;
    percentage: number;
  }>;
  top_performing_drivers: Array<{
    driver_name: string;
    loading_efficiency: number;
    trips_count: number;
  }>;
}

export interface DeliveryPerformanceReport {
  date_from: string;
  date_to: string;
  total_deliveries: number;
  successful_deliveries: number;
  failed_deliveries: number;
  on_time_deliveries: number;
  delivery_success_rate: number;
  on_time_rate: number;
  avg_delivery_time_minutes: number;
  customer_satisfaction_score?: number;
}