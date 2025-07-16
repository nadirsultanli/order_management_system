import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  Edit, 
  Truck, 
  Calendar, 
  Clock, 
  User, 
  Package, 
  MapPin,
  Play,
  CheckCircle,
  X,
  AlertTriangle,
  MoreVertical,
  Plus
} from 'lucide-react';
import { 
  useTrip, 
  useUpdateTrip, 
  useStartTripLoading, 
  useStartTripDeparture, 
  useCompleteTrip, 
  useCancelTrip,
  useTripTimeline 
} from '../hooks/useTrips';
import { TripStatusBadge } from '../components/trips/TripStatusBadge';
import { LoadingProgressDisplay } from '../components/trips/LoadingProgressDisplay';
import { AssignOrdersModal } from '../components/trips/AssignOrdersModal';
import { Card } from '../components/ui/Card';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import toast from 'react-hot-toast';

export const TripDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [showAssignOrdersModal, setShowAssignOrdersModal] = useState(false);

  // UUID validation pattern
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  // Validate trip ID
  if (!id || !uuidPattern.test(id)) {
    navigate('/trips');
    return null;
  }

  const { data: trip, isLoading: loading, error, refetch } = useTrip(id);
  const { data: timeline } = useTripTimeline(id);
  
  const updateTrip = useUpdateTrip();
  const startLoading = useStartTripLoading();
  const startDeparture = useStartTripDeparture();
  const completeTrip = useCompleteTrip();
  const cancelTrip = useCancelTrip();

  // Reusable mutation handler function
  const handleMutation = async (
    mutationFn: () => Promise<any>,
    successMessage?: string,
    errorMessage?: string
  ) => {
    try {
      await mutationFn();
      refetch();
      if (successMessage) {
        toast.success(successMessage);
      }
    } catch (err: any) {
      console.error('Mutation error:', err);
      const message = errorMessage || err?.message || 'An error occurred';
      toast.error(message);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="rounded-md bg-red-50 p-4">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                {error?.message || 'Trip not found'}
              </h3>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleStatusChange = async (newStatus: string) => {
    await handleMutation(
      () => updateTrip.mutateAsync({
        id: trip.id,
        status: newStatus as any
      }),
      'Trip status updated successfully',
      'Failed to update trip status'
    );
  };

  const handleStartLoading = async () => {
    await handleMutation(
      () => startLoading.mutateAsync({ trip_id: trip.id }),
      'Trip loading started successfully',
      'Failed to start trip loading'
    );
  };

  const handleStartDeparture = async () => {
    await handleMutation(
      () => startDeparture.mutateAsync({ trip_id: trip.id }),
      'Trip departed successfully',
      'Failed to start trip departure'
    );
  };

  const handleCompleteTrip = async () => {
    await handleMutation(
      () => completeTrip.mutateAsync({ trip_id: trip.id }),
      'Trip completed successfully',
      'Failed to complete trip'
    );
    setShowCompleteDialog(false);
  };

  const handleCancelTrip = async () => {
    await handleMutation(
      () => cancelTrip.mutateAsync({ trip_id: trip.id }),
      'Trip cancelled successfully',
      'Failed to cancel trip'
    );
    setShowCancelDialog(false);
  };

  const formatTime = (timeString?: string) => {
    if (!timeString) return 'Not set';
    return new Date(`1970-01-01T${timeString}`).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatDateTime = (dateTimeString: string) => {
    return new Date(dateTimeString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const canStartLoading = trip.status === 'planned';
  const canStartDeparture = trip.status === 'loading' && trip.loading_progress?.loading_status === 'completed';
  const canComplete = trip.status === 'in_transit';
  const canCancel = ['draft', 'planned', 'loading'].includes(trip.status);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/trips')}
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Trips
        </button>
        
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Trip #{trip.id.slice(-8)}
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              {trip.truck?.fleet_number} • {formatDate(trip.trip_date)}
            </p>
          </div>
          
          <div className="flex items-center space-x-3">
            <TripStatusBadge 
              status={trip.status}
              size="lg"
              interactive={true}
              onStatusChange={handleStatusChange}
            />
            
            <div className="flex items-center space-x-2">
              {canStartLoading && (
                <button
                  onClick={handleStartLoading}
                  disabled={startLoading.isLoading}
                  className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Start Loading
                </button>
              )}
              
              {canStartDeparture && (
                <button
                  onClick={handleStartDeparture}
                  disabled={startDeparture.isLoading}
                  className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Depart
                </button>
              )}
              
              {canComplete && (
                <button
                  onClick={() => setShowCompleteDialog(true)}
                  className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Complete
                </button>
              )}
              
              {trip.status === 'loading' && (
                <Link
                  to={`/trips/${trip.id}/loading`}
                  className="inline-flex items-center px-3 py-2 border border-blue-300 text-sm font-medium rounded-md text-blue-700 bg-blue-50 hover:bg-blue-100"
                >
                  <Package className="h-4 w-4 mr-2" />
                  Loading Interface
                </Link>
              )}
              
              <Link
                to={`/trips/${trip.id}/edit`}
                className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Link>
              
              {canCancel && (
                <button
                  onClick={() => setShowCancelDialog(true)}
                  className="inline-flex items-center px-3 py-2 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-red-50 hover:bg-red-100"
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Trip Information */}
          <Card>
            <div className="p-6">
              <h2 className="text-lg font-semibold mb-4">Trip Information</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <Truck className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-500">Truck</p>
                      <p className="font-medium">
                        {trip.truck?.fleet_number} ({trip.truck?.license_plate})
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <User className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-500">Driver</p>
                      <p className="font-medium">{trip.driver_name || 'Not assigned'}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <Calendar className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-500">Trip Date</p>
                      <p className="font-medium">{formatDate(trip.trip_date)}</p>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <Clock className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-500">Planned Time</p>
                      <p className="font-medium">
                        {formatTime(trip.planned_start_time)} - {formatTime(trip.planned_end_time)}
                      </p>
                    </div>
                  </div>
                  
                  {trip.actual_start_time && (
                    <div className="flex items-center space-x-3">
                      <Clock className="h-5 w-5 text-green-500" />
                      <div>
                        <p className="text-sm text-gray-500">Actual Start</p>
                        <p className="font-medium text-green-600">
                          {formatTime(trip.actual_start_time)}
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {trip.total_distance_km && (
                    <div className="flex items-center space-x-3">
                      <MapPin className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-500">Distance</p>
                        <p className="font-medium">{trip.total_distance_km.toFixed(1)} km</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {trip.notes && (
                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Notes</h4>
                  <p className="text-sm text-gray-600">{trip.notes}</p>
                </div>
              )}
            </div>
          </Card>

          {/* Capacity Information */}
          {trip.capacity_info && (
            <Card>
              <div className="p-6">
                <h2 className="text-lg font-semibold mb-4">Capacity Information</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-3">Weight Capacity</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Allocated:</span>
                        <span className="font-medium">
                          {trip.capacity_info.allocated_weight_kg.toFixed(1)} kg
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Total Capacity:</span>
                        <span className="font-medium">
                          {trip.capacity_info.total_capacity_kg.toFixed(1)} kg
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Available:</span>
                        <span className="font-medium text-green-600">
                          {trip.capacity_info.available_weight_kg.toFixed(1)} kg
                        </span>
                      </div>
                    </div>
                    
                    <div className="mt-3 w-full bg-gray-200 rounded-full h-3">
                      <div
                        className={`h-3 rounded-full transition-all duration-300 ${
                          trip.capacity_info.utilization_percentage > 100 
                            ? 'bg-red-500' 
                            : trip.capacity_info.utilization_percentage > 90 
                            ? 'bg-yellow-500' 
                            : 'bg-green-500'
                        }`}
                        style={{ width: `${Math.min(trip.capacity_info.utilization_percentage, 100)}%` }}
                      />
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      {trip.capacity_info.utilization_percentage.toFixed(1)}% utilized
                    </p>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-3">Cylinder Capacity</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Allocated:</span>
                        <span className="font-medium">
                          {trip.capacity_info.allocated_cylinders}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Total Capacity:</span>
                        <span className="font-medium">
                          {trip.capacity_info.total_capacity_cylinders}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Available:</span>
                        <span className="font-medium text-green-600">
                          {trip.capacity_info.available_cylinders}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {trip.capacity_info.is_overallocated && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                      <span className="text-sm font-medium text-red-800">
                        Trip is overallocated by {(trip.capacity_info.utilization_percentage - 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Loading Progress */}
          {trip.loading_progress && (
            <Card>
              <div className="p-6">
                <h2 className="text-lg font-semibold mb-4">Loading Progress</h2>
                <LoadingProgressDisplay 
                  progress={trip.loading_progress} 
                  showDetails={true}
                  size="md"
                />
              </div>
            </Card>
          )}

          {/* Assigned Orders */}
          <Card>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Assigned Orders</h2>
                <div className="flex items-center space-x-3">
                  <span className="text-sm text-gray-500">
                    {trip.trip_orders?.length || 0} orders
                  </span>
                  {(trip.route_status === 'draft' || trip.route_status === 'planned') && (
                    <button
                      onClick={() => setShowAssignOrdersModal(true)}
                      className="flex items-center px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <Plus size={16} className="mr-1" />
                      Assign Orders
                    </button>
                  )}
                </div>
              </div>
              
              {trip.trip_orders && trip.trip_orders.length > 0 ? (
                <div className="space-y-3">
                  {trip.trip_orders.map((tripOrder) => (
                    <div key={tripOrder.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <Link 
                            to={`/orders/${tripOrder.order_id}`}
                            className="text-sm font-medium text-blue-600 hover:text-blue-800"
                          >
                            Order #{tripOrder.order_id.slice(-8)}
                          </Link>
                          <p className="text-xs text-gray-500">
                            Stop {tripOrder.stop_sequence} • {tripOrder.order?.customer?.name}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center space-x-2">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              tripOrder.loading_status === 'loaded' 
                                ? 'bg-green-100 text-green-800'
                                : tripOrder.loading_status === 'short_loaded'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {tripOrder.loading_status === 'loaded' ? 'Loaded' : 
                               tripOrder.loading_status === 'short_loaded' ? 'Short Loaded' :
                               tripOrder.loading_status === 'not_loaded' ? 'Not Loaded' : 'Pending'}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-sm text-gray-600">
                        <div className="flex justify-between">
                          <span>Estimated Weight:</span>
                          <span>{tripOrder.estimated_weight_kg.toFixed(1)} kg</span>
                        </div>
                        {tripOrder.actual_weight_kg && (
                          <div className="flex justify-between">
                            <span>Actual Weight:</span>
                            <span>{tripOrder.actual_weight_kg.toFixed(1)} kg</span>
                          </div>
                        )}
                      </div>
                      
                      {tripOrder.order?.delivery_address && (
                        <p className="text-xs text-gray-500 mt-2">
                          {tripOrder.order.delivery_address.line1}, {tripOrder.order.delivery_address.city}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No orders assigned to this trip.</p>
              )}
            </div>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Short Loading Warnings */}
          {trip.capacity_info?.short_loading_warnings && trip.capacity_info.short_loading_warnings.length > 0 && (
            <Card>
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-4 text-yellow-800">
                  Short Loading Warnings
                </h3>
                <div className="space-y-3">
                  {trip.capacity_info.short_loading_warnings.map((warning, index) => (
                    <div key={index} className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div className="flex items-start space-x-2">
                        <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-yellow-800">
                            {warning.customer_name}
                          </p>
                          <p className="text-xs text-yellow-700">
                            {warning.product_name}
                          </p>
                          <p className="text-xs text-yellow-600 mt-1">
                            Short by {warning.shortage} units
                            <br />
                            Reason: {warning.reason.replace('_', ' ')}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}

          {/* Timeline */}
          {timeline && timeline.length > 0 && (
            <Card>
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-4">Timeline</h3>
                <div className="space-y-4">
                  {timeline.map((entry) => (
                    <div key={entry.id} className="flex items-start space-x-3">
                      <div className="flex-shrink-0">
                        <div className="w-2 h-2 bg-blue-600 rounded-full mt-2"></div>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {entry.event_description}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatDateTime(entry.event_timestamp)}
                          {entry.user && ` • ${entry.user.name}`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Confirmation Dialogs */}
      <ConfirmDialog
        isOpen={showCancelDialog}
        onClose={() => setShowCancelDialog(false)}
        onConfirm={handleCancelTrip}
        title="Cancel Trip"
        message="Are you sure you want to cancel this trip? This action cannot be undone."
        confirmText="Cancel Trip"
        confirmVariant="danger"
        isLoading={cancelTrip.isLoading}
      />

      <ConfirmDialog
        isOpen={showCompleteDialog}
        onClose={() => setShowCompleteDialog(false)}
        onConfirm={handleCompleteTrip}
        title="Complete Trip"
        message="Are you sure you want to mark this trip as completed? This will finalize all deliveries."
        confirmText="Complete Trip"
        confirmVariant="success"
        isLoading={completeTrip.isLoading}
      />

      {/* Assign Orders Modal */}
      <AssignOrdersModal
        tripId={id}
        isOpen={showAssignOrdersModal}
        onClose={() => setShowAssignOrdersModal(false)}
        onSuccess={() => {
          refetch(); // Refresh trip data to show newly assigned orders
          setShowAssignOrdersModal(false);
        }}
      />
    </div>
  );
};