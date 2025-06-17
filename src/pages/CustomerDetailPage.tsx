import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit, Mail, Phone, Calendar, CreditCard, Building2 } from 'lucide-react';
import { useCustomer, useUpdateCustomer } from '../hooks/useCustomers';
import { useCustomerOrders } from '../hooks/useCustomerOrders';
import { CustomerForm } from '../components/customers/CustomerForm';
import { AddressList } from '../components/addresses/AddressList';
import { CustomerRecentOrders } from '../components/orders/CustomerRecentOrders';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Customer, CreateCustomerData } from '../types/customer';

export const CustomerDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isEditFormOpen, setIsEditFormOpen] = useState(false);

  const { data: customer, isLoading, error } = useCustomer(id!);
  const updateCustomer = useUpdateCustomer();
  const { data: recentOrders, isLoading: isLoadingOrders } = useCustomerOrders(customer?.id || '', 5);

  const handleEditSubmit = async (data: CreateCustomerData) => {
    if (customer) {
      try {
        await updateCustomer.mutateAsync({ id: customer.id, ...data });
        setIsEditFormOpen(false);
      } catch (error) {
        // Error handling is done in the hook
      }
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/customers')}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Customers</span>
          </button>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
            <div className="space-y-3">
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              <div className="h-4 bg-gray-200 rounded w-1/3"></div>
              <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/customers')}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Customers</span>
          </button>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          <div className="text-center">
            <p className="text-red-600">Customer not found or error loading customer details.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/customers')}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Customers</span>
          </button>
          <div className="text-gray-400">/</div>
          <h1 className="text-2xl font-bold text-gray-900">{customer.name}</h1>
        </div>
        <button
          onClick={() => setIsEditFormOpen(true)}
          className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Edit className="h-4 w-4" />
          <span>Edit Customer</span>
        </button>
      </div>

      {/* Customer Information */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Customer Information</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">
                  Business Name
                </label>
                <div className="flex items-center space-x-2">
                  <Building2 className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-900">{customer.name}</span>
                </div>
              </div>

              {customer.external_id && (
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    External ID
                  </label>
                  <span className="text-gray-900">{customer.external_id}</span>
                </div>
              )}

              {customer.tax_id && (
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    Tax ID (VAT/EIN)
                  </label>
                  <span className="text-gray-900">{customer.tax_id}</span>
                </div>
              )}

              {customer.email && (
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    Email
                  </label>
                  <div className="flex items-center space-x-2">
                    <Mail className="h-4 w-4 text-gray-400" />
                    <a
                      href={`mailto:${customer.email}`}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      {customer.email}
                    </a>
                  </div>
                </div>
              )}

              {customer.phone && (
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    Phone
                  </label>
                  <div className="flex items-center space-x-2">
                    <Phone className="h-4 w-4 text-gray-400" />
                    <a
                      href={`tel:${customer.phone}`}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      {customer.phone}
                    </a>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">
                  Account Status
                </label>
                <StatusBadge status={customer.account_status} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">
                  Credit Terms
                </label>
                <div className="flex items-center space-x-2">
                  <CreditCard className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-900">{customer.credit_terms_days} days</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Account Details */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Account Details</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">
                  Created
                </label>
                <div className="flex items-center space-x-2">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-900">
                    {formatDate(customer.created_at)}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">
                  Last Updated
                </label>
                <div className="flex items-center space-x-2">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-900">
                    {formatDate(customer.updated_at)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Delivery Addresses */}
      <AddressList customerId={customer.id} />

      {/* Recent Orders */}
      <CustomerRecentOrders
        orders={recentOrders || []}
        loading={isLoadingOrders}
      />

      {/* Edit Form Modal */}
      <CustomerForm
        isOpen={isEditFormOpen}
        onClose={() => setIsEditFormOpen(false)}
        onSubmit={handleEditSubmit}
        customer={customer}
        loading={updateCustomer.isPending}
        title="Edit Customer"
      />
    </div>
  );
};