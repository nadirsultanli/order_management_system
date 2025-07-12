import React from 'react';
import { DollarSign, Weight, Tag, BarChart3 } from 'lucide-react';

interface PricingMethodSelectorProps {
  value: 'per_unit' | 'per_kg' | 'flat_rate' | 'tiered';
  onChange: (value: 'per_unit' | 'per_kg' | 'flat_rate' | 'tiered') => void;
  disabled?: boolean;
  className?: string;
}

const PRICING_METHODS = [
  {
    value: 'per_unit' as const,
    label: 'Per Unit',
    description: 'Traditional per-unit pricing',
    icon: Tag,
  },
  {
    value: 'per_kg' as const,
    label: 'Per Kilogram',
    description: 'Weight-based pricing for gas content',
    icon: Weight,
  },
  {
    value: 'flat_rate' as const,
    label: 'Flat Rate',
    description: 'Fixed rate regardless of quantity',
    icon: DollarSign,
  },
  {
    value: 'tiered' as const,
    label: 'Tiered Pricing',
    description: 'Volume-based tiered pricing',
    icon: BarChart3,
  },
];

export const PricingMethodSelector: React.FC<PricingMethodSelectorProps> = ({
  value,
  onChange,
  disabled = false,
  className = '',
}) => {
  const selectedMethod = PRICING_METHODS.find(method => method.value === value);

  return (
    <div className={className}>
      <label htmlFor="pricing_method" className="block text-sm font-medium text-gray-700 mb-2">
        Pricing Method
      </label>
      
      <select
        id="pricing_method"
        value={value}
        onChange={(e) => onChange(e.target.value as 'per_unit' | 'per_kg' | 'flat_rate' | 'tiered')}
        disabled={disabled}
        className="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
      >
        {PRICING_METHODS.map((method) => (
          <option key={method.value} value={method.value}>
            {method.label}
          </option>
        ))}
      </select>
      
      {selectedMethod && (
        <div className="mt-2 p-3 bg-gray-50 rounded-md border border-gray-200">
          <div className="flex items-center space-x-2 mb-1">
            <selectedMethod.icon className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-900">
              {selectedMethod.label}
            </span>
          </div>
          <p className="text-xs text-gray-600">
            {selectedMethod.description}
          </p>
          
          {/* Additional guidance based on pricing method */}
          {value === 'per_kg' && (
            <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded">
              <p className="text-xs text-blue-800">
                <strong>Weight-based pricing:</strong> Ensure gross weight is specified for accurate gas content calculation.
              </p>
            </div>
          )}
          
          {value === 'tiered' && (
            <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded">
              <p className="text-xs text-amber-800">
                <strong>Tiered pricing:</strong> Configure price breaks in the pricing section based on quantity ranges.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PricingMethodSelector;