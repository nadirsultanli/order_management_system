import { trpc } from '../lib/trpc-client';
import toast from 'react-hot-toast';

// Hook for listing customers
export const useCustomers = (filters: {
  search?: string;
  account_status?: string;
  page?: number;
  limit?: number;
} = {}) => {
  return trpc.customers.list.useQuery({
    search: filters.search,
    account_status: filters.account_status as 'active' | 'credit_hold' | 'closed' | undefined,
    page: filters.page || 1,
    limit: filters.limit || 15,
  }, {
    enabled: true,
    staleTime: 30000,
    retry: 1,
    onError: (error: any) => {
      console.error('Customers fetch error:', error);
      toast.error('Failed to load customers');
    }
  });
};

// Hook for getting a single customer
export const useCustomerNew = (customerId: string) => {
  return trpc.customers.getById.useQuery({
    customer_id: customerId,
  }, {
    enabled: !!customerId && customerId !== 'null' && customerId !== 'undefined',
    staleTime: 30000,
    retry: 1,
    onError: (error: any) => {
      console.error('Customer fetch error:', error);
      toast.error('Failed to load customer details');
    }
  });
};

// Hook for creating customers
export const useCreateCustomer = () => {
  const utils = trpc.useContext();
  
  return trpc.customers.create.useMutation({
    onSuccess: (newCustomer) => {
      console.log('Customer created successfully:', newCustomer);
      
      // Invalidate customers list to refetch
      utils.customers.list.invalidate();
      
      toast.success('Customer created successfully');
    },
    onError: (error) => {
      console.error('Create customer error:', error);
      toast.error(error.message || 'Failed to create customer');
    },
  });
};

// Hook for updating customers
export const useUpdateCustomer = () => {
  const utils = trpc.useContext();
  
  return trpc.customers.update.useMutation({
    onSuccess: (updatedCustomer) => {
      console.log('Customer updated successfully:', updatedCustomer);
      
      // Invalidate queries to refetch updated data
      utils.customers.list.invalidate();
      utils.customers.getById.invalidate({ customer_id: updatedCustomer.id });
      
      toast.success('Customer updated successfully');
    },
    onError: (error) => {
      console.error('Update customer error:', error);
      toast.error(error.message || 'Failed to update customer');
    },
  });
};

// Hook for deleting customers
export const useDeleteCustomer = () => {
  const utils = trpc.useContext();
  
  return trpc.customers.delete.useMutation({
    onSuccess: () => {
      console.log('Customer deleted successfully');
      
      // Invalidate customers list to refetch
      utils.customers.list.invalidate();
      
      toast.success('Customer deleted successfully');
    },
    onError: (error) => {
      console.error('Delete customer error:', error);
      toast.error(error.message || 'Failed to delete customer');
    },
  });
};

// Hook for getting customer order history
export const useCustomerOrderHistoryNew = (customerId: string, filters: {
  limit?: number;
  offset?: number;
  status?: string;
} = {}) => {
  return trpc.customers.getOrderHistory.useQuery({
    customer_id: customerId,
    limit: filters.limit || 50,
    offset: filters.offset || 0,
    status: filters.status as any,
  }, {
    enabled: !!customerId && customerId !== 'null' && customerId !== 'undefined',
    staleTime: 30000,
    retry: 1,
    onError: (error) => {
      console.error('Customer order history fetch error:', error);
      toast.error('Failed to load customer order history');
    }
  });
};

// Hook for getting customer analytics
export const useCustomerAnalyticsNew = (customerId: string, period: 'month' | 'quarter' | 'year' = 'year') => {
  return trpc.customers.getAnalytics.useQuery({
    customer_id: customerId,
    period,
  }, {
    enabled: !!customerId && customerId !== 'null' && customerId !== 'undefined',
    staleTime: 60000, // 1 minute for analytics
    retry: 1,
    onError: (error) => {
      console.error('Customer analytics fetch error:', error);
      toast.error('Failed to load customer analytics');
    }
  });
};

// Hook for validating customer data
export const useValidateCustomerNew = () => {
  return trpc.customers.validate.useMutation({
    onSuccess: (validation) => {
      console.log('Customer validation completed:', validation);
    },
    onError: (error) => {
      console.error('Customer validation error:', error);
      toast.error(error.message || 'Customer validation failed');
    },
  });
};

// Hook for getting customer addresses
export const useCustomerAddressesNew = (customerId: string) => {
  return trpc.customers.getAddresses.useQuery({
    customer_id: customerId,
  }, {
    enabled: !!customerId && customerId !== 'null' && customerId !== 'undefined',
    staleTime: 30000,
    retry: 1,
    onError: (error) => {
      console.error('Customer addresses fetch error:', error);
      toast.error('Failed to load customer addresses');
    }
  });
};

// Hook for creating customer addresses
export const useCreateAddressNew = () => {
  const utils = trpc.useContext();
  
  return trpc.customers.createAddress.useMutation({
    onSuccess: (newAddress, variables) => {
      console.log('Address created successfully:', newAddress);
      
      // Invalidate address queries for this customer
      utils.customers.getAddresses.invalidate({ customer_id: variables.customer_id });
      utils.customers.getById.invalidate({ customer_id: variables.customer_id });
      
      toast.success('Address created successfully');
    },
    onError: (error) => {
      console.error('Create address error:', error);
      toast.error(error.message || 'Failed to create address');
    },
  });
};

// Hook for geocoding addresses
export const useGeocodeAddressNew = () => {
  return trpc.customers.geocodeAddress.useMutation({
    onSuccess: (geocodeResult) => {
      console.log('Address geocoded successfully:', geocodeResult);
      toast.success('Address location found');
    },
    onError: (error) => {
      console.error('Geocode address error:', error);
      toast.error(error.message || 'Failed to find address location');
    },
  });
};

// Hook for validating addresses
export const useValidateAddressNew = () => {
  return trpc.customers.validateAddress.useMutation({
    onSuccess: (validation) => {
      console.log('Address validation completed:', validation);
    },
    onError: (error) => {
      console.error('Address validation error:', error);
      toast.error(error.message || 'Address validation failed');
    },
  });
};

// ============ CUSTOMER DEPOSIT LIMIT HOOKS ============

export const useValidateCustomerDepositLimit = () => {
  return trpc.customers.validateDepositLimit.useMutation({
    onError: (error: any) => {
      console.error('Deposit limit validation error:', error);
      toast.error('Failed to validate deposit limit');
    }
  });
};

export const useUpdateCustomerDepositLimit = () => {
  const utils = trpc.useContext();
  
  return trpc.customers.updateDepositLimit.useMutation({
    onSuccess: (result, variables) => {
      console.log('Customer deposit limit updated successfully:', result);
      
      // Invalidate customer queries
      utils.customers.list.invalidate();
      utils.customers.getById.invalidate({ customer_id: variables.customer_id });
      utils.customers.getDepositAnalysis.invalidate({ customer_id: variables.customer_id });
      
      toast.success('Customer deposit limit updated successfully');
    },
    onError: (error: any) => {
      console.error('Update customer deposit limit error:', error);
      toast.error('Failed to update customer deposit limit');
    },
  });
};

export const useCustomerDepositAnalysis = (customerId: string) => {
  return trpc.customers.getDepositAnalysis.useQuery({
    customer_id: customerId,
  }, {
    enabled: !!customerId && customerId !== 'null' && customerId !== 'undefined',
    staleTime: 30000, // 30 seconds
    retry: 1,
    onError: (error: any) => {
      console.error('Customer deposit analysis fetch error:', error);
      toast.error('Failed to load customer deposit analysis');
    }
  });
};

// Utility hook to get customers context
export const useCustomersContext = () => {
  return trpc.useContext().customers;
};