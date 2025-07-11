import { z } from 'zod';

// ==============================================================
// PAYMENTS INPUT SCHEMAS
// ==============================================================

// ============ Base Enums ============

export const PaymentMethodEnum = z.enum(['Cash', 'Mpesa', 'Card']);
export const PaymentStatusEnum = z.enum(['pending', 'completed', 'failed', 'refunded']);

// ============ Core Payment Operations ============

export const RecordPaymentSchema = z.object({
  order_id: z.string().uuid(),
  amount: z.number().positive(),
  payment_method: PaymentMethodEnum,
  transaction_id: z.string().optional(),
  payment_date: z.string().datetime().optional(),
  reference_number: z.string().optional(),
  notes: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

export const PaymentFiltersSchema = z.object({
  order_id: z.string().uuid().optional(),
  payment_method: PaymentMethodEnum.optional(),
  payment_status: PaymentStatusEnum.optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  amount_min: z.number().optional(),
  amount_max: z.number().optional(),
  search: z.string().optional(), // Search by payment_id, transaction_id, or reference_number
  sort_by: z.enum(['payment_date', 'amount', 'created_at', 'payment_id']).default('payment_date'),
  sort_order: z.enum(['asc', 'desc']).default('desc'),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(50),
});

export const GetPaymentByIdSchema = z.object({
  payment_id: z.string().uuid(),
});

export const GetPaymentsByOrderSchema = z.object({
  order_id: z.string().uuid(),
  include_summary: z.boolean().default(true),
});

export const UpdatePaymentStatusSchema = z.object({
  payment_id: z.string().uuid(),
  payment_status: PaymentStatusEnum,
  transaction_id: z.string().optional(),
  notes: z.string().optional(),
});

// ============ Payment Analytics ============

export const PaymentSummaryFiltersSchema = z.object({
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  payment_method: PaymentMethodEnum.optional(),
});

export const OverdueOrdersFiltersSchema = z.object({
  days_overdue_min: z.number().min(0).default(1),
  limit: z.number().min(1).max(100).default(50),
}); 