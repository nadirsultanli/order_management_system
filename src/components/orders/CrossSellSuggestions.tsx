import React from 'react';
import { Package, Plus, X } from 'lucide-react';
import { Product } from '../../types/product';
import { formatCurrencySync } from '../../utils/pricing';

interface CrossSellSuggestionsProps {
  cylinderProducts: Product[];
  suggestedProducts: Product[];
  onAddProduct: (product: Product) => void;
  onDismiss: () => void;
  getProductPrice: (productId: string) => number;
}

export const CrossSellSuggestions: React.FC<CrossSellSuggestionsProps> = ({
  cylinderProducts,
  suggestedProducts,
  onAddProduct,
  onDismiss,
  getProductPrice,
}) => {
  if (cylinderProducts.length === 0 || suggestedProducts.length === 0) {
    return null;
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-2">
          <Package className="h-5 w-5 text-blue-600" />
          <h3 className="text-lg font-medium text-blue-900">
            Complete Your Setup
          </h3>
        </div>
        <button
          onClick={onDismiss}
          className="text-blue-400 hover:text-blue-600 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      
      <p className="text-sm text-blue-800 mt-2 mb-3">
        You've added {cylinderProducts.length} gas cylinder{cylinderProducts.length > 1 ? 's' : ''} to your order. 
        Consider adding these accessories to complete your setup:
      </p>
      
      <div className="space-y-2">
        {suggestedProducts.map((product) => {
          const price = getProductPrice(product.id);
          
          return (
            <div key={product.id} className="flex items-center justify-between bg-white rounded-lg p-3 border border-blue-200">
              <div className="flex-1">
                <div className="font-medium text-gray-900">{product.name}</div>
                <div className="text-sm text-gray-500">SKU: {product.sku}</div>
                
                {/* Product-specific details */}
                {product.product_type === 'accessory' && (
                  <div className="text-sm text-gray-600 mt-1">
                    <div className="flex flex-wrap gap-2">
                      {product.brand && <span className="text-xs bg-gray-100 px-2 py-1 rounded">Brand: {product.brand}</span>}
                      {product.connection_type && <span className="text-xs bg-gray-100 px-2 py-1 rounded">Connection: {product.connection_type}</span>}
                      {product.outlet_pressure && <span className="text-xs bg-gray-100 px-2 py-1 rounded">Pressure: {product.outlet_pressure}</span>}
                      {product.length_m && <span className="text-xs bg-gray-100 px-2 py-1 rounded">Length: {product.length_m}m</span>}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="flex items-center space-x-3">
                <div className="text-right">
                  <div className="font-medium text-green-600">
                    {formatCurrencySync(price)}
                  </div>
                </div>
                <button
                  onClick={() => onAddProduct(product)}
                  className="flex items-center space-x-1 px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
      
      <div className="mt-3 pt-3 border-t border-blue-200">
        <p className="text-xs text-blue-700">
          💡 These accessories are commonly purchased with gas cylinders and will help ensure your setup is complete.
        </p>
      </div>
    </div>
  );
};