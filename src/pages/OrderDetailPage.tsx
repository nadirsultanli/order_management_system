import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit, User, MapPin, Calendar, Package, DollarSign, Clock } from 'lucide-react';
import { useOrderNew, useUpdateOrderStatusNew } from '../hooks/useOrders';
import { OrderStatusModal } from '../components/orders/OrderStatusModal';
import { OrderTimeline } from '../components/orders/OrderTimeline';
import { OrderEditModal } from '../components/orders/OrderEditModal';
import { formatDateSync } from '../utils/order';
import { formatCurrencySync } from '../utils/pricing';
import { Order, OrderStatusChange } from '../types/order';

export const OrderDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [statusChangeOrder, setStatusChangeOrder] = useState<{ order: Order; newStatus: string } | null>(null);
  const [showTimeline, setShowTimeline] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [statusInfo, setStatusInfo] = useState<any>(null);
  const [nextStatuses, setNextStatuses] = useState<string[]>([]);
  const [formattedOrderId, setFormattedOrderId] = useState<string>('');

  const { data: order, isLoading, error } = useOrderNew(id!);
  const changeOrderStatus = useUpdateOrderStatusNew();

  // Fetch order status info when order is loaded
  useEffect(() => {
    if (!order) return;
    
    // Use synchronous fallback functions instead of async tRPC calls
    const statusData = getOrderStatusInfoSync(order.status as any);
    const nextStatusData = getNextPossibleStatusesSync(order.status as any);
    const formattedId = formatOrderIdSync(order.id);
    
    setStatusInfo(statusData);
    setNextStatuses(nextStatusData);
    setFormattedOrderId(formattedId);
  }, [order]);

  const handleChangeStatus = (newStatus: string) => {
    if (order) {
      setStatusChangeOrder({ order, newStatus });
    }
  };

  const handleStatusChangeSubmit = async (data: OrderStatusChange) => {
    try {
      await changeOrderStatus.mutateAsync(data);
      setStatusChangeOrder(null);
    } catch (error) {
      console.error('Status change error:', error);
    }
  };


  // Synchronous fallback functions for order status operations
  const getOrderStatusInfoSync = (status: string) => {
    const statusMap: Record<string, { label: string; color: string; description: string }> = {
      'draft': { label: 'Draft', color: 'bg-gray-100 text-gray-800 border-gray-300', description: 'Order is being prepared' },
      'confirmed': { label: 'Confirmed', color: 'bg-blue-100 text-blue-800 border-blue-300', description: 'Order has been confirmed' },
      'scheduled': { label: 'Scheduled', color: 'bg-yellow-100 text-yellow-800 border-yellow-300', description: 'Order is scheduled for delivery' },
      'en_route': { label: 'En Route', color: 'bg-orange-100 text-orange-800 border-orange-300', description: 'Order is out for delivery' },
      'delivered': { label: 'Delivered', color: 'bg-green-100 text-green-800 border-green-300', description: 'Order has been delivered' },
      'invoiced': { label: 'Invoiced', color: 'bg-purple-100 text-purple-800 border-purple-300', description: 'Order has been invoiced' },
      'cancelled': { label: 'Cancelled', color: 'bg-red-100 text-red-800 border-red-300', description: 'Order has been cancelled' },
    };
    return statusMap[status] || statusMap['draft'];
  };

  const getNextPossibleStatusesSync = (currentStatus: string): string[] => {
    const transitions: Record<string, string[]> = {
      'draft': ['confirmed', 'cancelled'],
      'confirmed': ['scheduled', 'cancelled'],
      'scheduled': ['en_route', 'cancelled'],
      'en_route': ['delivered', 'cancelled'],
      'delivered': ['invoiced'],
      'invoiced': [],
      'cancelled': [],
    };
    return transitions[currentStatus] || [];
  };

  const formatOrderIdSync = (id: string) => {
    // Simple formatting - take first 8 characters and add prefix
    return `ORD-${id.substring(0, 8).toUpperCase()}`;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/orders')}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Orders</span>
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

  if (error || !order) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/orders')}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Orders</span>
          </button>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          <div className="text-center">
            <p className="text-red-600">Order not found or error loading order details.</p>
          </div>
        </div>
      </div>
    );
  }

  // Status info is now handled by state in useEffect

  // Generate status history based on current order status
  const generateStatusHistory = () => {
    const history = [];
    const statuses = ['draft', 'confirmed', 'scheduled', 'en_route', 'delivered', 'invoiced'];
    const currentStatusIndex = statuses.indexOf(order.status);
    
    // Always add draft status (order creation)
    history.push({
      id: '1',
      order_id: order.id,
      status: 'draft' as const,
      changed_by: 'system',
      changed_at: order.created_at,
      user_name: 'System',
      notes: 'Order created',
    });
    
    // Add status history for statuses that have been completed
    for (let i = 1; i <= currentStatusIndex; i++) {
      const status = statuses[i];
      const baseTime = new Date(order.created_at).getTime();
      const statusTime = new Date(baseTime + (i * 3600000)).toISOString(); // Add 1 hour per status
      
      let notes = '';
      let userName = 'Admin User';
      
      switch (status) {
        case 'confirmed':
          notes = 'Order confirmed and inventory reserved';
          break;
        case 'scheduled':
          notes = order.scheduled_date ? `Scheduled for delivery on ${new Date(order.scheduled_date).toLocaleDateString()}` : 'Scheduled for delivery';
          break;
        case 'en_route':
          notes = 'Order is out for delivery';
          break;
        case 'delivered':
          notes = 'Order successfully delivered to customer';
          break;
        case 'invoiced':
          notes = 'Invoice generated and sent to customer';
          break;
      }
      
      history.push({
        id: (i + 1).toString(),
        order_id: order.id,
        status: status as const,
        changed_by: 'admin',
        changed_at: statusTime,
        user_name: userName,
        notes: notes,
      });
    }
    
    // Handle cancelled status separately
    if (order.status === 'cancelled') {
      history.push({
        id: 'cancelled',
        order_id: order.id,
        status: 'cancelled' as const,
        changed_by: 'admin',
        changed_at: order.updated_at || new Date().toISOString(),
        user_name: 'Admin User',
        notes: 'Order cancelled',
      });
    }
    
    return history;
  };
  
  const statusHistory = generateStatusHistory();

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/orders')}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Orders</span>
          </button>
          <div className="text-gray-400">/</div>
          <h1 className="text-2xl font-bold text-gray-900">
            Order {formattedOrderId || formatOrderIdSync(order.id)}
          </h1>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowTimeline(!showTimeline)}
            className="flex items-center space-x-2 bg-gray-100 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <Clock className="h-4 w-4" />
            <span>{showTimeline ? 'Hide' : 'Show'} Timeline</span>
          </button>
          {['draft', 'confirmed'].includes(order.status) && (
            <button
              onClick={() => setShowEditModal(true)}
              className="flex items-center space-x-2 bg-gray-100 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <Edit className="h-4 w-4" />
              <span>Edit Order</span>
            </button>
          )}
          {nextStatuses.map((status) => (
            <button
              key={status}
              onClick={() => handleChangeStatus(status)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              {status === 'confirmed' && 'Confirm Order'}
              {status === 'scheduled' && 'Schedule Delivery'}
              {status === 'en_route' && 'Mark En Route'}
              {status === 'delivered' && 'Mark Delivered'}
              {status === 'invoiced' && 'Generate Invoice'}
              {status === 'cancelled' && 'Cancel Order'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Order Header */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Order {formattedOrderId || formatOrderIdSync(order.id)}
                </h2>
                <p className="text-gray-600">
                  Created on {formatDateSync(order.created_at)}
                </p>
              </div>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${statusInfo?.color || 'border-gray-300'}`}>
                {order.status.replace('_', ' ').toUpperCase()}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Order Type */}
              <div className="flex items-start space-x-3">
                <div className="p-2 bg-indigo-50 rounded-lg">
                  <Package className="h-5 w-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">Order Type</h3>
                  <div className="flex items-center space-x-2">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      order.order_type === 'delivery' 
                        ? 'bg-blue-100 text-blue-800' 
                        : 'bg-purple-100 text-purple-800'
                    }`}>
                      {order.order_type === 'delivery' ? 'Delivery Order' : 'Visit Order'}
                    </span>
                  </div>
                  {order.order_type === 'visit' ? (
                    <p className="text-xs text-gray-500 mt-1">Products to be determined during visit</p>
                  ) : (
                    <>
                      {order.notes && order.notes.includes('Converted from visit order') ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 mt-1">
                          Converted from Visit Order
                        </span>
                      ) : (
                        <p className="text-xs text-gray-500 mt-1">Pre-selected products for delivery</p>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Warehouse Info */}
              <div className="flex items-start space-x-3">
                <div className="p-2 bg-orange-50 rounded-lg">
                  <Package className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">Warehouse</h3>
                  {order.source_warehouse ? (
                    <div className="text-gray-600">
                      <p className="font-medium">{order.source_warehouse.name}</p>
                      <p className="text-sm text-gray-500">
                        {order.source_warehouse.city}, {order.source_warehouse.state}
                      </p>
                    </div>
                  ) : (
                    <p className="text-gray-500">No warehouse assigned</p>
                  )}
                </div>
              </div>

              {/* Customer Info */}
              <div className="flex items-start space-x-3">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <User className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">Customer</h3>
                  <p className="text-gray-600">{order.customer?.name}</p>
                  {order.customer?.email && (
                    <p className="text-sm text-gray-500">{order.customer.email}</p>
                  )}
                  {order.customer?.phone && (
                    <p className="text-sm text-gray-500">{order.customer.phone}</p>
                  )}
                </div>
              </div>

              {/* Delivery Address */}
              <div className="flex items-start space-x-3">
                <div className="p-2 bg-green-50 rounded-lg">
                  <MapPin className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">Delivery Address</h3>
                  {order.delivery_address ? (
                    <div className="text-gray-600">
                      {order.delivery_address.line1 ? (
                        <div>
                          <p>{order.delivery_address.line1}</p>
                          {order.delivery_address.line2 && <p>{order.delivery_address.line2}</p>}
                          <p>
                            {[
                              order.delivery_address.city,
                              order.delivery_address.state,
                              order.delivery_address.postal_code
                            ].filter(Boolean).join(', ')}
                          </p>
                          {order.delivery_address.instructions && (
                            <p className="text-sm text-gray-500 mt-1">
                              Note: {order.delivery_address.instructions}
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="text-gray-500">Address details not provided</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-gray-500">No address specified</p>
                  )}
                </div>
              </div>

              {/* Order Dates */}
              <div className="flex items-start space-x-3">
                <div className="p-2 bg-purple-50 rounded-lg">
                  <Calendar className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">Important Dates</h3>
                  <div className="text-gray-600 space-y-1">
                    <p>Order: {new Date(order.order_date).toLocaleDateString()}</p>
                    {order.scheduled_date && (
                      <p>Scheduled: {new Date(order.scheduled_date).toLocaleDateString()}</p>
                    )}
                    <p className="text-sm text-gray-500">
                      Updated: {formatDateSync(order.updated_at)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Order Notes */}
            {order.notes && (
              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">Order Notes</h4>
                <p className="text-gray-700">{order.notes}</p>
              </div>
            )}
          </div>

          {/* Order Items */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Order Items</h3>
              <div className="flex items-center space-x-2">
                <Package className="h-5 w-5 text-gray-400" />
                <span className="text-gray-600">
                  {order.order_lines?.length || 0} item{(order.order_lines?.length || 0) !== 1 ? 's' : ''}
                </span>
              </div>
            </div>

            {order.order_lines && order.order_lines.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Product
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Quantity
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Unit Price
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Subtotal
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {order.order_lines.map((line) => (
                      <tr key={line.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {line.product?.name || 'Unknown Product'}
                            </div>
                            <div className="text-sm text-gray-500">
                              SKU: {line.product?.sku || 'N/A'}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <span className="text-sm font-medium text-gray-900">
                            {line.quantity}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <span className="text-sm text-gray-900">
                            {formatCurrencySync(line.unit_price)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <span className="text-sm font-medium text-gray-900">
                            {formatCurrencySync(line.subtotal || (line.quantity * line.unit_price))}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50">
                    <tr>
                      <td colSpan={3} className="px-6 py-4 text-right text-sm font-medium text-gray-900">
                        Total:
                      </td>
                      <td className="px-6 py-4 text-right text-lg font-bold text-gray-900">
                        {order.total_amount ? formatCurrencySync(order.total_amount) : formatCurrencySync(
                          order.order_lines.reduce((sum, line) => sum + (line.subtotal || (line.quantity * line.unit_price)), 0)
                        )}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <div className="text-center py-8">
                <Package className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                {order.order_type === 'visit' ? (
                  <div>
                    <p className="text-gray-500 mb-2">No products specified yet</p>
                    <p className="text-sm text-gray-400">
                      This is a visit order. Products will be added when the driver visits the customer.
                    </p>
                  </div>
                ) : (
                  <p className="text-gray-500">No items in this order</p>
                )}
              </div>
            )}
          </div>

          {/* Timeline */}
          {showTimeline && (
            <OrderTimeline
              statusHistory={statusHistory}
              currentStatus={order.status as any}
            />
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Order Summary */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Order Summary</h3>
            
            {order.order_type === 'visit' && (!order.order_lines || order.order_lines.length === 0) ? (
              <div className="text-center py-4">
                <div className="p-3 bg-purple-50 rounded-lg">
                  <p className="text-purple-800 text-sm font-medium">Visit Order</p>
                  <p className="text-purple-600 text-xs mt-1">
                    Total will be calculated after driver visit
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="font-medium text-gray-900">
                    {formatCurrencySync(order.order_lines?.reduce((sum, line) => sum + (line.subtotal || (line.quantity * line.unit_price)), 0) || 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Tax{order.tax_percent != null ? ` (${order.tax_percent}%)` : ''}:</span>
                  <span className="font-medium text-gray-900">
                    {formatCurrencySync(order.tax_amount != null ? order.tax_amount : 0)}
                  </span>
                </div>
                <div className="border-t border-gray-200 pt-4">
                  <div className="flex justify-between">
                    <span className="text-lg font-semibold text-gray-900">Total:</span>
                    <span className="text-lg font-bold text-gray-900">
                      {formatCurrencySync((order.order_lines?.reduce((sum, line) => sum + (line.subtotal || (line.quantity * line.unit_price)), 0) || 0) + (order.tax_amount != null ? order.tax_amount : 0))}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Customer Information */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Customer Details</h3>
            
            <div className="space-y-3">
              <div>
                <span className="text-sm font-medium text-gray-500">Account Status:</span>
                <div className="mt-1">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    order.customer?.account_status === 'active' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {order.customer?.account_status || 'Unknown'}
                  </span>
                </div>
              </div>
              
              <div>
                <span className="text-sm font-medium text-gray-500">Credit Terms:</span>
                <div className="mt-1 text-sm text-gray-900">
                  {order.customer?.credit_terms_days || 0} days
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
            
            <div className="space-y-3">
              {['draft', 'confirmed'].includes(order.status) && (
                <button
                  onClick={() => setShowEditModal(true)}
                  className="w-full flex items-center justify-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Edit className="h-4 w-4" />
                  <span>Edit Order</span>
                </button>
              )}
              
              <button
                onClick={() => handleChangeStatus(getNextPossibleStatusesSync(order.status)[0])}
                disabled={getNextPossibleStatusesSync(order.status).length === 0}
                className="w-full flex items-center justify-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Clock className="h-4 w-4" />
                <span>Change Status</span>
              </button>
              
              <button
                onClick={() => setShowTimeline(!showTimeline)}
                className="w-full flex items-center justify-center space-x-2 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
              >
                <Clock className="h-4 w-4" />
                <span>{showTimeline ? 'Hide' : 'Show'} Timeline</span>
              </button>
            </div>
          </div>
        </div>
      </div>

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

      {/* Order Edit Modal */}
      {showEditModal && (
        <OrderEditModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          order={order}
        />
      )}
    </div>
  );
};