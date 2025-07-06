import { trpc } from '../lib/trpc-client';
import toast from 'react-hot-toast';

// Hook for listing inventory
export const useInventoryNew = (filters: {
  warehouse_id?: string;
  product_id?: string;
  low_stock_only?: boolean;
} = {}) => {
  return trpc.inventory.list.useQuery({
    warehouse_id: filters.warehouse_id,
    product_id: filters.product_id,
    low_stock_only: filters.low_stock_only || false,
  }, {
    enabled: true,
    staleTime: 30000,
    retry: 1,
    onError: (error) => {
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

// Utility hook to get inventory context
export const useInventoryContext = () => {
  return trpc.useContext().inventory;
};