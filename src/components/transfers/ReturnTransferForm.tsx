import React, { useState, useEffect, useCallback } from 'react';
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

interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export const ReturnTransferForm: React.FC<ReturnTransferFormProps> = ({ onSuccess }) => {
  const [selectedTruck, setSelectedTruck] = useState<string>('');
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('');
  const [lines, setLines] = useState<TransferLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Flag to prevent form re-initialization after first load
  const [formInitialized, setFormInitialized] = useState(false);

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
  
  // Initialize lines only when truck changes, not when query data changes
  useEffect(() => {
    if (availableInventory.length > 0 && !formInitialized && selectedTruck) {
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
      setFormInitialized(true);
    } else if (!selectedTruck) {
      // Only reset when truck is cleared
      setLines([]);
      setFormInitialized(false);
    }
  }, [availableInventory, formInitialized, selectedTruck]);

  // Reset form initialization when truck changes
  useEffect(() => {
    setFormInitialized(false);
  }, [selectedTruck]);

  // Enhanced truck change handler
  const handleTruckChange = useCallback((truckId: string) => {
    setSelectedTruck(truckId);
    setError(null); // Clear any existing errors
    if (!truckId) {
      setLines([]);
      setFormInitialized(false);
    }
  }, []);

  const handleWarehouseChange = useCallback((warehouseId: string) => {
    setSelectedWarehouse(warehouseId);
    setError(null); // Clear any existing errors
  }, []);

  // Enhanced quantity change handler with better validation
  const handleQuantityChange = useCallback((index: number, field: 'qty_full' | 'qty_empty', value: string) => {
    const newLines = [...lines];
    
    // Allow empty string for clearing input
    if (value === '') {
      newLines[index][field] = '';
      setLines(newLines);
      return;
    }
    
    // Enhanced input validation
    const numValue = parseInt(value, 10);
    const maxValue = field === 'qty_full' ? newLines[index].max_qty_full || 0 : newLines[index].max_qty_empty || 0;
    
    // Comprehensive input validation
    if (isNaN(numValue)) {
      toast.error('Please enter a valid number', { duration: 3000 });
      return;
    }
    
    if (numValue < 0) {
      toast.error('Quantity cannot be negative', { duration: 3000 });
      return;
    }
    
    if (numValue === 0) {
      newLines[index][field] = 0;
      setLines(newLines);
      return;
    }
    
    // Handle over-transfer with better UX
    if (numValue > maxValue) {
      const clampedValue = maxValue;
      newLines[index][field] = clampedValue;
      
      toast.error(
        `Cannot transfer ${numValue} ${field === 'qty_full' ? 'full' : 'empty'} cylinders. Only ${maxValue} available. Set to maximum available.`,
        {
          duration: 4000,
          style: {
            borderLeft: '4px solid #ef4444',
          },
        }
      );
    } else {
      // Valid quantity within range
      newLines[index][field] = numValue;
    }
    
    setLines(newLines);
  }, [lines]);

  // Enhanced form validation
  const validateForm = useCallback((): ValidationResult => {
    const errors: string[] = [];
    
    // Basic required field validation
    if (!selectedTruck) {
      errors.push('Please select a truck');
    }
    
    if (!selectedWarehouse) {
      errors.push('Please select a destination warehouse');
    }
    
    if (lines.length === 0) {
      errors.push('No inventory items available for transfer');
      return { isValid: false, errors };
    }
    
    // Validate each transfer line
    let hasValidTransfer = false;
    const lineErrors: string[] = [];
    
    lines.forEach((line, index) => {
      const fullQty = Number(line.qty_full) || 0;
      const emptyQty = Number(line.qty_empty) || 0;
      const maxFull = line.max_qty_full || 0;
      const maxEmpty = line.max_qty_empty || 0;
      
      // Check if this line has any transfer quantity
      if (fullQty > 0 || emptyQty > 0) {
        hasValidTransfer = true;
        
        // Validate full cylinders
        if (fullQty > maxFull) {
          lineErrors.push(`${line.product_name}: Cannot transfer ${fullQty} full cylinders (only ${maxFull} available)`);
        }
        
        // Validate empty cylinders
        if (emptyQty > maxEmpty) {
          lineErrors.push(`${line.product_name}: Cannot transfer ${emptyQty} empty cylinders (only ${maxEmpty} available)`);
        }
        
        // Validate non-negative quantities
        if (fullQty < 0 || emptyQty < 0) {
          lineErrors.push(`${line.product_name}: Quantities cannot be negative`);
        }
      }
    });
    
    if (!hasValidTransfer) {
      errors.push('Please specify quantities to transfer for at least one product');
    }
    
    errors.push(...lineErrors);
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }, [selectedTruck, selectedWarehouse, lines]);

  // Get transfer summary for confirmation dialog
  const getTransferSummary = useCallback(() => {
    const itemsToTransfer = lines.filter(line => 
      (Number(line.qty_full) || 0) > 0 || (Number(line.qty_empty) || 0) > 0
    );
    
    const totalFull = itemsToTransfer.reduce((sum, line) => sum + (Number(line.qty_full) || 0), 0);
    const totalEmpty = itemsToTransfer.reduce((sum, line) => sum + (Number(line.qty_empty) || 0), 0);
    const totalItems = totalFull + totalEmpty;
    
    return {
      itemsToTransfer,
      totalFull,
      totalEmpty,
      totalItems,
      productCount: itemsToTransfer.length
    };
  }, [lines]);

  // Enhanced submit handler with comprehensive validation
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Run comprehensive validation
      const validation = validateForm();
      
      if (!validation.isValid) {
        // Show all validation errors
        validation.errors.forEach((error, index) => {
          setTimeout(() => {
            toast.error(error, { duration: 5000 });
          }, index * 100); // Stagger error messages
        });
        setError(validation.errors.join('; '));
        return;
      }

      // Prepare items for transfer (only items with quantities > 0)
      const items = lines
        .map(line => ({
          product_id: line.product_id,
          qty_full: Number(line.qty_full) || 0,
          qty_empty: Number(line.qty_empty) || 0,
        }))
        .filter(item => item.qty_full > 0 || item.qty_empty > 0);

      // Double-check we have items to transfer
      if (items.length === 0) {
        throw new Error('No items selected for transfer');
      }

      // Log transfer details for debugging
      const summary = getTransferSummary();
      console.log('Transfer validation passed:', {
        selectedTruck,
        selectedWarehouse,
        truckNumber: selectedTruckData?.number,
        itemCount: items.length,
        totalItems: summary.totalItems,
        summary,
        items
      });

      // Call the API
      const result = await unloadTruckMutation.mutateAsync({
        truck_id: selectedTruck,
        warehouse_id: selectedWarehouse,
        items: items,
      });
      
      console.log('Transfer completed successfully:', result);

      // Success feedback with detailed transfer summary
      const { totalFull, totalEmpty, totalItems, productCount } = summary;
      
      toast.success(
        `Successfully returned ${totalItems} cylinders (${totalFull} full, ${totalEmpty} empty) from ${productCount} product type(s)`,
        { duration: 6000 }
      );

      // Invalidate queries to refresh data
      await Promise.all([
        utils.inventory.list.invalidate(),
        utils.inventory.getByWarehouse.invalidate(),
        utils.inventory.getStats.invalidate(),
        utils.trucks.list.invalidate(),
        utils.trucks.get.invalidate()
      ]);

      // Reset form state
      setSelectedTruck('');
      setSelectedWarehouse('');
      setLines([]);
      setFormInitialized(false);
      setShowConfirm(false);
      setError(null);

      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      console.error('Transfer error:', err);
      const errorMessage = err.message || 'Failed to complete transfer';
      setError(errorMessage);
      toast.error(errorMessage, { duration: 6000 });
    } finally {
      setLoading(false);
    }
  };

  // Enhanced confirm message with detailed summary
  const getConfirmMessage = () => {
    const summary = getTransferSummary();
    const truckName = selectedTruckData?.number || selectedTruck;
    
    return `Are you sure you want to return inventory from this truck?

Transfer Summary:
• From: Truck ${truckName}
• To: Warehouse
• ${summary.productCount} product type(s)
• ${summary.totalItems} total cylinders (${summary.totalFull} full, ${summary.totalEmpty} empty)

This action cannot be undone.`;
  };

  // Check if form is ready for submission
  const isFormReady = () => {
    const summary = getTransferSummary();
    return !loading && 
           selectedTruck && 
           selectedWarehouse && 
           summary.totalItems > 0;
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
              Truck (Source) <span className="text-red-500">*</span>
            </label>
            <SearchableTruckSelector
              value={selectedTruck}
              onChange={handleTruckChange}
              placeholder="Select a truck..."
              className="w-full"
            />
          </div>

          {/* Destination Warehouse Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Warehouse (Destination) <span className="text-red-500">*</span>
            </label>
            <SearchableWarehouseSelector
              value={selectedWarehouse}
              onChange={handleWarehouseChange}
              placeholder="Select a warehouse..."
              className="w-full"
            />
          </div>
        </div>

        {/* Truck Inventory with Inline Quantity Inputs */}
        {selectedTruck && (
          <div className="mt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Truck Inventory - Items to Return
              {selectedTruckData?.number && (
                <span className="text-sm font-normal text-gray-500 ml-2">
                  (Truck {selectedTruckData.number})
                </span>
              )}
            </h3>
            
            {truckLoading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                <span className="ml-2 text-gray-600">Loading truck inventory...</span>
              </div>
            ) : availableInventory.length === 0 ? (
              <div className="text-center py-8">
                <Package className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No Inventory Available</h3>
                <p className="mt-1 text-sm text-gray-500">This truck has no inventory to return.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {lines.map((line, index) => {
                  const hasQuantity = (Number(line.qty_full) || 0) > 0 || (Number(line.qty_empty) || 0) > 0;
                  return (
                    <div 
                      key={`${line.product_id}-${index}`} 
                      className={`flex items-center space-x-4 p-4 rounded-lg border transition-colors ${
                        hasQuantity 
                          ? 'bg-blue-50 border-blue-200' 
                          : 'bg-gray-50 border-gray-200'
                      }`}
                    >
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
                              <span className="text-xs text-gray-500 block">(max: {line.max_qty_full})</span>
                            )}
                          </label>
                          <input
                            type="number"
                            min="0"
                            max={line.max_qty_full || undefined}
                            value={line.qty_full}
                            onChange={(e) => handleQuantityChange(index, 'qty_full', e.target.value)}
                            placeholder="0"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center"
                          />
                        </div>
                        <div className="w-32">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Empty Cylinders
                            {line.max_qty_empty !== undefined && (
                              <span className="text-xs text-gray-500 block">(max: {line.max_qty_empty})</span>
                            )}
                          </label>
                          <input
                            type="number"
                            min="0"
                            max={line.max_qty_empty || undefined}
                            value={line.qty_empty}
                            onChange={(e) => handleQuantityChange(index, 'qty_empty', e.target.value)}
                            placeholder="0"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
                
                {/* Transfer Summary */}
                {(() => {
                  const summary = getTransferSummary();
                  return summary.totalItems > 0 && (
                    <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="text-sm font-medium text-blue-900">
                        Transfer Summary: {summary.totalItems} cylinders 
                        ({summary.totalFull} full, {summary.totalEmpty} empty) 
                        from {summary.productCount} product type(s)
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex justify-end space-x-3">
        <button
          type="button"
          onClick={() => {
            // Reset form
            setSelectedTruck('');
            setSelectedWarehouse('');
            setLines([]);
            setFormInitialized(false);
            setError(null);
            toast.success('Form reset successfully');
          }}
          disabled={loading}
          className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white py-2 px-4 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Reset Form
        </button>
        
        <button
          type="button"
          onClick={() => setShowConfirm(true)}
          disabled={!isFormReady()}
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
        message={getConfirmMessage()}
        confirmText={loading ? 'Returning...' : 'Return to Warehouse'}
        type="info"
        loading={loading}
      />
    </div>
  );
};