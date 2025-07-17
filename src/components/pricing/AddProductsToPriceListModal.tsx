    import React, { useState, useEffect } from 'react';
    import { X, Loader2, Package, Search, Users } from 'lucide-react';
    import { useProducts, useProductOptions } from '../../hooks/useProducts';
    import { usePriceListItemsNew } from '../../hooks/usePricing';
    import { PriceList } from '../../types/pricing';
    import { formatCurrencySync, calculateFinalPriceSync } from '../../utils/pricing';
    import { PricingMethodSelector, PricingMethod } from './PricingMethodSelector';

    interface ProductPrice {
      productId: string;
      productName: string;
      productSku: string;
      unitPrice?: number;
      pricePerKg?: number;
      surchargeRate?: number;
      pricingMethod: PricingMethod;
      isVariant?: boolean;
      parentProductId?: string;
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
      const [includeVariants, setIncludeVariants] = useState(true);

      // Get parent products only (not variants)
      const { data: parentProductsData } = useProductOptions({ include_variants: false });
      // Get all products including variants for variant lookup
      const { data: allProductsData } = useProducts({ limit: 1000 });
      const { data: existingItemsData } = usePriceListItemsNew(priceList.id);

      const parentProducts = parentProductsData || [];
      const allProducts = allProductsData?.products || [];
      const existingItems = existingItemsData?.items || [];
      const existingProductIds = existingItems.map((item: any) => item.product_id);
      
      // Create a map of parent products to their variants
      const parentVariantMap = React.useMemo(() => {
        const map: { [parentId: string]: any[] } = {};
        allProducts.forEach(product => {
          if (product.is_variant && product.parent_products_id) {
            if (!map[product.parent_products_id]) {
              map[product.parent_products_id] = [];
            }
            map[product.parent_products_id].push(product);
          }
        });
        return map;
      }, [allProducts]);
      
      // Filter out products already in the price list
      const availableProducts = parentProducts.filter(
        (product: any) => 
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

      const handleProductSelect = (parentProductId: string, selected: boolean) => {
        if (selected) {
          const parentProduct = availableProducts.find((p: any) => p.id === parentProductId);
          if (parentProduct) {
            // Add parent product
            const newSelectedProducts = [parentProductId];
            const newProductPrices: { [key: string]: ProductPrice } = {};
            
            // Add parent product pricing
            newProductPrices[parentProductId] = {
              productId: parentProductId,
              productName: parentProduct.name,
              productSku: parentProduct.sku,
              unitPrice: priceList.pricing_method === 'per_unit' ? undefined : undefined,
              pricePerKg: priceList.pricing_method === 'per_kg' ? undefined : undefined,
              surchargeRate: undefined,
              pricingMethod: (priceList.pricing_method || 'per_unit') as PricingMethod,
              isVariant: false,
            };

            // Add variants if includeVariants is true
            if (includeVariants && parentVariantMap[parentProductId]) {
              parentVariantMap[parentProductId].forEach(variant => {
                // Only add if variant is not already in price list
                if (!existingProductIds.includes(variant.id)) {
                  newSelectedProducts.push(variant.id);
                  newProductPrices[variant.id] = {
                    productId: variant.id,
                    productName: variant.name,
                    productSku: variant.sku,
                    unitPrice: priceList.pricing_method === 'per_unit' ? undefined : undefined,
                    pricePerKg: priceList.pricing_method === 'per_kg' ? undefined : undefined,
                    surchargeRate: undefined,
                    pricingMethod: (priceList.pricing_method || 'per_unit') as PricingMethod,
                    isVariant: true,
                    parentProductId: parentProductId,
                  };
                }
              });
            }

            setSelectedProducts(prev => [...prev, ...newSelectedProducts]);
            setProductPrices(prev => ({ ...prev, ...newProductPrices }));
          }
        } else {
          // Remove parent product and all its variants
          const parentProduct = availableProducts.find((p: any) => p.id === parentProductId);
          if (parentProduct) {
            const toRemove = [parentProductId];
            
            // Add variant IDs to remove
            if (parentVariantMap[parentProductId]) {
              toRemove.push(...parentVariantMap[parentProductId].map(v => v.id));
            }

            setSelectedProducts(prev => prev.filter(id => !toRemove.includes(id)));
            setProductPrices(prev => {
              const newPrices = { ...prev };
              toRemove.forEach(id => delete newPrices[id]);
              return newPrices;
            });
          }
        }
      };

      const handlePriceChange = (productId: string, field: keyof ProductPrice, value: any) => {
        const product = productPrices[productId];
        if (!product) return;

        // If this is a parent product, also update all its variants
        if (!product.isVariant && includeVariants && parentVariantMap[productId]) {
          const updatedPrices: { [key: string]: ProductPrice } = {};
          
          // Update parent
          updatedPrices[productId] = {
            ...product,
            [field]: value,
          };
          
          // Update all variants with the same pricing
          parentVariantMap[productId].forEach(variant => {
            if (productPrices[variant.id]) {
              updatedPrices[variant.id] = {
                ...productPrices[variant.id],
                [field]: value,
              };
            }
          });
          
          setProductPrices(prev => ({ ...prev, ...updatedPrices }));
        } else {
          // Update single product
          setProductPrices(prev => ({
            ...prev,
            [productId]: {
              ...prev[productId],
              [field]: value,
            }
          }));
        }
      };

      const handleSubmit = () => {
    const validPrices = Object.values(productPrices)
      .filter(price => {
        if (price.pricingMethod === 'per_unit') {
          return price.unitPrice && price.unitPrice > 0;
        } else if (price.pricingMethod === 'per_kg') {
          return price.pricePerKg && price.pricePerKg > 0;
        }
        return false;
      })
      .map(price => {
        // Format the data to match backend expectations
        if (price.pricingMethod === 'per_unit') {
          return {
            productId: price.productId,
            productName: price.productName,
            productSku: price.productSku,
            unitPrice: price.unitPrice,
            surchargeRate: price.surchargeRate,
            pricingMethod: price.pricingMethod,
            pricePerKg: undefined
          };
        } else if (price.pricingMethod === 'per_kg') {
          return {
            productId: price.productId,
            productName: price.productName,
            productSku: price.productSku,
            pricePerKg: price.pricePerKg,
            surchargeRate: price.surchargeRate,
            pricingMethod: price.pricingMethod,
            unitPrice: undefined
          };
        }
        return price;
      });
    
    if (validPrices.length === 0) {
      return;
    }

    onSubmit(validPrices);
  };

      const canSubmit = selectedProducts.length > 0 && 
        selectedProducts.every(id => {
          const price = productPrices[id];
          if (!price) return false;
          
          if (price.pricingMethod === 'per_unit') {
            return price.unitPrice && price.unitPrice > 0;
          } else if (price.pricingMethod === 'per_kg') {
            return price.pricePerKg && price.pricePerKg > 0;
          }
          return false;
        });

      // Group selected products by parent
      const selectedParentProducts = selectedProducts.filter(id => {
        const price = productPrices[id];
        return price && !price.isVariant;
      });

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

                  {/* Include Variants Toggle */}
                  <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <Users className="h-5 w-5 text-blue-600" />
                      <div>
                        <div className="text-sm font-medium text-blue-900">Include Product Variants</div>
                        <div className="text-xs text-blue-700">Automatically add all variants with the same pricing</div>
                      </div>
                    </div>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={includeVariants}
                        onChange={(e) => setIncludeVariants(e.target.checked)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                    </label>
                  </div>

                  {/* Product Selection */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 mb-3">
                      Select Parent Products ({availableProducts.length} available)
                    </h4>
                    <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-lg">
                      {availableProducts.length > 0 ? (
                        <div className="divide-y divide-gray-200">
                          {availableProducts.map((product: any) => (
                            <div key={product.id} className="p-3 hover:bg-gray-50">
                              <label className="flex items-center space-x-3 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={selectedProducts.includes(product.id)}
                                  onChange={(e) => handleProductSelect(product.id, e.target.checked)}
                                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                />
                                <div className="flex-1">
                                  <div className="flex items-center space-x-2">
                                    <div className="text-sm font-medium text-gray-900">
                                      {product.name}
                                    </div>
                                    {includeVariants && parentVariantMap[product.id] && (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                        +{parentVariantMap[product.id].length} variants
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    SKU: {product.sku} • {product.unit_of_measure}
                                    {product.capacity_kg && priceList.pricing_method === 'per_unit' && ` • ${product.capacity_kg}kg`}
                                    {product.capacity_kg && priceList.pricing_method === 'per_kg' && ` • ${product.capacity_kg}kg capacity`}
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
                        Set Prices for Selected Products ({priceList.pricing_method === 'per_unit' ? 'Per Unit' : 'Per KG'} Pricing)
                      </h4>
                      <div className="text-sm text-blue-600 mb-3">
                        {includeVariants && selectedParentProducts.length > 0 && (
                          <>Setting price for parent products will automatically apply to all their variants</>
                        )}
                      </div>
                      <div className="space-y-4 max-h-80 overflow-y-auto">
                        {selectedParentProducts.map((parentId) => {
                          const parentPrice = productPrices[parentId];
                          if (!parentPrice) return null;

                          const variants = selectedProducts.filter(id => {
                            const price = productPrices[id];
                            return price && price.isVariant && price.parentProductId === parentId;
                          });

                          return (
                            <div key={parentId} className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                              <div className="mb-3">
                                <h5 className="font-medium text-gray-900 flex items-center space-x-2">
                                  <span>{parentPrice.productName}</span>
                                  {variants.length > 0 && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                      +{variants.length} variants
                                    </span>
                                  )}
                                </h5>
                                <p className="text-sm text-gray-500">SKU: {parentPrice.productSku}</p>
                                {variants.length > 0 && (
                                  <div className="mt-2 text-xs text-gray-600">
                                    Variants: {variants.map(id => productPrices[id]?.productSku).join(', ')}
                                  </div>
                                )}
                              </div>
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                {parentPrice.pricingMethod === 'per_unit' && (
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                      Unit Price ({priceList.currency_code}) *
                                    </label>
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={parentPrice.unitPrice || ''}
                                      onChange={(e) => handlePriceChange(parentId, 'unitPrice', e.target.value === '' ? undefined : parseFloat(e.target.value))}
                                      className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                      placeholder="0.00"
                                    />
                                  </div>
                                )}

                                {parentPrice.pricingMethod === 'per_kg' && (
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                      Price per KG ({priceList.currency_code}) *
                                    </label>
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={parentPrice.pricePerKg || ''}
                                      onChange={(e) => handlePriceChange(parentId, 'pricePerKg', e.target.value === '' ? undefined : parseFloat(e.target.value))}
                                      className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                      placeholder="0.00"
                                    />
                                  </div>
                                )}

                                <div>
                                  <PricingMethodSelector
                                    value={parentPrice.pricingMethod}
                                    onChange={(method) => handlePriceChange(parentId, 'pricingMethod', method)}
                                    className="mb-0"
                                    disabled={true}
                                  />
                                </div>
                              </div>

                              {/* Surcharge field for both pricing methods */}
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Surcharge (%)
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="0.1"
                                  value={parentPrice.surchargeRate || ''}
                                  onChange={(e) => handlePriceChange(parentId, 'surchargeRate', e.target.value === '' ? undefined : parseFloat(e.target.value))}
                                  className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                  placeholder="0.0"
                                />
                              </div>

                              {((parentPrice.pricingMethod === 'per_unit' && parentPrice.unitPrice && parentPrice.unitPrice > 0) ||
                                (parentPrice.pricingMethod === 'per_kg' && parentPrice.pricePerKg && parentPrice.pricePerKg > 0)) && (
                                <div className="mt-3 p-2 bg-blue-50 rounded">
                                  <span className="text-sm text-blue-800">
                                    {parentPrice.pricingMethod === 'per_unit' ? (
                                      <>
                                        Final Price: {formatCurrencySync(
                                          calculateFinalPriceSync(
                                            parentPrice.unitPrice || 0,
                                            parentPrice.surchargeRate
                                          ),
                                          priceList.currency_code
                                        )} (per unit)
                                      </>
                                    ) : (
                                      <>
                                        Estimated Price: {formatCurrencySync(
                                          calculateFinalPriceSync(
                                            parentPrice.pricePerKg || 0,
                                            parentPrice.surchargeRate
                                          ),
                                          priceList.currency_code
                                        )} (per kg)
                                        <br />
                                        <span className="text-xs text-blue-600">
                                          Final price will be calculated based on actual gas weight when ordered
                                        </span>
                                      </>
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