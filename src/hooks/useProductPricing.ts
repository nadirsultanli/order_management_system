import { useQuery } from '@tanstack/react-query';
import { trpc } from '../lib/trpc-client';

export const useProductPrice = (productId: string, customerId?: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: ['productPrice', productId, customerId],
    queryFn: async () => {
      if (!productId) return null;
      return await trpc.pricing.getProductPrice.query({ productId, customerId });
    },
    enabled: enabled && !!productId,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
};

export const useProductPrices = (productIds: string[], customerId?: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: ['productPrices', productIds.sort().join(','), customerId],
    queryFn: async () => {
      if (!productIds.length) return {};
      return await trpc.pricing.getProductPrices.query({ productIds, customerId });
    },
    enabled: enabled && productIds.length > 0,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
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