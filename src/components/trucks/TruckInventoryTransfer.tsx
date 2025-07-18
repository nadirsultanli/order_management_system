import React, { useState } from 'react';
import { Package, ArrowDownToLine, ArrowUpToLine, Loader2 } from 'lucide-react';
import { useWarehouseOptions } from '../../hooks/useWarehouses';
import { useInventoryByWarehouseNew } from '../../hooks/useInventory';
import { trpc } from '../../lib/trpc-client';
import toast from 'react-hot-toast';

interface TruckInventoryTransferProps {
  truckId: string;
  truckName: string;
  onSuccess?: () => void;
}

export const TruckInventoryTransfer: React.FC<TruckInventoryTransferProps> = ({
  truckId,
  truckName,
  onSuccess,
}) => {
  const [transferType, setTransferType] = useState<'load' | 'unload'>('load');
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('');
  const [qtyFull, setQtyFull] = useState<number>(0);
  const [qtyEmpty, setQtyEmpty] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);

  const { data: warehouses = [] } = useWarehouseOptions();
  // Inventory for selected warehouse (for load)
  const { data: warehouseInventory = [] } = useInventoryByWarehouseNew(selectedWarehouse);

  // Truck data to get inventory (for unload)
  const { data: truckDetails } = (trpc.trucks as any).get.useQuery({ id: truckId });
  const truckInventory = truckDetails?.inventory || [];

  // Get all products for the dropdown
  const { data: allProducts = [] } = (trpc.products as any).getOptions.useQuery({ 
    status: 'active', 
    include_variants: true 
  });

  // Create a map of product inventory for quick lookup
  const productInventoryMap = new Map();
  
  if (transferType === 'load') {
    // For load: use warehouse inventory
    (warehouseInventory as any[]).forEach(inv => {
      if (inv.product) {
        productInventoryMap.set(inv.product.id, {
          qty_full: inv.qty_full || 0,
          qty_empty: inv.qty_empty || 0,
          qty_available: (inv.qty_full || 0) - (inv.qty_reserved || 0)
        });
      }
    });
  } else {
    // For unload: use truck inventory
    (truckInventory as any[]).forEach(inv => {
      productInventoryMap.set(inv.product_id, {
        qty_full: inv.qty_full || 0,
        qty_empty: inv.qty_empty || 0,
        qty_available: (inv.qty_full || 0) - (inv.qty_reserved || 0)
      });
    });
  }

  // Filter products to only show variants with parent_products_id that have inventory
  const products = allProducts.filter((product: any) => {
    // Check if product has parent_products_id (is a variant)
    const isVariant = product.is_variant === true;
    
    // Check if product has inventory
    const inventory = productInventoryMap.get(product.id);
    const hasInventory = inventory && (inventory.qty_full > 0 || inventory.qty_empty > 0);
    
    // Only show variants with inventory
    return isVariant && hasInventory;
  });

  const loadTruckMutation = (trpc.trucks as any).loadInventory.useMutation();
  const unloadTruckMutation = (trpc.trucks as any).unloadInventory.useMutation();
  const utils = trpc.useContext();

  const handleTransfer = async () => {
    if (!selectedWarehouse || !selectedProduct || (qtyFull === 0 && qtyEmpty === 0)) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsProcessing(true);
    
    try {
      const items = [{
        product_id: selectedProduct,
        qty_full: qtyFull,
        qty_empty: qtyEmpty,
      }];

      if (transferType === 'load') {
        await loadTruckMutation.mutateAsync({
          truck_id: truckId,
          warehouse_id: selectedWarehouse,
          items,
        });
        toast.success(`Successfully loaded ${qtyFull + qtyEmpty} cylinders onto ${truckName}`);
      } else {
        await unloadTruckMutation.mutateAsync({
          truck_id: truckId,
          warehouse_id: selectedWarehouse,
          items,
        });
        toast.success(`Successfully unloaded ${qtyFull + qtyEmpty} cylinders from ${truckName}`);
      }

      // Reset form
      setSelectedWarehouse('');
      setSelectedProduct('');
      setQtyFull(0);
      setQtyEmpty(0);

      // Invalidate relevant queries
      (utils.trucks as any).get.invalidate();
      (utils.inventory as any).list.invalidate();
      (utils.inventory as any).getByWarehouse.invalidate();

      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      toast.error(error.message || `Failed to ${transferType} truck`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="flex items-center mb-4">
        <Package className="h-6 w-6 text-gray-400 mr-2" />
        <h2 className="text-lg font-medium text-gray-900">Quick Inventory Transfer</h2>
      </div>

      <div className="space-y-4">
        {/* Transfer Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Transfer Type
          </label>
          <div className="flex space-x-4">
            <button
              onClick={() => setTransferType('load')}
              className={`flex items-center px-4 py-2 rounded-lg border ${
                transferType === 'load'
                  ? 'bg-blue-50 border-blue-500 text-blue-700'
                  : 'bg-gray-50 border-gray-300 text-gray-700'
              }`}
            >
              <ArrowDownToLine className="h-4 w-4 mr-2" />
              Load Truck
            </button>
            <button
              onClick={() => setTransferType('unload')}
              className={`flex items-center px-4 py-2 rounded-lg border ${
                transferType === 'unload'
                  ? 'bg-blue-50 border-blue-500 text-blue-700'
                  : 'bg-gray-50 border-gray-300 text-gray-700'
              }`}
            >
              <ArrowUpToLine className="h-4 w-4 mr-2" />
              Unload Truck
            </button>
          </div>
        </div>

        {/* Warehouse Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {transferType === 'load' ? 'Source Warehouse' : 'Destination Warehouse'}
          </label>
          <select
            value={selectedWarehouse}
            onChange={(e) => setSelectedWarehouse(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Select warehouse...</option>
            {(warehouses as any[]).map((warehouse: any) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.name}
              </option>
            ))}
          </select>
        </div>

        {/* Product Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Product
          </label>
          <select
            value={selectedProduct}
            onChange={(e) => setSelectedProduct(e.target.value)}
            disabled={transferType === 'load' && !selectedWarehouse}
            className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:border-blue-500 ${
              transferType === 'load' && !selectedWarehouse ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'border-gray-300'
            }`}
          >
            <option value="">
              {transferType === 'load' && !selectedWarehouse ? 'Select a warehouse first' : 'Select product...'}
            </option>
            {products.map((product: any) => {
              const inventory = productInventoryMap.get(product.id);
              const availableQty = inventory ? inventory.qty_available : 0;
              
              return (
                <option 
                  key={product.id} 
                  value={product.id}
                >
                  {product.display_name || product.name} ({availableQty} available)
                </option>
              );
            })}
          </select>
        </div>

        {/* Quantities */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Full Cylinders
            </label>
            <input
              type="number"
              min="0"
              value={qtyFull}
              onChange={(e) => setQtyFull(parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Empty Cylinders
            </label>
            <input
              type="number"
              min="0"
              value={qtyEmpty}
              onChange={(e) => setQtyEmpty(parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Submit Button */}
        <button
          onClick={handleTransfer}
          disabled={isProcessing || !selectedWarehouse || !selectedProduct || (qtyFull === 0 && qtyEmpty === 0)}
          className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isProcessing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              {transferType === 'load' ? (
                <ArrowDownToLine className="h-4 w-4 mr-2" />
              ) : (
                <ArrowUpToLine className="h-4 w-4 mr-2" />
              )}
              {transferType === 'load' ? 'Load Truck' : 'Unload Truck'}
            </>
          )}
        </button>
      </div>
    </div>
  );
};