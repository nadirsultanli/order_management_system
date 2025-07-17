import React from 'react';
import { Gauge, AlertTriangle, Package, Info } from 'lucide-react';
import { OrderLine } from '../../types/order';
import { formatCurrencySync } from '../../utils/pricing';

interface OrderLineItemProps {
  orderLine: OrderLine;
  showFillInfo?: boolean;
  compact?: boolean;
  className?: string;
}

export const OrderLineItem: React.FC<OrderLineItemProps> = ({
  orderLine,
  showFillInfo = true,
  compact = false,
  className = ''
}) => {
  const isGasProduct = orderLine.product?.variant_type === 'cylinder' || 
                       orderLine.product?.variant_type === 'refillable' ||
                       orderLine.product?.unit_of_measure === 'cylinder';
  
  const isPartialFill = orderLine.is_partial_fill || (orderLine.fill_percentage && orderLine.fill_percentage < 100);
  const fillPercentage = orderLine.fill_percentage || 100;
  
  const getFillStatusColor = () => {
    if (!isPartialFill) return 'text-green-600';
    if (fillPercentage >= 75) return 'text-blue-600';
    if (fillPercentage >= 50) return 'text-yellow-600';
    if (fillPercentage >= 25) return 'text-orange-600';
    return 'text-red-600';
  };
  
  const getFillBadgeColor = () => {
    if (!isPartialFill) return 'bg-green-100 text-green-800';
    if (fillPercentage >= 75) return 'bg-blue-100 text-blue-800';
    if (fillPercentage >= 50) return 'bg-yellow-100 text-yellow-800';
    if (fillPercentage >= 25) return 'bg-orange-100 text-orange-800';
    return 'bg-red-100 text-red-800';
  };

  if (compact) {
    return (
      <div className={`flex items-center justify-between py-1 ${className}`}>
        <div className="flex items-center space-x-2 flex-1">
          <Package className="h-3 w-3 text-gray-400" />
          <span className="text-sm text-gray-900">{orderLine.product?.name || 'Unknown Product'}</span>
          {isGasProduct && isPartialFill && showFillInfo && (
            <div className="flex items-center space-x-1">
              <Gauge className="h-3 w-3 text-orange-500" />
              <span className="text-xs text-orange-600 font-medium">{fillPercentage}%</span>
            </div>
          )}
        </div>
        <div className="text-sm text-gray-600">
          {orderLine.quantity} × {formatCurrencySync(orderLine.unit_price)}
        </div>
        <div className="text-sm font-medium text-gray-900 min-w-[80px] text-right">
          {formatCurrencySync(orderLine.subtotal || orderLine.quantity * orderLine.unit_price)}
        </div>
      </div>
    );
  }

  return (
    <div className={`border border-gray-200 rounded-lg p-4 space-y-3 ${className}`}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-2">
            <h4 className="font-medium text-gray-900">{orderLine.product?.name || 'Unknown Product'}</h4>
            {isGasProduct && isPartialFill && showFillInfo && (
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getFillBadgeColor()}`}>
                <Gauge className="h-3 w-3 mr-1" />
                {fillPercentage}% Fill
              </span>
            )}
          </div>
          {orderLine.product?.sku && (
            <p className="text-sm text-gray-500">SKU: {orderLine.product.sku}</p>
          )}
        </div>
        <div className="text-right">
          <div className="font-medium text-lg text-gray-900">
            {formatCurrencySync(orderLine.subtotal || orderLine.quantity * orderLine.unit_price)}
          </div>
          <div className="text-sm text-gray-500">
            {orderLine.quantity} × {formatCurrencySync(orderLine.unit_price)}
          </div>
        </div>
      </div>

      {/* Fill Information for Gas Products */}
      {isGasProduct && showFillInfo && (
        <div className="bg-gray-50 rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Gauge className={`h-4 w-4 ${getFillStatusColor()}`} />
              <span className="text-sm font-medium text-gray-700">Fill Level</span>
            </div>
            <span className={`text-sm font-bold ${getFillStatusColor()}`}>
              {fillPercentage}%
            </span>
          </div>
          
          {/* Visual Fill Indicator */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-gray-500">
              <span>0%</span>
              <span>25%</span>
              <span>50%</span>
              <span>75%</span>
              <span>100%</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  fillPercentage >= 100 ? 'bg-green-500' :
                  fillPercentage >= 75 ? 'bg-blue-500' :
                  fillPercentage >= 50 ? 'bg-yellow-500' :
                  fillPercentage >= 25 ? 'bg-orange-500' :
                  'bg-red-500'
                }`}
                style={{ width: `${Math.max(0, Math.min(100, fillPercentage))}%` }}
              />
            </div>
          </div>

          {isPartialFill && (
            <div className="flex items-start space-x-2 mt-2">
              <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-700">
                <div className="font-medium">Partial Fill Applied</div>
                <div>Gas pricing pro-rated to {fillPercentage}%. Cylinder costs remain at full price.</div>
              </div>
            </div>
          )}

          {orderLine.partial_fill_notes && (
            <div className="flex items-start space-x-2 mt-2 pt-2 border-t border-gray-200">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <div className="font-medium text-gray-700">Fill Notes</div>
                <div className="text-gray-600">{orderLine.partial_fill_notes}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Product Details */}
      {orderLine.product && (
        <div className="text-xs text-gray-500 space-y-1">
          {orderLine.product.unit_of_measure && (
            <div>Unit: {orderLine.product.unit_of_measure}</div>
          )}
          {orderLine.product.variant_type && (
            <div>Type: {orderLine.product.variant_type}</div>
          )}
        </div>
      )}
    </div>
  );
};