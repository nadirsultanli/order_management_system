// DEPRECATED: This file contains legacy functions that violate architecture separation.
// All order operations should now use tRPC endpoints in backend/src/routes/orders.ts
// Frontend should only use the tRPC client via useQuery/useMutation hooks.

export interface Order {
  id: string;
  customer_id: string;
  status: 'draft' | 'confirmed' | 'scheduled' | 'en_route' | 'delivered' | 'invoiced' | 'cancelled';
  order_date: string;
  delivery_date: string;
  total_amount: number;
  created_at: string;
  customer: {
    name: string;
    address: string;
  };
  order_lines: {
    id: string;
    product_id: string;
    quantity: number;
    product: {
      name: string;
      sku: string;
    };
  }[];
}

// DEPRECATED: Use tRPC customers.getOrderHistory instead
// Example: const { data } = trpc.customers.getOrderHistory.useQuery({ customer_id: customerId });
export const getCustomerOrders = async (customerId: string): Promise<Order[]> => {
  throw new Error('DEPRECATED: Use tRPC customers.getOrderHistory instead of direct Supabase calls');
}; 