import React, { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { X, Plus, Trash2, Loader2, Calculator } from 'lucide-react';
import { useProducts } from '../../hooks/useProducts';
import { useDepositRateByCapacity, useChargeCustomerDeposit } from '../../hooks/useDeposits';
import { ChargeDepositData } from '../../types/deposits';

interface DepositChargeModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerId: string;
  customerName: string;
}

interface CylinderItem {
  product_id: string;
  product_name: string;
  capacity_l: number;
  quantity: number;
  unit_deposit: number;
  total_deposit: number;
}

export const DepositChargeModal: React.FC<DepositChargeModalProps> = ({
  isOpen,
  onClose,
  customerId,
  customerName,
}) => {
  const [selectedProducts, setSelectedProducts] = useState<CylinderItem[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [orderReference, setOrderReference] = useState('');
  const [notes, setNotes] = useState('');

  const { data: productsData } = useProducts({ search: productSearch, limit: 20 });
  const chargeDeposit = useChargeCustomerDeposit();

  const products = productsData?.products || [];

  // Calculate totals
  const totalItems = selectedProducts.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = selectedProducts.reduce((sum, item) => sum + item.total_deposit, 0);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'KES', // Default currency
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const handleAddProduct = (product: any) => {
    const existing = selectedProducts.find(p => p.product_id === product.id);
    if (existing) {
      // Increase quantity
      setSelectedProducts(prev => prev.map(p => 
        p.product_id === product.id 
          ? { ...p, quantity: p.quantity + 1, total_deposit: (p.quantity + 1) * p.unit_deposit }
          : p
      ));
    } else {
      // Add new product with default deposit rate (you'd typically fetch this)
      const newItem: CylinderItem = {
        product_id: product.id,
        product_name: product.name,
        capacity_l: product.capacity_l || 0,
        quantity: 1,
        unit_deposit: 100, // Default - would be fetched from deposit rates
        total_deposit: 100,
      };
      setSelectedProducts(prev => [...prev, newItem]);
    }
  };

  const handleRemoveProduct = (productId: string) => {
    setSelectedProducts(prev => prev.filter(p => p.product_id !== productId));
  };

  const handleQuantityChange = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      handleRemoveProduct(productId);
      return;
    }

    setSelectedProducts(prev => prev.map(p => 
      p.product_id === productId 
        ? { ...p, quantity, total_deposit: quantity * p.unit_deposit }
        : p
    ));
  };

  const handleUnitDepositChange = (productId: string, unitDeposit: number) => {
    setSelectedProducts(prev => prev.map(p => 
      p.product_id === productId 
        ? { ...p, unit_deposit: unitDeposit, total_deposit: p.quantity * unitDeposit }
        : p
    ));
  };

  const handleSubmit = async () => {
    if (selectedProducts.length === 0) {
      return;
    }

    const chargeData: ChargeDepositData = {
      customer_id: customerId,
      cylinders: selectedProducts.map(item => ({
        product_id: item.product_id,
        quantity: item.quantity,
        capacity_l: item.capacity_l,
        unit_deposit: item.unit_deposit,
      })),
      order_id: orderReference || undefined,
      notes: notes || undefined,
    };

    try {
      await chargeDeposit.mutateAsync(chargeData);
      onClose();
      // Reset form
      setSelectedProducts([]);
      setOrderReference('');
      setNotes('');
      setProductSearch('');
    } catch (error) {
      console.error('Failed to charge deposit:', error);
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
                Charge Deposit - {customerName}
              </h3>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Product Selection */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Products
                  </label>
                  <input
                    type="text"
                    placeholder="Search products..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {products.length > 0 && (
                  <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-md">
                    {products.map((product) => (
                      <button
                        key={product.id}
                        onClick={() => handleAddProduct(product)}
                        className="w-full p-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0 transition-colors"
                      >
                        <div className="font-medium text-gray-900">{product.name}</div>
                        <div className="text-sm text-gray-500">
                          {product.sku} • {product.capacity_l}L
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Order Reference (Optional)
                  </label>
                  <input
                    type="text"
                    value={orderReference}
                    onChange={(e) => setOrderReference(e.target.value)}
                    placeholder="Order ID or reference number"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Notes (Optional)
                  </label>
                  <textarea
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Additional notes about this charge..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Selected Products */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-gray-700">Selected Items</h4>
                  <div className="flex items-center space-x-2 text-sm text-gray-500">
                    <Calculator className="h-4 w-4" />
                    <span>{totalItems} items</span>
                  </div>
                </div>

                {selectedProducts.length === 0 ? (
                  <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
                    <p className="text-gray-500">No products selected</p>
                    <p className="text-sm text-gray-400">Search and click products to add them</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {selectedProducts.map((item) => (
                      <div key={item.product_id} className="bg-gray-50 p-3 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-medium text-gray-900">{item.product_name}</div>
                          <button
                            onClick={() => handleRemoveProduct(item.product_id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Quantity
                            </label>
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => handleQuantityChange(item.product_id, parseInt(e.target.value) || 0)}
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Unit Deposit
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.unit_deposit}
                              onChange={(e) => handleUnitDepositChange(item.product_id, parseFloat(e.target.value) || 0)}
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Total
                            </label>
                            <div className="px-2 py-1 text-sm bg-white border border-gray-300 rounded">
                              {formatCurrency(item.total_deposit)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Total Summary */}
                {selectedProducts.length > 0 && (
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-blue-900">Total Deposit Charge:</span>
                      <span className="text-xl font-bold text-blue-900">
                        {formatCurrency(totalAmount)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={chargeDeposit.isPending || selectedProducts.length === 0}
              className="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:ml-3 sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {chargeDeposit.isPending ? (
                <div className="flex items-center space-x-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Charging...</span>
                </div>
              ) : (
                `Charge ${formatCurrency(totalAmount)}`
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={chargeDeposit.isPending}
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