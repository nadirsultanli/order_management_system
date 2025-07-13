import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Package, 
  AlertTriangle, 
  CheckCircle, 
  Save,
  RefreshCw,
  Truck
} from 'lucide-react';
import { 
  useTrip, 
  useTripLoadingProgress, 
  useProcessTripLoading, 
  useCompleteTripLoading 
} from '../hooks/useTrips';
import { LoadingAction } from '../types/trip';
import { TripLoadingInterface } from '../components/trips/TripLoadingInterface';
import { LoadingProgressDisplay } from '../components/trips/LoadingProgressDisplay';
import { Card } from '../components/ui/Card';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import toast from 'react-hot-toast';

export const TripLoadingPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [loadingActions, setLoadingActions] = useState<LoadingAction[]>([]);
  const [completionNotes, setCompletionNotes] = useState('');
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [unsavedChanges, setUnsavedChanges] = useState(false);

  // Validate trip ID
  if (!id) {
    navigate('/trips');
    return null;
  }

  const { data: trip, isLoading: tripLoading, error: tripError, refetch: refetchTrip } = useTrip(id);
  const { data: progress, refetch: refetchProgress } = useTripLoadingProgress(id);
  
  const processLoading = useProcessTripLoading();
  const completeLoading = useCompleteTripLoading();

  // Auto-refresh progress every 10 seconds during loading
  useEffect(() => {
    if (trip?.status === 'loading') {
      const interval = setInterval(() => {
        refetchProgress();
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [trip?.status, refetchProgress]);

  // Track unsaved changes
  useEffect(() => {
    setUnsavedChanges(loadingActions.length > 0);
  }, [loadingActions]);

  if (tripLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (tripError || !trip) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="rounded-md bg-red-50 p-4">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                {tripError?.message || 'Trip not found'}
              </h3>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (trip.status !== 'loading') {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="rounded-md bg-yellow-50 p-4">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">
                This trip is not in loading status. Current status: {trip.status}
              </h3>
              <p className="text-sm text-yellow-700 mt-1">
                You can only access the loading interface when the trip is in 'loading' status.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleLoadingAction = (action: LoadingAction) => {
    setLoadingActions(prev => {
      const existingIndex = prev.findIndex(
        a => a.trip_order_id === action.trip_order_id && a.product_id === action.product_id
      );
      
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = action;
        return updated;
      } else {
        return [...prev, action];
      }
    });
  };

  const handleSaveActions = async () => {
    if (loadingActions.length === 0) return;

    try {
      await processLoading.mutateAsync({
        trip_id: trip.id,
        loading_actions: loadingActions,
        completion_notes: completionNotes
      });
      
      setLoadingActions([]);
      setCompletionNotes('');
      refetchTrip();
      refetchProgress();
      toast.success('Loading actions saved successfully');
    } catch (err: any) {
      console.error('Error processing loading actions:', err);
      toast.error(err?.message || 'Failed to process loading actions');
    }
  };

  const handleCompleteLoading = async () => {
    try {
      // Save any pending actions first
      if (loadingActions.length > 0) {
        await processLoading.mutateAsync({
          trip_id: trip.id,
          loading_actions: loadingActions,
          completion_notes: completionNotes
        });
      }

      await completeLoading.mutateAsync({
        trip_id: trip.id,
        completion_notes: completionNotes
      });
      
      setShowCompleteDialog(false);
      toast.success('Trip loading completed successfully');
      navigate(`/trips/${trip.id}`);
    } catch (err: any) {
      console.error('Error completing loading:', err);
      toast.error(err?.message || 'Failed to complete trip loading');
    }
  };

  const handleRefresh = () => {
    refetchTrip();
    refetchProgress();
  };

  const canCompleteLoading = progress?.loading_status === 'completed' || 
                            progress?.loading_status === 'completed_with_shorts';

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate(`/trips/${trip.id}`)}
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Trip Details
        </button>
        
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Loading Interface - Trip #{trip.id.slice(-8)}
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              <Truck className="inline h-4 w-4 mr-1" />
              {trip.truck?.fleet_number} • {new Date(trip.trip_date).toLocaleDateString()}
            </p>
          </div>
          
          <div className="flex items-center space-x-3">
            <button
              onClick={handleRefresh}
              disabled={processLoading.isLoading || completeLoading.isLoading}
              className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </button>
            
            {loadingActions.length > 0 && (
              <button
                onClick={handleSaveActions}
                disabled={processLoading.isLoading}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
              >
                <Save className="h-4 w-4 mr-2" />
                Save Actions ({loadingActions.length})
              </button>
            )}
            
            {canCompleteLoading && (
              <button
                onClick={() => setShowCompleteDialog(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Complete Loading
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Warning for unsaved changes */}
      {unsavedChanges && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            <div>
              <h3 className="text-sm font-medium text-yellow-800">
                You have unsaved loading actions
              </h3>
              <p className="text-sm text-yellow-700">
                Don't forget to save your changes before completing the loading process.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Loading Interface */}
        <div className="lg:col-span-3">
          <TripLoadingInterface
            trip={trip}
            onLoadingAction={handleLoadingAction}
            pendingActions={loadingActions}
          />
        </div>

        {/* Progress Sidebar */}
        <div className="space-y-6">
          {/* Loading Progress */}
          {progress && (
            <Card>
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-4">Loading Progress</h3>
                <LoadingProgressDisplay 
                  progress={progress} 
                  showDetails={true}
                  size="sm"
                />
              </div>
            </Card>
          )}

          {/* Capacity Utilization */}
          {trip.capacity_info && (
            <Card>
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-4">Capacity Status</h3>
                
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Weight Utilization</span>
                      <span className="font-medium">
                        {trip.capacity_info.utilization_percentage.toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-300 ${
                          trip.capacity_info.utilization_percentage > 100 
                            ? 'bg-red-500' 
                            : trip.capacity_info.utilization_percentage > 90 
                            ? 'bg-yellow-500' 
                            : 'bg-green-500'
                        }`}
                        style={{ width: `${Math.min(trip.capacity_info.utilization_percentage, 100)}%` }}
                      />
                    </div>
                  </div>
                  
                  <div className="text-xs text-gray-600 space-y-1">
                    <div className="flex justify-between">
                      <span>Allocated:</span>
                      <span>{trip.capacity_info.allocated_weight_kg.toFixed(1)} kg</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Available:</span>
                      <span>{trip.capacity_info.available_weight_kg.toFixed(1)} kg</span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Short Loading Warnings */}
          {trip.capacity_info?.short_loading_warnings && trip.capacity_info.short_loading_warnings.length > 0 && (
            <Card>
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-4 text-yellow-800">
                  Warnings
                </h3>
                <div className="space-y-2">
                  {trip.capacity_info.short_loading_warnings.map((warning, index) => (
                    <div key={index} className="p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
                      <p className="font-medium text-yellow-800">
                        {warning.customer_name}
                      </p>
                      <p className="text-yellow-700">
                        {warning.product_name}: Short by {warning.shortage}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}

          {/* Completion Notes */}
          <Card>
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">Completion Notes</h3>
              <textarea
                value={completionNotes}
                onChange={(e) => setCompletionNotes(e.target.value)}
                placeholder="Add notes about the loading process..."
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
              <p className="text-xs text-gray-500 mt-2">
                These notes will be saved with the trip record.
              </p>
            </div>
          </Card>
        </div>
      </div>

      {/* Completion Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showCompleteDialog}
        onClose={() => setShowCompleteDialog(false)}
        onConfirm={handleCompleteLoading}
        title="Complete Loading Process"
        message="Are you sure you want to complete the loading process? This will mark the trip as ready for departure."
        confirmText="Complete Loading"
        confirmVariant="success"
        isLoading={completeLoading.isLoading}
      />
    </div>
  );
};