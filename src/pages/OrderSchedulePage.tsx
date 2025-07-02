import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, Truck, Package } from 'lucide-react';
import { useOrdersNew } from '../hooks/useOrders';
import { DeliveryCalendar } from '../components/orders/DeliveryCalendar';
import { Order } from '../types/order';

export const OrderSchedulePage: React.FC = () => {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedOrders, setSelectedOrders] = useState<Order[]>([]);

  // Get orders with scheduled dates
  const { data: ordersData } = useOrdersNew({
    status: 'scheduled',
    limit: 1000, // Get all scheduled orders
  });

  const orders = ordersData?.orders || [];

  const handleOrderClick = (order: Order) => {
    navigate(`/orders/${order.id}`);
  };

  const handleDateChange = (date: string, dayOrders: Order[]) => {
    setSelectedDate(date);
    setSelectedOrders(dayOrders);
  };

  const handleReschedule = async (orderId: string, newDate: string) => {
    // TODO: Implement reschedule functionality
    console.log('Reschedule order', orderId, 'to', newDate);
  };

  const getTodaysDeliveries = () => {
    const today = new Date().toISOString().split('T')[0];
    return orders.filter(order => order.scheduled_date === today);
  };

  const getUpcomingDeliveries = () => {
    const today = new Date().toISOString().split('T')[0];
    return orders.filter(order => order.scheduled_date && order.scheduled_date > today);
  };

  const todaysDeliveries = getTodaysDeliveries();
  const upcomingDeliveries = getUpcomingDeliveries();

  return (
    <div className="space-y-6">
      {/* Header */}
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
          <h1 className="text-2xl font-bold text-gray-900">Delivery Schedule</h1>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-blue-100 rounded-full">
              <Calendar className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Today's Deliveries</h3>
              <p className="text-3xl font-bold text-blue-600">{todaysDeliveries.length}</p>
              <p className="text-sm text-gray-600">
                {todaysDeliveries.reduce((sum, order) => sum + (order.total_amount || 0), 0).toLocaleString('en-US', {
                  style: 'currency',
                  currency: 'USD',
                })} total value
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-green-100 rounded-full">
              <Truck className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Upcoming Deliveries</h3>
              <p className="text-3xl font-bold text-green-600">{upcomingDeliveries.length}</p>
              <p className="text-sm text-gray-600">Next 30 days</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-purple-100 rounded-full">
              <Package className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Total Scheduled</h3>
              <p className="text-3xl font-bold text-purple-600">{orders.length}</p>
              <p className="text-sm text-gray-600">All scheduled orders</p>
            </div>
          </div>
        </div>
      </div>

      {/* Calendar */}
      <DeliveryCalendar
        orders={orders}
        onOrderClick={handleOrderClick}
        onDateChange={handleDateChange}
        onReschedule={handleReschedule}
      />

      {/* Today's Deliveries Quick View */}
      {todaysDeliveries.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Today's Delivery Route</h3>
          <div className="space-y-3">
            {todaysDeliveries.map((order, index) => (
              <div
                key={order.id}
                className="flex items-center justify-between p-3 bg-blue-50 rounded-lg hover:bg-blue-100 cursor-pointer transition-colors"
                onClick={() => handleOrderClick(order)}
              >
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-medium">
                    {index + 1}
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">{order.customer?.name}</div>
                    <div className="text-sm text-gray-600">
                      {order.delivery_address?.city}, {order.delivery_address?.state}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-medium text-gray-900">
                    {(order.total_amount || 0).toLocaleString('en-US', {
                      style: 'currency',
                      currency: 'USD',
                    })}
                  </div>
                  <div className="text-sm text-gray-600">
                    {order.order_lines?.length || 0} items
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Estimated Route Time:</span>
              <span className="font-medium text-gray-900">
                {Math.ceil(todaysDeliveries.length * 0.5)} hours
              </span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className="text-gray-600">Total Stops:</span>
              <span className="font-medium text-gray-900">{todaysDeliveries.length}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};