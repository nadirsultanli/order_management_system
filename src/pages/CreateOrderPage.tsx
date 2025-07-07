import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, ShoppingCart, User, MapPin, Calendar, Package, AlertTriangle, X, Check, Info, DollarSign } from 'lucide-react';
import { useCustomers } from '../hooks/useCustomers';
import { useAddresses, useCreateAddress } from '../hooks/useAddresses';
import { useProducts } from '../hooks/useProducts';
import { useCreateOrderNew, useCalculateOrderTotals } from '../hooks/useOrders';
import { usePriceListsNew } from '../hooks/usePricing';
import { CreateOrderData, CreateOrderLineData } from '../types/order';
import { CreateAddressData, Address } from '../types/address';
import { Customer } from '../types/customer';
import { Product } from '../types/product';
import { PriceList } from '../types/pricing';
import { formatCurrencySync } from '../utils/pricing';
import { formatAddressForSelect } from '../utils/address';
import { CustomerSelector } from '../components/customers/CustomerSelector';
import { AddressForm } from '../components/addresses/AddressForm';
import { OrderTypeSelector } from '../components/orders/OrderTypeSelector';
import { WarehouseSelector } from '../components/warehouses/WarehouseSelector';
import { useProductPrices, useActivePriceLists } from '../hooks/useProductPricing';
import { useInventoryNew } from '../hooks/useInventory';
import { useWarehouses } from '../hooks/useWarehouses';

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
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [orderLines, setOrderLines] = useState<OrderLineItem[]>([]);
  const [notes, setNotes] = useState('');
  const [taxPercent, setTaxPercent] = useState(0);
  
  // Add state for inline address creation
  const [isAddressFormOpen, setIsAddressFormOpen] = useState(false);
  
  // Order type state
  const [orderType, setOrderType] = useState<'delivery' | 'refill' | 'exchange' | 'pickup'>('delivery');
  const [serviceType, setServiceType] = useState<'standard' | 'express' | 'scheduled'>('standard');
  const [exchangeEmptyQty, setExchangeEmptyQty] = useState(0);
  const [requiresPickup, setRequiresPickup] = useState(false);
  
  // Warehouse selection state
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');

  const { data: customersData } = useCustomers({ limit: 1000 });
  const { data: addresses = [] } = useAddresses(selectedCustomerId);
  const { data: productsData, isLoading: isProductsLoading } = useProducts({ limit: 1000 });
  const { data: priceListsData } = usePriceListsNew({ limit: 1000 });
  const { data: warehousesData } = useWarehouses({ limit: 1000 });
  const createOrder = useCreateOrderNew();
  const calculateOrderTotals = useCalculateOrderTotals();
  // Note: useCreateOrderLine not available - order line functionality disabled
  const createAddress = useCreateAddress();

  const customers = customersData?.customers || [];
  const products = productsData?.products || [];
  const priceLists = priceListsData?.priceLists || [];
  const warehouses = warehousesData?.warehouses || [];
  
  // Get product prices from backend
  const productIds = products.map(p => p.id);
  const { data: productPrices, isLoading: isPricesLoading, error: pricesError } = useProductPrices(productIds, selectedCustomerId || undefined);
  
  // Get inventory data for real stock checking
  const { data: inventoryData } = useInventoryNew({});
  
  // Get active price lists (not expired)
  const today = new Date().toISOString().split('T')[0];
  const activePriceLists = priceLists.filter((pl: PriceList) => {
    // Check if price list is active (not expired)
    if (pl.end_date && pl.end_date < today) return false;
    // Check if price list has started
    if (pl.start_date && pl.start_date > today) return false;
    return true;
  });
  
  // Prefer default price list, but fallback to first active price list
  const selectedPriceList = activePriceLists.find((pl: PriceList) => pl.is_default) || 
                           activePriceLists[0];
  
  // Get all active product IDs for stock availability check
  const activeProductIds = products
    .filter((p: Product) => p.status === 'active')
    .map((p: Product) => p.id);
  
  // Note: useStockAvailability not available - stock checking disabled
  // Note: usePriceListItems not available - price list items disabled

  const selectedCustomer = customers.find((c: Customer) => c.id === selectedCustomerId);
  const selectedAddress = addresses.find((a: Address) => a.id === selectedAddressId);

  // Use backend API for ALL calculations - NO frontend business logic
  const [orderCalculations, setOrderCalculations] = useState({
    subtotal: 0,
    taxAmount: 0,
    grandTotal: 0
  });
  const [calculatingTotals, setCalculatingTotals] = useState(false);

  // Calculate totals using backend API whenever order lines or tax changes
  useEffect(() => {
    const calculateTotals = async () => {
      if (orderLines.length === 0) {
        setOrderCalculations({ subtotal: 0, taxAmount: 0, grandTotal: 0 });
        return;
      }

      setCalculatingTotals(true);
      try {
        const result = await calculateOrderTotals.mutateAsync({
          lines: orderLines,
          tax_percent: taxPercent, // Frontend stores as percentage (0-100), backend expects percentage format
        });
        setOrderCalculations(result);
      } catch (error) {
        console.error('Failed to calculate order totals:', error);
        // Keep previous values on error
      } finally {
        setCalculatingTotals(false);
      }
    };

    calculateTotals();
  }, [orderLines, taxPercent]);

  // Extract values for backward compatibility
  const orderTotal = orderCalculations.subtotal;
  const taxAmount = orderCalculations.taxAmount;
  const grandTotal = orderCalculations.grandTotal;

  const handleCustomerChange = (customerId: string) => {
    setSelectedCustomerId(customerId);
    setSelectedAddressId(''); // Reset address when customer changes
    
    // Clear order lines when customer changes to reset pricing
    setOrderLines([]);
  };

  // Auto-select primary address when customer is selected
  useEffect(() => {
    if (selectedCustomerId && addresses.length > 0 && !selectedAddressId) {
      const primaryAddress = addresses.find((a: Address) => a.is_primary);
      if (primaryAddress) {
        setSelectedAddressId(primaryAddress.id);
      } else {
        // If no primary address, select the first one
        setSelectedAddressId(addresses[0].id);
      }
    }
  }, [selectedCustomerId, addresses, selectedAddressId]);

  const getProductPrice = async (productId: string): Promise<number> => {
    // Try to use cached data from the useProductPrices hook first
    if (productPrices && productPrices[productId]) {
      return productPrices[productId].finalPrice || 0;
    }
    
    // Fallback: return 0 and let the component rerender when prices load
    console.warn('Product price not found in cache for product:', productId);
    return 0;
  };

  // Synchronous version for immediate UI feedback
  const getProductPriceSync = (productId: string): number => {
    // Use cached price data from the hook
    if (productPrices && productPrices[productId]) {
      return productPrices[productId].finalPrice;
    }
    // Return 0 if no pricing data available
    return 0;
  };

  // Check if we have pricing data for a product
  const hasProductPricing = (productId: string): boolean => {
    return !!(productPrices && productPrices[productId] && productPrices[productId].finalPrice > 0);
  };

  const handleAddProduct = async (productId: string) => {
    const product = products.find((p: Product) => p.id === productId);
    if (!product) {
      console.error('Product not found in products list:', productId);
      console.log('Available products:', products.map(p => ({ id: p.id, name: p.name })));
      return;
    }

    const existingLine = orderLines.find((line: OrderLineItem) => line.product_id === productId);
    const unitPrice = await getProductPrice(productId);
    const stockAvailable = getStockInfo(productId);
    
    if (existingLine) {
      // Check if we can increase quantity
      if (existingLine.quantity >= stockAvailable) {
        alert(`Cannot add more items. Only ${stockAvailable} units available in stock.`);
        return;
      }
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

    const stockAvailable = getStockInfo(productId);
    if (quantity > stockAvailable) {
      alert(`Cannot set quantity to ${quantity}. Only ${stockAvailable} units available in stock.`);
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
    if (!selectedCustomerId || !selectedAddressId || !selectedWarehouseId || orderLines.length === 0) {
      return;
    }
    
    // Validate customer account status
    if (selectedCustomer?.account_status === 'closed') {
      alert('Cannot create order for a closed customer account.');
      return;
    }
    
    if (selectedCustomer?.account_status === 'credit_hold') {
      const confirmed = confirm(
        'This customer is on credit hold. Are you sure you want to create this order? ' +
        'Please verify with management before proceeding.'
      );
      if (!confirmed) return;
    }

    try {
      // Validate scheduled delivery for scheduled service
      if (serviceType === 'scheduled' && (!scheduledDate || !scheduledTime)) {
        alert('Please select both date and time for scheduled delivery.');
        return;
      }
      
      // Create scheduled_date if needed
      const scheduledDateTime = serviceType === 'scheduled' && scheduledDate && scheduledTime 
        ? new Date(`${scheduledDate}T${scheduledTime}`).toISOString()
        : undefined;
      
      // Create the order with order lines
      const orderData = {
        customer_id: selectedCustomerId,
        delivery_address_id: selectedAddressId,
        source_warehouse_id: selectedWarehouseId,
        order_date: orderDate,
        scheduled_date: scheduledDateTime,
        notes,
        // Include order lines for proper backend processing
        order_lines: orderLines.map(line => ({
          product_id: line.product_id,
          quantity: line.quantity,
          unit_price: line.unit_price,
        })),
        // Order type fields
        order_type: orderType,
        service_type: serviceType,
        exchange_empty_qty: exchangeEmptyQty,
        requires_pickup: requiresPickup,
      };

      console.log('Creating order with data:', orderData);
      console.log('Selected warehouse ID:', selectedWarehouseId);
      console.log('Order lines product IDs:', orderLines.map(l => l.product_id));
      console.log('Products available:', products.map(p => ({ id: p.id, name: p.name, status: p.status })));

      // Check if products are still loading
      if (isProductsLoading) {
        alert('Products are still loading. Please wait a moment and try again.');
        return;
      }

      // Validate all products exist before creating order
      const invalidProducts = orderLines.filter(line => 
        !products.find(p => p.id === line.product_id)
      );
      
      if (invalidProducts.length > 0) {
        console.error('Invalid products found in order lines:', invalidProducts);
        console.error('Available products:', products.map(p => ({ id: p.id, name: p.name })));
        alert('Some products in your order are no longer available. Please refresh the page and try again.');
        return;
      }

      console.log('About to send order creation request...');
      const order = await createOrder.mutateAsync(orderData);
      console.log('Order created successfully:', order);

      // Navigate to the created order
      navigate(`/orders/${order.id}`);
    } catch (error) {
      console.error('Error creating order:', error);
    }
  };

  const canProceedToStep2 = selectedCustomerId && selectedAddressId && selectedWarehouseId &&
    (!selectedCustomer || selectedCustomer.account_status !== 'closed');
  const canCreateOrder = canProceedToStep2 && orderLines.length > 0 && 
    (serviceType !== 'scheduled' || (scheduledDate && scheduledTime)) &&
    !isProductsLoading && !createOrder.isPending;

  const getStockInfo = (productId: string) => {
    // Get real stock availability from inventory data
    if (!inventoryData?.inventory) {
      return 0;
    }
    
    // If a warehouse is selected, only check stock from that warehouse
    let productInventory = inventoryData.inventory.filter(
      (inv: any) => inv.product_id === productId
    );
    
    // Filter by selected warehouse if one is chosen
    if (selectedWarehouseId) {
      productInventory = productInventory.filter(
        (inv: any) => inv.warehouse_id === selectedWarehouseId
      );
    }
    
    if (productInventory.length === 0) return 0;
    
    // Sum available stock from the selected warehouse(s)
    // Available stock = qty_full - qty_reserved (never negative)
    const totalAvailable = productInventory.reduce(
      (sum: number, inv: any) => {
        const qtyFull = Number(inv.qty_full) || 0;
        const qtyReserved = Number(inv.qty_reserved) || 0;
        const available = Math.max(0, qtyFull - qtyReserved);
        return sum + available;
      }, 
      0
    );
    
    return totalAvailable;
  };

  const getStockStatusClass = (available: number) => {
    if (available === 0) return "text-red-600";
    if (available <= 10) return "text-yellow-600";
    return "text-green-600";
  };

  const handleAddAddressForCustomer = () => {
    if (selectedCustomerId) {
      setIsAddressFormOpen(true);
    }
  };

  const handleAddressSubmit = async (addressData: CreateAddressData) => {
    try {
      console.log('Creating address from order page:', addressData);
      const newAddress = await createAddress.mutateAsync(addressData);
      console.log('Address created successfully:', newAddress);
      
      // Auto-select the newly created address
      setSelectedAddressId(newAddress.id);
      setIsAddressFormOpen(false);
      
      // Show success feedback
      console.log('Address added and selected for order');
    } catch (error) {
      console.error('Failed to create address:', error);
      // Error handling is done in the hook, but add local feedback
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
            {/* Order Type Selection */}
            <div className="mb-6">
              <OrderTypeSelector
                orderType={orderType}
                serviceType={serviceType}
                exchangeEmptyQty={exchangeEmptyQty}
                requiresPickup={requiresPickup}
                onOrderTypeChange={setOrderType}
                onServiceTypeChange={setServiceType}
                onExchangeEmptyQtyChange={setExchangeEmptyQty}
                onRequiresPickupChange={setRequiresPickup}
              />
            </div>

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
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Warehouse Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Package className="inline h-4 w-4 mr-1" />
                  Source Warehouse *
                </label>
                <WarehouseSelector
                  value={selectedWarehouseId}
                  onChange={setSelectedWarehouseId}
                  placeholder="Select warehouse to fulfill from..."
                  required
                />
                <p className="mt-1 text-xs text-gray-500">
                  Stock availability will be checked from the selected warehouse
                </p>
              </div>
              
              {/* Scheduled Date/Time (for scheduled service type) */}
              {serviceType === 'scheduled' && (
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Calendar className="inline h-4 w-4 mr-1" />
                    Scheduled Delivery Date & Time *
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <input
                      type="date"
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      min={orderDate}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="Select date"
                    />
                    <input
                      type="time"
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="Select time"
                    />
                  </div>
                  {scheduledDate && scheduledTime && (
                    <p className="mt-1 text-sm text-gray-600">
                      Scheduled for: {new Date(`${scheduledDate}T${scheduledTime}`).toLocaleString()}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Address Selection */}
            {selectedCustomerId && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <MapPin className="inline h-4 w-4 mr-1" />
                  Delivery Address *
                </label>
                
                {/* Show customer info */}
                {selectedCustomer && (
                  <div className={`mb-3 p-3 rounded-lg ${
                    selectedCustomer.account_status === 'active' ? 'bg-green-50 border border-green-200' :
                    selectedCustomer.account_status === 'credit_hold' ? 'bg-yellow-50 border border-yellow-200' :
                    'bg-red-50 border border-red-200'
                  }`}>
                    <div className="text-sm">
                      <div className={`font-medium ${
                        selectedCustomer.account_status === 'active' ? 'text-green-900' :
                        selectedCustomer.account_status === 'credit_hold' ? 'text-yellow-900' :
                        'text-red-900'
                      }`}>{selectedCustomer.name}</div>
                      <div className={`${
                        selectedCustomer.account_status === 'active' ? 'text-green-700' :
                        selectedCustomer.account_status === 'credit_hold' ? 'text-yellow-700' :
                        'text-red-700'
                      }`}>
                        Account Status: <span className="font-medium">
                          {selectedCustomer.account_status === 'active' ? 'Active' :
                           selectedCustomer.account_status === 'credit_hold' ? 'Credit Hold' :
                           selectedCustomer.account_status === 'closed' ? 'Closed' : 
                           selectedCustomer.account_status || 'Unknown'}
                        </span>
                      </div>
                      {selectedCustomer.email && (
                        <div className={`${
                          selectedCustomer.account_status === 'active' ? 'text-green-600' :
                          selectedCustomer.account_status === 'credit_hold' ? 'text-yellow-600' :
                          'text-red-600'
                        }`}>{selectedCustomer.email}</div>
                      )}
                      {selectedCustomer.phone && (
                        <div className={`${
                          selectedCustomer.account_status === 'active' ? 'text-green-600' :
                          selectedCustomer.account_status === 'credit_hold' ? 'text-yellow-600' :
                          'text-red-600'
                        }`}>{selectedCustomer.phone}</div>
                      )}
                      
                      {/* Account status warnings */}
                      {selectedCustomer.account_status === 'credit_hold' && (
                        <div className="mt-2 p-2 bg-yellow-100 border border-yellow-300 rounded text-yellow-800 text-xs">
                          <strong>Warning:</strong> This customer is on credit hold. Please review before creating orders.
                        </div>
                      )}
                      {selectedCustomer.account_status === 'closed' && (
                        <div className="mt-2 p-2 bg-red-100 border border-red-300 rounded text-red-800 text-xs">
                          <strong>Account Closed:</strong> This customer account is closed. Orders cannot be created.
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {addresses.length > 0 ? (
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <select
                        value={selectedAddressId}
                        onChange={(e) => setSelectedAddressId(e.target.value)}
                        className="flex-1 rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="">Choose a delivery address...</option>
                        {addresses.map((address) => (
                          <option key={address.id} value={address.id}>
                            {formatAddressForSelect(address)}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={handleAddAddressForCustomer}
                        className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                        title="Add new address"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                    
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
                title={!canProceedToStep2 ? 'Please select a customer, delivery address, and warehouse to continue' : ''}
              >
                Next: Add Products
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Add Products */}
        {step === 2 && (
          <div className="space-y-6">
            {/* Warehouse Stock Indicator */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <Package className="h-5 w-5 text-blue-600" />
                <span className="text-sm text-blue-800">
                  <strong>Stock Source:</strong> {warehouses.find(w => w.id === selectedWarehouseId)?.name || 'Unknown Warehouse'}
                </span>
              </div>
              <p className="text-xs text-blue-700 mt-1">
                Stock availability shown below is from the selected warehouse only.
              </p>
            </div>

            {!selectedPriceList && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                  <span className="text-sm text-yellow-800">
                    No active price list found. Product prices may not be available. 
                    {priceLists.length > 0 ? `Found ${priceLists.length} price list(s) but none are currently active.` : 'No price lists exist yet.'}
                  </span>
                </div>
              </div>
            )}

            {/* Debug Information for Pricing Issues */}
            {(isPricesLoading || pricesError || !productPrices) && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <Info className="h-5 w-5 text-blue-600" />
                  <span className="text-sm font-medium text-blue-800">Pricing Debug Information</span>
                </div>
                <div className="text-sm text-blue-700 space-y-1">
                  <div>Products to fetch prices: {productIds.length}</div>
                  <div>Selected customer: {selectedCustomerId || 'None'}</div>
                  <div>Prices loading: {isPricesLoading ? 'Yes' : 'No'}</div>
                  <div>Prices data: {productPrices ? `${Object.keys(productPrices).length} products` : 'None'}</div>
                  {pricesError && (
                    <div className="text-red-600">
                      Error: {pricesError instanceof Error ? pricesError.message : String(pricesError)}
                    </div>
                  )}
                  {productPrices && Object.keys(productPrices).length > 0 && (
                    <div>
                      Sample pricing: {Object.entries(productPrices).slice(0, 2).map(([id, price]) => 
                        `${id.slice(0, 8)}... = ${(price as any)?.finalPrice || 'N/A'}`
                      ).join(', ')}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Product Selection */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Available Products</h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {(() => {
                    const availableProducts = products.filter((p: Product) => {
                      // Only show active products that have stock in the selected warehouse
                      if (p.status !== 'active') return false;
                      const stockAvailable = getStockInfo(p.id);
                      return stockAvailable > 0;
                    });
                    
                    if (availableProducts.length === 0) {
                      return (
                        <div className="text-center py-8 text-gray-500">
                          <Package className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                          <p className="text-lg font-medium">No products available</p>
                          <p className="text-sm">
                            {selectedWarehouseId 
                              ? 'No products have stock in the selected warehouse.' 
                              : 'Please select a warehouse to see available products.'}
                          </p>
                        </div>
                      );
                    }
                    
                    return availableProducts.map((product) => {
                    const stockAvailable = getStockInfo(product.id);
                    const unitPrice = getProductPriceSync(product.id); // Use sync version for display
                    const orderLine = orderLines.find(line => line.product_id === product.id);
                    const isInOrder = !!orderLine;
                    const currentOrderQuantity = orderLine?.quantity || 0;
                    const stockStatusClass = getStockStatusClass(stockAvailable);
                    const canAddMore = currentOrderQuantity < stockAvailable;
                    
                    // Check if pricing is loading - must be defined before usage
                    const isPricingLoading = isPricesLoading || (productPrices === undefined && productIds.length > 0);
                    
                    // Determine product availability and warning states
                    const isOutOfStock = stockAvailable === 0;
                    const hasNoPricing = !hasProductPricing(product.id) && !isPricingLoading;
                    const isLowStock = stockAvailable > 0 && stockAvailable <= 5;
                    const cannotAddProduct = isOutOfStock || hasNoPricing || !canAddMore;
                    
                    return (
                      <div
                        key={product.id}
                        className={`p-3 border rounded-lg transition-all ${
                          isInOrder 
                            ? 'bg-blue-50 border-blue-200' 
                            : cannotAddProduct
                              ? 'bg-gray-50 border-gray-200 opacity-75'
                              : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2">
                              <div className="font-medium text-gray-900">{product.name}</div>
                              {isInOrder && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                  In Order
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-gray-500 mb-2">SKU: {product.sku}</div>
                            
                            {/* Stock Status with Enhanced Visual Indicators */}
                            <div className="flex items-center space-x-2 mb-2">
                              {isOutOfStock ? (
                                <div className="flex items-center space-x-1 text-red-600">
                                  <X className="h-4 w-4" />
                                  <span className="text-sm font-medium">Out of Stock</span>
                                </div>
                              ) : isLowStock ? (
                                <div className="flex items-center space-x-1 text-orange-600">
                                  <AlertTriangle className="h-4 w-4" />
                                  <span className="text-sm font-medium">Low Stock: {stockAvailable} left</span>
                                </div>
                              ) : (
                                <div className="flex items-center space-x-1 text-green-600">
                                  <Check className="h-4 w-4" />
                                  <span className="text-sm">
                                    {stockAvailable} available{isInOrder ? ` (${currentOrderQuantity} in order)` : ''}
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Pricing Status with Enhanced Visual Indicators */}
                            <div className="flex items-center space-x-2 mb-3">
                              {isPricingLoading ? (
                                <div className="flex items-center space-x-1 text-gray-500">
                                  <DollarSign className="h-4 w-4 animate-pulse" />
                                  <span className="text-sm">Loading price...</span>
                                </div>
                              ) : hasNoPricing ? (
                                <div className="flex items-center space-x-1 text-red-600">
                                  <DollarSign className="h-4 w-4" />
                                  <span className="text-sm font-medium">
                                    No price set{selectedPriceList ? ` in ${selectedPriceList.name}` : ''}
                                  </span>
                                </div>
                              ) : (
                                <div className="flex items-center space-x-1 text-green-600">
                                  <DollarSign className="h-4 w-4" />
                                  <span className="text-sm font-medium">{formatCurrencySync(unitPrice)}</span>
                                  {selectedPriceList && (
                                    <span className="text-xs text-gray-500">({selectedPriceList.name})</span>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Warning Messages for Unavailable Products */}
                            {(cannotAddProduct || isPricingLoading) && (
                              <div className={`border rounded p-2 mt-2 ${
                                isPricingLoading ? 'bg-blue-50 border-blue-200' : 'bg-yellow-50 border-yellow-200'
                              }`}>
                                <div className="flex items-start space-x-2">
                                  <Info className={`h-4 w-4 flex-shrink-0 mt-0.5 ${
                                    isPricingLoading ? 'text-blue-600' : 'text-yellow-600'
                                  }`} />
                                  <div className={`text-sm ${
                                    isPricingLoading ? 'text-blue-800' : 'text-yellow-800'
                                  }`}>
                                    {isPricingLoading && "Loading pricing information..."}
                                    {!isPricingLoading && isOutOfStock && "This product is out of stock and cannot be added to orders."}
                                    {!isPricingLoading && hasNoPricing && !isOutOfStock && (
                                      <>
                                        No pricing configured for this product{selectedCustomerId ? ' for this customer' : ''}. 
                                        <button
                                          onClick={() => window.open(`/pricing`, '_blank')}
                                          className="ml-1 text-blue-600 hover:text-blue-800 underline"
                                        >
                                          Set up pricing
                                        </button>
                                      </>
                                    )}
                                    {!isPricingLoading && !canAddMore && !isOutOfStock && !hasNoPricing && 
                                      `Maximum quantity (${stockAvailable}) already in order.`}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                          
                          {/* Add Button with Enhanced States */}
                          <div className="ml-4 flex-shrink-0">
                            <button
                              onClick={() => handleAddProduct(product.id)}
                              disabled={cannotAddProduct || isPricingLoading}
                              title={
                                isPricingLoading
                                  ? "Loading pricing..."
                                  : cannotAddProduct 
                                    ? isOutOfStock 
                                      ? "Out of stock" 
                                      : hasNoPricing 
                                        ? "No price set" 
                                        : "Maximum quantity reached"
                                    : "Add to order"
                              }
                              className={`
                                flex items-center justify-center w-10 h-10 rounded-lg text-sm font-medium transition-all
                                ${cannotAddProduct || isPricingLoading
                                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                  : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm hover:shadow'
                                }
                              `}
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  });
                  })()}
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
                                max={stockAvailable}
                                value={line.quantity}
                                onChange={(e) => handleUpdateQuantity(line.product_id, parseInt(e.target.value) || 0)}
                                className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                              />
                              <span className="text-xs text-gray-500">
                                (max: {stockAvailable})
                              </span>
                            </div>
                            <div className="text-right">
                              <div className="text-sm text-gray-600">
                                {formatCurrencySync(line.unit_price)} each
                              </div>
                              <div className="font-medium text-gray-900">
                                {formatCurrencySync(line.subtotal)}
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
                          {formatCurrencySync(orderTotal)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center mb-2">
                        <label className="text-sm font-medium text-gray-700">Tax (%)</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={taxPercent}
                          onChange={e => {
                            const value = Number(e.target.value);
                            // Ensure value is within valid range (0-100)
                            if (value >= 0 && value <= 100) {
                              setTaxPercent(value);
                            }
                          }}
                          className="w-24 px-2 py-1 border border-gray-300 rounded text-sm text-right"
                        />
                      </div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-lg font-medium text-gray-900">Tax:</span>
                        <span className="text-lg font-bold text-gray-900">
                          {formatCurrencySync(taxAmount)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-lg font-semibold text-gray-900">Total:</span>
                        <span className="text-xl font-bold text-green-700">
                          {formatCurrencySync(grandTotal)}
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
                  <div>
                    <label className="text-sm font-medium text-gray-600">Source Warehouse:</label>
                    <div className="text-gray-900">
                      {warehouses.find(w => w.id === selectedWarehouseId)?.name || 'Unknown Warehouse'}
                    </div>
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
                          {line.quantity} × {formatCurrencySync(line.unit_price)}
                        </div>
                      </div>
                      <div className="font-medium text-gray-900">
                        {formatCurrencySync(line.subtotal)}
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-between items-center pt-3 border-t border-gray-300">
                    <span className="text-lg font-medium text-gray-900">Subtotal:</span>
                    <span className="text-xl font-bold text-gray-900">
                      {formatCurrencySync(orderTotal)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-medium text-gray-900">Tax:</span>
                    <span className="text-lg font-bold text-gray-900">
                      {formatCurrencySync(taxAmount)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-semibold text-gray-900">Total:</span>
                    <span className="text-xl font-bold text-green-700">
                      {formatCurrencySync(grandTotal)}
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
      {/* Inline Address Creation Modal */}
      <AddressForm
        isOpen={isAddressFormOpen}
        onClose={() => setIsAddressFormOpen(false)}
        onSubmit={handleAddressSubmit}
        customerId={selectedCustomerId}
        loading={createAddress.isPending}
        title="Add New Address"
        isFirstAddress={addresses.length === 0}
      />
    </div>
  );
};