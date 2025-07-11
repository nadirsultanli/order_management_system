import { z } from 'zod';

// ==============================================================
// ORDERS OUTPUT SCHEMAS
// ==============================================================

// ============ Base Entities ============

export const OrderStatusEnum = z.enum(['draft', 'confirmed', 'scheduled', 'en_route', 'delivered', 'invoiced', 'cancelled']);

export const CustomerSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  account_status: z.string().nullable(),
  credit_terms_days: z.number().nullable(),
});

export const AddressSchema = z.object({
  id: z.string(),
  line1: z.string(),
  line2: z.string().nullable(),
  city: z.string(),
  state: z.string().nullable(),
  postal_code: z.string().nullable(),
  country: z.string(),
  instructions: z.string().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
});

export const WarehouseSchema = z.object({
  id: z.string(),
  name: z.string(),
  is_mobile: z.boolean().nullable(),
});

export const ProductSchema = z.object({
  id: z.string(),
  sku: z.string(),
  name: z.string(),
  unit_of_measure: z.string(),
  capacity_kg: z.number().nullable(),
  tare_weight_kg: z.number().nullable(),
});

export const OrderLineSchema = z.object({
  id: z.string(),
  product_id: z.string(),
  quantity: z.number(),
  unit_price: z.number(),
  subtotal: z.number(),
  product: ProductSchema,
});

export const PaymentSchema = z.object({
  id: z.string(),
  amount: z.number(),
  payment_method: z.string(),
  payment_status: z.string(),
  payment_date: z.string().nullable(),
  transaction_id: z.string().nullable(),
  reference_number: z.string().nullable(),
});

export const PaymentSummarySchema = z.object({
  order_total: z.number(),
  total_paid: z.number(),
  total_pending: z.number(),
  total_failed: z.number(),
  balance: z.number(),
  status: z.string(),
  payment_count: z.number(),
  completed_payment_count: z.number(),
  last_payment_date: z.string().nullable(),
  payment_methods: z.record(z.number()),
  is_overdue: z.boolean(),
  days_overdue: z.number(),
});

export const OrderSchema = z.object({
  id: z.string(),
  customer_id: z.string(),
  delivery_address_id: z.string().nullable(),
  source_warehouse_id: z.string(),
  order_date: z.string(),
  scheduled_date: z.string().nullable(),
  notes: z.string().nullable(),
  status: OrderStatusEnum,
  total_amount: z.number(),
  tax_amount: z.number().nullable(),
  tax_percent: z.number().nullable(),
  created_by_user_id: z.string(),
  created_at: z.string(),
  updated_at: z.string().nullable(),
  // Order type fields
  order_type: z.string(),
  service_type: z.string(),
  exchange_empty_qty: z.number(),
  requires_pickup: z.boolean(),
  // Relations
  customer: CustomerSchema,
  delivery_address: AddressSchema.nullable(),
  source_warehouse: WarehouseSchema,
  order_lines: z.array(OrderLineSchema),
  payments: z.array(PaymentSchema),
  // Calculated fields
  is_high_value: z.boolean(),
  days_since_order: z.number(),
  estimated_delivery_window: z.string(),
  risk_level: z.enum(['low', 'medium', 'high']),
  payment_summary: PaymentSummarySchema,
  payment_balance: z.number(),
  payment_status: z.string(),
});

// ============ List Response (matching existing business logic) ============

export const OrderListResponseSchema = z.object({
  orders: z.array(OrderSchema),
  totalCount: z.number(),
  totalPages: z.number(),
  currentPage: z.number(),
  analytics: z.object({
    total_orders: z.number(),
    total_value: z.number(),
    average_order_value: z.number(),
    status_breakdown: z.record(z.number()),
    high_value_orders: z.number(),
    overdue_orders: z.number(),
    risk_breakdown: z.object({
      low: z.number(),
      medium: z.number(),
      high: z.number(),
    }),
  }).optional(),
});

// ============ Single Order Response ============

export const OrderDetailResponseSchema = OrderSchema;

// ============ Overdue Orders Response ============

export const OverdueOrdersResponseSchema = z.object({
  orders: z.array(OrderSchema.extend({
    days_overdue: z.number(),
    urgency_score: z.number(),
  })),
  summary: z.object({
    total_overdue: z.number(),
    total_value: z.number(),
    avg_days_overdue: z.number(),
    high_priority_count: z.number(),
  }),
});

// ============ Delivery Calendar Response ============

export const DeliveryCalendarResponseSchema = z.object({
  delivery_schedule: z.array(z.object({
    date: z.string(),
    orders: z.array(OrderSchema.extend({
      order_weight: z.number(),
      order_volume: z.number(),
      estimated_service_time: z.number(),
    })),
    total_orders: z.number(),
    total_value: z.number(),
    total_weight: z.number(),
    total_volume: z.number(),
    estimated_route_time: z.number(),
    delivery_areas: z.array(z.string()),
    truck_requirements: z.object({
      recommended_truck: z.string(),
      utilization: z.object({
        weight_percent: z.number(),
        volume_percent: z.number(),
      }),
      multiple_trucks_needed: z.boolean(),
    }),
  })),
  summary: z.object({
    total_delivery_days: z.number(),
    total_orders: z.number(),
    total_value: z.number(),
    peak_day: z.any(),
  }),
});

// ============ Create Order Response ============

export const CreateOrderResponseSchema = OrderSchema.extend({
  validation_warnings: z.array(z.string()),
});

// ============ Calculate Total Response ============

export const CalculateOrderTotalResponseSchema = z.object({
  subtotal: z.number(),
  tax_amount: z.number(),
  total_amount: z.number(),
  breakdown: z.array(z.object({
    quantity: z.number(),
    unit_price: z.number(),
    subtotal: z.number(),
  })),
});

// ============ Update Status Response ============

export const UpdateOrderStatusResponseSchema = OrderSchema;

// ============ Update Tax Response ============

export const UpdateOrderTaxResponseSchema = z.object({
  subtotal: z.number(),
  tax_percent: z.number(),
  tax_amount: z.number(),
  total_amount: z.number(),
});

// ============ Workflow Responses ============

export const WorkflowResponseSchema = z.array(z.object({
  status: z.string(),
  label: z.string(),
  description: z.string(),
  color: z.string(),
  icon: z.string(),
  allowedTransitions: z.array(z.string()),
  estimatedDuration: z.number().optional(),
}));

export const StatusTransitionResponseSchema = z.object({
  valid: z.boolean(),
  errors: z.array(z.string()),
});

export const CalculateTotalsResponseSchema = z.object({
  subtotal: z.number(),
  taxAmount: z.number(),
  grandTotal: z.number(),
});

export const ValidateOrderResponseSchema = z.object({
  valid: z.boolean(),
  errors: z.array(z.string()),
});

export const WorkflowInfoResponseSchema = z.object({
  currentStatus: z.string(),
  currentStep: z.object({
    status: z.string(),
    description: z.string(),
  }),
  nextPossibleStatuses: z.array(z.string()),
  nextSteps: z.array(z.object({
    status: z.string(),
    description: z.string(),
  })),
  isEditable: z.boolean(),
  isCancellable: z.boolean(),
  formattedOrderId: z.string(),
  statusColor: z.string(),
});

// ============ Utility Responses ============

export const FormatOrderIdResponseSchema = z.object({
  formatted_id: z.string(),
});

export const FormatCurrencyResponseSchema = z.object({
  formatted_amount: z.string(),
});

export const FormatDateResponseSchema = z.object({
  formatted_date: z.string(),
});

// ============ Pricing Validation Response ============

export const ValidateOrderPricingResponseSchema = z.object({
  is_valid: z.boolean(),
  customer: z.object({
    id: z.string(),
    name: z.string(),
    account_status: z.string(),
  }),
  line_validations: z.array(z.object({
    product_id: z.string(),
    product_sku: z.string().optional(),
    product_name: z.string().optional(),
    quantity: z.number(),
    current_price: z.number().optional(),
    price_list_id: z.string().optional(),
    price_list_name: z.string().optional(),
    subtotal: z.number().optional(),
    available_stock: z.number().optional(),
    is_valid: z.boolean(),
    errors: z.array(z.string()).optional(),
    warnings: z.array(z.string()).optional(),
  })),
  total_amount: z.number(),
  summary: z.object({
    total_lines: z.number(),
    valid_lines: z.number(),
    invalid_lines: z.number(),
    total_errors: z.number(),
    total_warnings: z.number(),
  }),
  errors: z.array(z.string()),
  warnings: z.array(z.string()),
});

// ============ Truck Capacity Validation Response ============

export const ValidateTruckCapacityResponseSchema = z.object({
  truck: z.object({
    id: z.string(),
    name: z.string(),
    capacity_kg: z.number(),
    capacity_volume_m3: z.number(),
  }),
  validation: z.any(), // Complex validation result from database function
  recommendation: z.string(),
});

// ============ Allocation Responses ============

export const AllocateToTruckResponseSchema = z.any(); // Complex result from OrderAllocationService

export const AllocationSuggestionsResponseSchema = z.object({
  order_id: z.string(),
  order_weight_kg: z.number(),
  suggestions: z.array(z.any()), // Complex AllocationSuggestion type
});

export const CalculateOrderWeightResponseSchema = z.object({
  order_id: z.string(),
  total_weight_kg: z.number(),
});

export const RemoveAllocationResponseSchema = z.object({
  success: z.boolean(),
});

export const DailyScheduleResponseSchema = z.object({
  date: z.string(),
  trucks: z.array(z.any()), // Complex schedule result
  summary: z.object({
    total_trucks: z.number(),
    active_trucks: z.number(),
    total_orders: z.number(),
    avg_utilization: z.number(),
  }),
});

export const ProcessRefillOrderResponseSchema = z.object({
  success: z.boolean(),
  order_id: z.string(),
  message: z.string(),
}); 