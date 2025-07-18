export interface Driver {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
}

export interface Truck {
  id: string;
  fleet_number: string;
  license_plate: string;
  capacity_cylinders: number;
  capacity_kg: number; // Enhanced: weight-based capacity for allocation
  active: boolean;
  status: 'active' | 'inactive' | 'maintenance'; // Enhanced: detailed status
  current_route_id?: string;
  
  // Maintenance tracking
  last_maintenance_date?: string;
  next_maintenance_due?: string;
  maintenance_interval_days?: number;
  
  // Fuel management
  fuel_capacity_liters?: number;
  avg_fuel_consumption?: number; // liters per 100km
  
  // System timestamps
  created_at: string;
  updated_at: string;
}

export interface TruckRoute {
  id: string;
  truck_id: string;
  route_date: string;
  planned_start_time?: string;
  actual_start_time?: string;
  planned_end_time?: string;
  actual_end_time?: string;
  route_status: 'planned' | 'loaded' | 'in_transit' | 'offloaded' | 'completed' | 'cancelled';
  total_distance_km?: number;
  estimated_duration_hours?: number;
  actual_duration_hours?: number;
  fuel_used_liters?: number;
  created_at: string;
  updated_at: string;
  
  // Enhanced trip lifecycle fields
  trip_number?: string;
  created_by_user_id?: string;
  driver_id?: string;
  warehouse_id?: string;
  load_started_at?: string;
  load_completed_at?: string;
  delivery_started_at?: string;
  delivery_completed_at?: string;
  unload_started_at?: string;
  unload_completed_at?: string;
  trip_notes?: string;
  has_variances?: boolean;
  variance_count?: number;
  total_variance_amount?: number;
}

export interface TruckInventoryItem {
  product_id: string;
  product_name: string;
  product_sku: string;
  product_variant_name?: string; // 'full', 'empty', etc.
  qty_full: number;
  qty_empty: number;
  weight_kg?: number; // Enhanced: weight tracking
  updated_at: string;
}

export interface TruckWithInventory extends Truck {
  inventory: TruckInventoryItem[];
  current_route?: TruckRoute;
}

export interface TruckCapacityInfo {
  truck_id: string;
  total_capacity_kg: number;
  allocated_weight_kg: number;
  available_weight_kg: number;
  utilization_percentage: number;
  orders_count: number;
  is_overallocated: boolean;
}

export interface TruckAllocation {
  id: string;
  truck_id: string;
  order_id: string;
  allocation_date: string;
  estimated_weight_kg: number;
  actual_weight_kg?: number;
  stop_sequence?: number;
  status: 'planned' | 'loaded' | 'delivered' | 'cancelled';
  allocated_by_user_id?: string;
  allocated_at?: string;
  delivered_at?: string;
  notes?: string;
  created_at: string;
  updated_at?: string;
  
  // Enhanced trip lifecycle fields
  trip_id?: string;
  loading_sequence?: number;
  load_started_at?: string;
  load_completed_at?: string;
  delivery_started_at?: string;
  delivery_completed_at?: string;
}

export interface DailyTruckSchedule {
  date: string;
  truck_id: string;
  truck: TruckWithInventory;
  route?: TruckRoute;
  allocations: TruckAllocation[];
  capacity_info: TruckCapacityInfo;
  maintenance_due: boolean;
  fuel_sufficient: boolean;
}

export interface TruckPerformanceMetrics {
  truck_id: string;
  fleet_number: string;
  period_start: string;
  period_end: string;
  
  // Delivery metrics
  total_deliveries: number;
  completed_deliveries: number;
  completion_rate: number;
  
  // Efficiency metrics
  total_distance_km: number;
  total_fuel_used_liters: number;
  fuel_efficiency: number; // km per liter
  
  // Utilization metrics
  avg_capacity_utilization: number;
  total_weight_delivered_kg: number;
  
  // Time metrics
  avg_delivery_time_hours: number;
  on_time_deliveries: number;
  on_time_rate: number;
}

export interface MaintenanceRecord {
  id: string;
  truck_id: string;
  maintenance_type: 'routine' | 'repair' | 'inspection' | 'emergency';
  scheduled_date: string;
  completed_date?: string;
  description: string;
  cost?: number;
  mechanic?: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string;
}

// Enums for better type safety
export const TruckStatus = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  MAINTENANCE: 'maintenance'
} as const;

export const RouteStatus = {
  PLANNED: 'planned',
  LOADING: 'loading',
  LOADED: 'loaded',
  IN_TRANSIT: 'in_transit',
  DELIVERING: 'delivering',
  UNLOADING: 'unloading',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
} as const;

export const AllocationStatus = {
  PLANNED: 'planned',
  LOADED: 'loaded',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled'
} as const;

export const MaintenanceType = {
  ROUTINE: 'routine',
  REPAIR: 'repair',
  INSPECTION: 'inspection',
  EMERGENCY: 'emergency'
} as const;

// Trip Lifecycle Types
export interface Trip extends TruckRoute {
  // Trip is essentially an enhanced TruckRoute
}

export interface TripLoadingDetail {
  id: string;
  trip_id: string;
  product_id: string;
  order_line_id?: string;
  
  // Planned quantities
  qty_planned_full: number;
  qty_planned_empty: number;
  
  // Actually loaded quantities
  qty_loaded_full: number;
  qty_loaded_empty: number;
  
  // Calculated variances
  qty_variance_full: number;
  qty_variance_empty: number;
  
  // Loading metadata
  loading_sequence?: number;
  loaded_by_user_id?: string;
  loaded_at?: string;
  loading_notes?: string;
  
  // Weight tracking
  estimated_weight_kg?: number;
  actual_weight_kg?: number;
  
  // Status
  loading_status: 'planned' | 'loading' | 'loaded' | 'short_loaded' | 'over_loaded';
  
  // Audit fields
  created_at: string;
  updated_at: string;
}

export interface TripVarianceRecord {
  id: string;
  trip_id: string;
  product_id: string;
  
  // Expected quantities
  qty_expected_full: number;
  qty_expected_empty: number;
  
  // Physical count quantities
  qty_physical_full: number;
  qty_physical_empty: number;
  
  // Calculated variances
  qty_variance_full: number;
  qty_variance_empty: number;
  
  // Variance details
  variance_reason?: 'lost' | 'damaged' | 'mis_scan' | 'theft' | 'delivery_error' | 'counting_error' | 'other';
  variance_notes?: string;
  
  // Financial impact
  unit_cost?: number;
  variance_value_full?: number;
  variance_value_empty?: number;
  total_variance_value?: number;
  
  // Resolution tracking
  variance_status: 'pending' | 'investigating' | 'resolved' | 'written_off' | 'adjusted';
  resolved_by_user_id?: string;
  resolved_at?: string;
  resolution_notes?: string;
  
  // Stock adjustment reference
  stock_adjustment_id?: string;
  
  // Audit fields
  counted_by_user_id: string;
  counted_at: string;
  created_at: string;
  updated_at: string;
}

export interface TripLoadingSummary {
  total_items_planned: number;
  total_items_loaded: number;
  total_variance: number;
  short_loaded_items: number;
  over_loaded_items: number;
  loading_completion_percent: number;
}

export interface TripVarianceSummary {
  total_variance_items: number;
  total_variance_value: number;
  pending_variances: number;
  resolved_variances: number;
  lost_items: number;
  damaged_items: number;
  most_common_reason?: string;
  variance_by_reason?: Record<string, number>;
}

export interface TripWithDetails extends Trip {
  loading_details?: TripLoadingDetail[];
  variance_records?: TripVarianceRecord[];
  loading_summary?: TripLoadingSummary;
  variance_summary?: TripVarianceSummary;
  allocations?: TruckAllocation[];
}

// Enhanced Route Status for Trip Lifecycle
export const TripStatus = {
  PLANNED: 'planned',
  LOADING: 'loading',
  LOADED: 'loaded',
  IN_TRANSIT: 'in_transit',
  DELIVERING: 'delivering',
  UNLOADING: 'unloading',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
} as const;

export const LoadingStatus = {
  PLANNED: 'planned',
  LOADING: 'loading',
  LOADED: 'loaded',
  SHORT_LOADED: 'short_loaded',
  OVER_LOADED: 'over_loaded'
} as const;

export const VarianceReason = {
  LOST: 'lost',
  DAMAGED: 'damaged',
  MIS_SCAN: 'mis_scan',
  THEFT: 'theft',
  DELIVERY_ERROR: 'delivery_error',
  COUNTING_ERROR: 'counting_error',
  OTHER: 'other'
} as const;

export const VarianceStatus = {
  PENDING: 'pending',
  INVESTIGATING: 'investigating',
  RESOLVED: 'resolved',
  WRITTEN_OFF: 'written_off',
  ADJUSTED: 'adjusted'
} as const;