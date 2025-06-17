import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Order } from '../types/order';

export const useCustomerOrders = (customerId: string, limit: number = 5) => {
  return useQuery({
    queryKey: ['customer-orders', customerId, limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          customer:customers(id, name, email, phone),
          delivery_address:addresses(id, line1, line2, city, state, postal_code, country, instructions),
          order_lines(
            id,
            product_id,
            quantity,
            unit_price,
            subtotal,
            product:products(id, sku, name, unit_of_measure)
          )
        `)
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data as Order[];
    },
    enabled: !!customerId,
  });
}; 