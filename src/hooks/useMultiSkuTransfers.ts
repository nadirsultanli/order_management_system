import { useState, useCallback } from 'react';
import { 
  MultiSkuTransfer, 
  MultiSkuTransferItem, 
  WarehouseStockInfo, 
  TransferValidationResult,
  TransferFilters,
  ProductSelectionFilters,
  CreateMultiSkuTransferRequest,
  TransferSummary
} from '../types/transfer';
import { Product } from '../types/product';
import { 
  validateMultiSkuTransfer,
  calculateTransferItemDetails,
  generateTransferSummary,
  validateWarehouseCapacity,
  checkTransferConflicts,
  generateTransferReference
} from '../utils/transfer-validation';
import { trpc } from '../lib/trpc-client';
import toast from 'react-hot-toast';

// Hook for managing multi-SKU transfers using backend tRPC APIs
export const useMultiSkuTransfers = (filters?: TransferFilters) => {
  const [error, setError] = useState<string | null>(null);

  // Use tRPC query for fetching transfers
  const { data: transfersData, isLoading: loading, refetch } = trpc.transfers.list.useQuery({
    source_warehouse_id: filters?.source_warehouse_id,
    destination_warehouse_id: filters?.destination_warehouse_id,
    status: filters?.status,
    transfer_type: filters?.transfer_type,
    date_from: filters?.date_from,
    date_to: filters?.date_to,
    created_by_user_id: filters?.created_by_user_id,
    search_text: filters?.search_text,
    page: filters?.page || 1,
    limit: filters?.limit || 20,
    sort_by: filters?.sort_by || 'created_at',
    sort_order: filters?.sort_order || 'desc',
  }, {
    retry: 1,
    staleTime: 30000,
    onError: (error) => {
      setError(error.message);
      toast.error('Failed to fetch transfers');
    }
  });

  const transfers = transfersData?.transfers || [];
  const totalCount = transfersData?.totalCount || 0;

  // Warehouse stock query
  const fetchWarehouseStock = useCallback(async (warehouseId: string) => {
    try {
      const stockData = await trpc.transfers.getWarehouseStock.query({ warehouse_id: warehouseId });
      return stockData;
    } catch (error) {
      console.error('Error fetching warehouse stock:', error);
      setError('Failed to fetch warehouse stock');
      return null;
    }
  }, []);

  // Product search
  const { data: products, isLoading: productsLoading } = trpc.transfers.searchProducts.useQuery({
    search: '', // This would be controlled by component state
    warehouse_id: filters?.source_warehouse_id,
    include_variants: true,
    limit: 50,
  }, {
    enabled: false, // Enable when search is triggered
  });

  // Transfer validation
  const validateTransferMutation = trpc.transfers.validate.useMutation({
    onError: (error) => {
      setError(error.message);
      toast.error('Transfer validation failed');
    }
  });

  // Create transfer
  const createTransferMutation = trpc.transfers.create.useMutation({
    onSuccess: () => {
      toast.success('Transfer created successfully');
      refetch(); // Refresh transfers list
    },
    onError: (error) => {
      setError(error.message);
      toast.error('Failed to create transfer');
    }
  });

  // Update transfer status
  const updateStatusMutation = trpc.transfers.updateStatus.useMutation({
    onSuccess: () => {
      toast.success('Transfer status updated');
      refetch(); // Refresh transfers list
    },
    onError: (error) => {
      setError(error.message);
      toast.error('Failed to update transfer status');
    }
  });

  const validateTransfer = useCallback(async (transferData: CreateMultiSkuTransferRequest): Promise<TransferValidationResult> => {
    try {
      setError(null);
      const result = await validateTransferMutation.mutateAsync(transferData);
      return result;
    } catch (error) {
      console.error('Transfer validation error:', error);
      return {
        isValid: false,
        errors: [(error as Error).message || 'Validation failed'],
        warnings: []
      };
    }
  }, [validateTransferMutation]);

  const createTransfer = useCallback(async (transferData: CreateMultiSkuTransferRequest): Promise<MultiSkuTransfer | null> => {
    try {
      setError(null);
      const result = await createTransferMutation.mutateAsync(transferData);
      return result;
    } catch (error) {
      console.error('Create transfer error:', error);
      return null;
    }
  }, [createTransferMutation]);

  const updateTransferStatus = useCallback(async (transferId: string, status: string, notes?: string) => {
    try {
      setError(null);
      await updateStatusMutation.mutateAsync({
        transfer_id: transferId,
        status: status as any,
        notes,
      });
    } catch (error) {
      console.error('Update transfer status error:', error);
    }
  }, [updateStatusMutation]);

  // Cost analysis
  const { data: costAnalysis } = trpc.transfers.getCostAnalysis.useQuery({
    transfer_id: '', // This would be set dynamically
  }, {
    enabled: false, // Enable when needed
  });

  return {
    transfers,
    totalCount,
    loading,
    error,
    products: products?.products || [],
    productsLoading,
    fetchTransfers: refetch,
    fetchWarehouseStock,
    validateTransfer,
    createTransfer,
    updateTransferStatus,
    costAnalysis,
    
    // Mutation states for UI feedback
    isValidating: validateTransferMutation.isLoading,
    isCreating: createTransferMutation.isLoading,
    isUpdating: updateStatusMutation.isLoading,
  };
};

// Utility hook for product selection
export const useProductSelection = (warehouseId?: string) => {
  const { data: productsData, isLoading, refetch } = trpc.transfers.searchProducts.useQuery({
    search: '',
    warehouse_id: warehouseId,
    include_variants: true,
    limit: 100,
  }, {
    enabled: !!warehouseId,
    retry: 1,
    staleTime: 60000,
  });

  return {
    products: productsData?.products || [],
    isLoading,
    refetch,
  };
};

// Hook for warehouse stock information
export const useWarehouseStock = (warehouseId?: string) => {
  const { data: stockData, isLoading, refetch } = trpc.transfers.getWarehouseStock.useQuery({
    warehouse_id: warehouseId || '',
  }, {
    enabled: !!warehouseId,
    retry: 1,
    staleTime: 30000,
  });

  return {
    stockInfo: stockData || [],
    isLoading,
    refetch,
  };
};