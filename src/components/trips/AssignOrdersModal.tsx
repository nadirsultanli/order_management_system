import React, { useState, useMemo } from 'react';
import { X, Search, Package, User, Calendar, DollarSign } from 'lucide-react';
import { useAvailableOrdersForAssignment, useAllocateOrdersToTrip } from '../../hooks/useTrips';
import { Card } from '../ui/Card';
import toast from 'react-hot-toast';

interface AssignOrdersModalProps {
  tripId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface SelectedOrder {
  id: string;
  customer_name: string;
  total_amount: number;
  order_date: string;
}

export const AssignOrdersModal: React.FC<AssignOrdersModalProps> = ({
  tripId,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [search, setSearch] = useState('');
  const [selectedOrders, setSelectedOrders] = useState<SelectedOrder[]>([]);

  // Reset selection when modal opens/closes
  React.useEffect(() => {
    if (!isOpen) {
      setSelectedOrders([]);
      setSearch('');
    }
  }, [isOpen]);

  // Fetch available confirmed orders
  const { data: ordersData, isLoading, error } = useAvailableOrdersForAssignment({
    search,
    limit: 50,
    offset: 0,
  });

  // Mutation for allocating orders
  const allocateOrders = useAllocateOrdersToTrip();

  // Filter out orders based on search and prepare display data
  const availableOrders = useMemo(() => {
    if (!ordersData?.orders) return [];
    
    // Remove duplicates by ID and create unique orders
    const uniqueOrders = ordersData.orders.reduce((acc: any[], order: any) => {
      const existingOrder = acc.find(o => o.id === order.id);
      if (!existingOrder) {
        acc.push({
          id: order.id,
          customer_name: order.customers?.name || 'Unknown Customer',
          customer_phone: order.customers?.phone,
          customer_email: order.customers?.email,
          total_amount: parseFloat(order.total_amount || '0'),
          order_date: order.order_date,
          scheduled_date: order.scheduled_date,
          delivery_date: order.delivery_date,
          notes: order.notes,
          order_lines: order.order_lines || [],
          address: order.addresses?.[0] || null,
        });
      }
      return acc;
    }, []);
    
    console.log('Available orders:', uniqueOrders.length, 'Selected orders:', selectedOrders.length);
    return uniqueOrders;
  }, [ordersData, selectedOrders.length]);

  const handleOrderToggle = (order: any) => {
    const isSelected = selectedOrders.some(selected => selected.id === order.id);
    
    console.log('Toggling order:', order.id, 'Currently selected:', isSelected);
    console.log('Current selected orders:', selectedOrders.map(o => o.id));
    
    if (isSelected) {
      setSelectedOrders(prev => {
        const filtered = prev.filter(selected => selected.id !== order.id);
        console.log('Removed order, new selection:', filtered.map(o => o.id));
        return filtered;
      });
    } else {
      setSelectedOrders(prev => {
        const newSelection = [
          ...prev,
          {
            id: order.id,
            customer_name: order.customer_name,
            total_amount: order.total_amount,
            order_date: order.order_date,
          }
        ];
        console.log('Added order, new selection:', newSelection.map(o => o.id));
        return newSelection;
      });
    }
  };

  const handleAssignOrders = async () => {
    if (selectedOrders.length === 0) {
      toast.error('Please select at least one order to assign');
      return;
    }

    try {
      await allocateOrders.mutateAsync({
        trip_id: tripId,
        order_ids: selectedOrders.map(order => order.id),
        auto_sequence: true,
        notes: `Assigned ${selectedOrders.length} orders to trip`,
      });

      // Don't show success toast here - it's already shown in the mutation's onSuccess
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error assigning orders:', error);
      // toast.error(error.message || 'Failed to assign orders to trip'); // Removed to prevent duplicate error toasts
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold">Assign Orders to Trip</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-col h-[calc(90vh-200px)]">
          {/* Search and filters */}
          <div className="p-6 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search by customer name, phone, or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Orders list */}
          <div className="flex-1 overflow-y-auto p-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-2 text-gray-600">Loading orders...</span>
              </div>
            ) : error ? (
              <div className="text-center py-8">
                <p className="text-red-600">Error loading orders: {error.message}</p>
              </div>
            ) : availableOrders.length === 0 ? (
              <div className="text-center py-8">
                <Package className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <p className="text-gray-600">No confirmed orders available for assignment</p>
                {search && (
                  <p className="text-sm text-gray-500 mt-2">
                    Try adjusting your search criteria
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {availableOrders.map((order: any) => {
                  const isSelected = selectedOrders.some(selected => selected.id === order.id);
                  
                  return (
                    <Card key={order.id} className={`cursor-pointer transition-all ${
                      isSelected ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:shadow-md'
                    }`}>
                      <div
                        className="p-4"
                        onClick={() => handleOrderToggle(order)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3 mb-2">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleOrderToggle(order)}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              <div>
                                <h3 className="font-medium text-gray-900">
                                  Order #{order.id.slice(-8)}
                                </h3>
                                <div className="flex items-center space-x-4 text-sm text-gray-600">
                                  <div className="flex items-center">
                                    <User size={14} className="mr-1" />
                                    {order.customer_name}
                                  </div>
                                  <div className="flex items-center">
                                    <Calendar size={14} className="mr-1" />
                                    {new Date(order.order_date).toLocaleDateString()}
                                  </div>
                                  <div className="flex items-center">
                                    <DollarSign size={14} className="mr-1" />
                                    KES {order.total_amount.toLocaleString()}
                                  </div>
                                </div>
                              </div>
                            </div>
                            
                            {/* Address */}
                            {order.address && (
                              <p className="text-sm text-gray-500 mb-2">
                                📍 {order.address.line1}, {order.address.city}
                              </p>
                            )}

                            {/* Order lines */}
                            {order.order_lines && order.order_lines.length > 0 && (
                              <div className="text-sm text-gray-600">
                                <span className="font-medium">Items: </span>
                                {order.order_lines.slice(0, 2).map((line: any, index: number) => (
                                  <span key={index}>
                                    {line.quantity}x {line.products?.name || 'Unknown Product'}
                                    {index < Math.min(order.order_lines.length, 2) - 1 && ', '}
                                  </span>
                                ))}
                                {order.order_lines.length > 2 && (
                                  <span> and {order.order_lines.length - 2} more items</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t bg-gray-50">
          <div className="text-sm text-gray-600">
            {selectedOrders.length > 0 && (
              <span>
                {selectedOrders.length} order(s) selected • Total: KES{' '}
                {selectedOrders.reduce((sum, order) => sum + order.total_amount, 0).toLocaleString()}
              </span>
            )}
          </div>
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleAssignOrders}
              disabled={selectedOrders.length === 0 || allocateOrders.isLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {allocateOrders.isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Assigning...
                </>
              ) : (
                `Assign ${selectedOrders.length} Order(s)`
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}; 