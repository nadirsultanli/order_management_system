import React from 'react';
import { 
  Package, 
  Scale, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  TrendingUp,
  Truck
} from 'lucide-react';
import { 
  TransferSummary as TransferSummaryType, 
  TransferValidationResult, 
  MultiSkuTransferItem 
} from '../../types/transfer';
import { formatValidationErrors } from '../../utils/transfer-validation';

interface TransferSummaryProps {
  summary: TransferSummaryType | null;
  validationResult: TransferValidationResult | null;
  selectedItems: MultiSkuTransferItem[];
  onRemoveItem?: (productId: string, variantName?: string) => void;
  showItemDetails?: boolean;
}

export const TransferSummary: React.FC<TransferSummaryProps> = ({
  summary,
  validationResult,
  selectedItems,
  onRemoveItem,
  showItemDetails = true
}) => {
  if (!summary || selectedItems.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="text-center text-gray-500">
          <Package className="h-8 w-8 mx-auto mb-2 text-gray-400" />
          <p>No items selected for transfer</p>
        </div>
      </div>
    );
  }

  const validationMessages = validationResult ? formatValidationErrors(validationResult) : [];
  const hasErrors = validationResult && !validationResult.is_valid;
  const hasWarnings = validationResult && validationResult.warnings.length > 0;

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Items */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center">
            <Package className="h-5 w-5 text-blue-500 mr-2" />
            <div>
              <p className="text-xs text-gray-600">Total Items</p>
              <p className="text-lg font-semibold text-gray-900">
                {summary.total_products}
              </p>
            </div>
          </div>
        </div>

        {/* Total Quantity */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center">
            <TrendingUp className="h-5 w-5 text-green-500 mr-2" />
            <div>
              <p className="text-xs text-gray-600">Total Quantity</p>
              <p className="text-lg font-semibold text-gray-900">
                {summary.total_quantity}
              </p>
            </div>
          </div>
        </div>

        {/* Total Weight */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center">
            <Scale className="h-5 w-5 text-purple-500 mr-2" />
            <div>
              <p className="text-xs text-gray-600">Total Weight</p>
              <p className="text-lg font-semibold text-gray-900">
                {summary.total_weight_kg.toFixed(1)}kg
              </p>
            </div>
          </div>
        </div>

        {/* Variants */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center">
            <Truck className="h-5 w-5 text-orange-500 mr-2" />
            <div>
              <p className="text-xs text-gray-600">Variants</p>
              <p className="text-lg font-semibold text-gray-900">
                {summary.unique_variants}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Validation Status */}
      {validationResult && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center mb-3">
            {hasErrors ? (
              <XCircle className="h-5 w-5 text-red-500 mr-2" />
            ) : hasWarnings ? (
              <AlertTriangle className="h-5 w-5 text-yellow-500 mr-2" />
            ) : (
              <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
            )}
            <h3 className="text-lg font-semibold text-gray-900">
              Validation Status
            </h3>
          </div>

          {/* Validation Summary */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">
                {summary.validation_summary.valid_items}
              </p>
              <p className="text-sm text-gray-600">Valid Items</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-red-600">
                {summary.validation_summary.invalid_items}
              </p>
              <p className="text-sm text-gray-600">Invalid Items</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-yellow-600">
                {summary.validation_summary.items_with_warnings}
              </p>
              <p className="text-sm text-gray-600">Warnings</p>
            </div>
          </div>

          {/* Validation Messages */}
          {validationMessages.length > 0 && (
            <div className="space-y-2">
              {validationMessages.map((message, index) => (
                <div
                  key={index}
                  className={`flex items-start p-3 rounded-md ${
                    message.severity === 'error'
                      ? 'bg-red-50 border border-red-200'
                      : 'bg-yellow-50 border border-yellow-200'
                  }`}
                >
                  {message.severity === 'error' ? (
                    <XCircle className="h-4 w-4 text-red-500 mr-2 mt-0.5 flex-shrink-0" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-yellow-500 mr-2 mt-0.5 flex-shrink-0" />
                  )}
                  <span
                    className={`text-sm ${
                      message.severity === 'error' ? 'text-red-700' : 'text-yellow-700'
                    }`}
                  >
                    {message.message}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Item Details */}
      {showItemDetails && (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Selected Items</h3>
          </div>
          <div className="p-4">
            <div className="space-y-3">
              {selectedItems.map((item, index) => (
                <div
                  key={`${item.product_id}-${item.variant_name || 'default'}`}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    item.is_valid
                      ? 'border-green-200 bg-green-50'
                      : 'border-red-200 bg-red-50'
                  }`}
                >
                  <div className="flex-1">
                    <div className="flex items-center mb-1">
                      <h4 className="font-medium text-gray-900 mr-2">
                        {item.product_name}
                      </h4>
                      {item.variant_name && (
                        <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                          {item.variant_name}
                        </span>
                      )}
                      {!item.is_valid && (
                        <XCircle className="h-4 w-4 text-red-500 ml-2" />
                      )}
                    </div>
                    
                    <div className="text-sm text-gray-600">
                      <span>SKU: {item.product_sku}</span>
                      <span className="mx-2">•</span>
                      <span>Qty: {item.quantity_to_transfer}</span>
                      {item.total_weight_kg && (
                        <>
                          <span className="mx-2">•</span>
                          <span>Weight: {item.total_weight_kg.toFixed(1)}kg</span>
                        </>
                      )}
                    </div>

                    <div className="text-xs text-gray-500 mt-1">
                      Available: {item.available_stock}
                      {item.reserved_stock && item.reserved_stock > 0 && (
                        <span> • Reserved: {item.reserved_stock}</span>
                      )}
                    </div>

                    {/* Item validation messages */}
                    {(item.validation_errors.length > 0 || item.validation_warnings.length > 0) && (
                      <div className="mt-2 space-y-1">
                        {item.validation_errors.map((error, errorIndex) => (
                          <div key={errorIndex} className="text-xs text-red-600 flex items-center">
                            <XCircle className="h-3 w-3 mr-1" />
                            {error}
                          </div>
                        ))}
                        {item.validation_warnings.map((warning, warningIndex) => (
                          <div key={warningIndex} className="text-xs text-yellow-600 flex items-center">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            {warning}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Remove Button */}
                  {onRemoveItem && (
                    <button
                      onClick={() => onRemoveItem(item.product_id, item.variant_name)}
                      className="ml-4 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full"
                      title="Remove item"
                    >
                      <XCircle className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Additional Information */}
      {(summary.heaviest_item || summary.most_expensive_item) && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Additional Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {summary.heaviest_item && (
              <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                <div className="flex items-center mb-2">
                  <Scale className="h-4 w-4 text-purple-500 mr-2" />
                  <span className="font-medium text-purple-700">Heaviest Item</span>
                </div>
                <p className="text-sm text-purple-600">
                  {summary.heaviest_item.product_name} - {summary.heaviest_item.total_weight_kg?.toFixed(1)}kg
                </p>
              </div>
            )}

            {summary.most_expensive_item && summary.total_cost && (
              <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center mb-2">
                  <TrendingUp className="h-4 w-4 text-green-500 mr-2" />
                  <span className="font-medium text-green-700">Most Expensive Item</span>
                </div>
                <p className="text-sm text-green-600">
                  {summary.most_expensive_item.product_name} - ${summary.most_expensive_item.total_cost?.toFixed(2)}
                </p>
              </div>
            )}
          </div>

          {summary.total_cost && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center justify-between">
                <span className="font-medium text-blue-700">Estimated Total Cost</span>
                <span className="text-lg font-bold text-blue-900">
                  ${summary.total_cost.toFixed(2)}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}; 