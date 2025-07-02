import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Product, CreateProductData, UpdateProductData, ProductFilters, ProductStats } from '../types/product';
import toast from 'react-hot-toast';

const PRODUCTS_PER_PAGE = 50;

export const useProducts = (filters: ProductFilters = {}) => {
  return useQuery({
    queryKey: ['products', filters],
    queryFn: async () => {
      console.log('Fetching products with filters:', filters);
      
      let query = supabase
        .from('products')
        .select('*', { count: 'exact' });

      // By default, hide obsolete products unless specifically requested
      if (!filters.show_obsolete) {
        query = query.in('status', ['active', 'end_of_sale']);
      }

      // Apply search filter
      if (filters.search) {
        query = query.or(`sku.ilike.%${filters.search}%,name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
      }

      // Apply status filter
      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      // Apply unit of measure filter
      if (filters.unit_of_measure) {
        query = query.eq('unit_of_measure', filters.unit_of_measure);
      }

      // Apply sorting
      const sortBy = filters.sort_by || 'created_at';
      const sortOrder = filters.sort_order || 'desc';
      query = query.order(sortBy, { ascending: sortOrder === 'asc' });

      // Apply pagination
      const page = filters.page || 1;
      const limit = filters.limit || PRODUCTS_PER_PAGE;
      const from = (page - 1) * limit;
      const to = from + limit - 1;
      
      query = query.range(from, to);

      const { data, error, count } = await query;

      console.log('Supabase products response:', { data, error, count });

      if (error) {
        console.error('Supabase products error:', error);
        throw new Error(error.message);
      }

      return {
        products: (data || []) as Product[],
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
        currentPage: page,
      };
    },
    retry: 1,
    staleTime: 30000,
  });
};

export const useProduct = (id: string) => {
  return useQuery({
    queryKey: ['product', id],
    queryFn: async () => {
      console.log('Fetching product:', id);
      
      if (!id || id === 'null' || id === 'undefined') {
        throw new Error('Invalid product ID');
      }
      
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .single();

      console.log('Product fetch result:', { data, error });

      if (error) {
        console.error('Product fetch error:', error);
        throw new Error(error.message);
      }

      return data as Product;
    },
    enabled: !!id && id !== 'null' && id !== 'undefined',
  });
};

export const useProductStats = () => {
  return useQuery({
    queryKey: ['product-stats'],
    queryFn: async () => {
      console.log('Fetching product statistics');
      
      const { data, error } = await supabase
        .from('products')
        .select('status, unit_of_measure');

      if (error) {
        console.error('Product stats error:', error);
        throw new Error(error.message);
      }

      const stats: ProductStats = {
        total: data.filter(p => p.status !== 'obsolete').length, // Exclude obsolete from total
        active: data.filter(p => p.status === 'active').length,
        end_of_sale: data.filter(p => p.status === 'end_of_sale').length,
        obsolete: data.filter(p => p.status === 'obsolete').length,
        cylinders: data.filter(p => p.unit_of_measure === 'cylinder' && p.status !== 'obsolete').length,
        kg_products: data.filter(p => p.unit_of_measure === 'kg' && p.status !== 'obsolete').length,
      };

      console.log('Product stats:', stats);
      return stats;
    },
    staleTime: 60000, // 1 minute
  });
};

export const useCreateProduct = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (productData: CreateProductData) => {
      console.log('Creating product:', productData);
      
      // Check SKU uniqueness among non-obsolete products
      const { data: existingSku } = await supabase
        .from('products')
        .select('id')
        .eq('sku', productData.sku)
        .neq('status', 'obsolete')
        .single();

      if (existingSku) {
        throw new Error('SKU already exists. Please use a unique SKU.');
      }

      // Check barcode uniqueness if provided
      if (productData.barcode_uid) {
        const { data: existingBarcode } = await supabase
          .from('products')
          .select('id')
          .eq('barcode_uid', productData.barcode_uid)
          .neq('status', 'obsolete')
          .single();

        if (existingBarcode) {
          throw new Error('Barcode UID already exists. Please use a unique barcode.');
        }
      }

      const { data, error } = await supabase
        .from('products')
        .insert([{
          ...productData,
          created_at: new Date().toISOString(),
        }])
        .select()
        .single();

      console.log('Create product result:', { data, error });

      if (error) {
        console.error('Create product error:', error);
        throw new Error(error.message);
      }

      return data as Product;
    },
    onSuccess: (data) => {
      console.log('Product created successfully:', data);
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product-stats'] });
      toast.success('Product created successfully');
    },
    onError: (error: Error) => {
      console.error('Create product mutation error:', error);
      toast.error(error.message || 'Failed to create product');
    },
  });
};

export const useUpdateProduct = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updateData }: UpdateProductData) => {
      console.log('Updating product:', id, updateData);
      
      if (!id || id === 'null' || id === 'undefined') {
        throw new Error('Invalid product ID');
      }
      
      // Check SKU uniqueness if SKU is being updated
      if (updateData.sku) {
        const { data: existingSku } = await supabase
          .from('products')
          .select('id')
          .eq('sku', updateData.sku)
          .neq('id', id)
          .neq('status', 'obsolete')
          .single();

        if (existingSku) {
          throw new Error('SKU already exists. Please use a unique SKU.');
        }
      }

      // Check barcode uniqueness if barcode is being updated
      if (updateData.barcode_uid) {
        const { data: existingBarcode } = await supabase
          .from('products')
          .select('id')
          .eq('barcode_uid', updateData.barcode_uid)
          .neq('id', id)
          .neq('status', 'obsolete')
          .single();

        if (existingBarcode) {
          throw new Error('Barcode UID already exists. Please use a unique barcode.');
        }
      }

      const { data, error } = await supabase
        .from('products')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      console.log('Update product result:', { data, error });

      if (error) {
        console.error('Update product error:', error);
        throw new Error(error.message);
      }

      return data as Product;
    },
    onSuccess: (data) => {
      console.log('Product updated successfully:', data);
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product', data.id] });
      queryClient.invalidateQueries({ queryKey: ['product-stats'] });
      toast.success('Product updated successfully');
    },
    onError: (error: Error) => {
      console.error('Update product mutation error:', error);
      toast.error(error.message || 'Failed to update product');
    },
  });
};

export const useDeleteProduct = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      console.log('Marking product as obsolete:', id);
      
      if (!id || id === 'null' || id === 'undefined') {
        throw new Error('Invalid product ID');
      }
      
      // Instead of deleting, mark as obsolete
      const { data, error } = await supabase
        .from('products')
        .update({ 
          status: 'obsolete'
        })
        .eq('id', id)
        .select()
        .single();

      console.log('Mark product obsolete result:', { data, error });

      if (error) {
        console.error('Mark product obsolete error:', error);
        throw new Error(error.message);
      }

      return data as Product;
    },
    onSuccess: (data) => {
      console.log('Product marked as obsolete successfully:', data);
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product-stats'] });
      toast.success('Product marked as obsolete and hidden from active lists');
    },
    onError: (error: Error) => {
      console.error('Mark product obsolete mutation error:', error);
      toast.error(error.message || 'Failed to mark product as obsolete');
    },
  });
};

export const useBulkUpdateProductStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ productIds, status }: { productIds: string[], status: string }) => {
      console.log('Bulk updating product status:', productIds, status);
      
      // Filter out invalid IDs
      const validIds = productIds.filter(id => id && id !== 'null' && id !== 'undefined');
      
      if (validIds.length === 0) {
        throw new Error('No valid product IDs provided');
      }
      
      const { data, error } = await supabase
        .from('products')
        .update({ 
          status
        })
        .in('id', validIds)
        .select();

      console.log('Bulk update result:', { data, error });

      if (error) {
        console.error('Bulk update error:', error);
        throw new Error(error.message);
      }

      return data as Product[];
    },
    onSuccess: (data) => {
      console.log('Products updated successfully:', data);
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product-stats'] });
      toast.success(`${data.length} products updated successfully`);
    },
    onError: (error: Error) => {
      console.error('Bulk update mutation error:', error);
      toast.error(error.message || 'Failed to update products');
    },
  });
};

export const useReactivateProduct = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      console.log('Reactivating product:', id);
      
      if (!id || id === 'null' || id === 'undefined') {
        throw new Error('Invalid product ID');
      }
      
      const { data, error } = await supabase
        .from('products')
        .update({ 
          status: 'active'
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return data as Product;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product', data.id] });
      queryClient.invalidateQueries({ queryKey: ['product-stats'] });
      toast.success('Product reactivated successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to reactivate product');
    },
  });
};