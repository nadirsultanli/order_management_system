import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { useUpdateOrderTaxNew } from '../../hooks/useOrders';
import { Order } from '../../types/order';
import { calculateOrderTotalWithTax } from '../../utils/order';
import { formatCurrencySync } from '../../utils/pricing';
import { toast } from 'react-hot-toast';

interface OrderEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
}

export const OrderEditModal: React.FC<OrderEditModalProps> = ({
  isOpen,
  onClose,
  order,
}) => {
  const [taxPercent, setTaxPercent] = useState(0);
  const [notes, setNotes] = useState('');
  const [orderCalculations, setOrderCalculations] = useState({
    subtotal: 0,
    taxAmount: 0,
    grandTotal: 0
  });
  const [calculatingTotals, setCalculatingTotals] = useState(false);
  const updateOrderTax = useUpdateOrderTaxNew();

  useEffect(() => {
    if (order) {
      setTaxPercent(order.tax_percent || 0);
      setNotes(order.notes || '');
    }
  }, [order]);

  // Calculate totals using backend API whenever order or tax changes - NO frontend business logic
  useEffect(() => {
    const calculateTotals = async () => {
      if (!order?.order_lines || order.order_lines.length === 0) {
        setOrderCalculations({ subtotal: 0, taxAmount: 0, grandTotal: 0 });
        return;
      }

      setCalculatingTotals(true);
      try {
        const orderLines = order.order_lines.map(line => ({
          quantity: line.quantity,
          unit_price: line.unit_price,
          subtotal: line.subtotal || (line.quantity * line.unit_price)
        }));
        
        const result = await calculateOrderTotalWithTax(orderLines, taxPercent);
        setOrderCalculations(result);
      } catch (error) {
        console.error('Failed to calculate order totals:', error);
        // Keep previous values on error
      } finally {
        setCalculatingTotals(false);
      }
    };

    calculateTotals();
  }, [order, taxPercent]);

  if (!isOpen || !order) return null;

  // Extract values for backward compatibility
  const subtotal = orderCalculations.subtotal;
  const taxAmount = orderCalculations.taxAmount;
  const grandTotal = orderCalculations.grandTotal;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      await updateOrderTax.mutateAsync({
        id: order.id,
        tax_percent: taxPercent,
        tax_amount: taxAmount,
        total_amount: grandTotal,
        notes,
      });
      onClose();
    } catch (error) {
      console.error('Error updating order:', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Edit Order</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Order Summary */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Order Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Subtotal:</span>
                <span className="font-medium text-gray-900">{formatCurrencySync(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Tax ({taxPercent}%):</span>
                <span className="font-medium text-gray-900">{formatCurrencySync(taxAmount)}</span>
              </div>
              <div className="flex justify-between border-t border-gray-200 pt-2">
                <span className="font-semibold text-gray-900">Total:</span>
                <span className="font-bold text-gray-900">{formatCurrencySync(grandTotal)}</span>
              </div>
            </div>
          </div>

          {/* Tax Percentage */}
          <div>
            <label htmlFor="taxPercent" className="block text-sm font-medium text-gray-700 mb-2">
              Tax Percentage (%)
            </label>
            <input
              type="number"
              id="taxPercent"
              min="0"
              max="100"
              step="0.01"
              value={taxPercent}
              onChange={(e) => setTaxPercent(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
              Notes
            </label>
            <textarea
              id="notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Add any additional notes..."
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={async () => {
                try {
                  await updateOrderTax(order.id, taxPercent);
                  toast.success('Total amount recalculated');
                } catch (error) {
                  console.error('Error recalculating total:', error);
                  toast.error('Failed to recalculate total');
                }
              }}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              Recalculate Total
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updateOrder.isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              <Save className="h-4 w-4" />
              <span>{updateOrder.isPending ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}; 