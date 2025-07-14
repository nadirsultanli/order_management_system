// ==============================================================
// PAYMENT TYPES - Frontend TypeScript Interfaces
// ==============================================================
// Comprehensive type definitions matching backend Zod schemas

// ============ Base Enums ============

export type PaymentMethod = 'Cash' | 'Mpesa' | 'Card';
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';
export type MpesaUrgencyLevel = 'medium' | 'high' | 'critical';

// ============ Core Entity Types ============

export interface CustomerBase {
  id: string;
  name: string;
  email: string;
  phone?: string;
}

export interface AddressBase {
  id: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
}

export interface OrderBase {
  id: string;
  total_amount: number;
  status: string;
  payment_status_cache?: string;
  customer?: CustomerBase;
  delivery_address?: AddressBase;
}

export interface PaymentBase {
  id: string;
  order_id: string;
  amount: number;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  transaction_id?: string;
  payment_date: string;
  reference_number?: string;
  notes?: string;
  metadata?: Record<string, any>;
  created_by?: string;
  paid_by: string; // The customer making the payment
  created_at?: string;
  updated_at?: string;
  updated_by?: string;
}

// ============ Input Types for API Calls ============

export interface RecordPaymentInput {
  order_id: string;
  amount: number;
  payment_method: PaymentMethod;
  payment_date?: string;
  reference_number?: string;
  notes?: string;
  metadata?: Record<string, any>;
  paid_by: string; // The customer making the payment
}

export interface PaymentFilters {
  order_id?: string;
  payment_method?: PaymentMethod;
  payment_status?: PaymentStatus;
  date_from?: string;
  date_to?: string;
  amount_min?: number;
  amount_max?: number;
  search?: string; // Search by payment_id, transaction_id, or reference_number
  sort_by?: 'payment_date' | 'amount' | 'created_at' | 'payment_id';
  sort_order?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface GetPaymentByIdInput {
  payment_id: string;
}

export interface GetPaymentsByOrderInput {
  order_id: string;
  include_summary?: boolean;
}

export interface UpdatePaymentStatusInput {
  payment_id: string;
  payment_status: PaymentStatus;
  transaction_id?: string;
  notes?: string;
}

export interface PaymentSummaryFilters {
  date_from?: string;
  date_to?: string;
  payment_method?: PaymentMethod;
}

export interface OverdueOrdersFilters {
  days_overdue_min?: number;
  limit?: number;
}

export interface InitiateMpesaPaymentInput {
  order_id: string;
  customer_id: string; // The customer making the payment
  amount: number;
  phone_number: string; // Format: 254XXXXXXXXX
  reference?: string;
  notes?: string;
  paid_by?: string; // The user/admin/driver who initiated the payment
}

export interface ManualStatusCheckInput {
  checkout_request_id: string; // Mpesa CheckoutRequestID
}

// ============ Response Types ============

export interface PaymentSummary {
  order_total: number;
  total_payments: number;
  balance: number;
  payment_status: string;
  payment_count: number;
  last_payment_date: string | null;
}

export interface CreatePaymentResponse extends PaymentBase {
  order?: OrderBase;
  payment_summary?: PaymentSummary;
  payment_balance?: number;
}

export interface PaymentDetailResponse extends PaymentBase {
  order?: OrderBase;
}

export interface UpdatePaymentResponse extends PaymentBase {
  order?: OrderBase;
}

// ============ Payment Statistics ============

export interface PaymentMethodStats {
  amount: number;
  count: number;
}

export interface PaymentStatusStats {
  amount: number;
  count: number;
}

export interface PaymentSummaryStats {
  total_amount: number;
  total_count: number;
  completed_amount: number;
  completed_count: number;
  pending_amount: number;
  pending_count: number;
  failed_amount: number;
  failed_count: number;
  by_method: {
    Cash: PaymentMethodStats;
    Mpesa: PaymentMethodStats;
    Card: PaymentMethodStats;
  };
  by_status: {
    pending: PaymentStatusStats;
    completed: PaymentStatusStats;
    failed: PaymentStatusStats;
    refunded: PaymentStatusStats;
  };
}

// ============ Payment Listing ============

export interface PaymentListItem extends PaymentBase {
  order?: {
    id: string;
    total_amount: number;
    status: string;
    customer?: CustomerBase;
  };
}

export interface PaymentListResponse {
  payments: PaymentListItem[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  summary: PaymentSummaryStats;
}

// ============ Order Payment Operations ============

export interface OrderPaymentSummary {
  order_total: number;
  total_payments: number;
  balance: number;
  payment_status: string;
  payment_count: number;
  last_payment_date: string | null;
}

export interface OrderPaymentsResponse {
  order: {
    id: string;
    total_amount: number;
    status: string;
    payment_status?: string;
  };
  payments: PaymentBase[];
  summary: OrderPaymentSummary | null;
}

// ============ Mpesa Specific Types ============

export interface InitiateMpesaPaymentResponse {
  checkout_request_id: string;
  merchant_request_id: string;
  response_code: string;
  response_description: string;
  customer_message: string;
  payment_id: string;
}

export interface ManualStatusCheckResponse {
  success: boolean;
  payment_status?: string;
  error?: string;
}

// ============ Overdue Orders ============

export interface OverdueOrderItem {
  id: string;
  total_amount: number;
  status: string;
  payment_due_date?: string;
  payment_status_cache?: string;
  invoice_date?: string;
  customer?: CustomerBase;
  days_overdue: number;
  urgency_level: MpesaUrgencyLevel;
}

export interface OverdueOrdersSummary {
  total_overdue: number;
  total_amount: number;
  critical_count: number;
  high_count: number;
}

export interface OverdueOrdersResponse {
  orders: OverdueOrderItem[];
  summary: OverdueOrdersSummary;
}

// ============ Utility Types ============

export interface PaymentFormData extends Omit<RecordPaymentInput, 'paid_by'> {
  paid_by?: string;
}

export interface MpesaFormData extends Omit<InitiateMpesaPaymentInput, 'customer_id' | 'paid_by'> {
  customer_id?: string;
  paid_by?: string;
}

// ============ State Management Types ============

export interface PaymentState {
  isProcessing: boolean;
  currentPayment?: PaymentBase;
  mpesaStatus?: {
    checkout_request_id: string;
    status: 'pending' | 'completed' | 'failed';
    message?: string;
  };
}

// ============ Error Types ============

export interface PaymentError {
  code: string;
  message: string;
  details?: any;
}

// ============ Component Prop Types ============

export interface PaymentMethodTabsProps {
  selectedMethod: PaymentMethod;
  onMethodChange: (method: PaymentMethod) => void;
  disabled?: boolean;
}

export interface PaymentStatusBadgeProps {
  status: PaymentStatus;
  size?: 'sm' | 'md' | 'lg';
}

export interface PaymentSummaryCardProps {
  summary: PaymentSummaryStats;
  isLoading?: boolean;
}

export interface MpesaStatusIndicatorProps {
  status: 'pending' | 'completed' | 'failed';
  message?: string;
  showSpinner?: boolean;
}

// ============ Utility Function Types ============

export type PaymentStatusFormatter = (status: PaymentStatus) => {
  label: string;
  color: string;
  icon?: string;
};

export type PaymentMethodFormatter = (method: PaymentMethod) => {
  label: string;
  icon?: string;
  color?: string;
};

export type CurrencyFormatter = (amount: number, currency?: string) => string;

export type DateFormatter = (date: string | Date, format?: string) => string;

// ============ Hook Return Types ============

export interface UsePaymentsResult {
  data?: PaymentListResponse;
  isLoading: boolean;
  isError: boolean;
  error?: any;
  refetch: () => void;
}

export interface UsePaymentResult {
  data?: PaymentDetailResponse;
  isLoading: boolean;
  isError: boolean;
  error?: any;
  refetch: () => void;
}

export interface UseCreatePaymentResult {
  mutate: (data: RecordPaymentInput) => void;
  mutateAsync: (data: RecordPaymentInput) => Promise<CreatePaymentResponse>;
  isLoading: boolean;
  isError: boolean;
  isSuccess: boolean;
  error?: any;
  data?: CreatePaymentResponse;
  reset: () => void;
}

export interface UseMpesaPaymentResult {
  initiate: (data: InitiateMpesaPaymentInput) => void;
  initiateAsync: (data: InitiateMpesaPaymentInput) => Promise<InitiateMpesaPaymentResponse>;
  checkStatus: (checkout_request_id: string) => void;
  isInitiating: boolean;
  isCheckingStatus: boolean;
  isError: boolean;
  error?: any;
  data?: InitiateMpesaPaymentResponse;
  statusData?: ManualStatusCheckResponse;
  reset: () => void;
}

// ============ Table Column Types ============

export interface PaymentTableColumn {
  key: keyof PaymentListItem | string;
  label: string;
  sortable?: boolean;
  width?: string;
  render?: (item: PaymentListItem) => React.ReactNode;
}

// ============ Filter Form Types ============

export interface PaymentFilterFormData {
  payment_method?: PaymentMethod;
  payment_status?: PaymentStatus;
  date_from?: string;
  date_to?: string;
  amount_min?: number;
  amount_max?: number;
  search?: string;
}

// ============ Export Helper Types ============

export interface PaymentExportOptions {
  format: 'csv' | 'excel' | 'pdf';
  filters?: PaymentFilters;
  columns?: string[];
  includeDetails?: boolean;
}

// ============ Validation Types ============

export interface PaymentValidationError {
  field: string;
  message: string;
  code?: string;
}

export interface PaymentValidationResult {
  isValid: boolean;
  errors: PaymentValidationError[];
}