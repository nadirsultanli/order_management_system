export interface Truck {
  id: string;
  fleet_number: string;
  license_plate: string;
  capacity_cylinders: number;
  capacity_kg: number; // Enhanced: weight-based capacity for allocation
  driver?: {
    id: string;
    name: string;
    email: string;
  } | null;
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
  
  // User assignment (driver ID)
  driver_id?: string;
}

export interface TruckRoute {
  id: string;
  truck_id: string;
  route_date: string;
  planned_start_time?: string;
  actual_start_time?: string;
  planned_end_time?: string;
  actual_end_time?: string;
  route_status: 'planned' | 'unloaded' | 'loaded' | 'in_transit' | 'completed' | 'cancelled';
  total_distance_km?: number;
  estimated_duration_hours?: number;
  actual_duration_hours?: number;
  fuel_used_liters?: number;
  created_at: string;
  updated_at: string;
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
  allocated_at: string;
  delivered_at?: string;
  notes?: string;
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
  };
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
  LOADED: 'loaded',
  IN_TRANSIT: 'in_transit',
  OFFLOADED: 'offloaded',
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

// =====================================================================
// ENHANCED TYPES FOR NEW FEATURES
// =====================================================================

export interface AllocationSuggestion {
  truck_id: string;
  fleet_number: string;
  capacity_info: TruckCapacityInfo;
  score: number; // 0-100, higher is better
  reasons: string[];
}

export interface OrderWeight {
  order_id: string;
  total_weight_kg: number;
  breakdown: {
    product_id: string;
    product_name: string;
    quantity: number;
    unit_weight_kg: number;
    total_weight_kg: number;
  }[];
}

export interface TruckScheduleSummary {
  date: string;
  total_trucks: number;
  active_trucks: number;
  total_orders: number;
  avg_utilization: number;
}

export interface StockMovement {
  id: string;
  product_id: string;
  warehouse_id?: string;
  truck_id?: string;
  order_id?: string;
  movement_type: 'delivery' | 'pickup' | 'refill' | 'exchange' | 'transfer' | 'adjustment';
  qty_full_in: number;
  qty_full_out: number;
  qty_empty_in: number;
  qty_empty_out: number;
  movement_date: string;
  reference_number?: string;
  notes?: string;
  created_by_user_id?: string;
  created_at: string;
  // Populated fields
  product?: {
    id: string;
    sku: string;
    name: string;
    variant_name?: string;
    is_variant: boolean;
  };
  warehouse?: {
    id: string;
    name: string;
    code: string;
  };
  truck?: {
    id: string;
    fleet_number: string;
    license_plate: string;
  };
  order?: {
    id: string;
    order_date: string;
    status: string;
  };
}

export interface StockMovementSummary {
  total_movements: number;
  total_full_in: number;
  total_full_out: number;
  total_empty_in: number;
  total_empty_out: number;
  by_movement_type: Record<string, {
    count: number;
    qty_full_in: number;
    qty_full_out: number;
    qty_empty_in: number;
    qty_empty_out: number;
  }>;
  by_product: Record<string, {
    product: any;
    count: number;
    qty_full_in: number;
    qty_full_out: number;
    qty_empty_in: number;
    qty_empty_out: number;
  }>;
}

export interface CreateStockMovementData {
  product_id: string;
  warehouse_id?: string;
  truck_id?: string;
  order_id?: string;
  movement_type: 'delivery' | 'pickup' | 'refill' | 'exchange' | 'transfer' | 'adjustment';
  qty_full_in?: number;
  qty_full_out?: number;
  qty_empty_in?: number;
  qty_empty_out?: number;
  movement_date: string;
  reference_number?: string;
  notes?: string;
}

export interface AllocationRequest {
  order_id: string;
  truck_id?: string; // Optional - system can auto-assign
  allocation_date: string;
  force_allocation?: boolean; // Override capacity warnings
}

export interface TruckMaintenanceRecord {
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

export interface RefillOrderProcessing {
  order_id: string;
  warehouse_id?: string;
  processed_at?: string;
  movements_created: StockMovement[];
}

// Filter types
export interface TruckFilters {
  search?: string; // Search by fleet number or license plate
  sort_by?: 'capacity_asc' | 'capacity_desc';
  page?: number;
  limit?: number;
}

export interface StockMovementFilters {
  search?: string;
  product_id?: string;
  warehouse_id?: string;
  truck_id?: string;
  order_id?: string;
  movement_type?: 'delivery' | 'pickup' | 'refill' | 'exchange' | 'transfer' | 'adjustment';
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
  sort_by?: 'movement_date' | 'created_at' | 'movement_type';
  sort_order?: 'asc' | 'desc';
}

export interface TruckMaintenanceFilters {
  truck_id?: string;
  maintenance_type?: 'routine' | 'repair' | 'inspection' | 'emergency';
  status?: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
}

// API Response types
export interface TruckAllocationResponse {
  allocations: TruckAllocation[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
}

export interface StockMovementResponse {
  movements: StockMovement[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
}

export interface TruckScheduleResponse {
  date: string;
  trucks: DailyTruckSchedule[];
  summary: TruckScheduleSummary;
} 