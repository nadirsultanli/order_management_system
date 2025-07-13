import { trpc } from '../lib/trpc-client';
import toast from 'react-hot-toast';

// Hook for listing inventory (without search to avoid backend issues)
export const useInventoryNew = (filters: {
  warehouse_id?: string;
  product_id?: string;
  page?: number;
  limit?: number;
} = {}) => {
  return trpc.inventory.list.useQuery({
    warehouse_id: filters.warehouse_id,
    product_id: filters.product_id,
    page: filters.page || 1,
    limit: filters.limit || 15,
  }, {
    enabled: true,
    staleTime: 30000,
    retry: 1,
    onError: (error: any) => {
      console.error('Inventory fetch error:', error);
      toast.error('Failed to load inventory');
    }
  });
};

// Hook for getting inventory by warehouse
export const useInventoryByWarehouseNew = (warehouseId: string) => {
  return trpc.inventory.getByWarehouse.useQuery({
    warehouse_id: warehouseId,
  }, {
    enabled: Boolean(warehouseId),
    staleTime: 30000,
    retry: 1,
    onError: (error) => {
      console.error('Warehouse inventory fetch error:', error);
      toast.error('Failed to load warehouse inventory');
    }
  });
};

// Hook for getting inventory statistics
export const useInventoryStatsNew = (warehouseId?: string) => {
  return trpc.inventory.getStats.useQuery({
    warehouse_id: warehouseId,
  }, {
    enabled: true,
    staleTime: 60000, // 1 minute for stats
    retry: 1,
    onError: (error) => {
      console.error('Inventory stats fetch error:', error);
      toast.error('Failed to load inventory statistics');
    }
  });
};

// Hook for adjusting stock levels
export const useAdjustStockNew = () => {
  const utils = trpc.useContext();
  
  return trpc.inventory.adjustStock.useMutation({
    onSuccess: (updatedInventory) => {
      console.log('Stock adjusted successfully:', updatedInventory);
      
      // Invalidate inventory queries to refetch updated data
      utils.inventory.list.invalidate();
      utils.inventory.getByWarehouse.invalidate();
      utils.inventory.getStats.invalidate();
      
      toast.success('Stock levels updated successfully');
    },
    onError: (error) => {
      console.error('Stock adjustment error:', error);
      toast.error(error.message || 'Failed to adjust stock levels');
    },
  });
};

// Hook for transferring stock between warehouses
export const useTransferStockNew = () => {
  const utils = trpc.useContext();
  
  return trpc.inventory.transferStock.useMutation({
    onSuccess: (transferResult) => {
      console.log('Stock transferred successfully:', transferResult);
      
      // Invalidate inventory queries to refetch updated data
      utils.inventory.list.invalidate();
      utils.inventory.getByWarehouse.invalidate();
      utils.inventory.getStats.invalidate();
      
      // Show detailed success message
      if (transferResult.success && transferResult.transfer) {
        const { qty_full, qty_empty } = transferResult.transfer;
        const totalTransferred = qty_full + qty_empty;
        toast.success(
          `Successfully transferred ${totalTransferred} cylinders (${qty_full} full, ${qty_empty} empty)`
        );
      } else {
        toast.success('Stock transferred successfully');
      }
    },
    onError: (error) => {
      console.error('Stock transfer error:', error);
      toast.error(error.message || 'Failed to transfer stock');
    },
  });
};

// Hook for reserving inventory
export const useReserveInventoryNew = () => {
  const utils = trpc.useContext();
  
  return trpc.inventory.reserve.useMutation({
    onSuccess: (reservation) => {
      console.log('Inventory reserved successfully:', reservation);
      
      // Invalidate inventory queries
      utils.inventory.list.invalidate();
      utils.inventory.getByWarehouse.invalidate();
      utils.inventory.getStats.invalidate();
      
      toast.success('Inventory reserved successfully');
    },
    onError: (error) => {
      console.error('Inventory reservation error:', error);
      toast.error(error.message || 'Failed to reserve inventory');
    },
  });
};

// Hook for creating inventory balance
export const useCreateInventoryNew = () => {
  const utils = trpc.useContext();
  
  return trpc.inventory.create.useMutation({
    onSuccess: (newInventory) => {
      console.log('Inventory balance created successfully:', newInventory);
      
      // Invalidate inventory queries
      utils.inventory.list.invalidate();
      utils.inventory.getByWarehouse.invalidate();
      utils.inventory.getStats.invalidate();
      
      toast.success('Inventory balance created successfully');
    },
    onError: (error) => {
      console.error('Create inventory error:', error);
      toast.error(error.message || 'Failed to create inventory balance');
    },
  });
};

// Hook for creating receipts (Document 4.1 - Receiving Stock)
export const useCreateReceipt = () => {
  const utils = trpc.useContext();
  
  return trpc.inventory.createReceipt.useMutation({
    onSuccess: (receipt) => {
      console.log('Receipt created successfully:', receipt);
      
      // Invalidate inventory queries to refetch updated data
      utils.inventory.list.invalidate();
      utils.inventory.getByWarehouse.invalidate();
      utils.inventory.getStats.invalidate();
      
      toast.success('Receipt created successfully');
    },
    onError: (error) => {
      console.error('Receipt creation error:', error);
      toast.error(error.message || 'Failed to create receipt');
    },
  });
};

// Hook for listing receipts
export const useListReceipts = (filters: {
  warehouse_id?: string;
  status?: 'open' | 'partial' | 'completed' | 'cancelled';
  page?: number;
  limit?: number;
} = {}) => {
  return trpc.inventory.listReceipts.useQuery({
    warehouse_id: filters.warehouse_id,
    status: filters.status,
    page: filters.page || 1,
    limit: filters.limit || 15,
  }, {
    enabled: true,
    staleTime: 30000,
    retry: 1,
    onError: (error) => {
      console.error('Receipts fetch error:', error);
      toast.error('Failed to load receipts');
    }
  });
};

// Hook for creating cycle counts (Document 4.3)
export const useCreateCycleCount = () => {
  const utils = trpc.useContext();
  
  return trpc.inventory.createCycleCount.useMutation({
    onSuccess: (cycleCount) => {
      console.log('Cycle count created successfully:', cycleCount);
      
      // Invalidate inventory queries
      utils.inventory.list.invalidate();
      utils.inventory.getByWarehouse.invalidate();
      utils.inventory.getStats.invalidate();
      
      toast.success('Cycle count created successfully');
    },
    onError: (error) => {
      console.error('Cycle count creation error:', error);
      toast.error(error.message || 'Failed to create cycle count');
    },
  });
};

// Hook for enhanced warehouse transfers (Document 4.2)
export const useInitiateTransfer = () => {
  const utils = trpc.useContext();
  
  return trpc.inventory.initiateTransfer.useMutation({
    onSuccess: (transfer) => {
      console.log('Transfer initiated successfully:', transfer);
      
      // Invalidate inventory queries
      utils.inventory.list.invalidate();
      utils.inventory.getByWarehouse.invalidate();
      utils.inventory.getStats.invalidate();
      
      toast.success('Transfer initiated successfully');
    },
    onError: (error) => {
      console.error('Transfer initiation error:', error);
      toast.error(error.message || 'Failed to initiate transfer');
    },
  });
};

export const useCompleteTransfer = () => {
  const utils = trpc.useContext();
  
  return trpc.inventory.completeTransfer.useMutation({
    onSuccess: (transfer) => {
      console.log('Transfer completed successfully:', transfer);
      
      // Invalidate inventory queries
      utils.inventory.list.invalidate();
      utils.inventory.getByWarehouse.invalidate();
      utils.inventory.getStats.invalidate();
      
      toast.success('Transfer completed successfully');
    },
    onError: (error) => {
      console.error('Transfer completion error:', error);
      toast.error(error.message || 'Failed to complete transfer');
    },
  });
};

// Utility hook to get inventory context
export const useInventoryContext = () => {
  return trpc.useContext().inventory;
};