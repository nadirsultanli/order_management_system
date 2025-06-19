import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Order, OrderLine, CreateOrderData, UpdateOrderData, CreateOrderLineData, UpdateOrderLineData, OrderFilters, OrderStats, OrderStatusChange, StockAvailability } from '../types/order';
import toast from 'react-hot-toast';

const ORDERS_PER_PAGE = 50;

export const useOrders = (filters: OrderFilters = {}) => {
  return useQuery({
    queryKey: ['orders', filters],
    queryFn: async () => {
      console.log('Fetching orders with filters:', filters);
      
      let query = supabase
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
        `, { count: 'exact' })
        .order('created_at', { ascending: false });

      // Apply search filter
      if (filters.search) {
        query = query.or(`id.ilike.%${filters.search}%,customer.name.ilike.%${filters.search}%`);
      }

      // Apply status filter
      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      // Apply customer filter
      if (filters.customer_id && filters.customer_id !== 'null' && filters.customer_id !== 'undefined') {
        query = query.eq('customer_id', filters.customer_id);
      }

      // Apply date filters
      if (filters.order_date_from) {
        query = query.gte('order_date', filters.order_date_from);
      }
      if (filters.order_date_to) {
        query = query.lte('order_date', filters.order_date_to);
      }
      if (filters.scheduled_date_from) {
        query = query.gte('scheduled_date', filters.scheduled_date_from);
      }
      if (filters.scheduled_date_to) {
        query = query.lte('scheduled_date', filters.scheduled_date_to);
      }

      // Apply pagination
      const page = filters.page || 1;
      const limit = filters.limit || ORDERS_PER_PAGE;
      const from = (page - 1) * limit;
      const to = from + limit - 1;
      
      query = query.range(from, to);

      const { data, error, count } = await query;

      console.log('Supabase orders response:', { data, error, count });

      if (error) {
        console.error('Supabase orders error:', error);
        throw new Error(error.message);
      }

      return {
        orders: (data || []) as Order[],
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
        currentPage: page,
      };
    },
    retry: 1,
    staleTime: 30000,
  });
};

export const useOrder = (id: string) => {
  return useQuery({
    queryKey: ['order', id],
    queryFn: async () => {
      console.log('Fetching order:', id);
      
      if (!id || id === 'null' || id === 'undefined') {
        throw new Error('Invalid order ID');
      }
      
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
        .eq('id', id)
        .single();

      console.log('Order fetch result:', { data, error });

      if (error) {
        console.error('Order fetch error:', error);
        throw new Error(error.message);
      }

      return data as Order;
    },
    enabled: !!id && id !== 'null' && id !== 'undefined',
  });
};

export const useOrderStats = () => {
  return useQuery({
    queryKey: ['order-stats'],
    queryFn: async () => {
      console.log('Fetching order statistics');
      
      const { data: orders, error } = await supabase
        .from('orders')
        .select('status, total_amount, scheduled_date');

      if (error) {
        console.error('Order stats error:', error);
        throw new Error(error.message);
      }

      const today = new Date().toISOString().split('T')[0];

      const stats: OrderStats = {
        total_orders: orders.length,
        draft_orders: orders.filter(o => o.status === 'draft').length,
        confirmed_orders: orders.filter(o => o.status === 'confirmed').length,
        scheduled_orders: orders.filter(o => o.status === 'scheduled').length,
        en_route_orders: orders.filter(o => o.status === 'en_route').length,
        delivered_orders: orders.filter(o => o.status === 'delivered').length,
        invoiced_orders: orders.filter(o => o.status === 'invoiced').length,
        cancelled_orders: orders.filter(o => o.status === 'cancelled').length,
        todays_deliveries: orders.filter(o => o.scheduled_date === today && ['scheduled', 'en_route'].includes(o.status)).length,
        overdue_orders: orders.filter(o => o.scheduled_date && o.scheduled_date < today && !['delivered', 'invoiced', 'cancelled'].includes(o.status)).length,
        total_revenue: orders.filter(o => o.status === 'invoiced').reduce((sum, o) => sum + (o.total_amount || 0), 0),
      };

      console.log('Order stats:', stats);
      return stats;
    },
    staleTime: 60000,
  });
};

export const useStockAvailability = (productIds: string[]) => {
  return useQuery({
    queryKey: ['stock-availability', productIds],
    queryFn: async () => {
      // Filter out null/undefined product IDs
      const validProductIds = productIds.filter(id => id && id !== 'null' && id !== 'undefined');
      
      if (validProductIds.length === 0) return [];

      console.log('Checking stock availability for products:', validProductIds);
      
      const { data, error } = await supabase
        .from('inventory_balance')
        .select(`
          product_id,
          qty_full,
          qty_reserved,
          warehouse:warehouse_id(id, name)
        `)
        .in('product_id', validProductIds);

      console.log('Raw inventory data:', data);

      if (error) {
        console.error('Stock availability error:', error);
        throw new Error(error.message);
      }

      // Group by product_id and sum quantities
      const productInventory: Record<string, { 
        total_full: number; 
        total_reserved: number; 
        warehouses: { id: string; name: string }[] 
      }> = {};
      
      data.forEach(item => {
        console.log('Processing inventory item:', item);
        if (!productInventory[item.product_id]) {
          productInventory[item.product_id] = {
            total_full: 0,
            total_reserved: 0,
            warehouses: []
          };
        }
        
        productInventory[item.product_id].total_full += item.qty_full;
        productInventory[item.product_id].total_reserved += item.qty_reserved;
        
        if (item.warehouse && !productInventory[item.product_id].warehouses.some(w => w.id === item.warehouse.id)) {
          productInventory[item.product_id].warehouses.push({
            id: item.warehouse.id,
            name: item.warehouse.name
          });
        }
      });

      console.log('Processed product inventory:', productInventory);

      const availability: StockAvailability[] = validProductIds.map(productId => {
        const inventory = productInventory[productId] || { total_full: 0, total_reserved: 0, warehouses: [] };
        const available = Math.max(0, inventory.total_full - inventory.total_reserved);
        
        console.log(`Product ${productId} availability:`, {
          total_full: inventory.total_full,
          total_reserved: inventory.total_reserved,
          available
        });
        
        return {
          product_id: productId,
          available_quantity: available,
          warehouse_id: inventory.warehouses[0]?.id,
          warehouse_name: inventory.warehouses[0]?.name,
        };
      });

      console.log('Final availability array:', availability);

      return availability;
    },
    enabled: productIds.length > 0 && productIds.some(id => id && id !== 'null' && id !== 'undefined'),
    staleTime: 30000,
  });
};

export const useCreateOrder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orderData: CreateOrderData) => {
      console.log('Creating order with data:', orderData);
      console.log('Total amount being sent:', orderData.total_amount);
      
      // Validate required IDs
      if (!orderData.customer_id || orderData.customer_id === 'null' || orderData.customer_id === 'undefined') {
        throw new Error('Invalid customer ID');
      }
      
      if (!orderData.delivery_address_id || orderData.delivery_address_id === 'null' || orderData.delivery_address_id === 'undefined') {
        throw new Error('Invalid delivery address ID');
      }
      
      const { data, error } = await supabase
        .from('orders')
        .insert([{
          ...orderData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }])
        .select(`
          *,
          customer:customers(id, name, email, phone),
          delivery_address:addresses(id, line1, line2, city, state, postal_code, country, instructions)
        `)
        .single();

      console.log('Create order result:', { data, error });
      console.log('Order created with total_amount:', data?.total_amount);

      if (error) {
        console.error('Create order error:', error);
        throw new Error(error.message);
      }

      return data as Order;
    },
    onSuccess: (data) => {
      console.log('Order created successfully:', data);
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['order-stats'] });
      toast.success('Order created successfully');
    },
    onError: (error: Error) => {
      console.error('Create order mutation error:', error);
      toast.error(error.message || 'Failed to create order');
    },
  });
};

export const useUpdateOrder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updateData }: UpdateOrderData) => {
      console.log('Updating order:', id, updateData);
      
      if (!id || id === 'null' || id === 'undefined') {
        throw new Error('Invalid order ID');
      }
      
      const { data, error } = await supabase
        .from('orders')
        .update({
          ...updateData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
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
        .single();

      console.log('Update order result:', { data, error });

      if (error) {
        console.error('Update order error:', error);
        throw new Error(error.message);
      }

      // Update total amount if tax-related fields were changed
      if (updateData.tax_percent !== undefined || updateData.tax_amount !== undefined) {
        await updateOrderTotal(id);
      }

      return data as Order;
    },
    onSuccess: (data) => {
      console.log('Order updated successfully:', data);
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['order', data.id] });
      queryClient.invalidateQueries({ queryKey: ['order-stats'] });
      toast.success('Order updated successfully');
    },
    onError: (error: Error) => {
      console.error('Update order mutation error:', error);
      toast.error(error.message || 'Failed to update order');
    },
  });
};

export const useChangeOrderStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (statusChange: OrderStatusChange) => {
      console.log('Changing order status:', statusChange);
      
      if (!statusChange.order_id || statusChange.order_id === 'null' || statusChange.order_id === 'undefined') {
        throw new Error('Invalid order ID');
      }
      
      // Handle inventory updates based on status change
      if (statusChange.new_status === 'confirmed') {
        // Reserve inventory
        const { data: order } = await supabase
          .from('orders')
          .select(`
            order_lines(product_id, quantity)
          `)
          .eq('id', statusChange.order_id)
          .single();

        if (order?.order_lines) {
          for (const line of order.order_lines) {
            // Update inventory to reserve stock
            await supabase.rpc('reserve_stock', {
              p_product_id: line.product_id,
              p_quantity: line.quantity,
            });
          }
        }
      } else if (statusChange.new_status === 'delivered') {
        // Deduct actual stock and release reserved
        const { data: order } = await supabase
          .from('orders')
          .select(`
            order_lines(product_id, quantity)
          `)
          .eq('id', statusChange.order_id)
          .single();

        if (order?.order_lines) {
          for (const line of order.order_lines) {
            // Update inventory to deduct stock
            await supabase.rpc('fulfill_order_line', {
              p_product_id: line.product_id,
              p_quantity: line.quantity,
            });
          }
        }
      } else if (statusChange.new_status === 'cancelled') {
        // Release reserved stock
        const { data: order } = await supabase
          .from('orders')
          .select(`
            order_lines(product_id, quantity),
            status
          `)
          .eq('id', statusChange.order_id)
          .single();

        if (order?.order_lines && order.status === 'confirmed') {
          for (const line of order.order_lines) {
            // Release reserved stock
            await supabase.rpc('release_reserved_stock', {
              p_product_id: line.product_id,
              p_quantity: line.quantity,
            });
          }
        }
      }

      // Update order status
      const updateData: any = {
        status: statusChange.new_status,
        updated_at: new Date().toISOString(),
      };

      if (statusChange.scheduled_date) {
        updateData.scheduled_date = statusChange.scheduled_date;
      }

      const { data, error } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', statusChange.order_id)
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
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return data as Order;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['order', data.id] });
      queryClient.invalidateQueries({ queryKey: ['order-stats'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      toast.success(`Order status changed to ${data.status}`);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to change order status');
    },
  });
};

export const useCreateOrderLine = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (lineData: CreateOrderLineData & { skipTotalUpdate?: boolean }) => {
      console.log('Creating order line:', lineData);
      
      if (!lineData.order_id || lineData.order_id === 'null' || lineData.order_id === 'undefined') {
        throw new Error('Invalid order ID');
      }
      
      if (!lineData.product_id || lineData.product_id === 'null' || lineData.product_id === 'undefined') {
        throw new Error('Invalid product ID');
      }
      
      const { skipTotalUpdate, ...insertData } = lineData;
      
      // Calculate subtotal
      const subtotal = insertData.quantity * insertData.unit_price;
      const orderLineData = {
        ...insertData,
        subtotal: subtotal
      };
      
      console.log('Creating order line with subtotal:', orderLineData);
      
      const { data, error } = await supabase
        .from('order_lines')
        .insert([orderLineData])
        .select(`
          *,
          product:products(id, sku, name, unit_of_measure)
        `)
        .single();

      if (error) {
        throw new Error(error.message);
      }

      // Update order total only if not skipped
      if (!skipTotalUpdate) {
        await updateOrderTotal(lineData.order_id);
      }

      return data as OrderLine;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['order', data.order_id] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Product added to order');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to add product to order');
    },
  });
};

export const useUpdateOrderLine = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updateData }: UpdateOrderLineData) => {
      console.log('Updating order line:', id, updateData);
      
      if (!id || id === 'null' || id === 'undefined') {
        throw new Error('Invalid order line ID');
      }
      
      const { data, error } = await supabase
        .from('order_lines')
        .update(updateData)
        .eq('id', id)
        .select(`
          *,
          product:products(id, sku, name, unit_of_measure)
        `)
        .single();

      if (error) {
        throw new Error(error.message);
      }

      // Update order total
      if (data.order_id) {
        await updateOrderTotal(data.order_id);
      }

      return data as OrderLine;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['order', data.order_id] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Order line updated');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update order line');
    },
  });
};

export const useDeleteOrderLine = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (line: OrderLine) => {
      console.log('Deleting order line:', line);
      
      if (!line.id || line.id === 'null' || line.id === 'undefined') {
        throw new Error('Invalid order line ID');
      }
      
      const { error } = await supabase
        .from('order_lines')
        .delete()
        .eq('id', line.id);

      if (error) {
        throw new Error(error.message);
      }

      // Update order total
      await updateOrderTotal(line.order_id);

      return line;
    },
    onSuccess: (line) => {
      queryClient.invalidateQueries({ queryKey: ['order', line.order_id] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Product removed from order');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to remove product from order');
    },
  });
};

// Helper function to update order total
const updateOrderTotal = async (orderId: string) => {
  if (!orderId || orderId === 'null' || orderId === 'undefined') {
    return;
  }

  // Get order lines with quantity and unit_price
  const { data: lines } = await supabase
    .from('order_lines')
    .select('quantity, unit_price, subtotal')
    .eq('order_id', orderId);

  // Get order tax information
  const { data: order } = await supabase
    .from('orders')
    .select('tax_amount')
    .eq('id', orderId)
    .single();

  if (lines) {
    const subtotal = lines.reduce((sum, line) => {
      const lineSubtotal = line.subtotal || (line.quantity * line.unit_price);
      return sum + lineSubtotal;
    }, 0);
    const taxAmount = order?.tax_amount || 0;
    const grandTotal = subtotal + taxAmount;
    
    console.log('Updating order total:', { orderId, subtotal, taxAmount, grandTotal });
    
    await supabase
      .from('orders')
      .update({ 
        total_amount: grandTotal,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId);
  }
};

// Helper function to update tax and recalculate total
export const updateOrderTax = async (orderId: string, taxPercent: number) => {
  if (!orderId || orderId === 'null' || orderId === 'undefined') {
    return;
  }

  // Get order lines with quantity and unit_price
  const { data: lines } = await supabase
    .from('order_lines')
    .select('quantity, unit_price, subtotal')
    .eq('order_id', orderId);

  if (lines) {
    const subtotal = lines.reduce((sum, line) => {
      const lineSubtotal = line.subtotal || (line.quantity * line.unit_price);
      return sum + lineSubtotal;
    }, 0);
    const taxAmount = subtotal * (taxPercent / 100);
    const grandTotal = subtotal + taxAmount;
    
    console.log('Updating order tax:', { orderId, taxPercent, subtotal, taxAmount, grandTotal });
    
    await supabase
      .from('orders')
      .update({ 
        tax_percent: taxPercent,
        tax_amount: taxAmount,
        total_amount: grandTotal,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId);
  }
};

// Helper function to manually fix order totals (for existing orders)
export const fixOrderTotal = async (orderId: string) => {
  if (!orderId || orderId === 'null' || orderId === 'undefined') {
    return;
  }

  console.log('Fixing order total for order:', orderId);

  // Get order lines with quantity and unit_price
  const { data: lines } = await supabase
    .from('order_lines')
    .select('quantity, unit_price, subtotal')
    .eq('order_id', orderId);

  // Get order tax information
  const { data: order } = await supabase
    .from('orders')
    .select('tax_percent, tax_amount')
    .eq('id', orderId)
    .single();

  if (lines && order) {
    // Calculate subtotal from order lines
    const subtotal = lines.reduce((sum, line) => {
      const lineSubtotal = line.subtotal || (line.quantity * line.unit_price);
      return sum + lineSubtotal;
    }, 0);

    // Recalculate tax amount if tax_percent exists
    const taxAmount = order.tax_percent ? (subtotal * order.tax_percent / 100) : (order.tax_amount || 0);
    const grandTotal = subtotal + taxAmount;
    
    console.log('Fixing order total:', { orderId, subtotal, taxAmount, grandTotal, taxPercent: order.tax_percent });
    
    await supabase
      .from('orders')
      .update({ 
        tax_amount: taxAmount,
        total_amount: grandTotal,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    return { subtotal, taxAmount, grandTotal };
  }
};