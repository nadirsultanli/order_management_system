import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Warehouse, CreateWarehouseData, UpdateWarehouseData, WarehouseFilters, WarehouseStats } from '../types/warehouse';
import toast from 'react-hot-toast';

const WAREHOUSES_PER_PAGE = 50;

export const useWarehouses = (filters: WarehouseFilters = {}) => {
  return useQuery({
    queryKey: ['warehouses', filters],
    queryFn: async () => {
      console.log('Fetching warehouses with filters:', filters);
      
      let query = supabase
        .from('warehouses')
        .select(`
          *,
          address:addresses(
            id,
            line1,
            line2,
            city,
            state,
            postal_code,
            country,
            instructions,
            latitude,
            longitude
          )
        `, { count: 'exact' })
        .order('created_at', { ascending: false });

      // Apply search filter
      if (filters.search) {
        query = query.ilike('name', `%${filters.search}%`);
      }

      // Apply pagination
      const page = filters.page || 1;
      const limit = filters.limit || WAREHOUSES_PER_PAGE;
      const from = (page - 1) * limit;
      const to = from + limit - 1;
      
      query = query.range(from, to);

      const { data, error, count } = await query;

      console.log('Supabase warehouses response:', { data, error, count });

      if (error) {
        console.error('Supabase warehouses error:', error);
        throw new Error(error.message);
      }

      return {
        warehouses: (data || []) as Warehouse[],
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
        currentPage: page,
      };
    },
    retry: 1,
    staleTime: 30000,
  });
};

export const useWarehouse = (id: string) => {
  return useQuery({
    queryKey: ['warehouse', id],
    queryFn: async () => {
      console.log('Fetching warehouse:', id);
      
      const { data, error } = await supabase
        .from('warehouses')
        .select(`
          *,
          address:addresses(
            id,
            line1,
            line2,
            city,
            state,
            postal_code,
            country,
            instructions,
            latitude,
            longitude
          )
        `)
        .eq('id', id)
        .single();

      console.log('Warehouse fetch result:', { data, error });

      if (error) {
        console.error('Warehouse fetch error:', error);
        throw new Error(error.message);
      }

      return data as Warehouse;
    },
    enabled: !!id,
  });
};

export const useWarehouseStats = () => {
  return useQuery({
    queryKey: ['warehouse-stats'],
    queryFn: async () => {
      console.log('Fetching warehouse statistics');
      
      const { data, error } = await supabase
        .from('warehouses')
        .select('capacity_cylinders');

      if (error) {
        console.error('Warehouse stats error:', error);
        throw new Error(error.message);
      }

      const capacities = data
        .map(w => w.capacity_cylinders)
        .filter(c => c !== null && c !== undefined) as number[];

      const stats: WarehouseStats = {
        total: data.length,
        total_capacity: capacities.reduce((sum, cap) => sum + cap, 0),
        average_capacity: capacities.length > 0 ? Math.round(capacities.reduce((sum, cap) => sum + cap, 0) / capacities.length) : 0,
      };

      console.log('Warehouse stats:', stats);
      return stats;
    },
    staleTime: 60000,
  });
};

export const useWarehouseOptions = () => {
  return useQuery({
    queryKey: ['warehouse-options'],
    queryFn: async () => {
      console.log('Fetching warehouse options');
      
      const { data, error } = await supabase
        .from('warehouses')
        .select(`
          id,
          name,
          address:addresses(city, state)
        `)
        .order('name');

      if (error) {
        console.error('Warehouse options error:', error);
        throw new Error(error.message);
      }

      return (data || []).map(w => ({
        id: w.id,
        name: w.name,
        city: w.address?.city,
        state: w.address?.state,
      }));
    },
    staleTime: 300000, // 5 minutes
  });
};

export const useCreateWarehouse = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (warehouseData: CreateWarehouseData) => {
      console.log('Creating warehouse:', warehouseData);
      
      // Check name uniqueness
      const { data: existingName } = await supabase
        .from('warehouses')
        .select('id')
        .eq('name', warehouseData.name)
        .single();

      if (existingName) {
        throw new Error('Warehouse name already exists. Please use a unique name.');
      }

      // Start transaction by creating address first if provided
      let addressId = null;
      if (warehouseData.address) {
        const { data: addressData, error: addressError } = await supabase
          .from('addresses')
          .insert([{
            ...warehouseData.address,
            customer_id: null, // Not linked to a customer
            is_primary: false,
            created_at: new Date().toISOString(),
          }])
          .select()
          .single();

        if (addressError) {
          console.error('Address creation error:', addressError);
          throw new Error(`Failed to create address: ${addressError.message}`);
        }

        addressId = addressData.id;
      }

      // Create warehouse
      const { data, error } = await supabase
        .from('warehouses')
        .insert([{
          name: warehouseData.name,
          capacity_cylinders: warehouseData.capacity_cylinders,
          address_id: addressId,
          created_at: new Date().toISOString(),
        }])
        .select(`
          *,
          address:addresses(
            id,
            line1,
            line2,
            city,
            state,
            postal_code,
            country,
            instructions
          )
        `)
        .single();

      console.log('Create warehouse result:', { data, error });

      if (error) {
        // If warehouse creation fails but address was created, clean up
        if (addressId) {
          await supabase.from('addresses').delete().eq('id', addressId);
        }
        console.error('Create warehouse error:', error);
        throw new Error(error.message);
      }

      return data as Warehouse;
    },
    onSuccess: (data) => {
      console.log('Warehouse created successfully:', data);
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-stats'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-options'] });
      toast.success('Warehouse created successfully');
    },
    onError: (error: Error) => {
      console.error('Create warehouse mutation error:', error);
      toast.error(error.message || 'Failed to create warehouse');
    },
  });
};

export const useUpdateWarehouse = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updateData }: UpdateWarehouseData) => {
      console.log('Updating warehouse:', id, updateData);
      
      // Check name uniqueness if name is being updated
      if (updateData.name) {
        const { data: existingName } = await supabase
          .from('warehouses')
          .select('id')
          .eq('name', updateData.name)
          .neq('id', id)
          .single();

        if (existingName) {
          throw new Error('Warehouse name already exists. Please use a unique name.');
        }
      }

      // Get current warehouse to check if it has an address
      const { data: currentWarehouse } = await supabase
        .from('warehouses')
        .select('address_id')
        .eq('id', id)
        .single();

      let addressId = currentWarehouse?.address_id;

      // Handle address update/creation
      if (updateData.address) {
        if (addressId) {
          // Update existing address
          const { error: addressError } = await supabase
            .from('addresses')
            .update(updateData.address)
            .eq('id', addressId);

          if (addressError) {
            console.error('Address update error:', addressError);
            throw new Error(`Failed to update address: ${addressError.message}`);
          }
        } else {
          // Create new address
          const { data: addressData, error: addressError } = await supabase
            .from('addresses')
            .insert([{
              ...updateData.address,
              customer_id: null,
              is_primary: false,
              created_at: new Date().toISOString(),
            }])
            .select()
            .single();

          if (addressError) {
            console.error('Address creation error:', addressError);
            throw new Error(`Failed to create address: ${addressError.message}`);
          }

          addressId = addressData.id;
        }
      }

      // Update warehouse
      const warehouseUpdate: any = {
        name: updateData.name,
        capacity_cylinders: updateData.capacity_cylinders,
      };

      if (addressId) {
        warehouseUpdate.address_id = addressId;
      }

      const { data, error } = await supabase
        .from('warehouses')
        .update(warehouseUpdate)
        .eq('id', id)
        .select(`
          *,
          address:addresses(
            id,
            line1,
            line2,
            city,
            state,
            postal_code,
            country,
            instructions
          )
        `)
        .single();

      console.log('Update warehouse result:', { data, error });

      if (error) {
        console.error('Update warehouse error:', error);
        throw new Error(error.message);
      }

      return data as Warehouse;
    },
    onSuccess: (data) => {
      console.log('Warehouse updated successfully:', data);
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse', data.id] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-stats'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-options'] });
      toast.success('Warehouse updated successfully');
    },
    onError: (error: Error) => {
      console.error('Update warehouse mutation error:', error);
      toast.error(error.message || 'Failed to update warehouse');
    },
  });
};

export const useDeleteWarehouse = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      console.log('Deleting warehouse:', id);
      
      // Get warehouse with address info
      const { data: warehouse } = await supabase
        .from('warehouses')
        .select('address_id')
        .eq('id', id)
        .single();

      // Delete warehouse first
      const { error } = await supabase
        .from('warehouses')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Delete warehouse error:', error);
        throw new Error(error.message);
      }

      // Delete associated address if it exists
      if (warehouse?.address_id) {
        await supabase
          .from('addresses')
          .delete()
          .eq('id', warehouse.address_id);
      }

      return id;
    },
    onSuccess: (id) => {
      console.log('Warehouse deleted successfully:', id);
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-stats'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-options'] });
      toast.success('Warehouse deleted successfully');
    },
    onError: (error: Error) => {
      console.error('Delete warehouse mutation error:', error);
      toast.error(error.message || 'Failed to delete warehouse');
    },
  });
};