import React from 'react';
import { Truck, AlertTriangle, Package, Clock, Fuel, Wrench } from 'lucide-react';
import { TruckWithInventory, TruckCapacityInfo, DailyTruckSchedule } from '../../types/truck';
import { StatusBadge } from '../ui/StatusBadge';

interface TruckCapacityCardProps {
  schedule: DailyTruckSchedule;
  onClick?: () => void;
}

export const TruckCapacityCard: React.FC<TruckCapacityCardProps> = ({ 
  schedule, 
  onClick 
}) => {
  const { truck, capacity_info, allocations, maintenance_due, fuel_sufficient } = schedule;
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-600 bg-green-100';
      case 'inactive': return 'text-gray-600 bg-gray-100';
      case 'maintenance': return 'text-yellow-600 bg-yellow-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getUtilizationColor = (percentage: number, isOverallocated: boolean) => {
    if (isOverallocated) return 'bg-red-500';
    if (percentage > 85) return 'bg-orange-500';
    if (percentage > 60) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const formatWeight = (kg: number) => {
    if (kg >= 1000) {
      return `${(kg / 1000).toFixed(1)}t`;
    }
    return `${kg}kg`;
  };

  const warnings = [];
  if (maintenance_due) warnings.push('Maintenance Due');
  if (!fuel_sufficient) warnings.push('Low Fuel');
  if (capacity_info.is_overallocated) warnings.push('Overallocated');

  return (
    <div 
      className={`bg-white rounded-lg shadow border-2 transition-all duration-200 hover:shadow-md ${
        onClick ? 'cursor-pointer hover:border-blue-300' : 'border-gray-200'
      } ${capacity_info.is_overallocated ? 'border-red-300' : 'border-gray-200'}`}
      onClick={onClick}
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Truck className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-lg text-gray-900">
                {truck.fleet_number}
              </h3>
              <p className="text-sm text-gray-600">{truck.license_plate}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <StatusBadge
              status={truck.status}
              className={getStatusColor(truck.status)}
            />
            {warnings.length > 0 && (
              <div className="flex items-center text-red-600">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-xs ml-1">{warnings.length}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Capacity Information */}
      <div className="p-4">
        <div className="space-y-4">
          {/* Capacity Bar */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700">Capacity</span>
              <span className="text-sm text-gray-600">
                {formatWeight(capacity_info.allocated_weight_kg)} / {formatWeight(capacity_info.total_capacity_kg)}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all duration-300 ${getUtilizationColor(
                  capacity_info.utilization_percentage,
                  capacity_info.is_overallocated
                )}`}
                style={{
                  width: `${Math.min(capacity_info.utilization_percentage, 100)}%`
                }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-600 mt-1">
              <span>0%</span>
              <span className="font-medium">
                {capacity_info.utilization_percentage.toFixed(1)}%
              </span>
              <span>100%</span>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center space-x-2">
              <Package className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-xs text-gray-600">Orders</p>
                <p className="font-semibold">{capacity_info.orders_count}</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Truck className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-xs text-gray-600">Available</p>
                <p className="font-semibold">{formatWeight(capacity_info.available_weight_kg)}</p>
              </div>
            </div>

            {truck.driver && (
              <div className="flex items-center space-x-2">
                <div className="h-4 w-4 bg-gray-400 rounded-full" />
                <div>
                  <p className="text-xs text-gray-600">Driver</p>
                  <p className="font-semibold text-sm">{truck.driver.name}</p>
                </div>
              </div>
            )}

            {schedule.route && (
              <div className="flex items-center space-x-2">
                <Clock className="h-4 w-4 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-600">Route</p>
                  <p className="font-semibold">{schedule.route.route_status}</p>
                </div>
              </div>
            )}
          </div>

          {/* Warning Messages */}
          {warnings.length > 0 && (
            <div className="space-y-1">
              {maintenance_due && (
                <div className="flex items-center space-x-2 text-yellow-700 bg-yellow-50 p-2 rounded">
                  <Wrench className="h-4 w-4" />
                  <span className="text-sm">Maintenance due</span>
                </div>
              )}
              
              {!fuel_sufficient && (
                <div className="flex items-center space-x-2 text-orange-700 bg-orange-50 p-2 rounded">
                  <Fuel className="h-4 w-4" />
                  <span className="text-sm">Check fuel level</span>
                </div>
              )}
              
              {capacity_info.is_overallocated && (
                <div className="flex items-center space-x-2 text-red-700 bg-red-50 p-2 rounded">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-sm">Capacity exceeded by {formatWeight(capacity_info.allocated_weight_kg - capacity_info.total_capacity_kg)}</span>
                </div>
              )}
            </div>
          )}

          {/* Order List Preview */}
          {allocations.length > 0 && (
            <div className="border-t pt-3 mt-3">
              <p className="text-xs font-medium text-gray-700 mb-2">
                Today's Orders ({allocations.length})
              </p>
              <div className="space-y-1">
                {allocations.slice(0, 3).map((allocation, index) => (
                  <div key={allocation.id} className="flex justify-between text-xs">
                    <span className="text-gray-600">Order #{allocation.order_id.slice(-6)}</span>
                    <span className="font-medium">{formatWeight(allocation.estimated_weight_kg)}</span>
                  </div>
                ))}
                {allocations.length > 3 && (
                  <p className="text-xs text-gray-500">
                    +{allocations.length - 3} more orders
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}; 