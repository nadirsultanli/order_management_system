import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Truck, Loader2, Calendar, MapPin, User } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { useCreateTrip } from '../hooks/useTrips';
import { useTrucks } from '../hooks/useTrucks';
import { useWarehouseOptions } from '../hooks/useWarehouses';
import { useDrivers } from '../hooks/useUsers';
import { SearchableTruckSelector } from '../components/trucks/SearchableTruckSelector';
import { SearchableWarehouseSelector } from '../components/warehouses/SearchableWarehouseSelector';
import { SearchableDriverSelector } from '../components/trucks/SearchableDriverSelector';

export const CreateTripPage: React.FC = () => {
  const navigate = useNavigate();
  const createTrip = useCreateTrip();
  const { data: trucksData, isLoading: trucksLoading } = useTrucks();
  const { data: warehouses, isLoading: warehousesLoading } = useWarehouseOptions();
  const { data: driversData, isLoading: driversLoading } = useDrivers({ active: true });
  
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    truck_id: '',
    route_date: '',
    warehouse_id: '',
    driver_id: ''
  });

  const loading = createTrip.isLoading;
  const trucks = trucksData?.trucks || [];
  const drivers = driversData?.drivers || [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError(null);

    try {
      // Validate required fields
      if (!formData.truck_id) {
        throw new Error('Please select a truck');
      }
      if (!formData.route_date) {
        throw new Error('Please select a route date');
      }
      if (!formData.warehouse_id) {
        throw new Error('Please select a warehouse');
      }

      const data = {
        truck_id: formData.truck_id,
        route_date: formData.route_date,
        warehouse_id: formData.warehouse_id,
        driver_id: formData.driver_id || undefined,
      };

      const result = await createTrip.mutateAsync(data);
      
      // Navigate to the trips list or the newly created trip
      navigate('/trips');
    } catch (err: any) {
      console.error('Form submission error:', err);
      setError(err.message || 'Failed to create trip');
    }
  };

  if (trucksLoading || warehousesLoading || driversLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/trips"
              className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Trips
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">Create New Trip</h1>
          </div>
        </div>

        <Card className="p-6">
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Loader2 className="h-8 w-8 text-gray-400 animate-spin mb-4" />
            <p className="text-gray-500">Loading form data...</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            to="/trips"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Trips
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Create New Trip</h1>
        </div>
      </div>

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

        <Card className="overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-200">
            <div className="flex items-center">
              <Truck className="h-6 w-6 text-gray-400" />
              <h3 className="ml-2 text-lg font-medium text-gray-900">Trip Details</h3>
            </div>
          </div>

          <div className="px-6 py-5 space-y-6">
            {/* Truck Selection */}
            <div>
              <label htmlFor="truck_id" className="block text-sm font-medium text-gray-700">
                <div className="flex items-center gap-2">
                  <Truck className="h-4 w-4" />
                  Truck
                </div>
              </label>
              <SearchableTruckSelector
                value={formData.truck_id}
                onChange={(truckId) => setFormData({ ...formData, truck_id: truckId })}
                placeholder="Select a truck..."
                required
              />
            </div>

            {/* Route Date */}
            <div>
              <label htmlFor="route_date" className="block text-sm font-medium text-gray-700">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Route Date
                </div>
              </label>
              <input
                type="date"
                id="route_date"
                value={formData.route_date}
                onChange={(e) => setFormData({ ...formData, route_date: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                required
              />
            </div>

            {/* Warehouse Selection */}
            <div>
              <label htmlFor="warehouse_id" className="block text-sm font-medium text-gray-700">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Warehouse
                </div>
              </label>
              <SearchableWarehouseSelector
                value={formData.warehouse_id}
                onChange={(warehouseId) => setFormData({ ...formData, warehouse_id: warehouseId })}
                placeholder="Select a warehouse..."
                required
              />
            </div>

            {/* Driver Selection - Uses admin_users.id for database foreign key */}
            <div>
              <label htmlFor="driver_id" className="block text-sm font-medium text-gray-700">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Driver
                </div>
              </label>
              <SearchableDriverSelector
                drivers={drivers.filter((driver) => driver.role === 'driver')}
                value={formData.driver_id}
                onChange={(driverId) => setFormData({ ...formData, driver_id: driverId })}
                placeholder="Select a driver..."
                loading={driversLoading}
              />
            </div>
          </div>

          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => navigate('/trips')}
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
                    Creating Trip...
                  </div>
                ) : (
                  'Create Trip'
                )}
              </button>
            </div>
          </div>
        </Card>
      </form>
    </div>
  );
};