import React, { useState, useEffect } from 'react';
import { 
  Package, 
  User, 
  MapPin, 
  AlertTriangle, 
  CheckCircle, 
  Minus,
  Plus,
  Edit3
} from 'lucide-react';
import { TripWithDetails, LoadingAction, TripOrder } from '../../types/trip';
import { Card } from '../ui/Card';

interface TripLoadingInterfaceProps {
  trip: TripWithDetails;
  onLoadingAction: (action: LoadingAction) => void;
  pendingActions: LoadingAction[];
}

interface LoadingEntry {
  trip_order_id: string;
  product_id: string;
  product_name: string;
  requested_quantity: number;
  available_quantity: number;
  loaded_quantity: number;
  actual_weight_kg?: number;
  notes?: string;
}

export const TripLoadingInterface: React.FC<TripLoadingInterfaceProps> = ({
  trip,
  onLoadingAction,
  pendingActions
}) => {
  const [loadingEntries, setLoadingEntries] = useState<Record<string, LoadingEntry>>({});
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);

  // Initialize loading entries from trip orders
  useEffect(() => {
    const entries: Record<string, LoadingEntry> = {};
    
    trip.trip_orders?.forEach(tripOrder => {
      tripOrder.order?.order_items?.forEach(item => {
        const key = `${tripOrder.id}_${item.product_id}`;
        entries[key] = {
          trip_order_id: tripOrder.id,
          product_id: item.product_id,
          product_name: item.product?.name || 'Unknown Product',
          requested_quantity: item.quantity,
          available_quantity: item.quantity, // This would come from inventory check
          loaded_quantity: item.loaded_quantity || 0,
          actual_weight_kg: item.total_weight_kg,
          notes: item.short_load_reason || ''
        };
      });
    });
    
    setLoadingEntries(entries);
  }, [trip.trip_orders]);

  // Update loading entries with pending actions
  useEffect(() => {
    setLoadingEntries(currentEntries => {
      const updatedEntries = { ...currentEntries };
      
      pendingActions.forEach(action => {
        const key = `${action.trip_order_id}_${action.product_id}`;
        if (updatedEntries[key]) {
          updatedEntries[key] = {
            ...updatedEntries[key],
            loaded_quantity: action.quantity_to_load,
            actual_weight_kg: action.actual_weight_kg,
            notes: action.notes || ''
          };
        }
      });
      
      return updatedEntries;
    });
  }, [pendingActions]);

  const handleQuantityChange = (
    tripOrderId: string, 
    productId: string, 
    newQuantity: number,
    actualWeight?: number,
    notes?: string
  ) => {
    const action: LoadingAction = {
      trip_order_id: tripOrderId,
      product_id: productId,
      quantity_to_load: Math.max(0, newQuantity),
      actual_weight_kg: actualWeight,
      notes: notes
    };
    
    onLoadingAction(action);
  };

  const getTripOrderById = (tripOrderId: string): TripOrder | undefined => {
    return trip.trip_orders?.find(to => to.id === tripOrderId);
  };

  const getLoadingStatus = (entry: LoadingEntry) => {
    if (entry.loaded_quantity === 0) return 'not_loaded';
    if (entry.loaded_quantity < entry.requested_quantity) return 'short_loaded';
    return 'loaded';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'loaded': return 'text-green-600 bg-green-50 border-green-200';
      case 'short_loaded': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'not_loaded': return 'text-gray-600 bg-gray-50 border-gray-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'loaded': return <CheckCircle className="h-4 w-4" />;
      case 'short_loaded': return <AlertTriangle className="h-4 w-4" />;
      case 'not_loaded': return <Package className="h-4 w-4" />;
      default: return <Package className="h-4 w-4" />;
    }
  };

  // Group entries by trip order
  const groupedEntries = Object.values(loadingEntries).reduce((acc, entry) => {
    if (!acc[entry.trip_order_id]) {
      acc[entry.trip_order_id] = [];
    }
    acc[entry.trip_order_id].push(entry);
    return acc;
  }, {} as Record<string, LoadingEntry[]>);

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center space-x-2">
          <Package className="h-5 w-5 text-blue-600" />
          <div>
            <h3 className="text-sm font-medium text-blue-800">Loading Instructions</h3>
            <p className="text-sm text-blue-700">
              Use the quantity controls to record actual loaded amounts. 
              Values less than requested will be marked as short loads.
            </p>
          </div>
        </div>
      </div>

      {trip.trip_orders?.map(tripOrder => {
        const entries = groupedEntries[tripOrder.id] || [];
        const orderStatus = tripOrder.loading_status;
        const isActive = activeOrderId === tripOrder.id;

        return (
          <Card key={tripOrder.id}>
            <div className="p-6">
              {/* Order Header */}
              <div 
                className="flex items-center justify-between mb-4 cursor-pointer"
                onClick={() => setActiveOrderId(isActive ? null : tripOrder.id)}
              >
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      orderStatus === 'loaded' ? 'bg-green-100 text-green-700' :
                      orderStatus === 'short_loaded' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {tripOrder.stop_sequence}
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold">
                        Order #{tripOrder.order_id.slice(-8)}
                      </h3>
                      <div className="flex items-center space-x-4 text-sm text-gray-600">
                        <div className="flex items-center space-x-1">
                          <User className="h-3 w-3" />
                          <span>{tripOrder.order?.customer?.name}</span>
                        </div>
                        {tripOrder.order?.delivery_address && (
                          <div className="flex items-center space-x-1">
                            <MapPin className="h-3 w-3" />
                            <span>
                              {tripOrder.order.delivery_address.city}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(orderStatus)}`}>
                    {getStatusIcon(orderStatus)}
                    <span className="ml-2 capitalize">
                      {orderStatus?.replace('_', ' ') || 'Pending'}
                    </span>
                  </span>
                  
                  <div className="text-sm text-gray-500">
                    {entries.reduce((sum, entry) => sum + entry.loaded_quantity, 0)} / {entries.reduce((sum, entry) => sum + entry.requested_quantity, 0)} items
                  </div>
                </div>
              </div>

              {/* Product Loading Details */}
              {isActive && (
                <div className="border-t border-gray-200 pt-4">
                  <div className="space-y-4">
                    {entries.map(entry => {
                      const status = getLoadingStatus(entry);
                      const key = `${entry.trip_order_id}_${entry.product_id}`;

                      return (
                        <div key={key} className="bg-gray-50 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <h4 className="font-medium text-gray-900">
                                {entry.product_name}
                              </h4>
                              <p className="text-sm text-gray-600">
                                Requested: {entry.requested_quantity} units
                                {entry.actual_weight_kg && (
                                  <span className="ml-2">
                                    • Weight: {entry.actual_weight_kg.toFixed(1)} kg
                                  </span>
                                )}
                              </p>
                            </div>
                            
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(status)}`}>
                              {getStatusIcon(status)}
                              <span className="ml-1 capitalize">
                                {status.replace('_', ' ')}
                              </span>
                            </span>
                          </div>

                          {/* Quantity Controls */}
                          <div className="flex items-center space-x-4">
                            <div className="flex items-center space-x-2">
                              <label className="text-sm font-medium text-gray-700">
                                Loaded Quantity:
                              </label>
                              
                              <div className="flex items-center border border-gray-300 rounded-md">
                                <button
                                  type="button"
                                  onClick={() => handleQuantityChange(
                                    entry.trip_order_id,
                                    entry.product_id,
                                    entry.loaded_quantity - 1,
                                    entry.actual_weight_kg,
                                    entry.notes
                                  )}
                                  disabled={entry.loaded_quantity <= 0}
                                  className="p-1 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  <Minus className="h-4 w-4" />
                                </button>
                                
                                <input
                                  type="number"
                                  min="0"
                                  max={entry.available_quantity}
                                  value={entry.loaded_quantity}
                                  onChange={(e) => {
                                    const rawValue = e.target.value;
                                    
                                    // Allow empty input for user convenience
                                    if (rawValue === '') {
                                      handleQuantityChange(
                                        entry.trip_order_id,
                                        entry.product_id,
                                        0,
                                        entry.actual_weight_kg,
                                        entry.notes
                                      );
                                      return;
                                    }
                                    
                                    // Parse the value safely
                                    const parsedValue = Number(rawValue);
                                    
                                    // Validate that it's a valid number
                                    if (isNaN(parsedValue) || !Number.isFinite(parsedValue)) {
                                      return; // Reject invalid input
                                    }
                                    
                                    // Ensure it's an integer (no decimals for quantity)
                                    const integerValue = Math.floor(Math.abs(parsedValue));
                                    
                                    // Clamp the value to the allowed range
                                    const clampedValue = Math.min(
                                      Math.max(integerValue, 0), 
                                      entry.available_quantity
                                    );
                                    
                                    handleQuantityChange(
                                      entry.trip_order_id,
                                      entry.product_id,
                                      clampedValue,
                                      entry.actual_weight_kg,
                                      entry.notes
                                    );
                                  }}
                                  className="w-16 px-2 py-1 text-center border-0 focus:ring-0"
                                />
                                
                                <button
                                  type="button"
                                  onClick={() => handleQuantityChange(
                                    entry.trip_order_id,
                                    entry.product_id,
                                    entry.loaded_quantity + 1,
                                    entry.actual_weight_kg,
                                    entry.notes
                                  )}
                                  disabled={entry.loaded_quantity >= entry.available_quantity}
                                  className="p-1 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  <Plus className="h-4 w-4" />
                                </button>
                              </div>
                              
                              <button
                                type="button"
                                onClick={() => handleQuantityChange(
                                  entry.trip_order_id,
                                  entry.product_id,
                                  entry.requested_quantity,
                                  entry.actual_weight_kg,
                                  entry.notes
                                )}
                                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                              >
                                Load Full
                              </button>
                            </div>

                            {/* Weight Input */}
                            <div className="flex items-center space-x-2">
                              <label className="text-sm font-medium text-gray-700">
                                Actual Weight (kg):
                              </label>
                              <input
                                type="number"
                                step="0.1"
                                min="0"
                                value={entry.actual_weight_kg || ''}
                                onChange={(e) => handleQuantityChange(
                                  entry.trip_order_id,
                                  entry.product_id,
                                  entry.loaded_quantity,
                                  parseFloat(e.target.value) || undefined,
                                  entry.notes
                                )}
                                placeholder="0.0"
                                className="w-20 px-2 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                              />
                            </div>
                          </div>

                          {/* Notes for Short Loads */}
                          {status === 'short_loaded' && (
                            <div className="mt-3">
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Short Load Reason:
                              </label>
                              <div className="flex items-center space-x-2">
                                <Edit3 className="h-4 w-4 text-gray-400" />
                                <input
                                  type="text"
                                  value={entry.notes || ''}
                                  onChange={(e) => handleQuantityChange(
                                    entry.trip_order_id,
                                    entry.product_id,
                                    entry.loaded_quantity,
                                    entry.actual_weight_kg,
                                    e.target.value
                                  )}
                                  placeholder="Reason for short load..."
                                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                />
                              </div>
                            </div>
                          )}

                          {/* Availability Warning */}
                          {entry.loaded_quantity > entry.available_quantity && (
                            <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                              <AlertTriangle className="h-4 w-4 inline mr-1" />
                              Loaded quantity exceeds available inventory ({entry.available_quantity} available)
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </Card>
        );
      })}

      {/* Summary Stats */}
      <Card>
        <div className="p-6">
          <h3 className="text-lg font-semibold mb-4">Loading Summary</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {Object.values(loadingEntries).filter(e => getLoadingStatus(e) === 'loaded').length}
              </div>
              <div className="text-sm text-gray-600">Fully Loaded</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {Object.values(loadingEntries).filter(e => getLoadingStatus(e) === 'short_loaded').length}
              </div>
              <div className="text-sm text-gray-600">Short Loaded</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-600">
                {Object.values(loadingEntries).filter(e => getLoadingStatus(e) === 'not_loaded').length}
              </div>
              <div className="text-sm text-gray-600">Not Loaded</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {Object.values(loadingEntries).reduce((sum, e) => sum + e.loaded_quantity, 0)}
              </div>
              <div className="text-sm text-gray-600">Total Items Loaded</div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};