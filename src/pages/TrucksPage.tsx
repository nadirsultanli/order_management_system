import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { TruckTable } from '../components/trucks/TruckTable';
import { TruckInventoryItem } from '../lib/transfers';

interface TruckWithInventory {
  id: string;
  fleet_number: string;
  license_plate: string;
  capacity_cyl: number;
  driver_name: string | null;
  active: boolean;
  inventory: TruckInventoryItem[];
}

export const TrucksPage: React.FC = () => {
  const [trucks, setTrucks] = useState<TruckWithInventory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTrucks();
  }, []);

  const loadTrucks = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get all trucks
      const { data: trucksData, error: trucksError } = await supabase
        .from('truck')
        .select('*')
        .order('fleet_number');

      if (trucksError) throw trucksError;

      // Get inventory for all trucks
      const trucksWithInventory = await Promise.all(
        trucksData.map(async (truck) => {
          const { data: inventoryData } = await supabase
            .from('truck_inventory')
            .select(`
              *,
              product:product_id (
                name,
                sku
              )
            `)
            .eq('truck_id', truck.id);

          return {
            ...truck,
            inventory: (inventoryData || []).map((item) => ({
              product_id: item.product_id,
              product_name: item.product.name,
              product_sku: item.product.sku,
              qty_full: item.qty_full,
              qty_empty: item.qty_empty,
              updated_at: item.updated_at
            }))
          };
        })
      );

      setTrucks(trucksWithInventory);
    } catch (err: any) {
      setError(err.message || 'Failed to load trucks');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (truck: TruckWithInventory, newStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('truck')
        .update({ active: newStatus })
        .eq('id', truck.id);

      if (error) throw error;

      setTrucks(trucks.map(t => 
        t.id === truck.id ? { ...t, active: newStatus } : t
      ));
    } catch (err: any) {
      console.error('Error updating truck status:', err);
      alert('Failed to update truck status. Please try again.');
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Trucks</h1>
          <p className="mt-2 text-sm text-gray-600">
            Manage your fleet and monitor truck inventory
          </p>
        </div>
        <Link
          to="/trucks/new"
          className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="-ml-1 mr-2 h-5 w-5" />
          Add Truck
        </Link>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4 mb-8">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">{error}</h3>
            </div>
          </div>
        </div>
      )}

      <TruckTable 
        trucks={trucks} 
        loading={loading} 
        onStatusChange={handleStatusChange}
      />
    </div>
  );
}; 