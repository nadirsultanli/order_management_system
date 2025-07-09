import React, { useEffect, useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { X, Loader2 } from 'lucide-react';
import { Customer, CreateCustomerData, CreateCustomerAddressInput } from '../../types/customer';
import { getGeocodeSuggestions } from '../../utils/geocoding';
// @ts-ignore - mapbox-gl types not available
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import toast from 'react-hot-toast';

interface CustomerFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateCustomerData) => void;
  customer?: Customer;
  loading?: boolean;
  title: string;
  showAddressFields?: boolean; // New prop to control address field visibility
}

// Extended form data interface for the flat form fields
interface CustomerFormData extends Omit<CreateCustomerData, 'address'> {
  address_label?: string;
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postal_code?: string;
  country: string;
  delivery_window_start?: string;
  delivery_window_end?: string;
  is_primary?: boolean;
  instructions?: string;
  latitude?: number;
  longitude?: number;
}

export const CustomerForm: React.FC<CustomerFormProps> = ({
  isOpen,
  onClose,
  onSubmit,
  customer,
  loading = false,
  title,
  showAddressFields = true, // Default to true for backward compatibility
}) => {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
    setValue,
    watch,
  } = useForm<CustomerFormData>({
    defaultValues: {
      name: '',
      external_id: '',
      tax_id: '',
      phone: '',
      email: '',
      account_status: 'active',
      credit_terms_days: 30,
      line1: '',
      line2: '',
      city: '',
      state: '',
      postal_code: '',
      country: 'US',
    },
  });

  const [addressInput, setAddressInput] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<any>(null);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const [map, setMap] = useState<mapboxgl.Map | null>(null);
  const [marker, setMarker] = useState<mapboxgl.Marker | null>(null);
  const [isPinDraggable, setIsPinDraggable] = useState(false);
  const latitude = watch('latitude');
  const longitude = watch('longitude');
  const deliveryStart = watch('delivery_window_start');
  const deliveryEnd = watch('delivery_window_end');

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
        address_label: customer.primary_address?.label || '',
        line1: customer.primary_address?.line1 || '',
        line2: customer.primary_address?.line2 || '',
        city: customer.primary_address?.city || '',
        state: customer.primary_address?.state || '',
        postal_code: customer.primary_address?.postal_code || '',
        country: customer.primary_address?.country || 'US',
        delivery_window_start: customer.primary_address?.delivery_window_start || '',
        delivery_window_end: customer.primary_address?.delivery_window_end || '',
        is_primary: customer.primary_address?.is_primary || true,
        instructions: customer.primary_address?.instructions || '',
        latitude: customer.primary_address?.latitude,
        longitude: customer.primary_address?.longitude,
      });
      
      if (customer.primary_address) {
        const addressParts = [
          customer.primary_address.line1,
          customer.primary_address.line2,
          customer.primary_address.city,
          customer.primary_address.state,
          customer.primary_address.postal_code,
        ].filter(Boolean);
        setAddressInput(addressParts.join(', '));
      }
    } else {
      reset({
        name: '',
        external_id: '',
        tax_id: '',
        phone: '',
        email: '',
        account_status: 'active',
        credit_terms_days: 30,
        address_label: '',
        line1: '',
        line2: '',
        city: '',
        state: '',
        postal_code: '',
        country: 'US',
        delivery_window_start: '',
        delivery_window_end: '',
        is_primary: true,
        instructions: '',
        latitude: undefined,
        longitude: undefined,
      });
      setAddressInput('');
    }
  }, [customer, reset]);

  useEffect(() => {
    let active = true;
    if (addressInput && addressInput.length >= 3) {
      setIsSearching(true);
      getGeocodeSuggestions(addressInput, setIsSearching).then((results) => {
        if (active) setSuggestions(results || []);
      });
    } else {
      setSuggestions([]);
      setIsSearching(false);
    }
    return () => { active = false; };
  }, [addressInput]);

  useEffect(() => {
    if (!map && mapContainer.current && latitude && longitude) {
      mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_API_KEY;
      const newMap = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v11',
        center: [longitude, latitude],
        zoom: 14,
      });
      newMap.addControl(new mapboxgl.NavigationControl(), 'top-right');
      setMap(newMap);

      const newMarker = new mapboxgl.Marker({ anchor: 'center', draggable: isPinDraggable })
        .setLngLat([longitude, latitude])
        .addTo(newMap);
      setMarker(newMarker);

      newMarker.on('dragend', () => {
        const lngLat = newMarker.getLngLat();
        setValue('latitude', lngLat.lat);
        setValue('longitude', lngLat.lng);
      });

      newMap.on('load', () => {
        newMap.resize();
      });
    }
  }, [mapContainer, latitude, longitude]);

  useEffect(() => {
    if (map && marker && latitude && longitude) {
      marker.setLngLat([longitude, latitude]);
      marker.setDraggable(isPinDraggable);
      map.setCenter([longitude, latitude]);
      map.setZoom(14);
      map.resize();
    }
  }, [latitude, longitude, isPinDraggable, map, marker]);

  useEffect(() => {
    return () => {
      if (marker) marker.remove();
      if (map) map.remove();
    };
  }, []);

  const handleFormSubmit = async (data: CustomerFormData) => {
    // Explicit guard to ensure full address selected when address fields are visible
    if (showAddressFields && (!data.line1 || !data.city || !data.country)) {
      toast.error('Please select a full address from the suggestions');
      return;
    }
    try {
      if (showAddressFields) {
        // Group address fields under 'address' when address fields are shown
        const {
          address_label, line1, line2, city, state, postal_code, country,
          delivery_window_start, delivery_window_end, is_primary, instructions,
          latitude, longitude,
          ...customerFields
        } = data;

        const address = {
          label: address_label,
          line1: line1 || '',
          line2,
          city: city || '',
          state,
          postal_code,
          country: country || 'US',
          delivery_window_start: delivery_window_start || undefined,
          delivery_window_end: delivery_window_end || undefined,
          is_primary: is_primary ?? true,
          instructions,
          latitude,
          longitude,
        };

        onSubmit({
          ...customerFields,
          address,
        });
      } else {
        // Only submit customer fields when address fields are hidden
        const {
          address_label, line1, line2, city, state, postal_code, country,
          delivery_window_start, delivery_window_end, is_primary, instructions,
          latitude, longitude,
          ...customerFields
        } = data;

        onSubmit({
          ...customerFields,
          address: {
            line1: '',
            city: '',
            country: 'US',
            is_primary: true,
          } as CreateCustomerAddressInput,
        });
      }
    } catch (error) {
      console.error('Form validation error:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4 text-center sm:items-center sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose} />
        
        <div className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg max-h-[90vh] overflow-y-auto">
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
                    className={`mt-1 block w-full rounded-md border px-3 py-2 shadow-sm focus:outline-none focus:ring-1 ${
                      errors.name 
                        ? 'border-red-500 focus:border-red-500 focus:ring-red-500' 
                        : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                    }`}
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
                      Phone *
                    </label>
                    <input
                      type="tel"
                      id="phone"
                      {...register('phone', { 
                        required: 'Phone number is required',
                        minLength: { value: 10, message: 'Phone number must be at least 10 digits' }
                      })}
                      className={`mt-1 block w-full rounded-md border px-3 py-2 shadow-sm focus:outline-none focus:ring-1 ${
                        errors.phone 
                          ? 'border-red-500 focus:border-red-500 focus:ring-red-500' 
                          : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                      }`}
                    />
                    {errors.phone && (
                      <p className="mt-1 text-sm text-red-600">{errors.phone.message}</p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                      Email *
                    </label>
                    <input
                      type="email"
                      id="email"
                      {...register('email', {
                        required: 'Email is required',
                        pattern: {
                          value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                          message: 'Invalid email address',
                        },
                      })}
                      className={`mt-1 block w-full rounded-md border px-3 py-2 shadow-sm focus:outline-none focus:ring-1 ${
                        errors.email 
                          ? 'border-red-500 focus:border-red-500 focus:ring-red-500' 
                          : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                      }`}
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
                      Credit Terms (Days) *
                    </label>
                    <input
                      type="number"
                      id="credit_terms_days"
                      min="0"
                      {...register('credit_terms_days', {
                        required: 'Credit terms is required',
                        min: { value: 0, message: 'Credit terms must be positive' },
                        valueAsNumber: true,
                      })}
                      className={`mt-1 block w-full rounded-md border px-3 py-2 shadow-sm focus:outline-none focus:ring-1 ${
                        errors.credit_terms_days 
                          ? 'border-red-500 focus:border-red-500 focus:ring-red-500' 
                          : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                      }`}
                    />
                    {errors.credit_terms_days && (
                      <p className="mt-1 text-sm text-red-600">{errors.credit_terms_days.message}</p>
                    )}
                  </div>
                </div>

                {/* Address Information Section */}
                {showAddressFields && (
                  <div className="pt-4 border-t border-gray-200 mt-4">
                    <h4 className="text-md font-semibold text-gray-900 mb-2">Address</h4>
                    <div>
                      <label htmlFor="address_autosuggest" className="block text-sm font-medium text-gray-700">Address *</label>
                      <input
                        type="text"
                        id="address_autosuggest"
                        value={addressInput}
                        onChange={e => {
                          setAddressInput(e.target.value);
                          setSelectedSuggestion(null);
                        }}
                        className={`mt-1 block w-full rounded-md border px-3 py-2 shadow-sm focus:outline-none focus:ring-1 ${
                          (errors.line1 || errors.city || errors.country) 
                            ? 'border-red-500 focus:border-red-500 focus:ring-red-500' 
                            : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                        }`}
                        autoComplete="off"
                        placeholder="Start typing address..."
                      />
                      {isSearching && <div className="text-xs text-gray-500 mt-1">Searching...</div>}
                      {suggestions.length > 0 && !selectedSuggestion && (
                        <ul className="border border-gray-200 rounded bg-white mt-1 max-h-48 overflow-y-auto z-10 relative">
                          {suggestions.map((s, idx) => (
                            <li
                              key={idx}
                              className="px-3 py-2 cursor-pointer hover:bg-blue-50"
                              onClick={() => {
                                setSelectedSuggestion(s);
                                setAddressInput(s.display_name);
                                // Parse and set all address fields in the form
                                setValue('line1', s.address_line1 || '');
                                setValue('line2', s.address_line2 || '');
                                setValue('city', s.city || '');
                                setValue('state', s.state || '');
                                setValue('postal_code', s.postal_code || '');
                                setValue('country', s.country || '');
                                setValue('latitude', s.lat);
                                setValue('longitude', s.lng);
                              }}
                            >
                              {s.display_name}
                            </li>
                          ))}
                        </ul>
                      )}
                      {selectedSuggestion && (
                        <div className="text-xs text-green-600 mt-1">Address selected</div>
                      )}
                      {(errors.line1 || errors.city || errors.country) && (
                        <p className="mt-1 text-sm text-red-600">
                          Please select a full address from the suggestions
                        </p>
                      )}
                    </div>
                    
                    {/* Hidden validation fields for address components */}
                    <input
                      type="hidden"
                      {...register('line1', { required: 'Street address is required' })}
                    />
                    <input
                      type="hidden"
                      {...register('city', { required: 'City is required' })}
                    />
                    <input
                      type="hidden"
                      {...register('country', { required: 'Country is required' })}
                    />
                  </div>
                )}

                {/* Under the address input, show the map if lat/lng are set */}
                {showAddressFields && latitude && longitude && (
                  <div className="mt-4">
                    <div ref={mapContainer} style={{ width: '100%', height: 200, borderRadius: 8, overflow: 'hidden', position: 'relative' }} />
                    <div className="flex justify-end mt-2">
                      {!isPinDraggable ? (
                        <button
                          type="button"
                          className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs"
                          onClick={() => setIsPinDraggable(true)}
                        >
                          Adjust Pin
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-xs"
                          onClick={() => setIsPinDraggable(false)}
                        >
                          Save Pin Location
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Delivery Preferences Section */}
                {showAddressFields && (
                  <>
                    <div className="pt-4 border-t border-gray-200 mt-4">
                      <h4 className="text-md font-semibold text-gray-900 mb-4">Delivery Preferences</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="delivery_window_start" className="block text-sm font-medium text-gray-700">
                            Delivery Window Start
                          </label>
                          <input
                            type="time"
                            id="delivery_window_start"
                            {...register('delivery_window_start', {
                              validate: (value) => {
                                if (value && !deliveryEnd) {
                                  return 'Please provide both start and end times for delivery window';
                                }
                                return true;
                              }
                            })}
                            className={`mt-1 block w-full rounded-md border px-3 py-2 shadow-sm focus:outline-none focus:ring-1 ${
                              errors.delivery_window_start 
                                ? 'border-red-500 focus:border-red-500 focus:ring-red-500' 
                                : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                            }`}
                          />
                          {errors.delivery_window_start && (
                            <p className="mt-1 text-sm text-red-600">{errors.delivery_window_start.message}</p>
                          )}
                        </div>

                        <div>
                          <label htmlFor="delivery_window_end" className="block text-sm font-medium text-gray-700">
                            Delivery Window End
                          </label>
                          <input
                            type="time"
                            id="delivery_window_end"
                            {...register('delivery_window_end', {
                              validate: (value) => {
                                if (value && !deliveryStart) {
                                  return 'Please provide both start and end times for delivery window';
                                }
                                if (deliveryStart && value && deliveryStart >= value) {
                                  return 'End time must be after start time';
                                }
                                return true;
                              }
                            })}
                            className={`mt-1 block w-full rounded-md border px-3 py-2 shadow-sm focus:outline-none focus:ring-1 ${
                              errors.delivery_window_end 
                                ? 'border-red-500 focus:border-red-500 focus:ring-red-500' 
                                : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                            }`}
                          />
                          {errors.delivery_window_end && (
                            <p className="mt-1 text-sm text-red-600">{errors.delivery_window_end.message}</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Instructions Section */}
                    <div className="pt-4 border-t border-gray-200 mt-4">
                      <div>
                        <label htmlFor="instructions" className="block text-sm font-medium text-gray-700">
                          Delivery Instructions
                        </label>
                        <textarea
                          id="instructions"
                          rows={3}
                          {...register('instructions')}
                          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          placeholder="Gate codes, special access requirements, loading dock information..."
                        />
                      </div>
                    </div>
                  </>
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