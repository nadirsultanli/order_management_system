import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { X, Loader2, Package, TrendingUp, TrendingDown } from 'lucide-react';
import { InventoryBalance, StockAdjustmentData } from '../../types/inventory';
import { trpc } from '../../lib/trpc-client';

interface StockAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: StockAdjustmentData) => void;
  inventory: InventoryBalance;
  loading?: boolean;
}

export const StockAdjustmentModal: React.FC<StockAdjustmentModalProps> = ({
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
    formState: { errors },
  } = useForm<StockAdjustmentData>({
    defaultValues: {
      inventory_id: inventory.id,
      adjustment_type: 'physical_count',
      qty_full_change: 0,
      qty_empty_change: 0,
      reason: '',
    },
  });

  const qtyFullChange = watch('qty_full_change') || 0;
  const qtyEmptyChange = watch('qty_empty_change') || 0;

  const validateAdjustment = async (data: {
    inventory_id: string;
    qty_full_change: number;
    qty_empty_change: number;
    adjustment_type: string;
  }) => {
    try {
      const result = await (trpc as any).inventory.validateAdjustment.query({
        inventory_id: data.inventory_id,
        qty_full_change: data.qty_full_change,
        qty_empty_change: data.qty_empty_change,
        adjustment_type: data.adjustment_type as 'received_full' | 'received_empty' | 'physical_count' | 'damage_loss' | 'other',
      });
      
      if (!result.valid) {
        return result.errors[0] || 'Stock adjustment validation failed';
      }
      
      // Show warnings as info (but don't block validation)
      if (result.warnings.length > 0) {
        console.warn('Stock adjustment warnings:', result.warnings);
      }
      
      return true;
    } catch (error) {
      console.error('Stock adjustment validation error:', error);
      return 'Failed to validate stock adjustment';
    }
  };

  useEffect(() => {
    if (inventory) {
      reset({
        inventory_id: inventory.id,
        adjustment_type: 'physical_count',
        qty_full_change: 0,
        qty_empty_change: 0,
        reason: '',
      });
    }
  }, [inventory, reset]);

  const handleFormSubmit = async (data: StockAdjustmentData) => {
    try {
      // Attempt backend validation; ignore if not available
      try {
        const adjustmentValidation = await validateAdjustment({
          inventory_id: data.inventory_id,
          qty_full_change: data.qty_full_change,
          qty_empty_change: data.qty_empty_change,
          adjustment_type: data.adjustment_type,
        });
        if (adjustmentValidation !== true) {
          return;
        }
      } catch (e) {
        console.warn('Validation service unavailable, proceeding without remote validation');
      }

      onSubmit(data);
    } catch (error) {
      console.error('Form validation error:', error);
    }
  };

  const newQtyFull = inventory.qty_full + qtyFullChange;
  const newQtyEmpty = inventory.qty_empty + qtyEmptyChange;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose} />
        
        <div className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg">
          <form onSubmit={handleSubmit(handleFormSubmit)}>
            <div className="bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold leading-6 text-gray-900">
                  Adjust Stock
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
                {/* Current Stock Display */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-3">Current Stock Levels</h4>
                  
                  {/* On Hand Stock */}
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{inventory.qty_full}</div>
                      <div className="text-sm text-gray-600">On Hand (Full)</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-600">{inventory.qty_empty}</div>
                      <div className="text-sm text-gray-600">On Hand (Empty)</div>
                    </div>
                  </div>

                  {/* Other Stock Statuses */}
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div className="text-center p-2 bg-blue-50 rounded">
                      <div className="font-semibold text-blue-600">{inventory.qty_reserved}</div>
                      <div className="text-blue-600">Allocated</div>
                    </div>
                    <div className="text-center p-2 bg-yellow-50 rounded">
                      <div className="font-semibold text-yellow-600">{inventory.qty_quarantine || 0}</div>
                      <div className="text-yellow-600">Quarantine</div>
                    </div>
                    <div className="text-center p-2 bg-purple-50 rounded">
                      <div className="font-semibold text-purple-600">{inventory.qty_in_transit || 0}</div>
                      <div className="text-purple-600">In Transit</div>
                    </div>
                  </div>

                  {/* Available Stock */}
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <div className="text-center">
                      <div className="text-lg font-bold text-gray-900">
                        {inventory.qty_full - inventory.qty_reserved}
                      </div>
                      <div className="text-sm text-gray-600">Available for Sale</div>
                    </div>
                  </div>
                  {/* Product Info */}
                  <div className="mt-3 pt-3 border-t border-gray-200 text-center">
                    <div className="text-sm text-gray-600">
                      Product: <span className="font-medium">{inventory.product?.name}</span>
                    </div>
                    <div className="text-sm text-gray-600">
                      Warehouse: <span className="font-medium">{inventory.warehouse?.name}</span>
                    </div>
                  </div>
                </div>

                {/* Adjustment Form */}
                <div>
                  <label htmlFor="adjustment_type" className="block text-sm font-medium text-gray-700">
                    Adjustment Type *
                  </label>
                  <select
                    id="adjustment_type"
                    {...register('adjustment_type', { required: 'Adjustment type is required' })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="received_full">Received Full Cylinders</option>
                    <option value="received_empty">Received Empty Cylinders</option>
                    <option value="physical_count">Physical Count Adjustment</option>
                    <option value="damage_loss">Damage/Loss</option>
                    <option value="other">Other</option>
                  </select>
                  {errors.adjustment_type && (
                    <p className="mt-1 text-sm text-red-600">{errors.adjustment_type.message}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="qty_full_change" className="block text-sm font-medium text-gray-700">
                      Full Cylinders Change
                    </label>
                    <input
                      type="number"
                      id="qty_full_change"
                      {...register('qty_full_change', {
                        valueAsNumber: true,
                      })}
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="0"
                    />
                    {errors.qty_full_change && (
                      <p className="mt-1 text-sm text-red-600">{errors.qty_full_change.message}</p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="qty_empty_change" className="block text-sm font-medium text-gray-700">
                      Empty Cylinders Change
                    </label>
                    <input
                      type="number"
                      id="qty_empty_change"
                      {...register('qty_empty_change', {
                        valueAsNumber: true,
                      })}
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="0"
                    />
                    {errors.qty_empty_change && (
                      <p className="mt-1 text-sm text-red-600">{errors.qty_empty_change.message}</p>
                    )}
                  </div>
                </div>

                {/* Resulting Quantities */}
                {(qtyFullChange !== 0 || qtyEmptyChange !== 0) && (
                  <div className="bg-blue-50 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-blue-900 mb-3">Resulting Stock Levels</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center">
                        <div className="flex items-center justify-center space-x-2">
                          <span className="text-2xl font-bold text-blue-600">{newQtyFull}</span>
                          {qtyFullChange > 0 && <TrendingUp className="h-4 w-4 text-green-600" />}
                          {qtyFullChange < 0 && <TrendingDown className="h-4 w-4 text-red-600" />}
                        </div>
                        <div className="text-sm text-gray-600">Full Cylinders</div>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center justify-center space-x-2">
                          <span className="text-2xl font-bold text-blue-600">{newQtyEmpty}</span>
                          {qtyEmptyChange > 0 && <TrendingUp className="h-4 w-4 text-green-600" />}
                          {qtyEmptyChange < 0 && <TrendingDown className="h-4 w-4 text-red-600" />}
                        </div>
                        <div className="text-sm text-gray-600">Empty Cylinders</div>
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <label htmlFor="reason" className="block text-sm font-medium text-gray-700">
                    Reason/Notes *
                  </label>
                  <textarea
                    id="reason"
                    rows={3}
                    {...register('reason', { required: 'Reason is required' })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Explain the reason for this stock adjustment..."
                  />
                  {errors.reason && (
                    <p className="mt-1 text-sm text-red-600">{errors.reason.message}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:ml-3 sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="flex items-center space-x-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Adjusting...</span>
                  </div>
                ) : (
                  'Adjust Stock'
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