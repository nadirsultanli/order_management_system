export interface Truck {
  id: string;
  fleet_number: string;
  license_plate: string;
  capacity_cylinders: number;
  capacity_kg: number; // Enhanced: weight-based capacity for allocation
  driver_name: string | null;
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
  
  // User assignment
  user_id?: string;
}

export interface TruckRoute {
  id: string;
  truck_id: string;
  route_date: string;
  planned_start_time?: string;
  actual_start_time?: string;
  planned_end_time?: string;
  actual_end_time?: string;
  route_status: 'planned' | 'in_progress' | 'completed' | 'cancelled';
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
  stop_sequence?: number;
  status: 'planned' | 'loaded' | 'delivered' | 'cancelled';
  created_at: string;
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
  IN_PROGRESS: 'in_progress',
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