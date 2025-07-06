import { 
  Truck, 
  TruckWithInventory, 
  TruckRoute, 
  TruckAllocation,
  TruckCapacityInfo,
  DailyTruckSchedule,
  MaintenanceRecord,
  TruckInventoryItem 
} from '../types/truck';
import { 
  calculateTruckCapacity,
  generateDailyTruckSchedule,
  calculateFleetUtilization 
} from '../utils/truck-capacity';
import { trpc } from '../lib/trpc-client';
import toast from 'react-hot-toast';

export const useTrucks = (filters: any = {}) => {
  return trpc.trucks.list.useQuery(filters, {
    retry: 1,
    staleTime: 30000,
    select: (data) => {
      // Debug logging
      console.log('Raw trucks data from API:', data);
      
      // Transform the data to match the expected format
      const result = {
        trucks: data?.trucks || [],
        isLoading: false,
        error: null,
        totalCount: data?.totalCount || 0,
        totalPages: data?.totalPages || 0,
        currentPage: data?.currentPage || 1,
      };
      
      console.log('Transformed trucks data:', result);
      return result;
    },
    onError: (error) => {
      console.error('useTrucks query error:', error);
    }
  });
};

export const useTruck = (id: string) => {
  return trpc.trucks.get.useQuery(
    { id },
    {
      enabled: Boolean(id),
    }
  );
};

export const useCreateTruck = () => {
  const utils = trpc.useContext();
  
  return trpc.trucks.create.useMutation({
    onSuccess: (data) => {
      console.log('Truck created successfully:', data);
      toast.success('Truck created successfully');
      
      // Invalidate trucks queries to refresh data
      utils.trucks.list.invalidate();
    },
    onError: (error: Error) => {
      console.error('Create truck mutation error:', error);
      toast.error(error.message || 'Failed to create truck');
    },
  });
};

export const useUpdateTruck = () => {
  const utils = trpc.useContext();
  
  return trpc.trucks.update.useMutation({
    onSuccess: (data) => {
      console.log('Truck updated successfully:', data);
      toast.success('Truck updated successfully');
      
      // Invalidate trucks queries to refresh data
      utils.trucks.list.invalidate();
      utils.trucks.get.invalidate();
    },
    onError: (error: Error) => {
      console.error('Update truck mutation error:', error);
      toast.error(error.message || 'Failed to update truck');
    },
  });
};

export const useDeleteTruck = () => {
  const utils = trpc.useContext();
  
  return trpc.trucks.delete.useMutation({
    onSuccess: (_, variables) => {
      console.log('Truck deleted successfully:', variables.id);
      toast.success('Truck deleted successfully');
      
      // Invalidate trucks queries to refresh data
      utils.trucks.list.invalidate();
    },
    onError: (error: Error) => {
      console.error('Delete truck mutation error:', error);
      toast.error(error.message || 'Failed to delete truck');
    },
  });
};

// Hook for truck capacity management
export const useTruckCapacity = (date?: string) => {
  const targetDate = date || new Date().toISOString().split('T')[0];
  
  const { data: trucks = [] } = trpc.trucks.list.useQuery({});
  const { data: allocations = [], isLoading: allocationsLoading } = trpc.trucks.getAllocations.useQuery({ 
    date: targetDate 
  });

  const schedules = generateDailyTruckSchedule(trucks.trucks || [], allocations, targetDate);
  const fleetUtilization = calculateFleetUtilization(schedules);

  const allocateOrderToTruck = trpc.trucks.allocateOrder.useMutation({
    onSuccess: () => {
      toast.success('Order allocated to truck successfully');
      
      // Invalidate truck queries to refresh data
      const utils = trpc.useContext();
      utils.trucks.list.invalidate();
      utils.trucks.get.invalidate();
      utils.trucks.getAllocations.invalidate();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to allocate order to truck');
    },
  });

  const updateAllocation = trpc.trucks.updateAllocation.useMutation({
    onSuccess: () => {
      toast.success('Truck allocation updated successfully');
      
      // Invalidate truck queries to refresh data
      const utils = trpc.useContext();
      utils.trucks.list.invalidate();
      utils.trucks.get.invalidate();
      utils.trucks.getAllocations.invalidate();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update truck allocation');
    },
  });

  return {
    schedules,
    fleetUtilization,
    allocations,
    allocationsLoading,
    allocateOrderToTruck,
    updateAllocation
  };
};

// Hook for truck routes management
export const useTruckRoutes = (truckId?: string, date?: string) => {
  const targetDate = date || new Date().toISOString().split('T')[0];

  const { data: routes = [], isLoading } = trpc.trucks.getRoutes.useQuery({
    truck_id: truckId,
    date: targetDate,
  });

  const createRoute = trpc.trucks.createRoute.useMutation({
    onSuccess: () => {
      toast.success('Truck route created successfully');
      
      // Invalidate truck queries to refresh data
      const utils = trpc.useContext();
      utils.trucks.list.invalidate();
      utils.trucks.get.invalidate();
      utils.trucks.getRoutes.invalidate();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create truck route');
    },
  });

  const updateRoute = trpc.trucks.updateRoute.useMutation({
    onSuccess: () => {
      toast.success('Truck route updated successfully');
      
      // Invalidate truck queries to refresh data
      const utils = trpc.useContext();
      utils.trucks.list.invalidate();
      utils.trucks.get.invalidate();
      utils.trucks.getRoutes.invalidate();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update truck route');
    },
  });

  return {
    routes,
    isLoading,
    createRoute,
    updateRoute
  };
};

// Hook for maintenance management
export const useTruckMaintenance = (truckId?: string) => {
  const { data: maintenanceRecords = [], isLoading } = trpc.trucks.getMaintenance.useQuery({
    truck_id: truckId,
  });

  const scheduleMaintenience = trpc.trucks.scheduleMaintenance.useMutation({
    onSuccess: () => {
      toast.success('Maintenance scheduled successfully');
      
      // Invalidate truck queries to refresh data
      const utils = trpc.useContext();
      utils.trucks.list.invalidate();
      utils.trucks.get.invalidate();
      utils.trucks.getMaintenance.invalidate();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to schedule maintenance');
    },
  });

  const updateMaintenance = trpc.trucks.updateMaintenance.useMutation({
    onSuccess: () => {
      toast.success('Maintenance updated successfully');
      
      // Invalidate truck queries to refresh data
      const utils = trpc.useContext();
      utils.trucks.list.invalidate();
      utils.trucks.get.invalidate();
      utils.trucks.getMaintenance.invalidate();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update maintenance');
    },
  });

  return {
    maintenanceRecords,
    isLoading,
    scheduleMaintenience,
    updateMaintenance
  };
};