import React from 'react';
import { DollarSign, CheckCircle, Clock, XCircle, AlertTriangle, Package } from 'lucide-react';
import { usePricingStatsNew } from '../../hooks/usePricing';

export const PricingStats: React.FC = () => {
  const { data: stats, isLoading } = usePricingStatsNew();

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
            {[...Array(6)].map((_, i) => (
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
      name: 'Total Price Lists',
      value: stats.total_price_lists,
      icon: DollarSign,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      name: 'Active',
      value: stats.active_price_lists,
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      name: 'Future',
      value: stats.future_price_lists,
      icon: Clock,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      name: 'Expired',
      value: stats.expired_price_lists,
      icon: XCircle,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
    },
    {
      name: 'Expiring Soon',
      value: stats.expiring_soon,
      icon: AlertTriangle,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
    },
    {
      name: 'No Pricing',
      value: stats.products_without_pricing,
      icon: Package,
      color: 'text-gray-600',
      bgColor: 'bg-gray-50',
    },
  ];

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Pricing Overview</h3>
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
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
  );
};