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

// Optimized batch loading with progressive results
export const useProductPrices = (productIds: string[], customerId?: string, enabled: boolean = true) => {
  return trpc.pricing.getProductPrices.useQuery(
    { 
      productIds, 
      customerId,
      date: new Date().toISOString().split('T')[0] // Add current date explicitly
    },
    {
      enabled: !!(enabled && productIds.length > 0),
      staleTime: 30 * 1000, // Reduce cache time to 30 seconds for faster updates
      cacheTime: 2 * 60 * 1000, // Keep in cache for 2 minutes
      retry: 1, // Reduce retries for faster response
      retryDelay: (attemptIndex: number) => Math.min(200 * 2 ** attemptIndex, 1000), // Much faster retries
      refetchOnWindowFocus: false, // Don't refetch on window focus
      refetchOnMount: true, // Always fetch fresh data
      onError: (error: any) => {
        console.error('useProductPrices: Query failed:', error);
      },
      onSuccess: (data: any) => {
        console.log('🚀 useProductPrices: All pricing loaded instantly!', {
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
              finalPrice: (pricing as any)?.finalPrice,
              unitPrice: (pricing as any)?.unitPrice,
              inheritedFromParent: (pricing as any)?.inheritedFromParent,
              parentProductId: (pricing as any)?.parentProductId,
              priceListName: (pricing as any)?.priceListName,
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
  // Use the getProductPriceListItems endpoint for each product to get inherited pricing
  const queries = productIds.map(productId => 
    trpc.pricing.getProductPriceListItems.useQuery(
      { productId },
      {
        enabled: !!(enabled && !!productId),
        staleTime: 5 * 60 * 1000, // Cache for 5 minutes
        retry: 3,
        retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000),
      }
    )
  );

  // Check if any query is loading
  const isLoading = queries.some(query => query.isLoading);
  
  // Check if any query has an error
  const error = queries.find(query => query.error)?.error;
  
  // Transform the data to match the format expected by the order creation page
  const transformedData: { [key: string]: any } = {};
  
  queries.forEach((query, index) => {
    const productId = productIds[index];
    if (query.data && query.data.length > 0) {
      // Find the best price list item (prioritize default > active)
      let bestItem = query.data[0];
      
      // Look for default price list first
      const defaultItem = query.data.find((item: any) => item.price_list?.is_default);
      if (defaultItem) {
        bestItem = defaultItem;
      }
      
      // Calculate the effective price
      let finalPrice = 0;
      let unitPrice = 0;
      
      if (bestItem.pricing_method === 'per_unit' && bestItem.unit_price) {
        unitPrice = bestItem.unit_price;
        finalPrice = bestItem.effective_price || bestItem.unit_price;
      } else if (bestItem.pricing_method === 'per_kg' && bestItem.price_per_kg) {
        unitPrice = bestItem.price_per_kg;
        finalPrice = bestItem.effective_price || bestItem.price_per_kg;
      }
      
      transformedData[productId] = {
        unitPrice,
        surchargePercent: bestItem.surcharge_pct || 0,
        finalPrice,
        priceListId: bestItem.price_list_id,
        priceListName: bestItem.price_list?.name || 'Unknown',
        priceExcludingTax: bestItem.price_excluding_tax || unitPrice,
        taxAmount: bestItem.tax_amount || 0,
        priceIncludingTax: bestItem.price_including_tax || finalPrice,
        taxRate: bestItem.tax_rate || 0,
        taxCategory: bestItem.tax_category || 'standard',
        inheritedFromParent: bestItem.inherited_from_parent || false,
        parentProductId: bestItem.parent_product_id || null,
      };
    } else {
      // No pricing found for this product
      transformedData[productId] = null;
    }
  });

  return {
    data: transformedData,
    isLoading,
    error,
  };
};

export const useActivePriceLists = (date?: string) => {
  return trpc.pricing.getActivePriceLists.useQuery(
    { date },
    {
      staleTime: 10 * 60 * 1000, // Cache for 10 minutes
    }
  );
};