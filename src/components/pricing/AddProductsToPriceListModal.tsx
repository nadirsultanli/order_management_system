import React, { useState, useEffect } from 'react';
import { X, Loader2, Package, Search } from 'lucide-react';
import { useProducts } from '../../hooks/useProducts';
import { usePriceListItemsNew } from '../../hooks/usePricing';
import { PriceList } from '../../types/pricing';
import { formatCurrencySync, calculateFinalPriceSync } from '../../utils/pricing';

interface ProductPrice {
  productId: string;
  productName: string;
  productSku: string;
  unitPrice: number;
  minQty: number;
  surchargeRate?: number;
}

interface AddProductsToPriceListModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (productPrices: ProductPrice[]) => void;
  priceList: PriceList;
  loading?: boolean;
}

export const AddProductsToPriceListModal: React.FC<AddProductsToPriceListModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  priceList,
  loading = false,
}) => {
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [productPrices, setProductPrices] = useState<{ [key: string]: ProductPrice }>({});
  const [searchTerm, setSearchTerm] = useState('');

  const { data: productsData } = useProducts({ limit: 1000 });
  const { data: existingItemsData } = usePriceListItemsNew(priceList.id);

  const allProducts = productsData?.products || [];
  const existingItems = existingItemsData?.items || [];
  const existingProductIds = existingItems.map(item => item.product_id);
  
  // Filter out products already in the price list
  const availableProducts = allProducts.filter(
    product => 
      product.status === 'active' && 
      !existingProductIds.includes(product.id) &&
      (searchTerm === '' || 
       product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
       product.sku.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  useEffect(() => {
    if (!isOpen) {
      setSelectedProducts([]);
      setProductPrices({});
      setSearchTerm('');
    }
  }, [isOpen]);

  const handleProductSelect = (productId: string, selected: boolean) => {
    if (selected) {
      const product = availableProducts.find(p => p.id === productId);
      if (product) {
        setSelectedProducts(prev => [...prev, productId]);
        setProductPrices(prev => ({
          ...prev,
          [productId]: {
            productId,
            productName: product.name,
            productSku: product.sku,
            unitPrice: 0,
            minQty: 1,
            surchargeRate: undefined,
          }
        }));
      }
    } else {
      setSelectedProducts(prev => prev.filter(id => id !== productId));
      setProductPrices(prev => {
        const newPrices = { ...prev };
        delete newPrices[productId];
        return newPrices;
      });
    }
  };

  const handlePriceChange = (productId: string, field: keyof ProductPrice, value: any) => {
    setProductPrices(prev => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        [field]: value,
      }
    }));
  };

  const handleSubmit = () => {
    const validPrices = Object.values(productPrices).filter(
      price => price.unitPrice > 0
    );
    
    if (validPrices.length === 0) {
      return;
    }

    onSubmit(validPrices);
  };

  const canSubmit = selectedProducts.length > 0 && 
    selectedProducts.every(id => productPrices[id]?.unitPrice > 0);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose} />
        
        <div className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-4xl">
          <div className="bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold leading-6 text-gray-900">
                Add Products to: {priceList.name}
              </h3>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Search */}
              <div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search products by name or SKU..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Product Selection */}
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-3">
                  Select Products ({availableProducts.length} available)
                </h4>
                <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-lg">
                  {availableProducts.length > 0 ? (
                    <div className="divide-y divide-gray-200">
                      {availableProducts.map((product) => (
                        <div key={product.id} className="p-3 hover:bg-gray-50">
                          <label className="flex items-center space-x-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedProducts.includes(product.id)}
                              onChange={(e) => handleProductSelect(product.id, e.target.checked)}
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            <div className="flex-1">
                              <div className="text-sm font-medium text-gray-900">
                                {product.name}
                              </div>
                              <div className="text-sm text-gray-500">
                                SKU: {product.sku} • {product.unit_of_measure}
                                {product.capacity_kg && ` • ${product.capacity_kg}kg`}
                              </div>
                            </div>
                          </label>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center">
                      <Package className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-gray-500">
                        {searchTerm ? 'No products found matching your search.' : 'All products are already in this price list.'}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Price Configuration */}
              {selectedProducts.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-3">
                    Set Prices for Selected Products
                  </h4>
                  <div className="space-y-4 max-h-80 overflow-y-auto">
                    {selectedProducts.map((productId) => {
                      const productPrice = productPrices[productId];
                      if (!productPrice) return null;

                      return (
                        <div key={productId} className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                          <div className="mb-3">
                            <h5 className="font-medium text-gray-900">{productPrice.productName}</h5>
                            <p className="text-sm text-gray-500">SKU: {productPrice.productSku}</p>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Unit Price ({priceList.currency_code}) *
                              </label>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={productPrice.unitPrice || ''}
                                onChange={(e) => handlePriceChange(productId, 'unitPrice', parseFloat(e.target.value) || 0)}
                                className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                placeholder="0.00"
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Minimum Quantity
                              </label>
                              <input
                                type="number"
                                min="1"
                                value={productPrice.minQty}
                                onChange={(e) => handlePriceChange(productId, 'minQty', parseInt(e.target.value) || 1)}
                                className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Surcharge (%)
                              </label>
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="0.1"
                                value={productPrice.surchargeRate || ''}
                                onChange={(e) => handlePriceChange(productId, 'surchargeRate', parseFloat(e.target.value) || undefined)}
                                className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                placeholder="0.0"
                              />
                            </div>
                          </div>

                          {productPrice.unitPrice > 0 && (
                            <div className="mt-3 p-2 bg-blue-50 rounded">
                              <span className="text-sm text-blue-800">
                                Final Price: {formatCurrencySync(
                                  calculateFinalPriceSync(productPrice.unitPrice, productPrice.surchargeRate),
                                  priceList.currency_code
                                )}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
            <button
              onClick={handleSubmit}
              disabled={loading || !canSubmit}
              className="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:ml-3 sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="flex items-center space-x-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Adding...</span>
                </div>
              ) : (
                `Add ${selectedProducts.length} Product${selectedProducts.length !== 1 ? 's' : ''}`
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};