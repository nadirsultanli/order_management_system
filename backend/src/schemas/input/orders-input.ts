  import { z } from 'zod';

// Helper to handle optional datetime fields that might be empty strings
const optionalDatetime = () => z.string().optional().transform((val) => val === '' ? undefined : val).pipe(z.string().datetime().optional());

  // ==============================================================
  // ORDERS INPUT SCHEMAS
  // ==============================================================

  // ============ Base Schemas ============

  export const OrderStatusEnum = z.enum(['draft', 'confirmed', 'scheduled', 'dispatched', 'en_route', 'delivered', 'invoiced', 'cancelled', 'paid', 'completed_no_sale']);

  export const OrderTypeEnum = z.enum(['delivery', 'visit']);

  export const ServiceTypeEnum = z.enum(['standard', 'express', 'scheduled']);

  export const PriorityEnum = z.enum(['low', 'normal', 'high', 'urgent']);

  export const DeliveryMethodEnum = z.enum(['pickup', 'delivery']);

  export const PaymentStatusEnum = z.enum(['pending', 'paid', 'overdue']);

  // ============ Core Order Operations ============

  export const OrderFiltersSchema = z.object({
    // Basic filters - simplified for OpenAPI compatibility
    status: z.string().optional(), // Comma-separated statuses supported in business logic
    customer_id: z.string().uuid().optional(),
    search: z.string().optional(),
    order_date_from: z.string().optional(),
    order_date_to: z.string().optional(),
    scheduled_date_from: z.string().optional(),
    scheduled_date_to: z.string().optional(),
    amount_min: z.number().optional(),
    amount_max: z.number().optional(),
    delivery_area: z.string().optional(),
    is_overdue: z.boolean().optional(),
    delivery_method: DeliveryMethodEnum.optional(),
    priority: PriorityEnum.optional(),
    payment_status: PaymentStatusEnum.optional(),
    sort_by: z.enum(['created_at', 'order_date', 'scheduled_date', 'total_amount', 'customer_name']).default('created_at'),
    sort_order: z.enum(['asc', 'desc']).default('desc'),
    include_analytics: z.boolean().default(false),
    page: z.number().min(1).default(1),
    limit: z.number().min(1).max(100).default(50),
  });

  export const GetOrderByIdSchema = z.object({
    order_id: z.string().uuid(),
  });

  export const GetOverdueOrdersSchema = z.object({
    days_overdue_min: z.number().min(0).default(1),
    include_cancelled: z.boolean().default(false),
    priority_filter: PriorityEnum.optional(),
  });

  export const GetDeliveryCalendarSchema = z.object({
    date_from: z.string(),
    date_to: z.string(),
    delivery_area: z.string().optional(),
    truck_capacity_filter: z.boolean().default(false),
    optimize_routes: z.boolean().default(false),
  });

  // ============ Order Creation & Updates ============

  export const OrderLineSchema = z.object({
    product_id: z.string().uuid(),
    quantity: z.number().positive(),
    unit_price: z.number().positive().optional(),
    expected_price: z.number().positive().optional(),
    price_list_id: z.string().uuid().optional(),
    include_deposit: z.boolean().default(false),
    pricing_method: z.enum(['per_unit', 'per_kg', 'flat_rate', 'tiered']).default('per_unit'),
    // Tax information (fixed at order creation time)
    price_excluding_tax: z.number().positive().optional(),
    tax_amount: z.number().min(0).optional(),
    price_including_tax: z.number().positive().optional(),
    tax_rate: z.number().min(0).max(1).optional(),
    // Partial fill fields
    fill_percentage: z.number().min(25).max(100).optional().default(100),
    is_partial_fill: z.boolean().optional().default(false),
    partial_fill_notes: z.string().optional(),
    // Pricing breakdown fields
    gas_charge: z.number().min(0).optional(),
    deposit_amount: z.number().min(0).optional(),
    original_weight: z.number().min(0).optional(),
  });

  export const OrderLineConvertSchema = z.object({
    product_id: z.string().uuid(),
    quantity: z.number().positive(),
    // Partial fill fields for visit conversions
    fill_percentage: z.number().min(25).max(100).optional().default(100),
    is_partial_fill: z.boolean().optional().default(false),
    partial_fill_notes: z.string().optional(),
  });

  export const CreateOrderSchema = z.object({
    customer_id: z.string().uuid(),
    delivery_address_id: z.string().uuid().optional(),
    source_warehouse_id: z.string().uuid().optional(),
    order_date: z.string().optional(),
    scheduled_date: z.string().datetime().nullable().optional(),
    delivery_date: z.string().optional(),
    delivery_time_window_start: z.string().optional(),
    delivery_time_window_end: z.string().optional(),
    delivery_instructions: z.string().optional(),
    notes: z.string().optional(),
    idempotency_key: z.string().optional(),
    validate_pricing: z.boolean().default(true),
    skip_inventory_check: z.boolean().default(false),
    // Order type fields
    order_type: OrderTypeEnum.default('delivery'),
    order_flow_type: z.enum(['outright', 'exchange', 'refill']).optional(),
    service_type: ServiceTypeEnum.default('standard'),
    exchange_empty_qty: z.number().min(0).default(0),
    requires_pickup: z.boolean().default(false),
    order_lines: z.array(OrderLineSchema).optional(),
  });

  export const CalculateOrderTotalSchema = z.object({
    order_id: z.string().uuid(),
  });

  export const UpdateOrderStatusSchema = z.object({
    order_id: z.string().uuid(),
    new_status: OrderStatusEnum,
    scheduled_date: z.string().datetime().nullable().optional(),
    reason: z.string().optional(),
    metadata: z.record(z.any()).optional(),
  });

  export const UpdateOrderTaxSchema = z.object({
    order_id: z.string().uuid(),
    tax_percent: z.number().min(0).max(100),
  });

  // ============ Workflow Operations ============

  export const StatusTransitionSchema = z.object({
    current_status: OrderStatusEnum,
    new_status: OrderStatusEnum,
  });

  export const CalculateTotalsSchema = z.object({
    lines: z.array(z.object({
      quantity: z.number().positive(),
      unit_price: z.number().positive(),
      subtotal: z.number().optional(),
    })),
    tax_percent: z.number().min(0).max(100).optional(),
  });

  export const ValidateOrderSchema = z.object({
    order: z.any(), // Complex order object - validated in business logic
  });

  export const GetWorkflowInfoSchema = z.object({
    order_id: z.string().uuid(),
  });

  // ============ Utility Operations ============

  export const FormatOrderIdSchema = z.object({
    order_id: z.string().uuid(),
  });

  export const FormatCurrencySchema = z.object({
    amount: z.number(),
  });

  export const FormatDateSchema = z.object({
    date: z.string().datetime(),
  });

  // ============ Pricing & Validation ============

  export const ValidateOrderPricingSchema = z.object({
    customer_id: z.string().uuid(),
    order_lines: z.array(z.object({
      product_id: z.string().uuid(),
      quantity: z.number().positive(),
      expected_price: z.number().positive().optional(),
      price_list_id: z.string().uuid().nullable().optional(),
    })).min(1),
  });

  export const ValidateTruckCapacitySchema = z.object({
    truck_id: z.string().uuid(),
    order_ids: z.array(z.string().uuid()).min(1),
  });

  // ============ Truck Allocation ============

  export const AllocateToTruckSchema = z.object({
    order_id: z.string().uuid(),
    truck_id: z.string().uuid().optional(),
    allocation_date: z.string(),
    force_allocation: z.boolean().default(false),
  });

  export const GetAllocationSuggestionsSchema = z.object({
    order_id: z.string().uuid(),
    allocation_date: z.string(),
  });

  export const CalculateOrderWeightSchema = z.object({
    order_id: z.string().uuid(),
  });

  export const RemoveAllocationSchema = z.object({
    allocation_id: z.string().uuid(),
  });

  export const GetDailyScheduleSchema = z.object({
    date: z.string(),
  });

  export const ProcessRefillOrderSchema = z.object({
    order_id: z.string().uuid(),
    warehouse_id: z.string().uuid().optional(),
  });

  // ============ Visit Order Operations ============

  export const ConvertVisitToDeliverySchema = z.object({
    order_id: z.string().uuid(),
    order_lines: z.array(OrderLineConvertSchema).min(1, 'At least one order line is required'),
  });

  // export const CompleteVisitWithNoSaleSchema = z.object({
  //   order_id: z.string().uuid(),
  //   notes: z.string().optional(),
  //   reason: z.string().optional(),
  // }); 