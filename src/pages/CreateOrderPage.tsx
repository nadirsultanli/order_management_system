import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, ShoppingCart, User, MapPin, Calendar, Package, AlertTriangle } from 'lucide-react';
import { useCustomers } from '../hooks/useCustomers';
import { useAddresses } from '../hooks/useAddresses';
import { useProducts } from '../hooks/useProducts';
import { useCreateOrder, useCreateOrderLine } from '../hooks/useOrders';
import { useStockAvailability } from '../hooks/useOrders';
import { usePriceLists, usePriceListItems } from '../hooks/usePricing';
import { CreateOrderData, CreateOrderLineData } from '../types/order';
import { formatCurrency } from '../utils/order';
import { formatAddressForSelect } from '../utils/address';
import { CustomerSelector } from '../components/customers/CustomerSelector';

interface OrderLineItem {
  product_id: string;
  product_name: string;
  product_sku: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export const CreateOrderPage: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
  const [orderLines, setOrderLines] = useState<OrderLineItem[]>([]);
  const [notes, setNotes] = useState('');
  const [taxPercent, setTaxPercent] = useState(0);

  const { data: customersData } = useCustomers({ limit: 1000 });
  const { data: addresses = [] } = useAddresses(selectedCustomerId);
  const { data: productsData } = useProducts({ limit: 1000 });
  const { data: priceListsData } = usePriceLists({ limit: 1000 });
  const createOrder = useCreateOrder();
  const createOrderLine = useCreateOrderLine();

  const customers = customersData?.customers || [];
  const products = productsData?.products || [];
  const priceLists = priceListsData?.priceLists || [];
  const defaultPriceList = priceLists.find((pl: any) => pl.is_default);
  
  // Get all active product IDs for stock availability check
  const activeProductIds = products
    .filter((p: any) => p.status === 'active')
    .map((p: any) => p.id);
  
  const { data: stockAvailability = [] } = useStockAvailability(activeProductIds);
  const { data: priceListItems = [] } = usePriceListItems(defaultPriceList?.id || '');

  const selectedCustomer = customers.find((c: any) => c.id === selectedCustomerId);
  const selectedAddress = addresses.find((a: any) => a.id === selectedAddressId);

  const orderTotal = orderLines.reduce((total: number, line: OrderLineItem) => total + line.subtotal, 0);
  const taxAmount = orderTotal * (taxPercent / 100);
  const grandTotal = orderTotal + taxAmount;

  const handleCustomerChange = (customerId: string) => {
    setSelectedCustomerId(customerId);
    setSelectedAddressId(''); // Reset address when customer changes
  };

  // Auto-select primary address when customer is selected
  useEffect(() => {
    if (selectedCustomerId && addresses.length > 0 && !selectedAddressId) {
      const primaryAddress = addresses.find((a: any) => a.is_primary);
      if (primaryAddress) {
        setSelectedAddressId(primaryAddress.id);
      }
    }
  }, [selectedCustomerId, addresses, selectedAddressId]);

  const getProductPrice = (productId: string): number => {
    const priceItem = priceListItems.find((item: any) => item.product_id === productId);
    return priceItem?.unit_price || 0;
  };

  const handleAddProduct = (productId: string) => {
    const product = products.find((p: any) => p.id === productId);
    if (!product) return;

    const existingLine = orderLines.find((line: OrderLineItem) => line.product_id === productId);
    const unitPrice = getProductPrice(productId);
    
    if (existingLine) {
      // Increase quantity
      setOrderLines((lines: OrderLineItem[]) => 
        lines.map((line: OrderLineItem) => 
          line.product_id === productId 
            ? { ...line, quantity: line.quantity + 1, subtotal: (line.quantity + 1) * line.unit_price }
            : line
        )
      );
    } else {
      // Add new line
      const newLine: OrderLineItem = {
        product_id: productId,
        product_name: product.name,
        product_sku: product.sku,
        quantity: 1,
        unit_price: unitPrice,
        subtotal: unitPrice,
      };
      setOrderLines((lines: OrderLineItem[]) => [...lines, newLine]);
    }
  };

  const handleUpdateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      handleRemoveProduct(productId);
      return;
    }

    setOrderLines((lines: OrderLineItem[]) => 
      lines.map((line: OrderLineItem) => 
        line.product_id === productId 
          ? { ...line, quantity, subtotal: quantity * line.unit_price }
          : line
      )
    );
  };

  const handleRemoveProduct = (productId: string) => {
    setOrderLines((lines: OrderLineItem[]) => lines.filter((line: OrderLineItem) => line.product_id !== productId));
  };

  const handleCreateOrder = async () => {
    if (!selectedCustomerId || !selectedAddressId || orderLines.length === 0) {
      return;
    }

    try {
      // Create the order
      const orderData: CreateOrderData = {
        customer_id: selectedCustomerId,
        delivery_address_id: selectedAddressId,
        order_date: orderDate,
        status: 'draft',
        notes,
        tax_percent: taxPercent,
        tax_amount: taxAmount,
        total_amount: grandTotal,
      };

      const order = await createOrder.mutateAsync(orderData);

      // Add order lines
      for (const line of orderLines) {
        const lineData: CreateOrderLineData = {
          order_id: order.id,
          product_id: line.product_id,
          quantity: line.quantity,
          unit_price: line.unit_price,
        };
        await createOrderLine.mutateAsync({ ...lineData, skipTotalUpdate: true });
      }

      // Navigate to the created order
      navigate(`/orders/${order.id}`);
    } catch (error) {
      console.error('Error creating order:', error);
    }
  };

  const canProceedToStep2 = selectedCustomerId && selectedAddressId;
  const canCreateOrder = canProceedToStep2 && orderLines.length > 0;

  const getStockInfo = (productId: string) => {
    const stock = stockAvailability.find((s: any) => s.product_id === productId);
    console.log('Stock info for product', productId, ':', stock);
    return stock ? stock.available_quantity : 0;
  };

  const getStockStatusClass = (available: number) => {
    console.log('Stock status for quantity', available);
    if (available === 0) return "text-red-600";
    if (available <= 10) return "text-yellow-600";
    return "text-green-600";
  };

  const handleAddAddressForCustomer = () => {
    if (selectedCustomerId) {
      // Navigate to customer detail page where they can add addresses
      navigate(`/customers/${selectedCustomerId}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/orders')}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Orders</span>
          </button>
          <div className="text-gray-400">/</div>
          <h1 className="text-2xl font-bold text-gray-900">Create New Order</h1>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-8">
            <div className={`flex items-center space-x-2 ${step >= 1 ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
                1
              </div>
              <span className="font-medium">Customer & Delivery</span>
            </div>
            <div className={`w-16 h-0.5 ${step >= 2 ? 'bg-blue-600' : 'bg-gray-200'}`}></div>
            <div className={`flex items-center space-x-2 ${step >= 2 ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
                2
              </div>
              <span className="font-medium">Add Products</span>
            </div>
            <div className={`w-16 h-0.5 ${step >= 3 ? 'bg-blue-600' : 'bg-gray-200'}`}></div>
            <div className={`flex items-center space-x-2 ${step >= 3 ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 3 ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
                3
              </div>
              <span className="font-medium">Review & Create</span>
            </div>
          </div>
        </div>

        {/* Step 1: Customer & Delivery */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Customer Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <User className="inline h-4 w-4 mr-1" />
                  Select Customer *
                </label>
                <CustomerSelector
                  value={selectedCustomerId}
                  onChange={handleCustomerChange}
                  customers={customers}
                  placeholder="Search for a customer..."
                />
              </div>

              {/* Order Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Calendar className="inline h-4 w-4 mr-1" />
                  Order Date *
                </label>
                <input
                  type="date"
                  value={orderDate}
                  onChange={(e) => setOrderDate(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Address Selection */}
            {selectedCustomerId && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <MapPin className="inline h-4 w-4 mr-1" />
                  Delivery Address *
                </label>
                {addresses.length > 0 ? (
                  <div className="space-y-3">
                    <select
                      value={selectedAddressId}
                      onChange={(e) => setSelectedAddressId(e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="">Choose a delivery address...</option>
                      {addresses.map((address) => (
                        <option key={address.id} value={address.id}>
                          {formatAddressForSelect(address)}
                        </option>
                      ))}
                    </select>
                    
                    {/* Selected Address Details */}
                    {selectedAddress && (
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <h4 className="font-medium text-gray-900 mb-2">Selected Address:</h4>
                        <div className="text-sm text-gray-700">
                          <div>{selectedAddress.line1}</div>
                          {selectedAddress.line2 && <div>{selectedAddress.line2}</div>}
                          <div>{selectedAddress.city}, {selectedAddress.state} {selectedAddress.postal_code}</div>
                          {selectedAddress.instructions && (
                            <div className="mt-2 text-gray-600">
                              <strong>Instructions:</strong> {selectedAddress.instructions}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 border border-gray-200 rounded-lg bg-yellow-50">
                    <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No delivery addresses found</h3>
                    <p className="text-gray-600 mb-4">
                      This customer doesn't have any delivery addresses yet.
                    </p>
                    <button
                      onClick={handleAddAddressForCustomer}
                      className="inline-flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Add Address for Customer</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Order Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Optional notes about this order..."
              />
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setStep(2)}
                disabled={!canProceedToStep2}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next: Add Products
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Add Products */}
        {step === 2 && (
          <div className="space-y-6">
            {!defaultPriceList && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                  <span className="text-sm text-yellow-800">
                    No default price list found. Product prices may not be available.
                  </span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Product Selection */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Available Products</h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {products.filter(p => p.status === 'active').map((product) => {
                    const stockAvailable = getStockInfo(product.id);
                    const unitPrice = getProductPrice(product.id);
                    const isInOrder = orderLines.some(line => line.product_id === product.id);
                    const stockStatusClass = getStockStatusClass(stockAvailable);
                    
                    return (
                      <div
                        key={product.id}
                        className={`p-3 border rounded-lg ${isInOrder ? 'bg-blue-50 border-blue-200' : 'border-gray-200'}`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium text-gray-900">{product.name}</div>
                            <div className="text-sm text-gray-500">SKU: {product.sku}</div>
                            <div className={`text-sm ${stockStatusClass}`}>
                              {stockAvailable === 0 
                                ? "Out of stock" 
                                : `Stock: ${stockAvailable} available`}
                            </div>
                            <div className="text-sm font-medium text-green-600">
                              Price: {unitPrice > 0 ? formatCurrency(unitPrice) : 'No price set'}
                            </div>
                          </div>
                          <button
                            onClick={() => handleAddProduct(product.id)}
                            disabled={stockAvailable === 0 || unitPrice === 0}
                            className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Order Lines */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Order Items</h3>
                {orderLines.length > 0 ? (
                  <div className="space-y-3">
                    {orderLines.map((line) => {
                      const stockAvailable = getStockInfo(line.product_id);
                      
                      return (
                        <div key={line.product_id} className="p-3 border border-gray-200 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <div className="font-medium text-gray-900">{line.product_name}</div>
                              <div className="text-sm text-gray-500">SKU: {line.product_sku}</div>
                            </div>
                            <button
                              onClick={() => handleRemoveProduct(line.product_id)}
                              className="text-red-600 hover:text-red-800"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <label className="text-sm text-gray-600">Qty:</label>
                              <input
                                type="number"
                                min="1"
                                max={stockAvailable + line.quantity}
                                value={line.quantity}
                                onChange={(e) => handleUpdateQuantity(line.product_id, parseInt(e.target.value) || 0)}
                                className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                              />
                              <span className="text-xs text-gray-500">
                                (max: {stockAvailable + line.quantity})
                              </span>
                            </div>
                            <div className="text-right">
                              <div className="text-sm text-gray-600">
                                {formatCurrency(line.unit_price)} each
                              </div>
                              <div className="font-medium text-gray-900">
                                {formatCurrency(line.subtotal)}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    
                    <div className="border-t pt-3">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-lg font-medium text-gray-900">Subtotal:</span>
                        <span className="text-xl font-bold text-gray-900">
                          {formatCurrency(orderTotal)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center mb-2">
                        <label className="text-sm font-medium text-gray-700">Tax (%)</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={taxPercent}
                          onChange={e => setTaxPercent(Number(e.target.value))}
                          className="w-24 px-2 py-1 border border-gray-300 rounded text-sm text-right"
                        />
                      </div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-lg font-medium text-gray-900">Tax:</span>
                        <span className="text-lg font-bold text-gray-900">
                          {formatCurrency(taxAmount)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-lg font-semibold text-gray-900">Total:</span>
                        <span className="text-xl font-bold text-green-700">
                          {formatCurrency(grandTotal)}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 border border-gray-200 rounded-lg">
                    <Package className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">No products added yet.</p>
                    <p className="text-sm text-gray-400 mt-1">Select products from the left to add them to the order.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-between">
              <button
                onClick={() => setStep(1)}
                className="bg-gray-100 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-200"
              >
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={orderLines.length === 0}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next: Review
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Review & Create */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Order Summary */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Order Summary</h3>
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <div>
                    <label className="text-sm font-medium text-gray-600">Customer:</label>
                    <div className="text-gray-900">{selectedCustomer?.name}</div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Delivery Address:</label>
                    <div className="text-gray-900">
                      {selectedAddress?.line1}
                      {selectedAddress?.line2 && <div>{selectedAddress.line2}</div>}
                      <div>{selectedAddress?.city}, {selectedAddress?.state} {selectedAddress?.postal_code}</div>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Order Date:</label>
                    <div className="text-gray-900">{new Date(orderDate).toLocaleDateString()}</div>
                  </div>
                  {notes && (
                    <div>
                      <label className="text-sm font-medium text-gray-600">Notes:</label>
                      <div className="text-gray-900">{notes}</div>
                    </div>
                  )}
                  <div>
                    <label className="text-sm font-medium text-gray-700">Tax (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={taxPercent}
                      onChange={e => setTaxPercent(Number(e.target.value))}
                      className="w-24 px-2 py-1 border border-gray-300 rounded text-sm text-right"
                    />
                  </div>
                </div>
              </div>

              {/* Order Items */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Order Items</h3>
                <div className="space-y-2">
                  {orderLines.map((line) => (
                    <div key={line.product_id} className="flex justify-between items-center py-2 border-b border-gray-200">
                      <div>
                        <div className="font-medium text-gray-900">{line.product_name}</div>
                        <div className="text-sm text-gray-500">
                          {line.quantity} × {formatCurrency(line.unit_price)}
                        </div>
                      </div>
                      <div className="font-medium text-gray-900">
                        {formatCurrency(line.subtotal)}
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-between items-center pt-3 border-t border-gray-300">
                    <span className="text-lg font-medium text-gray-900">Subtotal:</span>
                    <span className="text-xl font-bold text-gray-900">
                      {formatCurrency(orderTotal)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-medium text-gray-900">Tax:</span>
                    <span className="text-lg font-bold text-gray-900">
                      {formatCurrency(taxAmount)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-semibold text-gray-900">Total:</span>
                    <span className="text-xl font-bold text-green-700">
                      {formatCurrency(grandTotal)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-between">
              <button
                onClick={() => setStep(2)}
                className="bg-gray-100 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-200"
              >
                Back
              </button>
              <button
                onClick={handleCreateOrder}
                disabled={!canCreateOrder || createOrder.isPending}
                className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                <ShoppingCart className="h-4 w-4" />
                <span>{createOrder.isPending ? 'Creating...' : 'Create Order'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};