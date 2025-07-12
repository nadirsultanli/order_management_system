import React from 'react';
import { DollarSign, Weight, Calculator, Info } from 'lucide-react';

interface WeightBasedPricingPreviewProps {
  pricingMethod: 'per_unit' | 'per_kg' | 'flat_rate' | 'tiered';
  netGasWeight?: number;
  samplePricePerKg?: number;
  samplePricePerUnit?: number;
  capacityKg?: number;
  className?: string;
}

export const WeightBasedPricingPreview: React.FC<WeightBasedPricingPreviewProps> = ({
  pricingMethod,
  netGasWeight,
  samplePricePerKg = 150, // Default sample price in KES
  samplePricePerUnit = 2500, // Default sample price in KES
  capacityKg,
  className = '',
}) => {
  const calculatePricing = () => {
    switch (pricingMethod) {
      case 'per_kg':
        return netGasWeight ? netGasWeight * samplePricePerKg : 0;
      case 'per_unit':
        return samplePricePerUnit;
      case 'flat_rate':
        return samplePricePerUnit;
      case 'tiered':
        // Sample tiered pricing logic
        if (!netGasWeight) return 0;
        if (netGasWeight <= 10) return netGasWeight * 160;
        if (netGasWeight <= 25) return netGasWeight * 145;
        return netGasWeight * 135;
      default:
        return 0;
    }
  };

  const estimatedPrice = calculatePricing();
  const pricePerKgEquivalent = netGasWeight ? estimatedPrice / netGasWeight : 0;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
    }).format(amount);
  };

  const getPricingDescription = () => {
    switch (pricingMethod) {
      case 'per_kg':
        return 'Price calculated based on actual gas weight';
      case 'per_unit':
        return 'Fixed price per cylinder unit';
      case 'flat_rate':
        return 'Fixed rate regardless of weight or quantity';
      case 'tiered':
        return 'Volume-based pricing with quantity breaks';
      default:
        return '';
    }
  };

  const getTieredBreakdown = () => {
    if (pricingMethod !== 'tiered' || !netGasWeight) return null;

    const tiers = [
      { min: 0, max: 10, rate: 160, label: '0-10 kg' },
      { min: 10, max: 25, rate: 145, label: '10-25 kg' },
      { min: 25, max: Infinity, rate: 135, label: '25+ kg' },
    ];

    return (
      <div className="mt-3 space-y-2">
        <h5 className="text-xs font-medium text-gray-700">Tiered Rates:</h5>
        {tiers.map((tier, index) => {
          const isApplicable = netGasWeight > tier.min && (tier.max === Infinity || netGasWeight <= tier.max);
          return (
            <div 
              key={index}
              className={`flex justify-between text-xs ${
                isApplicable ? 'text-blue-600 font-medium' : 'text-gray-500'
              }`}
            >
              <span>{tier.label}</span>
              <span>{formatCurrency(tier.rate)}/kg</span>
            </div>
          );
        })}
      </div>
    );
  };

  if (!netGasWeight && pricingMethod === 'per_kg') {
    return (
      <div className={`bg-amber-50 border border-amber-200 rounded-lg p-4 ${className}`}>
        <div className="flex items-center space-x-2 mb-2">
          <Info className="h-4 w-4 text-amber-600" />
          <span className="text-sm font-medium text-amber-800">
            Weight-Based Pricing Preview
          </span>
        </div>
        <p className="text-xs text-amber-700">
          Enter gross weight and tare weight to see pricing calculation preview.
        </p>
      </div>
    );
  }

  return (
    <div className={`bg-blue-50 border border-blue-200 rounded-lg p-4 ${className}`}>
      <div className="flex items-center space-x-2 mb-3">
        <Calculator className="h-4 w-4 text-blue-600" />
        <span className="text-sm font-medium text-blue-900">
          Pricing Preview
        </span>
      </div>

      <div className="space-y-3">
        {/* Pricing Method Info */}
        <div>
          <p className="text-xs text-blue-700 mb-2">
            {getPricingDescription()}
          </p>
        </div>

        {/* Price Calculation */}
        <div className="bg-white rounded-md p-3 border border-blue-200">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-gray-600">Pricing Method:</span>
              <div className="font-medium text-gray-900 capitalize">
                {pricingMethod.replace('_', ' ')}
              </div>
            </div>
            
            {netGasWeight && (
              <div>
                <span className="text-gray-600">Net Gas Weight:</span>
                <div className="font-medium text-gray-900">
                  {netGasWeight.toFixed(2)} kg
                </div>
              </div>
            )}

            <div className="col-span-2 pt-2 border-t border-gray-200">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Estimated Price:</span>
                <span className="text-lg font-bold text-blue-600">
                  {formatCurrency(estimatedPrice)}
                </span>
              </div>
              
              {pricingMethod === 'per_kg' && netGasWeight && (
                <div className="mt-1 text-xs text-gray-500">
                  {formatCurrency(samplePricePerKg)} per kg × {netGasWeight.toFixed(2)} kg
                </div>
              )}
              
              {pricingMethod !== 'per_kg' && netGasWeight && pricePerKgEquivalent > 0 && (
                <div className="mt-1 text-xs text-gray-500">
                  Equivalent: {formatCurrency(pricePerKgEquivalent)} per kg
                </div>
              )}
            </div>
          </div>

          {/* Tiered Pricing Breakdown */}
          {getTieredBreakdown()}
        </div>

        {/* Comparison with different methods */}
        {netGasWeight && (
          <div className="bg-gray-50 rounded-md p-3 border border-gray-200">
            <h5 className="text-xs font-medium text-gray-700 mb-2">Pricing Comparison:</h5>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-600">Per Unit:</span>
                <span className={pricingMethod === 'per_unit' ? 'font-bold text-blue-600' : 'text-gray-900'}>
                  {formatCurrency(samplePricePerUnit)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Per kg ({netGasWeight.toFixed(2)} kg):</span>
                <span className={pricingMethod === 'per_kg' ? 'font-bold text-blue-600' : 'text-gray-900'}>
                  {formatCurrency(netGasWeight * samplePricePerKg)}
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="text-xs text-blue-700 bg-blue-100 rounded p-2">
          <strong>Note:</strong> This is a preview using sample prices. Actual prices will be configured in the pricing section.
        </div>
      </div>
    </div>
  );
};

export default WeightBasedPricingPreview;