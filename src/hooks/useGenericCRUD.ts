import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

interface GenericCRUDConfig<T, CreateT, UpdateT, FiltersT> {
  tableName: string;
  queryKey: string;
  selectFields?: string;
  defaultFilters?: Partial<FiltersT>;
  itemsPerPage?: number;
  toastMessages?: {
    create?: string;
    update?: string;
    delete?: string;
  };
  transforms?: {
    beforeCreate?: (data: CreateT) => any;
    beforeUpdate?: (data: UpdateT) => any;
    afterFetch?: (data: any[]) => T[];
  };
}

export function useGenericList<T, FiltersT extends Record<string, any>>(
  config: Pick<GenericCRUDConfig<T, any, any, FiltersT>, 'tableName' | 'queryKey' | 'selectFields' | 'itemsPerPage' | 'transforms'>,
  filters: FiltersT = {} as FiltersT
) {
  const itemsPerPage = config.itemsPerPage || 50;
  
  return useQuery({
    queryKey: [config.queryKey, filters],
    queryFn: async () => {
      console.log(`Fetching ${config.tableName} with filters:`, filters);
      
      let query = supabase
        .from(config.tableName)
        .select(config.selectFields || '*', { count: 'exact' });

      // Apply search filter if exists
      if (filters.search) {
        // This is a simplified search - each implementing hook can override this
        query = query.or(`name.ilike.%${filters.search}%`);
      }

      // Apply other filters
      Object.entries(filters).forEach(([key, value]) => {
        if (key !== 'search' && key !== 'page' && key !== 'limit' && value !== undefined && value !== '') {
          if (key.includes('_from')) {
            const field = key.replace('_from', '');
            query = query.gte(field, value);
          } else if (key.includes('_to')) {
            const field = key.replace('_to', '');
            query = query.lte(field, value);
          } else {
            query = query.eq(key, value);
          }
        }
      });

      // Apply pagination
      const page = filters.page || 1;
      const limit = filters.limit || itemsPerPage;
      const from = (page - 1) * limit;
      const to = from + limit - 1;
      
      query = query.range(from, to).order('created_at', { ascending: false });

      const { data, error, count } = await query;

      if (error) {
        console.error(`${config.tableName} fetch error:`, error);
        throw new Error(error.message);
      }

      const transformedData = config.transforms?.afterFetch 
        ? config.transforms.afterFetch(data || [])
        : (data || []) as T[];

      return {
        items: transformedData,
        total: count || 0,
        page,
        totalPages: Math.ceil((count || 0) / limit),
        hasMore: to < (count || 0) - 1
      };
    },
    staleTime: 30000,
  });
}

export function useGenericGet<T>(
  config: Pick<GenericCRUDConfig<T, any, any, any>, 'tableName' | 'queryKey' | 'selectFields' | 'transforms'>,
  id: string
) {
  return useQuery({
    queryKey: [config.queryKey, id],
    queryFn: async () => {
      console.log(`Fetching ${config.tableName} with id:`, id);
      
      if (!id || id === 'null' || id === 'undefined') {
        throw new Error('Invalid ID provided');
      }

      const { data, error } = await supabase
        .from(config.tableName)
        .select(config.selectFields || '*')
        .eq('id', id)
        .single();

      if (error) {
        console.error(`${config.tableName} get error:`, error);
        throw new Error(error.message);
      }

      return config.transforms?.afterFetch 
        ? config.transforms.afterFetch([data])[0]
        : data as T;
    },
    enabled: !!id && id !== 'null' && id !== 'undefined',
    staleTime: 30000,
  });
}

export function useGenericCreate<T, CreateT>(
  config: GenericCRUDConfig<T, CreateT, any, any>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (createData: CreateT) => {
      console.log(`Creating ${config.tableName}:`, createData);
      
      const transformedData = config.transforms?.beforeCreate 
        ? config.transforms.beforeCreate(createData)
        : createData;

      const { data, error } = await supabase
        .from(config.tableName)
        .insert([{
          ...transformedData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }])
        .select(config.selectFields || '*')
        .single();

      if (error) {
        console.error(`${config.tableName} create error:`, error);
        throw new Error(error.message);
      }

      return config.transforms?.afterFetch 
        ? config.transforms.afterFetch([data])[0]
        : data as T;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [config.queryKey] });
      toast.success(config.toastMessages?.create || `${config.tableName} created successfully`);
    },
    onError: (error: Error) => {
      console.error(`${config.tableName} create mutation error:`, error);
      toast.error(error.message || `Failed to create ${config.tableName}`);
    },
  });
}

export function useGenericUpdate<T, UpdateT extends { id: string }>(
  config: GenericCRUDConfig<T, any, UpdateT, any>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updateData }: UpdateT) => {
      console.log(`Updating ${config.tableName}:`, id, updateData);
      
      if (!id || id === 'null' || id === 'undefined') {
        throw new Error('Invalid ID provided');
      }

      const transformedData = config.transforms?.beforeUpdate 
        ? config.transforms.beforeUpdate({ id, ...updateData } as UpdateT)
        : updateData;

      const { data, error } = await supabase
        .from(config.tableName)
        .update({
          ...transformedData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select(config.selectFields || '*')
        .single();

      if (error) {
        console.error(`${config.tableName} update error:`, error);
        throw new Error(error.message);
      }

      return config.transforms?.afterFetch 
        ? config.transforms.afterFetch([data])[0]
        : data as T;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [config.queryKey] });
      queryClient.invalidateQueries({ queryKey: [config.queryKey, (data as any).id] });
      toast.success(config.toastMessages?.update || `${config.tableName} updated successfully`);
    },
    onError: (error: Error) => {
      console.error(`${config.tableName} update mutation error:`, error);
      toast.error(error.message || `Failed to update ${config.tableName}`);
    },
  });
}

export function useGenericDelete<T extends { id: string }>(
  config: GenericCRUDConfig<T, any, any, any>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (item: T) => {
      console.log(`Deleting ${config.tableName}:`, item.id);
      
      if (!item.id || item.id === 'null' || item.id === 'undefined') {
        throw new Error('Invalid ID provided');
      }

      const { error } = await supabase
        .from(config.tableName)
        .delete()
        .eq('id', item.id);

      if (error) {
        console.error(`${config.tableName} delete error:`, error);
        throw new Error(error.message);
      }

      return item.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [config.queryKey] });
      toast.success(config.toastMessages?.delete || `${config.tableName} deleted successfully`);
    },
    onError: (error: Error) => {
      console.error(`${config.tableName} delete mutation error:`, error);
      toast.error(error.message || `Failed to delete ${config.tableName}`);
    },
  });
}

// Utility function to create a complete CRUD hook set
export function createCRUDHooks<T, CreateT, UpdateT extends { id: string }, FiltersT extends Record<string, any>>(
  config: GenericCRUDConfig<T, CreateT, UpdateT, FiltersT>
) {
  return {
    useList: (filters: FiltersT) => useGenericList(config, filters),
    useGet: (id: string) => useGenericGet(config, id),
    useCreate: () => useGenericCreate(config),
    useUpdate: () => useGenericUpdate(config),
    useDelete: () => useGenericDelete(config),
  };
} 