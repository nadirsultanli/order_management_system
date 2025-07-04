import React from 'react';
import { ShoppingCart, CheckCircle, Calendar, Truck, Package, Receipt, XCircle, AlertTriangle, TrendingUp } from 'lucide-react';
import { useOrderStats } from '../../hooks/useAnalytics';
import { formatCurrencySync } from '../../utils/pricing';

export const OrderStats: React.FC = () => {
  const { data: stats, isLoading } = useOrderStats();

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const statItems = [
    {
      name: 'Total Orders',
      value: stats.total_orders,
      icon: ShoppingCart,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      name: 'Draft',
      value: stats.draft_orders,
      icon: ShoppingCart,
      color: 'text-gray-600',
      bgColor: 'bg-gray-50',
    },
    {
      name: 'Confirmed',
      value: stats.confirmed_orders,
      icon: CheckCircle,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      name: 'Scheduled',
      value: stats.scheduled_orders,
      icon: Calendar,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
    {
      name: 'En Route',
      value: stats.en_route_orders,
      icon: Truck,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
    },
    {
      name: 'Delivered',
      value: stats.delivered_orders,
      icon: Package,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      name: 'Invoiced',
      value: stats.invoiced_orders,
      icon: Receipt,
      color: 'text-teal-600',
      bgColor: 'bg-teal-50',
    },
    {
      name: 'Cancelled',
      value: stats.cancelled_orders,
      icon: XCircle,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
    },
    {
      name: "Today's Deliveries",
      value: stats.todays_deliveries,
      icon: Calendar,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
    },
    {
      name: 'Overdue',
      value: stats.overdue_orders,
      icon: AlertTriangle,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Main Stats Grid */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Order Overview</h3>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {statItems.map((item) => (
            <div key={item.name} className="text-center">
              <div className={`inline-flex items-center justify-center w-12 h-12 rounded-full ${item.bgColor} mb-2`}>
                <item.icon className={`h-6 w-6 ${item.color}`} />
              </div>
              <div className="text-2xl font-bold text-gray-900">{item.value}</div>
              <div className="text-sm text-gray-600">{item.name}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Revenue Card */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Total Revenue</h3>
            <p className="text-sm text-gray-600">From invoiced orders</p>
          </div>
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-green-50 rounded-full">
              <TrendingUp className="h-6 w-6 text-green-600" />
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-gray-900">
                {stats.total_revenue ? formatCurrencySync(stats.total_revenue) : 'Ksh 0.00'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {(stats.overdue_orders > 0 || stats.todays_deliveries > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {stats.todays_deliveries > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <Calendar className="h-5 w-5 text-blue-600" />
                <div>
                  <h3 className="text-sm font-medium text-blue-800">Today's Deliveries</h3>
                  <p className="text-sm text-blue-700">
                    {stats.todays_deliveries} order{stats.todays_deliveries > 1 ? 's' : ''} scheduled for delivery today
                  </p>
                </div>
              </div>
            </div>
          )}

          {stats.overdue_orders > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <div>
                  <h3 className="text-sm font-medium text-red-800">Overdue Orders</h3>
                  <p className="text-sm text-red-700">
                    {stats.overdue_orders} order{stats.overdue_orders > 1 ? 's are' : ' is'} past scheduled delivery date
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};