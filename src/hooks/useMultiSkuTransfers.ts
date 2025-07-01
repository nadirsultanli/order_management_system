import { useState, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
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

// Hook for managing multi-SKU transfers
export const useMultiSkuTransfers = (filters?: TransferFilters) => {
  const [transfers, setTransfers] = useState<MultiSkuTransfer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTransfers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('multi_sku_transfers')
        .select(`
          *,
          source_warehouse:source_warehouse_id(name),
          destination_warehouse:destination_warehouse_id(name),
          items:multi_sku_transfer_items(*)
        `)
        .order('created_at', { ascending: false });

      // Apply filters
      if (filters?.source_warehouse_id) {
        query = query.eq('source_warehouse_id', filters.source_warehouse_id);
      }
      if (filters?.destination_warehouse_id) {
        query = query.eq('destination_warehouse_id', filters.destination_warehouse_id);
      }
      if (filters?.status) {
        query = query.in('status', filters.status);
      }
      if (filters?.date_from) {
        query = query.gte('transfer_date', filters.date_from);
      }
      if (filters?.date_to) {
        query = query.lte('transfer_date', filters.date_to);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      setTransfers(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch transfers');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const createTransfer = useCallback(async (transferData: CreateMultiSkuTransferRequest) => {
    try {
      setLoading(true);
      setError(null);

      // Start a transaction for creating transfer and items
      const { data: transfer, error: transferError } = await supabase
        .from('multi_sku_transfers')
        .insert([{
          source_warehouse_id: transferData.source_warehouse_id,
          destination_warehouse_id: transferData.destination_warehouse_id,
          transfer_date: transferData.transfer_date,
          status: 'draft',
          transfer_type: 'internal',
          priority: transferData.priority || 'normal',
          transfer_reference: transferData.transfer_reference,
          reason: transferData.reason,
          notes: transferData.notes,
          total_items: transferData.items.length,
          total_quantity: transferData.items.reduce((sum, item) => sum + item.quantity_to_transfer, 0),
          created_by_user_id: 'current-user-id' // TODO: Get from auth context
        }])
        .select()
        .single();

      if (transferError) throw transferError;

      // Create transfer items
      const transferItems = transferData.items.map(item => ({
        transfer_id: transfer.id,
        product_id: item.product_id,
        product_sku: item.product_sku,
        product_name: item.product_name,
        variant_name: item.variant_name,
        quantity_to_transfer: item.quantity_to_transfer,
        unit_weight_kg: item.unit_weight_kg,
        total_weight_kg: item.total_weight_kg,
        unit_cost: item.unit_cost,
        total_cost: item.total_cost
      }));

      const { error: itemsError } = await supabase
        .from('multi_sku_transfer_items')
        .insert(transferItems);

      if (itemsError) throw itemsError;

      // Refresh transfers list
      await fetchTransfers();

      return transfer;
    } catch (err: any) {
      setError(err.message || 'Failed to create transfer');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchTransfers]);

  const updateTransferStatus = useCallback(async (
    transferId: string, 
    newStatus: MultiSkuTransfer['status'], 
    notes?: string
  ) => {
    try {
      setLoading(true);
      setError(null);

      const updateData: any = {
        status: newStatus,
        updated_at: new Date().toISOString()
      };

      if (newStatus === 'completed') {
        updateData.completed_date = new Date().toISOString();
        updateData.processed_by_user_id = 'current-user-id'; // TODO: Get from auth
      }

      const { error } = await supabase
        .from('multi_sku_transfers')
        .update(updateData)
        .eq('id', transferId);

      if (error) throw error;

      // Create history record
      await supabase
        .from('transfer_history')
        .insert([{
          transfer_id: transferId,
          action: 'updated',
          action_date: new Date().toISOString(),
          action_by_user_id: 'current-user-id',
          notes,
          new_status: newStatus
        }]);

      await fetchTransfers();
    } catch (err: any) {
      setError(err.message || 'Failed to update transfer status');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchTransfers]);

  return {
    transfers,
    loading,
    error,
    fetchTransfers,
    createTransfer,
    updateTransferStatus
  };
};

// Hook for warehouse stock information
export const useWarehouseStock = (warehouseId?: string) => {
  const [stockInfo, setStockInfo] = useState<WarehouseStockInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStockInfo = useCallback(async (filters?: ProductSelectionFilters) => {
    if (!warehouseId && !filters?.warehouse_id) return;

    try {
      setLoading(true);
      setError(null);

      const targetWarehouseId = filters?.warehouse_id || warehouseId;

      let query = supabase
        .from('inventory_balance')
        .select(`
          *,
          warehouse:warehouse_id(id, name),
          product:product_id(
            id,
            sku,
            name,
            variant_name,
            variant_type,
            capacity_kg,
            tare_weight_kg,
            is_variant
          )
        `)
        .eq('warehouse_id', targetWarehouseId);

      // Apply filters
      if (filters?.has_stock) {
        query = query.gt('qty_full', 0);
      }
      if (filters?.search_text) {
        // This would need a more sophisticated search
        // For now, we'll fetch all and filter in memory
      }

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;

      // Transform data to WarehouseStockInfo format
      const stockData: WarehouseStockInfo[] = (data || []).map((item: any) => ({
        warehouse_id: item.warehouse_id,
        warehouse_name: item.warehouse.name,
        product_id: item.product_id,
        product_sku: item.product.sku,
        product_name: item.product.name,
        variant_name: item.product.variant_name,
        qty_available: item.qty_full + item.qty_empty,
        qty_reserved: item.qty_reserved,
        qty_on_order: 0, // TODO: Calculate from pending orders
        qty_full: item.qty_full,
        qty_empty: item.qty_empty,
        locations: [], // TODO: Fetch location details
        last_updated: item.updated_at,
        reorder_level: 10, // TODO: Get from product settings
        max_capacity: 1000 // TODO: Get from warehouse settings
      }));

      // Apply search filter
      if (filters?.search_text) {
        const searchLower = filters.search_text.toLowerCase();
        const filtered = stockData.filter(item =>
          item.product_name.toLowerCase().includes(searchLower) ||
          item.product_sku.toLowerCase().includes(searchLower)
        );
        setStockInfo(filtered);
      } else {
        setStockInfo(stockData);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch stock information');
    } finally {
      setLoading(false);
    }
  }, [warehouseId]);

  return {
    stockInfo,
    loading,
    error,
    fetchStockInfo
  };
};

// Hook for transfer form management
export const useTransferForm = () => {
  const [selectedItems, setSelectedItems] = useState<MultiSkuTransferItem[]>([]);
  const [validationResult, setValidationResult] = useState<TransferValidationResult | null>(null);
  const [warehouseStockData, setWarehouseStockData] = useState<WarehouseStockInfo[]>([]);

  const addItem = useCallback((product: Product, quantity: number, stockInfo: WarehouseStockInfo) => {
    const existingIndex = selectedItems.findIndex(
      item => item.product_id === product.id && item.variant_name === product.variant_name
    );

    const newItem: MultiSkuTransferItem = {
      product_id: product.id,
      product_sku: product.sku,
      product_name: product.name,
      variant_name: product.variant_name,
      variant_type: product.variant_type,
      quantity_to_transfer: quantity,
      available_stock: stockInfo.qty_available,
      reserved_stock: stockInfo.qty_reserved,
      is_valid: true,
      validation_errors: [],
      validation_warnings: []
    };

    // Calculate weights and costs
    const itemWithDetails = calculateTransferItemDetails(newItem, product);

    if (existingIndex >= 0) {
      // Update existing item
      const updated = [...selectedItems];
      updated[existingIndex] = itemWithDetails;
      setSelectedItems(updated);
    } else {
      // Add new item
      setSelectedItems(prev => [...prev, itemWithDetails]);
    }
  }, [selectedItems]);

  const removeItem = useCallback((productId: string, variantName?: string) => {
    setSelectedItems(prev => 
      prev.filter(item => 
        !(item.product_id === productId && item.variant_name === variantName)
      )
    );
  }, []);

  const updateItemQuantity = useCallback((productId: string, variantName: string | undefined, quantity: number) => {
    setSelectedItems(prev => 
      prev.map(item => {
        if (item.product_id === productId && item.variant_name === variantName) {
          const updated = { ...item, quantity_to_transfer: quantity };
          // Recalculate totals
          updated.total_weight_kg = (updated.unit_weight_kg || 0) * quantity;
          updated.total_cost = (updated.unit_cost || 0) * quantity;
          return updated;
        }
        return item;
      })
    );
  }, []);

  const clearItems = useCallback(() => {
    setSelectedItems([]);
    setValidationResult(null);
  }, []);

  // Validate transfer whenever items change
  const validateTransfer = useCallback((
    sourceWarehouseId: string,
    destinationWarehouseId: string,
    transferDate: string
  ) => {
    if (selectedItems.length === 0) {
      setValidationResult(null);
      return;
    }

    const transfer: Partial<MultiSkuTransfer> = {
      source_warehouse_id: sourceWarehouseId,
      destination_warehouse_id: destinationWarehouseId,
      transfer_date: transferDate,
      items: selectedItems
    };

    const result = validateMultiSkuTransfer(transfer, warehouseStockData);
    setValidationResult(result);

    // Update item validation status
    setSelectedItems(prev => 
      prev.map(item => {
        const isBlocked = result.blocked_items.includes(item.product_id);
        return {
          ...item,
          is_valid: !isBlocked,
          validation_errors: isBlocked ? ['Item validation failed'] : [],
          validation_warnings: []
        };
      })
    );
  }, [selectedItems, warehouseStockData]);

  // Calculate summary
  const transferSummary = useMemo(() => {
    if (selectedItems.length === 0) return null;
    return generateTransferSummary(selectedItems);
  }, [selectedItems]);

  return {
    selectedItems,
    validationResult,
    transferSummary,
    warehouseStockData,
    setWarehouseStockData,
    addItem,
    removeItem,
    updateItemQuantity,
    clearItems,
    validateTransfer
  };
};

// Hook for product selection
export const useProductSelection = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchProducts = useCallback(async (filters: ProductSelectionFilters) => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('products')
        .select('*')
        .eq('status', 'active')
        .order('name');

      // Apply filters
      if (filters.variant_type) {
        query = query.eq('variant_type', filters.variant_type);
      }
      if (filters.variant_name) {
        query = query.eq('variant_name', filters.variant_name);
      }

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;

      // Apply search filter
      let filteredProducts = data || [];
      if (filters.search_text) {
        const searchLower = filters.search_text.toLowerCase();
        filteredProducts = filteredProducts.filter(product =>
          product.name.toLowerCase().includes(searchLower) ||
          product.sku.toLowerCase().includes(searchLower)
        );
      }

      setProducts(filteredProducts);
    } catch (err: any) {
      setError(err.message || 'Failed to search products');
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    products,
    loading,
    error,
    searchProducts
  };
}; 