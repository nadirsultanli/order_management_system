import { z } from 'zod';

// ==============================================================
// PAYMENTS OUTPUT SCHEMAS
// ==============================================================

// ============ Base Entities ============

export const CustomerBaseSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  phone: z.string().optional(),
});

export const AddressBaseSchema = z.object({
  id: z.string(),
  line1: z.string(),
  line2: z.string().optional(),
  city: z.string(),
  state: z.string(),
  postal_code: z.string(),
  country: z.string(),
});

export const OrderBaseSchema = z.object({
  id: z.string(),
  total_amount: z.number(),
  status: z.string(),
  payment_status_cache: z.string().optional(),
  customer: CustomerBaseSchema.optional(),
  delivery_address: AddressBaseSchema.optional(),
});

export const PaymentBaseSchema = z.object({
  id: z.string(),
  order_id: z.string(),
  amount: z.number(),
  payment_method: z.enum(['Cash', 'Mpesa', 'Card']),
  payment_status: z.enum(['pending', 'completed', 'failed', 'refunded']),
  transaction_id: z.string().optional(),
  payment_date: z.string(),
  reference_number: z.string().optional(),
  notes: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  created_by: z.string().optional(),
  paid_by: z.string(), // The customer making the payment
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  updated_by: z.string().optional(),
});

// ============ Core Payment Operations ============

export const CreatePaymentResponseSchema = PaymentBaseSchema.extend({
  order: OrderBaseSchema.optional(),
  payment_summary: z.object({
    order_total: z.number(),
    total_payments: z.number(),
    balance: z.number(),
    payment_status: z.string(),
    payment_count: z.number(),
    last_payment_date: z.string().nullable(),
  }).optional(),
  payment_balance: z.number().optional(),
});

export const PaymentDetailResponseSchema = PaymentBaseSchema.extend({
  order: OrderBaseSchema.optional(),
});

export const UpdatePaymentResponseSchema = PaymentBaseSchema.extend({
  order: OrderBaseSchema.optional(),
});

// ============ Payment Listing ============

export const PaymentSummaryStatsSchema = z.object({
  total_amount: z.number(),
  total_count: z.number(),
  completed_amount: z.number(),
  completed_count: z.number(),
  pending_amount: z.number(),
  pending_count: z.number(),
  failed_amount: z.number(),
  failed_count: z.number(),
  by_method: z.object({
    Cash: z.object({
      amount: z.number(),
      count: z.number(),
    }),
    Mpesa: z.object({
      amount: z.number(),
      count: z.number(),
    }),
    Card: z.object({
      amount: z.number(),
      count: z.number(),
    }),
  }),
  by_status: z.object({
    pending: z.object({
      amount: z.number(),
      count: z.number(),
    }),
    completed: z.object({
      amount: z.number(),
      count: z.number(),
    }),
    failed: z.object({
      amount: z.number(),
      count: z.number(),
    }),
    refunded: z.object({
      amount: z.number(),
      count: z.number(),
    }),
  }),
});

export const PaymentListItemSchema = PaymentBaseSchema.extend({
  order: z.object({
    id: z.string(),
    total_amount: z.number(),
    status: z.string(),
    customer: CustomerBaseSchema.optional(),
  }).optional(),
});

export const PaymentListResponseSchema = z.object({
  payments: z.array(PaymentListItemSchema),
  totalCount: z.number(),
  totalPages: z.number(),
  currentPage: z.number(),
  summary: PaymentSummaryStatsSchema,
});

// ============ Order Payment Operations ============

export const OrderPaymentSummarySchema = z.object({
  order_total: z.number(),
  total_payments: z.number(),
  balance: z.number(),
  payment_status: z.string(),
  payment_count: z.number(),
  last_payment_date: z.string().nullable(),
});

export const OrderPaymentsResponseSchema = z.object({
  order: z.object({
    id: z.string(),
    total_amount: z.number(),
    status: z.string(),
    payment_status: z.string().optional(),
  }),
  payments: z.array(PaymentBaseSchema),
  summary: OrderPaymentSummarySchema.nullable(),
});

// ============ Payment Analytics ============

export const PaymentSummaryResponseSchema = PaymentSummaryStatsSchema;

export const OverdueOrderItemSchema = z.object({
  id: z.string(),
  total_amount: z.number(),
  status: z.string(),
  payment_due_date: z.string().optional(),
  payment_status_cache: z.string().optional(),
  invoice_date: z.string().optional(),
  customer: CustomerBaseSchema.optional(),
  days_overdue: z.number(),
  urgency_level: z.enum(['medium', 'high', 'critical']),
});

export const OverdueOrdersSummarySchema = z.object({
  total_overdue: z.number(),
  total_amount: z.number(),
  critical_count: z.number(),
  high_count: z.number(),
});

export const OverdueOrdersResponseSchema = z.object({
  orders: z.array(OverdueOrderItemSchema),
  summary: OverdueOrdersSummarySchema,
});

export const InitiateMpesaPaymentResponseSchema = z.object({
  checkout_request_id: z.string(),
  merchant_request_id: z.string(),
  response_code: z.string(),
  response_description: z.string(),
  customer_message: z.string(),
  payment_id: z.string(),
}); 

export const ManualStatusCheckResponseSchema = z.object({
  success: z.boolean(),
  payment_status: z.string().optional(),
  error: z.string().optional(),
});