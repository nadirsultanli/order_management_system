import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Package, User, MapPin, Calendar, ShoppingCart, AlertTriangle, Plus, X, Info, DollarSign, Trash2, Clock, FileText, ChevronRight } from 'lucide-react';
import { useCustomers } from '../hooks/useCustomers';
import { useAddresses, useCreateAddress } from '../hooks/useAddresses';
import { useProducts } from '../hooks/useProducts';
import { useUpdateOrder, useOrderNew } from '../hooks/useOrders';
import { useWarehouses } from '../hooks/useWarehouses';
import { useInventoryNew } from '../hooks/useInventory';
import { useProductPrices } from '../hooks/useProductPricing';
import { formatCurrencySync } from '../utils/pricing';
import { formatAddressForSelect } from '../utils/address';
import { CustomerSelector } from '../components/customers/CustomerSelector';
import { AddressForm } from '../components/addresses/AddressForm';
import { CreateAddressData, Address } from '../types/address';
import { Customer } from '../types/customer';
import { Product } from '../types/product';
import { Warehouse } from '../types/warehouse';

interface OrderLineItem {
  id?: string;
  product_id: string;
  product_name: string;
  product_sku: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  price_excluding_tax?: number;
  tax_amount?: number;
  price_including_tax?: number;
  tax_rate?: number;
}

export const EditOrderPage: React.FC = () => {
  const navigate = useNavigate();
  const { id: orderId } = useParams<{ id: string }>();
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  
  // Step 1: Order Type
  const [orderType, setOrderType] = useState<'delivery' | 'visit' | ''>('');
  
  // Step 2: Customer & Address
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [isAddressFormOpen, setIsAddressFormOpen] = useState(false);
  
  // Step 3: Products
  const [orderLines, setOrderLines] = useState<OrderLineItem[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<{[key: string]: number}>({});
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  
  // Step 4: Delivery Details
  const [deliveryDate, setDeliveryDate] = useState('');
  const [timeWindowStart, setTimeWindowStart] = useState('');
  const [timeWindowEnd, setTimeWindowEnd] = useState('');
  const [deliveryInstructions, setDeliveryInstructions] = useState('');
  
  // Step 5: Review
  const [notes, setNotes] = useState('');
  
  // Hooks
  const { data: order, isLoading: orderLoading } = useOrderNew(orderId || '');
  const { data: customersData, isLoading: customersLoading } = useCustomers({ limit: 1000 });
  const { data: addresses = [], isLoading: addressesLoading } = useAddresses(selectedCustomerId);
  const { data: productsData, isLoading: productsLoading } = useProducts({ limit: 1000 });
  const { data: warehousesData, isLoading: warehousesLoading } = useWarehouses({ limit: 1000 });
  const { data: inventoryData, isLoading: inventoryLoading } = useInventoryNew(
    selectedWarehouseId ? { warehouse_id: selectedWarehouseId } : {}
  );
  const productIds = orderLines?.map(line => line.product_id) || [];
  const { data: productPrices = [], isLoading: pricesLoading } = useProductPrices(productIds, selectedCustomerId);
  
  const customers = customersData?.customers || [];
  const products = productsData?.products || [];
  const warehouses = warehousesData?.warehouses || [];
  const inventory = inventoryData?.inventory || [];
  const { mutate: createAddress } = useCreateAddress();
  const { mutate: updateOrder, isLoading: isUpdating } = useUpdateOrder();

  // Load order data when component mounts
  useEffect(() => {
    if (order && !orderLoading) {
      setOrderType(order.order_type);
      setSelectedCustomerId(order.customer_id || '');
      setSelectedAddressId(order.delivery_address_id || '');
      setSelectedWarehouseId(order.source_warehouse_id || '');
      setNotes(order.notes || '');
      
      // Set delivery details if they exist
      if (order.delivery_date) {
        setDeliveryDate(order.delivery_date.split('T')[0]);
      }
      if (order.delivery_time_window_start) {
        setTimeWindowStart(order.delivery_time_window_start);
      }
      if (order.delivery_time_window_end) {
        setTimeWindowEnd(order.delivery_time_window_end);
      }
      if (order.delivery_instructions) {
        setDeliveryInstructions(order.delivery_instructions);
      }
      
      // Set order lines
      if (order.order_lines) {
        const formattedLines = order.order_lines.map(line => ({
          id: line.id,
          product_id: line.product_id,
          product_name: line.product?.name || 'Unknown Product',
          product_sku: line.product?.sku || 'Unknown SKU',
          quantity: line.quantity,
          unit_price: line.unit_price,
          subtotal: line.subtotal || (line.quantity * line.unit_price),
          price_excluding_tax: line.price_excluding_tax,
          tax_amount: line.tax_amount,
          price_including_tax: line.price_including_tax,
          tax_rate: line.tax_rate,
        }));
        setOrderLines(formattedLines);
        
        // Set selected products for product selection UI
        const selectedProds: {[key: string]: number} = {};
        formattedLines.forEach(line => {
          selectedProds[line.product_id] = line.quantity;
        });
        setSelectedProducts(selectedProds);
      }
      
      setIsLoading(false);
    }
  }, [order, orderLoading]);

  useEffect(() => {
    setIsLoading(orderLoading);
  }, [orderLoading]);

  // Navigation helpers
  const canProceedToStep2 = orderType !== '';
  const canProceedToStep3 = selectedCustomerId && selectedAddressId && 
    (orderType === 'delivery' || (orderType === 'visit' && selectedWarehouseId));
  const canProceedToStep4 = orderType === 'visit' || (orderLines?.length || 0) > 0;
  const canProceedToStep5 = orderType === 'visit' || (orderLines?.length || 0) > 0;

  // Product management
  const getProductPrice = (productId: string): number => {
    const price = productPrices?.find(p => p.product_id === productId);
    return price?.price || 0;
  };

  const getAvailableStock = (productId: string): number => {
    if (!selectedWarehouseId) return 0;
    const inventoryItem = inventory?.find(i => i.product_id === productId);
    return inventoryItem ? inventoryItem.qty_full - inventoryItem.qty_reserved : 0;
  };

  const addOrderLine = (product: Product) => {
    const existingLineIndex = orderLines.findIndex(line => line.product_id === product.id);
    const currentQuantity = selectedProducts[product.id] || 0;
    const newQuantity = currentQuantity + 1;
    const unitPrice = getProductPrice(product.id);
    const subtotal = unitPrice * newQuantity;

    setSelectedProducts(prev => ({ ...prev, [product.id]: newQuantity }));

    if (existingLineIndex >= 0) {
      const updatedLines = [...orderLines];
      updatedLines[existingLineIndex] = {
        ...updatedLines[existingLineIndex],
        quantity: newQuantity,
        subtotal: subtotal
      };
      setOrderLines(updatedLines);
    } else {
      const newLine: OrderLineItem = {
        product_id: product.id,
        product_name: product.name,
        product_sku: product.sku,
        quantity: newQuantity,
        unit_price: unitPrice,
        subtotal: subtotal
      };
      setOrderLines(prev => [...prev, newLine]);
    }
  };

  const updateOrderLineQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeOrderLine(productId);
      return;
    }

    const unitPrice = getProductPrice(productId);
    const subtotal = unitPrice * quantity;

    setSelectedProducts(prev => ({ ...prev, [productId]: quantity }));

    const updatedLines = orderLines.map(line => 
      line.product_id === productId 
        ? { ...line, quantity, subtotal }
        : line
    );
    setOrderLines(updatedLines);
  };

  const removeOrderLine = (productId: string) => {
    setOrderLines(prev => prev.filter(line => line.product_id !== productId));
    setSelectedProducts(prev => {
      const updated = { ...prev };
      delete updated[productId];
      return updated;
    });
  };

  // Address management
  const handleCreateAddress = (addressData: CreateAddressData) => {
    createAddress(
      { ...addressData, customer_id: selectedCustomerId },
      {
        onSuccess: (newAddress) => {
          setSelectedAddressId(newAddress.id);
          setIsAddressFormOpen(false);
        }
      }
    );
  };

  // Auto-select warehouse based on product availability for delivery orders
  useEffect(() => {
    if (orderType === 'delivery' && (orderLines?.length || 0) > 0 && warehouses?.length > 0) {
      // Find warehouse with best availability for selected products
      let bestWarehouse = '';
      let bestScore = -1;

      warehouses?.forEach(warehouse => {
        const warehouseInventory = inventory?.filter(inv => inv.warehouse_id === warehouse.id) || [];
        let score = 0;
        
        orderLines?.forEach(line => {
          const inv = warehouseInventory?.find(i => i.product_id === line.product_id);
          if (inv && (inv.qty_full - inv.qty_reserved) >= line.quantity) {
            score += 1;
          }
        });

        if (score > bestScore) {
          bestScore = score;
          bestWarehouse = warehouse.id;
        }
      });

      if (bestWarehouse && bestWarehouse !== selectedWarehouseId) {
        setSelectedWarehouseId(bestWarehouse);
      }
    }
  }, [orderLines, warehouses, inventory, orderType]);

  // Calculate totals
  const calculateTotals = () => {
    const subtotal = orderLines?.reduce((sum, line) => sum + line.subtotal, 0) || 0;
    const taxAmount = subtotal * 0.16; // 16% VAT
    const total = subtotal + taxAmount;
    return { subtotal, taxAmount, total };
  };

  // Submit order
  const handleSubmitOrder = () => {
    if (!orderId) return;

    const orderData = {
      order_id: orderId,
      order_type: orderType as 'delivery' | 'visit',
      customer_id: selectedCustomerId,
      delivery_address_id: selectedAddressId,
      source_warehouse_id: selectedWarehouseId || undefined,
      notes: notes,
      delivery_date: deliveryDate || undefined,
      delivery_time_window_start: timeWindowStart || undefined,
      delivery_time_window_end: timeWindowEnd || undefined,
      delivery_instructions: deliveryInstructions || undefined,
      order_lines: orderLines?.map(line => ({
        id: line.id,
        product_id: line.product_id,
        quantity: line.quantity,
        unit_price: line.unit_price,
        subtotal: line.subtotal
      })) || []
    };

    updateOrder.mutate(orderData, {
      onSuccess: () => {
        navigate(`/orders/${orderId}`);
      }
    });
  };

  // Show loading state while any essential data is loading
  const isDataLoading = isLoading || orderLoading || customersLoading || productsLoading || warehousesLoading || addressesLoading;
  
  if (isDataLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading order data...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-600">Order not found</p>
          <button 
            onClick={() => navigate('/orders')}
            className="mt-2 text-blue-600 hover:underline"
          >
            Back to Orders
          </button>
        </div>
      </div>
    );
  }

  // Ensure arrays are properly initialized before accessing them
  const safeCustomers = customers || [];
  const safeAddresses = addresses || [];
  const safeWarehouses = warehouses || [];
  const safeProducts = products || [];
  
  // Safe to access arrays now that we've confirmed they exist
  const selectedCustomer = safeCustomers.find(c => c.id === selectedCustomerId);
  const selectedAddress = safeAddresses.find(a => a.id === selectedAddressId);
  const selectedWarehouse = safeWarehouses.find(w => w.id === selectedWarehouseId);
  const { subtotal, taxAmount, total } = calculateTotals();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/orders')}
                className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back to Orders</span>
              </button>
              <div className="text-gray-400">/</div>
              <h1 className="text-xl font-semibold text-gray-900">Edit Order</h1>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            {[
              { number: 1, title: 'Order Type', icon: Package },
              { number: 2, title: 'Customer & Address', icon: User },
              { number: 3, title: 'Products', icon: ShoppingCart },
              { number: 4, title: 'Delivery Details', icon: Calendar },
              { number: 5, title: 'Review & Confirm', icon: Check }
            ].map((step, index) => {
              const isActive = currentStep === step.number;
              const isCompleted = currentStep > step.number;
              const StepIcon = step.icon;

              return (
                <div key={step.number} className="flex items-center">
                  <div className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors ${
                    isActive 
                      ? 'bg-blue-50 text-blue-700' 
                      : isCompleted 
                        ? 'bg-green-50 text-green-700' 
                        : 'text-gray-500'
                  }`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      isActive 
                        ? 'bg-blue-600 text-white' 
                        : isCompleted 
                          ? 'bg-green-600 text-white' 
                          : 'bg-gray-200 text-gray-600'
                    }`}>
                      {isCompleted ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <StepIcon className="h-4 w-4" />
                      )}
                    </div>
                    <span className="font-medium">{step.title}</span>
                  </div>
                  {index < 4 && (
                    <ChevronRight className="h-4 w-4 text-gray-400 mx-2" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Step 1: Order Type */}
        {currentStep === 1 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Step 1: Order Type</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={() => setOrderType('delivery')}
                className={`p-6 rounded-lg border-2 transition-colors ${
                  orderType === 'delivery'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <Package className="h-8 w-8 mx-auto mb-2" />
                <h3 className="font-semibold">Delivery Order</h3>
                <p className="text-sm text-gray-600 mt-1">Pre-selected products for delivery</p>
              </button>
              <button
                onClick={() => setOrderType('visit')}
                className={`p-6 rounded-lg border-2 transition-colors ${
                  orderType === 'visit'
                    ? 'border-purple-500 bg-purple-50 text-purple-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <User className="h-8 w-8 mx-auto mb-2" />
                <h3 className="font-semibold">Visit Order</h3>
                <p className="text-sm text-gray-600 mt-1">Products to be determined during visit</p>
              </button>
            </div>
            <div className="flex justify-end mt-6">
              <button
                onClick={() => setCurrentStep(2)}
                disabled={!canProceedToStep2}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next: Customer & Address
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Customer & Address */}
        {currentStep === 2 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Step 2: Customer & Address</h2>
            
            {/* Customer Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Customer *
              </label>
              <CustomerSelector
                customers={customers}
                value={selectedCustomerId}
                onChange={setSelectedCustomerId}
              />
            </div>

            {/* Address Selection */}
            {selectedCustomerId && (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Delivery Address *
                  </label>
                  <button
                    onClick={() => setIsAddressFormOpen(true)}
                    className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center space-x-1"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Add New Address</span>
                  </button>
                </div>
                <select
                  value={selectedAddressId}
                  onChange={(e) => setSelectedAddressId(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select address...</option>
                  {safeAddresses.map(address => (
                    <option key={address.id} value={address.id}>
                      {formatAddressForSelect(address)}
                    </option>
                  )) || []}
                </select>
              </div>
            )}

            {/* Warehouse Selection (only for visit orders) */}
            {orderType === 'visit' && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Source Warehouse *
                </label>
                <select
                  value={selectedWarehouseId}
                  onChange={(e) => setSelectedWarehouseId(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select warehouse...</option>
                  {safeWarehouses.map(warehouse => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.name}
                    </option>
                  )) || []}
                </select>
              </div>
            )}

            <div className="flex justify-between mt-6">
              <button
                onClick={() => setCurrentStep(1)}
                className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentStep(orderType === 'visit' ? 4 : 3)}
                disabled={!canProceedToStep3}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {orderType === 'visit' ? 'Next: Delivery Details' : 'Next: Products'}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Products (skip for visit orders) */}
        {currentStep === 3 && orderType === 'delivery' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Step 3: Products</h2>
            
            {/* Warehouse Auto-Selection Info */}
            {selectedWarehouseId && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <div className="flex items-start space-x-2">
                  <Info className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-medium text-blue-800">Selected Warehouse</h4>
                    <p className="text-sm text-blue-700">
                      {selectedWarehouse?.name} - Products will be fulfilled from this warehouse
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Product Selection */}
            <div className="space-y-4 mb-6">
              {safeProducts.map(product => {
                const isSelected = selectedProducts[product.id] > 0;
                const quantity = selectedProducts[product.id] || 0;
                const availableStock = getAvailableStock(product.id);
                const price = getProductPrice(product.id);

                return (
                  <div key={product.id} className={`border rounded-lg p-4 ${isSelected ? 'border-blue-300 bg-blue-50' : 'border-gray-200'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900">{product.name}</h3>
                        <p className="text-sm text-gray-600">SKU: {product.sku}</p>
                        <p className="text-sm text-gray-600">Price: {formatCurrencySync(price)}</p>
                        <p className="text-sm text-gray-600">Available: {availableStock} units</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        {isSelected ? (
                          <>
                            <button
                              onClick={() => updateOrderLineQuantity(product.id, quantity - 1)}
                              className="w-8 h-8 rounded-full bg-gray-200 text-gray-600 hover:bg-gray-300 flex items-center justify-center"
                            >
                              -
                            </button>
                            <span className="w-12 text-center font-medium">{quantity}</span>
                            <button
                              onClick={() => updateOrderLineQuantity(product.id, quantity + 1)}
                              disabled={quantity >= availableStock}
                              className="w-8 h-8 rounded-full bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                            >
                              +
                            </button>
                            <button
                              onClick={() => removeOrderLine(product.id)}
                              className="w-8 h-8 rounded-full bg-red-100 text-red-600 hover:bg-red-200 flex items-center justify-center ml-2"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => addOrderLine(product)}
                            disabled={availableStock === 0}
                            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            Add to Order
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              }) || []}
            </div>

            {/* Order Summary */}
            {(orderLines?.length || 0) > 0 && (
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <h4 className="font-medium text-gray-900 mb-2">Order Summary</h4>
                <div className="space-y-2">
                  {orderLines?.map(line => (
                    <div key={line.product_id} className="flex justify-between text-sm">
                      <span>{line.product_name} (x{line.quantity})</span>
                      <span>{formatCurrencySync(line.subtotal)}</span>
                    </div>
                  )) || []}
                  <div className="border-t pt-2 font-medium">
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span>{formatCurrencySync(subtotal)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-between mt-6">
              <button
                onClick={() => setCurrentStep(2)}
                className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentStep(4)}
                disabled={!canProceedToStep4}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next: Delivery Details
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Delivery Details */}
        {currentStep === 4 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Step 4: Delivery Details</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* Delivery Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Delivery Date
                </label>
                <input
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Time Window */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Delivery Time Window Start
                  </label>
                  <input
                    type="time"
                    value={timeWindowStart}
                    onChange={(e) => setTimeWindowStart(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Delivery Time Window End
                  </label>
                  <input
                    type="time"
                    value={timeWindowEnd}
                    onChange={(e) => setTimeWindowEnd(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Delivery Instructions */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Delivery Instructions
              </label>
              <textarea
                value={deliveryInstructions}
                onChange={(e) => setDeliveryInstructions(e.target.value)}
                rows={3}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Any special delivery instructions..."
              />
            </div>

            <div className="flex justify-between mt-6">
              <button
                onClick={() => setCurrentStep(orderType === 'visit' ? 2 : 3)}
                className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentStep(5)}
                disabled={!canProceedToStep5}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next: Review & Confirm
              </button>
            </div>
          </div>
        )}

        {/* Step 5: Review & Confirm */}
        {currentStep === 5 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Step 5: Review & Update Order</h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Order Details */}
              <div className="space-y-6">
                {/* Order Type */}
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Order Type</h3>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    orderType === 'delivery' 
                      ? 'bg-blue-100 text-blue-800' 
                      : 'bg-purple-100 text-purple-800'
                  }`}>
                    {orderType === 'delivery' ? 'Delivery Order' : 'Visit Order'}
                  </span>
                </div>

                {/* Customer & Address */}
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Customer & Address</h3>
                  <div className="text-sm text-gray-600">
                    <p className="font-medium">{selectedCustomer?.name}</p>
                    {selectedAddress && (
                      <div className="mt-1">
                        <p>{selectedAddress.line1}</p>
                        {selectedAddress.line2 && <p>{selectedAddress.line2}</p>}
                        <p>{selectedAddress.city}, {selectedAddress.state} {selectedAddress.postal_code}</p>
                        <p>{selectedAddress.country}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Warehouse */}
                {selectedWarehouse && (
                  <div>
                    <h3 className="font-medium text-gray-900 mb-2">Source Warehouse</h3>
                    <p className="text-sm text-gray-600">{selectedWarehouse.name}</p>
                  </div>
                )}

                {/* Delivery Details */}
                {(deliveryDate || timeWindowStart || timeWindowEnd || deliveryInstructions) && (
                  <div>
                    <h3 className="font-medium text-gray-900 mb-2">Delivery Details</h3>
                    <div className="text-sm text-gray-600 space-y-1">
                      {deliveryDate && <p>Date: {new Date(deliveryDate).toLocaleDateString()}</p>}
                      {(timeWindowStart || timeWindowEnd) && (
                        <p>Time: {timeWindowStart || 'N/A'} - {timeWindowEnd || 'N/A'}</p>
                      )}
                      {deliveryInstructions && <p>Instructions: {deliveryInstructions}</p>}
                    </div>
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
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Any additional notes for this order..."
                  />
                </div>
              </div>

              {/* Order Summary */}
              <div>
                <h3 className="font-medium text-gray-900 mb-4">Order Summary</h3>
                
                {orderType === 'visit' && (orderLines?.length || 0) === 0 ? (
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <div className="flex items-start space-x-2">
                      <Info className="h-5 w-5 text-purple-600 mt-0.5" />
                      <div>
                        <h4 className="text-sm font-medium text-purple-800">Visit Order</h4>
                        <p className="text-sm text-purple-700">Products will be determined during the visit.</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-50 rounded-lg p-4">
                    {(orderLines?.length || 0) > 0 ? (
                      <div className="space-y-3">
                        {orderLines?.map(line => (
                          <div key={line.product_id} className="flex justify-between items-center">
                            <div>
                              <p className="font-medium text-gray-900">{line.product_name}</p>
                              <p className="text-sm text-gray-600">Qty: {line.quantity} × {formatCurrencySync(line.unit_price)}</p>
                            </div>
                            <span className="font-medium text-gray-900">{formatCurrencySync(line.subtotal)}</span>
                          </div>
                        )) || []}
                        
                        <div className="border-t pt-3 space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Subtotal:</span>
                            <span>{formatCurrencySync(subtotal)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>Tax (16%):</span>
                            <span>{formatCurrencySync(taxAmount)}</span>
                          </div>
                          <div className="flex justify-between font-semibold text-lg border-t pt-2">
                            <span>Total:</span>
                            <span>{formatCurrencySync(total)}</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-gray-600">No products selected</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-between mt-8">
              <button
                onClick={() => setCurrentStep(4)}
                className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Previous
              </button>
              <button
                onClick={handleSubmitOrder}
                disabled={updateOrder.isPending}
                className="bg-green-600 text-white px-8 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
              >
                {updateOrder.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Updating Order...</span>
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    <span>Update Order</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Address Form Modal */}
        {isAddressFormOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
              <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setIsAddressFormOpen(false)} />
              
              <div className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg">
                <div className="bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold leading-6 text-gray-900">
                      Add New Address
                    </h3>
                    <button
                      onClick={() => setIsAddressFormOpen(false)}
                      className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <X className="h-6 w-6" />
                    </button>
                  </div>
                  <AddressForm
                    onSubmit={handleCreateAddress}
                    onCancel={() => setIsAddressFormOpen(false)}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};