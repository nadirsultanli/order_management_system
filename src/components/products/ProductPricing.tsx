import React from 'react';
import { useNavigate } from 'react-router-dom';
import { DollarSign, ArrowRight, Info } from 'lucide-react';
import { useProductPriceListItemsNew } from '../../hooks/usePricing';

interface ProductPricingProps {
  productId: string;
}

export const ProductPricing: React.FC<ProductPricingProps> = ({ productId }) => {
  const navigate = useNavigate();
  
  // Get price list items for this specific product (for display only)
  const { data: productPriceListItems = [], isLoading } = useProductPriceListItemsNew(productId);
  
  const handleGoToPricing = () => {
    navigate('/pricing');
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">
          Product Pricing
        </h3>
      </div>

      <div className="p-6">
        {/* Informational Message */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-start space-x-3">
            <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-medium text-blue-900 mb-1">
                Pricing Management Centralized
              </h4>
              <p className="text-sm text-blue-700 mb-3">
                All product pricing is now managed in the dedicated Pricing section. When you add a parent product to a price list, all its variants automatically inherit the same pricing.
              </p>
              <button
                onClick={handleGoToPricing}
                className="inline-flex items-center space-x-2 text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                <span>Go to Pricing Section</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Current Pricing Display (Read-only) */}
        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-sm text-gray-500">Loading pricing information...</p>
          </div>
        ) : productPriceListItems.length > 0 ? (
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-3">
              Current Pricing ({productPriceListItems.length} price list{productPriceListItems.length !== 1 ? 's' : ''})
            </h4>
            <div className="overflow-hidden border border-gray-200 rounded-lg">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Price List
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Price
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {productPriceListItems.map((item: any) => (
                    <tr key={item.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{item.price_list?.name}</div>
                        {item.inherited_from_parent && (
                          <div className="text-xs text-blue-600">Inherited from parent product</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {item.effective_price ? `KES ${item.effective_price}` : 'N/A'}
                        </div>
                        {item.pricing_method === 'per_kg' && (
                          <div className="text-xs text-gray-500">per kg</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          item.price_list?.status?.status === 'active' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {item.price_list?.status?.status || 'Unknown'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <DollarSign className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <h4 className="text-sm font-medium text-gray-900 mb-1">No Pricing Configured</h4>
            <p className="text-sm text-gray-500 mb-4">
              This product is not yet in any price list. Add it through the Pricing section.
            </p>
            <button
              onClick={handleGoToPricing}
              className="inline-flex items-center space-x-2 px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <DollarSign className="h-4 w-4" />
              <span>Manage Pricing</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};