import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, BarChart3, Download, Calendar } from 'lucide-react';
import { useComprehensiveOrderAnalytics } from '../hooks/useAnalytics';
import { OrderAnalytics } from '../components/orders/OrderAnalytics';
import { OrderAnalytics as AnalyticsType } from '../types/order';

export const OrderReportsPage: React.FC = () => {
  const navigate = useNavigate();
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days ago
    end: new Date().toISOString().split('T')[0], // today
  });

  // Get analytics from backend API (replaces all frontend calculations)
  const { data: analyticsData, isLoading } = useComprehensiveOrderAnalytics(
    dateRange.start,
    dateRange.end
  );

  const analytics: AnalyticsType = analyticsData || {
    orders_by_status: [],
    daily_trends: [],
    top_customers: [],
    top_products: [],
    delivery_performance: { on_time_deliveries: 0, late_deliveries: 0, avg_fulfillment_time: 0 },
    regional_breakdown: [],
  };

  const handleExportReport = () => {
    if (!analyticsData) {
      return;
    }

    // Create CSV content using backend analytics data
    const csvContent = [
      ['Date Range', `${dateRange.start} to ${dateRange.end}`],
      ['Total Orders', analyticsData.summary.totalOrders.toString()],
      ['Total Revenue', analyticsData.summary.totalRevenue.toString()],
      ['Average Order Value', analyticsData.summary.avgOrderValue.toString()],
      ['Completion Rate', `${analyticsData.summary.completionRate.toFixed(1)}%`],
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
              <p className="text-2xl font-bold text-gray-900">
                {isLoading ? '...' : (analyticsData?.summary.totalOrders || 0).toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center space-x-3">
            <Calendar className="h-8 w-8 text-green-600" />
            <div>
              <h3 className="text-sm font-medium text-gray-600">Total Revenue</h3>
              <p className="text-2xl font-bold text-gray-900">
                {isLoading ? '...' : (analyticsData?.summary.totalRevenue || 0).toLocaleString('en-US', {
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
                {isLoading ? '...' : (analyticsData?.summary.avgOrderValue || 0).toLocaleString('en-US', {
                  style: 'currency',
                  currency: 'USD',
                })}
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
                {isLoading ? '...' : `${(analyticsData?.summary.completionRate || 0).toFixed(1)}%`}
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