import { useMemo } from 'react';
import { useInventoryNew } from './useInventory';
import { InventoryFilters } from '../types/inventory';

export const useInventoryWithClientSearch = (filters: InventoryFilters) => {
  // Fetch data without search parameter to avoid backend issues
  const backendFilters = {
    warehouse_id: filters.warehouse_id,
    page: 1, // Get all results for client-side filtering
    limit: 1000, // Large limit to get all data
  };

  const { data, isLoading, error, refetch } = useInventoryNew(backendFilters);

  // Apply client-side filtering
  const filteredData = useMemo(() => {
    if (!data?.inventory) {
      return data;
    }

    let filteredInventory = [...data.inventory];

    // Apply search filter on the frontend
    if (filters.search && filters.search.trim()) {
      const searchTerm = filters.search.toLowerCase().trim();
      filteredInventory = filteredInventory.filter((item: any) => {
        // Search in product SKU
        const sku = item.product?.sku?.toLowerCase() || '';
        
        // Search in product name
        const productName = item.product?.name?.toLowerCase() || '';
        
        // Search in warehouse name
        const warehouseName = item.warehouse?.name?.toLowerCase() || '';

        return (
          sku.includes(searchTerm) ||
          productName.includes(searchTerm) ||
          warehouseName.includes(searchTerm)
        );
      });
    }

    // Apply pagination on filtered results
    const page = filters.page || 1;
    const limit = filters.limit || 15;
    const totalFiltered = filteredInventory.length;
    const totalPages = Math.ceil(totalFiltered / limit);
    const from = (page - 1) * limit;
    const to = from + limit;
    
    const paginatedInventory = filteredInventory.slice(from, to);

    return {
      inventory: paginatedInventory,
      totalCount: totalFiltered,
      totalPages,
      currentPage: page,
      summary: data.summary, // Keep original summary
    };
  }, [data, filters.search, filters.page, filters.limit]);

  return {
    data: filteredData,
    isLoading,
    error,
    refetch,
  };
}; 