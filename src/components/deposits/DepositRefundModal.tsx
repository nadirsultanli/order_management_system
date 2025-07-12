import React, { useState, useEffect } from 'react';
import { X, Loader2, Calculator, AlertTriangle } from 'lucide-react';
import { useRefundCustomerDeposit, useCalculateDepositRefund } from '../../hooks/useDeposits';
import { RefundDepositData, CYLINDER_CONDITIONS, REFUND_METHODS } from '../../types/deposits';

interface DepositRefundModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerId: string;
  customerName: string;
  currentBalance: number;
  availableForRefund: number;
  currencyCode: string;
}

interface RefundCylinder {
  product_id: string;
  product_name: string;
  capacity_l: number;
  quantity: number;
  condition: string;
  original_deposit: number;
  calculated_refund: number;
}

export const DepositRefundModal: React.FC<DepositRefundModalProps> = ({
  isOpen,
  onClose,
  customerId,
  customerName,
  currentBalance,
  availableForRefund,
  currencyCode,
}) => {
  const [refundCylinders, setRefundCylinders] = useState<RefundCylinder[]>([]);
  const [refundMethod, setRefundMethod] = useState('cash');
  const [orderReference, setOrderReference] = useState('');
  const [notes, setNotes] = useState('');
  const [calculatedRefund, setCalculatedRefund] = useState<any>(null);

  const refundDeposit = useRefundCustomerDeposit();
  const calculateRefund = useCalculateDepositRefund();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2,
    }).format(amount);
  };

  // Calculate refund whenever cylinders or conditions change
  useEffect(() => {
    if (refundCylinders.length > 0) {
      const cylinders = refundCylinders.map(cyl => ({
        product_id: cyl.product_id,
        quantity: cyl.quantity,
        capacity_l: cyl.capacity_l,
        condition: cyl.condition,
      }));

      calculateRefund.mutate({
        customer_id: customerId,
        cylinders,
      });
    }
  }, [refundCylinders, customerId]);

  // Update calculated refund when calculation completes
  useEffect(() => {
    if (calculateRefund.data) {
      setCalculatedRefund(calculateRefund.data);
      
      // Update refund amounts in cylinders
      const updatedCylinders = refundCylinders.map(cyl => {
        const calculation = calculateRefund.data.cylinder_calculations.find(
          calc => calc.product_id === cyl.product_id
        );
        return {
          ...cyl,
          calculated_refund: calculation ? calculation.refund_amount : cyl.calculated_refund,
        };
      });
      setRefundCylinders(updatedCylinders);
    }
  }, [calculateRefund.data]);

  const handleAddCylinder = () => {
    const newCylinder: RefundCylinder = {
      product_id: '',
      product_name: '',
      capacity_l: 13, // Default size
      quantity: 1,
      condition: 'good',
      original_deposit: 100, // Default
      calculated_refund: 90, // Will be recalculated
    };
    setRefundCylinders(prev => [...prev, newCylinder]);
  };

  const handleRemoveCylinder = (index: number) => {
    setRefundCylinders(prev => prev.filter((_, i) => i !== index));
  };

  const handleCylinderChange = (index: number, field: string, value: any) => {
    setRefundCylinders(prev => prev.map((cyl, i) => 
      i === index ? { ...cyl, [field]: value } : cyl
    ));
  };

  const handleConditionChange = (index: number, condition: string) => {
    const conditionData = CYLINDER_CONDITIONS.find(c => c.value === condition);
    if (conditionData) {
      setRefundCylinders(prev => prev.map((cyl, i) => 
        i === index ? { 
          ...cyl, 
          condition,
          calculated_refund: cyl.original_deposit * (conditionData.refund_percentage / 100) * cyl.quantity
        } : cyl
      ));
    }
  };

  const totalRefundAmount = calculatedRefund?.total_refund_amount || 0;
  const totalDeductions = calculatedRefund?.deductions_summary?.total_deductions || 0;

  const handleSubmit = async () => {
    if (refundCylinders.length === 0) {
      return;
    }

    const refundData: RefundDepositData = {
      customer_id: customerId,
      cylinders: refundCylinders.map(cyl => ({
        product_id: cyl.product_id,
        quantity: cyl.quantity,
        capacity_l: cyl.capacity_l,
        condition: cyl.condition,
      })),
      refund_method: refundMethod,
      order_id: orderReference || undefined,
      notes: notes || undefined,
    };

    try {
      await refundDeposit.mutateAsync(refundData);
      onClose();
      // Reset form
      setRefundCylinders([]);
      setRefundMethod('cash');
      setOrderReference('');
      setNotes('');
      setCalculatedRefund(null);
    } catch (error) {
      console.error('Failed to process refund:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose} />
        
        <div className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-4xl">
          <div className="bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold leading-6 text-gray-900">
                Process Refund - {customerName}
              </h3>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Balance Info */}
            <div className="grid grid-cols-2 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
              <div>
                <div className="text-sm font-medium text-gray-700">Current Balance</div>
                <div className="text-lg font-bold text-gray-900">{formatCurrency(currentBalance)}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-700">Available for Refund</div>
                <div className="text-lg font-bold text-green-600">{formatCurrency(availableForRefund)}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Cylinder Selection */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-gray-700">Cylinders to Refund</h4>
                  <button
                    type="button"
                    onClick={handleAddCylinder}
                    className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Add Cylinder
                  </button>
                </div>

                {refundCylinders.length === 0 ? (
                  <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
                    <p className="text-gray-500">No cylinders selected</p>
                    <p className="text-sm text-gray-400">Click "Add Cylinder" to start</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {refundCylinders.map((cylinder, index) => (
                      <div key={index} className="bg-gray-50 p-3 rounded-lg border">
                        <div className="flex items-center justify-between mb-3">
                          <span className="font-medium text-gray-900">Cylinder {index + 1}</span>
                          <button
                            onClick={() => handleRemoveCylinder(index)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-2 mb-2">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Capacity (L)
                            </label>
                            <select
                              value={cylinder.capacity_l}
                              onChange={(e) => handleCylinderChange(index, 'capacity_l', Number(e.target.value))}
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                            >
                              <option value={5}>5L</option>
                              <option value={9}>9L</option>
                              <option value={13}>13L</option>
                              <option value={19}>19L</option>
                              <option value={47.5}>47.5L</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Quantity
                            </label>
                            <input
                              type="number"
                              min="1"
                              value={cylinder.quantity}
                              onChange={(e) => handleCylinderChange(index, 'quantity', parseInt(e.target.value) || 1)}
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Condition
                            </label>
                            <select
                              value={cylinder.condition}
                              onChange={(e) => handleConditionChange(index, e.target.value)}
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                            >
                              {CYLINDER_CONDITIONS.map(condition => (
                                <option key={condition.value} value={condition.value}>
                                  {condition.label} ({condition.refund_percentage}%)
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Original Deposit
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={cylinder.original_deposit}
                              onChange={(e) => handleCylinderChange(index, 'original_deposit', parseFloat(e.target.value) || 0)}
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                            />
                          </div>
                        </div>

                        <div className="mt-2 p-2 bg-white rounded border">
                          <div className="text-xs text-gray-600">Calculated Refund:</div>
                          <div className="font-medium text-green-600">
                            {formatCurrency(cylinder.calculated_refund)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Refund Method *
                    </label>
                    <select
                      value={refundMethod}
                      onChange={(e) => setRefundMethod(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    >
                      {REFUND_METHODS.map(method => (
                        <option key={method.value} value={method.value}>
                          {method.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Order Reference (Optional)
                    </label>
                    <input
                      type="text"
                      value={orderReference}
                      onChange={(e) => setOrderReference(e.target.value)}
                      placeholder="Order ID or reference number"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Notes (Optional)
                    </label>
                    <textarea
                      rows={3}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Additional notes about this refund..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Refund Calculation */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-gray-700">Refund Calculation</h4>

                {calculateRefund.isPending ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="flex items-center space-x-2">
                      <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                      <span className="text-gray-600">Calculating refund...</span>
                    </div>
                  </div>
                ) : calculatedRefund ? (
                  <div className="space-y-4">
                    {/* Eligibility Check */}
                    {!calculatedRefund.eligibility?.is_eligible && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                        <div className="flex items-center space-x-2">
                          <AlertTriangle className="h-4 w-4 text-red-600" />
                          <span className="text-sm font-medium text-red-800">Refund Issues</span>
                        </div>
                        <ul className="mt-2 text-sm text-red-700 list-disc list-inside">
                          {calculatedRefund.eligibility?.reasons.map((reason: string, index: number) => (
                            <li key={index}>{reason}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Cylinder Breakdown */}
                    {calculatedRefund.cylinder_calculations && (
                      <div className="space-y-2">
                        <h5 className="text-sm font-medium text-gray-700">Breakdown by Cylinder</h5>
                        {calculatedRefund.cylinder_calculations.map((calc: any, index: number) => (
                          <div key={index} className="p-3 bg-gray-50 rounded border">
                            <div className="flex justify-between items-center mb-2">
                              <span className="font-medium">{calc.quantity}x {calc.capacity_l}L</span>
                              <span className="font-medium text-green-600">
                                {formatCurrency(calc.refund_amount)}
                              </span>
                            </div>
                            <div className="text-xs text-gray-600 space-y-1">
                              <div>Original: {formatCurrency(calc.original_deposit)}</div>
                              <div>Condition: {calc.condition} ({calc.refund_percentage}%)</div>
                              {calc.damage_deduction > 0 && (
                                <div>Damage deduction: -{formatCurrency(calc.damage_deduction)}</div>
                              )}
                              {calc.depreciation_deduction > 0 && (
                                <div>Depreciation: -{formatCurrency(calc.depreciation_deduction)}</div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Deductions Summary */}
                    {calculatedRefund.deductions_summary && totalDeductions > 0 && (
                      <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                        <h5 className="text-sm font-medium text-yellow-800 mb-2">Deductions</h5>
                        <div className="text-sm text-yellow-700 space-y-1">
                          <div>Damage: {formatCurrency(calculatedRefund.deductions_summary.damage_deductions)}</div>
                          <div>Depreciation: {formatCurrency(calculatedRefund.deductions_summary.depreciation_deductions)}</div>
                          <div className="font-medium border-t border-yellow-300 pt-1">
                            Total Deductions: {formatCurrency(totalDeductions)}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Total Refund */}
                    <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-green-900">Total Refund Amount:</span>
                        <span className="text-xl font-bold text-green-900">
                          {formatCurrency(totalRefundAmount)}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : refundCylinders.length > 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    Fill in cylinder details to calculate refund
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    Add cylinders to see refund calculation
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={
                refundDeposit.isPending || 
                refundCylinders.length === 0 || 
                !calculatedRefund?.eligibility?.is_eligible ||
                totalRefundAmount <= 0
              }
              className="inline-flex w-full justify-center rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 sm:ml-3 sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {refundDeposit.isPending ? (
                <div className="flex items-center space-x-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Processing...</span>
                </div>
              ) : (
                `Process Refund ${formatCurrency(totalRefundAmount)}`
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={refundDeposit.isPending}
              className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};