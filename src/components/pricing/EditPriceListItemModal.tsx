import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { X, Loader2 } from 'lucide-react';
import { PriceListItem } from '../../types/pricing';
import { formatCurrencySync, calculateFinalPriceSync } from '../../utils/pricing';

interface EditPriceListItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  item: PriceListItem;
  currencyCode: string;
  loading?: boolean;
}

interface FormData {
  unit_price: number;
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
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: {
      unit_price: item.unit_price,
      min_qty: item.min_qty,
      surcharge_pct: item.surcharge_pct || undefined,
    },
  });

  const unitPrice = watch('unit_price');
  const surchargeRate = watch('surcharge_pct');

  useEffect(() => {
    if (item) {
      reset({
        unit_price: item.unit_price,
        min_qty: item.min_qty,
        surcharge_pct: item.surcharge_pct || undefined,
      });
    }
  }, [item, reset]);

  const handleFormSubmit = (data: FormData) => {
    onSubmit({
      unit_price: data.unit_price,
      min_qty: data.min_qty,
      surcharge_pct: data.surcharge_pct || null,
    });
  };

  const calculateFinalPrice = () => {
    return calculateFinalPriceSync(unitPrice || 0, surchargeRate);
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
                </div>

                {/* Unit Price */}
                <div>
                  <label htmlFor="unit_price" className="block text-sm font-medium text-gray-700">
                    Unit Price ({currencyCode}) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    id="unit_price"
                    {...register('unit_price', {
                      required: 'Unit price is required',
                      min: { value: 0.01, message: 'Price must be greater than 0' },
                    })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  {errors.unit_price && (
                    <p className="mt-1 text-sm text-red-600">{errors.unit_price.message}</p>
                  )}
                </div>

                {/* Minimum Quantity */}
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
                {unitPrice > 0 && (
                  <div className="bg-blue-50 rounded-lg p-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-blue-900">Final Price:</span>
                      <span className="text-lg font-bold text-blue-900">
                        {formatCurrencySync(calculateFinalPrice(), currencyCode)}
                      </span>
                    </div>
                    {surchargeRate && surchargeRate > 0 && (
                      <div className="text-xs text-blue-700 mt-1">
                        Base: {formatCurrencySync(unitPrice, currencyCode)} + {surchargeRate}% surcharge
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
              <button
                type="submit"
                disabled={loading}
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