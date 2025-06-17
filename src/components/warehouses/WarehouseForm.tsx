import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { X, Loader2, MapPin } from 'lucide-react';
import { Warehouse, CreateWarehouseData } from '../../types/warehouse';
import { getCountryOptions } from '../../utils/address';
import { AddressForm } from '../addresses/AddressForm';

interface WarehouseFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateWarehouseData) => void;
  warehouse?: Warehouse;
  loading?: boolean;
  title: string;
}

export const WarehouseForm: React.FC<WarehouseFormProps> = ({
  isOpen,
  onClose,
  onSubmit,
  warehouse,
  loading = false,
  title,
}) => {
  const [includeAddress, setIncludeAddress] = useState(false);
  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [addressData, setAddressData] = useState<any>(warehouse?.address || null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<CreateWarehouseData>({
    defaultValues: {
      name: '',
      capacity_cylinders: undefined,
      address: {
        line1: '',
        line2: '',
        city: '',
        state: '',
        postal_code: '',
        country: 'US',
        instructions: '',
      },
    },
  });

  useEffect(() => {
    if (warehouse) {
      const hasAddress = !!warehouse.address;
      setIncludeAddress(hasAddress);
      
      reset({
        name: warehouse.name,
        capacity_cylinders: warehouse.capacity_cylinders,
        address: warehouse.address ? {
          line1: warehouse.address.line1,
          line2: warehouse.address.line2 || '',
          city: warehouse.address.city,
          state: warehouse.address.state || '',
          postal_code: warehouse.address.postal_code || '',
          country: warehouse.address.country,
          instructions: warehouse.address.instructions || '',
        } : {
          line1: '',
          line2: '',
          city: '',
          state: '',
          postal_code: '',
          country: 'US',
          instructions: '',
        },
      });
    } else {
      setIncludeAddress(false);
      reset({
        name: '',
        capacity_cylinders: undefined,
        address: {
          line1: '',
          line2: '',
          city: '',
          state: '',
          postal_code: '',
          country: 'US',
          instructions: '',
        },
      });
    }
  }, [warehouse, reset]);

  const handleFormSubmit = (data: CreateWarehouseData) => {
    const submitData = {
      name: data.name,
      capacity_cylinders: data.capacity_cylinders,
      address: addressData || undefined,
    };
    onSubmit(submitData);
  };

  const countryOptions = getCountryOptions();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose} />
        
        <div className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-2xl">
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

              <div className="space-y-6">
                {/* Basic Information */}
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-4">Basic Information</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                        Warehouse Name *
                      </label>
                      <input
                        type="text"
                        id="name"
                        {...register('name', { required: 'Warehouse name is required' })}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="Main Depot"
                      />
                      {errors.name && (
                        <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="capacity_cylinders" className="block text-sm font-medium text-gray-700">
                        Storage Capacity (cylinders)
                      </label>
                      <input
                        type="number"
                        min="1"
                        id="capacity_cylinders"
                        {...register('capacity_cylinders', {
                          valueAsNumber: true,
                          min: { value: 1, message: 'Capacity must be at least 1' },
                        })}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="1000"
                      />
                      {errors.capacity_cylinders && (
                        <p className="mt-1 text-sm text-red-600">{errors.capacity_cylinders.message}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Location Section - Use AddressForm */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-medium text-gray-900">Location</h4>
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="include_address"
                        checked={includeAddress}
                        onChange={(e) => setIncludeAddress(e.target.checked)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor="include_address" className="ml-2 block text-sm text-gray-900">
                        Add physical address
                      </label>
                    </div>
                  </div>

                  {includeAddress && (
                    <div>
                      <button
                        type="button"
                        className="mb-2 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                        onClick={() => setAddressModalOpen(true)}
                      >
                        {addressData ? 'Edit Address' : 'Add Address'}
                      </button>
                      {addressData && (
                        <div className="text-xs text-gray-700 mb-2">
                          {addressData.line1}, {addressData.city}, {addressData.country} {addressData.postal_code}
                        </div>
                      )}
                      <AddressForm
                        isOpen={addressModalOpen}
                        onClose={() => setAddressModalOpen(false)}
                        onSubmit={(data) => {
                          setAddressData(data);
                          setAddressModalOpen(false);
                        }}
                        address={addressData}
                        customerId={warehouse?.id || ''}
                        title="Warehouse Address"
                        loading={loading}
                      />
                    </div>
                  )}
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
                  'Save Warehouse'
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