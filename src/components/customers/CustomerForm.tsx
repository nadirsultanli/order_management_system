import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { X, Loader2 } from 'lucide-react';
import { Customer, CreateCustomerData } from '../../types/customer';

interface CustomerFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateCustomerData) => void;
  customer?: Customer;
  loading?: boolean;
  title: string;
}

export const CustomerForm: React.FC<CustomerFormProps> = ({
  isOpen,
  onClose,
  onSubmit,
  customer,
  loading = false,
  title,
}) => {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateCustomerData>({
    defaultValues: {
      name: '',
      external_id: '',
      tax_id: '',
      phone: '',
      email: '',
      account_status: 'active',
      credit_terms_days: 30,
    },
  });

  useEffect(() => {
    if (customer) {
      reset({
        name: customer.name,
        external_id: customer.external_id || '',
        tax_id: customer.tax_id || '',
        phone: customer.phone || '',
        email: customer.email || '',
        account_status: customer.account_status,
        credit_terms_days: customer.credit_terms_days,
      });
    } else {
      reset({
        name: '',
        external_id: '',
        tax_id: '',
        phone: '',
        email: '',
        account_status: 'active',
        credit_terms_days: 30,
      });
    }
  }, [customer, reset]);

  const handleFormSubmit = (data: any) => {
    // Group address fields under 'address'
    const {
      address_label, line1, line2, city, state, postal_code, country,
      delivery_window_start, delivery_window_end, is_primary, instructions,
      ...customerFields
    } = data;

    const address = {
      label: address_label,
      line1,
      line2,
      city,
      state,
      postal_code,
      country,
      delivery_window_start,
      delivery_window_end,
      is_primary,
      instructions,
    };

    onSubmit({
      ...customerFields,
      address,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose} />
        
        <div className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg">
          <form onSubmit={handleSubmit(handleFormSubmit)}>
            <div className="bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
              <div className="flex items-center justify-between mb-4">
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
                    Business Name *
                  </label>
                  <input
                    type="text"
                    id="name"
                    {...register('name', { required: 'Business name is required' })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  {errors.name && (
                    <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="external_id" className="block text-sm font-medium text-gray-700">
                    External ID
                  </label>
                  <input
                    type="text"
                    id="external_id"
                    {...register('external_id')}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="QuickBooks ID"
                  />
                </div>

                <div>
                  <label htmlFor="tax_id" className="block text-sm font-medium text-gray-700">
                    Tax ID (VAT/EIN)
                  </label>
                  <input
                    type="text"
                    id="tax_id"
                    {...register('tax_id')}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                      Phone
                    </label>
                    <input
                      type="tel"
                      id="phone"
                      {...register('phone')}
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                      Email
                    </label>
                    <input
                      type="email"
                      id="email"
                      {...register('email', {
                        pattern: {
                          value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                          message: 'Invalid email address',
                        },
                      })}
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    {errors.email && (
                      <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="account_status" className="block text-sm font-medium text-gray-700">
                      Account Status
                    </label>
                    <select
                      id="account_status"
                      {...register('account_status')}
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="active">Active</option>
                      <option value="credit_hold">Credit Hold</option>
                      <option value="closed">Closed</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="credit_terms_days" className="block text-sm font-medium text-gray-700">
                      Credit Terms (Days)
                    </label>
                    <input
                      type="number"
                      id="credit_terms_days"
                      min="0"
                      {...register('credit_terms_days', {
                        required: 'Credit terms is required',
                        min: { value: 0, message: 'Credit terms must be positive' },
                      })}
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    {errors.credit_terms_days && (
                      <p className="mt-1 text-sm text-red-600">{errors.credit_terms_days.message}</p>
                    )}
                  </div>
                </div>

                {/* Address Information Section */}
                <div className="pt-4 border-t border-gray-200 mt-4">
                  <h4 className="text-md font-semibold text-gray-900 mb-2">Address Information</h4>
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="address_label" className="block text-sm font-medium text-gray-700">Address Label</label>
                      <input type="text" id="address_label" {...register('address_label')} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label htmlFor="line1" className="block text-sm font-medium text-gray-700">Address Line 1 *</label>
                      <input type="text" id="line1" {...register('line1', { required: 'Address Line 1 is required' })} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      {errors.line1 && (<p className="mt-1 text-sm text-red-600">{errors.line1.message}</p>)}
                    </div>
                    <div>
                      <label htmlFor="line2" className="block text-sm font-medium text-gray-700">Address Line 2</label>
                      <input type="text" id="line2" {...register('line2')} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="city" className="block text-sm font-medium text-gray-700">City *</label>
                        <input type="text" id="city" {...register('city', { required: 'City is required' })} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                        {errors.city && (<p className="mt-1 text-sm text-red-600">{errors.city.message}</p>)}
                      </div>
                      <div>
                        <label htmlFor="state" className="block text-sm font-medium text-gray-700">State/Province</label>
                        <input type="text" id="state" {...register('state')} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="postal_code" className="block text-sm font-medium text-gray-700">Postal Code</label>
                        <input type="text" id="postal_code" {...register('postal_code')} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label htmlFor="country" className="block text-sm font-medium text-gray-700">Country</label>
                        <input type="text" id="country" {...register('country')} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="delivery_window_start" className="block text-sm font-medium text-gray-700">Delivery Window Start</label>
                        <input type="time" id="delivery_window_start" {...register('delivery_window_start')} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label htmlFor="delivery_window_end" className="block text-sm font-medium text-gray-700">Delivery Window End</label>
                        <input type="time" id="delivery_window_end" {...register('delivery_window_end')} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      </div>
                    </div>
                    <div>
                      <label htmlFor="instructions" className="block text-sm font-medium text-gray-700">Special Instructions</label>
                      <textarea id="instructions" {...register('instructions')} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    </div>
                    <div className="flex items-center">
                      <input type="checkbox" id="is_primary" {...register('is_primary')} className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" defaultChecked />
                      <label htmlFor="is_primary" className="ml-2 block text-sm text-gray-700">Set as primary address</label>
                    </div>
                  </div>
                </div>
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
                  'Save Customer'
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