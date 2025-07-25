import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { X, Loader2, Plus } from 'lucide-react';
import { PriceListItem, CreatePriceListItemData } from '../../types/pricing';
import { Product } from '../../types/product';
import { useProducts, useProductOptions } from '../../hooks/useProducts';
import { formatCurrencySync, calculateFinalPriceSync } from '../../utils/pricing';

interface PriceListItemFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreatePriceListItemData) => void;
  priceListId: string;
  item?: PriceListItem;
  loading?: boolean;
  title: string;
  existingProductIds?: string[];
  currencyCode?: string;
}

export const PriceListItemForm: React.FC<PriceListItemFormProps> = ({
  isOpen,
  onClose,
  onSubmit,
  priceListId,
  item,
  loading = false,
  title,
  existingProductIds = [],
  currencyCode = 'KES',
}) => {
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [bulkPrice, setBulkPrice] = useState<number>(0);
  const [useBulkPrice, setUseBulkPrice] = useState(false);
  const [pricingMethod, setPricingMethod] = useState<'per_unit' | 'per_kg'>('per_unit');

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreatePriceListItemData>({
    defaultValues: {
      price_list_id: priceListId,
      product_id: '',
      unit_price: 0,
      price_per_kg: 0,
      min_qty: 1,
      surcharge_pct: 0,
      pricing_method: 'per_unit',
      // Tax fields (optional, will be calculated if not provided)
      price_excluding_tax: undefined,
      tax_amount: undefined,
      price_including_tax: undefined,
    },
  });

  const { data: productsData } = useProductOptions({ include_variants: false });
  const products = productsData || [];
  const availableProducts = products.filter((p: any) => 
    !existingProductIds.includes(p.id)
  );

  const watchedPrice = watch('unit_price');
  const watchedSurcharge = watch('surcharge_pct') || 0;

  useEffect(() => {
    if (item) {
      reset({
        price_list_id: item.price_list_id,
        product_id: item.product_id,
        unit_price: item.unit_price,
        price_per_kg: item.price_per_kg,
        min_qty: item.min_qty,
        surcharge_pct: item.surcharge_pct || 0,
        pricing_method: item.pricing_method || 'per_unit',
        price_excluding_tax: item.price_excluding_tax,
        tax_amount: item.tax_amount,
        price_including_tax: item.price_including_tax,
      });
      setPricingMethod(item.pricing_method || 'per_unit');
    } else {
      reset({
        price_list_id: priceListId,
        product_id: '',
        unit_price: 0,
        price_per_kg: 0,
        min_qty: 1,
        surcharge_pct: 0,
        pricing_method: 'per_unit',
        price_excluding_tax: undefined,
        tax_amount: undefined,
        price_including_tax: undefined,
      });
      setPricingMethod('per_unit');
    }
  }, [item, priceListId, reset]);

  const handleFormSubmit = (data: CreatePriceListItemData) => {
    // Ensure numeric conversion for all price fields
    const numericData = {
      ...data,
      unit_price: pricingMethod === 'per_unit' ? parseFloat(data.unit_price?.toString() || '0') : undefined,
      price_per_kg: pricingMethod === 'per_kg' ? parseFloat(data.price_per_kg?.toString() || '0') : undefined,
      min_qty: pricingMethod === 'per_unit' ? parseInt(data.min_qty?.toString() || '1') : 1,
      surcharge_pct: parseFloat(data.surcharge_pct?.toString() || '0'),
      pricing_method: pricingMethod,
    };

    if (item) {
      // Single item edit
      onSubmit(numericData);
    } else if (selectedProducts.length > 0) {
      // Bulk add
      selectedProducts.forEach(productId => {
        onSubmit({
          ...numericData,
          product_id: productId,
          unit_price: useBulkPrice && pricingMethod === 'per_unit' ? parseFloat(bulkPrice.toString()) : numericData.unit_price,
          price_per_kg: useBulkPrice && pricingMethod === 'per_kg' ? parseFloat(bulkPrice.toString()) : numericData.price_per_kg,
        });
      });
    } else {
      // Single item add
      onSubmit(numericData);
    }
  };

  const handleProductToggle = (productId: string) => {
    setSelectedProducts(prev => 
      prev.includes(productId) 
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  // Use sync version for immediate UI feedback
  const calculateFinalPrice = (unitPrice: number, surcharge: number) => {
    return calculateFinalPriceSync(unitPrice, surcharge);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose} />
        
        <div className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg">
          <form onSubmit={handleSubmit(handleFormSubmit)}>
            <div className="bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold leading-6 text-gray-900">
                  {title}
                </h3>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-4">
                {!item && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Products
                    </label>
                    <div className="border border-gray-300 rounded-md p-2 max-h-60 overflow-y-auto">
                      {availableProducts.length === 0 ? (
                        <div className="text-center py-4 text-gray-500">
                          No available products to add
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {availableProducts.map((product: Product) => (
                            <div 
                              key={product.id} 
                              className={`flex items-center p-2 rounded-md ${
                                selectedProducts.includes(product.id) ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50'
                              }`}
                            >
                              <input
                                type="checkbox"
                                id={`product-${product.id}`}
                                checked={selectedProducts.includes(product.id)}
                                onChange={() => handleProductToggle(product.id)}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                              />
                              <label 
                                htmlFor={`product-${product.id}`}
                                className="ml-2 block text-sm text-gray-900 cursor-pointer flex-1"
                              >
                                <div className="font-medium">{product.name}</div>
                                <div className="text-xs text-gray-500">SKU: {product.sku}</div>
                              </label>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    {selectedProducts.length > 0 && (
                      <div className="mt-2 text-sm text-blue-600">
                        {selectedProducts.length} product{selectedProducts.length !== 1 ? 's' : ''} selected
                      </div>
                    )}
                  </div>
                )}

                {/* Pricing Method Selection */}
                <div>
                  <label htmlFor="pricing_method" className="block text-sm font-medium text-gray-700">
                    Pricing Method *
                  </label>
                  <select
                    id="pricing_method"
                    value={pricingMethod}
                    onChange={(e) => {
                      setPricingMethod(e.target.value as 'per_unit' | 'per_kg');
                      setValue('pricing_method', e.target.value as 'per_unit' | 'per_kg');
                    }}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="per_unit">Per Unit</option>
                    <option value="per_kg">Per KG</option>
                  </select>
                </div>

                {!item && selectedProducts.length > 0 && (
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <div className="flex items-center mb-2">
                      <input
                        type="checkbox"
                        id="use-bulk-price"
                        checked={useBulkPrice}
                        onChange={() => setUseBulkPrice(!useBulkPrice)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor="use-bulk-price" className="ml-2 block text-sm font-medium text-blue-800">
                        Apply same price to all selected products
                      </label>
                    </div>
                    {useBulkPrice && (
                      <div className="mt-2">
                        <label className="block text-sm font-medium text-blue-800 mb-1">
                          Bulk Price ({currencyCode})
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={bulkPrice}
                          onChange={(e) => setBulkPrice(parseFloat(e.target.value) || 0)}
                          className="w-full rounded-md border border-blue-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          placeholder="0.00"
                        />
                      </div>
                    )}
                  </div>
                )}

                {(item || !useBulkPrice) && (
                  <div>
                    <label htmlFor={pricingMethod === 'per_unit' ? 'unit_price' : 'price_per_kg'} className="block text-sm font-medium text-gray-700">
                      {pricingMethod === 'per_unit' ? 'Unit Price' : 'Price per KG'} ({currencyCode}) *
                    </label>
                    {pricingMethod === 'per_unit' ? (
                      <input
                        type="number"
                        id="unit_price"
                        min="0"
                        step="0.01"
                        {...register('unit_price', { 
                          required: 'Unit price is required',
                          min: { value: 0, message: 'Price must be positive' },
                          valueAsNumber: true,
                        })}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="0.00"
                      />
                    ) : (
                      <input
                        type="number"
                        id="price_per_kg"
                        min="0"
                        step="0.01"
                        {...register('price_per_kg', { 
                          required: 'Price per KG is required',
                          min: { value: 0, message: 'Price must be positive' },
                          valueAsNumber: true,
                        })}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="0.00"
                      />
                    )}
                    {errors.unit_price && (
                      <p className="mt-1 text-sm text-red-600">{errors.unit_price.message}</p>
                    )}
                    {errors.price_per_kg && (
                      <p className="mt-1 text-sm text-red-600">{errors.price_per_kg.message}</p>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  {pricingMethod === 'per_unit' && (
                    <div>
                      <label htmlFor="min_qty" className="block text-sm font-medium text-gray-700">
                        Minimum Quantity
                      </label>
                      <input
                        type="number"
                        id="min_qty"
                        min="1"
                        {...register('min_qty', { 
                          required: 'Minimum quantity is required',
                          min: { value: 1, message: 'Minimum quantity must be at least 1' },
                          valueAsNumber: true,
                        })}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      {errors.min_qty && (
                        <p className="mt-1 text-sm text-red-600">{errors.min_qty.message}</p>
                      )}
                    </div>
                  )}

                  <div>
                    <label htmlFor="surcharge_pct" className="block text-sm font-medium text-gray-700">
                      Surcharge %
                    </label>
                    <input
                      type="number"
                      id="surcharge_pct"
                      min="0"
                      step="0.1"
                      {...register('surcharge_pct', { 
                        min: { value: 0, message: 'Surcharge must be positive' },
                        valueAsNumber: true,
                      })}
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="0.0"
                    />
                    {errors.surcharge_pct && (
                      <p className="mt-1 text-sm text-red-600">{errors.surcharge_pct.message}</p>
                    )}
                  </div>
                </div>

                {/* Deposit Information */}
                <div className="p-3 bg-blue-50 rounded-lg">
                  <div className="text-sm text-blue-800">
                    <strong>Deposit Information:</strong>
                    <div className="mt-1 text-xs">
                      • Deposit amount will be automatically calculated based on cylinder capacity<br/>
                      • Deposit rates are managed in the cylinder_deposit_rates table<br/>
                      • For variants, deposit is calculated from parent product capacity<br/>
                      • Deposit will be added to the final price calculation
                    </div>
                  </div>
                </div>

                {/* Tax Information Display */}
                <div className="p-3 bg-blue-50 rounded-lg">
                  <div className="text-sm text-blue-800">
                    <strong>Tax Information:</strong>
                    <div className="mt-1 text-xs">
                      {pricingMethod === 'per_kg' ? (
                        <>
                          • Tax will be calculated from the product's tax rate<br/>
                          • Final price = (Price per kg × KG from SKU) + Surcharge + Tax + Deposit<br/>
                          • KG is automatically extracted from product SKU (e.g., "PROPAN 12KG" = 12kg)<br/>
                          • Deposit is automatically calculated from cylinder capacity
                        </>
                      ) : (
                        <>
                          • Tax will be calculated from the product's tax rate<br/>
                          • Final price = Unit Price + Surcharge + Tax + Deposit<br/>
                          • Deposit is automatically calculated from cylinder capacity
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {(watchedPrice > 0 || bulkPrice > 0) && (
                  <div className="p-3 bg-green-50 rounded-lg">
                    <div className="text-sm text-green-800">
                      <strong>Price Calculation:</strong>
                      <div className="mt-1 text-xs">
                        {pricingMethod === 'per_unit' ? (
                          <>
                            Base Price: {formatCurrencySync(useBulkPrice ? bulkPrice : watchedPrice, currencyCode)}<br/>
                            {watchedSurcharge > 0 && (
                              <>Surcharge ({watchedSurcharge}%): {formatCurrencySync(
                                (useBulkPrice ? bulkPrice : watchedPrice) * (watchedSurcharge / 100), 
                                currencyCode
                              )}<br/></>
                            )}
                            Deposit: Will be calculated automatically from cylinder capacity<br/>
                            Final Price: {formatCurrencySync(
                              calculateFinalPrice(
                                useBulkPrice ? bulkPrice : watchedPrice, 
                                watchedSurcharge
                              ),
                              currencyCode
                            )} + deposit
                          </>
                        ) : (
                          <>
                            Price per KG: {formatCurrencySync(useBulkPrice ? bulkPrice : watchedPrice, currencyCode)}<br/>
                            KG from SKU: Will be extracted automatically<br/>
                            {watchedSurcharge > 0 && (
                              <>Surcharge ({watchedSurcharge}%): Will be calculated<br/></>
                            )}
                            Deposit: Will be calculated automatically from cylinder capacity<br/>
                            Tax: Will be calculated from product tax rate<br/>
                            Final Price: Will be calculated per cylinder
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {item && (
                  <input type="hidden" {...register('product_id')} value={item.product_id} />
                )}
                <input type="hidden" {...register('price_list_id')} value={priceListId} />
              </div>
            </div>

            <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
              <button
                type="submit"
                disabled={loading || (selectedProducts.length === 0 && !item)}
                className="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:ml-3 sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="flex items-center space-x-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Saving...</span>
                  </div>
                ) : (
                  item ? 'Update Price' : 'Add Products'
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
          </form>
        </div>
      </div>
    </div>
  );
};