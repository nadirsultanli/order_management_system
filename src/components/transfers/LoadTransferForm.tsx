import React, { useState, useEffect, useCallback } from 'react';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Package, CheckCircle, AlertCircle } from 'lucide-react';
import { useWarehouseOptions } from '../../hooks/useWarehouses';
import { useInventoryByWarehouseNew } from '../../hooks/useInventory';
import { trpc } from '../../lib/trpc-client';
import toast from 'react-hot-toast';
import { clampQuantityToMax } from '../../utils/transfer-quantity-validation';
import { SearchableWarehouseSelector } from '../warehouses/SearchableWarehouseSelector';
import { SearchableTruckSelector } from '../trucks/SearchableTruckSelector';

// Define types locally since they were removed from lib/transfers
interface TransferLine {
  product_id: string;
  product_name: string;
  product_sku: string;
  unit_of_measure: string;
  qty_full: number | string;
  qty_empty: number | string;
  max_qty_full?: number;
  max_qty_empty?: number;
}

interface LoadTransferFormProps {
  onSuccess?: () => void;
}

export const LoadTransferForm: React.FC<LoadTransferFormProps> = ({ onSuccess }) => {
  const [selectedTruck, setSelectedTruck] = useState<string>('');
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('');
  const [lines, setLines] = useState<TransferLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data: warehouses = [] } = useWarehouseOptions();
  const [optimisticUpdate, setOptimisticUpdate] = useState<boolean>(false);
  const [transferResult, setTransferResult] = useState<any>(null);

  // Use tRPC for context invalidation
  const utils = trpc.useContext();
  
  // Use tRPC for truck loading with optimistic updates
  const loadTruckMutation = trpc.trucks.loadInventory.useMutation({
    onMutate: async () => {
      // Start optimistic update
      setOptimisticUpdate(true);
      
      // Cancel any outgoing refetches to avoid overwriting optimistic update
      await utils.trucks.get.cancel({ id: selectedTruck });
      await utils.inventory.getByWarehouse.cancel({ warehouse_id: selectedWarehouse });
      
      // Snapshot current values
      const previousTruckData = utils.trucks.get.getData({ id: selectedTruck });
      const previousInventoryData = utils.inventory.getByWarehouse.getData({ warehouse_id: selectedWarehouse });
      
      return { previousTruckData, previousInventoryData };
    },
    onError: (err, variables, context) => {
      // Revert optimistic update on error
      setOptimisticUpdate(false);
      if (context?.previousTruckData) {
        utils.trucks.get.setData({ id: selectedTruck }, context.previousTruckData);
      }
      if (context?.previousInventoryData) {
        utils.inventory.getByWarehouse.setData({ warehouse_id: selectedWarehouse }, context.previousInventoryData);
      }
    },
    onSuccess: async (data) => {
      setTransferResult(data);
      setOptimisticUpdate(false);
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Validate inputs
      if (!selectedTruck) {
        throw new Error('Please select a truck');
      }
      if (!selectedWarehouse) {
        throw new Error('Please select a source warehouse');
      }
      // Filter lines to only include those with quantities
      const linesWithQuantities = lines.filter(line => 
        (Number(line.qty_full) || 0) > 0 || (Number(line.qty_empty) || 0) > 0
      );
      
      if (linesWithQuantities.length === 0) {
        throw new Error('Please enter quantities for at least one product');
      }

      // Validate quantities (only for lines with quantities)
      const invalidLines = linesWithQuantities.filter(line => 
        (Number(line.qty_full) || 0) < 0 || (Number(line.qty_empty) || 0) < 0
      );
      if (invalidLines.length > 0) {
        throw new Error('Please enter valid quantities (cannot be negative)');
      }

      // Load transfer: move inventory from warehouse to truck
      console.log('Loading truck with products from warehouse');
      
      // Prepare items for the API call (only include lines with quantities)
      const items = linesWithQuantities.map(line => ({
        product_id: line.product_id,
        qty_full: Number(line.qty_full) || 0,
        qty_empty: Number(line.qty_empty) || 0,
      }));

      // Call the truck loading API
      const result = await loadTruckMutation.mutateAsync({
        truck_id: selectedTruck,
        warehouse_id: selectedWarehouse,
        items: items,
      });
      
      console.log('Truck loading completed successfully:', result);
      
      // Verify the transfer was actually completed in the database
      setVerifying(true);
      try {
        await verifyTransferCompletion(selectedTruck, selectedWarehouse, items);
        console.log('Transfer verification completed successfully');
      } catch (verificationError) {
        console.warn('Transfer verification failed:', verificationError);
        toast('Transfer completed but verification failed. Please check inventory manually.', {
          icon: '⚠️',
          style: {
            borderLeft: '4px solid #f59e0b',
          },
        });
      } finally {
        setVerifying(false);
      }

      // Show success message
      const totalFull = linesWithQuantities.reduce((sum, line) => sum + (Number(line.qty_full) || 0), 0);
      const totalEmpty = linesWithQuantities.reduce((sum, line) => sum + (Number(line.qty_empty) || 0), 0);
      const totalItems = totalFull + totalEmpty;
      
      toast.success(`Successfully loaded ${totalItems} cylinders (${totalFull} full, ${totalEmpty} empty) onto truck`);

      // Comprehensive query invalidation for real-time updates
      await Promise.all([
        // Inventory queries
        utils.inventory.list.invalidate(),
        utils.inventory.getByWarehouse.invalidate({ warehouse_id: selectedWarehouse }),
        utils.inventory.getStats.invalidate(),
        
        // Truck queries - specific and general
        utils.trucks.get.invalidate({ id: selectedTruck }),
        utils.trucks.list.invalidate(),
        
        // Transfer queries to update any transfer history
        utils.transfers.list.invalidate(),
        
        // Force refetch specific truck inventory
        utils.trucks.get.refetch({ id: selectedTruck })
      ]);

      // Reset form
      setSelectedTruck('');
      setSelectedWarehouse('');
      setLines([]);
      setShowConfirm(false);

      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      console.error('Transfer creation error:', err);
      const errorMessage = err.message || 'Failed to create transfer';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
      setVerifying(false);
    }
  };

  // Verification function to confirm transfer completion
  const verifyTransferCompletion = useCallback(async (
    truckId: string,
    warehouseId: string,
    transferredItems: Array<{ product_id: string; qty_full: number; qty_empty: number }>
  ) => {
    // Wait a short time for database consistency
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Fetch updated truck inventory
    const updatedTruckData = await utils.trucks.get.refetch({ id: truckId });
    const truckInventory = updatedTruckData.data?.inventory || [];
    
    // Fetch updated warehouse inventory
    const updatedWarehouseData = await utils.inventory.getByWarehouse.refetch({ warehouse_id: warehouseId });
    const warehouseInventory = updatedWarehouseData.data || [];
    
    // Verify each transferred item
    const verificationResults = [];
    for (const item of transferredItems) {
      const truckItem = truckInventory.find(inv => inv.product_id === item.product_id);
      const warehouseItem = warehouseInventory.find(inv => inv.product_id === item.product_id);
      
      const verification = {
        product_id: item.product_id,
        transferred_full: item.qty_full,
        transferred_empty: item.qty_empty,
        truck_inventory_updated: !!truckItem,
        warehouse_inventory_updated: !!warehouseItem,
        success: true
      };
      
      // Basic verification - check if inventory exists
      if (!truckItem && (item.qty_full > 0 || item.qty_empty > 0)) {
        verification.success = false;
        console.warn(`Truck inventory not found for product ${item.product_id}`);
      }
      
      verificationResults.push(verification);
    }
    
    const allVerified = verificationResults.every(v => v.success);
    if (!allVerified) {
      throw new Error('Some items failed verification');
    }
    
    return verificationResults;
  }, [utils]);


  // Get warehouse inventory for validation
  const { data: warehouseInventory = [] } = useInventoryByWarehouseNew(selectedWarehouse);

  // Automatically populate lines when warehouse changes
  useEffect(() => {
    if (selectedWarehouse && warehouseInventory.length > 0) {
      const newLines = warehouseInventory.map((item: any) => ({
        product_id: item.product_id,
        product_name: item.product?.name || item.product_name,
        product_sku: item.product?.sku || item.product_sku,
        unit_of_measure: item.product?.unit_of_measure || item.unit_of_measure,
        qty_full: '',
        qty_empty: '',
        max_qty_full: item.qty_full,
        max_qty_empty: item.qty_empty
      }));
      setLines(newLines);
    } else {
      setLines([]);
    }
  }, [selectedWarehouse, warehouseInventory]);


  // Function to validate and clamp quantities
  const handleQuantityChange = (index: number, field: 'qty_full' | 'qty_empty', value: string) => {
    const newLines = [...lines];
    const numValue = value === '' ? 0 : parseInt(value);
    const maxValue = field === 'qty_full' ? newLines[index].max_qty_full || 0 : newLines[index].max_qty_empty || 0;
    
    // Clamp the value to the maximum available
    const clampedValue = clampQuantityToMax(numValue, maxValue);
    
    newLines[index][field] = value === '' ? '' : clampedValue;
    
    // Show warning if user tried to enter more than available
    if (numValue > maxValue && maxValue > 0) {
      toast.warning(`Only ${maxValue} ${field === 'qty_full' ? 'full' : 'empty'} cylinders available for ${newLines[index].product_name}`);
    }
    
    setLines(newLines);
  };


  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">{error}</h3>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white shadow rounded-lg p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Source Warehouse Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Warehouse (Source)
            </label>
            <SearchableWarehouseSelector
              value={selectedWarehouse}
              onChange={setSelectedWarehouse}
              placeholder="Select a warehouse..."
              className="w-full"
            />
          </div>

          {/* Truck Selection (Destination) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Truck (Destination)
            </label>
            <SearchableTruckSelector
              value={selectedTruck}
              onChange={setSelectedTruck}
              placeholder="Select a truck..."
              className="w-full"
            />
          </div>
        </div>


        {/* Warehouse Inventory with Inline Quantity Inputs */}
        {selectedWarehouse && (
          <div className="mt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Warehouse Inventory - Items to Load</h3>
            
            {lines.length === 0 ? (
              <div className="text-center py-8">
                <Package className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No Inventory Available</h3>
                <p className="mt-1 text-sm text-gray-500">This warehouse has no inventory to load.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {lines.map((line, index) => (
                  <div key={`${line.product_id}-${index}`} className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{line.product_name}</div>
                      <div className="text-sm text-gray-500">SKU: {line.product_sku}</div>
                      <div className="text-xs text-gray-400 mt-1">
                        Available: {line.max_qty_full || 0} full, {line.max_qty_empty || 0} empty
                      </div>
                    </div>
                    <div className="flex space-x-4">
                      <div className="w-32">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Full
                          <br />
                          Cylinders {line.max_qty_full !== undefined && (
                            <span className="text-xs text-gray-500">(max: {line.max_qty_full})</span>
                          )}
                        </label>
                        <input
                          type="number"
                          min="0"
                          max={line.max_qty_full || undefined}
                          value={line.qty_full}
                          onChange={(e) => handleQuantityChange(index, 'qty_full', e.target.value)}
                          placeholder="0"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div className="w-32">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Empty
                          <br />
                          Cylinders {line.max_qty_empty !== undefined && (
                            <span className="text-xs text-gray-500">(max: {line.max_qty_empty})</span>
                          )}
                        </label>
                        <input
                          type="number"
                          min="0"
                          max={line.max_qty_empty || undefined}
                          value={line.qty_empty}
                          onChange={(e) => handleQuantityChange(index, 'qty_empty', e.target.value)}
                          placeholder="0"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowConfirm(true)}
          disabled={loading || verifying || !selectedTruck || !selectedWarehouse || lines.filter(line => (Number(line.qty_full) || 0) > 0 || (Number(line.qty_empty) || 0) > 0).length === 0}
          className="inline-flex items-center justify-center rounded-md border border-transparent bg-blue-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading && (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
          )}
          {verifying && (
            <AlertCircle className="h-4 w-4 mr-2 animate-pulse" />
          )}
          {optimisticUpdate && (
            <CheckCircle className="h-4 w-4 mr-2 text-green-300" />
          )}
          {loading ? 'Loading...' : verifying ? 'Verifying...' : 'Load Truck'}
        </button>
      </div>

      <ConfirmDialog
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleSubmit}
        title="Confirm Truck Loading"
        message={`Are you sure you want to load this truck? This will move inventory from the warehouse to the selected truck. ${lines.filter(line => (Number(line.qty_full) || 0) > 0 || (Number(line.qty_empty) || 0) > 0).length} products will be transferred.`}
        confirmText={loading ? 'Loading...' : verifying ? 'Verifying...' : 'Load Truck'}
        type="info"
        loading={loading || verifying}
      />
      
      {/* Transfer Status Indicator */}
      {(optimisticUpdate || verifying) && (
        <div className="fixed bottom-4 right-4 bg-white shadow-lg rounded-lg p-4 border-l-4 border-blue-500 max-w-sm z-50">
          <div className="flex items-center">
            {optimisticUpdate && (
              <div className="flex items-center text-blue-600">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                <span className="text-sm font-medium">Processing transfer...</span>
              </div>
            )}
            {verifying && (
              <div className="flex items-center text-yellow-600">
                <AlertCircle className="h-4 w-4 mr-2 animate-pulse" />
                <span className="text-sm font-medium">Verifying completion...</span>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Transfer Result Summary */}
      {transferResult && (
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-md">
          <div className="flex items-center">
            <CheckCircle className="h-5 w-5 text-green-400 mr-2" />
            <h3 className="text-sm font-medium text-green-800">Transfer Completed Successfully</h3>
          </div>
          <div className="mt-2 text-sm text-green-700">
            <p>Truck ID: {transferResult.truck_id}</p>
            <p>Items Transferred: {transferResult.items_transferred}</p>
            <p>Warehouse: {warehouses.find(w => w.id === transferResult.warehouse_id)?.name}</p>
          </div>
        </div>
      )}

    </div>
  );
}; 