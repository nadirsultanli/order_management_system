import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Truck, Loader2, Calendar, MapPin, User, AlertTriangle } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { useUpdateTrip } from '../hooks/useTrips';
import { useTrip } from '../hooks/useTrips';
import { useTrucks } from '../hooks/useTrucks';
import { useWarehouseOptions } from '../hooks/useWarehouses';
import { useDrivers } from '../hooks/useUsers';
import { trpc } from '../lib/trpc-client';
import toast from 'react-hot-toast';

interface FormData {
  truck_id: string;
  route_date: string;
  warehouse_id: string;
  driver_id: string;
  planned_start_time: string;
  planned_end_time: string;
  trip_notes: string;
}

export default function EditTripPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  // Fetch existing trip data
  const { data: tripData, isLoading: isLoadingTrip, error: tripError } = useTrip(id!);
  
  // Debug logging
  console.log('EditTripPage - tripData:', tripData);
  console.log('EditTripPage - isLoadingTrip:', isLoadingTrip);
  console.log('EditTripPage - tripError:', tripError);
  
  // Form state
  const [formData, setFormData] = useState<FormData>({
    truck_id: '',
    route_date: '',
    warehouse_id: '',
    driver_id: '',
    planned_start_time: '',
    planned_end_time: '',
    trip_notes: ''
  });
  
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load form data when trip data is available
  useEffect(() => {
    if (tripData) {
      const trip = tripData; // tripData is the trip object directly
      console.log('Loading trip data:', trip);
      
      // Format date for input field (YYYY-MM-DD)
      const formatDateForInput = (dateString: string) => {
        if (!dateString) return '';
        return dateString.split('T')[0]; // Remove time part if present
      };
      
      // Format time for input field (HH:MM)
      const formatTimeForInput = (timeString: string) => {
        if (!timeString) return '';
        return timeString.substring(0, 5); // Take only HH:MM part
      };
      
      const newFormData = {
        truck_id: trip.truck_id || '',
        route_date: formatDateForInput(trip.route_date) || '',
        warehouse_id: trip.warehouse_id || '',
        driver_id: trip.driver_id || '',
        planned_start_time: formatTimeForInput(trip.planned_start_time) || '',
        planned_end_time: formatTimeForInput(trip.planned_end_time) || '',
        trip_notes: trip.trip_notes || ''
      };
      
      console.log('Setting form data:', newFormData);
      setFormData(newFormData);
    }
  }, [tripData]);

  // Fetch data for form options
  const { data: trucksData } = useTrucks();
  const { data: warehousesData } = useWarehouseOptions();
  const { data: driversData } = useDrivers();

  const trucks = trucksData?.trucks || [];
  const warehouses = warehousesData || []; // useWarehouseOptions returns data directly
  const drivers = driversData?.drivers || [];
  
  // Debug logging for form options
  console.log('EditTripPage - trucksData:', trucksData);
  console.log('EditTripPage - warehousesData:', warehousesData);
  console.log('EditTripPage - driversData:', driversData);
  console.log('EditTripPage - trucks:', trucks);
  console.log('EditTripPage - warehouses:', warehouses);
  console.log('EditTripPage - drivers:', drivers);

  // Query to check for existing trips on the same date (for both truck and driver conflict checking)
  const { data: existingTrips, refetch: refetchExistingTrips } = trpc.trips.list.useQuery({
    date_from: formData.route_date,
    date_to: formData.route_date,
    limit: 100
  }, {
    enabled: Boolean(formData.route_date),
    refetchOnWindowFocus: false
  });

  // Check for duplicate trips when form data changes
  useEffect(() => {
    if (formData.truck_id && formData.route_date && existingTrips?.trips) {
      // Check for truck conflicts (same truck on same date, excluding current trip)
      const truckConflicts = existingTrips.trips.filter((trip: any) => 
        trip.truck_id === formData.truck_id && 
        trip.route_date === formData.route_date &&
        trip.id !== id
      );

      // Check for driver conflicts (same driver on same date, only if driver is selected, excluding current trip)
      const driverConflicts = formData.driver_id ? existingTrips.trips.filter((trip: any) => 
        trip.driver_id === formData.driver_id && 
        trip.route_date === formData.route_date &&
        trip.id !== id
      ) : [];

      // Check both truck and driver conflicts independently
      if (truckConflicts.length > 0) {
        const conflict = truckConflicts[0];
        const driverInfo = conflict.driver_id ? 'with a driver' : 'with no driver assigned';
        setDuplicateWarning(
          `⚠️ This truck is already assigned to another trip on ${formData.route_date}. ${driverInfo}. Status: ${conflict.route_status}`
        );
      } else if (driverConflicts.length > 0) {
        const conflict = driverConflicts[0];
        const truckInfo = conflict.truck?.fleet_number || 'another truck';
        setDuplicateWarning(
          `⚠️ This driver is already assigned to another trip on ${formData.route_date}. Truck: ${truckInfo}. Status: ${conflict.route_status}`
        );
      } else {
        setDuplicateWarning(null);
      }
    } else {
      setDuplicateWarning(null);
    }
  }, [formData.truck_id, formData.driver_id, formData.route_date, existingTrips, id]);

  // Update trip mutation
  const updateTripMutation = useUpdateTrip();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!id) {
      toast.error('Trip ID is required');
      return;
    }

    if (duplicateWarning) {
      toast.error('Please resolve conflicts before updating the trip');
      return;
    }

    setIsSubmitting(true);

    try {
      await updateTripMutation.mutateAsync({
        id,
        ...formData
      });

      toast.success('Trip updated successfully');
      navigate(`/trips/${id}`);
    } catch (error) {
      console.error('Error updating trip:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  if (isLoadingTrip) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading trip...</span>
      </div>
    );
  }

  if (tripError) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Error Loading Trip</h2>
          <p className="text-gray-600 mb-4">{tripError.message}</p>
          <Link to="/trips" className="text-blue-600 hover:text-blue-800">
            Back to Trips
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-6">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center space-x-4 mb-3">
              <Link
                to={`/trips/${id}`}
                className="flex items-center text-gray-600 hover:text-gray-800 transition-colors px-3 py-2 rounded-md hover:bg-gray-100"
              >
                <ArrowLeft className="h-5 w-5 mr-2" />
                Back to Trip
              </Link>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Truck className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Edit Trip</h1>
                  <p className="text-gray-600">Update trip details and scheduling</p>
                </div>
              </div>
            </div>
          </div>

          {/* Duplicate Warning */}
          {duplicateWarning && (
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg shadow-sm">
              <div className="flex items-center">
                <AlertTriangle className="h-5 w-5 text-yellow-600 mr-3 flex-shrink-0" />
                <span className="text-yellow-800 font-medium">{duplicateWarning}</span>
              </div>
            </div>
          )}

                    {/* Form */}
          <Card className="p-6 shadow-lg border-0 bg-white">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Truck Selection */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center">
                  <Truck className="h-4 w-4 mr-2 text-blue-600" />
                  Truck Assignment
                </label>
                <select
                  value={formData.truck_id}
                  onChange={(e) => handleInputChange('truck_id', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white shadow-sm"
                  required
                >
                  <option value="">Select a truck</option>
                  {trucks.map((truck: any) => (
                    <option key={truck.id} value={truck.id}>
                      {truck.fleet_number} - {truck.license_plate}
                    </option>
                  ))}
                </select>
              </div>

            {/* Route Date */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center">
                <Calendar className="h-4 w-4 mr-2 text-blue-600" />
                Route Date
              </label>
              <input
                type="date"
                value={formData.route_date}
                onChange={(e) => handleInputChange('route_date', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white shadow-sm"
                required
              />
            </div>

            {/* Warehouse Selection */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center">
                <MapPin className="h-4 w-4 mr-2 text-blue-600" />
                Warehouse
              </label>
              <select
                value={formData.warehouse_id}
                onChange={(e) => handleInputChange('warehouse_id', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white shadow-sm"
                required
              >
                <option value="">Select a warehouse</option>
                {warehouses.map((warehouse: any) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Driver Selection */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center">
                <User className="h-4 w-4 mr-2 text-blue-600" />
                Driver (Optional)
              </label>
              <select
                value={formData.driver_id}
                onChange={(e) => handleInputChange('driver_id', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white shadow-sm"
              >
                <option value="">No driver assigned</option>
                {drivers.map((driver: any) => (
                  <option key={driver.id} value={driver.id}>
                    {driver.name} - {driver.email}
                  </option>
                ))}
              </select>
            </div>

            {/* Time Range */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Time Schedule
              </label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">
                    Planned Start Time
                  </label>
                  <input
                    type="time"
                    value={formData.planned_start_time}
                    onChange={(e) => handleInputChange('planned_start_time', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">
                    Planned End Time
                  </label>
                  <input
                    type="time"
                    value={formData.planned_end_time}
                    onChange={(e) => handleInputChange('planned_end_time', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white shadow-sm"
                  />
                </div>
              </div>
            </div>

            {/* Trip Notes */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Trip Notes
              </label>
              <textarea
                value={formData.trip_notes}
                onChange={(e) => handleInputChange('trip_notes', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white shadow-sm resize-none"
                placeholder="Add any notes about this trip..."
              />
            </div>

            {/* Submit Button */}
            <div className="flex justify-end space-x-4 pt-6">
              <Link
                to={`/trips/${id}`}
                className="px-6 py-3 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors font-medium"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={isSubmitting || !!duplicateWarning}
                className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center font-medium shadow-sm"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Updating...
                  </>
                ) : (
                  'Update Trip'
                )}
              </button>
            </div>
          </form>
        </Card>
        </div>
      </div>
    </div>
  );
} 