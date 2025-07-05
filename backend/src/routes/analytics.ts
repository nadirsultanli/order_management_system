import { z } from 'zod';
import { router, protectedProcedure } from '../lib/trpc';
import { requireAuth } from '../lib/auth';
import { TRPCError } from '@trpc/server';

export const analyticsRouter = router({
  // GET /dashboard/stats - Get dashboard statistics
  getDashboardStats: protectedProcedure
    .input(z.object({
      period: z.enum(['today', 'week', 'month', 'quarter', 'year']).default('month'),
    }))
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Fetching dashboard statistics:', input);
      
      const periodDays = {
        today: 1,
        week: 7,
        month: 30,
        quarter: 90,
        year: 365,
      }[input.period];
      
      const startDate = new Date();
      if (input.period === 'today') {
        startDate.setHours(0, 0, 0, 0);
      } else {
        startDate.setDate(startDate.getDate() - periodDays);
      }
      
      // Get order statistics
      const { data: orders, error: ordersError } = await ctx.supabase
        .from('orders')
        .select('status, total_amount, order_date, customer_id')
        
        .gte('order_date', startDate.toISOString());

      if (ordersError) {
        ctx.logger.error('Dashboard orders error:', ordersError);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: ordersError.message
        });
      }

      // Get customer statistics
      const { data: customers, error: customersError } = await ctx.supabase
        .from('customers')
        .select('id, created_at')
        
        .gte('created_at', startDate.toISOString());

      if (customersError) {
        ctx.logger.error('Dashboard customers error:', customersError);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: customersError.message
        });
      }

      // Get additional stats for the dashboard
      const { data: allCustomers, error: allCustomersError } = await ctx.supabase
        .from('customers')
        .select('id, created_at, account_status');

      const { data: products, error: productsError } = await ctx.supabase
        .from('products')
        .select('id, is_active');

      const { data: warehouses, error: warehousesError } = await ctx.supabase
        .from('warehouses')
        .select('id');

      const { data: inventoryBalances, error: inventoryError } = await ctx.supabase
        .from('inventory_balances')
        .select('available_quantity, reorder_point, product:products(name)');

      if (allCustomersError || productsError || warehousesError || inventoryError) {
        ctx.logger.error('Dashboard stats additional data error:', {
          allCustomersError,
          productsError,
          warehousesError,
          inventoryError
        });
      }

      // Calculate metrics
      const totalOrders = orders?.length || 0;
      const totalRevenue = orders?.reduce((sum, order) => sum + (order.total_amount || 0), 0) || 0;
      const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
      const newCustomers = customers?.length || 0;
      const uniqueCustomers = new Set(orders?.map(o => o.customer_id)).size;
      
      const statusCounts = orders?.reduce((acc, order) => {
        acc[order.status] = (acc[order.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      // Calculate additional dashboard metrics
      const totalCustomers = allCustomers?.length || 0;
      const activeCustomers = allCustomers?.filter(c => c.account_status === 'active').length || 0;
      const totalProducts = products?.length || 0;
      const activeProducts = products?.filter(p => p.is_active !== false).length || 0;
      const totalWarehouses = warehouses?.length || 0;
      
      // Calculate total cylinders and low stock
      const totalCylinders = inventoryBalances?.reduce((sum, item) => sum + (item.available_quantity || 0), 0) || 0;
      const lowStockProducts = inventoryBalances?.filter(item => 
        (item.available_quantity || 0) <= (item.reorder_point || 10)
      ).length || 0;

      return {
        period: input.period,
        totalOrders,
        totalRevenue,
        avgOrderValue,
        newCustomers,
        uniqueCustomers,
        statusCounts,
        // Additional dashboard stats
        totalCustomers,
        activeCustomers,
        totalProducts,
        activeProducts,
        totalWarehouses,
        totalCylinders,
        lowStockProducts,
      };
    }),

  // GET /analytics/revenue - Get revenue analytics
  getRevenueAnalytics: protectedProcedure
    .input(z.object({
      period: z.enum(['week', 'month', 'quarter', 'year']).default('month'),
      breakdown_by: z.enum(['day', 'week', 'month']).default('day'),
    }))
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Fetching revenue analytics:', input);
      
      const periodDays = {
        week: 7,
        month: 30,
        quarter: 90,
        year: 365,
      }[input.period];
      
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - periodDays);
      
      const { data: orders, error } = await ctx.supabase
        .from('orders')
        .select(`
          total_amount,
          order_date,
          status,
          customer:customers(id, name)
        `)
        
        .gte('order_date', startDate.toISOString())
        .order('order_date', { ascending: true });

      if (error) {
        ctx.logger.error('Revenue analytics error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message
        });
      }

      // Group revenue by breakdown period
      const revenueData = orders?.reduce((acc, order) => {
        const orderDate = new Date(order.order_date);
        let key: string;
        
        if (input.breakdown_by === 'day') {
          key = orderDate.toISOString().split('T')[0];
        } else if (input.breakdown_by === 'week') {
          const weekStart = new Date(orderDate);
          weekStart.setDate(orderDate.getDate() - orderDate.getDay());
          key = weekStart.toISOString().split('T')[0];
        } else { // month
          key = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}`;
        }
        
        if (!acc[key]) {
          acc[key] = { revenue: 0, orders: 0 };
        }
        
        acc[key].revenue += order.total_amount || 0;
        acc[key].orders += 1;
        
        return acc;
      }, {} as Record<string, { revenue: number; orders: number }>) || {};

      // Convert to array and sort
      const chartData = Object.entries(revenueData)
        .map(([date, data]) => ({
          date,
          revenue: (data as any).revenue,
          orders: (data as any).orders,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      const totalRevenue = orders?.reduce((sum, order) => sum + (order.total_amount || 0), 0) || 0;
      const totalOrders = orders?.length || 0;

      return {
        period: input.period,
        breakdown_by: input.breakdown_by,
        totalRevenue,
        totalOrders,
        chartData,
      };
    }),

  // GET /analytics/orders - Get order analytics
  getOrderAnalytics: protectedProcedure
    .input(z.object({
      period: z.enum(['week', 'month', 'quarter', 'year']).default('month'),
      group_by: z.enum(['status', 'customer', 'product']).optional(),
    }))
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Fetching order analytics:', input);
      
      const periodDays = {
        week: 7,
        month: 30,
        quarter: 90,
        year: 365,
      }[input.period];
      
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - periodDays);
      
      let selectClause = 'id, status, total_amount, order_date';
      
      if (input.group_by === 'customer') {
        selectClause += ', customer:customers(id, name)';
      } else if (input.group_by === 'product') {
        selectClause += ', order_lines(product:products(id, name, sku))';
      }
      
      const { data: orders, error } = await ctx.supabase
        .from('orders')
        .select(selectClause)
        
        .gte('order_date', startDate.toISOString())
        .order('order_date', { ascending: false });

      if (error) {
        ctx.logger.error('Order analytics error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message
        });
      }

      const totalOrders = orders?.length || 0;
      const totalRevenue = orders?.reduce((sum, order) => sum + ((order as any).total_amount || 0), 0) || 0;
      
      // Group by status
      const statusBreakdown = orders?.reduce((acc, order) => {
        acc[(order as any).status] = (acc[(order as any).status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};
      
      let groupedData = null;
      
      if (input.group_by === 'customer') {
        groupedData = orders?.reduce((acc, order) => {
          const customerId = (order as any).customer?.id || 'unknown';
          const customerName = (order as any).customer?.name || 'Unknown Customer';
          
          if (!acc[customerId]) {
            acc[customerId] = {
              customer_id: customerId,
              customer_name: customerName,
              orders: 0,
              revenue: 0,
            };
          }
          
          acc[customerId].orders += 1;
          acc[customerId].revenue += (order as any).total_amount || 0;
          
          return acc;
        }, {} as Record<string, any>) || {};
      } else if (input.group_by === 'product') {
        const productData: Record<string, any> = {};
        
        orders?.forEach(order => {
          (order as any).order_lines?.forEach((line: any) => {
            const productId = line.product?.id || 'unknown';
            const productName = line.product?.name || 'Unknown Product';
            const productSku = line.product?.sku || '';
            
            if (!productData[productId]) {
              productData[productId] = {
                product_id: productId,
                product_name: productName,
                product_sku: productSku,
                orders: 0,
                quantity_sold: 0,
              };
            }
            
            productData[productId].orders += 1;
            productData[productId].quantity_sold += line.quantity || 0;
          });
        });
        
        groupedData = productData;
      }

      return {
        period: input.period,
        group_by: input.group_by,
        totalOrders,
        totalRevenue,
        statusBreakdown,
        groupedData: groupedData ? Object.values(groupedData) : null,
      };
    }),

  // GET /analytics/customers - Get customer analytics
  getCustomerAnalytics: protectedProcedure
    .input(z.object({
      period: z.enum(['week', 'month', 'quarter', 'year']).default('month'),
      breakdown_by: z.enum(['new', 'returning', 'top_spending']).default('new'),
    }))
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Fetching customer analytics:', input);
      
      const periodDays = {
        week: 7,
        month: 30,
        quarter: 90,
        year: 365,
      }[input.period];
      
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - periodDays);
      
      if (input.breakdown_by === 'new') {
        // Get new customers in period
        const { data: newCustomers, error } = await ctx.supabase
          .from('customers')
          .select('id, name, created_at, email')
          
          .gte('created_at', startDate.toISOString())
          .order('created_at', { ascending: false });

        if (error) {
          ctx.logger.error('New customers analytics error:', error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: error.message
          });
        }

        // Group by creation date
        const customersByDate = newCustomers?.reduce((acc, customer) => {
          const date = customer.created_at.split('T')[0];
          if (!acc[date]) {
            acc[date] = [];
          }
          acc[date].push(customer);
          return acc;
        }, {} as Record<string, any[]>) || {};

        return {
          period: input.period,
          breakdown_by: input.breakdown_by,
          totalNewCustomers: newCustomers?.length || 0,
          customersByDate,
          customers: newCustomers || [],
        };
      } else if (input.breakdown_by === 'top_spending') {
        // Get customers with their total spending
        const { data: customerOrders, error } = await ctx.supabase
          .from('orders')
          .select(`
            customer_id,
            total_amount,
            customer:customers(id, name, email)
          `)
          
          .gte('order_date', startDate.toISOString());

        if (error) {
          ctx.logger.error('Top spending customers analytics error:', error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: error.message
          });
        }

        // Calculate total spending per customer
        const customerSpending = customerOrders?.reduce((acc, order) => {
          const customerId = order.customer_id;
          
          if (!acc[customerId]) {
            acc[customerId] = {
              customer_id: customerId,
              customer_name: (order as any).customer?.name || 'Unknown',
              customer_email: (order as any).customer?.email || '',
              total_spent: 0,
              order_count: 0,
            };
          }
          
          acc[customerId].total_spent += order.total_amount || 0;
          acc[customerId].order_count += 1;
          
          return acc;
        }, {} as Record<string, any>) || {};

        // Sort by total spending
        const topCustomers = Object.values(customerSpending)
          .sort((a: any, b: any) => b.total_spent - a.total_spent)
          .slice(0, 20); // Top 20 customers

        return {
          period: input.period,
          breakdown_by: input.breakdown_by,
          topCustomers,
        };
      } else { // returning
        // Get returning customers (customers who placed orders in both current and previous period)
        const previousStartDate = new Date(startDate);
        previousStartDate.setDate(previousStartDate.getDate() - periodDays);
        
        const { data: currentOrders, error: currentError } = await ctx.supabase
          .from('orders')
          .select('customer_id, customer:customers(id, name, email)')
          
          .gte('order_date', startDate.toISOString());

        const { data: previousOrders, error: previousError } = await ctx.supabase
          .from('orders')
          .select('customer_id')
          
          .gte('order_date', previousStartDate.toISOString())
          .lt('order_date', startDate.toISOString());

        if (currentError || previousError) {
          ctx.logger.error('Returning customers analytics error:', currentError || previousError);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: (currentError || previousError)?.message
          });
        }

        const currentCustomerIds = new Set(currentOrders?.map(o => o.customer_id));
        const previousCustomerIds = new Set(previousOrders?.map(o => o.customer_id));
        
        const returningCustomerIds = [...currentCustomerIds].filter(id => previousCustomerIds.has(id));
        
        const returningCustomers = currentOrders?.filter(order => 
          returningCustomerIds.includes(order.customer_id)
        ).reduce((acc, order) => {
          if (!acc.find(c => c.customer_id === order.customer_id)) {
            acc.push({
              customer_id: order.customer_id,
              customer_name: (order as any).customer?.name || 'Unknown',
              customer_email: (order as any).customer?.email || '',
            });
          }
          return acc;
        }, [] as any[]) || [];

        return {
          period: input.period,
          breakdown_by: input.breakdown_by,
          totalReturningCustomers: returningCustomers.length,
          returningCustomers,
        };
      }
    }),

  // GET /analytics/inventory - Get inventory analytics
  getInventoryAnalytics: protectedProcedure
    .input(z.object({
      warehouse_id: z.string().uuid().optional(),
    }))
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Fetching inventory analytics:', input);
      
      let query = ctx.supabase
        .from('inventory_balances')
        .select(`
          *,
          product:products(id, sku, name, unit_of_measure),
          warehouse:warehouses(id, name)
        `)
        ;
      
      if (input.warehouse_id) {
        query = query.eq('warehouse_id', input.warehouse_id);
      }
      
      const { data: inventoryBalances, error } = await query;

      if (error) {
        ctx.logger.error('Inventory analytics error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message
        });
      }

      const totalProducts = inventoryBalances?.length || 0;
      const totalStockValue = inventoryBalances?.reduce((sum, item) => 
        sum + ((item.available_quantity || 0) * (item.unit_cost || 0)), 0
      ) || 0;
      
      const lowStockItems = inventoryBalances?.filter(item => 
        (item.available_quantity || 0) <= (item.reorder_point || 0)
      ) || [];
      
      const outOfStockItems = inventoryBalances?.filter(item => 
        (item.available_quantity || 0) === 0
      ) || [];
      
      // Group by warehouse if multiple warehouses
      const warehouseBreakdown = inventoryBalances?.reduce((acc, item) => {
        const warehouseId = item.warehouse_id;
        const warehouseName = item.warehouse?.name || 'Unknown';
        
        if (!acc[warehouseId]) {
          acc[warehouseId] = {
            warehouse_id: warehouseId,
            warehouse_name: warehouseName,
            total_products: 0,
            total_stock_value: 0,
            low_stock_count: 0,
            out_of_stock_count: 0,
          };
        }
        
        acc[warehouseId].total_products += 1;
        acc[warehouseId].total_stock_value += (item.available_quantity || 0) * (item.unit_cost || 0);
        
        if ((item.available_quantity || 0) <= (item.reorder_point || 0)) {
          acc[warehouseId].low_stock_count += 1;
        }
        
        if ((item.available_quantity || 0) === 0) {
          acc[warehouseId].out_of_stock_count += 1;
        }
        
        return acc;
      }, {} as Record<string, any>) || {};

      return {
        totalProducts,
        totalStockValue,
        lowStockCount: lowStockItems.length,
        outOfStockCount: outOfStockItems.length,
        lowStockItems: lowStockItems.slice(0, 10), // Top 10 low stock items
        outOfStockItems: outOfStockItems.slice(0, 10), // Top 10 out of stock items
        warehouseBreakdown: Object.values(warehouseBreakdown),
      };
    }),

  // GET /analytics/comprehensive-order-analytics - Complete order analytics for reports
  getComprehensiveOrderAnalytics: protectedProcedure
    .input(z.object({
      start_date: z.string(),
      end_date: z.string(),
    }))
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Fetching comprehensive order analytics:', input);
      
      // Get all orders with related data in the date range
      const { data: orders, error } = await ctx.supabase
        .from('orders')
        .select(`
          id,
          status,
          total_amount,
          order_date,
          scheduled_date,
          customer_id,
          customer:customers(id, name, email),
          delivery_address:delivery_addresses(id, line1, city, state, country),
          order_lines(
            id,
            product_id,
            quantity,
            unit_price,
            subtotal,
            product:products(id, name, sku)
          )
        `)
        .gte('order_date', input.start_date)
        .lte('order_date', input.end_date)
        .order('order_date', { ascending: true });

      if (error) {
        ctx.logger.error('Comprehensive order analytics error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message
        });
      }

      const ordersData = orders || [];
      const totalOrders = ordersData.length;

      // Calculate orders by status with percentages
      const statusCounts = ordersData.reduce((acc, order) => {
        acc[order.status] = (acc[order.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const orders_by_status = Object.entries(statusCounts).map(([status, count]) => ({
        status,
        count: count as number,
        percentage: totalOrders > 0 ? ((count as number) / totalOrders) * 100 : 0,
      }));

      // Calculate daily trends
      const dailyData = ordersData.reduce((acc, order) => {
        const date = order.order_date.split('T')[0]; // Get date part only
        if (!acc[date]) {
          acc[date] = { orders: 0, revenue: 0 };
        }
        acc[date].orders += 1;
        acc[date].revenue += order.total_amount || 0;
        return acc;
      }, {} as Record<string, { orders: number; revenue: number }>);

      const daily_trends = Object.entries(dailyData)
        .map(([date, data]) => ({
          date,
          orders: (data as { orders: number; revenue: number }).orders,
          revenue: (data as { orders: number; revenue: number }).revenue,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // Calculate top customers
      const customerData = ordersData.reduce((acc, order) => {
        const customerId = order.customer_id;
        const customerName = (order as any).customer?.name || 'Unknown Customer';
        
        if (!acc[customerId]) {
          acc[customerId] = {
            customer_id: customerId,
            customer_name: customerName,
            order_count: 0,
            total_revenue: 0,
          };
        }
        
        acc[customerId].order_count += 1;
        acc[customerId].total_revenue += order.total_amount || 0;
        
        return acc;
      }, {} as Record<string, any>);

      const top_customers = Object.values(customerData)
        .sort((a: any, b: any) => b.total_revenue - a.total_revenue)
        .slice(0, 10);

      // Calculate top products
      const productData = ordersData.reduce((acc, order) => {
        order.order_lines?.forEach((line: any) => {
          const productId = line.product_id;
          const productName = line.product?.name || 'Unknown Product';
          
          if (!acc[productId]) {
            acc[productId] = {
              product_id: productId,
              product_name: productName,
              quantity_sold: 0,
              revenue: 0,
            };
          }
          
          acc[productId].quantity_sold += line.quantity;
          acc[productId].revenue += line.subtotal || (line.quantity * line.unit_price);
        });
        
        return acc;
      }, {} as Record<string, any>);

      const top_products = Object.values(productData)
        .sort((a: any, b: any) => b.revenue - a.revenue)
        .slice(0, 10);

      // Calculate delivery performance
      const deliveredOrders = ordersData.filter(o => o.status === 'delivered');
      const scheduledOrders = ordersData.filter(o => o.scheduled_date);
      
      // Calculate on-time vs late deliveries based on scheduled vs actual delivery
      let onTimeDeliveries = 0;
      let lateDeliveries = 0;
      let totalFulfillmentTime = 0;
      let fulfillmentTimeCount = 0;

      deliveredOrders.forEach(order => {
        if (order.scheduled_date) {
          const scheduledDate = new Date(order.scheduled_date);
          const orderDate = new Date(order.order_date);
          
          // For simplicity, consider delivered orders as on-time if they were completed
          // In reality, you'd track actual delivery date vs scheduled date
          onTimeDeliveries += 1;
          
          // Calculate fulfillment time (order date to scheduled date)
          const fulfillmentHours = (scheduledDate.getTime() - orderDate.getTime()) / (1000 * 60 * 60);
          totalFulfillmentTime += fulfillmentHours;
          fulfillmentTimeCount += 1;
        }
      });

      // Calculate late deliveries as orders past their scheduled date that aren't delivered
      const now = new Date();
      lateDeliveries = scheduledOrders.filter(order => 
        new Date(order.scheduled_date) < now && order.status !== 'delivered' && order.status !== 'invoiced'
      ).length;

      const delivery_performance = {
        on_time_deliveries: onTimeDeliveries,
        late_deliveries: lateDeliveries,
        avg_fulfillment_time: fulfillmentTimeCount > 0 ? Math.round(totalFulfillmentTime / fulfillmentTimeCount) : 0,
      };

      // Calculate regional breakdown
      const regionData = ordersData.reduce((acc, order) => {
        const region = (order as any).delivery_address?.city || 'Unknown';
        
        if (!acc[region]) {
          acc[region] = { order_count: 0, revenue: 0 };
        }
        
        acc[region].order_count += 1;
        acc[region].revenue += order.total_amount || 0;
        
        return acc;
      }, {} as Record<string, any>);

      const regional_breakdown = Object.entries(regionData)
        .map(([region, data]: [string, any]) => ({
          region,
          order_count: data.order_count,
          revenue: data.revenue,
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);

      // Calculate summary metrics
      const totalRevenue = ordersData.reduce((sum, order) => sum + (order.total_amount || 0), 0);
      const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
      const completedOrders = ordersData.filter(o => ['delivered', 'invoiced'].includes(o.status)).length;
      const completionRate = totalOrders > 0 ? (completedOrders / totalOrders) * 100 : 0;

      return {
        summary: {
          totalOrders,
          totalRevenue,
          avgOrderValue,
          completionRate,
        },
        orders_by_status,
        daily_trends,
        top_customers,
        top_products,
        delivery_performance,
        regional_breakdown,
      };
    }),

  // GET /analytics/order-stats - Order statistics for dashboard
  getOrderStats: protectedProcedure
    .input(z.object({
      period: z.enum(['today', 'week', 'month', 'quarter', 'year']).default('month'),
    }))
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Fetching order statistics:', input);
      
      const periodDays = {
        today: 1,
        week: 7,
        month: 30,
        quarter: 90,
        year: 365,
      }[input.period];
      
      const startDate = new Date();
      if (input.period === 'today') {
        startDate.setHours(0, 0, 0, 0);
      } else {
        startDate.setDate(startDate.getDate() - periodDays);
      }
      
      // Get all orders
      const { data: allOrders, error: allOrdersError } = await ctx.supabase
        .from('orders')
        .select('id, status, total_amount, order_date, scheduled_date');

      if (allOrdersError) {
        ctx.logger.error('Order stats error:', allOrdersError);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: allOrdersError.message
        });
      }

      const orders = allOrders || [];
      
      // Calculate status counts
      const statusCounts = orders.reduce((acc, order) => {
        acc[order.status] = (acc[order.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Calculate today's deliveries
      const today = new Date().toISOString().split('T')[0];
      const todaysDeliveries = orders.filter(o => 
        o.scheduled_date && o.scheduled_date.split('T')[0] === today
      ).length;

      // Calculate overdue orders
      const now = new Date();
      const overdueOrders = orders.filter(o => 
        o.scheduled_date && 
        new Date(o.scheduled_date) < now && 
        !['delivered', 'invoiced', 'cancelled'].includes(o.status)
      ).length;

      // Calculate revenue from invoiced orders
      const totalRevenue = orders
        .filter(o => o.status === 'invoiced')
        .reduce((sum, order) => sum + (order.total_amount || 0), 0);

      // Calculate period-specific metrics
      const periodOrders = orders.filter(o => new Date(o.order_date) >= startDate);
      const avgOrderValue = periodOrders.length > 0 
        ? periodOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0) / periodOrders.length 
        : 0;

      // Calculate previous period for comparison
      const previousStartDate = new Date(startDate);
      previousStartDate.setDate(previousStartDate.getDate() - periodDays);
      const previousPeriodOrders = orders.filter(o => {
        const orderDate = new Date(o.order_date);
        return orderDate >= previousStartDate && orderDate < startDate;
      });

      return {
        total_orders: orders.length,
        draft_orders: statusCounts['draft'] || 0,
        confirmed_orders: statusCounts['confirmed'] || 0,
        scheduled_orders: statusCounts['scheduled'] || 0,
        en_route_orders: statusCounts['en_route'] || 0,
        delivered_orders: statusCounts['delivered'] || 0,
        invoiced_orders: statusCounts['invoiced'] || 0,
        cancelled_orders: statusCounts['cancelled'] || 0,
        todays_deliveries: todaysDeliveries,
        overdue_orders: overdueOrders,
        total_revenue: totalRevenue,
        avg_order_value: avgOrderValue,
        orders_this_month: periodOrders.length,
        orders_last_month: previousPeriodOrders.length,
        revenue_this_month: periodOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0),
        revenue_last_month: previousPeriodOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0),
      };
    }),
});