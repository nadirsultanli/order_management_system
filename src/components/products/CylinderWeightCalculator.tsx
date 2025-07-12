import React from 'react';
import { Calculator, AlertTriangle, CheckCircle } from 'lucide-react';

interface CylinderWeightCalculatorProps {
  grossWeight?: number;
  tareWeight?: number;
  capacityKg?: number;
  className?: string;
}

export const CylinderWeightCalculator: React.FC<CylinderWeightCalculatorProps> = ({
  grossWeight,
  tareWeight,
  capacityKg,
  className = '',
}) => {
  const netGasWeight = grossWeight && tareWeight ? grossWeight - tareWeight : undefined;
  const hasValidWeights = grossWeight && tareWeight && grossWeight > tareWeight;
  const isOverCapacity = netGasWeight && capacityKg && netGasWeight > capacityKg;
  const fillPercentage = netGasWeight && capacityKg ? (netGasWeight / capacityKg) * 100 : undefined;

  const formatWeight = (weight?: number) => {
    if (!weight) return '-';
    return `${weight.toFixed(2)} kg`;
  };

  const getStatusColor = () => {
    if (!hasValidWeights) return 'text-gray-500';
    if (isOverCapacity) return 'text-red-600';
    return 'text-green-600';
  };

  const getStatusIcon = () => {
    if (!hasValidWeights) return Calculator;
    if (isOverCapacity) return AlertTriangle;
    return CheckCircle;
  };

  const StatusIcon = getStatusIcon();

  return (
    <div className={`bg-gray-50 rounded-lg border border-gray-200 p-4 ${className}`}>
      <div className="flex items-center space-x-2 mb-3">
        <StatusIcon className={`h-5 w-5 ${getStatusColor()}`} />
        <h4 className="text-sm font-medium text-gray-900">
          Gas Weight Calculation
        </h4>
      </div>

      <div className="space-y-3">
        {/* Weight Calculations */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Gross Weight:</span>
            <div className="font-medium text-gray-900">
              {formatWeight(grossWeight)}
            </div>
          </div>
          <div>
            <span className="text-gray-600">Tare Weight:</span>
            <div className="font-medium text-gray-900">
              {formatWeight(tareWeight)}
            </div>
          </div>
          <div>
            <span className="text-gray-600">Net Gas Weight:</span>
            <div className={`font-medium ${getStatusColor()}`}>
              {formatWeight(netGasWeight)}
            </div>
          </div>
          <div>
            <span className="text-gray-600">Capacity:</span>
            <div className="font-medium text-gray-900">
              {formatWeight(capacityKg)}
            </div>
          </div>
        </div>

        {/* Fill Percentage */}
        {fillPercentage !== undefined && (
          <div className="pt-2 border-t border-gray-200">
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm text-gray-600">Fill Level:</span>
              <span className={`text-sm font-medium ${getStatusColor()}`}>
                {fillPercentage.toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${
                  isOverCapacity 
                    ? 'bg-red-500' 
                    : fillPercentage > 90 
                      ? 'bg-yellow-500' 
                      : 'bg-green-500'
                }`}
                style={{ width: `${Math.min(fillPercentage, 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Status Messages */}
        {hasValidWeights && (
          <div className="pt-2 border-t border-gray-200">
            {isOverCapacity ? (
              <div className="flex items-start space-x-2 p-2 bg-red-50 border border-red-200 rounded">
                <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-red-800">
                  <strong>Warning:</strong> Net gas weight ({formatWeight(netGasWeight)}) exceeds 
                  cylinder capacity ({formatWeight(capacityKg)}). Please verify measurements.
                </div>
              </div>
            ) : (
              <div className="flex items-start space-x-2 p-2 bg-green-50 border border-green-200 rounded">
                <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-green-800">
                  Gas weight calculation is valid. Net gas content: {formatWeight(netGasWeight)}
                </div>
              </div>
            )}
          </div>
        )}

        {!hasValidWeights && (grossWeight || tareWeight) && (
          <div className="pt-2 border-t border-gray-200">
            <div className="flex items-start space-x-2 p-2 bg-gray-50 border border-gray-200 rounded">
              <Calculator className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-gray-600">
                {!grossWeight && !tareWeight 
                  ? 'Enter gross weight and tare weight to calculate net gas content.'
                  : !grossWeight 
                    ? 'Enter gross weight to calculate net gas content.'
                    : !tareWeight 
                      ? 'Enter tare weight to calculate net gas content.'
                      : grossWeight <= tareWeight 
                        ? 'Gross weight must be greater than tare weight.'
                        : 'Calculating...'
                }
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CylinderWeightCalculator;