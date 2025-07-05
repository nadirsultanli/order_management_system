import { trpc } from '../lib/trpc-client';

export const useProductPrice = (productId: string, customerId?: string, enabled: boolean = true) => {
  return trpc.pricing.getProductPrice.useQuery(
    { productId, customerId },
    {
      enabled: !!(enabled && !!productId),
      staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    }
  );
};

export const useProductPrices = (productIds: string[], customerId?: string, enabled: boolean = true) => {
  return trpc.pricing.getProductPrices.useQuery(
    { productIds, customerId },
    {
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
    }
  );
};

export const useActivePriceLists = (date?: string) => {
  return trpc.pricing.getActivePriceLists.useQuery(
    { date },
    {
      staleTime: 10 * 60 * 1000, // Cache for 10 minutes
    }
  );
};