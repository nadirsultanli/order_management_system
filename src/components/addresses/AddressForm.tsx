import React, { useEffect, useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { X, Loader2 } from 'lucide-react';
import { Address, CreateAddressData } from '../../types/address';
import { getGeocodeSuggestions } from '../../utils/geocoding';
// @ts-ignore - mapbox-gl types not available
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

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

// Extended form data interface for the flat form fields (matching CustomerForm pattern)
interface AddressFormData extends Omit<CreateAddressData, 'customer_id'> {
  customer_id: string;
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
  const [addressInput, setAddressInput] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<any>(null);
  const [map, setMap] = useState<any>(null);
  const [marker, setMarker] = useState<any>(null);
  const [isPinDraggable, setIsPinDraggable] = useState(false);
  const [mapError, setMapError] = useState<string>('');
  const mapContainer = useRef<HTMLDivElement>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    clearErrors,
    formState: { errors },
  } = useForm<AddressFormData>({
    defaultValues: {
      customer_id: customerId,
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

  const latitude = watch('latitude');
  const longitude = watch('longitude');
  const deliveryStart = watch('delivery_window_start');
  const deliveryEnd = watch('delivery_window_end');
  const line1 = watch('line1');
  const city = watch('city');
  const country = watch('country');

  // Initialize form data when address prop changes
  useEffect(() => {
    if (address) {
      // Edit mode - populate all fields and address input
      reset({
        customer_id: address.customer_id,
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
      
      // Set the address input display text for editing
      const addressParts = [
        address.line1,
        address.line2,
        address.city,
        address.state,
        address.postal_code,
      ].filter(Boolean);
      setAddressInput(addressParts.join(', '));
      setSelectedSuggestion({ display_name: addressParts.join(', ') }); // Mark as selected
    } else {
      // Add mode - start fresh
      reset({
        customer_id: customerId,
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
        latitude: undefined,
        longitude: undefined,
      });
      setAddressInput('');
      setSelectedSuggestion(null);
    }
  }, [address, customerId, isFirstAddress, reset]);

  // Clear map when form is closed or opened
  useEffect(() => {
    if (!isOpen) {
      // Clean up map when modal closes
      if (marker) {
        marker.remove();
        setMarker(null);
      }
      if (map) {
        map.remove();
        setMap(null);
      }
      setMapError('');
    }
  }, [isOpen, map, marker]);

  // Address autocomplete effect
  useEffect(() => {
    let active = true;
    // Only search when not in edit mode with a selected suggestion, or when user is actively typing
    if (addressInput && addressInput.length >= 3 && (!selectedSuggestion || selectedSuggestion.display_name !== addressInput)) {
      setIsSearching(true);
      getGeocodeSuggestions(addressInput, setIsSearching).then((results) => {
        if (active) setSuggestions(results || []);
      });
    } else {
      setSuggestions([]);
      setIsSearching(false);
    }
    return () => { active = false; };
  }, [addressInput, selectedSuggestion]);

  // Map initialization effect
  useEffect(() => {
    const apiKey = import.meta.env.VITE_MAPBOX_API_KEY;
    
    if (!map && mapContainer.current && latitude && longitude && isOpen) {
      if (!apiKey) {
        setMapError('Mapbox API key not configured. Please set VITE_MAPBOX_API_KEY in your environment variables.');
        return;
      }

      try {
        mapboxgl.accessToken = apiKey;
        const newMap = new mapboxgl.Map({
          container: mapContainer.current,
          style: 'mapbox://styles/mapbox/streets-v11',
          center: [longitude, latitude],
          zoom: 14,
        });
        
        newMap.addControl(new mapboxgl.NavigationControl(), 'top-right');
        
        const newMarker = new mapboxgl.Marker({ 
          anchor: 'center', 
          draggable: isPinDraggable 
        })
          .setLngLat([longitude, latitude])
          .addTo(newMap);

        newMarker.on('dragend', () => {
          const lngLat = newMarker.getLngLat();
          setValue('latitude', lngLat.lat);
          setValue('longitude', lngLat.lng);
        });

        newMap.on('load', () => {
          newMap.resize();
        });

        newMap.on('error', (e: any) => {
          console.error('Mapbox error:', e);
          setMapError('Failed to load map. Please check your internet connection.');
        });

        setMap(newMap);
        setMarker(newMarker);
        setMapError('');
      } catch (error) {
        console.error('Error initializing map:', error);
        setMapError('Failed to initialize map. Please check your Mapbox configuration.');
      }
    }
  }, [mapContainer, latitude, longitude, isOpen, isPinDraggable, setValue]);

  // Map update effect
  useEffect(() => {
    if (map && marker && latitude && longitude) {
      marker.setLngLat([longitude, latitude]);
      marker.setDraggable(isPinDraggable);
      map.setCenter([longitude, latitude]);
      map.setZoom(14);
      
      // Ensure map resizes properly
      setTimeout(() => {
        map.resize();
      }, 100);
    }
  }, [latitude, longitude, isPinDraggable, map, marker]);

  const handleSuggestionSelect = (suggestion: any) => {
    setSelectedSuggestion(suggestion);
    setAddressInput(suggestion.display_name);
    setSuggestions([]);
    
    // Parse and set all address fields in the form
    setValue('line1', suggestion.address_line1 || '');
    setValue('line2', suggestion.address_line2 || '');
    setValue('city', suggestion.city || '');
    setValue('state', suggestion.state || '');
    setValue('postal_code', suggestion.postal_code || '');
    setValue('country', suggestion.country || '');
    setValue('latitude', suggestion.lat);
    setValue('longitude', suggestion.lng);
    
    // Clear any validation errors since we now have a complete address
    clearErrors(['line1', 'city', 'country']);
  };

  const handleAddressInputChange = (value: string) => {
    setAddressInput(value);
    if (selectedSuggestion && selectedSuggestion.display_name !== value) {
      setSelectedSuggestion(null);
    }
  };

  const handleFormSubmit = (data: AddressFormData) => {
    console.log('Submitting address form:', data);
    onSubmit(data);
  };

  if (!isOpen) return null;

  const hasValidCoordinates = latitude && longitude;
  const hasValidAddressFields = line1 && city && country;
  const shouldShowValidationError = (errors.line1 || errors.city || errors.country) && !hasValidAddressFields;

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
                {/* Address Search Input */}
                <div>
                  <label htmlFor="address_autosuggest" className="block text-sm font-medium text-gray-700">Address *</label>
                  <input
                    type="text"
                    id="address_autosuggest"
                    value={addressInput}
                    onChange={e => handleAddressInputChange(e.target.value)}
                    className={`mt-1 block w-full rounded-md border px-3 py-2 shadow-sm focus:outline-none focus:ring-1 ${
                      (errors.line1 || errors.city || errors.country) 
                        ? 'border-red-500 focus:border-red-500 focus:ring-red-500' 
                        : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                    }`}
                    autoComplete="off"
                    placeholder="Start typing address..."
                  />
                  {isSearching && <div className="text-xs text-gray-500 mt-1">Searching...</div>}
                  {suggestions.length > 0 && (
                    <ul className="border border-gray-200 rounded bg-white mt-1 max-h-48 overflow-y-auto z-10 relative">
                      {suggestions.map((s, idx) => (
                        <li
                          key={idx}
                          className="px-3 py-2 cursor-pointer hover:bg-blue-50"
                          onClick={() => handleSuggestionSelect(s)}
                        >
                          {s.display_name}
                        </li>
                      ))}
                    </ul>
                  )}
                  {selectedSuggestion && hasValidAddressFields && (
                    <div className="text-xs text-green-600 mt-1">Address selected</div>
                  )}
                  {shouldShowValidationError && (
                    <p className="mt-1 text-sm text-red-600">
                      Please select a complete address from the suggestions
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

                {/* Map Display */}
                {hasValidCoordinates && (
                  <div className="mt-4">
                    {mapError ? (
                      <div className="bg-red-50 border border-red-200 rounded-md p-3">
                        <p className="text-sm text-red-600">{mapError}</p>
                      </div>
                    ) : (
                      <>
                        <div 
                          ref={mapContainer} 
                          style={{ 
                            width: '100%', 
                            height: 200, 
                            borderRadius: 8, 
                            overflow: 'hidden', 
                            position: 'relative',
                            backgroundColor: '#f3f4f6'
                          }} 
                        />
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
                      </>
                    )}
                  </div>
                )}

                {/* Delivery Preferences */}
                <div className="pt-4 border-t border-gray-200">
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

                  <div className="mt-4">
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

                {/* Instructions */}
                <div className="pt-4 border-t border-gray-200">
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