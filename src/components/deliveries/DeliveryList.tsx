import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowDownCircle, 
  Truck, 
  Calendar, 
  MapPin, 
  Package,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Plus
} from 'lucide-react';
import { StatusBadge } from '../ui/StatusBadge';
import { Card } from '../ui/Card';
import { DeliveryView } from '../../types/delivery';
import { useDeliveries } from '../../hooks/useDeliveries';

export const DeliveryList: React.FC = () => {
  const navigate = useNavigate();
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Fetch deliveries using the hook
  const { data: deliveriesData, isLoading, error } = useDeliveries({
    status: selectedStatus === 'all' ? undefined : selectedStatus as any,
    date_from: selectedDate,
    date_to: selectedDate,
    limit: 50,
  });

  const deliveries = deliveriesData?.deliveries || [];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4" />;
      case 'in_transit':
        return <Truck className="h-4 w-4" />;
      case 'delivered':
        return <CheckCircle className="h-4 w-4" />;
      case 'failed':
      case 'cancelled':
        return <XCircle className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'warning';
      case 'in_transit':
        return 'info';
      case 'delivered':
        return 'success';
      case 'failed':
      case 'cancelled':
        return 'error';
      default:
        return 'default' as any;
    }
  };

  const handleNewDelivery = () => {
    navigate('/deliveries/new');
  };

  const handleViewDelivery = (deliveryId: string) => {
    navigate(`/deliveries/${deliveryId}`);
  };

  if (error) {
    return (
      <Card className="p-8 text-center">
        <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <p className="text-red-600">Error loading deliveries: {error.message}</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Status
          </label>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="in_transit">In Transit</option>
            <option value="delivered">Delivered</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Date
          </label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div className="flex items-end">
          <button
            onClick={handleNewDelivery}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Delivery
          </button>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <Card className="p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading deliveries...</p>
        </Card>
      )}

      {/* Delivery List */}
      {!isLoading && (
        <div className="space-y-4">
          {deliveries.map((delivery: DeliveryView) => (
            <Card key={delivery.id} className="p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-4 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {delivery.delivery_number}
                    </h3>
                    <StatusBadge
                      status={delivery.status}
                      size="md"
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                    <div className="flex items-center space-x-2 text-gray-600">
                      <Package className="h-4 w-4" />
                      <span>{delivery.customer_name}</span>
                    </div>
                    <div className="flex items-center space-x-2 text-gray-600">
                      <MapPin className="h-4 w-4" />
                      <span>{delivery.delivery_address}</span>
                    </div>
                    <div className="flex items-center space-x-2 text-gray-600">
                      <Truck className="h-4 w-4" />
                      <span>{delivery.truck_number} - {delivery.driver_name}</span>
                    </div>
                    <div className="flex items-center space-x-2 text-gray-600">
                      <Calendar className="h-4 w-4" />
                      <span>{new Date(delivery.delivery_date).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center space-x-4 text-sm">
                    <span className="text-gray-600">
                      Items: <span className="font-medium">{delivery.item_count}</span>
                    </span>
                    <span className="text-green-600">
                      Delivered: <span className="font-medium">{delivery.total_delivered}</span>
                    </span>
                    {delivery.total_returned > 0 && (
                      <span className="text-blue-600">
                        Returned: <span className="font-medium">{delivery.total_returned}</span>
                      </span>
                    )}
                  </div>
                </div>

                <div className="ml-4">
                  <button
                    onClick={() => handleViewDelivery(delivery.id)}
                    className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                  >
                    <Eye className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {!isLoading && deliveries.length === 0 && (
        <Card className="p-8 text-center">
          <ArrowDownCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No deliveries found for the selected filters.</p>
        </Card>
      )}
    </div>
  );
}; 