import React from 'react';
import { Banknote, CreditCard, Smartphone } from 'lucide-react';
import { PaymentMethod } from '../../types/payment';

interface PaymentMethodSelectorProps {
  selectedMethod: PaymentMethod;
  onMethodChange: (method: PaymentMethod) => void;
  disabled?: boolean;
  className?: string;
}

interface PaymentMethodOption {
  value: PaymentMethod;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  color: string;
  bgColor: string;
  borderColor: string;
  selectedBg: string;
  selectedBorder: string;
  selectedText: string;
}

const paymentMethods: PaymentMethodOption[] = [
  {
    value: 'Cash',
    label: 'Cash',
    icon: Banknote,
    description: 'Cash payment received',
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    selectedBg: 'bg-green-100',
    selectedBorder: 'border-green-500',
    selectedText: 'text-green-800'
  },
  {
    value: 'Card',
    label: 'Card',
    icon: CreditCard,
    description: 'Credit/Debit card payment',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    selectedBg: 'bg-blue-100',
    selectedBorder: 'border-blue-500',
    selectedText: 'text-blue-800'
  },
  {
    value: 'Mpesa',
    label: 'M-Pesa',
    icon: Smartphone,
    description: 'Mobile money payment',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    selectedBg: 'bg-purple-100',
    selectedBorder: 'border-purple-500',
    selectedText: 'text-purple-800'
  }
];

export const PaymentMethodSelector: React.FC<PaymentMethodSelectorProps> = ({
  selectedMethod,
  onMethodChange,
  disabled = false,
  className = ''
}) => {
  return (
    <div className={`space-y-3 ${className}`}>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {paymentMethods.map((method) => {
          const isSelected = selectedMethod === method.value;
          const IconComponent = method.icon;
          
          return (
            <button
              key={method.value}
              type="button"
              disabled={disabled}
              onClick={() => !disabled && onMethodChange(method.value)}
              className={`
                relative p-4 rounded-lg border-2 transition-all duration-200 text-left
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:shadow-md'}
                ${isSelected 
                  ? `${method.selectedBg} ${method.selectedBorder} ${method.selectedText}` 
                  : `${method.bgColor} ${method.borderColor} ${method.color} hover:${method.selectedBg}`
                }
              `}
            >
              {/* Selection indicator */}
              {isSelected && (
                <div className="absolute top-2 right-2">
                  <div className={`w-3 h-3 rounded-full bg-current`}></div>
                </div>
              )}
              
              <div className="flex items-start space-x-3">
                <div className={`flex-shrink-0 p-2 rounded-lg ${isSelected ? 'bg-white bg-opacity-50' : 'bg-white'}`}>
                  <IconComponent className="w-6 h-6" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold">{method.label}</h3>
                  <p className={`text-sm ${isSelected ? 'opacity-80' : 'opacity-70'}`}>
                    {method.description}
                  </p>
                  
                  {/* Method-specific badges */}
                  <div className="mt-2">
                    {method.value === 'Mpesa' && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-white bg-opacity-50">
                        STK Push
                      </span>
                    )}
                    {method.value === 'Cash' && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-white bg-opacity-50">
                        Immediate
                      </span>
                    )}
                    {method.value === 'Card' && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-white bg-opacity-50">
                        Manual Entry
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
      
      {/* Selected method details */}
      {selectedMethod && (
        <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              {(() => {
                const method = paymentMethods.find(m => m.value === selectedMethod);
                if (!method) return null;
                const IconComponent = method.icon;
                return <IconComponent className={`w-5 h-5 ${method.color}`} />;
              })()}
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-medium text-gray-900">
                {selectedMethod} Payment Selected
              </h4>
              <div className="mt-1 text-sm text-gray-600">
                {selectedMethod === 'Cash' && (
                  <p>Cash payment will be recorded immediately upon submission.</p>
                )}
                {selectedMethod === 'Card' && (
                  <p>Enter card payment details manually. Payment will be recorded as completed.</p>
                )}
                {selectedMethod === 'Mpesa' && (
                  <div className="space-y-1">
                    <p>M-Pesa payment will be initiated via STK push.</p>
                    <p className="text-xs text-gray-500">
                      • Customer will receive payment prompt on their phone<br/>
                      • Payment status will be tracked automatically<br/>
                      • Phone number must be in format 254XXXXXXXXX
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};