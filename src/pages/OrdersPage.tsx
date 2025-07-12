import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useOrdersNew, useUpdateOrderStatusNew } from '../hooks/useOrders';
import { OrderTable } from '../components/orders/OrderTable';
import { AdvancedOrderFilters } from '../components/orders/AdvancedOrderFilters';
import { OrderStats } from '../components/orders/OrderStats';
import { OrderStatusModal } from '../components/orders/OrderStatusModal';
import { BulkOrderActions } from '../components/orders/BulkOrderActions';
import { CustomerPagination } from '../components/customers/CustomerPagination';
import { Order, OrderFilters as FilterType, OrderStatusChange, BulkOrderOperation } from '../types/order';

export const OrdersPage: React.FC = () => {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<FilterType>({ page: 1 });
  const [statusChangeOrder, setStatusChangeOrder] = useState<{ order: Order; newStatus: string } | null>(null);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);

  const { data, isLoading, error, refetch } = useOrdersNew(filters);
  const changeOrderStatus = useUpdateOrderStatusNew();

  // Debug logging
  useEffect(() => {
    console.log('OrdersPage state:', {
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

  const handleStatusChangeSubmit = async (data: OrderStatusChange) => {
    console.log('Status change submit:', data);
    try {
      await changeOrderStatus.mutateAsync(data);
      setStatusChangeOrder(null);
    } catch (error) {
      console.error('Status change error:', error);
      // Error handling is done in the hook
    }
  };

  const handleBulkOperation = async (operation: BulkOrderOperation) => {
    console.log('Bulk operation:', operation);
    
    switch (operation.operation) {
      case 'status_change':
        if (operation.new_status) {
          for (const orderId of operation.order_ids) {
            const order = data?.orders.find(o => o.id === orderId);
            if (order) {
              await changeOrderStatus.mutateAsync({
                order_id: orderId,
                new_status: operation.new_status,
                notes: operation.notes,
              });
            }
          }
        }
        break;
      case 'schedule':
        if (operation.scheduled_date) {
          for (const orderId of operation.order_ids) {
            await changeOrderStatus.mutateAsync({
              order_id: orderId,
              new_status: 'scheduled',
              scheduled_date: operation.scheduled_date,
              notes: operation.notes,
            });
          }
        }
        break;
      case 'export':
        handleExportOrders(operation.order_ids);
        break;
      case 'print':
        handlePrintManifests(operation.order_ids);
        break;
    }
    
    setSelectedOrders([]);
  };

  const handleExportOrders = (orderIds: string[]) => {
    const ordersToExport = data?.orders.filter(o => orderIds.includes(o.id)) || [];
    
    const csvContent = [
      ['Order ID', 'Customer', 'Status', 'Order Date', 'Scheduled Date', 'Total Amount'],
      ...ordersToExport.map(order => [
        order.id,
        order.customer?.name || '',
        order.status,
        order.order_date,
        order.scheduled_date || '',
        order.total_amount?.toString() || '0',
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orders-export-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const handlePrintManifests = (orderIds: string[]) => {
    // TODO: Implement print manifests functionality
    console.log('Print manifests for orders:', orderIds);
  };

  const handlePageChange = (page: number) => {
    console.log('Page change:', page);
    setFilters(prev => ({ ...prev, page }));
  };



  const handleSelectionChange = (orderIds: string[]) => {
    setSelectedOrders(orderIds);
  };

  const handleClearSelection = () => {
    setSelectedOrders([]);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Order Management</h1>
          <p className="text-gray-600">Manage customer orders and deliveries</p>
          {error && (
            <p className="text-red-600 text-sm mt-1">
              Error: {error.message}
            </p>
          )}
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleCreateOrder}
            className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Create Order</span>
          </button>
        </div>
      </div>

      <OrderStats />

      <AdvancedOrderFilters filters={filters} onFiltersChange={setFilters} />

      <BulkOrderActions
        selectedOrders={data?.orders.filter(o => selectedOrders.includes(o.id)) || []}
        onClearSelection={handleClearSelection}
        onBulkOperation={handleBulkOperation}
      />

      <OrderTable
        orders={data?.orders || []}
        loading={isLoading}
        onView={handleViewOrder}
        onEdit={handleEditOrder}
        onChangeStatus={handleChangeStatus}
        selectedOrders={selectedOrders}
        onSelectionChange={handleSelectionChange}
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

      {/* Order Status Change Modal */}
      {statusChangeOrder && (
        <OrderStatusModal
          isOpen={!!statusChangeOrder}
          onClose={() => setStatusChangeOrder(null)}
          onSubmit={handleStatusChangeSubmit}
          order={statusChangeOrder.order}
          newStatus={statusChangeOrder.newStatus}
          loading={changeOrderStatus.isPending}
        />
      )}
    </div>
  );
};