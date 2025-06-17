import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Truck, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface TruckFormProps {
  initialData?: {
    id: string;
    fleet_number: string;
    license_plate: string;
    capacity_cyl: number;
    driver_name: string | null;
    active: boolean;
  };
  onSuccess?: () => void;
}

export const TruckForm: React.FC<TruckFormProps> = ({ initialData, onSuccess }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    fleet_number: initialData?.fleet_number || '',
    license_plate: initialData?.license_plate || '',
    capacity_cyl: initialData?.capacity_cyl || 0,
    driver_name: initialData?.driver_name || '',
    active: initialData?.active ?? true
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Validate inputs
      if (!formData.fleet_number) {
        throw new Error('Fleet number is required');
      }
      if (!formData.license_plate) {
        throw new Error('License plate is required');
      }
      if (!formData.capacity_cyl || formData.capacity_cyl <= 0) {
        throw new Error('Capacity must be greater than 0');
      }

      const data = {
        fleet_number: formData.fleet_number,
        license_plate: formData.license_plate,
        capacity_cyl: formData.capacity_cyl,
        driver_name: formData.driver_name || null,
        active: formData.active
      };

      let result;
      if (initialData?.id) {
        // Update existing truck
        const { data: updatedTruck, error } = await supabase
          .from('trucks')
          .update(data)
          .eq('id', initialData.id)
          .select()
          .single();

        if (error) throw error;
        result = updatedTruck;
      } else {
        // Create new truck
        const { data: newTruck, error } = await supabase
          .from('trucks')
          .insert([data])
          .select()
          .single();

        if (error) throw error;
        result = newTruck;
      }

      if (onSuccess) {
        onSuccess();
      } else {
        navigate(`/trucks/${result.id}`);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save truck');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">{error}</h3>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-200">
          <div className="flex items-center">
            <Truck className="h-6 w-6 text-gray-400" />
            <h3 className="ml-2 text-lg font-medium text-gray-900">
              {initialData ? 'Edit Truck' : 'New Truck'}
            </h3>
          </div>
        </div>

        <div className="px-6 py-5 space-y-6">
          <div>
            <label htmlFor="fleet_number" className="block text-sm font-medium text-gray-700">
              Fleet Number
            </label>
            <input
              type="text"
              id="fleet_number"
              value={formData.fleet_number}
              onChange={(e) => setFormData({ ...formData, fleet_number: e.target.value })}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              required
            />
          </div>

          <div>
            <label htmlFor="license_plate" className="block text-sm font-medium text-gray-700">
              License Plate
            </label>
            <input
              type="text"
              id="license_plate"
              value={formData.license_plate}
              onChange={(e) => setFormData({ ...formData, license_plate: e.target.value })}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              required
            />
          </div>

          <div>
            <label htmlFor="capacity_cyl" className="block text-sm font-medium text-gray-700">
              Capacity (Cylinders)
            </label>
            <input
              type="number"
              id="capacity_cyl"
              min="1"
              value={formData.capacity_cyl}
              onChange={(e) => setFormData({ ...formData, capacity_cyl: parseInt(e.target.value) || 0 })}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              required
            />
          </div>

          <div>
            <label htmlFor="driver_name" className="block text-sm font-medium text-gray-700">
              Driver Name
            </label>
            <input
              type="text"
              id="driver_name"
              value={formData.driver_name}
              onChange={(e) => setFormData({ ...formData, driver_name: e.target.value })}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="active"
              checked={formData.active}
              onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="active" className="ml-2 block text-sm text-gray-900">
              Active
            </label>
          </div>
        </div>

        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => navigate('/trucks')}
              className="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? (
                <div className="flex items-center">
                  <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                  Saving...
                </div>
              ) : (
                'Save Truck'
              )}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}; 