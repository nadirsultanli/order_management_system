import React, { useState, useEffect } from 'react';
import { Calculator, Plus, Minus, RotateCcw } from 'lucide-react';
import { useDepositRateByCapacity } from '../../hooks/useDeposits';
import { CYLINDER_CONDITIONS } from '../../types/deposits';

interface CalculatorItem {
  id: string;
  capacity_l: number;
  quantity: number;
  unit_deposit: number;
  condition?: string;
  refund_percentage?: number;
}

interface DepositCalculatorProps {
  mode: 'charge' | 'refund';
  currency?: string;
  onCalculationChange?: (total: number, items: CalculatorItem[]) => void;
}

export const DepositCalculator: React.FC<DepositCalculatorProps> = ({
  mode,
  currency = 'KES',
  onCalculationChange,
}) => {
  const [items, setItems] = useState<CalculatorItem[]>([]);
  const [nextId, setNextId] = useState(1);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const addItem = () => {
    const newItem: CalculatorItem = {
      id: nextId.toString(),
      capacity_l: 13, // Default capacity
      quantity: 1,
      unit_deposit: 100, // Default deposit amount
      condition: mode === 'refund' ? 'good' : undefined,
      refund_percentage: mode === 'refund' ? 90 : undefined,
    };
    setItems(prev => [...prev, newItem]);
    setNextId(prev => prev + 1);
  };

  const removeItem = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const updateItem = (id: string, updates: Partial<CalculatorItem>) => {
    setItems(prev => prev.map(item => 
      item.id === id ? { ...item, ...updates } : item
    ));
  };

  const handleCapacityChange = (id: string, capacity: number) => {
    updateItem(id, { capacity_l: capacity });
    // You could fetch the deposit rate for this capacity here
    // For now, we'll use a simple calculation
    const estimatedDeposit = capacity * 7.5; // Rough estimate
    updateItem(id, { unit_deposit: estimatedDeposit });
  };

  const handleConditionChange = (id: string, condition: string) => {
    const conditionData = CYLINDER_CONDITIONS.find(c => c.value === condition);
    if (conditionData) {
      updateItem(id, { 
        condition, 
        refund_percentage: conditionData.refund_percentage 
      });
    }
  };

  const calculateItemTotal = (item: CalculatorItem) => {
    if (mode === 'charge') {
      return item.quantity * item.unit_deposit;
    } else {
      // Refund mode
      const baseAmount = item.quantity * item.unit_deposit;
      const refundPercentage = item.refund_percentage || 100;
      return baseAmount * (refundPercentage / 100);
    }
  };

  const totalAmount = items.reduce((sum, item) => sum + calculateItemTotal(item), 0);

  // Notify parent of calculation changes
  useEffect(() => {
    if (onCalculationChange) {
      onCalculationChange(totalAmount, items);
    }
  }, [totalAmount, items, onCalculationChange]);

  const reset = () => {
    setItems([]);
    setNextId(1);
  };

  const commonCapacities = [5, 9, 13, 19, 47.5];

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Calculator className="h-5 w-5 text-blue-600" />
          <h3 className="text-lg font-medium text-gray-900">
            {mode === 'charge' ? 'Deposit Charge' : 'Refund'} Calculator
          </h3>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={addItem}
            className="flex items-center space-x-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Add Item</span>
          </button>
          {items.length > 0 && (
            <button
              onClick={reset}
              className="flex items-center space-x-1 px-3 py-1.5 bg-gray-600 text-white text-sm rounded-md hover:bg-gray-700 transition-colors"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
          <Calculator className="h-8 w-8 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-500">Click "Add Item" to start calculating</p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <div key={item.id} className="bg-gray-50 p-4 rounded-lg border">
              <div className="flex items-center justify-between mb-3">
                <span className="font-medium text-gray-900">Item {item.id}</span>
                <button
                  onClick={() => removeItem(item.id)}
                  className="text-red-600 hover:text-red-800"
                >
                  <Minus className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Capacity (L)
                  </label>
                  <select
                    value={item.capacity_l}
                    onChange={(e) => handleCapacityChange(item.id, Number(e.target.value))}
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {commonCapacities.map(capacity => (
                      <option key={capacity} value={capacity}>
                        {capacity}L
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Quantity
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => updateItem(item.id, { quantity: parseInt(e.target.value) || 1 })}
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Unit {mode === 'charge' ? 'Deposit' : 'Original Deposit'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.unit_deposit}
                    onChange={(e) => updateItem(item.id, { unit_deposit: parseFloat(e.target.value) || 0 })}
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {mode === 'refund' && (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Condition
                    </label>
                    <select
                      value={item.condition || 'good'}
                      onChange={(e) => handleConditionChange(item.id, e.target.value)}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    >
                      {CYLINDER_CONDITIONS.map(condition => (
                        <option key={condition.value} value={condition.value}>
                          {condition.label} ({condition.refund_percentage}%)
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {mode === 'charge' && (
                  <div className="md:col-span-1">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Total
                    </label>
                    <div className="px-2 py-1 text-sm bg-white border border-gray-300 rounded">
                      {formatCurrency(calculateItemTotal(item))}
                    </div>
                  </div>
                )}
              </div>

              {mode === 'refund' && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Original Total:</span>
                      <div className="font-medium">
                        {formatCurrency(item.quantity * item.unit_deposit)}
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-600">Refund %:</span>
                      <div className="font-medium text-blue-600">
                        {item.refund_percentage || 100}%
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-600">Refund Amount:</span>
                      <div className="font-medium text-green-600">
                        {formatCurrency(calculateItemTotal(item))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Total Summary */}
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <div className="flex justify-between items-center">
              <span className="text-lg font-medium text-blue-900">
                Total {mode === 'charge' ? 'Deposit Charge' : 'Refund Amount'}:
              </span>
              <span className="text-2xl font-bold text-blue-900">
                {formatCurrency(totalAmount)}
              </span>
            </div>
            <div className="mt-2 text-sm text-blue-700">
              {items.length} item{items.length !== 1 ? 's' : ''} • {' '}
              {items.reduce((sum, item) => sum + item.quantity, 0)} cylinder{items.reduce((sum, item) => sum + item.quantity, 0) !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};