import React, { useState } from 'react';
import { Truck, AlertTriangle, CheckCircle, Package, Scale } from 'lucide-react';
import { TruckWithInventory, TruckCapacityInfo } from '../../types/truck';
import { Order } from '../../types/order';

interface TruckRecommendation {
  truck: TruckWithInventory;
  capacity_info: TruckCapacityInfo;
  fit_score: number;
  can_accommodate: boolean;
  warnings: string[];
  errors: string[];
}

interface TruckAllocationSelectorProps {
  order: Order;
  orderWeight: number;
  recommendations: TruckRecommendation[];
  selectedTruckId?: string;
  onTruckSelect: (truckId: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
  isLoading?: boolean;
}

export const TruckAllocationSelector: React.FC<TruckAllocationSelectorProps> = ({
  order,
  orderWeight,
  recommendations,
  selectedTruckId,
  onTruckSelect,
  onCancel,
  onConfirm,
  isLoading = false
}) => {
  const [showAllTrucks, setShowAllTrucks] = useState(false);

  const formatWeight = (kg: number) => {
    if (kg >= 1000) {
      return `${(kg / 1000).toFixed(1)}t`;
    }
    return `${kg}kg`;
  };

  const getRecommendationIcon = (recommendation: TruckRecommendation) => {
    if (recommendation.errors.length > 0) {
      return <AlertTriangle className="h-5 w-5 text-red-500" />;
    }
    if (recommendation.warnings.length > 0) {
      return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
    }
    return <CheckCircle className="h-5 w-5 text-green-500" />;
  };

  const getCardBorderColor = (recommendation: TruckRecommendation, isSelected: boolean) => {
    if (isSelected) return 'border-blue-500 bg-blue-50';
    if (recommendation.errors.length > 0) return 'border-red-300';
    if (recommendation.warnings.length > 0) return 'border-yellow-300';
    return 'border-gray-200 hover:border-blue-300';
  };

  const availableRecommendations = recommendations.filter(r => r.can_accommodate);
  const unavailableRecommendations = recommendations.filter(r => !r.can_accommodate);
  const displayRecommendations = showAllTrucks ? recommendations : availableRecommendations;

  const selectedRecommendation = recommendations.find(r => r.truck.id === selectedTruckId);
  const canConfirm = selectedTruckId && selectedRecommendation?.can_accommodate;

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 max-w-4xl w-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Assign Truck for Order #{order.id.slice(-6)}
            </h3>
            <div className="flex items-center space-x-4 mt-2 text-sm text-gray-600">
              <div className="flex items-center space-x-1">
                <Package className="h-4 w-4" />
                <span>Order Weight: {formatWeight(orderWeight)}</span>
              </div>
              <div className="flex items-center space-x-1">
                <Scale className="h-4 w-4" />
                <span>Delivery Date: {order.scheduled_date || 'Today'}</span>
              </div>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600"
          >
            ×
          </button>
        </div>
      </div>

      {/* Truck Selection */}
      <div className="px-6 py-4">
        {/* Available Trucks */}
        {availableRecommendations.length > 0 && (
          <div className="mb-6">
            <h4 className="text-md font-medium text-gray-900 mb-3 flex items-center">
              <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
              Available Trucks ({availableRecommendations.length})
            </h4>
            <div className="grid gap-3">
              {availableRecommendations.map((recommendation) => (
                <TruckCard
                  key={recommendation.truck.id}
                  recommendation={recommendation}
                  orderWeight={orderWeight}
                  isSelected={selectedTruckId === recommendation.truck.id}
                  onClick={() => onTruckSelect(recommendation.truck.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Unavailable Trucks */}
        {unavailableRecommendations.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-md font-medium text-gray-700 flex items-center">
                <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
                Unavailable Trucks ({unavailableRecommendations.length})
              </h4>
              <button
                onClick={() => setShowAllTrucks(!showAllTrucks)}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                {showAllTrucks ? 'Hide' : 'Show'} unavailable trucks
              </button>
            </div>
            
            {showAllTrucks && (
              <div className="grid gap-3 opacity-75">
                {unavailableRecommendations.map((recommendation) => (
                  <TruckCard
                    key={recommendation.truck.id}
                    recommendation={recommendation}
                    orderWeight={orderWeight}
                    isSelected={false}
                    onClick={() => {}} // Disabled
                    disabled={true}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* No Trucks Available */}
        {recommendations.length === 0 && (
          <div className="text-center py-8">
            <Truck className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No trucks available for this order</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {selectedRecommendation && (
              <div className="flex items-center space-x-4">
                <span>
                  Selected: {selectedRecommendation.truck.fleet_number}
                </span>
                <span>
                  Utilization after: {(
                    ((selectedRecommendation.capacity_info.allocated_weight_kg + orderWeight) / 
                     selectedRecommendation.capacity_info.total_capacity_kg) * 100
                  ).toFixed(1)}%
                </span>
              </div>
            )}
          </div>
          
          <div className="flex space-x-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={!canConfirm || isLoading}
              className={`px-4 py-2 rounded-md font-medium ${
                canConfirm && !isLoading
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {isLoading ? 'Assigning...' : 'Assign Truck'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface TruckCardProps {
  recommendation: TruckRecommendation;
  orderWeight: number;
  isSelected: boolean;
  onClick: () => void;
  disabled?: boolean;
}

const TruckCard: React.FC<TruckCardProps> = ({
  recommendation,
  orderWeight,
  isSelected,
  onClick,
  disabled = false
}) => {
  const { truck, capacity_info, warnings, errors } = recommendation;

  const formatWeight = (kg: number) => {
    if (kg >= 1000) {
      return `${(kg / 1000).toFixed(1)}t`;
    }
    return `${kg}kg`;
  };

  const utilizationAfter = ((capacity_info.allocated_weight_kg + orderWeight) / capacity_info.total_capacity_kg) * 100;

  return (
    <div
      className={`border-2 rounded-lg p-4 transition-all duration-200 ${
        disabled ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'
      } ${
        isSelected 
          ? 'border-blue-500 bg-blue-50' 
          : errors.length > 0 
            ? 'border-red-300 hover:border-red-400' 
            : warnings.length > 0 
              ? 'border-yellow-300 hover:border-yellow-400'
              : 'border-gray-200 hover:border-blue-300'
      }`}
      onClick={disabled ? undefined : onClick}
    >
      <div className="flex items-center justify-between">
        {/* Truck Info */}
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-lg ${
            isSelected ? 'bg-blue-200' : 'bg-gray-100'
          }`}>
            <Truck className={`h-5 w-5 ${
              isSelected ? 'text-blue-600' : 'text-gray-600'
            }`} />
          </div>
          
          <div>
            <h5 className="font-semibold text-gray-900">
              {truck.fleet_number}
            </h5>
            <p className="text-sm text-gray-600">{truck.license_plate}</p>
            {truck.driver && (
              <p className="text-xs text-gray-500">Driver: {truck.driver.name}</p>
            )}
          </div>
        </div>

        {/* Status Icon */}
        <div className="flex items-center space-x-2">
          {errors.length > 0 ? (
            <AlertTriangle className="h-5 w-5 text-red-500" />
          ) : warnings.length > 0 ? (
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
          ) : (
            <CheckCircle className="h-5 w-5 text-green-500" />
          )}
        </div>
      </div>

      {/* Capacity Bar */}
      <div className="mt-3">
        <div className="flex justify-between text-xs text-gray-600 mb-1">
          <span>Current: {capacity_info.utilization_percentage.toFixed(1)}%</span>
          <span>After: {utilizationAfter.toFixed(1)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div className="flex h-2 rounded-full overflow-hidden">
            <div
              className="bg-blue-500"
              style={{ width: `${Math.min(capacity_info.utilization_percentage, 100)}%` }}
            />
            <div
              className={`${
                utilizationAfter > 100 ? 'bg-red-500' : 
                utilizationAfter > 85 ? 'bg-orange-500' : 'bg-blue-300'
              }`}
              style={{ 
                width: `${Math.min(
                  Math.max(0, utilizationAfter - capacity_info.utilization_percentage), 
                  100 - capacity_info.utilization_percentage
                )}%` 
              }}
            />
          </div>
        </div>
        <div className="flex justify-between text-xs text-gray-600 mt-1">
          <span>{formatWeight(capacity_info.allocated_weight_kg)} / {formatWeight(capacity_info.total_capacity_kg)}</span>
          <span>Available: {formatWeight(capacity_info.available_weight_kg)}</span>
        </div>
      </div>

      {/* Messages */}
      {(errors.length > 0 || warnings.length > 0) && (
        <div className="mt-3 space-y-1">
          {errors.map((error, index) => (
            <div key={index} className="text-xs text-red-700 bg-red-50 p-2 rounded">
              {error}
            </div>
          ))}
          {warnings.map((warning, index) => (
            <div key={index} className="text-xs text-yellow-700 bg-yellow-50 p-2 rounded">
              {warning}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}; 