import React, { useState, useEffect } from 'react';
import { createLoadTransfer, getAvailableTrucks, TransferLine } from '../../lib/transfers';
import { ConfirmDialog } from '../ui/ConfirmDialog';

interface LoadTransferFormProps {
  onSuccess?: () => void;
}

export const LoadTransferForm: React.FC<LoadTransferFormProps> = ({ onSuccess }) => {
  const [trucks, setTrucks] = useState<any[]>([]);
  const [selectedTruck, setSelectedTruck] = useState<string>('');
  const [lines, setLines] = useState<TransferLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const handleSubmit = async () => {
    if (!selectedTruck || lines.length === 0) {
      setError('Please select a truck and add at least one product');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await createLoadTransfer(selectedTruck, lines);
      setShowConfirm(false);
      if (onSuccess) onSuccess();
      // Reset form
      setSelectedTruck('');
      setLines([]);
    } catch (err) {
      setError('Failed to create transfer');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const addLine = () => {
    setLines([...lines, { product_id: '', qty_full: 0 }]);
  };

  const updateLine = (index: number, field: keyof TransferLine, value: string | number) => {
    const newLines = [...lines];
    newLines[index] = { ...newLines[index], [field]: value };
    setLines(newLines);
  };

  const removeLine = (index: number) => {
    setLines(lines.filter((_, i) => i !== index));
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

      <div>
        <label htmlFor="truck" className="block text-sm font-medium text-gray-700">
          Select Truck
        </label>
        <select
          id="truck"
          value={selectedTruck}
          onChange={(e) => setSelectedTruck(e.target.value)}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
        >
          <option value="">Select a truck</option>
          {trucks.map((truck) => (
            <option key={truck.id} value={truck.id}>
              {truck.fleet_number} - {truck.license_plate}
            </option>
          ))}
        </select>
      </div>

      <div>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900">Transfer Lines</h3>
          <button
            type="button"
            onClick={addLine}
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Add Product
          </button>
        </div>

        <div className="space-y-4">
          {lines.map((line, index) => (
            <div key={index} className="flex items-center space-x-4">
              <div className="flex-1">
                <input
                  type="text"
                  value={line.product_id}
                  onChange={(e) => updateLine(index, 'product_id', e.target.value)}
                  placeholder="Product ID"
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
              </div>
              <div className="w-32">
                <input
                  type="number"
                  value={line.qty_full}
                  onChange={(e) => updateLine(index, 'qty_full', parseInt(e.target.value))}
                  placeholder="Quantity"
                  min="0"
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
              </div>
              <button
                type="button"
                onClick={() => removeLine(index)}
                className="inline-flex items-center p-2 border border-transparent rounded-full text-red-600 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowConfirm(true)}
          disabled={loading || !selectedTruck || lines.length === 0}
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
        message="Are you sure you want to create this transfer? This will move inventory from the depot to the truck."
        confirmText="Create Transfer"
        type="info"
        loading={loading}
      />
    </div>
  );
}; 