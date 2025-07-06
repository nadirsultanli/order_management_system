import { useState, useCallback, useEffect, useRef } from 'react';
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
import { verifyTransferIntegrity, monitorTransferWorkflow } from '../utils/transfer-verification';
import { trpc } from '../lib/trpc-client';
import toast from 'react-hot-toast';

// Hook for managing multi-SKU transfers using backend tRPC APIs
export const useMultiSkuTransfers = (filters?: TransferFilters) => {
  const [error, setError] = useState<string | null>(null);
  const [transferMonitoring, setTransferMonitoring] = useState<Record<string, any>>({});
  const [realTimeUpdates, setRealTimeUpdates] = useState<boolean>(true);
  const monitoringIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const utils = trpc.useContext();

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
    // Validate UUID format before making the call
    if (!warehouseId || !uuidRegex.test(warehouseId)) {
      console.error('Invalid warehouse ID format:', warehouseId);
      setError('Invalid warehouse ID format');
      return null;
    }
    
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

  // Create transfer with real-time monitoring
  const createTransferMutation = trpc.transfers.create.useMutation({
    onSuccess: async (data) => {
      toast.success('Transfer created successfully');
      
      // Start monitoring the new transfer
      if (data.id && realTimeUpdates) {
        startTransferMonitoring(data.id);
      }
      
      // Comprehensive cache invalidation
      await Promise.all([
        refetch(), // Refresh transfers list
        utils.inventory.list.invalidate(),
        utils.inventory.getByWarehouse.invalidate(),
        utils.inventory.getStats.invalidate(),
        utils.trucks.list.invalidate(),
        utils.trucks.get.invalidate(),
      ]);
    },
    onError: (error) => {
      setError(error.message);
      toast.error('Failed to create transfer');
    }
  });

  // Update transfer status with monitoring
  const updateStatusMutation = trpc.transfers.updateStatus.useMutation({
    onSuccess: async (data) => {
      toast.success('Transfer status updated');
      
      // Update monitoring if this transfer is being tracked
      if (data.id && transferMonitoring[data.id]) {
        await updateTransferMonitoring(data.id);
      }
      
      // Comprehensive cache invalidation
      await Promise.all([
        refetch(), // Refresh transfers list
        utils.inventory.list.invalidate(),
        utils.inventory.getByWarehouse.invalidate(),
        utils.inventory.getStats.invalidate(),
        utils.trucks.list.invalidate(),
        utils.trucks.get.invalidate(),
      ]);
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

  // Transfer monitoring functions
  const startTransferMonitoring = useCallback(async (transferId: string) => {
    try {
      const workflow = await monitorTransferWorkflow(transferId);
      setTransferMonitoring(prev => ({
        ...prev,
        [transferId]: {
          ...workflow,
          lastUpdated: new Date().toISOString(),
          isMonitoring: true
        }
      }));
    } catch (error) {
      console.warn('Failed to start transfer monitoring:', error);
    }
  }, []);

  const updateTransferMonitoring = useCallback(async (transferId: string) => {
    try {
      const workflow = await monitorTransferWorkflow(transferId);
      setTransferMonitoring(prev => ({
        ...prev,
        [transferId]: {
          ...workflow,
          lastUpdated: new Date().toISOString(),
          isMonitoring: true
        }
      }));
    } catch (error) {
      console.warn('Failed to update transfer monitoring:', error);
    }
  }, []);

  const stopTransferMonitoring = useCallback((transferId: string) => {
    setTransferMonitoring(prev => {
      const updated = { ...prev };
      if (updated[transferId]) {
        updated[transferId].isMonitoring = false;
      }
      return updated;
    });
  }, []);

  const verifyTransferIntegrityCallback = useCallback(async (transferId: string) => {
    try {
      const result = await verifyTransferIntegrity(transferId);
      return result;
    } catch (error) {
      console.error('Transfer integrity verification failed:', error);
      throw error;
    }
  }, []);

  // Cleanup monitoring on unmount
  useEffect(() => {
    return () => {
      if (monitoringIntervalRef.current) {
        clearInterval(monitoringIntervalRef.current);
      }
    };
  }, []);

  // Auto-refresh monitoring data for active transfers
  useEffect(() => {
    if (!realTimeUpdates) return;

    const activeTransfers = Object.keys(transferMonitoring).filter(
      id => transferMonitoring[id]?.isMonitoring
    );

    if (activeTransfers.length > 0) {
      monitoringIntervalRef.current = setInterval(() => {
        activeTransfers.forEach(transferId => {
          updateTransferMonitoring(transferId);
        });
      }, 30000); // Update every 30 seconds
    }

    return () => {
      if (monitoringIntervalRef.current) {
        clearInterval(monitoringIntervalRef.current);
      }
    };
  }, [transferMonitoring, realTimeUpdates, updateTransferMonitoring]);

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
    
    // Real-time monitoring
    transferMonitoring,
    realTimeUpdates,
    setRealTimeUpdates,
    startTransferMonitoring,
    stopTransferMonitoring,
    updateTransferMonitoring,
    verifyTransferIntegrity: verifyTransferIntegrityCallback,
    
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
    enabled: Boolean(warehouseId),
    retry: 1,
    staleTime: 60000,
  });

  return {
    products: productsData?.products || [],
    isLoading,
    refetch,
  };
};

// UUID validation regex
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Hook for warehouse stock information
export const useWarehouseStock = (warehouseId?: string) => {
  // Only enable the query if warehouseId is a valid UUID
  const isValidUuid = warehouseId && uuidRegex.test(warehouseId);
  
  const { data: stockData, isLoading, refetch } = trpc.transfers.getWarehouseStock.useQuery({
    warehouse_id: warehouseId!,
  }, {
    enabled: Boolean(isValidUuid),
    retry: 1,
    staleTime: 60000,
  });

  return {
    stockInfo: stockData || [],
    isLoading,
    refetch: () => refetch(),
    fetchStockInfo: refetch,
  };
};

// Missing hook that MultiSkuTransferForm expects - implementing form state management
export const useTransferForm = () => {
  const [selectedItems, setSelectedItems] = useState<any[]>([]);
  const [warehouseStockData, setWarehouseStockData] = useState<any[]>([]);
  const [validationResult, setValidationResult] = useState<any>({ is_valid: true, errors: [], warnings: [] });
  const [transferSummary, setTransferSummary] = useState<any>(null);

  const addItem = useCallback((product: any, quantity: number, stockInfo: any) => {
    const newItem = {
      product_id: product.id,
      product_sku: product.sku,
      product_name: product.name,
      variant_name: product.variant_name,
      quantity_to_transfer: quantity,
      unit_weight_kg: product.weight_kg || 0,
      total_weight_kg: (product.weight_kg || 0) * quantity,
      unit_cost: stockInfo.unit_cost || 0,
      total_cost: (stockInfo.unit_cost || 0) * quantity,
      available_stock: stockInfo.available_quantity || 0,
    };

    setSelectedItems(prev => {
      const existingIndex = prev.findIndex(item => 
        item.product_id === product.id && item.variant_name === product.variant_name
      );
      
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = { ...updated[existingIndex], quantity_to_transfer: quantity };
        return updated;
      } else {
        return [...prev, newItem];
      }
    });
  }, []);

  const removeItem = useCallback((productId: string, variantName?: string) => {
    setSelectedItems(prev => prev.filter(item => 
      !(item.product_id === productId && item.variant_name === variantName)
    ));
  }, []);

  const validateTransfer = useCallback((sourceWarehouseId: string, destWarehouseId: string, transferDate: string) => {
    // Basic validation - in a real implementation this would call the backend
    const errors = [];
    const warnings = [];

    if (!sourceWarehouseId || !destWarehouseId) {
      errors.push('Source and destination warehouses are required');
    }

    if (sourceWarehouseId === destWarehouseId) {
      errors.push('Source and destination warehouses must be different');
    }

    if (selectedItems.length === 0) {
      errors.push('At least one item must be selected for transfer');
    }

    // Check stock availability
    selectedItems.forEach(item => {
      if (item.quantity_to_transfer > item.available_stock) {
        errors.push(`Insufficient stock for ${item.product_name}: requested ${item.quantity_to_transfer}, available ${item.available_stock}`);
      }
    });

    const result = {
      is_valid: errors.length === 0,
      errors,
      warnings
    };

    setValidationResult(result);
    
    // Generate summary if valid
    if (result.is_valid) {
      const summary = {
        total_items: selectedItems.length,
        total_quantity: selectedItems.reduce((sum, item) => sum + item.quantity_to_transfer, 0),
        total_weight: selectedItems.reduce((sum, item) => sum + item.total_weight_kg, 0),
        total_cost: selectedItems.reduce((sum, item) => sum + item.total_cost, 0),
      };
      setTransferSummary(summary);
    }

    return result;
  }, [selectedItems]);

  return {
    selectedItems,
    validationResult,
    transferSummary,
    warehouseStockData,
    setWarehouseStockData,
    addItem,
    removeItem,
    validateTransfer,
  };
};