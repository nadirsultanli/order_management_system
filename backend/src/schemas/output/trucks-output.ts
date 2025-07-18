import { z } from 'zod';

// ==============================================================
// TRUCKS OUTPUT SCHEMAS
// ==============================================================

// ============ Base Entities ============

export const ProductBaseSchema = z.object({
  name: z.string(),
  sku: z.string(),
  variant_name: z.string().nullable(),
});

export const ProductDetailSchema = z.object({
  id: z.string(),
  name: z.string(),
  sku: z.string(),
  variant_name: z.string().nullable(),
  capacity_kg: z.number().nullable(),
  tare_weight_kg: z.number().nullable(),
  unit_of_measure: z.string(),
  status: z.string(),
});

export const TruckInventoryItemSchema = z.object({
  product_id: z.string(),
  product_name: z.string(),
  product_sku: z.string(),
  product_variant_name: z.string().nullable(),
  qty_full: z.number(),
  qty_empty: z.number(),
  qty_reserved: z.number(),
  qty_available: z.number(),
});

export const TruckInventoryDetailSchema = z.object({
  id: z.string(),
  product_id: z.string(),
  qty_full: z.number(),
  qty_empty: z.number(),
  qty_reserved: z.number(),
  qty_available: z.number(),
  total_cylinders: z.number(),
  weight_kg: z.number(),
  updated_at: z.string(),
  product: ProductDetailSchema.optional(),
});

export const DriverSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
}).nullable();

export const TruckSchema = z.object({
  id: z.string(),
  fleet_number: z.string(),
  license_plate: z.string(),
  capacity_cylinders: z.number(),
  capacity_kg: z.number(),
  driver_id: z.string().uuid().nullable().optional(),
  driver: DriverSchema.nullable(),
  active: z.boolean(),
  status: z.string(),
  last_maintenance_date: z.string().nullable().optional(),
  next_maintenance_due: z.string().nullable().optional(),
  fuel_capacity_liters: z.number().nullable().optional(),
  avg_fuel_consumption: z.number().nullable().optional(),
  user_id: z.string().nullable().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  current_route: z.any().optional(),
  inventory: z.array(TruckInventoryItemSchema).optional(),
  maintenance_interval_days: z.number().optional(),
});

export const TruckRouteSchema = z.object({
  id: z.string(),
  truck_id: z.string(),
  route_date: z.string(),
  planned_start_time: z.string().nullable(),
  planned_end_time: z.string().nullable(),
  actual_start_time: z.string().nullable(),
  actual_end_time: z.string().nullable(),
  route_status: z.string(),
  total_distance_km: z.number().nullable(),
  estimated_duration_hours: z.number().nullable(),
  actual_duration_hours: z.number().nullable(),
  fuel_used_liters: z.number().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

// ============ Core Truck Operations ============

export const TruckListResponseSchema = z.object({
  trucks: z.array(TruckSchema),
  totalCount: z.number(),
  totalPages: z.number(),
  currentPage: z.number(),
});

export const TruckDetailResponseSchema = TruckSchema.extend({
  inventory: z.array(z.object({
    product_id: z.string(),
    product_name: z.string(),
    product_sku: z.string(),
    product_variant_name: z.string().nullable(),
    qty_full: z.number(),
    qty_empty: z.number(),
    qty_reserved: z.number(),
    qty_available: z.number(),
    weight_kg: z.number(),
    updated_at: z.string(),
  })),
  current_route: TruckRouteSchema.nullable(),
});

export const CreateTruckResponseSchema = TruckSchema;

export const UpdateTruckResponseSchema = TruckSchema;

export const DeleteTruckResponseSchema = z.object({
  success: z.boolean(),
});

// ============ Truck Allocations ============

export const TruckAllocationSchema = z.object({
  id: z.string(),
  truck_id: z.string(),
  order_id: z.string(),
  allocation_date: z.string(),
  estimated_weight_kg: z.number(),
  stop_sequence: z.number().optional(),
  status: z.string(),
  created_at: z.string(),
});

export const GetAllocationsResponseSchema = z.array(TruckAllocationSchema);

export const CreateAllocationResponseSchema = TruckAllocationSchema;

export const UpdateAllocationResponseSchema = TruckAllocationSchema;

// ============ Truck Routes ============

export const GetRoutesResponseSchema = z.array(TruckRouteSchema);

export const CreateRouteResponseSchema = TruckRouteSchema;

export const UpdateRouteResponseSchema = TruckRouteSchema;

// ============ Truck Maintenance ============

export const MaintenanceRecordSchema = z.object({
  id: z.string(),
  truck_id: z.string(),
  maintenance_type: z.string(),
  scheduled_date: z.string(),
  completed_date: z.string().nullable(),
  status: z.string(),
  description: z.string(),
  cost: z.number().nullable(),
  mechanic: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const GetMaintenanceResponseSchema = z.array(MaintenanceRecordSchema);

export const CreateMaintenanceResponseSchema = MaintenanceRecordSchema;

export const UpdateMaintenanceResponseSchema = MaintenanceRecordSchema;

// ============ Truck Capacity Calculations ============

export const OrderWeightResponseSchema = z.object({
  total_weight_kg: z.number(),
  line_estimates: z.array(z.object({
    product_id: z.string(),
    product_name: z.string(),
    quantity: z.number(),
    estimated_weight_kg: z.number(),
    variant_name: z.string().optional(),
  })),
});

export const TruckCapacityResponseSchema = z.object({
  truck_id: z.string(),
  total_capacity_kg: z.number(),
  allocated_weight_kg: z.number(),
  available_weight_kg: z.number(),
  utilization_percentage: z.number(),
  orders_count: z.number(),
  is_overallocated: z.boolean(),
});

export const BestAllocationResponseSchema = z.object({
  recommendations: z.array(z.object({
    truck: TruckSchema,
    capacity_info: TruckCapacityResponseSchema,
    fit_score: z.number(),
    can_accommodate: z.boolean(),
  })),
  best_truck: TruckSchema.optional(),
});

export const AllocationValidationResponseSchema = z.object({
  is_valid: z.boolean(),
  warnings: z.array(z.string()),
  errors: z.array(z.string()),
});

export const TruckScheduleResponseSchema = z.object({
  schedules: z.array(z.object({
    date: z.string(),
    truck_id: z.string(),
    truck: TruckSchema,
    route: z.any().optional(),
    allocations: z.array(TruckAllocationSchema),
    capacity_info: TruckCapacityResponseSchema,
    maintenance_due: z.boolean(),
    fuel_sufficient: z.boolean(),
  })),
  fleet_utilization: z.object({
    total_capacity_kg: z.number(),
    total_allocated_kg: z.number(),
    overall_utilization: z.number(),
    active_trucks: z.number(),
    overallocated_trucks: z.number(),
    maintenance_due_trucks: z.number(),
  }),
});

export const OptimizedAllocationsResponseSchema = z.object({
  optimized_allocations: z.array(z.object({
    order_id: z.string(),
    truck_id: z.string(),
    estimated_weight_kg: z.number(),
    confidence_score: z.number(),
  })),
  unallocated_orders: z.array(z.string()),
  optimization_summary: z.object({
    total_orders: z.number(),
    allocated_orders: z.number(),
    fleet_utilization: z.number(),
  }),
});

// ============ Truck Inventory Operations ============

export const LoadInventoryResponseSchema = z.object({
  success: z.boolean(),
  truck_id: z.string(),
  warehouse_id: z.string(),
  items_transferred: z.number(),
  total_items_requested: z.number(),
  loading_id: z.string(),
  verification: z.object({
    passed: z.boolean(),
    details: z.array(z.object({
      product_id: z.string(),
      requested_full: z.number(),
      requested_empty: z.number(),
      truck_inventory_exists: z.boolean(),
      warehouse_inventory_exists: z.boolean(),
      verification_passed: z.boolean(),
    })).optional(),
    duration_ms: z.number().optional(),
    error: z.string().optional(),
    warning: z.string().optional(),
  }),
  results: z.array(z.any()),
  processedItems: z.array(z.any()),
  timestamp: z.string(),
  truck_fleet_number: z.string(),
  warehouse_name: z.string(),
});

export const UnloadInventoryResponseSchema = z.object({
  success: z.boolean(),
  truck_id: z.string(),
  warehouse_id: z.string(),
  items_transferred: z.number(),
  results: z.array(z.any()),
});

export const TruckInventoryResponseSchema = z.object({
  truck: z.object({
    id: z.string(),
    fleet_number: z.string(),
    license_plate: z.string(),
    active: z.boolean(),
    capacity_cylinders: z.number(),
    capacity_kg: z.number(),
  }),
  inventory: z.array(TruckInventoryDetailSchema),
  summary: z.object({
    total_products: z.number(),
    total_full_cylinders: z.number(),
    total_empty_cylinders: z.number(),
    total_reserved_cylinders: z.number(),
    total_available_cylinders: z.number(),
    total_cylinders: z.number(),
    total_weight_kg: z.number(),
    capacity_utilization_percent: z.number(),
    is_overloaded: z.boolean(),
    last_updated: z.string().nullable(),
  }),
  timestamp: z.string(),
});

// ============ Trip Lifecycle Output Schemas ============

export const TripSchema = z.object({
  id: z.string(),
  truck_id: z.string(),
  route_date: z.string(),
  planned_start_time: z.string().nullable(),
  actual_start_time: z.string().nullable(),
  planned_end_time: z.string().nullable(),
  actual_end_time: z.string().nullable(),
  route_status: z.string(),
  total_distance_km: z.number().nullable(),
  estimated_duration_hours: z.number().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  
  // Trip lifecycle fields
  trip_number: z.string().nullable(),
  created_by_user_id: z.string().nullable(),
  driver_id: z.string().nullable(),
  warehouse_id: z.string().nullable(),
  load_started_at: z.string().nullable(),
  load_completed_at: z.string().nullable(),
  delivery_started_at: z.string().nullable(),
  delivery_completed_at: z.string().nullable(),
  unload_started_at: z.string().nullable(),
  unload_completed_at: z.string().nullable(),
  trip_notes: z.string().nullable(),
  has_variances: z.boolean().nullable(),
  variance_count: z.number().nullable(),
  total_variance_amount: z.number().nullable(),
});

export const TripLoadingDetailSchema = z.object({
  id: z.string(),
  trip_id: z.string(),
  product_id: z.string(),
  order_line_id: z.string().nullable(),
  
  // Planned quantities
  qty_planned_full: z.number(),
  qty_planned_empty: z.number(),
  
  // Actually loaded quantities
  qty_loaded_full: z.number(),
  qty_loaded_empty: z.number(),
  
  // Calculated variances
  qty_variance_full: z.number(),
  qty_variance_empty: z.number(),
  
  // Loading metadata
  loading_sequence: z.number().nullable(),
  loaded_by_user_id: z.string().nullable(),
  loaded_at: z.string().nullable(),
  loading_notes: z.string().nullable(),
  
  // Weight tracking
  estimated_weight_kg: z.number().nullable(),
  actual_weight_kg: z.number().nullable(),
  
  // Status
  loading_status: z.string(),
  
  // Audit fields
  created_at: z.string(),
  updated_at: z.string(),
  
  // Product details (joined)
  product_name: z.string().optional(),
  product_sku: z.string().optional(),
});

export const TripVarianceRecordSchema = z.object({
  id: z.string(),
  trip_id: z.string(),
  product_id: z.string(),
  
  // Expected quantities
  qty_expected_full: z.number(),
  qty_expected_empty: z.number(),
  
  // Physical count quantities
  qty_physical_full: z.number(),
  qty_physical_empty: z.number(),
  
  // Calculated variances
  qty_variance_full: z.number(),
  qty_variance_empty: z.number(),
  
  // Variance details
  variance_reason: z.string().nullable(),
  variance_notes: z.string().nullable(),
  
  // Financial impact
  unit_cost: z.number().nullable(),
  variance_value_full: z.number().nullable(),
  variance_value_empty: z.number().nullable(),
  total_variance_value: z.number().nullable(),
  
  // Resolution tracking
  variance_status: z.string(),
  resolved_by_user_id: z.string().nullable(),
  resolved_at: z.string().nullable(),
  resolution_notes: z.string().nullable(),
  
  // Stock adjustment reference
  stock_adjustment_id: z.string().nullable(),
  
  // Audit fields
  counted_by_user_id: z.string(),
  counted_at: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  
  // Product details (joined)
  product_name: z.string().optional(),
  product_sku: z.string().optional(),
});

export const TripLoadingSummarySchema = z.object({
  total_items_planned: z.number(),
  total_items_loaded: z.number(),
  total_variance: z.number(),
  short_loaded_items: z.number(),
  over_loaded_items: z.number(),
  loading_completion_percent: z.number(),
});

export const TripVarianceSummarySchema = z.object({
  total_variance_items: z.number(),
  total_variance_value: z.number(),
  pending_variances: z.number(),
  resolved_variances: z.number(),
  lost_items: z.number(),
  damaged_items: z.number(),
  most_common_reason: z.string().nullable(),
  variance_by_reason: z.record(z.number()).optional(),
});

export const TripWithDetailsSchema = TripSchema.extend({
  loading_details: z.array(TripLoadingDetailSchema).optional(),
  variance_records: z.array(TripVarianceRecordSchema).optional(),
  loading_summary: TripLoadingSummarySchema.optional(),
  variance_summary: TripVarianceSummarySchema.optional(),
  allocations: z.array(TruckAllocationSchema).optional(),
  
  // Related entities
  truck: TruckSchema.optional(),
  warehouse: z.object({
    id: z.string(),
    name: z.string(),
    address: z.string().optional(),
  }).optional(),
  driver: z.object({
    id: z.string(),
    name: z.string().optional(),
    email: z.string().optional(),
  }).optional(),
});

// ============ Trip Lifecycle Response Schemas ============

export const CreateTripResponseSchema = TripSchema;

export const UpdateTripStatusResponseSchema = z.object({
  success: z.boolean(),
  trip: TripSchema,
  message: z.string().optional(),
});

export const GetTripByIdResponseSchema = TripWithDetailsSchema;

export const GetTripsResponseSchema = z.object({
  trips: z.array(TripSchema),
  pagination: z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    pages: z.number(),
  }),
});

export const AllocateOrdersToTripResponseSchema = z.object({
  success: z.boolean(),
  trip_id: z.string(),
  allocated_orders: z.array(z.string()),
  allocations: z.array(TruckAllocationSchema),
  message: z.string().optional(),
});

export const RemoveOrderFromTripResponseSchema = z.object({
  success: z.boolean(),
  trip_id: z.string(),
  removed_order_id: z.string(),
  message: z.string().optional(),
});

export const UpdateAllocationSequenceResponseSchema = z.object({
  success: z.boolean(),
  trip_id: z.string(),
  updated_allocations: z.array(TruckAllocationSchema),
  message: z.string().optional(),
});

// ============ Trip Loading Response Schemas ============

export const StartTripLoadingResponseSchema = z.object({
  success: z.boolean(),
  trip: TripSchema,
  loading_details: z.array(TripLoadingDetailSchema),
  message: z.string().optional(),
});

export const AddLoadingDetailResponseSchema = TripLoadingDetailSchema;

export const UpdateLoadingDetailResponseSchema = TripLoadingDetailSchema;

export const CompleteLoadingResponseSchema = z.object({
  success: z.boolean(),
  trip: TripSchema,
  loading_details: z.array(TripLoadingDetailSchema),
  loading_summary: TripLoadingSummarySchema,
  short_loading_warnings: z.array(z.object({
    product_id: z.string(),
    product_name: z.string(),
    qty_planned_full: z.number(),
    qty_loaded_full: z.number(),
    qty_variance_full: z.number(),
    qty_planned_empty: z.number(),
    qty_loaded_empty: z.number(),
    qty_variance_empty: z.number(),
  })).optional(),
  message: z.string().optional(),
});

export const GetTripLoadingSummaryResponseSchema = TripLoadingSummarySchema;

export const CheckShortLoadingResponseSchema = z.object({
  has_short_loading: z.boolean(),
  short_loaded_products: z.array(z.object({
    product_id: z.string(),
    product_name: z.string(),
    qty_planned_full: z.number(),
    qty_loaded_full: z.number(),
    qty_variance_full: z.number(),
    qty_planned_empty: z.number(),
    qty_loaded_empty: z.number(),
    qty_variance_empty: z.number(),
    is_short_loaded: z.boolean(),
  })),
});

// ============ Trip Variance Response Schemas ============

export const StartTripUnloadingResponseSchema = z.object({
  success: z.boolean(),
  trip: TripSchema,
  expected_inventory: z.array(z.object({
    product_id: z.string(),
    product_name: z.string(),
    qty_expected_full: z.number(),
    qty_expected_empty: z.number(),
  })),
  message: z.string().optional(),
});

export const RecordVarianceResponseSchema = TripVarianceRecordSchema;

export const UpdateVarianceResponseSchema = TripVarianceRecordSchema;

export const CreateVarianceAdjustmentResponseSchema = z.object({
  success: z.boolean(),
  variance_id: z.string(),
  adjustment_id: z.string(),
  variance_record: TripVarianceRecordSchema,
  message: z.string().optional(),
});

export const GetTripVarianceSummaryResponseSchema = TripVarianceSummarySchema;

export const CompleteTripResponseSchema = z.object({
  success: z.boolean(),
  trip: TripSchema,
  final_summary: z.object({
    loading_summary: TripLoadingSummarySchema.optional(),
    variance_summary: TripVarianceSummarySchema.optional(),
    pending_variances: z.number(),
    total_variance_value: z.number(),
  }),
  stock_movements: z.array(z.object({
    id: z.string(),
    movement_type: z.string(),
    product_id: z.string(),
    qty_full_in: z.number(),
    qty_full_out: z.number(),
    qty_empty_in: z.number(),
    qty_empty_out: z.number(),
  })).optional(),
  message: z.string().optional(),
}); 

// ============ Truck Loading Capacity Validation ============

export const ValidateLoadingCapacityResponseSchema = z.object({
  is_valid: z.boolean(),
  warnings: z.array(z.string()),
  errors: z.array(z.string()),
  capacity_check: z.object({
    current_cylinders: z.number(),
    cylinders_to_add: z.number(),
    total_cylinders_after: z.number(),
    cylinder_capacity: z.number(),
    cylinder_overflow: z.number(),
    current_weight_kg: z.number(),
    weight_to_add_kg: z.number(),
    total_weight_after_kg: z.number(),
    weight_capacity_kg: z.number(),
    weight_overflow_kg: z.number(),
  }),
  truck: z.object({
    id: z.string(),
    fleet_number: z.string(),
    license_plate: z.string(),
    capacity_cylinders: z.number(),
    capacity_kg: z.number(),
  }),
});

// ============ Truck Reservation Schemas ============

export const ReserveInventoryResponseSchema = z.object({
  success: z.boolean(),
  truck_id: z.string(),
  product_id: z.string(),
  quantity_reserved: z.number(),
  total_reserved: z.number(),
  available_remaining: z.number(),
  order_id: z.string(),
  timestamp: z.string(),
});

export const ReleaseReservationResponseSchema = z.object({
  success: z.boolean(),
  truck_id: z.string(),
  product_id: z.string(),
  quantity_reserved: z.number(),
  total_reserved: z.number(),
  available_remaining: z.number(),
  order_id: z.string(),
  timestamp: z.string(),
});

export const CheckAvailabilityResponseSchema = z.object({
  available: z.boolean(),
  available_qty: z.number(),
  reserved_qty: z.number(),
});