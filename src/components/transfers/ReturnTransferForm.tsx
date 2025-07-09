import React, { useState, useEffect } from 'react';
import { TruckInventory } from '../trucks/TruckInventory';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Search, Truck, Package, Plus, X, Warehouse } from 'lucide-react';
import { useWarehouseOptions } from '../../hooks/useWarehouses';
import { TruckProductSelector } from '../products/TruckProductSelector';
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
  const [searchTerm, setSearchTerm] = useState('');
  const [warehouseSearchTerm, setWarehouseSearchTerm] = useState('');
  const { data: warehouses = [] } = useWarehouseOptions();
  const [showProductSelector, setShowProductSelector] = useState(false);
  const [selectedLineIndex, setSelectedLineIndex] = useState<number | null>(null);

  // Use tRPC to get trucks, create transfer, and context for invalidation
  const { data: trucksData } = trpc.trucks.list.useQuery({ active: true });
  const trucks = trucksData?.trucks || [];
  const utils = trpc.useContext();
  
  // Use tRPC for truck unloading
  const unloadTruckMutation = trpc.trucks.unloadInventory.useMutation();

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

  const handleAddLine = () => {
    setSelectedLineIndex(lines.length);
    setShowProductSelector(true);
  };

  const handleProductSelect = (product: { id: string; name: string; sku: string; unit_of_measure: string; qty_full?: number; qty_empty?: number }) => {
    if (selectedLineIndex !== null) {
      const newLines = [...lines];
      if (selectedLineIndex < lines.length) {
        // Update existing line
        newLines[selectedLineIndex] = {
          ...newLines[selectedLineIndex],
          product_id: product.id,
          product_name: product.name,
          product_sku: product.sku,
          unit_of_measure: product.unit_of_measure,
          max_qty_full: product.qty_full,
          max_qty_empty: product.qty_empty
        };
      } else {
        // Add new line
        newLines.push({
          product_id: product.id,
          product_name: product.name,
          product_sku: product.sku,
          unit_of_measure: product.unit_of_measure,
          qty_full: '',
          qty_empty: '',
          max_qty_full: product.qty_full,
          max_qty_empty: product.qty_empty
        });
      }
      setLines(newLines);
    }
    setShowProductSelector(false);
    setSelectedLineIndex(null);
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

  const filteredTrucks = trucks.filter(truck =>
    truck.fleet_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    truck.license_plate?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredWarehouses = warehouses.filter(warehouse =>
    warehouse.name?.toLowerCase().includes(warehouseSearchTerm.toLowerCase()) ||
    warehouse.location?.toLowerCase().includes(warehouseSearchTerm.toLowerCase())
  );

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
              <Truck className="inline h-4 w-4 mr-1" />
              Select Truck (Source)
            </label>
            <p className="text-sm text-gray-500 mb-3">Choose the truck that has products to return</p>
            <div className="relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by fleet number or license plate..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              {searchTerm && (
                <div className="absolute z-10 mt-1 w-full rounded-md bg-white shadow-lg">
                  <div className="max-h-60 overflow-auto">
                    {filteredTrucks.length === 0 ? (
                      <div className="px-4 py-2 text-sm text-gray-500">No trucks found</div>
                    ) : (
                      filteredTrucks.map((truck) => (
                        <div
                          key={truck.id}
                          onClick={() => {
                            setSelectedTruck(truck.id);
                            setSearchTerm('');
                          }}
                          className="px-4 py-2 hover:bg-blue-50 cursor-pointer"
                        >
                          <div className="font-medium text-gray-900">
                            <Truck className="inline h-4 w-4 mr-1" />
                            {truck.fleet_number}
                          </div>
                          <div className="text-sm text-gray-500">
                            License: {truck.license_plate}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            {selectedTruck && (
              <div className="mt-2 p-3 bg-blue-50 rounded-md">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-900">
                      <Truck className="inline h-4 w-4 mr-1" />
                      {trucks.find(t => t.id === selectedTruck)?.fleet_number}
                    </div>
                    <div className="text-sm text-gray-500">
                      License: {trucks.find(t => t.id === selectedTruck)?.license_plate}
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedTruck('')}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Destination Warehouse Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Warehouse className="inline h-4 w-4 mr-1" />
              Select Destination Warehouse
            </label>
            <p className="text-sm text-gray-500 mb-3">Choose the warehouse to return products to</p>
            <div className="relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={warehouseSearchTerm}
                  onChange={(e) => setWarehouseSearchTerm(e.target.value)}
                  placeholder="Search by warehouse name or location..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              {warehouseSearchTerm && (
                <div className="absolute z-10 mt-1 w-full rounded-md bg-white shadow-lg">
                  <div className="max-h-60 overflow-auto">
                    {filteredWarehouses.length === 0 ? (
                      <div className="px-4 py-2 text-sm text-gray-500">No warehouses found</div>
                    ) : (
                      filteredWarehouses.map((warehouse) => (
                        <div
                          key={warehouse.id}
                          onClick={() => {
                            setSelectedWarehouse(warehouse.id);
                            setWarehouseSearchTerm('');
                          }}
                          className="px-4 py-2 hover:bg-blue-50 cursor-pointer"
                        >
                          <div className="font-medium text-gray-900">
                            <Warehouse className="inline h-4 w-4 mr-1" />
                            {warehouse.name}
                          </div>
                          {warehouse.location && (
                            <div className="text-sm text-gray-500">
                              Location: {warehouse.location}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            {selectedWarehouse && (
              <div className="mt-2 p-3 bg-green-50 rounded-md">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-900">
                      <Warehouse className="inline h-4 w-4 mr-1" />
                      {warehouses.find(w => w.id === selectedWarehouse)?.name}
                    </div>
                    {warehouses.find(w => w.id === selectedWarehouse)?.location && (
                      <div className="text-sm text-gray-500">
                        Location: {warehouses.find(w => w.id === selectedWarehouse)?.location}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => setSelectedWarehouse('')}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Truck Inventory Display */}
        {selectedTruck && (
          <div className="mt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Truck Inventory</h3>
            <TruckInventory truckId={selectedTruck} />
          </div>
        )}

        <div className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Transfer Lines</h3>
            <button
              type="button"
              onClick={handleAddLine}
              className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>Add Product</span>
            </button>
          </div>

          <div className="space-y-4">
            {lines.map((line, index) => (
              <div key={index} className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{line.product_name}</div>
                  <div className="text-sm text-gray-500">SKU: {line.product_sku}</div>
                </div>
                <div className="flex space-x-4">
                  <div className="w-32">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Full Cylinders</label>
                    <input
                      type="number"
                      min="0"
                      value={line.qty_full}
                      onChange={(e) => {
                        const newLines = [...lines];
                        newLines[index].qty_full = e.target.value === '' ? '' : parseInt(e.target.value);
                        setLines(newLines);
                      }}
                      placeholder="Quantity"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div className="w-32">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Empty Cylinders</label>
                    <input
                      type="number"
                      min="0"
                      value={line.qty_empty}
                      onChange={(e) => {
                        const newLines = [...lines];
                        newLines[index].qty_empty = e.target.value === '' ? '' : parseInt(e.target.value);
                        setLines(newLines);
                      }}
                      placeholder="Quantity"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const newLines = [...lines];
                    newLines.splice(index, 1);
                    setLines(newLines);
                  }}
                  className="text-red-600 hover:text-red-800"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowConfirm(true)}
          disabled={loading || !selectedTruck || !selectedWarehouse || lines.length === 0}
          className="inline-flex justify-center rounded-md border border-transparent bg-blue-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Unload Truck
        </button>
      </div>

      <ConfirmDialog
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleSubmit}
        title="Confirm Truck Unloading"
        message="Are you sure you want to unload this truck? This will move inventory from the selected truck back to the warehouse."
        confirmText="Unload Truck"
        type="info"
        loading={loading}
      />

      {selectedTruck && (
        <TruckProductSelector
          isOpen={showProductSelector}
          onClose={() => {
            setShowProductSelector(false);
            setSelectedLineIndex(null);
          }}
          onSelect={handleProductSelect}
          truckId={selectedTruck}
          selectedProductIds={lines.map(line => line.product_id)}
        />
      )}
    </div>
  );
}; 