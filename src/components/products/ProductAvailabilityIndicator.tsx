import React from 'react';
import { AlertTriangle, DollarSign, Check, X, Info, ExternalLink } from 'lucide-react';
import { formatCurrencySync } from '../../utils/pricing';

interface ProductAvailabilityIndicatorProps {
  productId: string;
  productName: string;
  stockAvailable: number;
  unitPrice: number;
  priceListName?: string;
  hasActivePricing: boolean;
  isSelectable: boolean;
  onViewPricing?: (productId: string) => void;
}

export const ProductAvailabilityIndicator: React.FC<ProductAvailabilityIndicatorProps> = ({
  productId,
  productName,
  stockAvailable,
  unitPrice,
  priceListName,
  hasActivePricing,
  isSelectable,
  onViewPricing,
}) => {
  const getAvailabilityStatus = () => {
    if (stockAvailable === 0) {
      return {
        type: 'out-of-stock',
        icon: X,
        color: 'bg-red-50 border-red-200 text-red-800',
        iconColor: 'text-red-600',
        title: 'Out of Stock',
        message: 'This product is currently out of stock',
        severity: 'error'
      };
    }
    
    if (!hasActivePricing || unitPrice === 0) {
      return {
        type: 'no-pricing',
        icon: DollarSign,
        color: 'bg-yellow-50 border-yellow-200 text-yellow-800',
        iconColor: 'text-yellow-600',
        title: 'No Price Set',
        message: priceListName 
          ? `No price configured in ${priceListName}` 
          : 'No active pricing available',
        severity: 'warning'
      };
    }
    
    if (stockAvailable <= 5) {
      return {
        type: 'low-stock',
        icon: AlertTriangle,
        color: 'bg-orange-50 border-orange-200 text-orange-800',
        iconColor: 'text-orange-600',
        title: 'Low Stock',
        message: `Only ${stockAvailable} units remaining`,
        severity: 'warning'
      };
    }
    
    return {
      type: 'available',
      icon: Check,
      color: 'bg-green-50 border-green-200 text-green-800',
      iconColor: 'text-green-600',
      title: 'Available',
      message: `${stockAvailable} units in stock`,
      severity: 'success'
    };
  };

  const status = getAvailabilityStatus();
  const Icon = status.icon;

  const renderPricingAction = () => {
    if (status.type === 'no-pricing' && onViewPricing) {
      return (
        <button
          onClick={() => onViewPricing(productId)}
          className="inline-flex items-center space-x-1 text-xs text-blue-600 hover:text-blue-800 underline"
        >
          <ExternalLink className="h-3 w-3" />
          <span>Manage Pricing</span>
        </button>
      );
    }
    return null;
  };

  if (isSelectable && status.type === 'available') {
    // For available products, show minimal indicator
    return (
      <div className="flex items-center space-x-2 text-sm">
        <Icon className={`h-4 w-4 ${status.iconColor}`} />
        <span className="text-green-600 font-medium">{formatCurrencySync(unitPrice)}</span>
        <span className="text-gray-500">• {stockAvailable} available</span>
      </div>
    );
  }

  // For problematic products, show detailed warning
  return (
    <div className={`border rounded-lg p-3 ${status.color}`}>
      <div className="flex items-start space-x-3">
        <Icon className={`h-5 w-5 ${status.iconColor} flex-shrink-0 mt-0.5`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">{status.title}</h4>
            {status.severity === 'error' && (
              <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">
                Unavailable
              </span>
            )}
            {status.severity === 'warning' && (
              <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded">
                Limited
              </span>
            )}
          </div>
          <p className="text-sm mt-1">{status.message}</p>
          
          {/* Additional Details */}
          <div className="mt-2 space-y-1">
            {unitPrice > 0 && (
              <div className="text-sm">
                <span className="font-medium">Price: </span>
                <span>{formatCurrencySync(unitPrice)}</span>
                {priceListName && (
                  <span className="text-gray-600"> (from {priceListName})</span>
                )}
              </div>
            )}
            
            {stockAvailable > 0 && (
              <div className="text-sm">
                <span className="font-medium">Stock: </span>
                <span>{stockAvailable} units available</span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="mt-3 flex items-center space-x-3">
            {renderPricingAction()}
            
            {status.type === 'out-of-stock' && (
              <span className="text-xs text-gray-600">
                Contact admin to restock this item
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Tooltip component for additional information
interface ProductTooltipProps {
  productName: string;
  stockAvailable: number;
  unitPrice: number;
  hasActivePricing: boolean;
  priceListName?: string;
}

export const ProductTooltip: React.FC<ProductTooltipProps> = ({
  productName,
  stockAvailable,
  unitPrice,
  hasActivePricing,
  priceListName,
}) => {
  return (
    <div className="bg-gray-900 text-white text-xs rounded-lg p-3 max-w-xs">
      <div className="font-medium mb-2">{productName}</div>
      
      <div className="space-y-1">
        <div className="flex justify-between">
          <span>Stock:</span>
          <span className={stockAvailable === 0 ? 'text-red-300' : 'text-green-300'}>
            {stockAvailable === 0 ? 'Out of stock' : `${stockAvailable} available`}
          </span>
        </div>
        
        <div className="flex justify-between">
          <span>Price:</span>
          <span className={!hasActivePricing || unitPrice === 0 ? 'text-yellow-300' : 'text-white'}>
            {!hasActivePricing || unitPrice === 0 
              ? 'Not set' 
              : formatCurrencySync(unitPrice)
            }
          </span>
        </div>
        
        {priceListName && (
          <div className="text-gray-300 text-xs mt-1">
            From: {priceListName}
          </div>
        )}
      </div>
      
      {(!hasActivePricing || unitPrice === 0 || stockAvailable === 0) && (
        <div className="mt-2 pt-2 border-t border-gray-700">
          <div className="flex items-center space-x-1 text-yellow-300">
            <Info className="h-3 w-3" />
            <span>Cannot be added to orders</span>
          </div>
        </div>
      )}
    </div>
  );
}; 