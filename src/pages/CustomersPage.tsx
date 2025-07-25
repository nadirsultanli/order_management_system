import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useCustomers, useCreateCustomer, useUpdateCustomer, useDeleteCustomer } from '../hooks/useCustomers';
import { CustomerTable } from '../components/customers/CustomerTable';
import { CustomerFilters } from '../components/customers/CustomerFilters';
import { CustomerPagination } from '../components/customers/CustomerPagination';
import { CustomerForm } from '../components/customers/CustomerForm';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { ErrorBoundary, useErrorHandler } from '../components/ui/ErrorBoundary';
import { Customer, CustomerFilters as FilterType, CreateCustomerData } from '../types/customer';

export const CustomersPage: React.FC = () => {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<FilterType>({ page: 1 });
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deletingCustomer, setDeletingCustomer] = useState<Customer | null>(null);
  const handleError = useErrorHandler();

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

  const handleDeleteCustomer = (customer: Customer) => {
    console.log('Initiating customer deletion:', customer);
    setDeletingCustomer(customer);
  };

  const handleStatusChange = async (customer: Customer, newStatus: 'active' | 'credit_hold' | 'closed') => {
    try {
      console.log('Updating customer status:', { customerId: customer.id, newStatus });
      await updateCustomer.mutateAsync({
        id: customer.id,
        account_status: newStatus
      });
    } catch (error) {
      console.error('Error updating customer status:', error);
      handleError(error as Error, { customerId: customer.id, newStatus });
      // Error handling is done in the useUpdateCustomer hook
    }
  };

  const handleFormSubmit = async (data: CreateCustomerData) => {
    console.log('Form submit:', data);
    try {
      const newCustomer = await createCustomer.mutateAsync(data);
      console.log('Customer created, navigating to details:', newCustomer);
      setIsFormOpen(false);
      
      // Navigate to the newly created customer's detail page
      navigate(`/customers/${newCustomer.id}`);
    } catch (error) {
      console.error('Form submit error:', error);
      handleError(error as Error, { formData: data });
      // Error handling is done in the hooks
    }
  };

  const handleConfirmDelete = async () => {
    if (deletingCustomer) {
      console.log('Confirming delete:', deletingCustomer);
      try {
        await deleteCustomer.mutateAsync({ customer_id: deletingCustomer.id });
        setDeletingCustomer(null);
      } catch (error) {
        console.error('Delete error:', error);
        handleError(error as Error, { customerId: deletingCustomer.id });
        // Error handling is done in the hooks
      }
    }
  };

  const handlePageChange = (page: number) => {
    console.log('Page change:', page);
    setFilters(prev => ({ ...prev, page }));
  };



  return (
    <ErrorBoundary>
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
          itemsPerPage={15}
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
    </ErrorBoundary>
  );
};