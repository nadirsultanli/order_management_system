import React, { useState, useEffect } from 'react';
import { 
  ArrowLeftRight, 
  Calendar, 
  Save, 
  Send, 
  AlertTriangle,
  Building2
} from 'lucide-react';
import { ProductSelectionGrid } from './ProductSelectionGrid';
import { TransferSummary } from './TransferSummary';
import { WarehouseSelector } from '../warehouses/WarehouseSelector';
import { 
  useTransferForm, 
  useMultiSkuTransfers, 
  useWarehouseStock 
} from '../../hooks/useMultiSkuTransfers';
import { useWarehouses } from '../../hooks/useWarehouses';
import { 
  TransferFormData, 
  CreateMultiSkuTransferRequest,
  TransferPriority
} from '../../types/transfer';
import { Product, WarehouseStockInfo } from '../../types';
import { generateTransferReference } from '../../utils/transfer-validation';

interface MultiSkuTransferFormProps {
  onTransferCreated?: (transferId: string) => void;
  onCancel?: () => void;
  initialSourceWarehouseId?: string;
  initialDestinationWarehouseId?: string;
}

export const MultiSkuTransferForm: React.FC<MultiSkuTransferFormProps> = ({
  onTransferCreated,
  onCancel,
  initialSourceWarehouseId,
  initialDestinationWarehouseId
}) => {
  const [formData, setFormData] = useState<TransferFormData>({
    source_warehouse_id: initialSourceWarehouseId || '',
    destination_warehouse_id: initialDestinationWarehouseId || '',
    transfer_date: new Date().toISOString().split('T')[0],
    priority: 'normal',
    transfer_reference: '',
    reason: '',
    notes: '',
    instructions: '',
    selected_items: []
  });

  const [currentStep, setCurrentStep] = useState<'setup' | 'products' | 'review'>('setup');

  // Hooks
  const { data: warehousesData } = useWarehouses();
  const warehouses = warehousesData?.warehouses || [];
  const { createTransfer, loading: creating } = useMultiSkuTransfers();
  const { 
    selectedItems,
    validationResult,
    transferSummary,
    setWarehouseStockData,
    addItem,
    removeItem,
    validateTransfer
  } = useTransferForm();

  const { stockInfo, fetchStockInfo } = useWarehouseStock();

  // Generate transfer reference when warehouses are selected
  useEffect(() => {
    if (formData.source_warehouse_id && formData.destination_warehouse_id && !formData.transfer_reference && warehouses.length > 0) {
      const sourceWarehouse = warehouses.find(w => w.id === formData.source_warehouse_id);
      const destWarehouse = warehouses.find(w => w.id === formData.destination_warehouse_id);
      
      if (sourceWarehouse && destWarehouse) {
        const reference = generateTransferReference(
          sourceWarehouse.name.substring(0, 3).toUpperCase(),
          destWarehouse.name.substring(0, 3).toUpperCase(),
          formData.transfer_date
        );
        setFormData(prev => ({ ...prev, transfer_reference: reference }));
      }
    }
  }, [formData.source_warehouse_id, formData.destination_warehouse_id, formData.transfer_date, warehouses]);

  // Load stock data when source warehouse changes
  useEffect(() => {
    if (formData.source_warehouse_id) {
      fetchStockInfo({ warehouse_id: formData.source_warehouse_id, has_stock: true });
    }
  }, [formData.source_warehouse_id, fetchStockInfo]);

  // Update warehouse stock data when stock info changes
  useEffect(() => {
    setWarehouseStockData(stockInfo);
  }, [stockInfo, setWarehouseStockData]);

  // Validate transfer when form data or items change
  useEffect(() => {
    if (selectedItems.length > 0 && formData.source_warehouse_id && formData.destination_warehouse_id) {
      validateTransfer(
        formData.source_warehouse_id,
        formData.destination_warehouse_id,
        formData.transfer_date
      );
    }
  }, [selectedItems, formData, validateTransfer]);

  const handleFormChange = (field: keyof TransferFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleProductSelect = (product: Product, quantity: number, stockInfo: WarehouseStockInfo) => {
    addItem(product, quantity, stockInfo);
  };

  const handleRemoveItem = (productId: string, variantName?: string) => {
    removeItem(productId, variantName);
  };

  const handleNextStep = () => {
    if (currentStep === 'setup') {
      if (!formData.source_warehouse_id || !formData.destination_warehouse_id) {
        alert('Please select both source and destination warehouses');
        return;
      }
      if (formData.source_warehouse_id === formData.destination_warehouse_id) {
        alert('Source and destination warehouses must be different');
        return;
      }
      setCurrentStep('products');
    } else if (currentStep === 'products') {
      if (selectedItems.length === 0) {
        alert('Please select at least one product for transfer');
        return;
      }
      setCurrentStep('review');
    }
  };

  const handlePreviousStep = () => {
    if (currentStep === 'products') {
      setCurrentStep('setup');
    } else if (currentStep === 'review') {
      setCurrentStep('products');
    }
  };

  const handleSubmitTransfer = async () => {
    if (!validationResult?.is_valid) {
      alert('Please fix validation errors before submitting');
      return;
    }

    try {
      const transferData: CreateMultiSkuTransferRequest = {
        source_warehouse_id: formData.source_warehouse_id,
        destination_warehouse_id: formData.destination_warehouse_id,
        transfer_date: formData.transfer_date,
        items: selectedItems.map(item => ({
          product_id: item.product_id,
          product_sku: item.product_sku,
          product_name: item.product_name,
          variant_name: item.variant_name,
          quantity_to_transfer: item.quantity_to_transfer,
          unit_weight_kg: item.unit_weight_kg,
          total_weight_kg: item.total_weight_kg,
          unit_cost: item.unit_cost,
          total_cost: item.total_cost
        })),
        notes: formData.notes,
        reason: formData.reason,
        priority: formData.priority,
        transfer_reference: formData.transfer_reference
      };

      const transfer = await createTransfer(transferData);
      if (transfer && onTransferCreated) {
        onTransferCreated(transfer.id);
      }
    } catch (error) {
      console.error('Error submitting transfer:', error);
    }
  };

  const canProceedToNext = () => {
    if (currentStep === 'setup') {
      return formData.source_warehouse_id && 
             formData.destination_warehouse_id && 
             formData.source_warehouse_id !== formData.destination_warehouse_id;
    } else if (currentStep === 'products') {
      return selectedItems.length > 0;
    }
    return true;
  };

  const selectedProductIds = selectedItems.map(item => 
    `${item.product_id}-${item.variant_name || 'default'}`
  );

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header with Step Indicator */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-900">Create Multi-SKU Transfer</h1>
          
          {/* Step Indicator */}
          <div className="flex items-center space-x-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              currentStep === 'setup' ? 'bg-blue-500 text-white' : 'bg-blue-100 text-blue-600'
            }`}>
              1
            </div>
            <div className="w-8 h-1 bg-gray-200" />
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              currentStep === 'products' ? 'bg-blue-500 text-white' : 
              currentStep === 'review' ? 'bg-blue-100 text-blue-600' : 'bg-gray-200 text-gray-500'
            }`}>
              2
            </div>
            <div className="w-8 h-1 bg-gray-200" />
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              currentStep === 'review' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-500'
            }`}>
              3
            </div>
          </div>
        </div>

        <div className="flex justify-between text-sm text-gray-600">
          <span className={currentStep === 'setup' ? 'font-medium text-blue-600' : ''}>
            Setup Transfer
          </span>
          <span className={currentStep === 'products' ? 'font-medium text-blue-600' : ''}>
            Select Products
          </span>
          <span className={currentStep === 'review' ? 'font-medium text-blue-600' : ''}>
            Review & Submit
          </span>
        </div>
      </div>

      {/* Step Content */}
      {currentStep === 'setup' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Transfer Setup */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Transfer Details</h2>
            
            <div className="space-y-4">
              {/* Source Warehouse */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Building2 className="h-4 w-4 inline mr-1" />
                  Source Warehouse
                </label>
                <WarehouseSelector
                  value={formData.source_warehouse_id}
                  onChange={(value) => handleFormChange('source_warehouse_id', value)}
                  placeholder="Select source warehouse"
                />
              </div>

              {/* Destination Warehouse */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <ArrowLeftRight className="h-4 w-4 inline mr-1" />
                  Destination Warehouse
                </label>
                <WarehouseSelector
                  value={formData.destination_warehouse_id}
                  onChange={(value) => handleFormChange('destination_warehouse_id', value)}
                  placeholder="Select destination warehouse"
                  excludeIds={formData.source_warehouse_id ? [formData.source_warehouse_id] : []}
                />
              </div>

              {/* Transfer Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Calendar className="h-4 w-4 inline mr-1" />
                  Transfer Date
                </label>
                <input
                  type="date"
                  value={formData.transfer_date}
                  onChange={(e) => handleFormChange('transfer_date', e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="block w-full border border-gray-300 rounded-md py-2 px-3"
                />
              </div>

              {/* Priority */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Priority
                </label>
                <select
                  value={formData.priority}
                  onChange={(e) => handleFormChange('priority', e.target.value)}
                  className="block w-full border border-gray-300 rounded-md py-2 px-3"
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>

              {/* Reason */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reason for Transfer
                </label>
                <select
                  value={formData.reason}
                  onChange={(e) => handleFormChange('reason', e.target.value)}
                  className="block w-full border border-gray-300 rounded-md py-2 px-3"
                >
                  <option value="">Select reason</option>
                  <option value="restock">Restock</option>
                  <option value="redistribution">Redistribution</option>
                  <option value="shortage">Stock Shortage</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="optimization">Inventory Optimization</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
          </div>

          {/* Additional Information */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Additional Information</h2>
            
            <div className="space-y-4">
              {/* Transfer Reference */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Transfer Reference
                </label>
                <input
                  type="text"
                  value={formData.transfer_reference}
                  onChange={(e) => handleFormChange('transfer_reference', e.target.value)}
                  placeholder="Auto-generated"
                  className="block w-full border border-gray-300 rounded-md py-2 px-3"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => handleFormChange('notes', e.target.value)}
                  rows={4}
                  placeholder="Add any additional notes about this transfer..."
                  className="block w-full border border-gray-300 rounded-md py-2 px-3"
                />
              </div>

              {/* Special Instructions */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Special Instructions
                </label>
                <textarea
                  value={formData.instructions}
                  onChange={(e) => handleFormChange('instructions', e.target.value)}
                  rows={3}
                  placeholder="Any special handling instructions..."
                  className="block w-full border border-gray-300 rounded-md py-2 px-3"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {currentStep === 'products' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Product Selection */}
          <div>
            <ProductSelectionGrid
              warehouseId={formData.source_warehouse_id}
              onProductSelect={handleProductSelect}
              selectedProductIds={selectedProductIds}
            />
          </div>

          {/* Selected Items Summary */}
          <div>
            <TransferSummary
              summary={transferSummary}
              validationResult={validationResult}
              selectedItems={selectedItems}
              onRemoveItem={handleRemoveItem}
              showItemDetails={true}
            />
          </div>
        </div>
      )}

      {currentStep === 'review' && (
        <div className="space-y-6">
          {/* Transfer Overview */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Transfer Overview</h2>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div>
                <p className="text-sm text-gray-600">Source</p>
                <p className="font-medium">
                  {warehouses.find(w => w.id === formData.source_warehouse_id)?.name}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Destination</p>
                <p className="font-medium">
                  {warehouses.find(w => w.id === formData.destination_warehouse_id)?.name}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Transfer Date</p>
                <p className="font-medium">{formData.transfer_date}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Priority</p>
                <p className="font-medium capitalize">{formData.priority}</p>
              </div>
            </div>
          </div>

          {/* Validation Summary */}
          {validationResult && !validationResult.is_valid && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center mb-2">
                <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
                <h3 className="font-semibold text-red-800">Validation Errors</h3>
              </div>
              <ul className="text-sm text-red-700 space-y-1">
                {validationResult.errors.map((error, index) => (
                  <li key={index}>• {error}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Final Summary */}
          <TransferSummary
            summary={transferSummary}
            validationResult={validationResult}
            selectedItems={selectedItems}
            onRemoveItem={handleRemoveItem}
            showItemDetails={true}
          />
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between items-center bg-white rounded-lg border border-gray-200 p-4">
        <div>
          {currentStep !== 'setup' && (
            <button
              onClick={handlePreviousStep}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Previous
            </button>
          )}
        </div>

        <div className="flex space-x-3">
          {/* Cancel */}
          {onCancel && (
            <button
              onClick={onCancel}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
          )}

          {/* Next/Submit */}
          {currentStep !== 'review' ? (
            <button
              onClick={handleNextStep}
              disabled={!canProceedToNext()}
              className={`px-4 py-2 rounded-md font-medium ${
                canProceedToNext()
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleSubmitTransfer}
              disabled={!validationResult?.is_valid || creating}
              className={`flex items-center px-6 py-2 rounded-md font-medium ${
                validationResult?.is_valid && !creating
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              <Send className="h-4 w-4 mr-2" />
              {creating ? 'Creating...' : 'Submit Transfer'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}; 