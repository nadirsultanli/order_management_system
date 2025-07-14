import { trpc } from '../lib/trpc-client';
import toast from 'react-hot-toast';
import {
  PaymentFilters,
  RecordPaymentInput,
  GetPaymentByIdInput,
  GetPaymentsByOrderInput,
  UpdatePaymentStatusInput,
  PaymentSummaryFilters,
  OverdueOrdersFilters,
  InitiateMpesaPaymentInput,
  ManualStatusCheckInput,
  PaymentListResponse,
  PaymentDetailResponse,
  CreatePaymentResponse,
  UpdatePaymentResponse,
  OrderPaymentsResponse,
  PaymentSummaryStats,
  OverdueOrdersResponse,
  InitiateMpesaPaymentResponse,
  ManualStatusCheckResponse,
} from '../types/payment';

// ============ Payment Listing ============

/**
 * Hook for fetching payments with comprehensive filtering options
 */
export const usePayments = (filters: PaymentFilters = {}) => {
  return trpc.payments.list.useQuery(
    {
      order_id: filters.order_id,
      payment_method: filters.payment_method,
      payment_status: filters.payment_status,
      date_from: filters.date_from,
      date_to: filters.date_to,
      amount_min: filters.amount_min,
      amount_max: filters.amount_max,
      search: filters.search,
      sort_by: filters.sort_by || 'payment_date',
      sort_order: filters.sort_order || 'desc',
      page: filters.page || 1,
      limit: filters.limit || 50,
    },
    {
      enabled: true,
      staleTime: 30000, // 30 seconds
      retry: 1,
      onError: (error) => {
        console.error('Payments fetch error:', error);
        toast.error('Failed to load payments');
      },
    }
  );
};

// ============ Single Payment Operations ============

/**
 * Hook for fetching a single payment by ID
 */
export const usePayment = (paymentId: string) => {
  return trpc.payments.getById.useQuery(
    {
      payment_id: paymentId,
    },
    {
      enabled: !!paymentId && paymentId !== 'null' && paymentId !== 'undefined',
      staleTime: 30000,
      retry: 1,
      onError: (error) => {
        console.error('Payment fetch error:', error);
        toast.error('Failed to load payment details');
      },
    }
  );
};

/**
 * Hook for fetching payments by order ID
 */
export const usePaymentsByOrder = (orderId: string, includeSummary: boolean = true) => {
  return trpc.payments.getByOrderId.useQuery(
    {
      order_id: orderId,
      include_summary: includeSummary,
    },
    {
      enabled: !!orderId && orderId !== 'null' && orderId !== 'undefined',
      staleTime: 30000,
      retry: 1,
      onError: (error) => {
        console.error('Order payments fetch error:', error);
        toast.error('Failed to load order payments');
      },
    }
  );
};

// ============ Payment Creation (Cash, Card, Mpesa) ============

/**
 * Hook for creating payments (handles Cash, Card, and initiates Mpesa payments)
 * For Mpesa payments, this creates a pending payment and initiates STK push
 */
export const useCreatePayment = () => {
  const utils = trpc.useContext();

  return trpc.payments.create.useMutation({
    onSuccess: (newPayment, variables) => {
      console.log('Payment created successfully:', newPayment);

      // Invalidate relevant queries
      utils.payments.list.invalidate();
      utils.payments.getByOrderId.invalidate({ order_id: variables.order_id });
      utils.payments.getSummary.invalidate();

      // Show appropriate success message based on payment method
      if (variables.payment_method === 'Mpesa') {
        toast.success('M-Pesa payment initiated! Please check your phone.');
      } else {
        toast.success(`${variables.payment_method} payment recorded successfully`);
      }
    },
    onError: (error) => {
      console.error('Create payment error:', error);
      
      // Handle specific error cases
      if (error.message.includes('already in progress')) {
        toast.error('Payment already in progress for this order');
      } else if (error.message.includes('exceeds order balance')) {
        toast.error('Payment amount exceeds remaining order balance');
      } else if (error.message.includes('M-Pesa payment has already been processed')) {
        toast.error('This M-Pesa payment has already been processed');
      } else {
        toast.error(error.message || 'Failed to process payment');
      }
    },
  });
};

// ============ M-Pesa Specific Operations ============

/**
 * Hook for initiating M-Pesa payments via STK push
 */
export const useInitiateMpesa = () => {
  const utils = trpc.useContext();

  return trpc.payments.initiateMpesa.useMutation({
    onSuccess: (response, variables) => {
      console.log('M-Pesa payment initiated successfully:', response);

      // Invalidate relevant queries
      utils.payments.list.invalidate();
      utils.payments.getByOrderId.invalidate({ order_id: variables.order_id });

      toast.success('M-Pesa payment initiated! Please check your phone for the payment prompt.');
    },
    onError: (error) => {
      console.error('M-Pesa initiation error:', error);
      
      if (error.message.includes('already in progress')) {
        toast.error('M-Pesa payment already in progress. Please wait or check status.');
      } else if (error.message.includes('Phone number')) {
        toast.error('Invalid phone number format. Use 254XXXXXXXXX');
      } else {
        toast.error(error.message || 'Failed to initiate M-Pesa payment');
      }
    },
  });
};

/**
 * Hook for manually checking M-Pesa payment status
 */
export const useMpesaStatusCheck = () => {
  const utils = trpc.useContext();

  return trpc.payments.manualStatusCheck.useMutation({
    onSuccess: (response, variables) => {
      console.log('M-Pesa status check completed:', response);

      // Invalidate payments to refresh status
      utils.payments.list.invalidate();

      if (response.success) {
        toast.success(`Payment status updated: ${response.payment_status}`);
      } else {
        toast.error(response.error || 'Payment status check failed');
      }
    },
    onError: (error) => {
      console.error('M-Pesa status check error:', error);
      toast.error('Failed to check M-Pesa payment status');
    },
  });
};

// ============ Payment Status Management ============

/**
 * Hook for updating payment status
 */
export const useUpdatePaymentStatus = () => {
  const utils = trpc.useContext();

  return trpc.payments.updateStatus.useMutation({
    onSuccess: (updatedPayment, variables) => {
      console.log('Payment status updated successfully:', updatedPayment);

      // Invalidate relevant queries
      utils.payments.list.invalidate();
      utils.payments.getById.invalidate({ payment_id: variables.payment_id });
      utils.payments.getByOrderId.invalidate({ order_id: updatedPayment.order_id });
      utils.payments.getSummary.invalidate();

      toast.success(`Payment status updated to ${variables.payment_status}`);
    },
    onError: (error) => {
      console.error('Update payment status error:', error);
      toast.error(error.message || 'Failed to update payment status');
    },
  });
};

// ============ Payment Analytics & Summaries ============

/**
 * Hook for fetching payment summary statistics
 */
export const usePaymentSummary = (filters: PaymentSummaryFilters = {}) => {
  return trpc.payments.getSummary.useQuery(
    {
      date_from: filters.date_from || '',
      date_to: filters.date_to || '',
      payment_method: filters.payment_method,
    },
    {
      enabled: true,
      staleTime: 60000, // 1 minute
      retry: 1,
      onError: (error) => {
        console.error('Payment summary fetch error:', error);
        toast.error('Failed to load payment summary');
      },
    }
  );
};

/**
 * Hook for fetching overdue orders
 */
export const useOverdueOrders = (filters: OverdueOrdersFilters = {}) => {
  return trpc.payments.getOverdueOrders.useQuery(
    {
      days_overdue_min: filters.days_overdue_min || 1,
      limit: filters.limit || 50,
    },
    {
      enabled: true,
      staleTime: 60000, // 1 minute
      retry: 1,
      onError: (error) => {
        console.error('Overdue orders fetch error:', error);
        toast.error('Failed to load overdue orders');
      },
    }
  );
};

// ============ Utility Hooks ============

/**
 * Hook to get tRPC context for manual invalidations
 */
export const usePaymentsContext = () => {
  return trpc.useContext().payments;
};

/**
 * Hook for real-time M-Pesa payment status polling
 * Automatically polls for payment status updates
 */
export const useMpesaStatusPolling = (
  checkoutRequestId: string | null,
  options: {
    enabled?: boolean;
    intervalMs?: number;
    maxAttempts?: number;
  } = {}
) => {
  const {
    enabled = true,
    intervalMs = 5000, // 5 seconds
    maxAttempts = 24, // 2 minutes total (24 * 5s)
  } = options;

  const statusCheck = useMpesaStatusCheck();
  
  // Use React Query's polling capabilities with mutations
  return {
    startPolling: () => {
      if (!checkoutRequestId || !enabled) return;

      let attempts = 0;
      const pollInterval = setInterval(() => {
        attempts++;
        
        if (attempts > maxAttempts) {
          clearInterval(pollInterval);
          toast.error('Payment status check timeout. Please check manually.');
          return;
        }

        statusCheck.mutate({ checkout_request_id: checkoutRequestId });
        
        // Stop polling if we get a definitive status
        if (statusCheck.data?.payment_status && 
            ['completed', 'failed'].includes(statusCheck.data.payment_status)) {
          clearInterval(pollInterval);
        }
      }, intervalMs);

      return () => clearInterval(pollInterval);
    },
    isPolling: statusCheck.isLoading,
    data: statusCheck.data,
    error: statusCheck.error,
  };
};

/**
 * Optimistic updates hook for payment operations
 * Provides instant UI feedback while API calls are in progress
 */
export const useOptimisticPayments = () => {
  const utils = trpc.useContext();

  const optimisticUpdate = (
    type: 'create' | 'update' | 'statusChange',
    paymentData: any
  ) => {
    // Cancel any outgoing refetches
    utils.payments.list.cancel();

    // Snapshot the previous value
    const previousData = utils.payments.list.getData();

    // Optimistically update to the new value
    if (previousData) {
      utils.payments.list.setData(undefined, (old) => {
        if (!old) return old;

        switch (type) {
          case 'create':
            return {
              ...old,
              payments: [paymentData, ...old.payments],
              totalCount: old.totalCount + 1,
            };
          case 'update':
          case 'statusChange':
            return {
              ...old,
              payments: old.payments.map((payment) =>
                payment.id === paymentData.id ? { ...payment, ...paymentData } : payment
              ),
            };
          default:
            return old;
        }
      });
    }

    // Return a rollback function
    return () => {
      utils.payments.list.setData(undefined, previousData);
    };
  };

  return { optimisticUpdate };
};

// ============ Composite Hooks for Complex Operations ============

/**
 * Hook that combines payment creation with automatic status polling for M-Pesa
 */
export const useCreatePaymentWithPolling = () => {
  const createPayment = useCreatePayment();
  const statusPolling = useMpesaStatusPolling(null);

  const createPaymentWithPolling = async (paymentData: RecordPaymentInput) => {
    try {
      const result = await createPayment.mutateAsync(paymentData);

      // If it's an M-Pesa payment, start polling for status
      if (paymentData.payment_method === 'Mpesa' && result.transaction_id) {
        const cleanup = statusPolling.startPolling();
        
        // Clean up polling after 2 minutes
        setTimeout(() => {
          cleanup?.();
        }, 120000);
      }

      return result;
    } catch (error) {
      throw error;
    }
  };

  return {
    createPayment: createPaymentWithPolling,
    isLoading: createPayment.isLoading,
    isError: createPayment.isError,
    error: createPayment.error,
    reset: createPayment.reset,
  };
};

/**
 * Hook for comprehensive order payment management
 * Provides all payment operations for a specific order
 */
export const useOrderPaymentManager = (orderId: string) => {
  const orderPayments = usePaymentsByOrder(orderId);
  const createPayment = useCreatePayment();
  const updateStatus = useUpdatePaymentStatus();
  const initiateMpesa = useInitiateMpesa();

  const orderTotal = orderPayments.data?.order.total_amount || 0;
  const totalPaid = orderPayments.data?.summary?.total_payments || 0;
  const balance = orderPayments.data?.summary?.balance || 0;
  const paymentStatus = orderPayments.data?.summary?.payment_status || 'pending';

  return {
    // Data
    payments: orderPayments.data?.payments || [],
    order: orderPayments.data?.order,
    summary: orderPayments.data?.summary,
    
    // Calculated values
    orderTotal,
    totalPaid,
    balance,
    paymentStatus,
    isFullyPaid: balance <= 0,
    isPartiallyPaid: totalPaid > 0 && balance > 0,
    
    // Actions
    createPayment: (data: Omit<RecordPaymentInput, 'order_id'>) =>
      createPayment.mutate({ ...data, order_id: orderId }),
    
    initiateMpesa: (data: Omit<InitiateMpesaPaymentInput, 'order_id'>) =>
      initiateMpesa.mutate({ ...data, order_id: orderId }),
    
    updatePaymentStatus: (paymentId: string, status: UpdatePaymentStatusInput['payment_status']) =>
      updateStatus.mutate({ payment_id: paymentId, payment_status: status }),
    
    // Loading states
    isLoading: orderPayments.isLoading,
    isCreating: createPayment.isLoading,
    isUpdating: updateStatus.isLoading,
    isInitiatingMpesa: initiateMpesa.isLoading,
    
    // Error states
    error: orderPayments.error || createPayment.error || updateStatus.error || initiateMpesa.error,
    
    // Refetch
    refetch: orderPayments.refetch,
  };
};

// ============ Error Handling Utilities ============

/**
 * Hook for centralized payment error handling
 */
export const usePaymentErrorHandler = () => {
  const handleError = (error: any, context: string = 'payment operation') => {
    console.error(`Payment error in ${context}:`, error);

    // Handle specific error types
    if (error.code === 'NOT_FOUND') {
      toast.error('Payment or order not found');
    } else if (error.code === 'BAD_REQUEST') {
      if (error.message.includes('already in progress')) {
        toast.error('Payment already in progress');
      } else if (error.message.includes('exceeds order balance')) {
        toast.error('Payment amount exceeds order balance');
      } else {
        toast.error(error.message || 'Invalid request');
      }
    } else if (error.code === 'UNAUTHORIZED') {
      toast.error('You are not authorized to perform this action');
    } else if (error.code === 'INTERNAL_SERVER_ERROR') {
      toast.error('Server error. Please try again later.');
    } else {
      toast.error(error.message || `Failed to complete ${context}`);
    }
  };

  return { handleError };
};

// ============ Export All Hooks ============

export {
  // Main payment operations
  usePayments,
  usePayment,
  usePaymentsByOrder,
  useCreatePayment,
  useUpdatePaymentStatus,
  
  // M-Pesa specific
  useInitiateMpesa,
  useMpesaStatusCheck,
  useMpesaStatusPolling,
  
  // Analytics
  usePaymentSummary,
  useOverdueOrders,
  
  // Utilities
  usePaymentsContext,
  useOptimisticPayments,
  
  // Composite hooks
  useCreatePaymentWithPolling,
  useOrderPaymentManager,
  
  // Error handling
  usePaymentErrorHandler,
};