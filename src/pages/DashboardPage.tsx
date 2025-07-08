import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { BarChart3, Users, Package, ShoppingCart, TrendingUp, Warehouse, AlertTriangle, Activity } from 'lucide-react';
import { useDashboardStats } from '../hooks/useDashboardStats';
import { useCreateCustomer } from '../hooks/useCustomers';
import { CustomerForm } from '../components/customers/CustomerForm';
import { CreateCustomerData } from '../types/customer';

export const DashboardPage: React.FC = () => {
  const { adminUser } = useAuth();
  const navigate = useNavigate();
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useDashboardStats();
  const createCustomer = useCreateCustomer();
  const [isCustomerFormOpen, setIsCustomerFormOpen] = useState(false);

  const handleAddCustomer = () => {
    setIsCustomerFormOpen(true);
  };

  const handleCustomerFormSubmit = async (data: CreateCustomerData) => {
    try {
      const newCustomer = await createCustomer.mutateAsync(data);
      setIsCustomerFormOpen(false);
      // Navigate to the newly created customer's detail page
      navigate(`/customers/${newCustomer.id}`);
    } catch (error) {
      console.error('Failed to create customer:', error);
      // Error handling is done in the hook
    }
  };

  const dashboardStats = [
    {
      name: 'Active Customers',
      value: statsLoading ? '...' : (stats?.activeCustomers || 0).toLocaleString(),
      total: statsLoading ? '...' : (stats?.totalCustomers || 0).toLocaleString(),
      change: statsLoading ? '...' : `${stats?.totalCustomers || 0} total`,
      changeType: 'neutral',
      icon: Users,
    },
    {
      name: 'Active Products',
      value: statsLoading ? '...' : (stats?.activeProducts || 0).toLocaleString(),
      total: statsLoading ? '...' : (stats?.totalProducts || 0).toLocaleString(),
      change: statsLoading ? '...' : `${stats?.totalProducts || 0} total`,
      changeType: 'neutral',
      icon: Package,
    },
    {
      name: 'Total Cylinders',
      value: statsLoading ? '...' : (stats?.totalCylinders || 0).toLocaleString(),
      change: statsLoading ? '...' : 'across all warehouses',
      changeType: 'positive',
      icon: TrendingUp,
    },
    {
      name: 'Warehouses',
      value: statsLoading ? '...' : (stats?.totalWarehouses || 0).toLocaleString(),
      change: statsLoading ? '...' : 'storage locations',
      changeType: 'neutral',
      icon: Warehouse,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600">Welcome {adminUser?.name}!</p>
        </div>
        <div className="flex items-center space-x-3">
          <BarChart3 className="h-8 w-8 text-blue-600" />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {dashboardStats.map((stat) => (
          <div
            key={stat.name}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              </div>
              <div className="p-3 bg-blue-50 rounded-full">
                <stat.icon className="h-6 w-6 text-blue-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center">
              <span className="text-sm text-gray-500">{stat.change}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Low Stock Alert */}
      {!statsLoading && stats && stats.lowStockProducts > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <div>
              <h3 className="text-sm font-medium text-red-800">Low Stock Alert</h3>
              <p className="text-sm text-red-700">
                {stats.lowStockProducts} product{stats.lowStockProducts > 1 ? 's have' : ' has'} low stock levels (≤10 available)
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button 
            onClick={() => window.location.href = '/orders'}
            className="p-4 border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors"
          >
            <ShoppingCart className="h-8 w-8 text-blue-600 mb-2" />
            <h3 className="font-medium text-gray-900">New Order</h3>
            <p className="text-sm text-gray-600">Create a new customer order</p>
          </button>
          
          <button 
            onClick={handleAddCustomer}
            className="p-4 border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors"
          >
            <Users className="h-8 w-8 text-blue-600 mb-2" />
            <h3 className="font-medium text-gray-900">Add Customer</h3>
            <p className="text-sm text-gray-600">Register a new customer</p>
          </button>
          
          <button 
            onClick={() => window.location.href = '/inventory'}
            className="p-4 border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors"
          >
            <Package className="h-8 w-8 text-blue-600 mb-2" />
            <h3 className="font-medium text-gray-900">Manage Inventory</h3>
            <p className="text-sm text-gray-600">Update product stock levels</p>
          </button>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
          <Activity className="h-5 w-5 text-gray-400" />
        </div>
        
        <div className="text-center py-8">
          <Activity className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">Recent activity tracking coming soon</p>
        </div>
      </div>

      {/* Customer Form Modal */}
      <CustomerForm
        isOpen={isCustomerFormOpen}
        onClose={() => setIsCustomerFormOpen(false)}
        onSubmit={handleCustomerFormSubmit}
        customer={undefined}
        loading={createCustomer.isPending}
        title="Add New Customer"
      />
    </div>
  );
};