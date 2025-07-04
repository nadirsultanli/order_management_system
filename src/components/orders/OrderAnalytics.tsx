import React, { useState } from 'react';
import { BarChart3, TrendingUp, Users, Package, Clock, MapPin, Calendar, DollarSign } from 'lucide-react';
import { OrderAnalytics as AnalyticsType } from '../../types/order';
import { formatCurrencySync } from '../../utils/pricing';

interface OrderAnalyticsProps {
  analytics: AnalyticsType;
  dateRange: { start: string; end: string };
  onDateRangeChange: (range: { start: string; end: string }) => void;
}

export const OrderAnalytics: React.FC<OrderAnalyticsProps> = ({
  analytics,
  dateRange,
  onDateRangeChange,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'trends' | 'customers' | 'products' | 'delivery'>('overview');

  const formatPercentage = (value: number) => `${value.toFixed(1)}%`;

  const getStatusColor = (status: string) => {
    const colors: { [key: string]: string } = {
      draft: 'bg-gray-500',
      confirmed: 'bg-blue-500',
      scheduled: 'bg-purple-500',
      en_route: 'bg-orange-500',
      delivered: 'bg-green-500',
      invoiced: 'bg-teal-500',
      cancelled: 'bg-red-500',
    };
    return colors[status] || 'bg-gray-500';
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'trends', label: 'Trends', icon: TrendingUp },
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'products', label: 'Products', icon: Package },
    { id: 'delivery', label: 'Delivery', icon: Clock },
  ];

  return (
    <div className="space-y-6">
      {/* Date Range Selector */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Order Analytics</h2>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Calendar className="h-4 w-4 text-gray-400" />
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => onDateRangeChange({ ...dateRange, start: e.target.value })}
                className="text-sm border border-gray-300 rounded px-2 py-1"
              />
              <span className="text-gray-500">to</span>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => onDateRangeChange({ ...dateRange, end: e.target.value })}
                className="text-sm border border-gray-300 rounded px-2 py-1"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Status Distribution */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Orders by Status</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    {analytics.orders_by_status.map((item) => (
                      <div key={item.status} className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className={`w-3 h-3 rounded-full ${getStatusColor(item.status)}`}></div>
                          <span className="text-sm font-medium text-gray-900 capitalize">
                            {item.status.replace('_', ' ')}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-gray-600">{item.count}</span>
                          <span className="text-xs text-gray-500">
                            ({formatPercentage(item.percentage)})
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="relative">
                    {/* Simple pie chart representation */}
                    <div className="w-48 h-48 mx-auto relative">
                      <div className="w-full h-full rounded-full bg-gray-200 relative overflow-hidden">
                        {analytics.orders_by_status.map((item, index) => {
                          const startAngle = analytics.orders_by_status
                            .slice(0, index)
                            .reduce((sum, prev) => sum + prev.percentage, 0) * 3.6;
                          const endAngle = item.percentage * 3.6;
                          
                          return (
                            <div
                              key={item.status}
                              className={`absolute inset-0 ${getStatusColor(item.status)} opacity-80`}
                              style={{
                                clipPath: `polygon(50% 50%, ${50 + 50 * Math.cos((startAngle - 90) * Math.PI / 180)}% ${50 + 50 * Math.sin((startAngle - 90) * Math.PI / 180)}%, ${50 + 50 * Math.cos((startAngle + endAngle - 90) * Math.PI / 180)}% ${50 + 50 * Math.sin((startAngle + endAngle - 90) * Math.PI / 180)}%)`,
                              }}
                            />
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Delivery Performance */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Delivery Performance</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-green-50 rounded-lg p-4">
                    <div className="flex items-center space-x-2">
                      <Clock className="h-5 w-5 text-green-600" />
                      <span className="text-sm font-medium text-green-900">On-Time Deliveries</span>
                    </div>
                    <div className="mt-2">
                      <div className="text-2xl font-bold text-green-900">
                        {analytics.delivery_performance.on_time_deliveries}
                      </div>
                      <div className="text-sm text-green-700">
                        {formatPercentage(
                          analytics.delivery_performance.on_time_deliveries + analytics.delivery_performance.late_deliveries > 0
                            ? (analytics.delivery_performance.on_time_deliveries / 
                               (analytics.delivery_performance.on_time_deliveries + analytics.delivery_performance.late_deliveries)) * 100
                            : 0
                        )} success rate
                      </div>
                    </div>
                  </div>

                  <div className="bg-red-50 rounded-lg p-4">
                    <div className="flex items-center space-x-2">
                      <Clock className="h-5 w-5 text-red-600" />
                      <span className="text-sm font-medium text-red-900">Late Deliveries</span>
                    </div>
                    <div className="mt-2">
                      <div className="text-2xl font-bold text-red-900">
                        {analytics.delivery_performance.late_deliveries}
                      </div>
                      <div className="text-sm text-red-700">
                        Need attention
                      </div>
                    </div>
                  </div>

                  <div className="bg-blue-50 rounded-lg p-4">
                    <div className="flex items-center space-x-2">
                      <TrendingUp className="h-5 w-5 text-blue-600" />
                      <span className="text-sm font-medium text-blue-900">Avg Fulfillment</span>
                    </div>
                    <div className="mt-2">
                      <div className="text-2xl font-bold text-blue-900">
                        {analytics.delivery_performance.avg_fulfillment_time}h
                      </div>
                      <div className="text-sm text-blue-700">
                        Average time
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Trends Tab */}
          {activeTab === 'trends' && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-gray-900">Daily Order Trends</h3>
              <div className="space-y-4">
                {analytics.daily_trends.slice(-7).map((day) => (
                  <div key={day.date} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <div className="font-medium text-gray-900">
                        {new Date(day.date).toLocaleDateString('en-US', { 
                          weekday: 'long', 
                          month: 'short', 
                          day: 'numeric' 
                        })}
                      </div>
                      <div className="text-sm text-gray-600">{day.orders} orders</div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-gray-900">
                        {formatCurrencySync(day.revenue)}
                      </div>
                      <div className="text-sm text-gray-600">
                        {formatCurrencySync(day.orders > 0 ? day.revenue / day.orders : 0)} avg
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Customers Tab */}
          {activeTab === 'customers' && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-gray-900">Top Customers</h3>
              <div className="space-y-3">
                {analytics.top_customers.map((customer, index) => (
                  <div key={customer.customer_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium text-blue-600">#{index + 1}</span>
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{customer.customer_name}</div>
                        <div className="text-sm text-gray-600">{customer.order_count} orders</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-gray-900">
                        {formatCurrencySync(customer.total_revenue)}
                      </div>
                      <div className="text-sm text-gray-600">
                        {formatCurrencySync(customer.order_count > 0 ? customer.total_revenue / customer.order_count : 0)} avg
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Products Tab */}
          {activeTab === 'products' && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-gray-900">Top Products</h3>
              <div className="space-y-3">
                {analytics.top_products.map((product, index) => (
                  <div key={product.product_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium text-green-600">#{index + 1}</span>
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{product.product_name}</div>
                        <div className="text-sm text-gray-600">{product.quantity_sold} units sold</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-gray-900">
                        {formatCurrencySync(product.revenue)}
                      </div>
                      <div className="text-sm text-gray-600">
                        {formatCurrencySync(product.quantity_sold > 0 ? product.revenue / product.quantity_sold : 0)} per unit
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Delivery Tab */}
          {activeTab === 'delivery' && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-gray-900">Regional Breakdown</h3>
              <div className="space-y-3">
                {analytics.regional_breakdown.map((region, index) => (
                  <div key={region.region} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <MapPin className="h-5 w-5 text-gray-400" />
                      <div>
                        <div className="font-medium text-gray-900">{region.region}</div>
                        <div className="text-sm text-gray-600">{region.order_count} orders</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-gray-900">
                        {formatCurrencySync(region.revenue)}
                      </div>
                      <div className="text-sm text-gray-600">
                        {formatCurrencySync(region.order_count > 0 ? region.revenue / region.order_count : 0)} avg
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};