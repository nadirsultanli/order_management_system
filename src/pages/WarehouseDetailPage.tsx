import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit, Warehouse, MapPin, Calendar, Package } from 'lucide-react';
import { useWarehouse, useUpdateWarehouse } from '../hooks/useWarehouses';
import { useInventoryByWarehouseNew } from '../hooks/useInventory';
import { WarehouseForm } from '../components/warehouses/WarehouseForm';
import { CreateWarehouseData } from '../types/warehouse';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { formatDateSync } from '../utils/order';

export const WarehouseDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isEditFormOpen, setIsEditFormOpen] = useState(false);
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const [map, setMap] = useState<mapboxgl.Map | null>(null);

  const { data: warehouse, isLoading, error } = useWarehouse(id!);
  const { data: inventory = [], isLoading: inventoryLoading } = useInventoryByWarehouseNew(id!);
  const updateWarehouse = useUpdateWarehouse();

  const handleEditSubmit = async (data: CreateWarehouseData) => {
    if (warehouse) {
      try {
        await updateWarehouse.mutateAsync({ id: warehouse.id, ...data });
        setIsEditFormOpen(false);
      } catch {
        // Error handling is done in the hook
      }
    }
  };


  const formatCapacity = (capacity?: number) => {
    if (!capacity) return 'Not specified';
    return capacity.toLocaleString() + ' cylinders';
  };

  // Validate coordinates and return valid lat/lng or defaults
  const getValidCoordinates = (lat?: number, lng?: number) => {
    // Default coordinates (San Francisco, CA)
    const defaultLat = 37.7749;
    const defaultLng = -122.4194;

    // Validate latitude: must be between -90 and 90
    const validLat = typeof lat === 'number' && !isNaN(lat) && lat >= -90 && lat <= 90 ? lat : defaultLat;
    
    // Validate longitude: must be between -180 and 180
    const validLng = typeof lng === 'number' && !isNaN(lng) && lng >= -180 && lng <= 180 ? lng : defaultLng;

    return {
      latitude: validLat,
      longitude: validLng,
      isValid: validLat === lat && validLng === lng
    };
  };

  // Initialize map when warehouse data is loaded
  useEffect(() => {
    if (!warehouse?.address || !mapContainer.current) {
      return;
    }

    const accessToken = (import.meta as any).env?.VITE_MAPBOX_API_KEY;
    if (!accessToken) {
      console.warn('Mapbox access token not found');
      return;
    }

    // Get valid coordinates with fallback to defaults
    const { latitude, longitude, isValid } = getValidCoordinates(
      warehouse.address.latitude,
      warehouse.address.longitude
    );

    // Log warning if using default coordinates
    if (!isValid) {
      console.warn('Invalid warehouse coordinates detected, using default location:', {
        original: { lat: warehouse.address.latitude, lng: warehouse.address.longitude },
        fallback: { lat: latitude, lng: longitude }
      });
    }

    // Clean up existing map first
    if (map) {
      try {
        map.remove();
      } catch (error) {
        console.warn('Error removing existing map:', error);
      }
      setMap(null);
    }

    try {
      mapboxgl.accessToken = accessToken;
      const newMap = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v11',
        center: [longitude, latitude],
        zoom: isValid ? 14 : 10, // Lower zoom if using default coordinates
      });

      newMap.addControl(new mapboxgl.NavigationControl(), 'top-right');

      // Create marker with appropriate color based on validity
      const markerColor = isValid ? '#3B82F6' : '#EF4444'; // Blue for valid, red for fallback
      new mapboxgl.Marker({ 
        color: markerColor,
        anchor: 'center' 
      })
        .setLngLat([longitude, latitude])
        .addTo(newMap);

      newMap.on('load', () => {
        try {
          newMap.resize();
        } catch (error) {
          console.warn('Error resizing map:', error);
        }
      });

      setMap(newMap);
    } catch (error) {
      console.error('Error initializing map:', error);
    }
  }, [warehouse?.address?.latitude, warehouse?.address?.longitude]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      if (map) {
        try {
          map.remove();
        } catch (error) {
          console.warn('Error cleaning up map:', error);
        }
        setMap(null);
      }
    };
  }, [map]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/warehouses')}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Warehouses</span>
          </button>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
            <div className="space-y-3">
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              <div className="h-4 bg-gray-200 rounded w-1/3"></div>
              <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !warehouse) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/warehouses')}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Warehouses</span>
          </button>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          <div className="text-center">
            <p className="text-red-600">Warehouse not found or error loading warehouse details.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/warehouses')}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Warehouses</span>
          </button>
          <div className="text-gray-400">/</div>
          <h1 className="text-2xl font-bold text-gray-900">{warehouse.name}</h1>
        </div>
        <button
          onClick={() => setIsEditFormOpen(true)}
          className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Edit className="h-4 w-4" />
          <span>Edit Warehouse</span>
        </button>
      </div>

      {/* Warehouse Information */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Information */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Warehouse Information</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">
                  Warehouse Name
                </label>
                <div className="flex items-center space-x-2">
                  <Warehouse className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-900">{warehouse.name}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">
                  Storage Capacity
                </label>
                <div className="flex items-center space-x-2">
                  <Package className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-900">{formatCapacity(warehouse.capacity_cylinders)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Address Information */}
          {warehouse.address && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Location</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    Physical Address
                  </label>
                  <div className="flex items-start space-x-2">
                    <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
                    <div className="text-gray-900">
                      <div>{warehouse.address.line1}</div>
                      {warehouse.address.line2 && <div>{warehouse.address.line2}</div>}
                      <div>
                        {warehouse.address.city}
                        {warehouse.address.state && `, ${warehouse.address.state}`}
                        {warehouse.address.postal_code && ` ${warehouse.address.postal_code}`}
                      </div>
                      <div>{warehouse.address.country}</div>
                    </div>
                  </div>
                </div>

                {/* Map */}
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-2">
                    Map Location
                  </label>
                  {(() => {
                    const { isValid } = getValidCoordinates(
                      warehouse.address.latitude,
                      warehouse.address.longitude
                    );
                    return !isValid && (
                      <div className="mb-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
                        Warning: Invalid coordinates detected. Showing default location (San Francisco, CA).
                      </div>
                    );
                  })()}
                  <div 
                    ref={mapContainer}
                    className="w-full h-64 rounded-lg border border-gray-300"
                    style={{ minHeight: '256px' }}
                  />
                </div>

                {warehouse.address.instructions && (
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">
                      Access Instructions
                    </label>
                    <p className="text-gray-900">{warehouse.address.instructions}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Warehouse Details */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Details</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">
                  Created
                </label>
                <div className="flex items-center space-x-2">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-900">
                    {formatDateSync(warehouse.created_at)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Current Inventory */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Current Inventory</h3>
            {inventoryLoading ? (
              <div className="flex justify-center py-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
                         ) : inventory.length > 0 ? (
               <div className="space-y-3">
                 {inventory.map((item) => (
                   <div key={item.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                     <div className="flex items-center justify-between mb-3">
                       <div>
                         <div className="font-semibold text-gray-900">{item.product?.name}</div>
                         <div className="text-sm text-gray-500">SKU: {item.product?.sku}</div>
                       </div>
                       <div className="flex items-center space-x-2">
                         <Package className="h-4 w-4 text-gray-400" />
                         <span className="text-sm font-medium text-gray-600">{item.product?.unit_of_measure}</span>
                       </div>
                     </div>
                     
                     <div className="grid grid-cols-3 gap-3">
                       <div className="bg-green-50 rounded-lg p-3 text-center border border-green-200">
                         <div className="text-2xl font-bold text-green-700">{item.qty_full}</div>
                         <div className="text-xs font-medium text-green-600 uppercase tracking-wide">Full</div>
                       </div>
                       
                       <div className="bg-gray-100 rounded-lg p-3 text-center border border-gray-300">
                         <div className="text-2xl font-bold text-gray-700">{item.qty_empty}</div>
                         <div className="text-xs font-medium text-gray-600 uppercase tracking-wide">Empty</div>
                       </div>
                       
                       <div className={`rounded-lg p-3 text-center border ${
                         item.qty_reserved > 0 
                           ? 'bg-yellow-50 border-yellow-200' 
                           : 'bg-blue-50 border-blue-200'
                       }`}>
                         <div className={`text-2xl font-bold ${
                           item.qty_reserved > 0 ? 'text-yellow-700' : 'text-blue-700'
                         }`}>
                           {item.qty_reserved}
                         </div>
                         <div className={`text-xs font-medium uppercase tracking-wide ${
                           item.qty_reserved > 0 ? 'text-yellow-600' : 'text-blue-600'
                         }`}>
                           Reserved
                         </div>
                       </div>
                     </div>
                     
                     <div className="mt-3 pt-3 border-t border-gray-200">
                       <div className="flex justify-between items-center text-sm">
                         <span className="text-gray-500">Available:</span>
                         <span className="font-semibold text-gray-900">
                           {item.qty_full - item.qty_reserved} units
                         </span>
                       </div>
                     </div>
                   </div>
                 ))}
               </div>
            ) : (
              <div className="text-center py-4">
                <Package className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">
                  This warehouse has no inventory yet.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Form Modal */}
      <WarehouseForm
        isOpen={isEditFormOpen}
        onClose={() => setIsEditFormOpen(false)}
        onSubmit={handleEditSubmit}
        warehouse={warehouse}
        loading={updateWarehouse.isPending}
        title="Edit Warehouse"
      />
    </div>
  );
};