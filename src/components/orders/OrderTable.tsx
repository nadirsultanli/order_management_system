import React, { useState, useMemo } from 'react';
import { Eye, Truck, Package, Receipt, XCircle, Loader2, ShoppingCart, Calendar, ChevronUp, ChevronDown, Edit, Gauge } from 'lucide-react';
import { Order } from '../../types/order';
import { formatCurrencySync } from '../../utils/pricing';
import { formatDateSync } from '../../utils/order';

type SortField = 'order_date' | 'scheduled_date' | 'total_amount';
type SortDirection = 'asc' | 'desc';

interface OrderTableProps {
  orders: Order[];
  loading?: boolean;
  onView: (order: Order) => void;
  onEdit?: (order: Order) => void;
  onChangeStatus: (order: Order, newStatus: string) => void;
  selectedOrders?: string[];
  onSelectionChange?: (orderIds: string[]) => void;
}

export const OrderTable: React.FC<OrderTableProps> = ({
  orders,
  loading = false,
  onView,
  onEdit,
  onChangeStatus,
  selectedOrders = [],
  onSelectionChange,
}) => {
  const [selectAll, setSelectAll] = useState(false);
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Handle column sorting
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // If clicking the same field, toggle direction
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // If clicking a different field, set new field and default to desc
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Sort orders based on current sort state
  const sortedOrders = useMemo(() => {
    if (!sortField) return orders;

    return [...orders].sort((a, b) => {
      let aValue, bValue;

      switch (sortField) {
        case 'order_date':
          aValue = new Date(a.order_date || 0).getTime();
          bValue = new Date(b.order_date || 0).getTime();
          break;
        case 'scheduled_date':
          aValue = new Date(a.scheduled_date || 0).getTime();
          bValue = new Date(b.scheduled_date || 0).getTime();
          break;
        case 'total_amount':
          aValue = a.total_amount || 0;
          bValue = b.total_amount || 0;
          break;
        default:
          return 0;
      }

      if (sortDirection === 'asc') {
        return aValue - bValue;
      } else {
        return bValue - aValue;
      }
    });
  }, [orders, sortField, sortDirection]);

  // Render sort icon
  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return (
        <div className="flex flex-col ml-1">
          <ChevronUp className="h-3 w-3 text-gray-300" />
          <ChevronDown className="h-3 w-3 text-gray-300 -mt-1" />
        </div>
      );
    }

    return (
      <div className="flex flex-col ml-1">
        <ChevronUp className={`h-3 w-3 ${sortDirection === 'asc' ? 'text-blue-600' : 'text-gray-300'}`} />
        <ChevronDown className={`h-3 w-3 -mt-1 ${sortDirection === 'desc' ? 'text-blue-600' : 'text-gray-300'}`} />
      </div>
    );
  };


  const getStatusColorSync = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-gray-100 text-gray-800 border-gray-300';
      case 'confirmed':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'dispatched':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'en_route':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'delivered':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'invoiced':
        return 'bg-teal-100 text-teal-800 border-teal-300';
      case 'paid':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'completed_no_sale':
        return 'bg-gray-100 text-gray-800 border-gray-300';
      case 'cancelled':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const formatOrderIdSync = (id: string) => {
    // Simple formatting - take first 8 characters and add prefix
    return `ORD-${id.substring(0, 8).toUpperCase()}`;
  };

  // Check if order can be edited (not invoiced, delivered, paid, or completed_no_sale)
  const isOrderEditable = (order: Order) => {
    return !['invoiced', 'delivered', 'paid', 'completed_no_sale'].includes(order.status);
  };

  // Check if order can be cancelled (any status before delivered)
  const isOrderCancellable = (order: Order) => {
    return !['delivered', 'invoiced', 'paid', 'completed_no_sale', 'cancelled'].includes(order.status);
  };

  const getQuickActions = (order: Order) => {
    const actions = [];

    switch (order.status) {
      case 'draft':
        actions.push({
          label: 'Confirm',
          action: () => onChangeStatus(order, 'confirmed'),
          icon: Package,
          color: 'text-blue-600 hover:text-blue-900',
        });
        break;
      case 'confirmed':
        actions.push({
          label: 'Dispatch',
          action: () => onChangeStatus(order, 'dispatched'),
          icon: Truck,
          color: 'text-purple-600 hover:text-purple-900',
        });
        // Add revert to draft for confirmed orders
        actions.push({
          label: 'Revert to Draft',
          action: () => onChangeStatus(order, 'draft'),
          icon: Package,
          color: 'text-gray-600 hover:text-gray-900',
        });
        break;
      case 'dispatched':
        actions.push({
          label: 'En Route',
          action: () => onChangeStatus(order, 'en_route'),
          icon: Truck,
          color: 'text-orange-600 hover:text-orange-900',
        });
        break;
      case 'en_route':
        actions.push({
          label: 'Delivered',
          action: () => onChangeStatus(order, 'delivered'),
          icon: Package,
          color: 'text-green-600 hover:text-green-900',
        });
        break;
      case 'delivered':
        actions.push({
          label: 'Invoice',
          action: () => onChangeStatus(order, 'invoiced'),
          icon: Receipt,
          color: 'text-teal-600 hover:text-teal-900',
        });
        break;
    }

    // Add cancel action for any status before delivered
    if (isOrderCancellable(order)) {
      actions.push({
        label: 'Cancel',
        action: () => onChangeStatus(order, 'cancelled'),
        icon: XCircle,
        color: 'text-red-600 hover:text-red-900',
      });
    }

    return actions;
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    if (onSelectionChange) {
      onSelectionChange(checked ? sortedOrders.map(o => o.id) : []);
    }
  };

  const handleSelectOrder = (orderId: string, checked: boolean) => {
    if (onSelectionChange) {
      const newSelection = checked
        ? [...selectedOrders, orderId]
        : selectedOrders.filter(id => id !== orderId);
      onSelectionChange(newSelection);
      setSelectAll(newSelection.length === sortedOrders.length);
    }
  };

  // Show empty state only when not loading and no orders
  if (!loading && (!orders || orders.length === 0)) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="text-center py-12">
          <div className="mb-4">
            <ShoppingCart className="h-12 w-12 text-gray-300 mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No orders found</h3>
          <p className="text-gray-500">
            Get started by creating your first order.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden relative">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-end">
        {selectedOrders.length > 0 && (
          <span className="text-sm text-blue-600">
            {selectedOrders.length} selected
          </span>
        )}
      </div>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {onSelectionChange && (
                <th className="px-6 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectAll}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                </th>
              )}
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Order
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Customer
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Delivery Address
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <button
                  onClick={() => handleSort('order_date')}
                  className="flex items-center hover:text-gray-700 transition-colors"
                >
                  Dates
                  {renderSortIcon('order_date')}
                </button>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                <button
                  onClick={() => handleSort('total_amount')}
                  className="flex items-center hover:text-gray-700 transition-colors ml-auto"
                  title="This is the full amount charged to the customer, including product price, deposit, and tax."
                >
                  Total (incl. deposit & tax)
                  {renderSortIcon('total_amount')}
                </button>
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedOrders.map((order) => {
              const quickActions = getQuickActions(order);

              return (
                <tr key={order.id} className="hover:bg-gray-50">
                  {onSelectionChange && (
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedOrders.includes(order.id)}
                        onChange={(e) => handleSelectOrder(order.id, e.target.checked)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                    </td>
                  )}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <button
                        onClick={() => onView(order)}
                        className="text-sm font-medium text-blue-600 hover:text-blue-900"
                      >
                        {formatOrderIdSync(order.id)}
                      </button>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-500">
                          {order.order_lines?.length || 0} item{(order.order_lines?.length || 0) !== 1 ? 's' : ''}
                        </span>
                        {order.order_lines?.some(line => line.is_partial_fill) && (
                          <div className="flex items-center space-x-1 text-orange-600" title="Contains partial fills">
                            <Gauge className="h-3 w-3" />
                            <span className="text-xs font-medium">Partial</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {order.customer?.name || 'Unknown Customer'}
                      </div>
                      {order.customer?.email && (
                        <div className="text-sm text-gray-500">
                          {order.customer.email}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {order.delivery_address ? (
                        <>
                          <div>{order.delivery_address.city}</div>
                          {order.delivery_address.state && (
                            <div className="text-gray-500">{order.delivery_address.state}</div>
                          )}
                        </>
                      ) : (
                        'No address'
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      <div>Order: {formatDateSync(order.order_date)}</div>
                      {order.scheduled_date && (
                        <div className="text-gray-500">
                          Scheduled: {formatDateSync(order.scheduled_date)}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColorSync(order.status)}`}>
                      {order.status.replace('_', ' ').toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="text-sm font-medium text-gray-900">
                      {order.total_amount ? formatCurrencySync(order.total_amount) : '-'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        onClick={() => onView(order)}
                        className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-50 transition-colors"
                        title="View order details"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      {onEdit && isOrderEditable(order) && (
                        <button
                          onClick={() => onEdit(order)}
                          className="text-gray-600 hover:text-gray-900 p-1 rounded hover:bg-gray-50 transition-colors"
                          title="Edit order"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                      )}
                      {quickActions.slice(0, 2).map((action, index) => (
                        <button
                          key={index}
                          onClick={action.action}
                          className={`p-1 rounded hover:bg-gray-50 transition-colors ${action.color}`}
                          title={action.label}
                        >
                          <action.icon className="h-4 w-4" />
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10">
          <div className="flex items-center space-x-2">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            <span className="text-gray-600">Loading orders...</span>
          </div>
        </div>
      )}
    </div>
  );
};