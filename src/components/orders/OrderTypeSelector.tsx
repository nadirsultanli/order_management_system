import React from 'react';
import { Truck, RotateCcw, ArrowRightLeft, Package2, Clock, Zap, Calendar } from 'lucide-react';
import { getOrderTypeDisplayName, getServiceTypeDisplayName, shouldRequirePickup, getOrderTypeBusinessRules } from '../../utils/product-variants';

interface OrderTypeSelectorProps {
  orderType: 'delivery' | 'refill' | 'exchange' | 'pickup';
  serviceType: 'standard' | 'express' | 'scheduled';
  exchangeEmptyQty: number;
  requiresPickup: boolean;
  onOrderTypeChange: (orderType: 'delivery' | 'refill' | 'exchange' | 'pickup') => void;
  onServiceTypeChange: (serviceType: 'standard' | 'express' | 'scheduled') => void;
  onExchangeEmptyQtyChange: (qty: number) => void;
  onRequiresPickupChange: (requires: boolean) => void;
  disabled?: boolean;
}

export const OrderTypeSelector: React.FC<OrderTypeSelectorProps> = ({
  orderType,
  serviceType,
  exchangeEmptyQty,
  requiresPickup,
  onOrderTypeChange,
  onServiceTypeChange,
  onExchangeEmptyQtyChange,
  onRequiresPickupChange,
  disabled = false,
}) => {
  const orderTypes = [
    {
      value: 'delivery' as const,
      label: 'Standard Delivery',
      description: 'Deliver full cylinders to customer',
      icon: Truck,
      color: 'bg-blue-50 border-blue-200 text-blue-800',
      selectedColor: 'bg-blue-100 border-blue-300',
    },
    {
      value: 'refill' as const,
      label: 'Refill Service',
      description: 'Deliver full cylinders and collect empties',
      icon: RotateCcw,
      color: 'bg-green-50 border-green-200 text-green-800',
      selectedColor: 'bg-green-100 border-green-300',
    },
    {
      value: 'exchange' as const,
      label: 'Cylinder Exchange',
      description: 'Exchange empties for full cylinders',
      icon: ArrowRightLeft,
      color: 'bg-orange-50 border-orange-200 text-orange-800',
      selectedColor: 'bg-orange-100 border-orange-300',
    },
    {
      value: 'pickup' as const,
      label: 'Empty Pickup',
      description: 'Collect empty cylinders only',
      icon: Package2,
      color: 'bg-purple-50 border-purple-200 text-purple-800',
      selectedColor: 'bg-purple-100 border-purple-300',
    },
  ];

  const serviceTypes = [
    {
      value: 'standard' as const,
      label: 'Standard Service',
      description: 'Regular delivery schedule',
      icon: Clock,
    },
    {
      value: 'express' as const,
      label: 'Express Service',
      description: 'Priority delivery',
      icon: Zap,
    },
    {
      value: 'scheduled' as const,
      label: 'Scheduled Service',
      description: 'Specific delivery time',
      icon: Calendar,
    },
  ];

  const handleOrderTypeChange = (newOrderType: 'delivery' | 'refill' | 'exchange' | 'pickup') => {
    onOrderTypeChange(newOrderType);
    
    // Apply business rules for the order type
    const businessRules = getOrderTypeBusinessRules(newOrderType);
    onRequiresPickupChange(businessRules.requiresPickup);
    
    // Reset exchange quantity for order types that don't allow it
    if (!businessRules.allowsExchangeQty) {
      onExchangeEmptyQtyChange(0);
    }
  };

  const currentBusinessRules = getOrderTypeBusinessRules(orderType);

  return (
    <div className="space-y-6">
      {/* Order Type Selection */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Order Type</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {orderTypes.map((type) => {
            const Icon = type.icon;
            const isSelected = orderType === type.value;
            
            return (
              <button
                key={type.value}
                type="button"
                onClick={() => handleOrderTypeChange(type.value)}
                disabled={disabled}
                className={`relative p-4 border-2 rounded-lg text-left transition-all hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed ${
                  isSelected ? type.selectedColor : type.color
                }`}
              >
                <div className="flex items-start space-x-3">
                  <Icon className="h-6 w-6 flex-shrink-0" />
                  <div className="flex-1">
                    <h4 className="font-medium">{type.label}</h4>
                    <p className="text-sm opacity-80 mt-1">{type.description}</p>
                  </div>
                </div>
                {isSelected && (
                  <div className="absolute top-2 right-2">
                    <div className="w-3 h-3 bg-current rounded-full"></div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Service Type Selection */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Service Type</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {serviceTypes.map((service) => {
            const Icon = service.icon;
            const isSelected = serviceType === service.value;
            
            return (
              <button
                key={service.value}
                type="button"
                onClick={() => onServiceTypeChange(service.value)}
                disabled={disabled}
                className={`relative p-4 border-2 rounded-lg text-left transition-all hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed ${
                  isSelected 
                    ? 'bg-gray-100 border-gray-300 text-gray-900' 
                    : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-start space-x-3">
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  <div className="flex-1">
                    <h4 className="font-medium">{service.label}</h4>
                    <p className="text-sm opacity-80 mt-1">{service.description}</p>
                  </div>
                </div>
                {isSelected && (
                  <div className="absolute top-2 right-2">
                    <div className="w-3 h-3 bg-blue-600 rounded-full"></div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Business Rules Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 mb-2">Order Type: {orderTypes.find(t => t.value === orderType)?.label}</h4>
        <p className="text-sm text-blue-700 mb-3">{currentBusinessRules.description}</p>
        <div className="flex flex-wrap gap-2">
          {currentBusinessRules.deliveryRequired && (
            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">
              ✓ Delivery Required
            </span>
          )}
          {currentBusinessRules.pickupRequired && (
            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-orange-100 text-orange-800">
              ⚠ Pickup Required
            </span>
          )}
          {currentBusinessRules.allowsExchangeQty && (
            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-800">
              🔄 Exchange Quantity
            </span>
          )}
        </div>
      </div>

      {/* Order Type Specific Options */}
      {currentBusinessRules.pickupRequired && (
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            {orderType === 'pickup' ? 'Pickup Details' : 'Exchange Details'}
          </h3>
          
          <div className="space-y-4">
            {currentBusinessRules.allowsExchangeQty && (
              <div>
                <label htmlFor="exchange_empty_qty" className="block text-sm font-medium text-gray-700">
                  {orderType === 'pickup' 
                    ? 'Empty Cylinders to Collect *' 
                    : 'Empty Cylinders to Exchange *'
                  }
                </label>
                <input
                  type="number"
                  id="exchange_empty_qty"
                  min="0"
                  value={exchangeEmptyQty}
                  onChange={(e) => onExchangeEmptyQtyChange(parseInt(e.target.value) || 0)}
                  disabled={disabled}
                  className="mt-1 block w-full sm:w-32 rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                  placeholder="0"
                />
                <p className="mt-1 text-sm text-gray-600">
                  {orderType === 'refill' && 'Number of empty cylinders customer will return'}
                  {orderType === 'exchange' && 'Number of empty cylinders to collect from customer'}
                  {orderType === 'pickup' && 'Number of empty cylinders to collect'}
                </p>
              </div>
            )}

            {!currentBusinessRules.requiresPickup && (
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="requires_pickup"
                  checked={requiresPickup}
                  onChange={(e) => onRequiresPickupChange(e.target.checked)}
                  disabled={disabled || currentBusinessRules.requiresPickup}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded disabled:opacity-50"
                />
                <label htmlFor="requires_pickup" className="ml-2 block text-sm text-gray-700">
                  Optional pickup of empty cylinders
                  {currentBusinessRules.requiresPickup && (
                    <span className="text-gray-500 text-xs ml-1">(Required for this order type)</span>
                  )}
                </label>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Service Type Information */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-900 mb-2">
          Service Type: {getServiceTypeDisplayName(serviceType)}
        </h4>
        <div className="text-sm text-gray-700">
          {serviceType === 'standard' && (
            <p>Regular delivery during business hours (same day or next day)</p>
          )}
          {serviceType === 'express' && (
            <p>Priority delivery within 2-4 hours (additional charges may apply)</p>
          )}
          {serviceType === 'scheduled' && (
            <p>Delivery at a specific date and time chosen by customer</p>
          )}
        </div>
      </div>
    </div>
  );
}; 