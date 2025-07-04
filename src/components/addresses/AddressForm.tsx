import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { X, Loader2, Navigation, MapPin } from 'lucide-react';
import { Address, CreateAddressData } from '../../types/address';
import { getCountryOptions, validateDeliveryWindow, geocodeAddress } from '../../utils/address';

interface AddressFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateAddressData) => void;
  address?: Address;
  customerId: string;
  loading?: boolean;
  title: string;
  isFirstAddress?: boolean;
}

export const AddressForm: React.FC<AddressFormProps> = ({
  isOpen,
  onClose,
  onSubmit,
  address,
  customerId,
  loading = false,
  title,
  isFirstAddress = false,
}) => {
  const [geocoding, setGeocoding] = useState(false);
  const [geocoded, setGeocoded] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreateAddressData>({
    defaultValues: {
      customer_id: customerId,
      label: '',
      line1: '',
      line2: '',
      city: '',
      state: '',
      postal_code: '',
      country: 'US',
      delivery_window_start: '',
      delivery_window_end: '',
      is_primary: isFirstAddress,
      instructions: '',
    },
  });

  const watchedFields = watch(['line1', 'city', 'state', 'postal_code']);
  const deliveryStart = watch('delivery_window_start');
  const deliveryEnd = watch('delivery_window_end');

  useEffect(() => {
    if (address) {
      reset({
        customer_id: address.customer_id,
        label: address.label || '',
        line1: address.line1,
        line2: address.line2 || '',
        city: address.city,
        state: address.state || '',
        postal_code: address.postal_code || '',
        country: address.country,
        delivery_window_start: address.delivery_window_start || '',
        delivery_window_end: address.delivery_window_end || '',
        is_primary: address.is_primary,
        instructions: address.instructions || '',
        latitude: address.latitude,
        longitude: address.longitude,
      });
      setGeocoded(!!(address.latitude && address.longitude));
    } else {
      reset({
        customer_id: customerId,
        label: '',
        line1: '',
        line2: '',
        city: '',
        state: '',
        postal_code: '',
        country: 'US',
        delivery_window_start: '',
        delivery_window_end: '',
        is_primary: isFirstAddress,
        instructions: '',
      });
      setGeocoded(false);
    }
  }, [address, customerId, isFirstAddress, reset]);

  const handleGeocode = async () => {
    const [line1, city, state, postal_code] = watchedFields;
    
    if (!line1 || !city) {
      return;
    }

    setGeocoding(true);
    try {
      const result = await geocodeAddress({
        line1,
        city,
        state,
        postal_code,
      });

      if (result) {
        setValue('latitude', result.latitude);
        setValue('longitude', result.longitude);
        setGeocoded(true);
      }
    } catch (error) {
      console.error('Geocoding failed:', error);
    } finally {
      setGeocoding(false);
    }
  };

  const handleFormSubmit = (data: CreateAddressData) => {
    // Validate delivery window only if both times are provided
    if (data.delivery_window_start && data.delivery_window_end) {
      if (!validateDeliveryWindow(data.delivery_window_start, data.delivery_window_end)) {
        // Use better error handling instead of alert
        const errorMessage = 'End time must be after start time';
        console.error('Delivery window validation error:', errorMessage);
        // For now use alert, but this should be replaced with a proper error state
        alert(errorMessage);
        return;
      }
    }
    
    // Clear partial time windows - either both or neither
    if (data.delivery_window_start && !data.delivery_window_end) {
      data.delivery_window_end = undefined;
    }
    if (data.delivery_window_end && !data.delivery_window_start) {
      data.delivery_window_start = undefined;
    }

    // Log for debugging
    console.log('Submitting address form:', data);
    onSubmit(data);
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
                {/* Address Information */}
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-4">Address Information</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <label htmlFor="label" className="block text-sm font-medium text-gray-700">
                        Address Label
                      </label>
                      <input
                        type="text"
                        id="label"
                        {...register('label')}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="Main Location, Loading Dock, etc."
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label htmlFor="line1" className="block text-sm font-medium text-gray-700">
                        Address Line 1 *
                      </label>
                      <input
                        type="text"
                        id="line1"
                        {...register('line1', { required: 'Address line 1 is required' })}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      {errors.line1 && (
                        <p className="mt-1 text-sm text-red-600">{errors.line1.message}</p>
                      )}
                    </div>

                    <div className="sm:col-span-2">
                      <label htmlFor="line2" className="block text-sm font-medium text-gray-700">
                        Address Line 2
                      </label>
                      <input
                        type="text"
                        id="line2"
                        {...register('line2')}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="Apartment, suite, unit, etc."
                      />
                    </div>

                    <div>
                      <label htmlFor="city" className="block text-sm font-medium text-gray-700">
                        City *
                      </label>
                      <input
                        type="text"
                        id="city"
                        {...register('city', { required: 'City is required' })}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      {errors.city && (
                        <p className="mt-1 text-sm text-red-600">{errors.city.message}</p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="state" className="block text-sm font-medium text-gray-700">
                        State/Province
                      </label>
                      <input
                        type="text"
                        id="state"
                        {...register('state')}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label htmlFor="postal_code" className="block text-sm font-medium text-gray-700">
                        Postal Code
                      </label>
                      <input
                        type="text"
                        id="postal_code"
                        {...register('postal_code')}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label htmlFor="country" className="block text-sm font-medium text-gray-700">
                        Country
                      </label>
                      <select
                        id="country"
                        {...register('country')}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        {countryOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <div className="flex items-center justify-between">
                        <label className="block text-sm font-medium text-gray-700">
                          Geocoding
                        </label>
                        <button
                          type="button"
                          onClick={handleGeocode}
                          disabled={geocoding || !watchedFields[0] || !watchedFields[1]}
                          className="flex items-center space-x-2 text-sm text-blue-600 hover:text-blue-800 disabled:text-gray-400 disabled:cursor-not-allowed"
                        >
                          {geocoding ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : geocoded ? (
                            <Navigation className="h-4 w-4 text-green-600" />
                          ) : (
                            <MapPin className="h-4 w-4" />
                          )}
                          <span>
                            {geocoding ? 'Geocoding...' : geocoded ? 'Geocoded' : 'Geocode Address'}
                          </span>
                        </button>
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        Geocoding helps with delivery route optimization
                      </p>
                    </div>
                  </div>
                </div>

                {/* Delivery Preferences */}
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-4">Delivery Preferences</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="delivery_window_start" className="block text-sm font-medium text-gray-700">
                        Delivery Window Start
                      </label>
                      <input
                        type="time"
                        id="delivery_window_start"
                        {...register('delivery_window_start')}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label htmlFor="delivery_window_end" className="block text-sm font-medium text-gray-700">
                        Delivery Window End
                      </label>
                      <input
                        type="time"
                        id="delivery_window_end"
                        {...register('delivery_window_end')}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      {deliveryStart && deliveryEnd && !validateDeliveryWindow(deliveryStart, deliveryEnd) && (
                        <p className="mt-1 text-sm text-red-600">End time must be after start time</p>
                      )}
                    </div>

                    <div className="sm:col-span-2">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="is_primary"
                          {...register('is_primary')}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label htmlFor="is_primary" className="ml-2 block text-sm text-gray-900">
                          Set as primary address
                        </label>
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        Primary address will be used as the default for orders
                      </p>
                    </div>
                  </div>
                </div>

                {/* Access & Security */}
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-4">Access & Security</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="access_code" className="block text-sm font-medium text-gray-700">
                        Access Code
                      </label>
                      <input
                        type="text"
                        id="access_code"
                        {...register('access_code')}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="Building access code"
                      />
                    </div>

                    <div>
                      <label htmlFor="gate_code" className="block text-sm font-medium text-gray-700">
                        Gate Code
                      </label>
                      <input
                        type="text"
                        id="gate_code"
                        {...register('gate_code')}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="Gate or entrance code"
                      />
                    </div>

                    <div>
                      <label htmlFor="building_type" className="block text-sm font-medium text-gray-700">
                        Building Type
                      </label>
                      <select
                        id="building_type"
                        {...register('building_type')}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="">Select type...</option>
                        <option value="residential">Residential</option>
                        <option value="commercial">Commercial</option>
                        <option value="industrial">Industrial</option>
                        <option value="other">Other</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="preferred_delivery_time" className="block text-sm font-medium text-gray-700">
                        Preferred Time
                      </label>
                      <input
                        type="time"
                        id="preferred_delivery_time"
                        {...register('preferred_delivery_time')}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Preferred time within delivery window
                      </p>
                    </div>

                    <div className="sm:col-span-2">
                      <label htmlFor="security_requirements" className="block text-sm font-medium text-gray-700">
                        Security Requirements
                      </label>
                      <textarea
                        id="security_requirements"
                        rows={2}
                        {...register('security_requirements')}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="Security checkpoints, ID requirements, visitor procedures..."
                      />
                    </div>
                  </div>
                </div>

                {/* Contact Information */}
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-4">On-Site Contact</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="contact_person" className="block text-sm font-medium text-gray-700">
                        Contact Person
                      </label>
                      <input
                        type="text"
                        id="contact_person"
                        {...register('contact_person')}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="On-site contact name"
                      />
                    </div>

                    <div>
                      <label htmlFor="contact_phone" className="block text-sm font-medium text-gray-700">
                        Contact Phone
                      </label>
                      <input
                        type="tel"
                        id="contact_phone"
                        {...register('contact_phone')}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="Phone number for delivery"
                      />
                    </div>
                  </div>
                </div>

                {/* Logistics Information */}
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-4">Logistics & Access</h4>
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="parking_instructions" className="block text-sm font-medium text-gray-700">
                        Parking Instructions
                      </label>
                      <textarea
                        id="parking_instructions"
                        rows={2}
                        {...register('parking_instructions')}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="Where to park, parking restrictions, loading zones..."
                      />
                    </div>

                    <div>
                      <label htmlFor="loading_dock_info" className="block text-sm font-medium text-gray-700">
                        Loading Dock Information
                      </label>
                      <textarea
                        id="loading_dock_info"
                        rows={2}
                        {...register('loading_dock_info')}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="Loading dock location, height restrictions, equipment availability..."
                      />
                    </div>
                  </div>
                </div>

                {/* Delivery Instructions */}
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-4">Delivery Instructions</h4>
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="delivery_notes" className="block text-sm font-medium text-gray-700">
                        Delivery Notes
                      </label>
                      <textarea
                        id="delivery_notes"
                        rows={3}
                        {...register('delivery_notes')}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="Specific delivery instructions, handling requirements..."
                      />
                    </div>

                    <div>
                      <label htmlFor="special_instructions" className="block text-sm font-medium text-gray-700">
                        Special Instructions
                      </label>
                      <textarea
                        id="special_instructions"
                        rows={3}
                        {...register('special_instructions')}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="Special handling, fragile items, temperature requirements..."
                      />
                    </div>

                    <div>
                      <label htmlFor="instructions" className="block text-sm font-medium text-gray-700">
                        General Instructions
                      </label>
                      <textarea
                        id="instructions"
                        rows={2}
                        {...register('instructions')}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="General delivery notes and instructions..."
                      />
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
                  'Save Address'
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