import { trpc } from '../lib/trpc-client';

export interface DashboardStats {
  totalCustomers: number;
  activeCustomers: number;
  totalProducts: number;
  activeProducts: number;
  totalWarehouses: number;
  totalOrders: number;
  totalCylinders: number;
  lowStockProducts: number;
}

export const useDashboardStats = (period: 'today' | 'week' | 'month' | 'quarter' | 'year' = 'month') => {
  return trpc.analytics.getDashboardStats.useQuery(
    { period },
    {
      retry: 1,
      staleTime: 60000, // 1 minute cache
      refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
    }
  );
};