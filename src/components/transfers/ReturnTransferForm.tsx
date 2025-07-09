import React, { useState, useEffect } from 'react';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Package, Loader2 } from 'lucide-react';
import { SearchableTruckSelector } from '../trucks/SearchableTruckSelector';
import { SearchableWarehouseSelector } from '../warehouses/SearchableWarehouseSelector';
import { trpc } from '../../lib/trpc-client';
import toast from 'react-hot-toast';
import { clampQuantityToMax } from '../../utils/transfer-quantity-validation';

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

interface ReturnTransferFormProps {
  onSuccess?: () => void;
}

export const ReturnTransferForm: React.FC<ReturnTransferFormProps> = ({ onSuccess }) => {
  const [selectedTruck, setSelectedTruck] = useState<string>('');
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>(''); // This will be the destination warehouse
  const [lines, setLines] = useState<TransferLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use tRPC for truck unloading and context for invalidation
  const utils = trpc.useContext();
  
  // Use tRPC for truck unloading
  const unloadTruckMutation = trpc.trucks.unloadInventory.useMutation();
  
  // Get truck inventory when a truck is selected
  const { data: selectedTruckData, isLoading: truckLoading } = trpc.trucks.get.useQuery(
    { id: selectedTruck },
    { enabled: !!selectedTruck }
  );
  
  const truckInventory = selectedTruckData?.inventory || [];
  const availableInventory = truckInventory.filter(
    (item: any) => (item.qty_full > 0 || item.qty_empty > 0)
  );
  
  // Initialize lines when truck inventory is loaded
  useEffect(() => {
    if (availableInventory.length > 0) {
      const initialLines = availableInventory.map((item: any) => ({
        product_id: item.product_id,
        product_name: item.product_name,
        product_sku: item.product_sku,
        unit_of_measure: item.unit_of_measure || 'each',
        qty_full: '',
        qty_empty: '',
        max_qty_full: item.qty_full,
        max_qty_empty: item.qty_empty
      }));
      setLines(initialLines);
    } else {
      setLines([]);
    }
  }, [availableInventory]);

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
        throw new Error('Please select a destination warehouse');
      }
      if (lines.length === 0) {
        throw new Error('Please add at least one product');
      }

      // Validate quantities
      const invalidLines = lines.filter(line => 
        (!line.qty_full || line.qty_full < 0) && (!line.qty_empty || line.qty_empty < 0)
      );
      if (invalidLines.length > 0) {
        throw new Error('Please enter valid quantities for all products');
      }

      // Validate at least one quantity is positive
      const emptyLines = lines.filter(line => 
        (line.qty_full || 0) === 0 && (line.qty_empty || 0) === 0
      );
      if (emptyLines.length > 0) {
        throw new Error('Each line must have at least one full or empty cylinder');
      }

      // Prepare items for the API call
      const items = lines.map(line => ({
        product_id: line.product_id,
        qty_full: Number(line.qty_full) || 0,
        qty_empty: Number(line.qty_empty) || 0,
      })).filter(item => item.qty_full > 0 || item.qty_empty > 0);

      console.log('Unloading truck inventory:', { selectedTruck, selectedWarehouse, items });

      // Call the truck unloading API
      const result = await unloadTruckMutation.mutateAsync({
        truck_id: selectedTruck,
        warehouse_id: selectedWarehouse,
        items: items,
      });
      
      console.log('Truck unloading completed successfully:', result);

      // Show success message
      const totalFull = lines.reduce((sum, line) => sum + (Number(line.qty_full) || 0), 0);
      const totalEmpty = lines.reduce((sum, line) => sum + (Number(line.qty_empty) || 0), 0);
      const totalItems = totalFull + totalEmpty;
      
      toast.success(`Successfully returned ${totalItems} cylinders (${totalFull} full, ${totalEmpty} empty) to warehouse`);

      // Invalidate relevant queries to refresh inventory data
      utils.inventory.list.invalidate();
      utils.inventory.getByWarehouse.invalidate();
      utils.inventory.getStats.invalidate();
      utils.trucks.list.invalidate();
      utils.trucks.get.invalidate();

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
    }
  };


  // Function to validate and clamp quantities for truck return
  const handleQuantityChange = (index: number, field: 'qty_full' | 'qty_empty', value: string) => {
    const newLines = [...lines];
    const numValue = value === '' ? 0 : parseInt(value);
    const maxValue = field === 'qty_full' ? newLines[index].max_qty_full || 0 : newLines[index].max_qty_empty || 0;
    
    // Clamp the value to the maximum available
    const clampedValue = clampQuantityToMax(numValue, maxValue);
    
    newLines[index][field] = value === '' ? '' : clampedValue;
    
    // Show warning if user tried to enter more than available
    if (numValue > maxValue && maxValue > 0) {
      toast(`Only ${maxValue} ${field === 'qty_full' ? 'full' : 'empty'} cylinders available on truck for ${newLines[index].product_name}`, {
        icon: '⚠️',
        style: {
          borderLeft: '4px solid #f59e0b',
        },
      });
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
          {/* Truck Selection (Source) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Truck (Source)
            </label>
            <SearchableTruckSelector
              value={selectedTruck}
              onChange={(truckId) => {
                setSelectedTruck(truckId);
                if (!truckId) {
                  setLines([]);
                }
              }}
              placeholder="Select a truck..."
              className="w-full"
            />
          </div>

          {/* Destination Warehouse Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Warehouse (Destination)
            </label>
            <SearchableWarehouseSelector
              value={selectedWarehouse}
              onChange={setSelectedWarehouse}
              placeholder="Select a warehouse..."
              className="w-full"
            />
          </div>
        </div>

        {/* Truck Inventory with Inline Quantity Inputs */}
        {selectedTruck && (
          <div className="mt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Truck Inventory - Items to Return</h3>
            
            {truckLoading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              </div>
            ) : availableInventory.length === 0 ? (
              <div className="text-center py-8">
                <Package className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No Inventory Available</h3>
                <p className="mt-1 text-sm text-gray-500">This truck has no inventory to return.</p>
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
                          Full Cylinders
                          {line.max_qty_full !== undefined && (
                            <span className="text-xs text-gray-500 ml-1">(max: {line.max_qty_full})</span>
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
                          Empty Cylinders
                          {line.max_qty_empty !== undefined && (
                            <span className="text-xs text-gray-500 ml-1">(max: {line.max_qty_empty})</span>
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
          disabled={loading || !selectedTruck || !selectedWarehouse || lines.filter(line => (Number(line.qty_full) || 0) > 0 || (Number(line.qty_empty) || 0) > 0).length === 0}
          className="inline-flex items-center justify-center rounded-md border border-transparent bg-blue-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading && (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
          )}
          {loading ? 'Returning...' : 'Return to Warehouse'}
        </button>
      </div>

      <ConfirmDialog
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleSubmit}
        title="Confirm Truck Return"
        message={`Are you sure you want to return inventory from this truck? This will move inventory from the truck back to the warehouse. ${lines.filter(line => (Number(line.qty_full) || 0) > 0 || (Number(line.qty_empty) || 0) > 0).length} products will be transferred.`}
        confirmText={loading ? 'Returning...' : 'Return to Warehouse'}
        type="info"
        loading={loading}
      />

    </div>
  );
}; 