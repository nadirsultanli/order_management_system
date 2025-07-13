import React from 'react';
import { Package, CheckCircle, Circle, Lock, AlertTriangle, TrendingUp, Truck, AlertCircle, Wrench } from 'lucide-react';
import { useInventoryStatsNew } from '../../hooks/useInventory';

export const InventoryStats: React.FC = () => {
  const { data: stats, isLoading } = useInventoryStatsNew();

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
      name: 'Total Cylinders',
      value: stats.total_cylinders.toLocaleString(),
      icon: Package,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      name: 'Full Cylinders',
      value: stats.total_full.toLocaleString(),
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      name: 'Empty Cylinders',
      value: stats.total_empty.toLocaleString(),
      icon: Circle,
      color: 'text-gray-600',
      bgColor: 'bg-gray-50',
    },
    {
      name: 'Reserved',
      value: stats.total_reserved.toLocaleString(),
      icon: Lock,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
    },
    {
      name: 'Available',
      value: stats.total_available.toLocaleString(),
      icon: TrendingUp,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
    {
      name: 'Low Stock Items',
      value: stats.low_stock_products.toLocaleString(),
      icon: AlertTriangle,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
    },
  ];

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Inventory Overview</h3>
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