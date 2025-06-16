import { supabase } from './supabase';

export interface Order {
  id: string;
  customer_id: string;
  status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
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

export const getCustomerOrders = async (customerId: string) => {
  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      customer:customer_id(
        name,
        address
      ),
      order_lines(
        id,
        product_id,
        quantity,
        product:product_id(
          name,
          sku
        )
      )
    `)
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as Order[];
}; 