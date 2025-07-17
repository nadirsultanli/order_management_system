import { useQuery } from '@tanstack/react-query';
import { trpc } from '../lib/trpc-client';

interface OrderLinePricingParams {
  product_id: string;
  quantity: number;
  fill_percentage: number;
  customer_id?: string;
  date?: string;
}

interface OrderLinePricingResult {
  unit_price: number;
  subtotal: number;
  gas_charge: number;
  deposit_amount: number;
  tax_amount: number;
  total_price: number;
  adjusted_weight: number;
  original_weight: number;
  pricing_method: string;
  inherited_from_parent?: boolean;
  parent_product_id?: string | null;
}

export const useOrderLinePricing = (params: OrderLinePricingParams) => {
  return useQuery({
    queryKey: ['orderLinePricing', params],
    queryFn: async (): Promise<OrderLinePricingResult | null> => {
      const result = await trpc.pricing.calculateOrderLinePricing.query(params);
      return result;
    },
    enabled: !!params.product_id && params.quantity > 0 && params.fill_percentage > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
  });
};

export const useOrderLinePricingBatch = (paramsList: OrderLinePricingParams[]) => {
  return useQuery({
    queryKey: ['orderLinePricingBatch', paramsList],
    queryFn: async (): Promise<Map<string, OrderLinePricingResult | null>> => {
      const results = new Map<string, OrderLinePricingResult | null>();
      
      // Execute all pricing calculations in parallel
      const promises = paramsList.map(async (params) => {
        const result = await trpc.pricing.calculateOrderLinePricing.query(params);
        return { productId: params.product_id, result };
      });
      
      const resolvedResults = await Promise.all(promises);
      
      resolvedResults.forEach(({ productId, result }) => {
        results.set(productId, result);
      });
      
      return results;
    },
    enabled: paramsList.length > 0 && paramsList.every(params => 
      !!params.product_id && params.quantity > 0 && params.fill_percentage > 0
    ),
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
  });
}; 