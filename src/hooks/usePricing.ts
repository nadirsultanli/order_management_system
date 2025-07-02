import { trpc } from '../lib/trpc-client';
import toast from 'react-hot-toast';

// Hook for listing price lists
export const usePriceListsNew = (filters: {
  search?: string;
  currency?: string;
  status?: 'active' | 'inactive' | 'future' | 'expired';
  page?: number;
  limit?: number;
} = {}) => {
  return trpc.pricing.listPriceLists.useQuery({
    search: filters.search,
    currency: filters.currency,
    status: filters.status,
    page: filters.page || 1,
    limit: filters.limit || 50,
  }, {
    enabled: true,
    staleTime: 30000,
    retry: 1,
    onError: (error) => {
      console.error('Price lists fetch error:', error);
      toast.error('Failed to load price lists');
    }
  });
};

// Hook for getting a single price list
export const usePriceListNew = (priceListId: string) => {
  return trpc.pricing.getPriceList.useQuery({
    price_list_id: priceListId,
  }, {
    enabled: !!priceListId && priceListId !== 'null' && priceListId !== 'undefined',
    staleTime: 30000,
    retry: 1,
    onError: (error) => {
      console.error('Price list fetch error:', error);
      toast.error('Failed to load price list details');
    }
  });
};

// Hook for calculating dynamic pricing
export const useCalculatePricingNew = () => {
  return trpc.pricing.calculate.useMutation({
    onSuccess: (pricing) => {
      console.log('Pricing calculated successfully:', pricing);
    },
    onError: (error) => {
      console.error('Calculate pricing error:', error);
      toast.error(error.message || 'Failed to calculate pricing');
    },
  });
};

// Hook for creating price lists
export const useCreatePriceListNew = () => {
  const utils = trpc.useContext();
  
  return trpc.pricing.createPriceList.useMutation({
    onSuccess: (newPriceList) => {
      console.log('Price list created successfully:', newPriceList);
      
      // Invalidate price lists to refetch
      utils.pricing.listPriceLists.invalidate();
      utils.pricing.getStats.invalidate();
      
      toast.success('Price list created successfully');
    },
    onError: (error) => {
      console.error('Create price list error:', error);
      toast.error(error.message || 'Failed to create price list');
    },
  });
};

// Hook for updating price lists
export const useUpdatePriceListNew = () => {
  const utils = trpc.useContext();
  
  return trpc.pricing.updatePriceList.useMutation({
    onSuccess: (updatedPriceList) => {
      console.log('Price list updated successfully:', updatedPriceList);
      
      // Invalidate queries to refetch updated data
      utils.pricing.listPriceLists.invalidate();
      utils.pricing.getPriceList.invalidate({ price_list_id: updatedPriceList.id });
      utils.pricing.getStats.invalidate();
      
      toast.success('Price list updated successfully');
    },
    onError: (error) => {
      console.error('Update price list error:', error);
      toast.error(error.message || 'Failed to update price list');
    },
  });
};

// Hook for bulk adding products to price lists
export const useBulkAddProductsNew = () => {
  const utils = trpc.useContext();
  
  return trpc.pricing.bulkAddProducts.useMutation({
    onSuccess: (result, variables) => {
      console.log('Bulk add products completed:', result);
      
      // Invalidate price list items and related queries
      utils.pricing.getPriceListItems.invalidate({ price_list_id: variables.price_list_id });
      utils.pricing.getPriceList.invalidate({ price_list_id: variables.price_list_id });
      
      if (result.errors.length > 0) {
        toast.error(`Added ${result.success_count} products, ${result.errors.length} failed`);
      } else {
        toast.success(`Successfully added ${result.success_count} products`);
      }
    },
    onError: (error) => {
      console.error('Bulk add products error:', error);
      toast.error(error.message || 'Failed to add products to price list');
    },
  });
};

// Hook for bulk updating prices
export const useBulkUpdatePricesNew = () => {
  const utils = trpc.useContext();
  
  return trpc.pricing.bulkUpdatePrices.useMutation({
    onSuccess: (result, variables) => {
      console.log('Bulk update prices completed:', result);
      
      // Invalidate price list items and related queries
      utils.pricing.getPriceListItems.invalidate({ price_list_id: variables.price_list_id });
      utils.pricing.getPriceList.invalidate({ price_list_id: variables.price_list_id });
      
      if (result.errors.length > 0) {
        toast.error(`Updated ${result.success_count} prices, ${result.errors.length} failed`);
      } else {
        toast.success(`Successfully updated ${result.success_count} prices`);
      }
    },
    onError: (error) => {
      console.error('Bulk update prices error:', error);
      toast.error(error.message || 'Failed to update prices');
    },
  });
};

// Hook for validating price lists
export const useValidatePriceListNew = () => {
  return trpc.pricing.validatePriceList.useMutation({
    onSuccess: (validation) => {
      console.log('Price list validation completed:', validation);
      
      if (validation.errors.length > 0) {
        toast.error(`Validation found ${validation.errors.length} issues`);
      } else {
        toast.success('Price list validation passed');
      }
    },
    onError: (error) => {
      console.error('Price list validation error:', error);
      toast.error(error.message || 'Price list validation failed');
    },
  });
};

// Hook for getting pricing statistics
export const usePricingStatsNew = () => {
  return trpc.pricing.getStats.useQuery(undefined, {
    enabled: true,
    staleTime: 60000, // 1 minute for stats
    retry: 1,
    onError: (error) => {
      console.error('Pricing stats fetch error:', error);
      toast.error('Failed to load pricing statistics');
    }
  });
};

// Hook for getting customer pricing tiers
export const useCustomerPricingTiersNew = (customerId: string) => {
  return trpc.pricing.getCustomerPricingTiers.useQuery({
    customer_id: customerId,
  }, {
    enabled: !!customerId && customerId !== 'null' && customerId !== 'undefined',
    staleTime: 60000, // 1 minute for pricing tiers
    retry: 1,
    onError: (error) => {
      console.error('Customer pricing tiers fetch error:', error);
      toast.error('Failed to load customer pricing tiers');
    }
  });
};

// Hook for getting price list items
export const usePriceListItemsNew = (priceListId: string, filters: {
  search?: string;
  page?: number;
  limit?: number;
} = {}) => {
  return trpc.pricing.getPriceListItems.useQuery({
    price_list_id: priceListId,
    search: filters.search,
    page: filters.page || 1,
    limit: filters.limit || 50,
  }, {
    enabled: !!priceListId && priceListId !== 'null' && priceListId !== 'undefined',
    staleTime: 30000,
    retry: 1,
    onError: (error) => {
      console.error('Price list items fetch error:', error);
      toast.error('Failed to load price list items');
    }
  });
};

// Hook for creating price list items
export const useCreatePriceListItemNew = () => {
  const utils = trpc.useContext();
  
  return trpc.pricing.createPriceListItem.useMutation({
    onSuccess: (newItem) => {
      console.log('Price list item created successfully:', newItem);
      
      // Invalidate price list items
      utils.pricing.getPriceListItems.invalidate({ price_list_id: newItem.price_list_id });
      utils.pricing.getPriceList.invalidate({ price_list_id: newItem.price_list_id });
      
      toast.success('Price list item created successfully');
    },
    onError: (error) => {
      console.error('Create price list item error:', error);
      toast.error(error.message || 'Failed to create price list item');
    },
  });
};

// Utility hook to get pricing context
export const usePricingContext = () => {
  return trpc.useContext().pricing;
};