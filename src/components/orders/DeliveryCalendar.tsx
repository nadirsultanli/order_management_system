import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar, Truck, Package, MapPin, Clock } from 'lucide-react';
import { Order } from '../../types/order';
import { formatCurrencySync } from '../../utils/pricing';

interface DeliveryCalendarProps {
  orders: Order[];
  onOrderClick: (order: Order) => void;
  onDateChange: (date: string, orders: Order[]) => void;
  onReschedule: (orderId: string, newDate: string) => void;
}

export const DeliveryCalendar: React.FC<DeliveryCalendarProps> = ({
  orders,
  onOrderClick,
  onDateChange,
  onReschedule,
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const formatDate = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  const formatDisplayDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }
    
    return days;
  };

  const getOrdersForDate = (date: Date) => {
    const dateString = formatDate(date);
    // Simple client-side filtering for immediate UI feedback
    // Complex business logic is handled by backend endpoints
    return orders.filter(order => order.scheduled_date === dateString);
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(prev.getMonth() - 1);
      } else {
        newDate.setMonth(prev.getMonth() + 1);
      }
      return newDate;
    });
  };

  const handleDateClick = (date: Date) => {
    const dateString = formatDate(date);
    const dayOrders = getOrdersForDate(date);
    setSelectedDate(dateString);
    onDateChange(dateString, dayOrders);
  };

  const getDateStatus = (date: Date) => {
    const dayOrders = getOrdersForDate(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (dayOrders.length === 0) return 'empty';
    if (date < today) return 'past';
    if (formatDate(date) === formatDate(today)) return 'today';
    return 'scheduled';
  };

  const getDateClasses = (date: Date) => {
    const status = getDateStatus(date);
    const isSelected = selectedDate === formatDate(date);
    
    const baseClasses = 'min-h-[80px] p-2 border border-gray-200 cursor-pointer transition-colors relative';
    
    if (isSelected) {
      return `${baseClasses} bg-blue-100 border-blue-300`;
    }
    
    switch (status) {
      case 'today':
        return `${baseClasses} bg-yellow-50 border-yellow-300 hover:bg-yellow-100`;
      case 'scheduled':
        return `${baseClasses} bg-green-50 border-green-200 hover:bg-green-100`;
      case 'past':
        return `${baseClasses} bg-gray-50 text-gray-500 hover:bg-gray-100`;
      default:
        return `${baseClasses} hover:bg-gray-50`;
    }
  };

  const days = getDaysInMonth(currentDate);
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const selectedDateOrders = useMemo(() => {
    if (!selectedDate) return [];
    const date = new Date(selectedDate + 'T00:00:00');
    return getOrdersForDate(date);
  }, [selectedDate, orders]);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Delivery Schedule</h2>
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigateMonth('prev')}
            className="p-2 hover:bg-gray-100 rounded-md transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-lg font-medium text-gray-900 min-w-[200px] text-center">
            {formatDisplayDate(currentDate)}
          </span>
          <button
            onClick={() => navigateMonth('next')}
            className="p-2 hover:bg-gray-100 rounded-md transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-4">
        {weekDays.map(day => (
          <div key={day} className="p-2 text-center text-sm font-medium text-gray-500 border-b border-gray-200">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 mb-6">
        {days.map((date, index) => (
          <div key={index}>
            {date ? (
              <div
                className={getDateClasses(date)}
                onClick={() => handleDateClick(date)}
              >
                <div className="text-sm font-medium text-gray-900 mb-1">
                  {date.getDate()}
                </div>
                {getOrdersForDate(date).length > 0 && (
                  <div className="space-y-1">
                    {getOrdersForDate(date).slice(0, 2).map(order => (
                      <div
                        key={order.id}
                        className="text-xs bg-blue-100 text-blue-800 px-1 py-0.5 rounded truncate"
                        title={`${order.customer?.name} - ${formatCurrencySync(order.total_amount || 0)}`}
                      >
                        {order.customer?.name}
                      </div>
                    ))}
                    {getOrdersForDate(date).length > 2 && (
                      <div className="text-xs text-gray-500">
                        +{getOrdersForDate(date).length - 2} more
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="min-h-[80px] p-2"></div>
            )}
          </div>
        ))}
      </div>

      {/* Selected Date Details */}
      {selectedDate && selectedDateOrders.length > 0 && (
        <div className="border-t border-gray-200 pt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">
              Deliveries for {new Date(selectedDate).toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
            </h3>
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <Truck className="h-4 w-4" />
              <span>{selectedDateOrders.length} deliveries</span>
            </div>
          </div>

          <div className="space-y-3">
            {selectedDateOrders.map(order => (
              <div
                key={order.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                onClick={() => onOrderClick(order)}
              >
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Package className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">
                      {order.customer?.name}
                    </div>
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <MapPin className="h-3 w-3" />
                      <span>
                        {order.delivery_address?.city}, {order.delivery_address?.state}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-medium text-gray-900">
                    {formatCurrencySync(order.total_amount || 0)}
                  </div>
                  <div className="text-sm text-gray-600">
                    {order.order_lines?.length || 0} items
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Route Planning Summary */}
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center space-x-2">
                <Clock className="h-4 w-4 text-blue-600" />
                <span className="text-blue-800">Estimated Route Time:</span>
              </div>
              <span className="font-medium text-blue-900">
                {Math.ceil(selectedDateOrders.length * 0.5)} hours
              </span>
            </div>
            <div className="flex items-center justify-between text-sm mt-1">
              <span className="text-blue-800">Total Revenue:</span>
              <span className="font-medium text-blue-900">
                {formatCurrencySync(selectedDateOrders.reduce((sum, order) => sum + (order.total_amount || 0), 0))}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};