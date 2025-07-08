import React from 'react';
import { Package, CheckCircle, AlertTriangle, XCircle, Cylinder, Weight } from 'lucide-react';
import { useProductStats } from '../../hooks/useProducts';

export const ProductStats: React.FC = () => {
  const { data: stats, isLoading } = useProductStats();

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
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
    {
      name: 'By Weight',
      value: stats.kg_products,
      icon: Weight,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
    },
  ];

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Product Overview</h3>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 justify-center">
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