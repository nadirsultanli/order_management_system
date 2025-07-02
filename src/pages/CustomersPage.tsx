import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, RefreshCw } from 'lucide-react';
import { useCustomers, useCreateCustomer, useUpdateCustomer, useDeleteCustomer } from '../hooks/useCustomers';
import { CustomerTable } from '../components/customers/CustomerTable';
import { CustomerFilters } from '../components/customers/CustomerFilters';
import { CustomerPagination } from '../components/customers/CustomerPagination';
import { CustomerForm } from '../components/customers/CustomerForm';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Customer, CustomerFilters as FilterType, CreateCustomerData } from '../types/customer';

export const CustomersPage: React.FC = () => {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<FilterType>({ page: 1 });
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deletingCustomer, setDeletingCustomer] = useState<Customer | null>(null);

  const { data, isLoading, error, refetch } = useCustomers(filters);
  const createCustomer = useCreateCustomer();
  const updateCustomer = useUpdateCustomer();
  const deleteCustomer = useDeleteCustomer();

  // Debug logging
  useEffect(() => {
    console.log('CustomersPage state:', {
      filters,
      data,
      isLoading,
      error,
      isFormOpen,
    });
  }, [filters, data, isLoading, error, isFormOpen]);

  const handleAddCustomer = () => {
    console.log('Adding new customer');
    setIsFormOpen(true);
  };

  const handleViewCustomer = (customer: Customer) => {
    console.log('Viewing customer:', customer);
    navigate(`/customers/${customer.id}`);
  };

  const handleDeleteCustomer = async (customer: Customer) => {
    if (window.confirm('Are you sure you want to delete this customer?')) {
      try {
        await deleteCustomer(customer.id);
        setDeletingCustomer(null);
      } catch (error) {
        console.error('Error deleting customer:', error);
        alert('Failed to delete customer. Please try again.');
      }
    }
  };

  const handleStatusChange = async (customer: Customer, newStatus: 'active' | 'credit_hold' | 'closed') => {
    try {
      await updateCustomer.mutateAsync({
        id: customer.id,
        account_status: newStatus
      });
    } catch (error) {
      console.error('Error updating customer status:', error);
      // Error handling is done in the useUpdateCustomer hook
    }
  };

  const handleFormSubmit = async (data: CreateCustomerData) => {
    console.log('Form submit:', data);
    try {
      await createCustomer.mutateAsync(data);
      setIsFormOpen(false);
    } catch (error) {
      console.error('Form submit error:', error);
      // Error handling is done in the hooks
    }
  };

  const handleConfirmDelete = async () => {
    if (deletingCustomer) {
      console.log('Confirming delete:', deletingCustomer);
      try {
        await deleteCustomer.mutateAsync(deletingCustomer.id);
        setDeletingCustomer(null);
      } catch (error) {
        console.error('Delete error:', error);
        // Error handling is done in the hooks
      }
    }
  };

  const handlePageChange = (page: number) => {
    console.log('Page change:', page);
    setFilters(prev => ({ ...prev, page }));
  };

  const handleRefresh = () => {
    console.log('Refreshing customers');
    refetch();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
          <p className="text-gray-600">Manage your customer database</p>
          {error && (
            <p className="text-red-600 text-sm mt-1">
              Error: {error.message}
            </p>
          )}
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="flex items-center space-x-2 bg-gray-100 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={handleAddCustomer}
            className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Add Customer</span>
          </button>
        </div>
      </div>

      <CustomerFilters filters={filters} onFiltersChange={setFilters} />

      <CustomerTable
        customers={data?.customers || []}
        loading={isLoading}
        onView={handleViewCustomer}
        onDelete={handleDeleteCustomer}
        onStatusChange={handleStatusChange}
      />

      {data && data.totalPages > 1 && (
        <CustomerPagination
          currentPage={data.currentPage}
          totalPages={data.totalPages}
          totalCount={data.totalCount}
          onPageChange={handlePageChange}
        />
      )}

      <CustomerForm
        isOpen={isFormOpen}
        onClose={() => {
          console.log('Closing form');
          setIsFormOpen(false);
        }}
        onSubmit={handleFormSubmit}
        customer={undefined}
        loading={createCustomer.isPending}
        title="Add New Customer"
      />

      <ConfirmDialog
        isOpen={!!deletingCustomer}
        onClose={() => setDeletingCustomer(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Customer"
        message={`Are you sure you want to delete "${deletingCustomer?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        type="danger"
        loading={deleteCustomer.isPending}
      />
    </div>
  );
};