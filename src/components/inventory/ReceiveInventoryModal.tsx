import React, { useState } from 'react';
import { X, Package, Truck, User, FileText, AlertTriangle, CheckCircle } from 'lucide-react';
import { useForm, useFieldArray } from 'react-hook-form';
import { SearchableWarehouseSelector } from '../warehouses/SearchableWarehouseSelector';
import { SearchableProductSelector } from '../products/SearchableProductSelector';
import { CreateReceiptData } from '../../types/inventory';
import { useCreateReceipt } from '../../hooks/useInventory';
import toast from 'react-hot-toast';

interface ReceiveInventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReceiptCreated: () => void;
}

interface ReceiptFormData {
  warehouse_id: string;
  supplier_dn_number: string;
  truck_registration: string;
  driver_name: string;
  receipt_date: string;
  notes: string;
  receipt_lines: {
    product_id: string;
    qty_expected: number;
    qty_received_good: number;
    qty_received_damaged: number;
    condition_flag: 'good' | 'damaged';
    notes: string;
  }[];
}

export const ReceiveInventoryModal: React.FC<ReceiveInventoryModalProps> = ({
  isOpen,
  onClose,
  onReceiptCreated,
}) => {
  const createReceipt = useCreateReceipt();

  const { register, handleSubmit, watch, control, reset, setValue, formState: { errors } } = useForm<ReceiptFormData>({
    defaultValues: {
      warehouse_id: '',
      supplier_dn_number: '',
      truck_registration: '',
      driver_name: '',
      receipt_date: new Date().toISOString().split('T')[0],
      notes: '',
      receipt_lines: [
        {
          product_id: '',
          qty_expected: 0,
          qty_received_good: 0,
          qty_received_damaged: 0,
          condition_flag: 'good',
          notes: '',
        }
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'receipt_lines',
  });

  const handleCreateReceipt = async (data: ReceiptFormData) => {
    try {
      if (!data.warehouse_id) {
        toast.error('Please select a warehouse');
        return;
      }

      // Validate that at least one product line has a product selected
      const validLines = data.receipt_lines.filter(line => line.product_id);
      if (validLines.length === 0) {
        toast.error('Please add at least one product to receive');
        return;
      }

      console.log('Creating receipt:', data);
      
      await createReceipt.mutateAsync({
        warehouse_id: data.warehouse_id,
        supplier_dn_number: data.supplier_dn_number,
        truck_registration: data.truck_registration,
        driver_name: data.driver_name,
        receipt_date: data.receipt_date,
        notes: data.notes,
        receipt_lines: validLines,
      });
      
      onReceiptCreated();
      onClose();
      reset();
    } catch (error) {
      console.error('Failed to create receipt:', error);
      // Error handling is done in the hook
    }
  };

  const addReceiptLine = () => {
    append({
      product_id: '',
      qty_expected: 0,
      qty_received_good: 0,
      qty_received_damaged: 0,
      condition_flag: 'good',
      notes: '',
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center space-x-2">
            <Package className="h-6 w-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">Receive Inventory</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit(handleCreateReceipt)} className="p-6 space-y-6">
          {/* Receipt Header Information */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Receipt Information</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Warehouse <span className="text-red-500">*</span>
                </label>
                <SearchableWarehouseSelector
                  value={watch('warehouse_id')}
                  onChange={(warehouseId) => setValue('warehouse_id', warehouseId)}
                  placeholder="Select warehouse"
                />
                {errors.warehouse_id && (
                  <p className="text-red-500 text-sm mt-1">Warehouse is required</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Receipt Date
                </label>
                <input
                  type="date"
                  {...register('receipt_date')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Truck className="inline h-4 w-4 mr-1" />
                  Supplier DN Number
                </label>
                <input
                  type="text"
                  {...register('supplier_dn_number')}
                  placeholder="e.g., DN-12345"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Truck className="inline h-4 w-4 mr-1" />
                  Truck Registration
                </label>
                <input
                  type="text"
                  {...register('truck_registration')}
                  placeholder="e.g., ABC-123"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <User className="inline h-4 w-4 mr-1" />
                  Driver Name
                </label>
                <input
                  type="text"
                  {...register('driver_name')}
                  placeholder="Driver name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <FileText className="inline h-4 w-4 mr-1" />
                  Notes
                </label>
                <textarea
                  {...register('notes')}
                  placeholder="Additional notes"
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Receipt Lines */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Products Received</h3>
              <button
                type="button"
                onClick={addReceiptLine}
                className="bg-blue-600 text-white px-3 py-1 rounded-md hover:bg-blue-700 text-sm"
              >
                Add Product
              </button>
            </div>

            <div className="space-y-4">
              {fields.map((field, index) => (
                <div key={field.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-gray-900">Product {index + 1}</h4>
                    {fields.length > 1 && (
                      <button
                        type="button"
                        onClick={() => remove(index)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Product <span className="text-red-500">*</span>
                      </label>
                      <SearchableProductSelector
                        value={watch(`receipt_lines.${index}.product_id`)}
                        onChange={(productId) => setValue(`receipt_lines.${index}.product_id`, productId)}
                        placeholder="Select product"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Expected Quantity
                      </label>
                      <input
                        type="number"
                        min="0"
                        {...register(`receipt_lines.${index}.qty_expected`, { valueAsNumber: true })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        <CheckCircle className="inline h-4 w-4 mr-1 text-green-600" />
                        Received (Good)
                      </label>
                      <input
                        type="number"
                        min="0"
                        {...register(`receipt_lines.${index}.qty_received_good`, { valueAsNumber: true })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        <AlertTriangle className="inline h-4 w-4 mr-1 text-yellow-600" />
                        Received (Damaged)
                      </label>
                      <input
                        type="number"
                        min="0"
                        {...register(`receipt_lines.${index}.qty_received_damaged`, { valueAsNumber: true })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Condition
                      </label>
                      <select
                        {...register(`receipt_lines.${index}.condition_flag`)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="good">Good</option>
                        <option value="damaged">Damaged - Quarantine</option>
                      </select>
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Line Notes
                      </label>
                      <input
                        type="text"
                        {...register(`receipt_lines.${index}.notes`)}
                        placeholder="Notes for this product line"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-6 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createReceipt.isLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {createReceipt.isLoading ? 'Creating Receipt...' : 'Create Receipt'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};