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
    { id: tripId },
    {
      enabled: Boolean(tripId),
      staleTime: 10000, // Refresh more frequently for real-time capacity updates
      onError: (error: any) => {
        console.error('useTripCapacity query error:', error);
      }
    }
  );
};

// Trip loading progress hook - NOT AVAILABLE IN BACKEND
export const useTripLoadingProgress = (tripId: string) => {
  // This procedure doesn't exist in the backend yet
  console.warn('useTripLoadingProgress: Procedure not implemented in backend');
  return {
    data: null,
    isLoading: false,
    error: new Error('Procedure not implemented in backend'),
    refetch: () => {}
  };
};

// Trip timeline hook
export const useTripTimeline = (tripId: string) => {
  return trpc.trips.getTimeline.useQuery(
    { id: tripId },
    {
      enabled: Boolean(tripId),
      staleTime: 15000,
      onError: (error: any) => {
        console.error('useTripTimeline query error:', error);
      }
    }
  );
};

// Daily trip schedule hook - NOT AVAILABLE IN BACKEND
export const useDailyTripSchedule = (date?: string) => {
  // This procedure doesn't exist in the backend yet
  console.warn('useDailyTripSchedule: Procedure not implemented in backend');
  return {
    data: null,
    isLoading: false,
    error: new Error('Procedure not implemented in backend'),
    refetch: () => {}
  };
};

// Create trip mutation
export const useCreateTrip = () => {
  const utils = trpc.useContext();
  
  return trpc.trips.createTrip.useMutation({
    onSuccess: (data: any) => {
      console.log('Trip created successfully:', data);
      // Note: Cache invalidation is handled manually in components for live updates
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
    onSuccess: (data: any) => {
      console.log('Trip updated successfully:', data);
      toast.success('Trip updated successfully');
      
      // Invalidate relevant queries
      utils.trips.list.invalidate();
      utils.trips.get.invalidate();
      // utils.trips.getDailySchedule.invalidate(); // Not available
      utils.trips.getTimeline.invalidate();
    },
    onError: (error: Error) => {
      console.error('Update trip mutation error:', error);
      toast.error(error.message || 'Failed to update trip');
    },
  });
};

// Update trip status mutation
export const  useUpdateTripStatus = () => {
  const utils = trpc.useContext();
  
  return trpc.trips.updateTripStatus.useMutation({
    onSuccess: (data: any) => {
      console.log('Trip status updated successfully:', data);
      toast.success('Trip status updated successfully');
      
      // Invalidate relevant queries
      utils.trips.list.invalidate();
      utils.trips.get.invalidate();
      utils.trips.getTimeline.invalidate();
    },
    onError: (error: Error) => {
      console.error('Update trip status mutation error:', error);
      toast.error(error.message || 'Failed to update trip status');
    },
  });
};

// Delete trip mutation - NOT AVAILABLE IN BACKEND
export const useDeleteTrip = () => {
  // This procedure doesn't exist in the backend yet
  console.warn('useDeleteTrip: Procedure not implemented in backend');
  return {
    mutate: () => {
      toast.error('Delete trip functionality not implemented');
    },
    isLoading: false,
    error: new Error('Procedure not implemented in backend')
  };
};

// Allocate orders to trip mutation - FIXED NAME
export const useAllocateOrdersToTrip = () => {
  const utils = trpc.useContext();
  
  return trpc.trips.allocateOrdersToTrip.useMutation({
    onSuccess: (data: any) => {
      console.log('Orders allocated to trip successfully:', data);
      toast.success('Orders allocated to trip successfully');
      
      // Invalidate relevant queries
      utils.trips.list.invalidate();
      utils.trips.get.invalidate();
      utils.trips.getCapacity.invalidate();
      // utils.trips.getLoadingProgress.invalidate(); // Not available
    },
    onError: (error: Error) => {
      console.error('Allocate orders mutation error:', error);
      toast.error(error.message || 'Failed to allocate orders to trip');
    },
  });
};

// Remove orders from trip mutation - FIXED NAME
export const useRemoveOrdersFromTrip = () => {
  const utils = trpc.useContext();
  
  return trpc.trips.removeOrderFromTrip.useMutation({
    onSuccess: (data: any) => {
      console.log('Orders removed from trip successfully:', data);
      toast.success('Orders removed from trip successfully');
      
      // Invalidate relevant queries
      utils.trips.list.invalidate();
      utils.trips.get.invalidate();
      utils.trips.getCapacity.invalidate();
      // utils.trips.getLoadingProgress.invalidate(); // Not available
    },
    onError: (error: Error) => {
      console.error('Remove orders mutation error:', error);
      toast.error(error.message || 'Failed to remove orders from trip');
    },
  });
};

// Start trip loading mutation - FIXED NAME
export const useStartTripLoading = () => {
  const utils = trpc.useContext();
  
  return trpc.trips.startTripLoading.useMutation({
    onSuccess: (data: any) => {
      console.log('Trip loading started successfully:', data);
      toast.success('Trip loading started');
      
      // Invalidate relevant queries
      utils.trips.list.invalidate();
      utils.trips.get.invalidate();
      utils.trips.getTimeline.invalidate();
      // utils.trips.getLoadingProgress.invalidate(); // Not available
    },
    onError: (error: Error) => {
      console.error('Start loading mutation error:', error);
      toast.error(error.message || 'Failed to start trip loading');
    },
  });
};

// Process trip loading mutation - NOT AVAILABLE IN BACKEND
export const useProcessTripLoading = () => {
  // This procedure doesn't exist in the backend yet
  console.warn('useProcessTripLoading: Procedure not implemented in backend');
  return {
    mutate: () => {
      toast.error('Process loading functionality not implemented');
    },
    isLoading: false,
    error: new Error('Procedure not implemented in backend')
  };
};

// Complete trip loading mutation - FIXED NAME
export const useCompleteTripLoading = () => {
  const utils = trpc.useContext();
  
  return trpc.trips.completeTripLoading.useMutation({
    onSuccess: (data: any) => {
      console.log('Trip loading completed successfully:', data);
      toast.success('Trip loading completed');
      
      // Invalidate relevant queries
      utils.trips.list.invalidate();
      utils.trips.get.invalidate();
      utils.trips.getTimeline.invalidate();
      // utils.trips.getLoadingProgress.invalidate(); // Not available
    },
    onError: (error: Error) => {
      console.error('Complete loading mutation error:', error);
      toast.error(error.message || 'Failed to complete trip loading');
    },
  });
};

// Start trip departure mutation - NOT AVAILABLE IN BACKEND
export const useStartTripDeparture = () => {
  // This procedure doesn't exist in the backend yet
  console.warn('useStartTripDeparture: Procedure not implemented in backend');
  return {
    mutate: () => {
      toast.error('Start departure functionality not implemented');
    },
    isLoading: false,
    error: new Error('Procedure not implemented in backend')
  };
};

// Complete trip mutation - NOT AVAILABLE IN BACKEND
export const useCompleteTrip = () => {
  // This procedure doesn't exist in the backend yet
  console.warn('useCompleteTrip: Procedure not implemented in backend');
  return {
    mutate: () => {
      toast.error('Complete trip functionality not implemented');
    },
    isLoading: false,
    error: new Error('Procedure not implemented in backend')
  };
};

// Cancel trip mutation - NOT AVAILABLE IN BACKEND
export const useCancelTrip = () => {
  // This procedure doesn't exist in the backend yet
  console.warn('useCancelTrip: Procedure not implemented in backend');
  return {
    mutate: () => {
      toast.error('Cancel trip functionality not implemented');
    },
    isLoading: false,
    error: new Error('Procedure not implemented in backend')
  };
};

// Trip metrics hook - NOT AVAILABLE IN BACKEND
export const useTripMetrics = (tripId?: string, dateFrom?: string, dateTo?: string) => {
  // This procedure doesn't exist in the backend yet
  console.warn('useTripMetrics: Procedure not implemented in backend');
  return {
    data: null,
    isLoading: false,
    error: new Error('Procedure not implemented in backend'),
    refetch: () => {}
  };
};

// Loading efficiency report hook - NOT AVAILABLE IN BACKEND
export const useLoadingEfficiencyReport = (dateFrom: string, dateTo: string) => {
  // This procedure doesn't exist in the backend yet
  console.warn('useLoadingEfficiencyReport: Procedure not implemented in backend');
  return {
    data: null,
    isLoading: false,
    error: new Error('Procedure not implemented in backend'),
    refetch: () => {}
  };
};

// Delivery performance report hook - NOT AVAILABLE IN BACKEND
export const useDeliveryPerformanceReport = (dateFrom: string, dateTo: string) => {
  // This procedure doesn't exist in the backend yet
  console.warn('useDeliveryPerformanceReport: Procedure not implemented in backend');
  return {
    data: null,
    isLoading: false,
    error: new Error('Procedure not implemented in backend'),
    refetch: () => {}
  };
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
      // utils.trips.getDailySchedule.invalidate(); // Not available
      utils.trips.list.invalidate();
    }
  };
};

// Utility hook for available orders (not assigned to any trip) - NOT AVAILABLE IN BACKEND
export const useAvailableOrders = (filters: { date?: string; truck_id?: string } = {}) => {
  // This procedure doesn't exist in the backend yet
  console.warn('useAvailableOrders: Procedure not implemented in backend');
  return {
    data: null,
    isLoading: false,
    error: new Error('Procedure not implemented in backend'),
    refetch: () => {}
  };
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

// Real-time trip tracking hook (for active trips) - NOT AVAILABLE IN BACKEND
export const useActiveTripTracking = () => {
  // This procedure doesn't exist in the backend yet
  console.warn('useActiveTripTracking: Procedure not implemented in backend');
  return {
    data: null,
    isLoading: false,
    error: new Error('Procedure not implemented in backend'),
    refetch: () => {}
  };
};