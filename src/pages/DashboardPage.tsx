import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { BarChart3, Users, Package, ShoppingCart, TrendingUp, Warehouse, AlertTriangle } from 'lucide-react';
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
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-600 mt-2">Welcome {adminUser?.name}!</p>
          </div>
          <div className="flex items-center space-x-3">
            <BarChart3 className="h-8 w-8 text-blue-600" />
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
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
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-8">
            <div className="flex items-center space-x-3">
              <AlertTriangle className="h-6 w-6 text-red-600" />
              <div>
                <h3 className="text-base font-medium text-red-800">Low Stock Alert</h3>
                <p className="text-sm text-red-700 mt-1">
                  {stats.lowStockProducts} product{stats.lowStockProducts > 1 ? 's have' : ' has'} low stock levels (≤10 available)
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <button 
              onClick={() => navigate('/orders/new')}
              className="p-6 border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors text-left group"
            >
              <ShoppingCart className="h-10 w-10 text-blue-600 mb-3 group-hover:scale-110 transition-transform" />
              <h3 className="font-semibold text-gray-900 mb-2">New Order</h3>
              <p className="text-sm text-gray-600">Create a new customer order</p>
            </button>
            
            <button 
              onClick={handleAddCustomer}
              className="p-6 border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors text-left group"
            >
              <Users className="h-10 w-10 text-blue-600 mb-3 group-hover:scale-110 transition-transform" />
              <h3 className="font-semibold text-gray-900 mb-2">Add Customer</h3>
              <p className="text-sm text-gray-600">Register a new customer</p>
            </button>
            
            <button 
              onClick={() => window.location.href = '/inventory'}
              className="p-6 border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors text-left group"
            >
              <Package className="h-10 w-10 text-blue-600 mb-3 group-hover:scale-110 transition-transform" />
              <h3 className="font-semibold text-gray-900 mb-2">Manage Inventory</h3>
              <p className="text-sm text-gray-600">Update product stock levels</p>
            </button>
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
    </div>
  );
};