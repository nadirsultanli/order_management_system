import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Truck, 
  Calendar, 
  Clock, 
  Package, 
  MapPin, 
  User, 
  AlertTriangle,
  CheckCircle 
} from 'lucide-react';
import { TripWithDetails } from '../../types/trip';
import { TripStatusBadge } from './TripStatusBadge';
import { LoadingProgressDisplay } from './LoadingProgressDisplay';

interface TripCardProps {
  trip: TripWithDetails;
  showProgress?: boolean;
  compact?: boolean;
  onStatusChange?: (tripId: string, newStatus: string) => void;
}

export const TripCard: React.FC<TripCardProps> = ({
  trip,
  showProgress = true,
  compact = false,
  onStatusChange
}) => {
  const {
    id,
    truck,
    driver_name,
    trip_date,
    planned_start_time,
    planned_end_time,
    status,
    trip_orders,
    capacity_info,
    loading_progress,
    total_distance_km,
    notes
  } = trip;

  const formatTime = (timeString?: string | null) => {
    // Handle null, undefined, or empty string cases
    if (!timeString || timeString.trim() === '') {
      return 'Not set';
    }

    // Validate time format (HH:MM or HH:MM:SS)
    const timeRegex = /^([01]?[0-9]|2[0-3]):([0-5][0-9])(?::([0-5][0-9]))?$/;
    
    if (!timeRegex.test(timeString.trim())) {
      return 'Invalid time';
    }

    try {
      const dateString = `1970-01-01T${timeString.trim()}`;
      const date = new Date(dateString);
      
      // Check if the Date object is valid
      if (isNaN(date.getTime())) {
        return 'Invalid time';
      }

      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    } catch (error) {
      // Catch any unexpected errors and return graceful fallback
      return 'Invalid time';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  const getCapacityColor = () => {
    const utilization = capacity_info?.utilization_percentage || 0;
    if (utilization > 100) return 'text-red-600';
    if (utilization > 90) return 'text-yellow-600';
    return 'text-green-600';
  };

  const hasWarnings = capacity_info?.is_overallocated || 
                     capacity_info?.short_loading_warnings?.length > 0;

  if (compact) {
    return (
      <Link to={`/trips/${id}`}>
        <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <Truck className="h-4 w-4 text-gray-400" />
              <span className="font-medium">{truck?.fleet_number}</span>
            </div>
            <TripStatusBadge 
              status={status} 
              size="sm"
              interactive={!!onStatusChange}
              onStatusChange={(newStatus) => onStatusChange?.(id, newStatus)}
            />
          </div>
          
          <div className="text-sm text-gray-600 space-y-1">
            <div className="flex items-center justify-between">
              <span>{formatDate(trip_date)}</span>
              <span>{trip_orders?.length || 0} orders</span>
            </div>
            
            {capacity_info && (
              <div className={`text-xs font-medium ${getCapacityColor()}`}>
                {capacity_info.utilization_percentage.toFixed(1)}% capacity
              </div>
            )}
          </div>

          {hasWarnings && (
            <div className="mt-2 flex items-center text-yellow-600">
              <AlertTriangle className="h-3 w-3 mr-1" />
              <span className="text-xs">Warnings</span>
            </div>
          )}
        </div>
      </Link>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Truck className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Trip #{id.slice(-8)}
              </h3>
              <p className="text-sm text-gray-600">
                {truck?.fleet_number} • {truck?.license_plate}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {hasWarnings && (
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
            )}
            <TripStatusBadge 
              status={status}
              interactive={!!onStatusChange}
              onStatusChange={(newStatus) => onStatusChange?.(id, newStatus)}
            />
          </div>
        </div>

        {/* Trip Details Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div className="flex items-center space-x-2">
            <Calendar className="h-4 w-4 text-gray-400" />
            <div>
              <p className="text-xs text-gray-500">Date</p>
              <p className="text-sm font-medium">{formatDate(trip_date)}</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Clock className="h-4 w-4 text-gray-400" />
            <div>
              <p className="text-xs text-gray-500">Planned Time</p>
              <p className="text-sm font-medium">
                {formatTime(planned_start_time)} - {formatTime(planned_end_time)}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <User className="h-4 w-4 text-gray-400" />
            <div>
              <p className="text-xs text-gray-500">Driver</p>
              <p className="text-sm font-medium">{driver_name || 'Not assigned'}</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Package className="h-4 w-4 text-gray-400" />
            <div>
              <p className="text-xs text-gray-500">Orders</p>
              <p className="text-sm font-medium">{trip_orders?.length || 0}</p>
            </div>
          </div>
        </div>

        {/* Capacity Information */}
        {capacity_info && (
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-gray-700">Capacity Utilization</h4>
              <span className={`text-sm font-bold ${getCapacityColor()}`}>
                {capacity_info.utilization_percentage.toFixed(1)}%
              </span>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-600">Weight: 
                  <span className="ml-1 font-medium">
                    {capacity_info.allocated_weight_kg.toFixed(1)} / {capacity_info.total_capacity_kg.toFixed(1)} kg
                  </span>
                </p>
              </div>
              <div>
                <p className="text-gray-600">Cylinders: 
                  <span className="ml-1 font-medium">
                    {capacity_info.allocated_cylinders} / {capacity_info.total_capacity_cylinders}
                  </span>
                </p>
              </div>
            </div>

            {/* Capacity Bar */}
            <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${
                  capacity_info.utilization_percentage > 100 
                    ? 'bg-red-500' 
                    : capacity_info.utilization_percentage > 90 
                    ? 'bg-yellow-500' 
                    : 'bg-green-500'
                }`}
                style={{ width: `${Math.min(capacity_info.utilization_percentage, 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Loading Progress */}
        {showProgress && loading_progress && (
          <div className="mb-4">
            <LoadingProgressDisplay 
              progress={loading_progress} 
              showDetails={false}
              size="sm"
            />
          </div>
        )}

        {/* Warnings */}
        {capacity_info?.short_loading_warnings && capacity_info.short_loading_warnings.length > 0 && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <span className="text-sm font-medium text-yellow-800">
                Short Loading Warnings ({capacity_info.short_loading_warnings.length})
              </span>
            </div>
            <div className="space-y-1">
              {capacity_info.short_loading_warnings.slice(0, 2).map((warning, index) => (
                <p key={index} className="text-xs text-yellow-700">
                  {warning.customer_name}: {warning.product_name} - Short by {warning.shortage} units
                </p>
              ))}
              {capacity_info.short_loading_warnings.length > 2 && (
                <p className="text-xs text-yellow-600">
                  +{capacity_info.short_loading_warnings.length - 2} more warnings
                </p>
              )}
            </div>
          </div>
        )}

        {/* Additional Info */}
        <div className="flex items-center justify-between text-sm text-gray-500">
          <div className="flex items-center space-x-4">
            {total_distance_km && (
              <div className="flex items-center space-x-1">
                <MapPin className="h-3 w-3" />
                <span>{total_distance_km.toFixed(1)} km</span>
              </div>
            )}
            
            {capacity_info?.is_overallocated && (
              <div className="flex items-center space-x-1 text-red-500">
                <AlertTriangle className="h-3 w-3" />
                <span>Overallocated</span>
              </div>
            )}
            
            {status === 'completed' && (
              <div className="flex items-center space-x-1 text-green-500">
                <CheckCircle className="h-3 w-3" />
                <span>Completed</span>
              </div>
            )}
          </div>

          <Link 
            to={`/trips/${id}`}
            className="text-blue-600 hover:text-blue-800 font-medium"
          >
            View Details →
          </Link>
        </div>

        {notes && (
          <div className="mt-3 p-2 bg-gray-50 rounded text-sm text-gray-600">
            <strong>Notes:</strong> {notes}
          </div>
        )}
      </div>
    </div>
  );
};