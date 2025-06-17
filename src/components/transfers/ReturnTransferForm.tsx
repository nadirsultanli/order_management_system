import React, { useState, useEffect } from 'react';
import { createReturnTransfer, getAvailableTrucks, TransferLine } from '../../lib/transfers';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Search, Truck, Package, Plus, X, Warehouse } from 'lucide-react';
import { useWarehouseOptions } from '../../hooks/useWarehouses';
import { ProductSelector } from '../products/ProductSelector';

interface ReturnTransferFormProps {
  onSuccess?: () => void;
}

export const ReturnTransferForm: React.FC<ReturnTransferFormProps> = ({ onSuccess }) => {
  const [trucks, setTrucks] = useState<any[]>([]);
  const [selectedTruck, setSelectedTruck] = useState<string>('');
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('');
  const [lines, setLines] = useState<TransferLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const { data: warehouses = [] } = useWarehouseOptions();
  const [showProductSelector, setShowProductSelector] = useState(false);
  const [selectedLineIndex, setSelectedLineIndex] = useState<number | null>(null);

  useEffect(() => {
    loadTrucks();
  }, []);

  const loadTrucks = async () => {
    try {
      const data = await getAvailableTrucks();
      setTrucks(data);
    } catch (err) {
      setError('Failed to load trucks');
      console.error(err);
    }
  };

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
        throw new Error('Please select a warehouse');
      }
      if (lines.length === 0) {
        throw new Error('Please add at least one product');
      }

      // Validate quantities
      const invalidLines = lines.filter(line => !line.qty_full || line.qty_full <= 0);
      if (invalidLines.length > 0) {
        throw new Error('Please enter valid quantities for all products');
      }

      // Prepare the data
      const transferData = {
        truck_id: selectedTruck,
        warehouse_id: selectedWarehouse,
        lines: lines.map(line => ({
          product_id: line.product_id,
          qty_full: line.qty_full
        }))
      };

      console.log('Creating transfer with data:', transferData);

      const transferId = await createReturnTransfer(transferData);
      console.log('Transfer created successfully:', transferId);

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
      setError(err.message || 'Failed to create transfer');
    } finally {
      setLoading(false);
    }
  };

  const handleAddLine = () => {
    setSelectedLineIndex(lines.length);
    setShowProductSelector(true);
  };

  const handleProductSelect = (product: { id: string; name: string; sku: string; unit_of_measure: string }) => {
    if (selectedLineIndex !== null) {
      const newLines = [...lines];
      if (selectedLineIndex < lines.length) {
        // Update existing line
        newLines[selectedLineIndex] = {
          ...newLines[selectedLineIndex],
          product_id: product.id,
          product_name: product.name,
          product_sku: product.sku,
          unit_of_measure: product.unit_of_measure
        };
      } else {
        // Add new line
        newLines.push({
          product_id: product.id,
          product_name: product.name,
          product_sku: product.sku,
          unit_of_measure: product.unit_of_measure,
          qty_full: ''
        });
      }
      setLines(newLines);
    }
    setShowProductSelector(false);
    setSelectedLineIndex(null);
  };

  const filteredTrucks = trucks.filter(truck =>
    truck.fleet_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    truck.license_plate.toLowerCase().includes(searchTerm.toLowerCase())
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
          {/* Truck Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Truck
            </label>
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

          {/* Warehouse Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Destination Warehouse
            </label>
            <div className="relative">
              <select
                value={selectedWarehouse}
                onChange={(e) => setSelectedWarehouse(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select a warehouse...</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </option>
                ))}
              </select>
              <Warehouse className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            </div>
          </div>
        </div>

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
                <div className="w-32">
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
          Create Transfer
        </button>
      </div>

      <ConfirmDialog
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleSubmit}
        title="Confirm Transfer"
        message="Are you sure you want to create this transfer? This will move inventory from the truck to the warehouse."
        confirmText="Create Transfer"
        type="info"
        loading={loading}
      />

      <ProductSelector
        isOpen={showProductSelector}
        onClose={() => {
          setShowProductSelector(false);
          setSelectedLineIndex(null);
        }}
        onSelect={handleProductSelect}
      />
    </div>
  );
}; 