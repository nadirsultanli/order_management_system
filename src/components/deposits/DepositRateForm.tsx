import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { X, Loader2, AlertTriangle } from 'lucide-react';
import { DepositRate, CreateDepositRateData } from '../../types/deposits';
import { CurrencySelect } from '../ui/CurrencySelect';

interface DepositRateFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateDepositRateData) => void;
  rate?: DepositRate;
  loading?: boolean;
  title: string;
}

export const DepositRateForm: React.FC<DepositRateFormProps> = ({
  isOpen,
  onClose,
  onSubmit,
  rate,
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
  } = useForm<CreateDepositRateData>({
    defaultValues: {
      capacity_l: 0,
      deposit_amount: 0,
      currency_code: 'KES',
      effective_date: new Date().toISOString().split('T')[0],
      end_date: '',
      notes: '',
    },
  });

  const effectiveDate = watch('effective_date');
  const endDate = watch('end_date');
  const currencyCode = watch('currency_code');
  const capacityL = watch('capacity_l');
  const depositAmount = watch('deposit_amount');

  useEffect(() => {
    if (rate) {
      reset({
        capacity_l: rate.capacity_l,
        deposit_amount: rate.deposit_amount,
        currency_code: rate.currency_code || 'KES',
        effective_date: rate.effective_date,
        end_date: rate.end_date || '',
        notes: rate.notes || '',
      });
    } else {
      reset({
        capacity_l: 0,
        deposit_amount: 0,
        currency_code: 'KES',
        effective_date: new Date().toISOString().split('T')[0],
        end_date: '',
        notes: '',
      });
    }
  }, [rate, reset]);

  const handleFormSubmit = (data: CreateDepositRateData) => {
    // Clean up data
    const cleanedData = {
      ...data,
      end_date: data.end_date || undefined,
      notes: data.notes || undefined,
    };

    onSubmit(cleanedData);
  };

  const validateDateRange = (startDate: string, endDate: string) => {
    if (!endDate) return true;
    return new Date(endDate) > new Date(startDate);
  };

  const dateRangeValid = !endDate || validateDateRange(effectiveDate, endDate);

  const commonCapacities = [5, 9, 13, 19, 47.5];

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
                  <label htmlFor="capacity_l" className="block text-sm font-medium text-gray-700">
                    Cylinder Capacity (Liters) *
                  </label>
                  <div className="mt-1 space-y-2">
                    <input
                      type="number"
                      id="capacity_l"
                      step="0.1"
                      min="0"
                      {...register('capacity_l', { 
                        required: 'Capacity is required',
                        min: { value: 0.1, message: 'Capacity must be greater than 0' }
                      })}
                      className="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="13"
                    />
                    {/* Quick select buttons for common capacities */}
                    <div className="flex flex-wrap gap-2">
                      {commonCapacities.map(capacity => (
                        <button
                          key={capacity}
                          type="button"
                          onClick={() => setValue('capacity_l', capacity)}
                          className={`px-2 py-1 text-xs rounded border transition-colors ${
                            capacityL === capacity
                              ? 'bg-blue-100 border-blue-300 text-blue-700'
                              : 'bg-gray-50 border-gray-300 text-gray-600 hover:bg-gray-100'
                          }`}
                        >
                          {capacity}L
                        </button>
                      ))}
                    </div>
                  </div>
                  {errors.capacity_l && (
                    <p className="mt-1 text-sm text-red-600">{errors.capacity_l.message}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="deposit_amount" className="block text-sm font-medium text-gray-700">
                    Deposit Amount *
                  </label>
                  <input
                    type="number"
                    id="deposit_amount"
                    step="0.01"
                    min="0"
                    {...register('deposit_amount', { 
                      required: 'Deposit amount is required',
                      min: { value: 0.01, message: 'Deposit amount must be greater than 0' }
                    })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="100.00"
                  />
                  {errors.deposit_amount && (
                    <p className="mt-1 text-sm text-red-600">{errors.deposit_amount.message}</p>
                  )}
                  {depositAmount > 0 && currencyCode && (
                    <p className="mt-1 text-sm text-gray-500">
                      Preview: {new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: currencyCode,
                      }).format(depositAmount)}
                    </p>
                  )}
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
                    <label htmlFor="effective_date" className="block text-sm font-medium text-gray-700">
                      Effective Date *
                    </label>
                    <input
                      type="date"
                      id="effective_date"
                      {...register('effective_date', { required: 'Effective date is required' })}
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    {errors.effective_date && (
                      <p className="mt-1 text-sm text-red-600">{errors.effective_date.message}</p>
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
                        End date must be after effective date
                      </span>
                    </div>
                  </div>
                )}

                <div>
                  <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
                    Notes
                  </label>
                  <textarea
                    id="notes"
                    rows={3}
                    {...register('notes')}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Optional notes about this deposit rate..."
                  />
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
                  'Save Deposit Rate'
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