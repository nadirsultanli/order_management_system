import { useQuery } from '@tanstack/react-query';
import { trpc } from '../lib/trpc-client';

export const useProductPrice = (productId: string, customerId?: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: ['productPrice', productId, customerId],
    queryFn: async () => {
      if (!productId) return null;
      return await trpc.pricing.getProductPrice.query({ productId, customerId });
    },
    enabled: !!(enabled && !!productId),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
};

export const useProductPrices = (productIds: string[], customerId?: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: ['productPrices', productIds.sort().join(','), customerId],
    queryFn: async () => {
      if (!productIds.length) return {};
      
      console.log('useProductPrices: Fetching prices for products:', {
        productIds: productIds.slice(0, 3), // Log first 3 to avoid spam
        customerId,
        productCount: productIds.length
      });
      
      try {
        const result = await trpc.pricing.getProductPrices.query({ productIds, customerId });
        console.log('useProductPrices: Success:', {
          resultKeys: Object.keys(result || {}),
          hasResults: !!(result && Object.keys(result).length > 0)
        });
        return result;
      } catch (error) {
        console.error('useProductPrices: Error fetching product prices:', {
          error,
          productIds: productIds.slice(0, 3),
          customerId
        });
        throw error;
      }
    },
    enabled: !!(enabled && productIds.length > 0),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: 3, // Retry failed requests
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
    onError: (error) => {
      console.error('useProductPrices: Query failed:', error);
    },
    onSuccess: (data) => {
      console.log('useProductPrices: Query succeeded with data:', {
        dataKeys: Object.keys(data || {}),
        sampleData: data ? Object.entries(data).slice(0, 2) : []
      });
    }
  });
};

export const useActivePriceLists = (date?: string) => {
  return useQuery({
    queryKey: ['activePriceLists', date],
    queryFn: async () => {
      return await trpc.pricing.getActivePriceLists.query({ date });
    },
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes
  });
};