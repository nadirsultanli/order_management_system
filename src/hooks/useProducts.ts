import { CreateProductData, UpdateProductData, ProductFilters, CreateVariantData } from '../types/product';
import { trpc } from '../lib/trpc-client';
import toast from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';

export const useProducts = (filters: ProductFilters = {}) => {
  return trpc.products.list.useQuery({
    search: filters.search,
    status: filters.status as any,
    variant: filters.variant as any,
    pricing_method: filters.pricing_method as any,
    page: filters.page || 1,
    limit: filters.limit || 15,
    sort_by: filters.sort_by || 'created_at',
    sort_order: filters.sort_order || 'desc',
    show_obsolete: filters.show_obsolete || false,
  }, {
    retry: 1,
    staleTime: 30000,
  });
};

export const useProduct = (id: string) => {
  return trpc.products.getById.useQuery(
    { id },
    {
      enabled: Boolean(id),
    }
  );
};

export const useProductStats = () => {
  return trpc.products.getStats.useQuery(undefined, {
    staleTime: 60000,
  });
};

export const useProductOptions = (filters: { 
  status?: ('active' | 'obsolete')[],
  include_variants?: boolean 
} = {}) => {
  return trpc.products.getOptions.useQuery({
    status: filters.status || ['active'],
    include_variants: filters.include_variants ?? true,
  }, {
    staleTime: 300000, // 5 minutes
  });
};

export const useCreateProduct = () => {
  const queryClient = useQueryClient();
  
  return trpc.products.create.useMutation({
    onSuccess: (data: any) => {
      console.log('Product created successfully:', data);
      toast.success('Product created successfully');
      
      // Invalidate and refetch product queries
      queryClient.invalidateQueries(['products.list']);
      queryClient.invalidateQueries(['products.getStats']);
      queryClient.invalidateQueries(['products.getOptions']);
    },
    onError: (error: Error) => {
      console.error('Create product mutation error:', error);
      toast.error(error.message || 'Failed to create product');
    },
  });
};

export const useUpdateProduct = () => {
  const queryClient = useQueryClient();
  
  return trpc.products.update.useMutation({
    onSuccess: (data: any) => {
      console.log('Product updated successfully:', data);
      toast.success('Product updated successfully');
      
      // Invalidate and refetch product queries
      queryClient.invalidateQueries(['products.list']);
      queryClient.invalidateQueries(['products.getStats']);
      queryClient.invalidateQueries(['products.getOptions']);
      if (data.id) {
        queryClient.invalidateQueries(['products.getById', { id: data.id }]);
      }
    },
    onError: (error: Error) => {
      console.error('Update product mutation error:', error);
      toast.error(error.message || 'Failed to update product');
    },
  });
};

export const useDeleteProduct = () => {
  const queryClient = useQueryClient();
  
  return trpc.products.delete.useMutation({
    onSuccess: (_, variables) => {
      console.log('Product deleted successfully:', variables.id);
      toast.success('Product status set to obsolete');
      
      // Invalidate and refetch product queries
      queryClient.invalidateQueries(['products.list']);
      queryClient.invalidateQueries(['products.getStats']);
      queryClient.invalidateQueries(['products.getOptions']);
      queryClient.invalidateQueries(['products.getById', { id: variables.id }]);
    },
    onError: (error: Error) => {
      console.error('Delete product mutation error:', error);
      toast.error(error.message || 'Failed to delete product');
    },
  });
};

export const useProductVariants = (parentProductId: string) => {
  return trpc.products.getVariants.useQuery(
    { parent_product_id: parentProductId },
    {
      enabled: Boolean(parentProductId),
      staleTime: 60000,
    }
  );
};

export const useCreateVariant = () => {
  return trpc.products.createVariant.useMutation({
    onSuccess: (data) => {
      console.log('Product variant created successfully:', data);
      toast.success('Product variant created successfully');
    },
    onError: (error: Error) => {
      console.error('Create variant mutation error:', error);
      toast.error(error.message || 'Failed to create product variant');
    },
  });
};

export const useBulkUpdateProductStatus = () => {
  return trpc.products.bulkUpdateStatus.useMutation({
    onSuccess: (data) => {
      console.log('Bulk product status update successful:', data);
      toast.success(`Updated ${data.updated_count} products successfully`);
    },
    onError: (error: Error) => {
      console.error('Bulk update status mutation error:', error);
      toast.error(error.message || 'Failed to update product status');
    },
  });
};

export const useReactivateProduct = () => {
  return trpc.products.reactivate.useMutation({
    onSuccess: (data) => {
      console.log('Product reactivated successfully:', data);
      toast.success('Product reactivated successfully');
    },
    onError: (error: Error) => {
      console.error('Reactivate product mutation error:', error);
      toast.error(error.message || 'Failed to reactivate product');
    },
  });
};

export const useValidateProduct = () => {
  return trpc.products.validate.useMutation({
    onSuccess: (data) => {
      console.log('Product validated:', data);
      if (data.valid) {
        toast.success('Product data is valid');
      } else {
        toast.warning('Product validation found issues');
      }
    },
    onError: (error: Error) => {
      console.error('Validate product mutation error:', error);
      toast.error(error.message || 'Failed to validate product');
    },
  });
};