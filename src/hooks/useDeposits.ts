import { trpc } from '../lib/trpc-client';
import toast from 'react-hot-toast';
import { 
  DepositRateFilters, 
  CustomerDepositFilters, 
  DepositTransactionFilters,
  CreateDepositRateData,
  UpdateDepositRateData,
  ChargeDepositData,
  RefundDepositData,
  AdjustDepositData
} from '../types/deposits';

// ============ DEPOSIT RATE HOOKS ============

export const useDepositRates = (filters: DepositRateFilters = {}) => {
  return trpc.deposits.listDepositRates.useQuery({
    ...filters,
    page: filters.page || 1,
    limit: filters.limit || 15,
  }, {
    enabled: true,
    staleTime: 30000,
    retry: 1,
    onError: (error: any) => {
      console.error('Deposit rates fetch error:', error);
      toast.error('Failed to load deposit rates');
    }
  });
};

export const useDepositRate = (rateId: string) => {
  return trpc.deposits.getDepositRateById.useQuery({
    rate_id: rateId,
  }, {
    enabled: !!rateId && rateId !== 'null' && rateId !== 'undefined',
    staleTime: 30000,
    retry: 1,
    onError: (error: any) => {
      console.error('Deposit rate fetch error:', error);
      toast.error('Failed to load deposit rate details');
    }
  });
};

export const useCreateDepositRate = () => {
  const utils = trpc.useContext();
  
  return trpc.deposits.createDepositRate.useMutation({
    onSuccess: (newRate) => {
      console.log('Deposit rate created successfully:', newRate);
      
      // Invalidate deposit rates list to refetch
      utils.deposits.listDepositRates.invalidate();
      
      toast.success('Deposit rate created successfully');
    },
    onError: (error) => {
      console.error('Create deposit rate error:', error);
      toast.error(error.message || 'Failed to create deposit rate');
    },
  });
};

export const useUpdateDepositRate = () => {
  const utils = trpc.useContext();
  
  return trpc.deposits.updateDepositRate.useMutation({
    onSuccess: (updatedRate) => {
      console.log('Deposit rate updated successfully:', updatedRate);
      
      // Invalidate queries to refetch updated data
      utils.deposits.listDepositRates.invalidate();
      utils.deposits.getDepositRateById.invalidate({ rate_id: updatedRate.id });
      
      toast.success('Deposit rate updated successfully');
    },
    onError: (error) => {
      console.error('Update deposit rate error:', error);
      toast.error(error.message || 'Failed to update deposit rate');
    },
  });
};

export const useDeleteDepositRate = () => {
  const utils = trpc.useContext();
  
  return trpc.deposits.deleteDepositRate.useMutation({
    onSuccess: () => {
      console.log('Deposit rate deleted successfully');
      
      // Invalidate deposit rates list to refetch
      utils.deposits.listDepositRates.invalidate();
      
      toast.success('Deposit rate deleted successfully');
    },
    onError: (error) => {
      console.error('Delete deposit rate error:', error);
      toast.error(error.message || 'Failed to delete deposit rate');
    },
  });
};

export const useDepositRateByCapacity = (capacity: number) => {
  return trpc.deposits.getDepositRateByCapacity.useQuery({
    capacity_l: capacity,
  }, {
    enabled: !!capacity && capacity > 0,
    staleTime: 60000, // 1 minute for rate lookups
    retry: 1,
    onError: (error: any) => {
      console.error('Deposit rate lookup error:', error);
      // Don't show error toast for rate lookups as they might be frequent
    }
  });
};

// ============ CUSTOMER DEPOSIT HOOKS ============

export const useCustomerDepositBalance = (customerId: string) => {
  return trpc.deposits.getCustomerDepositBalance.useQuery({
    customer_id: customerId,
  }, {
    enabled: !!customerId && customerId !== 'null' && customerId !== 'undefined',
    staleTime: 30000,
    retry: 1,
    onError: (error: any) => {
      console.error('Customer deposit balance fetch error:', error);
      toast.error('Failed to load customer deposit balance');
    }
  });
};

export const useCustomerDepositHistory = (customerId: string, filters: Omit<CustomerDepositFilters, 'customer_id'> = {}) => {
  return trpc.deposits.getCustomerDepositHistory.useQuery({
    customer_id: customerId,
    ...filters,
    page: filters.page || 1,
    limit: filters.limit || 15,
  }, {
    enabled: !!customerId && customerId !== 'null' && customerId !== 'undefined',
    staleTime: 30000,
    retry: 1,
    onError: (error: any) => {
      console.error('Customer deposit history fetch error:', error);
      toast.error('Failed to load customer deposit history');
    }
  });
};

export const useChargeCustomerDeposit = () => {
  const utils = trpc.useContext();
  
  return trpc.deposits.chargeCustomerDeposit.useMutation({
    onSuccess: (result, variables) => {
      console.log('Customer deposit charged successfully:', result);
      
      // Invalidate customer deposit data
      utils.deposits.getCustomerDepositBalance.invalidate({ customer_id: variables.customer_id });
      utils.deposits.getCustomerDepositHistory.invalidate({ customer_id: variables.customer_id });
      utils.deposits.listDepositTransactions.invalidate();
      
      toast.success(`Deposit charged: ${result.currency_code} ${result.total_charged.toFixed(2)}`);
    },
    onError: (error) => {
      console.error('Charge customer deposit error:', error);
      toast.error(error.message || 'Failed to charge customer deposit');
    },
  });
};

export const useRefundCustomerDeposit = () => {
  const utils = trpc.useContext();
  
  return trpc.deposits.refundCustomerDeposit.useMutation({
    onSuccess: (result, variables) => {
      console.log('Customer deposit refunded successfully:', result);
      
      // Invalidate customer deposit data
      utils.deposits.getCustomerDepositBalance.invalidate({ customer_id: variables.customer_id });
      utils.deposits.getCustomerDepositHistory.invalidate({ customer_id: variables.customer_id });
      utils.deposits.listDepositTransactions.invalidate();
      
      toast.success(`Deposit refunded: ${result.currency_code} ${result.total_refunded.toFixed(2)}`);
    },
    onError: (error) => {
      console.error('Refund customer deposit error:', error);
      toast.error(error.message || 'Failed to refund customer deposit');
    },
  });
};

export const useCalculateDepositRefund = () => {
  return trpc.deposits.calculateDepositRefund.useMutation({
    onSuccess: (calculation) => {
      console.log('Deposit refund calculated:', calculation);
    },
    onError: (error) => {
      console.error('Calculate deposit refund error:', error);
      toast.error(error.message || 'Failed to calculate refund amount');
    },
  });
};

export const useAdjustCustomerDeposit = () => {
  const utils = trpc.useContext();
  
  return trpc.deposits.adjustCustomerDeposit.useMutation({
    onSuccess: (result, variables) => {
      console.log('Customer deposit adjusted successfully:', result);
      
      // Invalidate customer deposit data
      utils.deposits.getCustomerDepositBalance.invalidate({ customer_id: variables.customer_id });
      utils.deposits.getCustomerDepositHistory.invalidate({ customer_id: variables.customer_id });
      utils.deposits.listDepositTransactions.invalidate();
      
      toast.success(`Deposit adjusted: ${result.currency_code} ${result.adjustment_amount.toFixed(2)}`);
    },
    onError: (error) => {
      console.error('Adjust customer deposit error:', error);
      toast.error(error.message || 'Failed to adjust customer deposit');
    },
  });
};

// ============ TRANSACTION MANAGEMENT HOOKS ============

export const useDepositTransactions = (filters: DepositTransactionFilters = {}) => {
  return trpc.deposits.listDepositTransactions.useQuery({
    ...filters,
    page: filters.page || 1,
    limit: filters.limit || 15,
  }, {
    enabled: true,
    staleTime: 30000,
    retry: 1,
    onError: (error: any) => {
      console.error('Deposit transactions fetch error:', error);
      toast.error('Failed to load deposit transactions');
    }
  });
};

export const useDepositTransaction = (transactionId: string) => {
  return trpc.deposits.getDepositTransactionById.useQuery({
    transaction_id: transactionId,
  }, {
    enabled: !!transactionId && transactionId !== 'null' && transactionId !== 'undefined',
    staleTime: 30000,
    retry: 1,
    onError: (error: any) => {
      console.error('Deposit transaction fetch error:', error);
      toast.error('Failed to load transaction details');
    }
  });
};

export const useVoidDepositTransaction = () => {
  const utils = trpc.useContext();
  
  return trpc.deposits.voidDepositTransaction.useMutation({
    onSuccess: (result) => {
      console.log('Deposit transaction voided successfully:', result);
      
      // Invalidate transaction lists and related data
      utils.deposits.listDepositTransactions.invalidate();
      utils.deposits.getDepositTransactionById.invalidate({ transaction_id: result.id });
      
      // Invalidate customer deposit data if we have customer_id
      if (result.customer_id) {
        utils.deposits.getCustomerDepositBalance.invalidate({ customer_id: result.customer_id });
        utils.deposits.getCustomerDepositHistory.invalidate({ customer_id: result.customer_id });
      }
      
      toast.success('Transaction voided successfully');
    },
    onError: (error) => {
      console.error('Void deposit transaction error:', error);
      toast.error(error.message || 'Failed to void transaction');
    },
  });
};

// ============ ANALYTICS & REPORTING HOOKS ============

export const useDepositSummaryStats = (period?: { from_date: string; to_date: string } | null) => {
  const defaultPeriod = {
    from_date: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    to_date: new Date().toISOString().split('T')[0],
  };

  return trpc.deposits.getDepositSummary.useQuery({
    period: period === null ? defaultPeriod : (period || defaultPeriod),
  }, {
    enabled: period !== null, // Only enable when period is not explicitly null
    staleTime: 60000, // 1 minute for summary stats
    retry: 1,
    onError: (error: any) => {
      console.error('Deposit summary stats fetch error:', error);
      toast.error('Failed to load deposit summary');
    }
  });
};

export const useOutstandingDepositsReport = () => {
  return trpc.deposits.getOutstandingDepositsReport.useQuery({}, {
    enabled: true,
    staleTime: 60000, // 1 minute for reports
    retry: 1,
    onError: (error: any) => {
      console.error('Outstanding deposits report fetch error:', error);
      toast.error('Failed to load outstanding deposits report');
    }
  });
};

export const useDepositAnalytics = (period: { from_date: string; to_date: string }) => {
  return trpc.deposits.getDepositAnalytics.useQuery({
    period,
  }, {
    enabled: !!period.from_date && !!period.to_date,
    staleTime: 60000, // 1 minute for analytics
    retry: 1,
    onError: (error: any) => {
      console.error('Deposit analytics fetch error:', error);
      toast.error('Failed to load deposit analytics');
    }
  });
};

// ============ UTILITY HOOKS ============

export const useValidateDepositRate = () => {
  return trpc.deposits.validateDepositRate.useMutation({
    onSuccess: (validation) => {
      console.log('Deposit rate validation completed:', validation);
    },
    onError: (error) => {
      console.error('Deposit rate validation error:', error);
      toast.error(error.message || 'Validation failed');
    },
  });
};

export const useValidateDepositRefund = () => {
  return trpc.deposits.validateDepositRefund.useMutation({
    onSuccess: (validation) => {
      console.log('Deposit refund validation completed:', validation);
    },
    onError: (error) => {
      console.error('Deposit refund validation error:', error);
      toast.error(error.message || 'Refund validation failed');
    },
  });
};

// Utility hook to get deposits context
export const useDepositsContext = () => {
  return trpc.useContext().deposits;
};