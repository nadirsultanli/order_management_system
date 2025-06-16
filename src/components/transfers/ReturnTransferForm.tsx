import React, { useState, useEffect } from 'react';
import { createReturnTransfer, getAvailableTrucks, getTruckInventory } from '../../lib/transfers';
import { ConfirmDialog } from '../ui/ConfirmDialog';

interface ReturnTransferFormProps {
  onSuccess?: () => void;
}

export const ReturnTransferForm: React.FC<ReturnTransferFormProps> = ({ onSuccess }) => {
  const [trucks, setTrucks] = useState<any[]>([]);
  const [selectedTruck, setSelectedTruck] = useState<string>('');
  const [inventory, setInventory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTrucks();
  }, []);

  useEffect(() => {
    if (selectedTruck) {
      loadTruckInventory();
    } else {
      setInventory([]);
    }
  }, [selectedTruck]);

  const loadTrucks = async () => {
    try {
      const data = await getAvailableTrucks();
      setTrucks(data);
    } catch (err) {
      setError('Failed to load trucks');
      console.error(err);
    }
  };

  const loadTruckInventory = async () => {
    try {
      const data = await getTruckInventory(selectedTruck);
      setInventory(data);
    } catch (err) {
      setError('Failed to load truck inventory');
      console.error(err);
    }
  };

  const handleSubmit = async () => {
    if (!selectedTruck) {
      setError('Please select a truck');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await createReturnTransfer(selectedTruck);
      setShowConfirm(false);
      if (onSuccess) onSuccess();
      // Reset form
      setSelectedTruck('');
      setInventory([]);
    } catch (err) {
      setError('Failed to create return transfer');
      console.error(err);
    } finally {
      setLoading(false);
    }
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

      {selectedTruck && (
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">Current Inventory</h3>
          {inventory.length === 0 ? (
            <p className="text-sm text-gray-500">No inventory found for this truck</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-300">
                <thead>
                  <tr>
                    <th className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900">Product</th>
                    <th className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900">Full</th>
                    <th className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900">Empty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {inventory.map((item) => (
                    <tr key={item.id}>
                      <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900">
                        {item.product.name}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-right text-gray-500">
                        {item.qty_full}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-right text-gray-500">
                        {item.qty_empty}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowConfirm(true)}
          disabled={loading || !selectedTruck || inventory.length === 0}
          className="inline-flex justify-center rounded-md border border-transparent bg-blue-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Create Return Transfer
        </button>
      </div>

      <ConfirmDialog
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleSubmit}
        title="Confirm Return Transfer"
        message="Are you sure you want to create this return transfer? This will move all inventory from the truck back to the depot."
        confirmText="Create Return Transfer"
        type="info"
        loading={loading}
      />
    </div>
  );
}; 