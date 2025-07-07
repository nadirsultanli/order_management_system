import React, { useState } from 'react';
import { Edit, Plus, DollarSign } from 'lucide-react';
import { usePriceListsNew, useCreatePriceListItemNew, useUpdatePriceListItemNew, useProductPriceListItemsNew } from '../../hooks/usePricing';
import { PriceListItem, CreatePriceListItemData } from '../../types/pricing';
import { formatCurrencySync, calculateFinalPriceSync, getPriceListStatusSync } from '../../utils/pricing';
import { PriceListItemForm } from '../pricing/PriceListItemForm';

interface ProductPricingProps {
  productId: string;
}

export const ProductPricing: React.FC<ProductPricingProps> = ({ productId }) => {
  // All hooks must be called at the top level, before any conditional logic
  const [selectedPriceList, setSelectedPriceList] = useState<string | null>(null);
  const [showAddPriceModal, setShowAddPriceModal] = useState(false);
  const [editingItem, setEditingItem] = useState<PriceListItem | null>(null);

  // Get all price lists
  const { data: priceLists = { priceLists: [] } } = usePriceListsNew();
  const allPriceLists = priceLists.priceLists || [];
  
  // Get price list items for this specific product
  const { data: productPriceListItems = [], isLoading, error } = useProductPriceListItemsNew(productId);
  
  // Create a map to store price list items by price list ID for easier lookup
  const productPricesMap: { [key: string]: PriceListItem[] } = {};
  productPriceListItems.forEach((item: any) => {
    if (!productPricesMap[item.price_list_id]) {
      productPricesMap[item.price_list_id] = [];
    }
    productPricesMap[item.price_list_id].push(item);
  });
  
  // Mutation hooks
  const createPriceListItem = useCreatePriceListItemNew();
  const updatePriceListItem = useUpdatePriceListItemNew();

  // After all hooks are called, we can use conditional logic
  const handleAddPrice = (priceListId: string) => {
    setSelectedPriceList(priceListId);
    setEditingItem(null);
    setShowAddPriceModal(true);
  };

  const handleEditPrice = (item: PriceListItem) => {
    setSelectedPriceList(item.price_list_id);
    setEditingItem(item);
    setShowAddPriceModal(true);
  };

  const handlePriceSubmit = async (data: CreatePriceListItemData) => {
    try {
      if (editingItem) {
        await updatePriceListItem.mutateAsync({ 
          id: editingItem.id, 
          ...data 
        });
      } else {
        await createPriceListItem.mutateAsync({ ...data, product_id: productId });
      }
      setShowAddPriceModal(false);
      setEditingItem(null);
    } catch (error) {
      // Error handling is done in the hooks
    }
  };

  // Get price lists where this product doesn't have a price yet
  const usedPriceListIds = productPriceListItems.map((item: any) => item.price_list_id);
  const availablePriceLists = allPriceLists.filter(
    list => !usedPriceListIds.includes(list.id)
  );

  const today = new Date().toISOString().split('T')[0];
  const activePriceLists = allPriceLists.filter(list => {
    const status = getPriceListStatusSync(list.start_date, list.end_date);
    return status.status === 'active';
  });

  const hasNoPrices = productPriceListItems.length === 0;
  const hasNoActivePrices = !productPriceListItems.some((item: any) => 
    item.price_list.status === 'active'
  );

  return (
    <div className="space-y-6">
      {/* Warning if no prices */}
      {(hasNoPrices || hasNoActivePrices) && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <DollarSign className="h-5 w-5 text-yellow-600" />
            <div>
              <h3 className="text-sm font-medium text-yellow-800">
                {hasNoPrices ? 'No Pricing Defined' : 'No Active Pricing'}
              </h3>
              <p className="text-sm text-yellow-700">
                {hasNoPrices 
                  ? 'This product has no pricing defined in any price list.' 
                  : 'This product has pricing defined, but not in any active price list.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Current Prices */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">
            Current Pricing
          </h3>
          {availablePriceLists.length > 0 && (
            <div className="relative">
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) handleAddPrice(e.target.value);
                }}
                className="appearance-none bg-blue-600 text-white px-3 py-1 pr-8 rounded text-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                <option value="">Add to Price List...</option>
                {availablePriceLists.map(list => (
                  <option key={list.id} value={list.id}>{list.name}</option>
                ))}
              </select>
              <Plus className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white pointer-events-none" />
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-500">Loading pricing information...</p>
          </div>
        ) : productPriceListItems.length === 0 ? (
          <div className="p-8 text-center">
            <DollarSign className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">No pricing defined for this product</p>
            {availablePriceLists.length > 0 && (
              <button
                onClick={() => handleAddPrice(availablePriceLists[0].id)}
                className="text-blue-600 hover:text-blue-800 font-medium"
              >
                Add pricing to a price list
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Price List
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Unit Price
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tax Info
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Min Qty
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Surcharge
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Final Price
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {productPriceListItems.map((item: any) => {
                  const priceList = item.price_list;
                  const finalPrice = calculateFinalPriceSync(item.unit_price, item.surcharge_pct);
                  
                  return (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium text-gray-900">
                            {priceList.name}
                          </span>
                          {priceList.is_default && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Default
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${priceList.statusInfo.color}`}>
                          {priceList.statusInfo.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <span className="text-sm font-medium text-gray-900">
                          {formatCurrencySync(item.unit_price)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="text-sm text-gray-900">
                          {item.price_excluding_tax && item.tax_amount ? (
                            <>
                              <div className="text-xs text-gray-500">Ex-tax: {formatCurrencySync(item.price_excluding_tax)}</div>
                              <div className="text-xs text-gray-500">Tax: {formatCurrencySync(item.tax_amount)}</div>
                              <div className="font-medium">Inc-tax: {formatCurrencySync(item.price_including_tax || item.unit_price)}</div>
                            </>
                          ) : (
                            <div className="text-xs text-gray-500">Tax calculated</div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className="text-sm text-gray-900">{item.min_qty}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className="text-sm text-gray-900">
                          {item.surcharge_pct ? `${item.surcharge_pct}%` : '-'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <span className="text-sm font-medium text-green-600">
                          {formatCurrencySync(finalPrice)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleEditPrice(item)}
                          className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-50 transition-colors"
                          title="Edit price"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Price Modal */}
      {showAddPriceModal && selectedPriceList && (
        <PriceListItemForm
          isOpen={showAddPriceModal}
          onClose={() => {
            setShowAddPriceModal(false);
            setEditingItem(null);
          }}
          onSubmit={handlePriceSubmit}
          priceListId={selectedPriceList}
          item={editingItem || undefined}
          loading={createPriceListItem.isPending}
          title={editingItem ? 'Edit Product Price' : 'Add Product to Price List'}
        />
      )}
    </div>
  );
};