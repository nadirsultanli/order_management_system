import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { X, Loader2, AlertTriangle } from 'lucide-react';
import { PriceList, CreatePriceListData } from '../../types/pricing';
import { validateDateRangeSync } from '../../utils/pricing';
import { CurrencySelect } from '../ui/CurrencySelect';

interface PriceListFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreatePriceListData) => void;
  priceList?: PriceList;
  loading?: boolean;
  title: string;
}

export const PriceListForm: React.FC<PriceListFormProps> = ({
  isOpen,
  onClose,
  onSubmit,
  priceList,
  loading = false,
  title,
}) => {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreatePriceListData>({
    defaultValues: {
      name: '',
      description: '',
      currency_code: 'KES',
      start_date: new Date().toISOString().split('T')[0],
      end_date: '',
      is_default: false,
    },
  });

  const startDate = watch('start_date');
  const endDate = watch('end_date');
  const isDefault = watch('is_default');
  const currencyCode = watch('currency_code');

  useEffect(() => {
    if (priceList) {
      reset({
        name: priceList.name,
        description: priceList.description || '',
        currency_code: priceList.currency_code || 'KES',
        start_date: priceList.start_date,
        end_date: priceList.end_date || '',
        is_default: priceList.is_default,
      });
    } else {
      reset({
        name: '',
        description: '',
        currency_code: 'KES',
        start_date: new Date().toISOString().split('T')[0],
        end_date: '',
        is_default: false,
      });
    }
  }, [priceList, reset]);

  const handleFormSubmit = (data: CreatePriceListData) => {
    // Clean up data
    const cleanedData = {
      ...data,
      end_date: data.end_date || undefined,
      description: data.description || undefined,
    };

    onSubmit(cleanedData);
  };

  const dateRangeValid = !endDate || validateDateRangeSync(startDate, endDate);

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
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                    Price List Name *
                  </label>
                  <input
                    type="text"
                    id="name"
                    {...register('name', { required: 'Price list name is required' })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Standard 2025"
                  />
                  {errors.name && (
                    <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                    Description
                  </label>
                  <textarea
                    id="description"
                    rows={3}
                    {...register('description')}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Optional description of this price list..."
                  />
                </div>

                <div>
                  <label htmlFor="currency_code" className="block text-sm font-medium text-gray-700">
                    Currency *
                  </label>
                  <CurrencySelect
                    value={currencyCode}
                    onChange={(value) => setValue('currency_code', value)}
                    className="mt-1"
                  />
                  <input type="hidden" {...register('currency_code')} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="start_date" className="block text-sm font-medium text-gray-700">
                      Start Date *
                    </label>
                    <input
                      type="date"
                      id="start_date"
                      {...register('start_date', { required: 'Start date is required' })}
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    {errors.start_date && (
                      <p className="mt-1 text-sm text-red-600">{errors.start_date.message}</p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="end_date" className="block text-sm font-medium text-gray-700">
                      End Date
                    </label>
                    <input
                      type="date"
                      id="end_date"
                      {...register('end_date')}
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Leave empty for no end date
                    </p>
                  </div>
                </div>

                {!dateRangeValid && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                    <div className="flex items-center space-x-2">
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                      <span className="text-sm text-red-800">
                        End date must be after start date
                      </span>
                    </div>
                  </div>
                )}

                <div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="is_default"
                      {...register('is_default')}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="is_default" className="ml-2 block text-sm text-gray-900">
                      Set as default price list
                    </label>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Only one price list can be set as default at a time
                  </p>
                  {isDefault && (
                    <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded-md">
                      <p className="text-xs text-yellow-800">
                        Setting this as default will unset any existing default price list
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
              <button
                type="submit"
                disabled={loading || !dateRangeValid}
                className="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:ml-3 sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="flex items-center space-x-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Saving...</span>
                  </div>
                ) : (
                  'Save Price List'
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