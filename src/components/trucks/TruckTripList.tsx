import React from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Route, Package, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { useTrips } from '../../hooks/useTrips';
import { Trip, TripWithDetails } from '../../types/trip';

// Backend response interface (matches truck_routes table)
interface TruckRouteResponse {
  id: string;
  truck_id: string;
  driver_id?: string;
  driver_name?: string;
  route_date: string;
  planned_start_time?: string;
  planned_end_time?: string;
  actual_start_time?: string;
  actual_end_time?: string;
  route_status: string;
  total_distance_km?: number;
  trip_notes?: string;
  created_at: string;
  updated_at: string;
  truck?: {
    id: string;
    fleet_number: string;
    license_plate: string;
    capacity_cylinders: number;
    capacity_kg: number;
  };
  truck_allocations?: any[];
}

interface TruckTripListProps {
  truckId: string;
}

export const TruckTripList: React.FC<TruckTripListProps> = ({ truckId }) => {
  const { data, isLoading, error } = useTrips({
    truck_id: truckId,
    limit: 10,
    sort_by: 'trip_date',
    sort_order: 'desc'
  });

  // Get today's date for filtering
  const today = new Date().toISOString().split('T')[0];

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-32">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="rounded-md bg-red-50 p-3">
          <p className="text-sm text-red-800">Failed to load trips: {error.message}</p>
        </div>
      </div>
    );
  }

  const trips = (data?.trips || []) as TruckRouteResponse[];

  // Calculate trip statistics - using route_status instead of status
  const activeTrips = trips.filter(trip => 
    trip.route_status === 'loading' || trip.route_status === 'in_transit'
  ).length;
  
  const todaysTrips = trips.filter(trip => 
    trip.route_date === today
  ).length;
  
  const completedTrips = trips.filter(trip => 
    trip.route_status === 'completed'
  ).length;

  if (trips.length === 0) {
    return (
      <div className="p-6 text-center">
        <Route className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">No trips found</h3>
        <p className="mt-1 text-sm text-gray-500">This truck hasn't been assigned to any trips yet.</p>
      </div>
    );
  }

  const getStatusIcon = (status?: string) => {
    if (!status) return <AlertCircle className="h-4 w-4 text-gray-400" />;
    
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'cancelled':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'in_transit':
      case 'loading':
        return <Clock className="h-4 w-4 text-blue-500" />;
      case 'planned':
        return <Calendar className="h-4 w-4 text-purple-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status?: string) => {
    if (!status) return 'bg-gray-100 text-gray-800';
    
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      case 'in_transit':
        return 'bg-blue-100 text-blue-800';
      case 'loading':
        return 'bg-yellow-100 text-yellow-800';
      case 'planned':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatStatus = (status?: string) => {
    if (!status) return 'Unknown';
    return status.replace(/_/g, ' ');
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return dateString;
      }
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  const formatTime = (timeString?: string | null) => {
    if (!timeString || timeString.trim() === '') {
      return '-';
    }

    const timeRegex = /^([01]?[0-9]|2[0-3]):([0-5][0-9])(?::([0-5][0-9]))?$/;
    
    if (!timeRegex.test(timeString.trim())) {
      return 'Invalid time';
    }

    try {
      const dateString = `1970-01-01T${timeString.trim()}`;
      const date = new Date(dateString);
      
      if (isNaN(date.getTime())) {
        return 'Invalid time';
      }

      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch (error) {
      return 'Invalid time';
    }
  };

  return (
    <div className="p-6">
      {/* Trip Statistics */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 rounded-lg p-4 text-center">
          <div className="flex items-center justify-center">
            <Calendar className="h-5 w-5 text-blue-600 mr-2" />
            <span className="text-lg font-semibold text-blue-600">{todaysTrips}</span>
          </div>
          <p className="text-sm text-blue-600 mt-1">Today's Trips</p>
        </div>
        
        <div className="bg-green-50 rounded-lg p-4 text-center">
          <div className="flex items-center justify-center">
            <Clock className="h-5 w-5 text-green-600 mr-2" />
            <span className="text-lg font-semibold text-green-600">{activeTrips}</span>
          </div>
          <p className="text-sm text-green-600 mt-1">Active Trips</p>
        </div>
        
        <div className="bg-purple-50 rounded-lg p-4 text-center">
          <div className="flex items-center justify-center">
            <CheckCircle className="h-5 w-5 text-purple-600 mr-2" />
            <span className="text-lg font-semibold text-purple-600">{completedTrips}</span>
          </div>
          <p className="text-sm text-purple-600 mt-1">Completed</p>
        </div>
      </div>

      <div className="space-y-4">
        {trips.map((trip) => (
          <Link
            key={trip.id}
            to={`/trips/${trip.id}`}
            className="block bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-3">
                  {getStatusIcon(trip.route_status)}
                  <h4 className="text-sm font-medium text-gray-900">
                    {formatDate(trip.route_date)}
                  </h4>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(trip.route_status)}`}>
                    {formatStatus(trip.route_status)}
                  </span>
                </div>
                
                <div className="mt-2 grid grid-cols-2 gap-4 text-sm text-gray-500">
                  <div className="flex items-center">
                    <Clock className="h-4 w-4 mr-1" />
                    <span>
                      {formatTime(trip.planned_start_time)} - {formatTime(trip.planned_end_time)}
                    </span>
                  </div>
                  {trip.driver_name && (
                    <div className="flex items-center">
                      <span>Driver: {trip.driver_name}</span>
                    </div>
                  )}
                </div>

                <div className="mt-2 flex items-center text-sm text-gray-600">
                  <Package className="h-4 w-4 mr-1" />
                  <span>
                    {(trip as any).truck_allocations?.length ? 
                      `${(trip as any).truck_allocations.length} orders` : 
                      'Orders pending'
                    }
                  </span>
                  {trip.total_distance_km && (
                    <>
                      <span className="mx-2">•</span>
                      <span>{trip.total_distance_km.toFixed(1)} km</span>
                    </>
                  )}
                </div>

                {trip.trip_notes && (
                  <p className="mt-2 text-sm text-gray-600 line-clamp-1">{trip.trip_notes}</p>
                )}
              </div>

              <div className="ml-4">
                <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {data && data.totalCount > 10 && (
        <div className="mt-6 text-center">
          <Link
            to={`/trips?truck_id=${truckId}`}
            className="text-sm text-blue-600 hover:text-blue-500 font-medium"
          >
            View all {data.totalCount} trips →
          </Link>
        </div>
      )}
    </div>
  );
};