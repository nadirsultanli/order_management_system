import { trpc } from '../lib/trpc-client';
import { OrderFilters } from '../types/order';
import toast from 'react-hot-toast';

// Type definitions that match the backend API
export interface OrderListFilters {
  status?: 'draft' | 'confirmed' | 'scheduled' | 'en_route' | 'delivered' | 'invoiced' | 'cancelled';
  customer_id?: string;
  search?: string;
  order_date_from?: string;
  order_date_to?: string;
  scheduled_date_from?: string;
  scheduled_date_to?: string;
  include_analytics?: boolean;
  page?: number;
  limit?: number;
}

// Main hook for listing orders
export const useOrdersNew = (filters: OrderListFilters = {}) => {
  return trpc.orders.list.useQuery({
    status: filters.status,
    customer_id: filters.customer_id,
    search: filters.search,
    order_date_from: filters.order_date_from,
    order_date_to: filters.order_date_to,
    scheduled_date_from: filters.scheduled_date_from,
    scheduled_date_to: filters.scheduled_date_to,
    include_analytics: filters.include_analytics || false,
    page: filters.page || 1,
    limit: filters.limit || 50,
  }, {
    enabled: true, // Always enabled
    staleTime: 30000, // 30 seconds
    retry: 1,
    onError: (error) => {
      console.error('Orders fetch error:', error);
      toast.error('Failed to load orders');
    }
  });
};

// Hook for getting a single order
export const useOrderNew = (orderId: string) => {
  return trpc.orders.getById.useQuery({
    order_id: orderId,
  }, {
    enabled: !!orderId && orderId !== 'null' && orderId !== 'undefined',
    staleTime: 30000,
    retry: 1,
    onError: (error) => {
      console.error('Order fetch error:', error);
      toast.error('Failed to load order details');
    }
  });
};

// Hook for creating orders
export const useCreateOrderNew = () => {
  const utils = trpc.useContext();
  
  return trpc.orders.create.useMutation({
    onSuccess: (newOrder) => {
      console.log('Order created successfully:', newOrder);
      
      // Invalidate and refetch orders list
      utils.orders.list.invalidate();
      
      toast.success('Order created successfully');
    },
    onError: (error) => {
      console.error('Create order error:', error);
      toast.error(error.message || 'Failed to create order');
    },
  });
};

// Hook for updating order status
export const useUpdateOrderStatusNew = () => {
  const utils = trpc.useContext();
  
  return trpc.orders.updateStatus.useMutation({
    onSuccess: (updatedOrder) => {
      console.log('Order status updated successfully:', updatedOrder);
      
      // Invalidate queries to refetch updated data
      utils.orders.list.invalidate();
      utils.orders.getById.invalidate({ order_id: updatedOrder.id });
      
      toast.success('Order status updated successfully');
    },
    onError: (error) => {
      console.error('Update order status error:', error);
      toast.error(error.message || 'Failed to update order status');
    },
  });
};

// Hook for calculating order totals
export const useCalculateOrderTotalNew = () => {
  const utils = trpc.useContext();
  
  return trpc.orders.calculateTotal.useMutation({
    onSuccess: (calculation, variables) => {
      console.log('Order total calculated:', calculation);
      
      // Invalidate the specific order to refetch with updated totals
      utils.orders.getById.invalidate({ order_id: variables.order_id });
      utils.orders.list.invalidate();
      
      toast.success('Order total recalculated');
    },
    onError: (error) => {
      console.error('Calculate total error:', error);
      toast.error(error.message || 'Failed to calculate order total');
    },
  });
};

// Hook for updating order tax
export const useUpdateOrderTaxNew = () => {
  const utils = trpc.useContext();
  
  return trpc.orders.updateTax.useMutation({
    onSuccess: (taxUpdate, variables) => {
      console.log('Order tax updated:', taxUpdate);
      
      // Invalidate the specific order to refetch with updated tax
      utils.orders.getById.invalidate({ order_id: variables.order_id });
      utils.orders.list.invalidate();
      
      toast.success('Order tax updated successfully');
    },
    onError: (error) => {
      console.error('Update tax error:', error);
      toast.error(error.message || 'Failed to update order tax');
    },
  });
};

// Utility hook to get tRPC context for manual invalidations
export const useOrdersContext = () => {
  return trpc.useContext().orders;
};

// Legacy compatibility functions to help with migration
export const convertFiltersToNew = (oldFilters: OrderFilters): OrderListFilters => {
  return {
    status: oldFilters.status as any,
    customer_id: oldFilters.customer_id,
    search: oldFilters.search,
    order_date_from: oldFilters.order_date_from,
    order_date_to: oldFilters.order_date_to,
    scheduled_date_from: oldFilters.scheduled_date_from,
    scheduled_date_to: oldFilters.scheduled_date_to,
    page: oldFilters.page,
    limit: oldFilters.limit,
  };
};

// Migration helper: wrapper that uses new hooks but provides old interface
export const useOrdersMigration = (filters: OrderFilters = {}) => {
  const newFilters = convertFiltersToNew(filters);
  const result = useOrdersNew(newFilters);
  
  // Transform the result to match the old interface
  return {
    data: result.data ? {
      orders: result.data.orders,
      totalCount: result.data.totalCount,
      totalPages: result.data.totalPages,
      currentPage: result.data.currentPage,
    } : undefined,
    isLoading: result.isLoading,
    error: result.error,
    refetch: result.refetch,
  };
};