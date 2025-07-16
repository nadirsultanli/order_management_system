import React from 'react';
import { Package, CheckCircle, AlertTriangle, XCircle, Cylinder, Wrench, DollarSign, Tag } from 'lucide-react';
import { useProductStats } from '../../hooks/useProducts';
import { useAccessoryStats } from '../../hooks/useAccessories';

interface UnifiedStatsProps {
  viewMode: 'products' | 'accessories';
}

export const UnifiedStats: React.FC<UnifiedStatsProps> = ({ viewMode }) => {
  const { data: productStats, isLoading: productStatsLoading } = useProductStats();
  const { data: accessoryStats, isLoading: accessoryStatsLoading } = useAccessoryStats();

  const isLoading = viewMode === 'products' ? productStatsLoading : accessoryStatsLoading;
  const stats = viewMode === 'products' ? productStats : accessoryStats;

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const productStatItems = [
    {
      name: 'Total Products',
      value: stats.total,
      icon: Package,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      name: 'Active',
      value: stats.active,
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      name: 'Obsolete',
      value: stats.obsolete,
      icon: XCircle,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
    },
    {
      name: 'Cylinders',
      value: stats.cylinders,
      icon: Cylinder,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
  ];

  const accessoryStatItems = [
    {
      name: 'Total Accessories',
      value: stats.total,
      icon: Wrench,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
    {
      name: 'Active',
      value: stats.active,
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      name: 'Saleable',
      value: stats.saleable,
      icon: DollarSign,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      name: 'Categories',
      value: stats.categories,
      icon: Tag,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
    },
  ];

  const statItems = viewMode === 'products' ? productStatItems : accessoryStatItems;
  const title = viewMode === 'products' ? 'Product Overview' : 'Accessory Overview';

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 justify-center">
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