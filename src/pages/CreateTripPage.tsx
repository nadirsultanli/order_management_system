import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Truck, Loader2, Calendar, MapPin, User, AlertTriangle } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { useCreateTrip } from '../hooks/useTrips';
import { useTrucks } from '../hooks/useTrucks';
import { useWarehouseOptions } from '../hooks/useWarehouses';
import { useDrivers } from '../hooks/useUsers';
import { trpc } from '../lib/trpc-client';
import toast from 'react-hot-toast';

export const CreateTripPage: React.FC = () => {
  const navigate = useNavigate();
  const createTrip = useCreateTrip();
  const { data: trucksData, isLoading: trucksLoading } = useTrucks();
  const { data: warehouses, isLoading: warehousesLoading } = useWarehouseOptions();
  const { data: driversData, isLoading: driversLoading } = useDrivers({ active: true });
  const utils = trpc.useContext();
  
  const [error, setError] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    truck_id: '',
    route_date: '',
    warehouse_id: '',
    driver_id: '',
    planned_start_time: '',
    planned_end_time: '',
    trip_notes: ''
  });

  const loading = createTrip.isLoading;
  const trucks = trucksData?.trucks || [];
  const drivers = driversData?.drivers || [];

  // Query to check for existing trips with same truck and driver on same date
  const { data: existingTrips, refetch: refetchExistingTrips } = trpc.trips.list.useQuery({
    truck_id: formData.truck_id,
    date_from: formData.route_date,
    date_to: formData.route_date,
    limit: 100
  }, {
    enabled: Boolean(formData.truck_id && formData.route_date),
    refetchOnWindowFocus: false
  });

  // Check for duplicate trips when form data changes
  useEffect(() => {
    if (formData.truck_id && formData.route_date && existingTrips?.trips) {
      const duplicates = existingTrips.trips.filter(trip => {
        // Check if truck matches
        if (trip.truck_id !== formData.truck_id) return false;
        
        // Check if date matches
        if (trip.route_date !== formData.route_date) return false;
        
        // Check if driver matches (including null cases)
        if (formData.driver_id) {
          return trip.driver_id === formData.driver_id;
        } else {
          return !trip.driver_id; // No driver assigned
        }
      });

      if (duplicates.length > 0) {
        const duplicate = duplicates[0];
        const driverInfo = formData.driver_id ? 'the selected driver' : 'no driver assigned';
        setDuplicateWarning(
          `⚠️ A trip already exists for this truck with ${driverInfo} on ${formData.route_date}. Trip ID: ${duplicate.id.slice(-8)}, Status: ${duplicate.route_status}`
        );
      } else {
        setDuplicateWarning(null);
      }
    } else {
      setDuplicateWarning(null);
    }
  }, [formData.truck_id, formData.route_date, formData.driver_id, existingTrips?.trips]);

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

      // FRONTEND VALIDATION: Check for duplicate trips before submission
      if (duplicateWarning) {
        throw new Error('Cannot create trip: ' + duplicateWarning.replace('⚠️ ', ''));
      }

      const data = {
        truck_id: formData.truck_id,
        route_date: formData.route_date,
        warehouse_id: formData.warehouse_id,
        driver_id: formData.driver_id || undefined,
        planned_start_time: formData.planned_start_time || undefined,
        planned_end_time: formData.planned_end_time || undefined,
        trip_notes: formData.trip_notes || undefined,
      };

      const result = await createTrip.mutateAsync(data);
      
      // Optimistically update the trips list to show the new trip at the beginning
      utils.trips.list.setData(undefined, (oldData) => {
        if (!oldData) return oldData;
        
        // Create the new trip object with the response data
        const newTrip = {
          id: result.id,
          truck_id: result.truck_id,
          route_date: result.route_date,
          route_status: result.route_status || 'planned',
          warehouse_id: result.warehouse_id,
          driver_id: result.driver_id,
          created_at: result.created_at,
          updated_at: result.updated_at,
          trip_number: result.trip_number,
          // Add truck and warehouse details for display
          truck: trucks.find(t => t.id === result.truck_id),
          warehouse: warehouses?.find(w => w.id === result.warehouse_id),
          driver: drivers.find(d => d.id === result.driver_id),
          // Add empty arrays for related data
          truck_allocations: [],
          trip_orders: [],
          loading_progress: null,
          capacity_info: null,
          timeline: []
        };
        
        return {
          ...oldData,
          trips: [newTrip, ...oldData.trips],
          totalCount: oldData.totalCount + 1
        };
      });
      
      // Show success message
      toast.success('Trip created successfully!');
      
      // Navigate back to trips list with the new trip ID in state
      navigate('/trips', { state: { newTripId: result.id } });
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

        {duplicateWarning && !error && (
          <div className="rounded-md bg-yellow-50 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-yellow-400" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">Duplicate Trip Warning</h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <p>{duplicateWarning}</p>
                </div>
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
              <select
                id="truck_id"
                value={formData.truck_id}
                onChange={(e) => setFormData({ ...formData, truck_id: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                required
              >
                <option value="">Select a truck...</option>
                {trucks.map((truck) => (
                  <option key={truck.id} value={truck.id}>
                    {truck.fleet_number} - {truck.license_plate} ({truck.capacity_cylinders} cylinders)
                  </option>
                ))}
              </select>
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
              <select
                id="warehouse_id"
                value={formData.warehouse_id}
                onChange={(e) => setFormData({ ...formData, warehouse_id: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                required
              >
                <option value="">Select a warehouse...</option>
                {warehouses?.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.city && warehouse.state 
                      ? `${warehouse.name} (${warehouse.city}, ${warehouse.state})`
                      : warehouse.name
                    }
                  </option>
                ))}
              </select>
            </div>

            {/* Driver Selection (Optional) - Uses admin_users.id for database foreign key */}
            <div>
              <label htmlFor="driver_id" className="block text-sm font-medium text-gray-700">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Driver (Optional)
                </div>
              </label>
              <select
                id="driver_id"
                value={formData.driver_id}
                onChange={(e) => setFormData({ ...formData, driver_id: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              >
                <option value="">Select a driver...</option>
                {drivers
                  .filter((driver) => driver.role === 'driver') // Only show users with driver role
                  .map((driver) => (
                    <option key={driver.id} value={driver.id}>
                      {driver.name}
                      {driver.employee_id && ` (${driver.employee_id})`}
                      {driver.email && ` - ${driver.email}`}
                      {driver.phone && ` - ${driver.phone}`}
                    </option>
                  ))}
              </select>
            </div>

            {/* Time Schedule */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Time Schedule
              </label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="planned_start_time" className="block text-sm font-medium text-gray-600">
                    Planned Start Time
                  </label>
                  <input
                    type="time"
                    id="planned_start_time"
                    value={formData.planned_start_time}
                    onChange={(e) => setFormData({ ...formData, planned_start_time: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="planned_end_time" className="block text-sm font-medium text-gray-600">
                    Planned End Time
                  </label>
                  <input
                    type="time"
                    id="planned_end_time"
                    value={formData.planned_end_time}
                    onChange={(e) => setFormData({ ...formData, planned_end_time: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Trip Notes */}
            <div>
              <label htmlFor="trip_notes" className="block text-sm font-medium text-gray-700">
                Trip Notes
              </label>
              <textarea
                id="trip_notes"
                value={formData.trip_notes}
                onChange={(e) => setFormData({ ...formData, trip_notes: e.target.value })}
                rows={3}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm resize-none"
                placeholder="Add any notes about this trip..."
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
                disabled={loading || !!duplicateWarning}
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