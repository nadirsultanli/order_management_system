import { z } from 'zod';

// ==============================================================
// TRUCKS INPUT SCHEMAS
// ==============================================================

// ============ Base Enums ============

export const TruckStatusEnum = z.enum(['active', 'inactive', 'maintenance']);
export const RouteStatusEnum = z.enum(['planned', 'unloaded', 'loaded', 'in_transit', 'completed', 'cancelled']);
export const TripStatusEnum = z.enum(['planned', 'unloaded', 'loaded', 'in_transit', 'completed', 'cancelled']);
export const LoadingStatusEnum = z.enum(['planned', 'loading', 'loaded', 'short_loaded', 'over_loaded']);
export const VarianceReasonEnum = z.enum(['lost', 'damaged', 'mis_scan', 'theft', 'delivery_error', 'counting_error', 'other']);
export const VarianceStatusEnum = z.enum(['pending', 'investigating', 'resolved', 'written_off', 'adjusted']);
export const AllocationStatusEnum = z.enum(['planned', 'loaded', 'delivered', 'cancelled']);
export const MaintenanceTypeEnum = z.enum(['routine', 'repair', 'inspection', 'emergency']);
export const MaintenanceStatusEnum = z.enum(['scheduled', 'in_progress', 'completed', 'cancelled']);

// ============ Core Truck Operations ============

export const TruckFiltersSchema = z.object({
  search: z.string().optional(),
  status: TruckStatusEnum.optional(),
  active: z.boolean().optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(50),
});

export const GetTruckByIdSchema = z.object({
  id: z.string().uuid(),
});

export const CreateTruckSchema = z.object({
  fleet_number: z.string().min(1),
  license_plate: z.string().min(1),
  capacity_cylinders: z.number().positive(),
  capacity_kg: z.number().positive().optional(),
  active: z.boolean().default(true),
  status: TruckStatusEnum.default('active').optional(),
  last_maintenance_date: z.string().nullable().optional(),
  next_maintenance_due: z.string().nullable().optional(),
  maintenance_interval_days: z.number().positive().optional(),
  fuel_capacity_liters: z.number().positive().nullable().optional(),
  avg_fuel_consumption: z.number().positive().nullable().optional(),
});

export const UpdateTruckSchema = z.object({
  id: z.string().uuid(),
  fleet_number: z.string().min(1).optional(),
  license_plate: z.string().min(1).optional(),
  capacity_cylinders: z.number().positive().optional(),
  capacity_kg: z.number().positive().optional(),
  active: z.boolean().optional(),
  status: TruckStatusEnum.optional(),
  last_maintenance_date: z.string().nullable().optional(),
  next_maintenance_due: z.string().nullable().optional(),
  maintenance_interval_days: z.number().positive().optional(),
  fuel_capacity_liters: z.number().positive().nullable().optional(),
  avg_fuel_consumption: z.number().positive().nullable().optional(),
});

export const DeleteTruckSchema = z.object({
  id: z.string().uuid(),
});

// ============ Truck Allocations ============

export const GetAllocationsSchema = z.object({
  date: z.string().optional(),
  truck_id: z.string().uuid().optional(),
});

export const TruckAllocationSchema = z.object({
  truck_id: z.string().uuid(),
  order_id: z.string().uuid(),
  allocation_date: z.string(),
  estimated_weight_kg: z.number().positive(),
  stop_sequence: z.number().positive().optional(),
});

export const UpdateTruckAllocationSchema = z.object({
  id: z.string().uuid(),
  status: AllocationStatusEnum.optional(),
  stop_sequence: z.number().positive().optional(),
});

// ============ Truck Routes ============

export const GetRoutesSchema = z.object({
  truck_id: z.string().uuid().optional(),
  date: z.string().optional(),
});

export const CreateTruckRouteSchema = z.object({
  truck_id: z.string().uuid(),
  route_date: z.string(),
  planned_start_time: z.string().optional(),
  planned_end_time: z.string().optional(),
  total_distance_km: z.number().positive().optional(),
  estimated_duration_hours: z.number().positive().optional(),
});

export const UpdateTruckRouteSchema = z.object({
  id: z.string().uuid(),
  actual_start_time: z.string().optional(),
  actual_end_time: z.string().optional(),
  route_status: RouteStatusEnum.optional(),
  actual_duration_hours: z.number().positive().optional(),
  fuel_used_liters: z.number().positive().optional(),
});

// ============ Truck Maintenance ============

export const GetMaintenanceSchema = z.object({
  truck_id: z.string().uuid().optional(),
});

export const CreateMaintenanceSchema = z.object({
  truck_id: z.string().uuid(),
  maintenance_type: MaintenanceTypeEnum,
  scheduled_date: z.string(),
  description: z.string().min(1),
  cost: z.number().positive().optional(),
  mechanic: z.string().optional(),
});

export const UpdateMaintenanceSchema = z.object({
  id: z.string().uuid(),
  completed_date: z.string().optional(),
  status: MaintenanceStatusEnum.optional(),
  cost: z.number().positive().optional(),
  mechanic: z.string().optional(),
});

// ============ Truck Capacity Calculations ============

export const CalculateOrderWeightSchema = z.object({
  order_lines: z.array(z.object({
    id: z.string(),
    order_id: z.string(),
    product_id: z.string(),
    quantity: z.number(),
    unit_price: z.number(),
  })),
  product_ids: z.array(z.string()).optional(),
});

export const CalculateCapacitySchema = z.object({
  truck_id: z.string().uuid(),
  date: z.string(),
});

export const FindBestAllocationSchema = z.object({
  order_id: z.string().uuid(),
  order_weight: z.number(),
  target_date: z.string(),
});

export const ValidateAllocationSchema = z.object({
  truck_id: z.string().uuid(),
  order_id: z.string().uuid(),
  order_weight: z.number(),
  target_date: z.string(),
});

export const GenerateScheduleSchema = z.object({
  date: z.string(),
});

export const OptimizeAllocationsSchema = z.object({
  order_ids: z.array(z.string().uuid()),
  target_date: z.string(),
});

// ============ Truck Inventory Operations ============

export const LoadInventorySchema = z.object({
  truck_id: z.string().uuid(),
  warehouse_id: z.string().uuid(),
  items: z.array(z.object({
    product_id: z.string().uuid(),
    qty_full: z.number().min(0),
    qty_empty: z.number().min(0),
  })).min(1),
});

export const UnloadInventorySchema = z.object({
  truck_id: z.string().uuid(),
  warehouse_id: z.string().uuid(),
  items: z.array(z.object({
    product_id: z.string().uuid(),
    qty_full: z.number().min(0),
    qty_empty: z.number().min(0),
  })).min(1),
});

export const GetInventorySchema = z.object({
  truck_id: z.string().uuid(),
  include_product_details: z.boolean().optional().default(true),
});

// ============ Trip Lifecycle Operations ============

export const CreateTripSchema = z.object({
  truck_id: z.string().uuid(),
  route_date: z.string(), // ISO date string
  warehouse_id: z.string().uuid(),
  driver_id: z.string().uuid().optional(),
  planned_start_time: z.string().optional(), // Time string HH:MM
  planned_end_time: z.string().optional(),
  trip_notes: z.string().optional(),
});

export const UpdateTripSchema = z.object({
  id: z.string().uuid(),
  truck_id: z.string().uuid().optional(),
  route_date: z.string().optional(), // ISO date string
  warehouse_id: z.string().uuid().optional(),
  driver_id: z.string().uuid().optional(),
  planned_start_time: z.string().optional(), // Time string HH:MM
  planned_end_time: z.string().optional(),
  trip_notes: z.string().optional(),
  status: TripStatusEnum.optional(),
});

export const UpdateTripStatusSchema = z.object({
  trip_id: z.string().uuid(),
  status: TripStatusEnum,
  notes: z.string().optional(),
  timestamp: z.string().optional(), // ISO timestamp, defaults to now
});

export const GetTripByIdSchema = z.object({
  id: z.string().uuid(),
  include_details: z.boolean().optional().default(true),
  include_loading_details: z.boolean().optional().default(false),
  include_variance_records: z.boolean().optional().default(false),
});

export const GetTripsSchema = z.object({
  truck_id: z.string().uuid().optional(),
  warehouse_id: z.string().uuid().optional(),
  driver_id: z.string().uuid().optional(),
  status: TripStatusEnum.optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  search: z.string().optional(),
  sort_by: z.string().optional(),
  sort_order: z.enum(['asc', 'desc']).optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(50),
});

export const AllocateOrdersToTripSchema = z.object({
  trip_id: z.string().uuid(),
  order_ids: z.array(z.string().uuid()),
  auto_sequence: z.boolean().optional().default(true),
  notes: z.string().optional(),
});

export const RemoveOrderFromTripSchema = z.object({
  trip_id: z.string().uuid(),
  order_id: z.string().uuid(),
});

export const UpdateAllocationSequenceSchema = z.object({
  trip_id: z.string().uuid(),
  allocations: z.array(z.object({
    order_id: z.string().uuid(),
    stop_sequence: z.number().min(1),
  })),
});

// ============ Trip Loading Operations ============

export const StartTripLoadingSchema = z.object({
  trip_id: z.string().uuid(),
  notes: z.string().optional(),
});

export const AddLoadingDetailSchema = z.object({
  trip_id: z.string().uuid(),
  product_id: z.string().uuid(),
  order_line_id: z.string().uuid().optional(),
  qty_planned_full: z.number().min(0).default(0),
  qty_planned_empty: z.number().min(0).default(0),
  loading_sequence: z.number().min(1).optional(),
});

export const UpdateLoadingDetailSchema = z.object({
  loading_detail_id: z.string().uuid(),
  qty_loaded_full: z.number().min(0).optional(),
  qty_loaded_empty: z.number().min(0).optional(),
  actual_weight_kg: z.number().min(0).optional(),
  loading_notes: z.string().optional(),
  loading_status: LoadingStatusEnum.optional(),
});

export const CompleteLoadingSchema = z.object({
  trip_id: z.string().uuid(),
  loading_details: z.array(z.object({
    product_id: z.string().uuid(),
    qty_loaded_full: z.number().min(0),
    qty_loaded_empty: z.number().min(0),
    actual_weight_kg: z.number().min(0).optional(),
    loading_notes: z.string().optional(),
  })),
  notes: z.string().optional(),
});

export const GetTripLoadingSummarySchema = z.object({
  trip_id: z.string().uuid(),
});

export const CheckShortLoadingSchema = z.object({
  trip_id: z.string().uuid(),
});

export const RecordLoadingDetailSchema = z.object({
  trip_id: z.string().uuid(),
  product_id: z.string().uuid(),
  qty_full: z.number().min(0),
  qty_empty: z.number().min(0),
  loading_sequence: z.number().min(1).optional().default(1),
  notes: z.string().optional(),
});

// ============ Trip Variance Operations ============

export const StartTripUnloadingSchema = z.object({
  trip_id: z.string().uuid(),
  notes: z.string().optional(),
});

export const RecordVarianceSchema = z.object({
  trip_id: z.string().uuid(),
  product_id: z.string().uuid(),
  qty_expected_full: z.number().min(0),
  qty_expected_empty: z.number().min(0),
  qty_physical_full: z.number().min(0),
  qty_physical_empty: z.number().min(0),
  variance_reason: VarianceReasonEnum.optional(),
  variance_notes: z.string().optional(),
  unit_cost: z.number().min(0).optional(),
});

export const UpdateVarianceSchema = z.object({
  variance_id: z.string().uuid(),
  variance_reason: VarianceReasonEnum.optional(),
  variance_notes: z.string().optional(),
  variance_status: VarianceStatusEnum.optional(),
  resolution_notes: z.string().optional(),
});

export const CreateVarianceAdjustmentSchema = z.object({
  variance_id: z.string().uuid(),
  notes: z.string().optional(),
});

export const GetTripVarianceSummarySchema = z.object({
  trip_id: z.string().uuid(),
});

export const CompleteTripSchema = z.object({
  trip_id: z.string().uuid(),
  final_notes: z.string().optional(),
  force_complete: z.boolean().optional().default(false), // Allow completion even with pending variances
});

// ============ Additional Validation Schemas ============

export const ValidateLoadingCapacitySchema = z.object({
  truck_id: z.string(),
  items: z.array(z.object({
    product_id: z.string(),
    qty_full: z.number().min(0),
    qty_empty: z.number().min(0),
    weight_kg: z.number().optional()
  }))
});

export const ValidateTripLoadingCapacitySchema = z.object({
  trip_id: z.string().uuid(),
  loading_plan: z.array(z.object({
    product_id: z.string().uuid(),
    qty_full: z.number().min(0),
    qty_empty: z.number().min(0),
  })).optional(),
});

export const CheckTripProductAvailabilitySchema = z.object({
  trip_id: z.string().uuid(),
  include_safety_stock: z.boolean().optional().default(true),
}); 