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
    { 
      productIds, 
      customerId,
      date: new Date().toISOString().split('T')[0] // Add current date explicitly
    },
    {
      enabled: !!(enabled && productIds.length > 0),
      staleTime: 10 * 60 * 1000, // Cache for 10 minutes (longer cache)
      cacheTime: 20 * 60 * 1000, // Keep in cache for 20 minutes
      retry: 2, // Fewer retries for faster response
      retryDelay: 1000, // Faster retry delay
      refetchOnWindowFocus: false, // Don't refetch when user switches tabs
      onError: (error: any) => {
        console.error('useProductPrices: Query failed:', error);
      },
      onSuccess: (data: any) => {
        console.log('useProductPrices: Query succeeded with data:', {
          dataKeys: Object.keys(data || {}),
          sampleData: data ? Object.entries(data).slice(0, 2) : [],
          totalProductsRequested: productIds.length,
          totalProductsWithPricing: data ? Object.keys(data).filter(key => data[key] !== null).length : 0,
          productsWithInheritance: data ? Object.keys(data).filter(key => data[key]?.inheritedFromParent).length : 0
        });
        
        // Enhanced debugging: Log each product's pricing details
        if (data) {
          Object.entries(data).forEach(([productId, pricing]) => {
            console.log(`🔍 Product ${productId} pricing:`, {
              hasPrice: !!pricing,
              finalPrice: pricing?.finalPrice,
              unitPrice: pricing?.unitPrice,
              inheritedFromParent: pricing?.inheritedFromParent,
              parentProductId: pricing?.parentProductId,
              priceListName: pricing?.priceListName,
              fullData: pricing
            });
          });
        }
      }
    }
  );
};

// New hook that uses the working inheritance logic from getProductPriceListItems
export const useProductPricesWithInheritance = (productIds: string[], customerId?: string, enabled: boolean = true) => {
  // Use the regular getProductPrices endpoint which has inheritance logic built-in
  return trpc.pricing.getProductPrices.useQuery(
    { 
      productIds, 
      customerId,
      date: new Date().toISOString().split('T')[0] // Add current date explicitly
    },
    {
      enabled: !!(enabled && productIds.length > 0),
      staleTime: 5 * 60 * 1000, // Cache for 5 minutes
      retry: 3, // Retry failed requests
      retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
      onError: (error: any) => {
        console.error('useProductPricesWithInheritance: Query failed:', error);
      },
      onSuccess: (data: any) => {
        console.log('useProductPricesWithInheritance: Query succeeded with data:', {
          dataKeys: Object.keys(data || {}),
          sampleData: data ? Object.entries(data).slice(0, 2) : [],
          totalProductsRequested: productIds.length,
          totalProductsWithPricing: data ? Object.keys(data).filter(key => data[key] !== null).length : 0,
          productsWithInheritance: data ? Object.keys(data).filter(key => data[key]?.inheritedFromParent).length : 0
        });
        
        // Enhanced debugging: Log each product's pricing details
        if (data) {
          Object.entries(data).forEach(([productId, pricing]) => {
            console.log(`🔍 Product ${productId} pricing:`, {
              hasPrice: !!pricing,
              finalPrice: pricing?.finalPrice,
              unitPrice: pricing?.unitPrice,
              inheritedFromParent: pricing?.inheritedFromParent,
              parentProductId: pricing?.parentProductId,
              priceListName: pricing?.priceListName,
              taxRate: pricing?.taxRate,
              taxAmount: pricing?.taxAmount,
              fullData: pricing
            });
          });
        }
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