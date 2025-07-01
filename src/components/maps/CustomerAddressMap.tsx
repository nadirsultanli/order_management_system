import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { MapPin, Navigation, Edit, Truck, Route, Target } from 'lucide-react';
import { Address } from '../../types/address';
import { formatAddress, formatDeliveryWindow } from '../../utils/address';

interface CustomerAddressMapProps {
  addresses: Address[];
  selectedAddressId?: string;
  onAddressSelect?: (address: Address) => void;
  onAddressEdit?: (address: Address) => void;
  showRoute?: boolean;
  truckLocation?: { latitude: number; longitude: number };
  className?: string;
}

export const CustomerAddressMap: React.FC<CustomerAddressMapProps> = ({
  addresses,
  selectedAddressId,
  onAddressSelect,
  onAddressEdit,
  showRoute = false,
  truckLocation,
  className = "",
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<{ [key: string]: mapboxgl.Marker }>({});
  const truckMarker = useRef<mapboxgl.Marker | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Filter addresses with valid coordinates
  const validAddresses = addresses.filter(addr => 
    addr.latitude != null && addr.longitude != null
  );

  useEffect(() => {
    if (!mapContainer.current || validAddresses.length === 0) return;

    mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_API_KEY;

    // Initialize map
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v11',
      center: [validAddresses[0].longitude!, validAddresses[0].latitude!],
      zoom: 12,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
    map.current.addControl(new mapboxgl.FullscreenControl(), 'top-right');

    map.current.on('load', () => {
      setMapLoaded(true);
    });

    return () => {
      // Cleanup markers
      Object.values(markers.current).forEach(marker => marker.remove());
      if (truckMarker.current) truckMarker.current.remove();
      if (map.current) map.current.remove();
    };
  }, []);

  // Update markers when addresses change
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    // Clear existing markers
    Object.values(markers.current).forEach(marker => marker.remove());
    markers.current = {};

    // Add address markers
    validAddresses.forEach((address) => {
      const isSelected = address.id === selectedAddressId;
      
      // Create marker element
      const markerElement = document.createElement('div');
      markerElement.className = `
        w-8 h-8 rounded-full border-2 cursor-pointer transition-all
        ${isSelected 
          ? 'bg-blue-600 border-blue-700 shadow-lg' 
          : address.is_primary 
            ? 'bg-green-500 border-green-600' 
            : 'bg-gray-500 border-gray-600'
        }
      `;
      markerElement.innerHTML = `
        <div class="w-full h-full flex items-center justify-center">
          <svg class="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd" />
          </svg>
        </div>
      `;

      // Create popup content
      const deliveryWindow = formatDeliveryWindow(
        address.delivery_window_start,
        address.delivery_window_end
      );

      const popupContent = `
        <div class="p-3 min-w-[250px]">
          <div class="flex items-start justify-between mb-2">
            <h3 class="font-semibold text-gray-900">${address.label || 'Address'}</h3>
            ${address.is_primary ? '<span class="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">Primary</span>' : ''}
          </div>
          <div class="text-sm text-gray-700 mb-3">
            ${formatAddress(address)}
          </div>
          ${deliveryWindow ? `
            <div class="flex items-center text-sm text-gray-600 mb-2">
              <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd" />
              </svg>
              ${deliveryWindow}
            </div>
          ` : ''}
          ${address.instructions ? `
            <div class="text-sm text-gray-600 mb-3">
              <strong>Instructions:</strong> ${address.instructions}
            </div>
          ` : ''}
          <div class="flex space-x-2">
            <button 
              onclick="window.selectAddress('${address.id}')"
              class="flex-1 bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
            >
              Select
            </button>
            <button 
              onclick="window.editAddress('${address.id}')"
              class="bg-gray-600 text-white px-3 py-1 rounded text-sm hover:bg-gray-700"
            >
              Edit
            </button>
          </div>
        </div>
      `;

      const popup = new mapboxgl.Popup({
        offset: 25,
        closeButton: true,
        closeOnClick: false,
      }).setHTML(popupContent);

      const marker = new mapboxgl.Marker({ element: markerElement })
        .setLngLat([address.longitude!, address.latitude!])
        .setPopup(popup)
        .addTo(map.current!);

      markers.current[address.id] = marker;

      // Add click handler
      markerElement.addEventListener('click', () => {
        if (onAddressSelect) {
          onAddressSelect(address);
        }
      });
    });

    // Fit map to markers
    if (validAddresses.length > 1) {
      const bounds = new mapboxgl.LngLatBounds();
      validAddresses.forEach(address => {
        bounds.extend([address.longitude!, address.latitude!]);
      });
      map.current.fitBounds(bounds, { padding: 50 });
    } else if (validAddresses.length === 1) {
      map.current.setCenter([validAddresses[0].longitude!, validAddresses[0].latitude!]);
      map.current.setZoom(14);
    }
  }, [validAddresses, selectedAddressId, mapLoaded]);

  // Update truck marker
  useEffect(() => {
    if (!map.current || !mapLoaded || !truckLocation) return;

    if (truckMarker.current) {
      truckMarker.current.remove();
    }

    // Create truck marker
    const truckElement = document.createElement('div');
    truckElement.className = 'w-10 h-10 bg-orange-500 border-2 border-orange-600 rounded-full flex items-center justify-center shadow-lg';
    truckElement.innerHTML = `
      <svg class="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
        <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
        <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1v-5a1 1 0 00-.293-.707L16 7.586A1 1 0 0015.414 7H14z" />
      </svg>
    `;

    const truckPopup = new mapboxgl.Popup({
      offset: 25,
      closeButton: false,
    }).setHTML(`
      <div class="p-2">
        <div class="flex items-center space-x-2">
          <svg class="w-4 h-4 text-orange-600" fill="currentColor" viewBox="0 0 20 20">
            <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
            <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1v-5a1 1 0 00-.293-.707L16 7.586A1 1 0 0015.414 7H14z" />
          </svg>
          <span class="font-medium text-gray-900">Delivery Truck</span>
        </div>
        <div class="text-sm text-gray-600 mt-1">Current Location</div>
      </div>
    `);

    truckMarker.current = new mapboxgl.Marker({ element: truckElement })
      .setLngLat([truckLocation.longitude, truckLocation.latitude])
      .setPopup(truckPopup)
      .addTo(map.current);
  }, [truckLocation, mapLoaded]);

  // Global functions for popup buttons
  useEffect(() => {
    (window as any).selectAddress = (addressId: string) => {
      const address = addresses.find(a => a.id === addressId);
      if (address && onAddressSelect) {
        onAddressSelect(address);
      }
    };

    (window as any).editAddress = (addressId: string) => {
      const address = addresses.find(a => a.id === addressId);
      if (address && onAddressEdit) {
        onAddressEdit(address);
      }
    };

    return () => {
      delete (window as any).selectAddress;
      delete (window as any).editAddress;
    };
  }, [addresses, onAddressSelect, onAddressEdit]);

  if (validAddresses.length === 0) {
    return (
      <div className={`bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-12 text-center ${className}`}>
        <MapPin className="h-12 w-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Address Locations</h3>
        <p className="text-gray-500 mb-4">
          Add geocoded addresses to see them on the map
        </p>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {/* Map Container */}
      <div 
        ref={mapContainer}
        className="w-full h-full min-h-[400px] rounded-lg overflow-hidden border border-gray-300"
      />

      {/* Map Controls */}
      <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg p-3 space-y-2">
        <div className="flex items-center space-x-2 text-sm">
          <div className="w-4 h-4 bg-green-500 rounded-full border border-green-600"></div>
          <span>Primary Address</span>
        </div>
        <div className="flex items-center space-x-2 text-sm">
          <div className="w-4 h-4 bg-gray-500 rounded-full border border-gray-600"></div>
          <span>Other Addresses</span>
        </div>
        <div className="flex items-center space-x-2 text-sm">
          <div className="w-4 h-4 bg-blue-600 rounded-full border border-blue-700"></div>
          <span>Selected</span>
        </div>
        {truckLocation && (
          <div className="flex items-center space-x-2 text-sm">
            <div className="w-4 h-4 bg-orange-500 rounded-full border border-orange-600"></div>
            <span>Delivery Truck</span>
          </div>
        )}
      </div>

      {/* Address Count */}
      <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg px-3 py-2">
        <div className="flex items-center space-x-2 text-sm">
          <Target className="h-4 w-4 text-gray-600" />
          <span className="font-medium text-gray-900">
            {validAddresses.length} {validAddresses.length === 1 ? 'Address' : 'Addresses'}
          </span>
        </div>
      </div>
    </div>
  );
}; 