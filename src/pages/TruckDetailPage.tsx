import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Truck, Package, Edit, ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { TruckForm } from '../components/trucks/TruckForm';
import { TruckInventoryItem } from '../lib/transfers';

interface TruckDetails {
  id: string;
  fleet_number: string;
  license_plate: string;
  capacity_cyl: number;
  driver_name: string | null;
  active: boolean;
  inventory: TruckInventoryItem[];
}

export const TruckDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [truck, setTruck] = useState<TruckDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (id) {
      loadTruckDetails();
    }
  }, [id]);

  const loadTruckDetails = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get truck details
      const { data: truckData, error: truckError } = await supabase
        .from('truck')
        .select('*')
        .eq('id', id)
        .single();

      if (truckError) throw truckError;

      // Get truck inventory
      const { data: inventoryData, error: inventoryError } = await supabase
        .from('truck_inventory')
        .select(`
          *,
          product:product_id (
            name,
            sku
          )
        `)
        .eq('truck_id', id);

      if (inventoryError) throw inventoryError;

      setTruck({
        ...truckData,
        inventory: (inventoryData || []).map((item) => ({
          product_id: item.product_id,
          product_name: item.product.name,
          product_sku: item.product.sku,
          qty_full: item.qty_full,
          qty_empty: item.qty_empty,
          updated_at: item.updated_at
        }))
      });
    } catch (err: any) {
      setError(err.message || 'Failed to load truck details');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (error || !truck) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="rounded-md bg-red-50 p-4">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                {error || 'Truck not found'}
              </h3>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isEditing) {
    return (
      <div className="container mx-auto px-4 py-8">
        <button
          onClick={() => setIsEditing(false)}
          className="mb-6 inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Details
        </button>
        <TruckForm
          initialData={truck}
          onSuccess={() => {
            setIsEditing(false);
            loadTruckDetails();
          }}
        />
      </div>
    );
  }

  const totalCylinders = truck.inventory.reduce(
    (sum, item) => sum + (item.qty_full || 0) + (item.qty_empty || 0),
    0
  );
  const capacityPercentage = (totalCylinders / truck.capacity_cyl) * 100;
  const isOverloaded = capacityPercentage > 100;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <button
          onClick={() => navigate('/trucks')}
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Trucks
        </button>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <Truck className="h-6 w-6 text-gray-400" />
              <h1 className="ml-2 text-xl font-semibold text-gray-900">
                {truck.fleet_number}
              </h1>
              <span className={`ml-4 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                truck.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {truck.active ? 'Active' : 'Inactive'}
              </span>
            </div>
            <button
              onClick={() => setIsEditing(true)}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </button>
          </div>
        </div>

        <div className="px-6 py-5 grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Truck Information</h3>
            <dl className="grid grid-cols-1 gap-4">
              <div>
                <dt className="text-sm font-medium text-gray-500">License Plate</dt>
                <dd className="mt-1 text-sm text-gray-900">{truck.license_plate}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Driver</dt>
                <dd className="mt-1 text-sm text-gray-900">{truck.driver_name || 'Unassigned'}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Capacity</dt>
                <dd className="mt-1 text-sm text-gray-900">{truck.capacity_cyl} cylinders</dd>
              </div>
            </dl>
          </div>

          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Current Load</h3>
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-500">
                  {totalCylinders} / {truck.capacity_cyl} cylinders
                </span>
                {isOverloaded && (
                  <span className="text-xs font-medium text-red-600">Overloaded</span>
                )}
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${
                    isOverloaded ? 'bg-red-500' : 'bg-blue-500'
                  }`}
                  style={{ width: `${Math.min(capacityPercentage, 100)}%` }}
                />
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-900 mb-3">Inventory Breakdown</h4>
              {truck.inventory.length === 0 ? (
                <p className="text-sm text-gray-500">No inventory items</p>
              ) : (
                <div className="space-y-3">
                  {truck.inventory.map((item) => (
                    <div key={item.product_id} className="flex items-start">
                      <Package className="h-5 w-5 text-gray-400 mt-0.5" />
                      <div className="ml-3">
                        <p className="text-sm font-medium text-gray-900">
                          {item.product_name}
                        </p>
                        <p className="text-xs text-gray-500">SKU: {item.product_sku}</p>
                        <div className="mt-1 flex space-x-4">
                          <span className="text-xs text-gray-500">
                            Full: {item.qty_full || 0}
                          </span>
                          <span className="text-xs text-gray-500">
                            Empty: {item.qty_empty || 0}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}; 