import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, RefreshCw, Calendar, BarChart3 } from 'lucide-react';
import { useOrdersNew, useUpdateOrderStatusNew } from '../hooks/useOrdersNew';
import { OrderTable } from '../components/orders/OrderTable';
import { AdvancedOrderFilters } from '../components/orders/AdvancedOrderFilters';
import { OrderStats } from '../components/orders/OrderStats';
import { OrderStatusModal } from '../components/orders/OrderStatusModal';
import { BulkOrderActions } from '../components/orders/BulkOrderActions';
import { CustomerPagination } from '../components/customers/CustomerPagination';
import { Order, OrderFilters as FilterType, OrderStatusChange, BulkOrderOperation } from '../types/order';

// Convert old filter format to new API format
const convertFiltersToNew = (oldFilters: FilterType) => {
  return {
    status: oldFilters.status as any,
    customer_id: oldFilters.customer_id,
    search: oldFilters.search,
    order_date_from: oldFilters.order_date_from,
    order_date_to: oldFilters.order_date_to,
    scheduled_date_from: oldFilters.scheduled_date_from,
    scheduled_date_to: oldFilters.scheduled_date_to,
    page: oldFilters.page || 1,
    limit: oldFilters.limit || 50,
  };
};

export const OrdersPageNew: React.FC = () => {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<FilterType>({ page: 1 });
  const [statusChangeOrder, setStatusChangeOrder] = useState<{ order: Order; newStatus: string } | null>(null);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);

  // Use new backend API hooks instead of direct Supabase
  const { data, isLoading, error, refetch } = useOrdersNew(convertFiltersToNew(filters));
  const updateOrderStatusMutation = useUpdateOrderStatusNew();

  // Debug logging
  useEffect(() => {
    console.log('OrdersPageNew state:', {
      filters,
      data,
      isLoading,
      error,
      statusChangeOrder,
      selectedOrders,
    });
  }, [filters, data, isLoading, error, statusChangeOrder, selectedOrders]);

  const handleCreateOrder = () => {
    console.log('Creating new order');
    navigate('/orders/new');
  };

  const handleViewOrder = (order: Order) => {
    console.log('Viewing order:', order);
    navigate(`/orders/${order.id}`);
  };

  const handleEditOrder = (order: Order) => {
    console.log('Editing order:', order);
    navigate(`/orders/${order.id}/edit`);
  };

  const handleChangeStatus = (order: Order, newStatus: string) => {
    console.log('Changing order status:', order, newStatus);
    setStatusChangeOrder({ order, newStatus });
  };

  const handleConfirmStatusChange = (statusChange: OrderStatusChange) => {
    console.log('Confirming status change:', statusChange);
    
    // Use the new backend API mutation instead of the old hook
    updateOrderStatusMutation.mutate({
      order_id: statusChange.order_id,
      new_status: statusChange.new_status,
      scheduled_date: statusChange.scheduled_date,
      reason: statusChange.reason,
    });
    
    setStatusChangeOrder(null);
  };

  const handleBulkOperation = (operation: BulkOrderOperation) => {
    console.log('Performing bulk operation:', operation);
    
    // TODO: Implement bulk operations using new backend APIs
    // This would require additional backend endpoints for bulk operations
    switch (operation.type) {
      case 'change_status':
        // Could implement by calling updateOrderStatusMutation for each selected order
        console.log('Bulk status change not yet implemented with new API');
        break;
      case 'assign_truck':
        console.log('Bulk truck assignment not yet implemented with new API');
        break;
      case 'export':
        console.log('Bulk export not yet implemented with new API');
        break;
    }
  };

  const handleFilterChange = (newFilters: FilterType) => {
    console.log('Applying filters:', newFilters);
    setFilters(newFilters);
    setSelectedOrders([]);
  };

  const handlePageChange = (page: number) => {
    console.log('Changing page to:', page);
    setFilters(prev => ({ ...prev, page }));
    setSelectedOrders([]);
  };

  const handleRefresh = () => {
    console.log('Refreshing orders');
    refetch();
  };

  const handleOrderSelect = (orderId: string, selected: boolean) => {
    setSelectedOrders(prev =>
      selected
        ? [...prev, orderId]
        : prev.filter(id => id !== orderId)
    );
  };

  const handleSelectAll = (selected: boolean) => {
    setSelectedOrders(selected ? (data?.orders.map(order => order.id) || []) : []);
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Loading orders...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <h3 className="text-red-800 font-medium mb-2">Failed to load orders</h3>
        <p className="text-red-600 text-sm mb-4">{error.message}</p>
        <button
          onClick={handleRefresh}
          className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  const orders = data?.orders || [];
  const totalCount = data?.totalCount || 0;
  const currentPage = data?.currentPage || 1;
  const totalPages = data?.totalPages || 1;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
          <p className="text-gray-600">Manage customer orders and deliveries</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => navigate('/orders/reports')}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <BarChart3 className="w-4 h-4" />
            Reports
          </button>
          <button
            onClick={() => navigate('/orders/schedule')}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Calendar className="w-4 h-4" />
            Schedule
          </button>
          <button
            onClick={handleCreateOrder}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Order
          </button>
        </div>
      </div>

      {/* Stats */}
      <OrderStats />

      {/* Filters */}
      <AdvancedOrderFilters
        filters={filters}
        onFiltersChange={handleFilterChange}
      />

      {/* Bulk Actions */}
      {selectedOrders.length > 0 && (
        <BulkOrderActions
          selectedOrders={selectedOrders}
          onBulkOperation={handleBulkOperation}
          onClearSelection={() => setSelectedOrders([])}
        />
      )}

      {/* Orders Table */}
      <div className="bg-white rounded-lg border border-gray-200">
        <OrderTable
          orders={orders}
          selectedOrders={selectedOrders}
          onOrderSelect={handleOrderSelect}
          onSelectAll={handleSelectAll}
          onViewOrder={handleViewOrder}
          onEditOrder={handleEditOrder}
          onChangeStatus={handleChangeStatus}
          isLoading={isLoading}
        />

        {/* Pagination */}
        <div className="border-t border-gray-200 px-6 py-4">
          <CustomerPagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalCount={totalCount}
            onPageChange={handlePageChange}
          />
        </div>
      </div>

      {/* Status Change Modal */}
      {statusChangeOrder && (
        <OrderStatusModal
          order={statusChangeOrder.order}
          newStatus={statusChangeOrder.newStatus}
          onConfirm={handleConfirmStatusChange}
          onCancel={() => setStatusChangeOrder(null)}
          isLoading={updateOrderStatusMutation.isLoading}
        />
      )}
    </div>
  );
};