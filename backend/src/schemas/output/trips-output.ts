import { z } from 'zod';

// ==============================================================
// TRIPS OUTPUT SCHEMAS
// ==============================================================

// ============ Base Entities ============

export const TripTimelineEventSchema = z.object({
  id: z.string(),
  event: z.string(),
  timestamp: z.string(),
  status: z.string(),
  user_name: z.string(),
  details: z.string(),
});

export const TripLoadingDetailSchema = z.object({
  id: z.string(),
  trip_id: z.string(),
  product_id: z.string(),
  loading_sequence: z.number(),
  planned_quantity: z.number(),
  actual_quantity: z.number(),
  variance: z.number(),
  notes: z.string().nullable(),
  created_at: z.string(),
  product: z.object({
    name: z.string(),
    sku: z.string(),
  }).optional(),
});

export const TripVarianceRecordSchema = z.object({
  id: z.string(),
  trip_id: z.string(),
  product_id: z.string(),
  variance_type: z.string(),
  planned_quantity: z.number(),
  actual_quantity: z.number(),
  variance_amount: z.number(),
  reason: z.string().nullable(),
  created_at: z.string(),
  product: z.object({
    name: z.string(),
    sku: z.string(),
  }).optional(),
});

export const TripAllocationSchema = z.object({
  id: z.string(),
  trip_id: z.string(),
  order_id: z.string(),
  stop_sequence: z.number().nullable(),
  status: z.string(),
  estimated_weight_kg: z.number().nullable(),
  actual_weight_kg: z.number().nullable(),
  allocated_by_user_id: z.string().nullable(),
  allocated_at: z.string().nullable(),
  notes: z.string().nullable(),
  order: z.object({
    id: z.string(),
    order_date: z.string(),
    total_amount: z.number(),
    customer_id: z.string(),
  }).optional(),
});

export const TripSchema = z.object({
  id: z.string(),
  truck_id: z.string(),
  route_date: z.string(),
  planned_start_time: z.string().nullable(),
  planned_end_time: z.string().nullable(),
  actual_start_time: z.string().nullable(),
  actual_end_time: z.string().nullable(),
  route_status: z.string(),
  trip_notes: z.string().nullable(),
  warehouse_id: z.string().nullable(),
  driver_id: z.string().nullable(),
  created_by_user_id: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  load_started_at: z.string().nullable(),
  load_completed_at: z.string().nullable(),
  delivery_started_at: z.string().nullable(),
  unload_started_at: z.string().nullable(),
  unload_completed_at: z.string().nullable(),
  total_distance_km: z.number().nullable(),
  estimated_duration_hours: z.number().nullable(),
  actual_duration_hours: z.number().nullable(),
  fuel_used_liters: z.number().nullable(),
  truck: z.object({
    id: z.string(),
    fleet_number: z.string(),
    license_plate: z.string(),
    capacity_cylinders: z.number(),
    capacity_kg: z.number(),
    driver_name: z.string().nullable(),
  }).optional(),
  warehouse: z.object({
    id: z.string(),
    name: z.string(),
    address: z.string().nullable(),
  }).optional(),
  driver: z.object({
    id: z.string(),
    email: z.string().nullable(),
  }).optional(),
});

export const TripDetailSchema = TripSchema.extend({
  loading_details: z.array(TripLoadingDetailSchema).optional(),
  loading_summary: z.object({
    total_products: z.number(),
    total_planned_quantity: z.number(),
    total_actual_quantity: z.number(),
    total_variance: z.number(),
  }).optional(),
  variance_records: z.array(TripVarianceRecordSchema).optional(),
  variance_summary: z.object({
    total_variance_records: z.number(),
    total_variance_amount: z.number(),
    products_with_variance: z.number(),
  }).optional(),
  allocations: z.array(TripAllocationSchema).optional(),
});

// ============ Trip List Operations ============

export const TripListResponseSchema = z.object({
  trips: z.array(TripSchema),
  currentPage: z.number(),
  totalPages: z.number(),
  totalCount: z.number(),
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean(),
});

export const TripListPaginatedResponseSchema = z.object({
  trips: z.array(TripSchema),
  pagination: z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    pages: z.number(),
  }),
});

// ============ Trip Detail Operations ============

export const TripBasicResponseSchema = TripSchema.extend({
  truck_allocations: z.array(z.object({
    id: z.string(),
    order_id: z.string(),
    stop_sequence: z.number().nullable(),
    status: z.string(),
    estimated_weight_kg: z.number().nullable(),
    actual_weight_kg: z.number().nullable(),
    order: z.object({
      id: z.string(),
      order_number: z.string(),
      total_amount: z.number(),
      customer: z.object({
        id: z.string(),
        name: z.string(),
        email: z.string().nullable(),
      }),
      delivery_address: z.object({
        line1: z.string(),
        city: z.string(),
        state: z.string(),
        postal_code: z.string(),
      }).nullable(),
    }),
  })).optional(),
});

export const TripDetailResponseSchema = TripDetailSchema;

export const TripTimelineResponseSchema = z.object({
  trip_id: z.string(),
  timeline: z.array(TripTimelineEventSchema),
});

export const TripCapacityResponseSchema = z.object({
  trip_id: z.string(),
  truck_capacity_cylinders: z.number(),
  truck_capacity_kg: z.number(),
  loaded_cylinders: z.number(),
  loaded_weight_kg: z.number(),
  cylinder_utilization: z.number(),
  weight_utilization: z.number(),
  is_overloaded: z.boolean(),
  loading_details_count: z.number(),
});

// ============ Trip Creation & Updates ============

export const CreateTripResponseSchema = TripSchema;

export const UpdateTripStatusResponseSchema = z.object({
  success: z.boolean(),
  trip: TripSchema,
  message: z.string(),
});

export const AllocateOrdersResponseSchema = z.union([
  z.array(TripAllocationSchema),
  z.object({
    success: z.boolean(),
    trip_id: z.string(),
    allocated_orders: z.array(z.string()),
    allocations: z.any(),
    message: z.string(),
  }),
]);

export const RemoveAllocationResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

// ============ Trip Loading Operations ============

export const AddLoadingDetailResponseSchema = z.object({
  success: z.boolean(),
  loading_detail: TripLoadingDetailSchema.optional(),
  transfer_result: z.any(),
  message: z.string(),
});

export const UpdateLoadingDetailResponseSchema = TripLoadingDetailSchema;

export const DeleteLoadingDetailResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export const LoadingSummaryResponseSchema = z.object({
  trip: TripSchema,
  summary: z.object({
    trip_id: z.string(),
    total_products: z.number(),
    products_loaded: z.number(),
    products_pending: z.number(),
    products_short_loaded: z.number(),
    total_required_cylinders: z.number(),
    total_loaded_cylinders: z.number(),
    loading_percentage: z.number(),
    variance_count: z.number(),
    has_short_loading: z.boolean(),
  }),
  loading_details: z.array(TripLoadingDetailSchema),
  allocated_orders: z.array(z.object({
    order_id: z.string(),
    stop_sequence: z.number().nullable(),
    order: z.any(),
  })),
  timestamp: z.string(),
});

// ============ Trip Variance Operations ============

export const AddVarianceRecordResponseSchema = TripVarianceRecordSchema;

export const UpdateVarianceRecordResponseSchema = TripVarianceRecordSchema;

export const DeleteVarianceRecordResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export const VarianceSummaryResponseSchema = z.object({
  trip_id: z.string(),
  summary: z.object({
    total_variance_records: z.number(),
    total_variance_amount: z.number(),
    products_with_variance: z.number(),
    variance_types: z.array(z.string()),
  }),
  records: z.array(TripVarianceRecordSchema),
});

// ============ Trip Analytics ============

export const TripAnalyticsResponseSchema = z.object({
  trip_id: z.string(),
  performance_metrics: z.object({
    planned_duration_hours: z.number().nullable(),
    actual_duration_hours: z.number().nullable(),
    efficiency_percentage: z.number().nullable(),
    fuel_efficiency: z.number().nullable(),
    on_time_delivery_rate: z.number(),
  }),
  loading_metrics: z.object({
    total_products_loaded: z.number(),
    loading_accuracy_percentage: z.number(),
    variance_summary: z.object({
      positive_variances: z.number(),
      negative_variances: z.number(),
      total_variance_amount: z.number(),
    }),
  }),
  delivery_metrics: z.object({
    total_orders: z.number(),
    completed_orders: z.number(),
    delivery_success_rate: z.number(),
    average_delivery_time_hours: z.number().nullable(),
  }),
});

// ============ Trip Reports ============

export const TripReportResponseSchema = z.object({
  trip_id: z.string(),
  report_date: z.string(),
  trip_summary: TripSchema,
  loading_report: LoadingSummaryResponseSchema.optional(),
  variance_report: VarianceSummaryResponseSchema.optional(),
  analytics: TripAnalyticsResponseSchema.optional(),
  generated_by: z.string(),
  generated_at: z.string(),
}); 