import React from 'react';

export type PricingMethod = 'per_unit' | 'per_kg' | 'flat_rate' | 'tiered';

interface PricingMethodSelectorProps {
  value: PricingMethod;
  onChange: (method: PricingMethod) => void;
  className?: string;
  disabled?: boolean;
}

const pricingMethodOptions = [
  {
    value: 'per_unit' as const,
    label: 'Per Unit',
    description: 'Price per individual item/cylinder',
    icon: '📦'
  },
  {
    value: 'per_kg' as const,
    label: 'Per KG',
    description: 'Price based on gas weight content',
    icon: '⚖️'
  }
];

export const PricingMethodSelector: React.FC<PricingMethodSelectorProps> = ({
  value,
  onChange,
  className = '',
  disabled = false
}) => {
  return (
    <div className={`space-y-2 ${className}`}>
      <label className="block text-sm font-medium text-gray-700">
        Pricing Method{disabled && ' (inherited from price list)'}
      </label>
      <div className="grid grid-cols-2 gap-2">
        {pricingMethodOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            disabled={disabled}
            className={`
              p-3 text-left rounded-lg border-2 transition-all duration-200
              ${value === option.value
                ? 'border-blue-500 bg-blue-50 text-blue-900'
                : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
              }
              ${disabled ? 'opacity-60 cursor-not-allowed bg-gray-100' : 'cursor-pointer'}
            `}
          >
            <div className="flex items-center space-x-2">
              <span className="text-lg">{option.icon}</span>
              <div>
                <div className="font-medium text-sm">{option.label}</div>
                <div className="text-xs text-gray-500">{option.description}</div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}; 