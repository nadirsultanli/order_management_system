import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { TruckInventory } from '../components/trucks/TruckInventory';
import { Truck, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface TruckDetails {
  id: string;
  fleet_number: string;
  license_plate: string;
  capacity_cyl: number;
  driver_name: string;
  active: boolean;
}

export const TruckDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [truck, setTruck] = useState<TruckDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTruck();
  }, [id]);

  const loadTruck = async () => {
    if (!id) return;

    try {
      setLoading(true);
      setError(null);
      
      const { data, error } = await supabase
        .from('trucks')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setTruck(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load truck details');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error || !truck) {
    return (
      <div className="rounded-md bg-red-50 p-4">
        <div className="flex">
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">
              {error || 'Truck not found'}
            </h3>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="bg-white shadow rounded-lg overflow-hidden">
        {/* Truck Details Header */}
        <div className="px-6 py-5 border-b border-gray-200">
          <div className="flex items-center">
            <Truck className="h-8 w-8 text-gray-400" />
            <div className="ml-4">
              <h2 className="text-2xl font-bold text-gray-900">
                {truck.fleet_number}
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                License Plate: {truck.license_plate}
              </p>
            </div>
          </div>
        </div>

        {/* Truck Details Grid */}
        <div className="px-6 py-5 grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <h3 className="text-lg font-medium text-gray-900">Details</h3>
            <dl className="mt-4 space-y-4">
              <div>
                <dt className="text-sm font-medium text-gray-500">Driver</dt>
                <dd className="mt-1 text-sm text-gray-900">{truck.driver_name || 'Not assigned'}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Capacity</dt>
                <dd className="mt-1 text-sm text-gray-900">{truck.capacity_cyl} cylinders</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Status</dt>
                <dd className="mt-1">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    truck.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {truck.active ? 'Active' : 'Inactive'}
                  </span>
                </dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Inventory Section */}
        <div className="px-6 py-5 border-t border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Current Inventory</h3>
          <TruckInventory truckId={id} />
        </div>
      </div>
    </div>
  );
}; 