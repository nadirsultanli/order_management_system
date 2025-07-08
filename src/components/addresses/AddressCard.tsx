import React, { useEffect, useRef, useState } from 'react';
import { MapPin, Clock, FileText, Star, Edit, Trash2, Navigation } from 'lucide-react';
import { Address } from '../../types/address';
import { formatAddress, formatDeliveryWindow } from '../../utils/address';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

interface AddressCardProps {
  address: Address;
  onEdit: (address: Address) => void;
  onDelete: (address: Address) => void;
  onSetPrimary: (address: Address) => void;
}

export const AddressCard: React.FC<AddressCardProps> = ({
  address,
  onEdit,
  onDelete,
  onSetPrimary,
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<mapboxgl.Map | null>(null);
  const [marker, setMarker] = useState<mapboxgl.Marker | null>(null);

  const deliveryWindow = formatDeliveryWindow(
    address.delivery_window_start,
    address.delivery_window_end
  );

  useEffect(() => {
    if (!map && mapContainer.current && address.latitude && address.longitude) {
      mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_API_KEY;
      const newMap = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v11',
        center: [address.longitude, address.latitude],
        zoom: 14,
        interactive: false,
      });

      const newMarker = new mapboxgl.Marker()
        .setLngLat([address.longitude, address.latitude])
        .addTo(newMap);

      setMap(newMap);
      setMarker(newMarker);

      newMap.on('load', () => {
        newMap.resize();
      });
    }
  }, [mapContainer, address.latitude, address.longitude]);

  useEffect(() => {
    return () => {
      if (marker) marker.remove();
      if (map) map.remove();
    };
  }, []);

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-2">
          <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
          <div>
            <h4 className="font-medium text-gray-900">
              {address.label || `Address #${address.id.slice(-4)}`}
            </h4>
            {address.is_primary && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                <Star className="h-3 w-3 mr-1" />
                Primary
              </span>
            )}
          </div>
        </div>
        
        <div className="flex items-center space-x-1">
          <button
            onClick={() => onEdit(address)}
            className="p-1 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50 transition-colors"
            title="Edit address"
          >
            <Edit className="h-4 w-4" />
          </button>
          <button
            onClick={() => onDelete(address)}
            className="p-1 text-gray-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors"
            title="Delete address"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm text-gray-900">{formatAddress(address)}</p>
        
        {deliveryWindow && (
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <Clock className="h-4 w-4" />
            <span>Delivery: {deliveryWindow}</span>
          </div>
        )}

        {address.instructions && (
          <div className="flex items-start space-x-2 text-sm text-gray-600">
            <FileText className="h-4 w-4 mt-0.5" />
            <p className="line-clamp-2">{address.instructions}</p>
          </div>
        )}

        {address.latitude && address.longitude && (
          <div className="mt-3 h-32 rounded-md overflow-hidden border border-gray-200">
            <div ref={mapContainer} className="w-full h-full" />
          </div>
        )}

        {!address.is_primary && (
          <button
            onClick={() => onSetPrimary(address)}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            Set as Primary
          </button>
        )}
      </div>
    </div>
  );
};