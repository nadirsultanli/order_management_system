import { trpc } from '../lib/trpc-client';
import toast from 'react-hot-toast';

// Hook for comprehensive order analytics (replaces frontend calculations in OrderReportsPage)
export const useComprehensiveOrderAnalytics = (startDate: string, endDate: string) => {
  return trpc.analytics.getComprehensiveOrderAnalytics.useQuery(
    { start_date: startDate, end_date: endDate },
    {
      enabled: Boolean(startDate && endDate),
      staleTime: 60000, // 1 minute cache
      retry: 1,
      onError: (error) => {
        console.error('Comprehensive order analytics error:', error);
        toast.error('Failed to load order analytics');
      }
    }
  );
};

// Hook for order statistics (replaces OrderStats component placeholder data)
export const useOrderStats = (period: 'today' | 'week' | 'month' | 'quarter' | 'year' = 'month') => {
  return trpc.analytics.getOrderStats.useQuery(
    { period },
    {
      staleTime: 60000, // 1 minute cache
      retry: 1,
      refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
      onError: (error) => {
        console.error('Order stats error:', error);
        toast.error('Failed to load order statistics');
      }
    }
  );
};

// Hook for revenue analytics (already exists but adding for completeness)
export const useRevenueAnalytics = (
  period: 'week' | 'month' | 'quarter' | 'year' = 'month',
  breakdownBy: 'day' | 'week' | 'month' = 'day'
) => {
  return trpc.analytics.getRevenueAnalytics.useQuery(
    { period, breakdown_by: breakdownBy },
    {
      staleTime: 60000, // 1 minute cache
      retry: 1,
      onError: (error) => {
        console.error('Revenue analytics error:', error);
        toast.error('Failed to load revenue analytics');
      }
    }
  );
};

// Hook for customer analytics (already exists but adding for completeness)
export const useCustomerAnalytics = (
  period: 'week' | 'month' | 'quarter' | 'year' = 'month',
  breakdownBy: 'new' | 'returning' | 'top_spending' = 'new'
) => {
  return trpc.analytics.getCustomerAnalytics.useQuery(
    { period, breakdown_by: breakdownBy },
    {
      staleTime: 60000, // 1 minute cache
      retry: 1,
      onError: (error) => {
        console.error('Customer analytics error:', error);
        toast.error('Failed to load customer analytics');
      }
    }
  );
};

// Hook for inventory analytics (already exists but adding for completeness)
export const useInventoryAnalytics = (warehouseId?: string) => {
  return trpc.analytics.getInventoryAnalytics.useQuery(
    { warehouse_id: warehouseId },
    {
      enabled: true,
      staleTime: 60000, // 1 minute cache
      retry: 1,
      onError: (error) => {
        console.error('Inventory analytics error:', error);
        toast.error('Failed to load inventory analytics');
      }
    }
  );
};

// Hook for general order analytics with grouping options (already exists but adding for completeness)
export const useOrderAnalytics = (
  period: 'week' | 'month' | 'quarter' | 'year' = 'month',
  groupBy?: 'status' | 'customer' | 'product'
) => {
  return trpc.analytics.getOrderAnalytics.useQuery(
    { period, group_by: groupBy },
    {
      staleTime: 60000, // 1 minute cache
      retry: 1,
      onError: (error) => {
        console.error('Order analytics error:', error);
        toast.error('Failed to load order analytics');
      }
    }
  );
};