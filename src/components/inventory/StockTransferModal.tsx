import React, { useEffect, useState } from 'react';
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
  const [validationErrors, setValidationErrors] = useState<{
    qty_full?: string;
    qty_empty?: string;
  }>({});

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
      setValidationErrors({});
    }
  }, [inventory, reset]);

  // Real-time validation
  useEffect(() => {
    const newErrors: { qty_full?: string; qty_empty?: string } = {};
    
    if (qtyFull > inventory.qty_full) {
      newErrors.qty_full = `Cannot exceed available stock (${inventory.qty_full})`;
    }
    
    if (qtyEmpty > inventory.qty_empty) {
      newErrors.qty_empty = `Cannot exceed available stock (${inventory.qty_empty})`;
    }

    setValidationErrors(newErrors);
  }, [qtyFull, qtyEmpty, inventory.qty_full, inventory.qty_empty]);

  const handleFormSubmit = (data: StockTransferData) => {
    // Final validation
    if (!toWarehouseId) {
      return;
    }
    
    if (data.qty_full <= 0 && data.qty_empty <= 0) {
      return;
    }

    if (data.qty_full > inventory.qty_full || data.qty_empty > inventory.qty_empty) {
      return;
    }
    
    const formData = {
      ...data,
      to_warehouse_id: toWarehouseId,
    };
    
    onSubmit(formData);
  };

  const handleWarehouseChange = (warehouseId: string) => {
    setValue('to_warehouse_id', warehouseId);
  };

  const isTransferValid = () => {
    return (
      toWarehouseId &&
      (qtyFull > 0 || qtyEmpty > 0) &&
      qtyFull <= inventory.qty_full &&
      qtyEmpty <= inventory.qty_empty &&
      !validationErrors.qty_full &&
      !validationErrors.qty_empty
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose} />
        
        <div className="relative transform overflow-hidden rounded-lg bg-white shadow-xl transition-all w-full max-w-3xl max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleSubmit(handleFormSubmit)}>
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 bg-white sticky top-0 z-10">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  Transfer Stock
                </h3>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-md p-2 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="px-6 py-6 space-y-8">
              {/* Product Information */}
              <div className="text-center">
                <div className="bg-gray-50 rounded-xl p-6 inline-block">
                  <h4 className="text-lg font-semibold text-gray-900 mb-2">Product Information</h4>
                  <div className="space-y-1">
                    <div className="text-gray-700">
                      <span className="font-medium">Product:</span> {inventory.product?.name}
                    </div>
                    <div className="text-gray-700">
                      <span className="font-medium">SKU:</span> {inventory.product?.sku}
                    </div>
                  </div>
                </div>
              </div>

              {/* Transfer Direction - Equal sized sections */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
                {/* Source Warehouse */}
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h4 className="text-md font-semibold text-gray-900 mb-4 text-center">From Warehouse</h4>
                  <div className="text-center">
                    <div className="text-base font-bold text-blue-800 mb-4">
                      {inventory.warehouse?.name}
                    </div>
                    <div className="space-y-3">
                      <div className="bg-white rounded-lg p-3">
                        <div className="text-sm font-medium text-gray-700">Full Cylinders</div>
                        <div className={`text-lg font-bold ${inventory.qty_full === 0 ? 'text-red-600' : 'text-blue-600'}`}>
                          {inventory.qty_full}
                        </div>
                      </div>
                      <div className="bg-white rounded-lg p-3">
                        <div className="text-sm font-medium text-gray-700">Empty Cylinders</div>
                        <div className={`text-lg font-bold ${inventory.qty_empty === 0 ? 'text-red-600' : 'text-blue-600'}`}>
                          {inventory.qty_empty}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Arrow */}
                <div className="flex justify-center">
                  <div className="bg-gray-100 rounded-full p-4">
                    <ArrowRight className="h-8 w-8 text-gray-600" />
                  </div>
                </div>

                {/* Destination Warehouse */}
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h4 className="text-md font-semibold text-gray-900 mb-4 text-center">To Warehouse</h4>
                  <div className="space-y-4">
                    <WarehouseSelector
                      value={toWarehouseId}
                      onChange={handleWarehouseChange}
                      placeholder="Select destination warehouse..."
                      className="w-full text-center"
                      required
                    />
                    {!toWarehouseId && (
                      <p className="text-sm text-red-600 text-center">Please select destination warehouse</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Transfer Quantities */}
              <div className="bg-gray-50 rounded-xl p-6">
                <h4 className="text-lg font-semibold text-gray-900 mb-6 text-center">Transfer Quantities</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Full Cylinders */}
                  <div className="space-y-3">
                    <label htmlFor="qty_full" className="block text-sm font-bold text-gray-700 text-center">
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
                      className={`block w-full rounded-lg border-2 px-4 py-3 text-center text-lg font-semibold shadow-sm focus:outline-none focus:ring-2 ${
                        validationErrors.qty_full || qtyFull > inventory.qty_full
                          ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                          : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                      }`}
                      placeholder="0"
                    />
                    <div className="text-center">
                      <span className="text-sm font-medium text-gray-600">Available: </span>
                      <span className={`text-sm font-bold ${inventory.qty_full === 0 ? 'text-red-600' : 'text-gray-900'}`}>
                        {inventory.qty_full}
                      </span>
                    </div>
                    {validationErrors.qty_full && (
                      <p className="text-sm text-red-600 text-center font-medium">{validationErrors.qty_full}</p>
                    )}
                  </div>

                  {/* Empty Cylinders */}
                  <div className="space-y-3">
                    <label htmlFor="qty_empty" className="block text-sm font-bold text-gray-700 text-center">
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
                      className={`block w-full rounded-lg border-2 px-4 py-3 text-center text-lg font-semibold shadow-sm focus:outline-none focus:ring-2 ${
                        validationErrors.qty_empty || qtyEmpty > inventory.qty_empty
                          ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                          : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                      }`}
                      placeholder="0"
                    />
                    <div className="text-center">
                      <span className="text-sm font-medium text-gray-600">Available: </span>
                      <span className={`text-sm font-bold ${inventory.qty_empty === 0 ? 'text-red-600' : 'text-gray-900'}`}>
                        {inventory.qty_empty}
                      </span>
                    </div>
                    {validationErrors.qty_empty && (
                      <p className="text-sm text-red-600 text-center font-medium">{validationErrors.qty_empty}</p>
                    )}
                  </div>
                </div>

                {/* Transfer Summary */}
                {(qtyFull > 0 || qtyEmpty > 0) && isTransferValid() && (
                  <div className="mt-6 p-4 bg-green-100 border border-green-300 rounded-lg">
                    <div className="text-center">
                      <div className="text-sm font-medium text-green-800">Transfer Summary</div>
                      <div className="text-lg font-bold text-green-900">
                        {qtyFull} Full + {qtyEmpty} Empty Cylinders
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Transfer Notes */}
              <div>
                <label htmlFor="notes" className="block text-sm font-bold text-gray-700 mb-3 text-center">
                  Transfer Notes (Optional)
                </label>
                <textarea
                  id="notes"
                  rows={3}
                  {...register('notes')}
                  className="block w-full rounded-lg border-2 border-gray-300 px-4 py-3 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Add any notes about this transfer..."
                />
              </div>
            </div>

            {/* Footer */}
            <div className="bg-gray-50 px-6 py-4 flex flex-col sm:flex-row-reverse sm:space-x-reverse sm:space-x-3 space-y-3 sm:space-y-0">
              <button
                type="submit"
                disabled={loading || !isTransferValid()}
                className={`inline-flex items-center w-full justify-center rounded-md px-6 py-2 text-sm font-semibold shadow-sm sm:w-auto transition-colors focus:outline-none focus:ring-2 ${
                  loading || !isTransferValid()
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500'
                }`}
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
                className="inline-flex w-full justify-center rounded-lg bg-white px-6 py-3 text-sm font-bold text-gray-900 shadow-sm ring-2 ring-inset ring-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed transition-all"
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