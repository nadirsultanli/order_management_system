import React from 'react';
import { Truck, RotateCcw } from 'lucide-react';

interface ProductVariantSelectorProps {
  value: 'outright' | 'refill';
  onChange: (value: 'outright' | 'refill') => void;
  disabled?: boolean;
}

export const ProductVariantSelector: React.FC<ProductVariantSelectorProps> = ({
  value,
  onChange,
  disabled = false,
}) => {
  const variants = [
    {
      value: 'outright' as const,
      label: 'Outright',
      description: 'Full cylinders for sale',
      icon: Truck,
      color: 'bg-blue-50 border-blue-200 text-blue-800',
      selectedColor: 'bg-blue-100 border-blue-300',
    },
    {
      value: 'refill' as const,
      label: 'Refill',
      description: 'Refillable cylinders',
      icon: RotateCcw,
      color: 'bg-green-50 border-green-200 text-green-800',
      selectedColor: 'bg-green-100 border-green-300',
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Product Variant</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {variants.map((variant) => {
            const Icon = variant.icon;
            const isSelected = value === variant.value;
            
            return (
              <button
                key={variant.value}
                type="button"
                onClick={() => onChange(variant.value)}
                disabled={disabled}
                className={`relative p-4 border-2 rounded-lg text-left transition-all hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed ${
                  isSelected ? variant.selectedColor : variant.color
                }`}
              >
                <div className="flex items-start space-x-3">
                  <Icon className="h-6 w-6 flex-shrink-0" />
                  <div className="flex-1">
                    <h4 className="font-medium">{variant.label}</h4>
                    <p className="text-sm opacity-80 mt-1">{variant.description}</p>
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
    </div>
  );
};