import { z } from 'zod';
import { router, protectedProcedure } from '../lib/trpc';
import { requireTenantAccess } from '../lib/auth';
import { TRPCError } from '@trpc/server';

export const analyticsRouter = router({
  // GET /dashboard/stats - Get dashboard statistics
  getDashboardStats: protectedProcedure
    .input(z.object({
      period: z.enum(['today', 'week', 'month', 'quarter', 'year']).default('month'),
    }))
    .query(async ({ input, ctx }) => {
      const user = requireTenantAccess(ctx);
      
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
        .eq('tenant_id', user.tenant_id)
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
        .eq('tenant_id', user.tenant_id)
        .gte('created_at', startDate.toISOString());

      if (customersError) {
        ctx.logger.error('Dashboard customers error:', customersError);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: customersError.message
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

      return {
        period: input.period,
        totalOrders,
        totalRevenue,
        avgOrderValue,
        newCustomers,
        uniqueCustomers,
        statusCounts,
      };
    }),

  // GET /analytics/revenue - Get revenue analytics
  getRevenueAnalytics: protectedProcedure
    .input(z.object({
      period: z.enum(['week', 'month', 'quarter', 'year']).default('month'),
      breakdown_by: z.enum(['day', 'week', 'month']).default('day'),
    }))
    .query(async ({ input, ctx }) => {
      const user = requireTenantAccess(ctx);
      
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
        .eq('tenant_id', user.tenant_id)
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
          revenue: data.revenue,
          orders: data.orders,
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
      const user = requireTenantAccess(ctx);
      
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
        .eq('tenant_id', user.tenant_id)
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
      const totalRevenue = orders?.reduce((sum, order) => sum + (order.total_amount || 0), 0) || 0;
      
      // Group by status
      const statusBreakdown = orders?.reduce((acc, order) => {
        acc[order.status] = (acc[order.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};
      
      let groupedData = null;
      
      if (input.group_by === 'customer') {
        groupedData = orders?.reduce((acc, order) => {
          const customerId = order.customer?.id || 'unknown';
          const customerName = order.customer?.name || 'Unknown Customer';
          
          if (!acc[customerId]) {
            acc[customerId] = {
              customer_id: customerId,
              customer_name: customerName,
              orders: 0,
              revenue: 0,
            };
          }
          
          acc[customerId].orders += 1;
          acc[customerId].revenue += order.total_amount || 0;
          
          return acc;
        }, {} as Record<string, any>) || {};
      } else if (input.group_by === 'product') {
        const productData: Record<string, any> = {};
        
        orders?.forEach(order => {
          order.order_lines?.forEach((line: any) => {
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
      const user = requireTenantAccess(ctx);
      
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
          .eq('tenant_id', user.tenant_id)
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
          .eq('tenant_id', user.tenant_id)
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
              customer_name: order.customer?.name || 'Unknown',
              customer_email: order.customer?.email || '',
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
          .eq('tenant_id', user.tenant_id)
          .gte('order_date', startDate.toISOString());

        const { data: previousOrders, error: previousError } = await ctx.supabase
          .from('orders')
          .select('customer_id')
          .eq('tenant_id', user.tenant_id)
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
              customer_name: order.customer?.name || 'Unknown',
              customer_email: order.customer?.email || '',
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
      const user = requireTenantAccess(ctx);
      
      ctx.logger.info('Fetching inventory analytics:', input);
      
      let query = ctx.supabase
        .from('inventory_balances')
        .select(`
          *,
          product:products(id, sku, name, unit_of_measure),
          warehouse:warehouses(id, name)
        `)
        .eq('tenant_id', user.tenant_id);
      
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
});