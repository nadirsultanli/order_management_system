import React, { useState, useEffect } from 'react';
import { AlertTriangle, Calculator, DollarSign, Info } from 'lucide-react';
import { formatCurrencySync } from '../../utils/pricing';

interface LostCylinderFee {
  base_fee: number;
  replacement_cost: number;
  administrative_fee: number;
  total_fee: number;
  currency_code: string;
}

interface CylinderInfo {
  capacity_l: number;
  product_name: string;
  unit_deposit: number;
  quantity: number;
}

interface LostCylinderFeeCalculatorProps {
  cylinderInfo: CylinderInfo;
  onFeeCalculated: (fee: LostCylinderFee) => void;
  currencyCode?: string;
}

export const LostCylinderFeeCalculator: React.FC<LostCylinderFeeCalculatorProps> = ({
  cylinderInfo,
  onFeeCalculated,
  currencyCode = 'KES',
}) => {
  const [calculatedFee, setCalculatedFee] = useState<LostCylinderFee | null>(null);
  const [showBreakdown, setShowBreakdown] = useState(false);

  // Fee calculation logic based on cylinder capacity and deposit
  const calculateFee = () => {
    // Base fee structure based on cylinder capacity
    const baseFeeMultiplier = getBaseFeeMultiplier(cylinderInfo.capacity_l);
    const base_fee = cylinderInfo.unit_deposit * baseFeeMultiplier;
    
    // Replacement cost (typically 2-3x the deposit amount)
    const replacement_cost = cylinderInfo.unit_deposit * 2.5;
    
    // Administrative fee (fixed percentage)
    const administrative_fee = (base_fee + replacement_cost) * 0.15; // 15% admin fee
    
    const total_fee = base_fee + replacement_cost + administrative_fee;

    return {
      base_fee,
      replacement_cost,
      administrative_fee,
      total_fee,
      currency_code: currencyCode,
    };
  };

  const getBaseFeeMultiplier = (capacity: number): number => {
    // Fee multiplier based on cylinder size
    if (capacity <= 6) return 1.2; // Small cylinders
    if (capacity <= 13) return 1.5; // Medium cylinders
    if (capacity <= 45) return 1.8; // Large cylinders
    return 2.0; // Industrial cylinders
  };

  const getCylinderCategory = (capacity: number): string => {
    if (capacity <= 6) return 'Small';
    if (capacity <= 13) return 'Medium';
    if (capacity <= 45) return 'Large';
    return 'Industrial';
  };

  useEffect(() => {
    const fee = calculateFee();
    setCalculatedFee(fee);
    onFeeCalculated(fee);
  }, [cylinderInfo, currencyCode]);

  if (!calculatedFee) {
    return (
      <div className="flex items-center justify-center py-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-red-600"></div>
      </div>
    );
  }

  const totalFeeForAllCylinders = calculatedFee.total_fee * cylinderInfo.quantity;

  return (
    <div className="space-y-4 p-4 bg-red-50 border border-red-200 rounded-lg">
      <div className="flex items-center space-x-2">
        <AlertTriangle className="h-5 w-5 text-red-600" />
        <h3 className="text-lg font-medium text-red-900">Lost Cylinder Fee Calculation</h3>
      </div>

      {/* Cylinder Information */}
      <div className="bg-white border border-red-300 rounded-lg p-3">
        <h4 className="text-sm font-medium text-gray-900 mb-2">Cylinder Details</h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Product:</span>
            <div className="font-medium">{cylinderInfo.product_name}</div>
          </div>
          <div>
            <span className="text-gray-600">Capacity:</span>
            <div className="font-medium">{cylinderInfo.capacity_l}kg ({getCylinderCategory(cylinderInfo.capacity_l)})</div>
          </div>
          <div>
            <span className="text-gray-600">Quantity Lost:</span>
            <div className="font-medium text-red-600">{cylinderInfo.quantity} cylinder{cylinderInfo.quantity > 1 ? 's' : ''}</div>
          </div>
          <div>
            <span className="text-gray-600">Original Deposit:</span>
            <div className="font-medium">{formatCurrencySync(cylinderInfo.unit_deposit, currencyCode)} each</div>
          </div>
        </div>
      </div>

      {/* Fee Summary */}
      <div className="bg-white border border-red-300 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-lg font-semibold text-gray-900">Fee Summary</h4>
          <button
            onClick={() => setShowBreakdown(!showBreakdown)}
            className="flex items-center text-sm text-blue-600 hover:text-blue-700"
          >
            <Calculator className="h-4 w-4 mr-1" />
            {showBreakdown ? 'Hide' : 'Show'} Breakdown
          </button>
        </div>

        {showBreakdown && (
          <div className="space-y-2 mb-4 p-3 bg-gray-50 rounded-lg">
            <div className="text-sm font-medium text-gray-700 mb-2">Per Cylinder Breakdown:</div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Base Fee:</span>
                <span>{formatCurrencySync(calculatedFee.base_fee, currencyCode)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Replacement Cost:</span>
                <span>{formatCurrencySync(calculatedFee.replacement_cost, currencyCode)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Administrative Fee (15%):</span>
                <span>{formatCurrencySync(calculatedFee.administrative_fee, currencyCode)}</span>
              </div>
              <div className="border-t border-gray-300 pt-1">
                <div className="flex justify-between font-medium">
                  <span>Total per Cylinder:</span>
                  <span>{formatCurrencySync(calculatedFee.total_fee, currencyCode)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-gray-200">
            <span className="text-base font-medium text-gray-700">Fee per Cylinder:</span>
            <span className="text-lg font-semibold text-red-600">
              {formatCurrencySync(calculatedFee.total_fee, currencyCode)}
            </span>
          </div>
          
          <div className="flex items-center justify-between py-2 bg-red-100 rounded-lg px-3">
            <div className="flex items-center space-x-2">
              <DollarSign className="h-5 w-5 text-red-600" />
              <span className="text-lg font-semibold text-red-900">Total Charge:</span>
            </div>
            <span className="text-xl font-bold text-red-600">
              {formatCurrencySync(totalFeeForAllCylinders, currencyCode)}
            </span>
          </div>
        </div>
      </div>

      {/* Important Notice */}
      <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-3">
        <div className="flex items-start space-x-2">
          <Info className="h-5 w-5 text-yellow-600 mt-0.5" />
          <div className="text-sm">
            <div className="font-medium text-yellow-900 mb-1">Important Notice</div>
            <ul className="text-yellow-800 space-y-1">
              <li>• This fee will be charged to the customer's account</li>
              <li>• The original deposit amount will not be refunded</li>
              <li>• Fee includes replacement cost and administrative charges</li>
              <li>• Customer will be notified of the charge via email/SMS</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Additional Actions */}
      <div className="flex items-center justify-between pt-2 border-t border-red-200">
        <div className="text-sm text-gray-600">
          Calculation based on {getCylinderCategory(cylinderInfo.capacity_l).toLowerCase()} cylinder rate structure
        </div>
        <div className="text-xs text-gray-500">
          Fee auto-calculated • {new Date().toLocaleString()}
        </div>
      </div>
    </div>
  );
};