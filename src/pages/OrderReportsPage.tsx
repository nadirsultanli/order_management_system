import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, BarChart3, Download, Calendar } from 'lucide-react';
import { useOrdersNew } from '../hooks/useOrders';
import { OrderAnalytics } from '../components/orders/OrderAnalytics';
import { OrderAnalytics as AnalyticsType } from '../types/order';

export const OrderReportsPage: React.FC = () => {
  const navigate = useNavigate();
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days ago
    end: new Date().toISOString().split('T')[0], // today
  });

  // Get all orders for analytics
  const { data: ordersData } = useOrdersNew({
    order_date_from: dateRange.start,
    order_date_to: dateRange.end,
    limit: 10000, // Get all orders in range
  });

  const orders = ordersData?.orders || [];

  // Calculate analytics from orders data
  const analytics: AnalyticsType = useMemo(() => {
    const statusCounts = orders.reduce((acc, order) => {
      acc[order.status] = (acc[order.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const totalOrders = orders.length;
    const orders_by_status = Object.entries(statusCounts).map(([status, count]) => ({
      status,
      count,
      percentage: totalOrders > 0 ? (count / totalOrders) * 100 : 0,
    }));

    // Daily trends
    const dailyData = orders.reduce((acc, order) => {
      const date = order.order_date;
      if (!acc[date]) {
        acc[date] = { orders: 0, revenue: 0 };
      }
      acc[date].orders += 1;
      acc[date].revenue += order.total_amount || 0;
      return acc;
    }, {} as Record<string, { orders: number; revenue: number }>);

    const daily_trends = Object.entries(dailyData).map(([date, data]) => ({
      date,
      orders: data.orders,
      revenue: data.revenue,
    })).sort((a, b) => a.date.localeCompare(b.date));

    // Top customers
    const customerData = orders.reduce((acc, order) => {
      const customerId = order.customer_id;
      const customerName = order.customer?.name || 'Unknown';
      if (!acc[customerId]) {
        acc[customerId] = { customer_name: customerName, order_count: 0, total_revenue: 0 };
      }
      acc[customerId].order_count += 1;
      acc[customerId].total_revenue += order.total_amount || 0;
      return acc;
    }, {} as Record<string, { customer_name: string; order_count: number; total_revenue: number }>);

    const top_customers = Object.entries(customerData)
      .map(([customer_id, data]) => ({ customer_id, ...data }))
      .sort((a, b) => b.total_revenue - a.total_revenue)
      .slice(0, 10);

    // Top products
    const productData = orders.reduce((acc, order) => {
      order.order_lines?.forEach(line => {
        const productId = line.product_id;
        const productName = line.product?.name || 'Unknown';
        if (!acc[productId]) {
          acc[productId] = { product_name: productName, quantity_sold: 0, revenue: 0 };
        }
        acc[productId].quantity_sold += line.quantity;
        acc[productId].revenue += line.subtotal || (line.quantity * line.unit_price);
      });
      return acc;
    }, {} as Record<string, { product_name: string; quantity_sold: number; revenue: number }>);

    const top_products = Object.entries(productData)
      .map(([product_id, data]) => ({ product_id, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // Delivery performance (mock data for now)
    const deliveredOrders = orders.filter(o => o.status === 'delivered');
    const delivery_performance = {
      on_time_deliveries: Math.floor(deliveredOrders.length * 0.85), // 85% on time
      late_deliveries: Math.floor(deliveredOrders.length * 0.15), // 15% late
      avg_fulfillment_time: 48, // 48 hours average
    };

    // Regional breakdown
    const regionData = orders.reduce((acc, order) => {
      const region = order.delivery_address?.city || 'Unknown';
      if (!acc[region]) {
        acc[region] = { order_count: 0, revenue: 0 };
      }
      acc[region].order_count += 1;
      acc[region].revenue += order.total_amount || 0;
      return acc;
    }, {} as Record<string, { order_count: number; revenue: number }>);

    const regional_breakdown = Object.entries(regionData)
      .map(([region, data]) => ({ region, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    return {
      orders_by_status,
      daily_trends,
      top_customers,
      top_products,
      delivery_performance,
      regional_breakdown,
    };
  }, [orders]);

  const handleExportReport = () => {
    // Create CSV content
    const csvContent = [
      ['Date Range', `${dateRange.start} to ${dateRange.end}`],
      ['Total Orders', orders.length.toString()],
      ['Total Revenue', orders.reduce((sum, o) => sum + (o.total_amount || 0), 0).toString()],
      [],
      ['Status', 'Count', 'Percentage'],
      ...analytics.orders_by_status.map(item => [
        item.status,
        item.count.toString(),
        `${item.percentage.toFixed(1)}%`
      ]),
      [],
      ['Top Customers', 'Orders', 'Revenue'],
      ...analytics.top_customers.map(customer => [
        customer.customer_name,
        customer.order_count.toString(),
        customer.total_revenue.toString()
      ]),
    ].map(row => row.join(',')).join('\n');

    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `order-report-${dateRange.start}-to-${dateRange.end}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/orders')}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Orders</span>
          </button>
          <div className="text-gray-400">/</div>
          <h1 className="text-2xl font-bold text-gray-900">Order Reports & Analytics</h1>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleExportReport}
            className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
          >
            <Download className="h-4 w-4" />
            <span>Export Report</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center space-x-3">
            <BarChart3 className="h-8 w-8 text-blue-600" />
            <div>
              <h3 className="text-sm font-medium text-gray-600">Total Orders</h3>
              <p className="text-2xl font-bold text-gray-900">{orders.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center space-x-3">
            <Calendar className="h-8 w-8 text-green-600" />
            <div>
              <h3 className="text-sm font-medium text-gray-600">Total Revenue</h3>
              <p className="text-2xl font-bold text-gray-900">
                {orders.reduce((sum, o) => sum + (o.total_amount || 0), 0).toLocaleString('en-US', {
                  style: 'currency',
                  currency: 'USD',
                })}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center space-x-3">
            <BarChart3 className="h-8 w-8 text-purple-600" />
            <div>
              <h3 className="text-sm font-medium text-gray-600">Avg Order Value</h3>
              <p className="text-2xl font-bold text-gray-900">
                {orders.length > 0 
                  ? (orders.reduce((sum, o) => sum + (o.total_amount || 0), 0) / orders.length).toLocaleString('en-US', {
                      style: 'currency',
                      currency: 'USD',
                    })
                  : '$0'
                }
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center space-x-3">
            <Calendar className="h-8 w-8 text-orange-600" />
            <div>
              <h3 className="text-sm font-medium text-gray-600">Completion Rate</h3>
              <p className="text-2xl font-bold text-gray-900">
                {orders.length > 0 
                  ? `${((orders.filter(o => ['delivered', 'invoiced'].includes(o.status)).length / orders.length) * 100).toFixed(1)}%`
                  : '0%'
                }
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Analytics Component */}
      <OrderAnalytics
        analytics={analytics}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
      />
    </div>
  );
};