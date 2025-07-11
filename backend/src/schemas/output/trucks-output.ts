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
});

export const TruckInventoryDetailSchema = z.object({
  id: z.string(),
  product_id: z.string(),
  qty_full: z.number(),
  qty_empty: z.number(),
  total_cylinders: z.number(),
  weight_kg: z.number(),
  updated_at: z.string(),
  product: ProductDetailSchema.optional(),
});

export const TruckSchema = z.object({
  id: z.string(),
  fleet_number: z.string(),
  license_plate: z.string(),
  capacity_cylinders: z.number(),
  capacity_kg: z.number(),
  driver_name: z.string().nullable().optional(),
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
  stop_sequence: z.number().nullable(),
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
    total_cylinders: z.number(),
    total_weight_kg: z.number(),
    capacity_utilization_percent: z.number(),
    is_overloaded: z.boolean(),
    last_updated: z.string().nullable(),
  }),
  timestamp: z.string(),
}); 