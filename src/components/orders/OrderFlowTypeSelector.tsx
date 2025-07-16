import React from 'react';
import { ShoppingCart, RefreshCw, Info } from 'lucide-react';

interface OrderFlowTypeSelectorProps {
  orderFlowType: 'outright' | 'exchange' | null;
  onOrderFlowTypeChange: (flowType: 'outright' | 'exchange') => void;
  disabled?: boolean;
}

export const OrderFlowTypeSelector: React.FC<OrderFlowTypeSelectorProps> = ({
  orderFlowType,
  onOrderFlowTypeChange,
  disabled = false,
}) => {
  const flowTypes = [
    {
      value: 'outright' as const,
      label: 'Outright Purchase',
      description: 'Customer purchases full cylinders without returning empties',
      charges: 'Gas Fill + Cylinder Deposit',
      icon: ShoppingCart,
      color: 'bg-blue-50 border-blue-200 text-blue-800',
      selectedColor: 'bg-blue-100 border-blue-500',
    },
    {
      value: 'exchange' as const,
      label: 'Refill/Exchange',
      description: 'Customer exchanges empty cylinders for full ones',
      charges: 'Gas Fill only (Empty return credit auto-generated)',
      icon: RefreshCw,
      color: 'bg-green-50 border-green-200 text-green-800',
      selectedColor: 'bg-green-100 border-green-500',
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2 mb-2">
        <h3 className="text-sm font-medium text-gray-700">Order Flow Type</h3>
        <Info className="h-4 w-4 text-gray-400" />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {flowTypes.map((flowType) => {
          const isSelected = orderFlowType === flowType.value;
          const Icon = flowType.icon;
          
          return (
            <button
              key={flowType.value}
              type="button"
              onClick={() => !disabled && onOrderFlowTypeChange(flowType.value)}
              disabled={disabled}
              className={`
                relative p-4 rounded-lg border-2 text-left transition-all
                ${isSelected 
                  ? flowType.selectedColor 
                  : flowType.color
                }
                ${disabled 
                  ? 'opacity-50 cursor-not-allowed' 
                  : 'hover:shadow-md cursor-pointer'
                }
              `}
            >
              <div className="flex items-start space-x-3">
                <div className={`
                  p-2 rounded-lg
                  ${isSelected ? 'bg-white/80' : 'bg-white/50'}
                `}>
                  <Icon className="h-5 w-5" />
                </div>
                
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900 mb-1">
                    {flowType.label}
                  </h4>
                  <p className="text-sm text-gray-600 mb-2">
                    {flowType.description}
                  </p>
                  <div className="text-xs font-medium text-gray-700 bg-white/50 px-2 py-1 rounded inline-block">
                    {flowType.charges}
                  </div>
                </div>
              </div>
              
              {isSelected && (
                <div className="absolute top-2 right-2 w-4 h-4 bg-white rounded-full flex items-center justify-center">
                  <div className="w-2 h-2 bg-current rounded-full" />
                </div>
              )}
            </button>
          );
        })}
      </div>
      
      {orderFlowType === 'exchange' && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
          <div className="flex items-start space-x-2">
            <Info className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-amber-800">
              <strong>Empty Return Credit:</strong> Customer will receive a credit for returning empty cylinders. 
              If empties are not returned within 30 days, the credit will be cancelled and the customer will be charged the deposit amount.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}; 