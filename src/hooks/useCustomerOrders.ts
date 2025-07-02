import { trpc } from '../lib/trpc-client';

export const useCustomerOrders = (customerId: string, limit: number = 5) => {
  return trpc.customers.getOrderHistory.useQuery(
    { 
      customer_id: customerId,
      limit: limit,
      offset: 0,
    },
    {
      enabled: !!customerId && customerId !== 'null' && customerId !== 'undefined',
      retry: 1,
      staleTime: 30000,
      select: (data) => data.orders, // Extract just the orders array to match old interface
    }
  );
};