import { CreateWarehouseData, UpdateWarehouseData, WarehouseFilters } from '../types/warehouse';
import { trpc } from '../lib/trpc-client';
import toast from 'react-hot-toast';

export const useWarehouses = (filters: WarehouseFilters = {}) => {
  return trpc.warehouses.list.useQuery(filters, {
    retry: 1,
    staleTime: 30000,
  });
};

export const useWarehouse = (id: string) => {
  return trpc.warehouses.get.useQuery(
    { id },
    {
      enabled: Boolean(id),
    }
  );
};

export const useWarehouseStats = () => {
  return trpc.warehouses.getStats.useQuery(undefined, {
    staleTime: 60000,
  });
};

export const useWarehouseOptions = () => {
  return trpc.warehouses.getOptions.useQuery(undefined, {
    staleTime: 300000, // 5 minutes
  });
};

export const useCreateWarehouse = () => {
  return trpc.warehouses.create.useMutation({
    onSuccess: (data) => {
      console.log('Warehouse created successfully:', data);
      toast.success('Warehouse created successfully');
    },
    onError: (error: Error) => {
      console.error('Create warehouse mutation error:', error);
      toast.error(error.message || 'Failed to create warehouse');
    },
  });
};

export const useUpdateWarehouse = () => {
  return trpc.warehouses.update.useMutation({
    onSuccess: (data) => {
      console.log('Warehouse updated successfully:', data);
      toast.success('Warehouse updated successfully');
    },
    onError: (error: Error) => {
      console.error('Update warehouse mutation error:', error);
      toast.error(error.message || 'Failed to update warehouse');
    },
  });
};

export const useDeleteWarehouse = () => {
  return trpc.warehouses.delete.useMutation({
    onSuccess: (_, variables) => {
      console.log('Warehouse deleted successfully:', variables.id);
      toast.success('Warehouse deleted successfully');
    },
    onError: (error: Error) => {
      console.error('Delete warehouse mutation error:', error);
      toast.error(error.message || 'Failed to delete warehouse');
    },
  });
};