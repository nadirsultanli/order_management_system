import { CreateProductData, UpdateProductData, ProductFilters, CreateVariantData, CreateParentProductData, SkuVariant } from '../types/product';
import { trpc } from '../lib/trpc-client';
import toast from 'react-hot-toast';

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
  // First try to get from products table
  const productQuery = trpc.products.getById.useQuery(
    { id },
    {
      enabled: Boolean(id),
      retry: false, // Don't retry if not found
    }
  );

  // If product not found, try parent_products table
  const parentProductQuery = trpc.products.getParentProductById.useQuery(
    { id },
    {
      enabled: Boolean(id) && productQuery.isError && productQuery.error?.data?.code === 'NOT_FOUND',
      retry: false,
    }
  );

  // Return the successful query result
  if (productQuery.data) {
    return productQuery;
  } else if (parentProductQuery.data) {
    return parentProductQuery;
  } else if (productQuery.isError && parentProductQuery.isError) {
    // Both failed, return the original error
    return productQuery;
  } else if (productQuery.isLoading) {
    return productQuery;
  } else if (parentProductQuery.isLoading) {
    return parentProductQuery;
  } else {
    // Return the parent product query state
    return parentProductQuery;
  }
};

export const useProductStats = () => {
  return trpc.products.getStats.useQuery({}, {
    staleTime: 60000,
  });
};

export const useProductOptions = (filters: { 
  status?: ('active' | 'obsolete')[],
  include_variants?: boolean 
} = {}) => {
  return trpc.products.getOptions.useQuery({
    status: (filters.status || ['active']).join(','),
    include_variants: filters.include_variants ?? true,
  }, {
    staleTime: 300000, // 5 minutes
  });
};

export const useCreateProduct = () => {
  const utils = trpc.useContext();
  
  return trpc.products.create.useMutation({
    onSuccess: (data: any) => {
      console.log('Product created successfully:', data);
      toast.success('Product created successfully');
      
      // Invalidate and refetch product queries using tRPC utils
      utils.products.list.invalidate();
      utils.products.getStats.invalidate();
      utils.products.getOptions.invalidate();
    },
    onError: (error: Error) => {
      console.error('Create product mutation error:', error);
      toast.error(error.message || 'Failed to create product');
    },
  });
};

export const useUpdateProduct = () => {
  const utils = trpc.useContext();
  
  return trpc.products.update.useMutation({
    onSuccess: (data: any) => {
      console.log('Product updated successfully:', data);
      toast.success('Product updated successfully');
      
      // Invalidate and refetch product queries using tRPC utils
      utils.products.list.invalidate();
      utils.products.getStats.invalidate();
      utils.products.getOptions.invalidate();
      if (data.id) {
        utils.products.getById.invalidate({ id: data.id });
      }
    },
    onError: (error: Error) => {
      console.error('Update product mutation error:', error);
      toast.error(error.message || 'Failed to update product');
    },
  });
};

export const useUpdateParentProduct = () => {
  const utils = trpc.useContext();
  
  return trpc.products.updateParentProduct.useMutation({
    onSuccess: (data: any) => {
      console.log('Parent product updated successfully:', data);
      toast.success('Parent product updated successfully');
      
      // Invalidate and refetch product queries using tRPC utils
      utils.products.list.invalidate();
      utils.products.getStats.invalidate();
      utils.products.getOptions.invalidate();
      utils.products.getParentProducts.invalidate();
      if (data.id) {
        utils.products.getById.invalidate({ id: data.id });
      }
    },
    onError: (error: Error) => {
      console.error('Update parent product mutation error:', error);
      toast.error(error.message || 'Failed to update parent product');
    },
  });
};

export const useDeleteProduct = () => {
  const utils = trpc.useContext();
  
  return trpc.products.delete.useMutation({
    onSuccess: (_, variables) => {
      console.log('Product deleted successfully:', variables.id);
      toast.success('Product status set to obsolete');
      
      // Invalidate and refetch product queries using tRPC utils
      utils.products.list.invalidate();
      utils.products.getStats.invalidate();
      utils.products.getOptions.invalidate();
      utils.products.getById.invalidate({ id: variables.id });
    },
    onError: (error: Error) => {
      console.error('Delete product mutation error:', error);
      toast.error(error.message || 'Failed to delete product');
    },
  });
};

export const useProductVariants = (parentProductsId: string) => {
  return trpc.products.getVariants.useQuery(
    { parent_products_id: parentProductsId },
    {
      enabled: Boolean(parentProductsId),
      staleTime: 60000,
    }
  );
};

export const useCreateVariant = () => {
  const utils = trpc.useContext();
  
  return trpc.products.createVariant.useMutation({
    onSuccess: (data) => {
      console.log('Product variant created successfully:', data);
      toast.success('Product variant created successfully');
      
      // Invalidate multiple queries to ensure UI consistency
      utils.products.list.invalidate();
      utils.products.getStats.invalidate();
      utils.products.getOptions.invalidate();
      utils.products.getGroupedProducts.invalidate();
      utils.products.getParentProducts.invalidate();
      if (data.parent_products_id) {
        utils.products.getVariants.invalidate({ parent_products_id: data.parent_products_id });
      }
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

// New hooks for hierarchical product structure
export const useGroupedProducts = (filters: ProductFilters & { search?: string } = {}) => {
  return trpc.products.getGroupedProducts.useQuery({
    search: filters.search,
    status: filters.status as any,
    page: filters.page || 1,
    limit: filters.limit || 10,
    sort_by: filters.sort_by || 'name',
    sort_order: filters.sort_order || 'asc',
  }, {
    retry: 1,
    staleTime: 30000,
  });
};

export const useCreateParentProduct = () => {
  const utils = trpc.useContext();
  
  return trpc.products.createParentProduct.useMutation({
    onSuccess: (data) => {
      console.log('Parent product created successfully:', data);
      toast.success('Parent product created successfully');
      
      // Invalidate relevant queries
      utils.products.list.invalidate();
      utils.products.getStats.invalidate();
      utils.products.getOptions.invalidate();
      utils.products.getGroupedProducts.invalidate();
      utils.products.getParentProducts.invalidate();
    },
    onError: (error: Error) => {
      console.error('Create parent product mutation error:', error);
      toast.error(error.message || 'Failed to create parent product');
    },
  });
};

export const useSkuVariants = () => {
  return trpc.products.getSkuVariants.useQuery({}, {
    staleTime: 300000, // 5 minutes - these don't change often
  });
};

export const useParentProducts = (filters: { 
  search?: string;
  status?: 'active' | 'obsolete';
  page?: number;
  limit?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
} = {}) => {
  return trpc.products.getParentProducts.useQuery({
    search: filters.search,
    status: filters.status,
    page: filters.page || 1,
    limit: filters.limit || 15,
    sort_by: filters.sort_by || 'name',
    sort_order: filters.sort_order || 'asc',
  }, {
    retry: 1,
    staleTime: 30000,
  });
};

export const useParentProduct = (id: string) => {
  return trpc.products.getParentProductById.useQuery(
    { id },
    {
      enabled: Boolean(id),
    }
  );
};