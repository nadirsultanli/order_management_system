import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { X, Loader2, MapPin } from 'lucide-react';
import { Warehouse, CreateWarehouseData } from '../../types/warehouse';
import { getCountryOptions } from '../../utils/address';
import { AddressForm } from '../addresses/AddressForm';
import { getGeocodeSuggestions } from '../../utils/geocoding';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

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
  const [includeAddress, setIncludeAddress] = useState(true);
  const [addressInput, setAddressInput] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<any>(null);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const mapContainer = React.useRef<HTMLDivElement | null>(null);
  const [map, setMap] = useState<mapboxgl.Map | null>(null);
  const [marker, setMarker] = useState<mapboxgl.Marker | null>(null);
  const [isPinDraggable, setIsPinDraggable] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
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
        latitude: undefined,
        longitude: undefined,
      },
    },
  });

  const latitude = watch('address.latitude');
  const longitude = watch('address.longitude');

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
          latitude: warehouse.address.latitude,
          longitude: warehouse.address.longitude,
        } : {
          line1: '',
          line2: '',
          city: '',
          state: '',
          postal_code: '',
          country: 'US',
          instructions: '',
          latitude: undefined,
          longitude: undefined,
        },
      });
      setAddressInput(
        warehouse.address
          ? [
              warehouse.address.line1,
              warehouse.address.city,
              warehouse.address.state,
              warehouse.address.postal_code,
              warehouse.address.country,
            ]
              .filter(Boolean)
              .join(', ')
          : ''
      );
    } else {
      setIncludeAddress(true);
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
          latitude: undefined,
          longitude: undefined,
        },
      });
      setAddressInput('');
    }
  }, [warehouse, reset]);

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
        setValue('address.latitude', lngLat.lat);
        setValue('address.longitude', lngLat.lng);
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

  const handleFormSubmit = (data: CreateWarehouseData) => {
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
                {/* Basic Information */}
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-4">Basic Information</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                        Warehouse Name <span className="text-red-600">*</span>
                      </label>
                      <input
                        type="text"
                        id="name"
                        {...register('name', { required: 'This field is required.' })}
                        className={`mt-1 block w-full rounded-md border px-3 py-2 shadow-sm focus:outline-none focus:ring-1 ${errors.name ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'}`}
                        placeholder="Main Depot"
                      />
                      {errors.name && (
                        <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
                      )}
                    </div>
                    <div>
                      <label htmlFor="capacity_cylinders" className="block text-sm font-medium text-gray-700">
                        Storage Capacity (cylinders) <span className="text-red-600">*</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        id="capacity_cylinders"
                        {...register('capacity_cylinders', {
                          required: 'This field is required.',
                          valueAsNumber: true,
                          min: { value: 1, message: 'Capacity must be at least 1' },
                        })}
                        className={`mt-1 block w-full rounded-md border px-3 py-2 shadow-sm focus:outline-none focus:ring-1 ${errors.capacity_cylinders ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'}`}
                        placeholder="1000"
                      />
                      {errors.capacity_cylinders && (
                        <p className="mt-1 text-sm text-red-600">{errors.capacity_cylinders.message}</p>
                      )}
                    </div>
                  </div>
                </div>
                {/* Location Section */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-medium text-gray-900">Location</h4>
                  </div>
                  {includeAddress && (
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <label htmlFor="addressInput" className="block text-sm font-medium text-gray-700">
                        Address <span className="text-red-600">*</span>
                      </label>
                      <input
                        type="text"
                        id="addressInput"
                        value={addressInput}
                        onChange={e => {
                          setAddressInput(e.target.value);
                          setSelectedSuggestion(null);
                        }}
                        className={`mt-1 block w-full rounded-md border px-3 py-2 shadow-sm focus:outline-none focus:ring-1 ${(errors.address?.line1 || errors.address?.city || errors.address?.country) ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'}`}
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
                                setValue('address.line1', s.address_line1 || '');
                                setValue('address.line2', s.address_line2 || '');
                                setValue('address.city', s.city || '');
                                setValue('address.state', s.state || '');
                                setValue('address.postal_code', s.postal_code || '');
                                setValue('address.country', s.country || '');
                                setValue('address.latitude', s.lat);
                                setValue('address.longitude', s.lng);
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
                      {/* Address field validation errors */}
                      {errors.address?.line1 && (
                        <p className="mt-1 text-sm text-red-600">Address is required.</p>
                      )}
                      {/* Hidden validation fields for address components */}
                      <input type="hidden" {...register('address.line1', { required: 'This field is required.' })} />
                      <input type="hidden" {...register('address.city')} />
                      <input type="hidden" {...register('address.country')} />
                      <label htmlFor="address.instructions" className="block text-sm font-medium text-gray-700 mt-4">
                        Access Instructions <span className="text-red-600">*</span>
                      </label>
                      <textarea
                        rows={2}
                        {...register('address.instructions', { required: 'This field is required.' })}
                        className={`mt-1 block w-full rounded-md border px-3 py-2 shadow-sm focus:outline-none focus:ring-1 ${errors.address?.instructions ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'}`}
                        placeholder="Gate codes, special access requirements, loading dock information..."
                      />
                      {errors.address?.instructions && (
                        <p className="mt-1 text-sm text-red-600">{errors.address.instructions.message}</p>
                      )}
                      {/* Show the map if lat/lng are set */}
                      {latitude && longitude && (
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
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse">
              <button
                type="submit"
                className="inline-flex w-full justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm"
                disabled={loading}
              >
                {loading ? <Loader2 className="animate-spin h-5 w-5 mr-2" /> : null}
                Save
              </button>
              <button
                type="button"
                className="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                onClick={onClose}
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