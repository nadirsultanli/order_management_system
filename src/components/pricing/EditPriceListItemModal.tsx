import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { X, Loader2 } from 'lucide-react';
import { PriceListItem } from '../../types/pricing';
import { formatCurrencySync, calculateFinalPriceSync } from '../../utils/pricing';
import { useProductPricingDefaults } from '../../hooks/usePricing';

interface EditPriceListItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  item: PriceListItem;
  currencyCode: string;
  loading?: boolean;
}

interface FormData {
  pricing_method: 'per_unit' | 'per_kg';
  unit_price?: number;
  price_per_kg?: number;
  min_qty: number;
  surcharge_pct?: number;
}

export const EditPriceListItemModal: React.FC<EditPriceListItemModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  item,
  currencyCode,
  loading = false,
}) => {
  // Get pricing defaults for this product
  const { data: pricingDefaults, isLoading: loadingDefaults } = useProductPricingDefaults(
    item.product_id,
    item.price_list_id
  );

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: {
      pricing_method: item.pricing_method || 'per_unit',
      unit_price: item.unit_price,
      price_per_kg: item.price_per_kg,
      min_qty: item.min_qty || 1,
      surcharge_pct: item.surcharge_pct || undefined,
    },
  });

  const pricingMethod = watch('pricing_method');
  const unitPrice = watch('unit_price');
  const pricePerKg = watch('price_per_kg');
  const surchargeRate = watch('surcharge_pct');
  const minQty = watch('min_qty');

  // Update form when pricing defaults are loaded
  useEffect(() => {
    if (pricingDefaults && !item.id) { // Only for new items, not editing existing
      reset({
        pricing_method: pricingDefaults.pricing_defaults.method,
        unit_price: pricingDefaults.pricing_defaults.unit_price,
        price_per_kg: pricingDefaults.pricing_defaults.price_per_kg,
        min_qty: pricingDefaults.pricing_defaults.method === 'per_unit' ? pricingDefaults.pricing_defaults.min_qty : 1,
        surcharge_pct: pricingDefaults.pricing_defaults.surcharge_pct,
      });
    } else if (item.id) { // For existing items
      reset({
        pricing_method: item.pricing_method || 'per_unit',
        unit_price: item.unit_price,
        price_per_kg: item.price_per_kg,
        min_qty: item.pricing_method === 'per_unit' ? (item.min_qty || 1) : 1,
        surcharge_pct: item.surcharge_pct || undefined,
      });
    }
  }, [pricingDefaults, item, reset]);

  const handleFormSubmit = (data: FormData) => {
    onSubmit({
      pricing_method: data.pricing_method,
      unit_price: data.pricing_method === 'per_unit' ? parseFloat(data.unit_price?.toString() || '0') : undefined,
      price_per_kg: data.pricing_method === 'per_kg' ? parseFloat(data.price_per_kg?.toString() || '0') : undefined,
      min_qty: data.pricing_method === 'per_unit' ? data.min_qty : 1,
      surcharge_pct: data.surcharge_pct || null,
    });
  };

  const calculateFinalPrice = () => {
    const basePrice = pricingMethod === 'per_kg' && pricingDefaults?.product?.capacity_kg 
      ? (pricePerKg || 0) * pricingDefaults.product.capacity_kg
      : unitPrice || 0;
    
    return calculateFinalPriceSync(basePrice, surchargeRate);
  };

  const getPriceLabel = () => {
    if (pricingMethod === 'per_kg') {
      return `Price per KG (${currencyCode}) *`;
    }
    return `Unit Price (${currencyCode}) *`;
  };

  const getPriceField = () => {
    if (pricingMethod === 'per_kg') {
      return 'price_per_kg';
    }
    return 'unit_price';
  };

  const getCurrentPrice = () => {
    if (pricingMethod === 'per_kg') {
      return pricePerKg || 0;
    }
    return unitPrice || 0;
  };

  const getFinalPriceDescription = () => {
    if (pricingMethod === 'per_kg' && pricingDefaults?.product?.capacity_kg) {
      const capacity = pricingDefaults.product.capacity_kg;
      const totalPrice = (pricePerKg || 0) * capacity;
      return `${formatCurrencySync(totalPrice, currencyCode)} (for ${capacity}kg)`;
    }
    return formatCurrencySync(calculateFinalPrice(), currencyCode);
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
                  Edit Product Price
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
                {/* Product Info */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900">{item.product?.name}</h4>
                  <p className="text-sm text-gray-600">SKU: {item.product?.sku}</p>
                  {pricingDefaults?.product?.capacity_kg && (
                    <p className="text-sm text-gray-600">Capacity: {pricingDefaults.product.capacity_kg}kg</p>
                  )}
                </div>

                {/* Pricing Method Selection */}
                {pricingDefaults?.pricing_methods?.available?.length > 1 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Pricing Method
                    </label>
                    <div className="flex space-x-4">
                      {pricingDefaults.pricing_methods.available.map((method) => (
                        <label key={method} className="flex items-center">
                          <input
                            type="radio"
                            value={method}
                            {...register('pricing_method')}
                            className="mr-2"
                          />
                          <span className="text-sm">
                            {method === 'per_kg' ? 'Per KG' : 'Per Unit'}
                            {method === pricingDefaults.pricing_methods.recommended && (
                              <span className="ml-1 text-xs text-blue-600">(Recommended)</span>
                            )}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Price Input */}
                <div>
                  <label htmlFor={getPriceField()} className="block text-sm font-medium text-gray-700">
                    {getPriceLabel()}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    id={getPriceField()}
                    {...register(getPriceField() as keyof FormData, {
                      required: 'Price is required',
                      min: { value: 0.01, message: 'Price must be greater than 0' },
                    })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    disabled={loadingDefaults}
                  />
                  {errors[getPriceField() as keyof FormData] && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors[getPriceField() as keyof FormData]?.message}
                    </p>
                  )}
                </div>

                {/* Minimum Quantity - Only show for per_unit pricing */}
                {pricingMethod === 'per_unit' && (
                  <div>
                    <label htmlFor="min_qty" className="block text-sm font-medium text-gray-700">
                      Minimum Quantity
                    </label>
                    <input
                      type="number"
                      min="1"
                      id="min_qty"
                      {...register('min_qty', {
                        required: 'Minimum quantity is required',
                        min: { value: 1, message: 'Minimum quantity must be at least 1' },
                      })}
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    {errors.min_qty && (
                      <p className="mt-1 text-sm text-red-600">{errors.min_qty.message}</p>
                    )}
                  </div>
                )}

                {/* Surcharge Percentage */}
                <div>
                  <label htmlFor="surcharge_pct" className="block text-sm font-medium text-gray-700">
                    Surcharge Percentage (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    id="surcharge_pct"
                    {...register('surcharge_pct', {
                      min: { value: 0, message: 'Surcharge cannot be negative' },
                      max: { value: 100, message: 'Surcharge cannot exceed 100%' },
                    })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="0.0"
                  />
                  {errors.surcharge_pct && (
                    <p className="mt-1 text-sm text-red-600">{errors.surcharge_pct.message}</p>
                  )}
                </div>

                {/* Final Price Preview */}
                {getCurrentPrice() > 0 && (
                  <div className="bg-blue-50 rounded-lg p-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-blue-900">Final Price:</span>
                      <span className="text-lg font-bold text-blue-900">
                        {getFinalPriceDescription()}
                      </span>
                    </div>
                    {surchargeRate && surchargeRate > 0 && (
                      <div className="text-xs text-blue-700 mt-1">
                        {pricingMethod === 'per_kg' && pricingDefaults?.product?.capacity_kg ? (
                          <>
                            Base: {formatCurrencySync((pricePerKg || 0) * pricingDefaults.product.capacity_kg, currencyCode)} 
                            ({formatCurrencySync(pricePerKg || 0, currencyCode)}/kg × {pricingDefaults.product.capacity_kg}kg) 
                            + {surchargeRate}% surcharge
                          </>
                        ) : (
                          <>
                            Base: {formatCurrencySync(unitPrice || 0, currencyCode)} + {surchargeRate}% surcharge
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Loading State */}
                {loadingDefaults && (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                    <span className="ml-2 text-sm text-gray-600">Loading pricing defaults...</span>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
              <button
                type="submit"
                disabled={loading || loadingDefaults}
                className="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:ml-3 sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="flex items-center space-x-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Saving...</span>
                  </div>
                ) : (
                  'Save Changes'
                )}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={loading || loadingDefaults}
                className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:mt-0 sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
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