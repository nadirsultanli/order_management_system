import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { X, Loader2, ArrowRight } from 'lucide-react';
import { InventoryBalance, StockTransferData } from '../../types/inventory';
import { WarehouseSelector } from '../warehouses/WarehouseSelector';

interface StockTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: StockTransferData) => void;
  inventory: InventoryBalance;
  loading?: boolean;
}

export const StockTransferModal: React.FC<StockTransferModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  inventory,
  loading = false,
}) => {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<StockTransferData>({
    defaultValues: {
      from_warehouse_id: inventory.warehouse_id,
      to_warehouse_id: '',
      product_id: inventory.product_id,
      qty_full: 0,
      qty_empty: 0,
      notes: '',
    },
  });

  const qtyFull = watch('qty_full') || 0;
  const qtyEmpty = watch('qty_empty') || 0;
  const toWarehouseId = watch('to_warehouse_id');

  useEffect(() => {
    if (inventory) {
      reset({
        from_warehouse_id: inventory.warehouse_id,
        to_warehouse_id: '',
        product_id: inventory.product_id,
        qty_full: 0,
        qty_empty: 0,
        notes: '',
      });
    }
  }, [inventory, reset]);

  const handleFormSubmit = (data: StockTransferData) => {
    // Ensure we have the warehouse ID from the selector
    const formData = {
      ...data,
      to_warehouse_id: toWarehouseId,
    };
    
    // Validation
    if (!formData.to_warehouse_id) {
      console.error('No destination warehouse selected');
      return;
    }
    
    if (formData.qty_full <= 0 && formData.qty_empty <= 0) {
      console.error('Must transfer at least one cylinder');
      return;
    }
    
    console.log('Submitting transfer data:', formData);
    onSubmit(formData);
  };

  const handleWarehouseChange = (warehouseId: string) => {
    setValue('to_warehouse_id', warehouseId);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose} />
        
        <div className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-2xl">
          <form onSubmit={handleSubmit(handleFormSubmit)}>
            <div className="bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold leading-6 text-gray-900">
                  Transfer Stock
                </h3>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-6">
                {/* Product Information */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Product Information</h4>
                  <div className="text-sm text-gray-600">
                    <div><span className="font-medium">Product:</span> {inventory.product?.name}</div>
                    <div><span className="font-medium">SKU:</span> {inventory.product?.sku}</div>
                  </div>
                </div>

                {/* Transfer Direction */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                  <div className="bg-blue-50 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-blue-900 mb-2">From Warehouse</h4>
                    <div className="text-sm text-blue-800 font-medium">
                      {inventory.warehouse?.name}
                    </div>
                    <div className="mt-2 space-y-1 text-xs text-blue-700">
                      <div>Full: {inventory.qty_full}</div>
                      <div>Empty: {inventory.qty_empty}</div>
                    </div>
                  </div>

                  <div className="flex justify-center">
                    <ArrowRight className="h-6 w-6 text-gray-400" />
                  </div>

                  <div className="bg-green-50 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-green-900 mb-2">To Warehouse</h4>
                    <WarehouseSelector
                      value={toWarehouseId}
                      onChange={handleWarehouseChange}
                      placeholder="Select destination..."
                      className="w-full"
                      required
                    />
                    {errors.to_warehouse_id && (
                      <p className="mt-1 text-xs text-red-600">Destination warehouse is required</p>
                    )}
                  </div>
                </div>

                {/* Transfer Quantities */}
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-4">Transfer Quantities</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="qty_full" className="block text-sm font-medium text-gray-700">
                        Full Cylinders
                      </label>
                      <input
                        type="number"
                        min="0"
                        max={inventory.qty_full}
                        id="qty_full"
                        {...register('qty_full', {
                          valueAsNumber: true,
                          min: { value: 0, message: 'Quantity must be positive' },
                          max: { value: inventory.qty_full, message: `Cannot exceed available quantity (${inventory.qty_full})` },
                        })}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="0"
                      />
                      <div className="mt-1 text-xs text-gray-500">
                        Available: {inventory.qty_full}
                      </div>
                      {errors.qty_full && (
                        <p className="mt-1 text-sm text-red-600">{errors.qty_full.message}</p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="qty_empty" className="block text-sm font-medium text-gray-700">
                        Empty Cylinders
                      </label>
                      <input
                        type="number"
                        min="0"
                        max={inventory.qty_empty}
                        id="qty_empty"
                        {...register('qty_empty', {
                          valueAsNumber: true,
                          min: { value: 0, message: 'Quantity must be positive' },
                          max: { value: inventory.qty_empty, message: `Cannot exceed available quantity (${inventory.qty_empty})` },
                        })}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="0"
                      />
                      <div className="mt-1 text-xs text-gray-500">
                        Available: {inventory.qty_empty}
                      </div>
                      {errors.qty_empty && (
                        <p className="mt-1 text-sm text-red-600">{errors.qty_empty.message}</p>
                      )}
                    </div>
                  </div>

                  {(qtyFull > 0 || qtyEmpty > 0) && (
                    <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                      <div className="text-sm text-yellow-800">
                        <strong>Transfer Summary:</strong> {qtyFull} full + {qtyEmpty} empty cylinders
                      </div>
                    </div>
                  )}
                </div>

                {/* Transfer Notes */}
                <div>
                  <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
                    Transfer Notes
                  </label>
                  <textarea
                    id="notes"
                    rows={3}
                    {...register('notes')}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Optional notes about this transfer..."
                  />
                </div>
              </div>
            </div>

            <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
              <button
                type="submit"
                disabled={loading || !toWarehouseId || (qtyFull === 0 && qtyEmpty === 0)}
                className="inline-flex w-full justify-center rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 sm:ml-3 sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="flex items-center space-x-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Transferring...</span>
                  </div>
                ) : (
                  'Transfer Stock'
                )}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};