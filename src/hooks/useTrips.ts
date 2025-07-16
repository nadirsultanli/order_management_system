import { 
  Trip, 
  TripWithDetails, 
  TripOrder,
  TripCapacityInfo,
  TripLoadingProgress,
  TripTimelineEntry,
  DailyTripSchedule,
  TripMetrics,
  TripFilters,
  CreateTripData,
  UpdateTripData,
  TripAllocationRequest,
  TripLoadingRequest,
  LoadingEfficiencyReport,
  DeliveryPerformanceReport
} from '../types/trip';
import { trpc } from '../lib/trpc-client';
import toast from 'react-hot-toast';

// Main trips list hook
export const useTrips = (filters: TripFilters = {}) => {
  return trpc.trips.list.useQuery({
    page: filters.page || 1,
    limit: filters.limit || 15,
    search: filters.search,
    status: filters.status,
    truck_id: filters.truck_id,
    date_from: filters.date_from,
    date_to: filters.date_to,
    sort_by: filters.sort_by,
    sort_order: filters.sort_order,
  }, {
    retry: 1,
    staleTime: 30000,
    onError: (error: any) => {
      console.error('useTrips query error:', error);
    }
  });
};

// Single trip with details hook
export const useTrip = (id: string) => {
  return trpc.trips.get.useQuery(
    { id },
    {
      enabled: Boolean(id),
      retry: 1,
      onError: (error: any) => {
        console.error('useTrip query error:', error);
      }
    }
  );
};

// Trip capacity information hook
export const useTripCapacity = (tripId: string) => {
  return trpc.trips.getCapacity.useQuery(
    { trip_id: tripId },
    {
      enabled: Boolean(tripId),
      staleTime: 10000, // Refresh more frequently for real-time capacity updates
      onError: (error: any) => {
        console.error('useTripCapacity query error:', error);
      }
    }
  );
};

// Trip loading progress hook
export const useTripLoadingProgress = (tripId: string) => {
  return trpc.trips.getLoadingProgress.useQuery(
    { trip_id: tripId },
    {
      enabled: Boolean(tripId),
      staleTime: 5000, // Very fresh data for loading operations
      onError: (error: any) => {
        console.error('useTripLoadingProgress query error:', error);
      }
    }
  );
};

// Trip timeline hook
export const useTripTimeline = (tripId: string) => {
  return trpc.trips.getTimeline.useQuery(
    { trip_id: tripId },
    {
      enabled: Boolean(tripId),
      staleTime: 15000,
      onError: (error: any) => {
        console.error('useTripTimeline query error:', error);
      }
    }
  );
};

// Daily trip schedule hook
export const useDailyTripSchedule = (date?: string) => {
  const targetDate = date || new Date().toISOString().split('T')[0];
  
  return trpc.trips.getDailySchedule.useQuery(
    { date: targetDate },
    {
      staleTime: 30000,
      onError: (error: any) => {
        console.error('useDailyTripSchedule query error:', error);
      }
    }
  );
};

// Create trip mutation
export const useCreateTrip = () => {
  const utils = trpc.useContext();
  
  return trpc.trips.createTrip.useMutation({
    onSuccess: (data) => {
      console.log('Trip created successfully:', data);
      toast.success('Trip created successfully');
      
      // Invalidate relevant queries
      utils.trips.list.invalidate();
      utils.trips.getDailySchedule.invalidate();
    },
    onError: (error: Error) => {
      console.error('Create trip mutation error:', error);
      toast.error(error.message || 'Failed to create trip');
    },
  });
};

// Update trip mutation
export const useUpdateTrip = () => {
  const utils = trpc.useContext();
  
  return trpc.trips.update.useMutation({
    onSuccess: (data) => {
      console.log('Trip updated successfully:', data);
      toast.success('Trip updated successfully');
      
      // Invalidate relevant queries
      utils.trips.list.invalidate();
      utils.trips.get.invalidate();
      utils.trips.getDailySchedule.invalidate();
      utils.trips.getTimeline.invalidate();
    },
    onError: (error: Error) => {
      console.error('Update trip mutation error:', error);
      toast.error(error.message || 'Failed to update trip');
    },
  });
};

// Delete trip mutation
export const useDeleteTrip = () => {
  const utils = trpc.useContext();
  
  return trpc.trips.delete.useMutation({
    onSuccess: (_, variables) => {
      console.log('Trip deleted successfully:', variables.id);
      toast.success('Trip deleted successfully');
      
      // Invalidate relevant queries
      utils.trips.list.invalidate();
      utils.trips.getDailySchedule.invalidate();
    },
    onError: (error: Error) => {
      console.error('Delete trip mutation error:', error);
      toast.error(error.message || 'Failed to delete trip');
    },
  });
};

// Allocate orders to trip mutation
export const useAllocateOrdersToTrip = () => {
  const utils = trpc.useContext();
  
  return trpc.trips.allocateOrders.useMutation({
    onSuccess: (data) => {
      console.log('Orders allocated to trip successfully:', data);
      toast.success('Orders allocated to trip successfully');
      
      // Invalidate relevant queries
      utils.trips.list.invalidate();
      utils.trips.get.invalidate();
      utils.trips.getCapacity.invalidate();
      utils.trips.getLoadingProgress.invalidate();
    },
    onError: (error: Error) => {
      console.error('Allocate orders mutation error:', error);
      toast.error(error.message || 'Failed to allocate orders to trip');
    },
  });
};

// Remove orders from trip mutation
export const useRemoveOrdersFromTrip = () => {
  const utils = trpc.useContext();
  
  return trpc.trips.removeOrders.useMutation({
    onSuccess: (data) => {
      console.log('Orders removed from trip successfully:', data);
      toast.success('Orders removed from trip successfully');
      
      // Invalidate relevant queries
      utils.trips.list.invalidate();
      utils.trips.get.invalidate();
      utils.trips.getCapacity.invalidate();
      utils.trips.getLoadingProgress.invalidate();
    },
    onError: (error: Error) => {
      console.error('Remove orders mutation error:', error);
      toast.error(error.message || 'Failed to remove orders from trip');
    },
  });
};

// Start trip loading mutation
export const useStartTripLoading = () => {
  const utils = trpc.useContext();
  
  return trpc.trips.startLoading.useMutation({
    onSuccess: (data) => {
      console.log('Trip loading started successfully:', data);
      toast.success('Trip loading started');
      
      // Invalidate relevant queries
      utils.trips.list.invalidate();
      utils.trips.get.invalidate();
      utils.trips.getTimeline.invalidate();
      utils.trips.getLoadingProgress.invalidate();
    },
    onError: (error: Error) => {
      console.error('Start loading mutation error:', error);
      toast.error(error.message || 'Failed to start trip loading');
    },
  });
};

// Process trip loading mutation
export const useProcessTripLoading = () => {
  const utils = trpc.useContext();
  
  return trpc.trips.processLoading.useMutation({
    onSuccess: (data) => {
      console.log('Trip loading processed successfully:', data);
      toast.success('Loading actions processed successfully');
      
      // Invalidate relevant queries
      utils.trips.get.invalidate();
      utils.trips.getCapacity.invalidate();
      utils.trips.getLoadingProgress.invalidate();
      utils.trips.getTimeline.invalidate();
    },
    onError: (error: Error) => {
      console.error('Process loading mutation error:', error);
      toast.error(error.message || 'Failed to process loading actions');
    },
  });
};

// Complete trip loading mutation
export const useCompleteTripLoading = () => {
  const utils = trpc.useContext();
  
  return trpc.trips.completeLoading.useMutation({
    onSuccess: (data) => {
      console.log('Trip loading completed successfully:', data);
      toast.success('Trip loading completed');
      
      // Invalidate relevant queries
      utils.trips.list.invalidate();
      utils.trips.get.invalidate();
      utils.trips.getTimeline.invalidate();
      utils.trips.getLoadingProgress.invalidate();
    },
    onError: (error: Error) => {
      console.error('Complete loading mutation error:', error);
      toast.error(error.message || 'Failed to complete trip loading');
    },
  });
};

// Start trip departure mutation
export const useStartTripDeparture = () => {
  const utils = trpc.useContext();
  
  return trpc.trips.startDeparture.useMutation({
    onSuccess: (data) => {
      console.log('Trip departure started successfully:', data);
      toast.success('Trip departed successfully');
      
      // Invalidate relevant queries
      utils.trips.list.invalidate();
      utils.trips.get.invalidate();
      utils.trips.getTimeline.invalidate();
      utils.trips.getDailySchedule.invalidate();
    },
    onError: (error: Error) => {
      console.error('Start departure mutation error:', error);
      toast.error(error.message || 'Failed to start trip departure');
    },
  });
};

// Complete trip mutation
export const useCompleteTrip = () => {
  const utils = trpc.useContext();
  
  return trpc.trips.complete.useMutation({
    onSuccess: (data) => {
      console.log('Trip completed successfully:', data);
      toast.success('Trip completed successfully');
      
      // Invalidate relevant queries
      utils.trips.list.invalidate();
      utils.trips.get.invalidate();
      utils.trips.getTimeline.invalidate();
      utils.trips.getDailySchedule.invalidate();
    },
    onError: (error: Error) => {
      console.error('Complete trip mutation error:', error);
      toast.error(error.message || 'Failed to complete trip');
    },
  });
};

// Cancel trip mutation
export const useCancelTrip = () => {
  const utils = trpc.useContext();
  
  return trpc.trips.cancel.useMutation({
    onSuccess: (data) => {
      console.log('Trip cancelled successfully:', data);
      toast.success('Trip cancelled successfully');
      
      // Invalidate relevant queries
      utils.trips.list.invalidate();
      utils.trips.get.invalidate();
      utils.trips.getTimeline.invalidate();
      utils.trips.getDailySchedule.invalidate();
    },
    onError: (error: Error) => {
      console.error('Cancel trip mutation error:', error);
      toast.error(error.message || 'Failed to cancel trip');
    },
  });
};

// Trip metrics hook
export const useTripMetrics = (tripId?: string, dateFrom?: string, dateTo?: string) => {
  return trpc.trips.getMetrics.useQuery(
    { 
      trip_id: tripId,
      date_from: dateFrom,
      date_to: dateTo 
    },
    {
      enabled: Boolean(tripId || (dateFrom && dateTo)),
      staleTime: 60000, // Cache for 1 minute
      onError: (error: any) => {
        console.error('useTripMetrics query error:', error);
      }
    }
  );
};

// Loading efficiency report hook
export const useLoadingEfficiencyReport = (dateFrom: string, dateTo: string) => {
  return trpc.trips.getLoadingEfficiencyReport.useQuery(
    { date_from: dateFrom, date_to: dateTo },
    {
      enabled: Boolean(dateFrom && dateTo),
      staleTime: 300000, // Cache for 5 minutes
      onError: (error: any) => {
        console.error('useLoadingEfficiencyReport query error:', error);
      }
    }
  );
};

// Delivery performance report hook
export const useDeliveryPerformanceReport = (dateFrom: string, dateTo: string) => {
  return trpc.trips.getDeliveryPerformanceReport.useQuery(
    { date_from: dateFrom, date_to: dateTo },
    {
      enabled: Boolean(dateFrom && dateTo),
      staleTime: 300000, // Cache for 5 minutes
      onError: (error: any) => {
        console.error('useDeliveryPerformanceReport query error:', error);
      }
    }
  );
};

// Combined hook for trip management dashboard
export const useTripDashboard = (date?: string) => {
  const targetDate = date || new Date().toISOString().split('T')[0];
  
  const { data: schedule, isLoading: scheduleLoading } = useDailyTripSchedule(targetDate);
  const { data: trips, isLoading: tripsLoading } = useTrips({ 
    date_from: targetDate,
    date_to: targetDate,
    limit: 50 
  });

  return {
    schedule,
    trips: trips?.trips || [],
    summary: schedule?.summary,
    isLoading: scheduleLoading || tripsLoading,
    refetch: () => {
      // This would trigger refetch of relevant queries
      const utils = trpc.useContext();
      utils.trips.getDailySchedule.invalidate();
      utils.trips.list.invalidate();
    }
  };
};

// Utility hook for available orders (not assigned to any trip)
export const useAvailableOrders = (filters: { date?: string; truck_id?: string } = {}) => {
  return trpc.trips.getAvailableOrders.useQuery({
    date: filters.date,
    truck_id: filters.truck_id,
  }, {
    staleTime: 30000,
    onError: (error: any) => {
      console.error('useAvailableOrders query error:', error);
    }
  });
};

// Hook for getting confirmed orders available for trip assignment
export const useAvailableOrdersForAssignment = (filters: { 
  search?: string; 
  limit?: number; 
  offset?: number; 
} = {}) => {
  return trpc.trips.getAvailableOrdersForAssignment.useQuery({
    search: filters.search,
    limit: filters.limit || 50,
    offset: filters.offset || 0,
  }, {
    staleTime: 30000,
    onError: (error: any) => {
      console.error('useAvailableOrdersForAssignment query error:', error);
    }
  });
};

// Real-time trip tracking hook (for active trips)
export const useActiveTripTracking = () => {
  return trpc.trips.getActiveTrips.useQuery(undefined, {
    refetchInterval: 30000, // Refetch every 30 seconds for real-time updates
    staleTime: 10000,
    onError: (error: any) => {
      console.error('useActiveTripTracking query error:', error);
    }
  });
};