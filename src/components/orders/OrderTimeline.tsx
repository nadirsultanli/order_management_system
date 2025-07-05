import React from 'react';
import { CheckCircle, Clock, AlertCircle, User, MessageSquare, Calendar } from 'lucide-react';
import { OrderStatusHistory, OrderStatus } from '../../types/order';

interface OrderTimelineProps {
  statusHistory: OrderStatusHistory[];
  currentStatus: OrderStatus;
  estimatedDates?: { [key: string]: string };
}

export const OrderTimeline: React.FC<OrderTimelineProps> = ({
  statusHistory,
  currentStatus,
  estimatedDates = {},
}) => {
  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusIcon = (status: OrderStatus, isCompleted: boolean) => {
    if (isCompleted) {
      return <CheckCircle className="h-5 w-5 text-green-600" />;
    } else if (status === currentStatus) {
      return <Clock className="h-5 w-5 text-blue-600" />;
    } else {
      return <div className="h-5 w-5 rounded-full border-2 border-gray-300 bg-white" />;
    }
  };

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

  const getTimelineItemClass = (status: OrderStatus, isCompleted: boolean) => {
    if (isCompleted) {
      return 'border-green-200 bg-green-50';
    } else if (status === currentStatus) {
      return 'border-blue-200 bg-blue-50';
    } else {
      return 'border-gray-200 bg-gray-50';
    }
  };

  const allStatuses: OrderStatus[] = ['draft', 'confirmed', 'scheduled', 'en_route', 'delivered', 'invoiced'];
  const currentStatusIndex = allStatuses.indexOf(currentStatus);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">Order Timeline</h3>
      
      <div className="space-y-4">
        {allStatuses.map((status, index) => {
          const isCompleted = index < currentStatusIndex || (status === currentStatus && currentStatus !== 'cancelled');
          const isCurrent = status === currentStatus;
          const statusInfo = getOrderStatusInfoSync(status);
          const historyItem = statusHistory.find(h => h.status === status);
          const estimatedDate = estimatedDates[status];

          // Skip cancelled status unless it's the current status
          if (status === 'cancelled' && currentStatus !== 'cancelled') {
            return null;
          }

          return (
            <div
              key={status}
              className={`relative flex items-start space-x-4 p-4 rounded-lg border ${getTimelineItemClass(status, isCompleted)}`}
            >
              {/* Timeline connector */}
              {index < allStatuses.length - 1 && status !== 'cancelled' && (
                <div className="absolute left-6 top-12 w-0.5 h-8 bg-gray-200"></div>
              )}

              {/* Status icon */}
              <div className="flex-shrink-0 mt-1">
                {getStatusIcon(status, isCompleted)}
              </div>

              {/* Status content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h4 className={`text-sm font-medium ${isCompleted || isCurrent ? 'text-gray-900' : 'text-gray-500'}`}>
                    {statusInfo.label}
                  </h4>
                  {historyItem && (
                    <span className="text-xs text-gray-500">
                      {formatDateTime(historyItem.changed_at)}
                    </span>
                  )}
                </div>

                <p className={`text-sm mt-1 ${isCompleted || isCurrent ? 'text-gray-600' : 'text-gray-400'}`}>
                  {statusInfo.description}
                </p>

                {/* Actual vs estimated timing */}
                {(historyItem || estimatedDate) && (
                  <div className="mt-2 flex items-center space-x-4 text-xs">
                    {historyItem && (
                      <div className="flex items-center space-x-1 text-green-600">
                        <CheckCircle className="h-3 w-3" />
                        <span>Completed: {formatDateTime(historyItem.changed_at)}</span>
                      </div>
                    )}
                    {estimatedDate && !historyItem && (
                      <div className="flex items-center space-x-1 text-blue-600">
                        <Calendar className="h-3 w-3" />
                        <span>Estimated: {formatDateTime(estimatedDate)}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Status change details */}
                {historyItem && (
                  <div className="mt-3 space-y-2">
                    {historyItem.user_name && (
                      <div className="flex items-center space-x-1 text-xs text-gray-500">
                        <User className="h-3 w-3" />
                        <span>Changed by: {historyItem.user_name}</span>
                      </div>
                    )}
                    {historyItem.notes && (
                      <div className="flex items-start space-x-1 text-xs text-gray-600">
                        <MessageSquare className="h-3 w-3 mt-0.5" />
                        <span>{historyItem.notes}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Current status indicator */}
                {isCurrent && (
                  <div className="mt-2">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      Current Status
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Performance metrics */}
      {statusHistory.length > 1 && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h4 className="text-sm font-medium text-gray-900 mb-3">Performance Metrics</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Order Processing Time:</span>
              <div className="font-medium text-gray-900">
                {/* Calculate time from draft to confirmed */}
                {(() => {
                  const draftTime = statusHistory.find(h => h.status === 'draft')?.changed_at;
                  const confirmedTime = statusHistory.find(h => h.status === 'confirmed')?.changed_at;
                  if (draftTime && confirmedTime) {
                    const hours = Math.round((new Date(confirmedTime).getTime() - new Date(draftTime).getTime()) / (1000 * 60 * 60));
                    return `${hours} hours`;
                  }
                  return 'N/A';
                })()}
              </div>
            </div>
            <div>
              <span className="text-gray-500">Fulfillment Time:</span>
              <div className="font-medium text-gray-900">
                {/* Calculate time from confirmed to delivered */}
                {(() => {
                  const confirmedTime = statusHistory.find(h => h.status === 'confirmed')?.changed_at;
                  const deliveredTime = statusHistory.find(h => h.status === 'delivered')?.changed_at;
                  if (confirmedTime && deliveredTime) {
                    const days = Math.round((new Date(deliveredTime).getTime() - new Date(confirmedTime).getTime()) / (1000 * 60 * 60 * 24));
                    return `${days} days`;
                  }
                  return 'N/A';
                })()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};