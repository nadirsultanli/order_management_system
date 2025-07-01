import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
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

export const useTrucks = () => {
  const queryClient = useQueryClient();

  const { data: trucks = [], isLoading, error } = useQuery<TruckWithInventory[]>({
    queryKey: ['trucks'],
    queryFn: async () => {
      // Get all trucks with enhanced fields
      const { data: trucksData, error: trucksError } = await supabase
        .from('truck')
        .select('*')
        .order('fleet_number');

      if (trucksError) throw trucksError;

      // Get inventory and routes for all trucks
      const trucksWithDetails = await Promise.all(
        trucksData.map(async (truck: any) => {
          // Get truck inventory
          const { data: inventoryData } = await supabase
            .from('truck_inventory')
            .select(`
              *,
              product:product_id (
                name,
                sku,
                variant_name,
                capacity_kg,
                tare_weight_kg
              )
            `)
            .eq('truck_id', truck.id);

          // Get current route if available
          const { data: routeData } = await supabase
            .from('truck_routes')
            .select('*')
            .eq('truck_id', truck.id)
            .eq('route_date', new Date().toISOString().split('T')[0])
            .maybeSingle();

          // Process inventory with weight calculations
          const inventory: TruckInventoryItem[] = (inventoryData || []).map((item: any) => {
            const product = item.product;
            let weight_kg = 0;
            
            if (product && product.capacity_kg && product.tare_weight_kg) {
              // Calculate weight based on full/empty quantities
              weight_kg = (item.qty_full * (product.capacity_kg + product.tare_weight_kg)) +
                         (item.qty_empty * product.tare_weight_kg);
            }

            return {
              product_id: item.product_id,
              product_name: product?.name || 'Unknown Product',
              product_sku: product?.sku || '',
              product_variant_name: product?.variant_name,
              qty_full: item.qty_full,
              qty_empty: item.qty_empty,
              weight_kg,
              updated_at: item.updated_at
            };
          });

          // Map truck data with enhanced fields and defaults
          const enhancedTruck: TruckWithInventory = {
            ...truck,
            capacity_kg: truck.capacity_kg || truck.capacity_cylinders * 27, // Default 27kg per cylinder
            status: truck.status || (truck.active ? 'active' : 'inactive'),
            inventory,
            current_route: routeData
          };

          return enhancedTruck;
        })
      );

      return trucksWithDetails;
    }
  });

  const createTruck = useMutation({
    mutationFn: async (data: Omit<Truck, 'id' | 'created_at' | 'updated_at'>) => {
      const { data: newTruck, error } = await supabase
        .from('truck')
        .insert([{
          ...data,
          // Ensure required fields have defaults
          capacity_kg: data.capacity_kg || data.capacity_cylinders * 27,
          status: data.status || 'active'
        }])
        .select()
        .single();

      if (error) throw error;
      return newTruck;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trucks'] });
    }
  });

  const updateTruck = useMutation({
    mutationFn: async ({
      id,
      data
    }: {
      id: string;
      data: Partial<Omit<Truck, 'id' | 'created_at' | 'updated_at'>>;
    }) => {
      const { data: updatedTruck, error } = await supabase
        .from('truck')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return updatedTruck;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trucks'] });
    }
  });

  const deleteTruck = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('truck').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trucks'] });
    }
  });

  return {
    trucks,
    isLoading,
    error,
    createTruck,
    updateTruck,
    deleteTruck
  };
};

// Hook for truck capacity management
export const useTruckCapacity = (date?: string) => {
  const queryClient = useQueryClient();
  const { trucks } = useTrucks();
  const targetDate = date || new Date().toISOString().split('T')[0];

  const { data: allocations = [], isLoading: allocationsLoading } = useQuery<TruckAllocation[]>({
    queryKey: ['truck-allocations', targetDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('truck_allocations')
        .select('*')
        .eq('allocation_date', targetDate)
        .neq('status', 'cancelled');

      if (error) throw error;
      return data || [];
    }
  });

  const schedules = generateDailyTruckSchedule(trucks, allocations, targetDate);
  const fleetUtilization = calculateFleetUtilization(schedules);

  const allocateOrderToTruck = useMutation({
    mutationFn: async ({
      order_id,
      truck_id,
      estimated_weight_kg,
      allocation_date = targetDate
    }: {
      order_id: string;
      truck_id: string;
      estimated_weight_kg: number;
      allocation_date?: string;
    }) => {
      const { data, error } = await supabase
        .from('truck_allocations')
        .insert([{
          order_id,
          truck_id,
          estimated_weight_kg,
          allocation_date,
          status: 'planned'
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['truck-allocations'] });
    }
  });

  const updateAllocation = useMutation({
    mutationFn: async ({
      id,
      data
    }: {
      id: string;
      data: Partial<TruckAllocation>;
    }) => {
      const { data: updated, error } = await supabase
        .from('truck_allocations')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['truck-allocations'] });
    }
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
  const queryClient = useQueryClient();
  const targetDate = date || new Date().toISOString().split('T')[0];

  const { data: routes = [], isLoading } = useQuery<TruckRoute[]>({
    queryKey: ['truck-routes', truckId, targetDate],
    queryFn: async () => {
      let query = supabase
        .from('truck_routes')
        .select('*')
        .eq('route_date', targetDate)
        .order('planned_start_time');

      if (truckId) {
        query = query.eq('truck_id', truckId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    }
  });

  const createRoute = useMutation({
    mutationFn: async (data: Omit<TruckRoute, 'id' | 'created_at' | 'updated_at'>) => {
      const { data: newRoute, error } = await supabase
        .from('truck_routes')
        .insert([data])
        .select()
        .single();

      if (error) throw error;
      return newRoute;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['truck-routes'] });
    }
  });

  const updateRoute = useMutation({
    mutationFn: async ({
      id,
      data
    }: {
      id: string;
      data: Partial<TruckRoute>;
    }) => {
      const { data: updated, error } = await supabase
        .from('truck_routes')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['truck-routes'] });
    }
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
  const queryClient = useQueryClient();

  const { data: maintenanceRecords = [], isLoading } = useQuery<MaintenanceRecord[]>({
    queryKey: ['truck-maintenance', truckId],
    queryFn: async () => {
      let query = supabase
        .from('truck_maintenance')
        .select('*')
        .order('scheduled_date', { ascending: false });

      if (truckId) {
        query = query.eq('truck_id', truckId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    }
  });

  const scheduleMaintenience = useMutation({
    mutationFn: async (data: Omit<MaintenanceRecord, 'id' | 'created_at' | 'updated_at'>) => {
      const { data: newRecord, error } = await supabase
        .from('truck_maintenance')
        .insert([data])
        .select()
        .single();

      if (error) throw error;
      return newRecord;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['truck-maintenance'] });
    }
  });

  const updateMaintenance = useMutation({
    mutationFn: async ({
      id,
      data
    }: {
      id: string;
      data: Partial<MaintenanceRecord>;
    }) => {
      const { data: updated, error } = await supabase
        .from('truck_maintenance')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['truck-maintenance'] });
    }
  });

  return {
    maintenanceRecords,
    isLoading,
    scheduleMaintenience,
    updateMaintenance
  };
}; 