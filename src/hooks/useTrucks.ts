import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { TruckInventoryItem } from '../lib/transfers';

export interface Truck {
  id: string;
  fleet_number: string;
  license_plate: string;
  capacity_cylinders: number;
  driver_name: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TruckWithInventory extends Truck {
  inventory: TruckInventoryItem[];
}

export const useTrucks = () => {
  const queryClient = useQueryClient();

  const { data: trucks = [], isLoading, error } = useQuery<TruckWithInventory[]>({
    queryKey: ['trucks'],
    queryFn: async () => {
      // Get all trucks
      const { data: trucksData, error: trucksError } = await supabase
        .from('truck')
        .select('*')
        .order('fleet_number');

      if (trucksError) throw trucksError;

      // Get inventory for all trucks
      const trucksWithInventory = await Promise.all(
        trucksData.map(async (truck) => {
          const { data: inventoryData } = await supabase
            .from('truck_inventory')
            .select(`
              *,
              product:product_id (
                name,
                sku
              )
            `)
            .eq('truck_id', truck.id);

          return {
            ...truck,
            inventory: (inventoryData || []).map((item) => ({
              product_id: item.product_id,
              product_name: item.product.name,
              product_sku: item.product.sku,
              qty_full: item.qty_full,
              qty_empty: item.qty_empty,
              updated_at: item.updated_at
            }))
          };
        })
      );

      return trucksWithInventory;
    }
  });

  const createTruck = useMutation({
    mutationFn: async (data: Omit<Truck, 'id' | 'created_at' | 'updated_at'>) => {
      const { data: newTruck, error } = await supabase
        .from('truck')
        .insert([data])
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