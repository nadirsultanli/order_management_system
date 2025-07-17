import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, ShoppingCart, User, MapPin, Calendar, Package, AlertTriangle, X, Check, Info, DollarSign, RotateCcw } from 'lucide-react';
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
import { SearchableWarehouseSelector } from '../components/warehouses/SearchableWarehouseSelector';
import { OrderTypeSelector } from '../components/orders/OrderTypeSelector';
import { OrderFlowTypeSelector } from '../components/orders/OrderFlowTypeSelector';
import { CrossSellSuggestions } from '../components/orders/CrossSellSuggestions';
import { useProductPrices, useActivePriceLists } from '../hooks/useProductPricing';
import { useInventoryNew } from '../hooks/useInventory';
import { useWarehouses } from '../hooks/useWarehouses';
import { Warehouse } from '../types/warehouse';

interface OrderLineItem {
  product_id: string;
  product_name: string;
  product_sku: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  // Tax information (fixed at order creation time)
  price_excluding_tax?: number;
  tax_amount?: number;
  price_including_tax?: number;
  tax_rate?: number;
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
  // Tax is now calculated automatically from product pricing
  // const [taxPercent, setTaxPercent] = useState(0);
  
  // Add state for inline address creation
  const [isAddressFormOpen, setIsAddressFormOpen] = useState(false);
  
  
  // Warehouse selection state
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  
  // Order type selection state
  const [selectedVariant, setSelectedVariant] = useState<'delivery' | 'visit'>('delivery');
  // Order flow type for cylinder management
  const [orderFlowType, setOrderFlowType] = useState<'outright' | 'exchange' | null>(null);
  // Remove exchangeEmptyQty and requiresPickup states
  
  // Cross-sell suggestions state
  const [showCrossSellSuggestions, setShowCrossSellSuggestions] = useState(false);
  const [dismissedCrossSell, setDismissedCrossSell] = useState(false);

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
  const productIds = products.map((p: Product) => p.id);
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

  // Calculate totals automatically from product pricing data
  useEffect(() => {
    const calculateTotals = () => {
      if (orderLines.length === 0) {
        setOrderCalculations({ subtotal: 0, taxAmount: 0, grandTotal: 0 });
        return;
      }

      // Calculate subtotal and tax from order lines with product pricing
      let subtotal = 0;  // Sum of ex-tax amounts
      let taxAmount = 0; // Sum of tax amounts
      let grandTotal = 0; // Sum of including-tax amounts
      
      orderLines.forEach(line => {
        // Use price_excluding_tax for subtotal
        if (line.price_excluding_tax !== undefined) {
          subtotal += line.price_excluding_tax * line.quantity;
        } else {
          // Fallback to unit_price if tax fields not available
          subtotal += line.unit_price * line.quantity;
        }
        
        // Use tax amount from product pricing
        if (line.tax_amount !== undefined) {
          taxAmount += line.tax_amount * line.quantity;
        }
        
        // Use price_including_tax for grand total
        if (line.price_including_tax !== undefined) {
          grandTotal += line.price_including_tax * line.quantity;
        } else {
          // Fallback to unit_price + tax if tax fields not available
          grandTotal += line.unit_price * line.quantity + (line.tax_amount || 0) * line.quantity;
        }
      });
      
      setOrderCalculations({
        subtotal,
        taxAmount,
        grandTotal
      });
    };

    calculateTotals();
  }, [orderLines]);

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

  const handleVariantChange = (variant: 'delivery' | 'visit') => {
    setSelectedVariant(variant);
    // Clear order lines when variant changes to prevent mixing variants
    setOrderLines([]);
  };

  // Remove handleExchangeEmptyQtyChange and handleRequiresPickupChange

  const handleCustomerCreated = (newCustomer: Customer) => {
    // The customer list will be automatically refetched by the useCustomers hook
    // due to the invalidation in the mutation's onSuccess callback
    console.log('New customer created:', newCustomer);
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

  // Cross-sell suggestion logic
  const getCylinderProductsInOrder = (): Product[] => {
    return orderLines
      .map(line => products.find(p => p.id === line.product_id))
      .filter((product): product is Product => 
        product !== undefined && 
        (product.product_type === 'cylinder' || !product.product_type)
      );
  };

  const getSuggestedAccessories = (): Product[] => {
    const cylinderProducts = getCylinderProductsInOrder();
    if (cylinderProducts.length === 0) return [];

    // Get common accessories that pair well with cylinders
    const suggestedAccessories = products.filter((product: Product) => {
      // Only show accessories that are active and have stock
      if (product.product_type !== 'accessory' || product.status !== 'active') return false;
      
      // Check if already in order
      const isAlreadyInOrder = orderLines.some(line => line.product_id === product.id);
      if (isAlreadyInOrder) return false;

      // Check if has pricing
      if (!hasProductPricing(product.id)) return false;

      // Check if has stock
      const stockAvailable = getStockInfo(product.id);
      if (stockAvailable <= 0) return false;

      // Suggest regulators and hoses for cylinders
      const isRegulator = product.sku.includes('REG') || product.name.toLowerCase().includes('regulator');
      const isHose = product.sku.includes('HOSE') || product.name.toLowerCase().includes('hose');
      
      return isRegulator || isHose;
    });

    return suggestedAccessories.slice(0, 3); // Limit to 3 suggestions
  };

  // Check if we should show cross-sell suggestions
  const shouldShowCrossSellSuggestions = (): boolean => {
    if (dismissedCrossSell) return false;
    const cylinderProducts = getCylinderProductsInOrder();
    const suggestedAccessories = getSuggestedAccessories();
    return cylinderProducts.length > 0 && suggestedAccessories.length > 0;
  };

  const handleAddProduct = async (productId: string) => {
    const product = products.find((p: Product) => p.id === productId);
    if (!product) {
      console.error('Product not found in products list:', productId);
      console.log('Available products:', products.map((p: Product) => ({ id: p.id, name: p.name })));
      return;
    }

    const existingLine = orderLines.find((line: OrderLineItem) => line.product_id === productId);
    const stockAvailable = getStockInfo(productId);
    
    // Get pricing information with tax breakdown
    const pricingInfo = productPrices && productPrices[productId];
    const unitPrice = pricingInfo?.finalPrice || 0;
    
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
      // Add new line with tax information from pricing
      const newLine: OrderLineItem = {
        product_id: productId,
        product_name: product.name,
        product_sku: product.sku,
        quantity: 1,
        unit_price: unitPrice,
        subtotal: unitPrice,
        // Include tax information from product/pricing
        price_excluding_tax: pricingInfo?.priceExcludingTax,
        tax_amount: pricingInfo?.taxAmount,
        price_including_tax: pricingInfo?.priceIncludingTax,
        tax_rate: pricingInfo?.taxRate,
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
    if (!selectedCustomerId || !selectedAddressId || !selectedWarehouseId || 
        (selectedVariant === 'delivery' && orderLines.length === 0)) {
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
      // Create scheduled_date if needed
      const scheduledDateTime = scheduledDate && scheduledTime 
        ? new Date(`${scheduledDate}T${scheduledTime}`).toISOString()
        : undefined;
      
      // Determine order flow type for automatic empty return credit generation
      const determineOrderFlowType = () => {
        // If explicitly selected, use that
        if (orderFlowType) {
          return orderFlowType === 'exchange' ? 'exchange' : 'outright';
        }
        
        // Auto-determine based on products in order
        if (selectedVariant === 'delivery' && orderLines.length > 0) {
          const hasFullXchProducts = orderLines.some((line: OrderLineItem) => {
            const product = products.find((p: Product) => p.id === line.product_id);
            return product?.sku_variant === 'FULL-XCH';
          });
          
          const hasFullOutProducts = orderLines.some((line: OrderLineItem) => {
            const product = products.find((p: Product) => p.id === line.product_id);
            return product?.sku_variant === 'FULL-OUT';
          });
          
          // If has FULL-XCH products, it's an exchange order
          if (hasFullXchProducts) return 'exchange';
          // If has FULL-OUT products, it's an outright purchase
          if (hasFullOutProducts) return 'outright';
        }
        
        // Default for non-delivery orders or unclear cases
        return null;
      };

      // Create the order with order lines
      const orderData = {
        customer_id: selectedCustomerId,
        delivery_address_id: selectedAddressId,
        source_warehouse_id: selectedWarehouseId,
        order_date: orderDate,
        scheduled_date: scheduledDateTime,
        notes,
        order_type: selectedVariant,
        order_flow_type: determineOrderFlowType(),
        // Include order lines for proper backend processing with tax information (only for delivery orders)
        order_lines: selectedVariant === 'delivery' ? orderLines.map(line => ({
          product_id: line.product_id,
          quantity: line.quantity,
          unit_price: line.unit_price,
          // Include tax information (fixed at order creation time)
          price_excluding_tax: line.price_excluding_tax,
          tax_amount: line.tax_amount,
          price_including_tax: line.price_including_tax,
          tax_rate: line.tax_rate,
        })) : undefined,
      };

      console.log('Creating order with data:', orderData);
      console.log('Selected warehouse ID:', selectedWarehouseId);
      console.log('Order lines product IDs:', orderLines.map((l: OrderLineItem) => l.product_id));
      console.log('Products available:', products.map((p: Product) => ({ id: p.id, name: p.name, status: p.status })));

      // Check if products are still loading
      if (isProductsLoading) {
        alert('Products are still loading. Please wait a moment and try again.');
        return;
      }

      // Validate all products exist before creating order
      const invalidProducts = orderLines.filter((line: OrderLineItem) => 
        !products.find((p: Product) => p.id === line.product_id)
      );
      
      if (invalidProducts.length > 0) {
        console.error('Invalid products found in order lines:', invalidProducts);
        console.error('Available products:', products.map((p: Product) => ({ id: p.id, name: p.name })));
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
  const canCreateOrder = canProceedToStep2 && 
    (selectedVariant === 'visit' || orderLines.length > 0) && 
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
            onClick={() => {
              if (step === 1) {
                navigate('/orders');
              } else if (step === 2) {
                setStep(1);
              } else if (step === 3) {
                setStep(2);
              }
            }}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>
              {step === 1 && 'Back to Orders'}
              {step === 2 && 'Back to Customer & Delivery'}
              {step === 3 && 'Back to Add Products'}
            </span>
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
            <div className="col-span-full">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Order Type *
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div 
                  className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    selectedVariant === 'delivery' 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                  onClick={() => setSelectedVariant('delivery')}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        selectedVariant === 'delivery' ? 'border-blue-500' : 'border-gray-300'
                      }`}>
                        {selectedVariant === 'delivery' && (
                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        )}
                      </div>
                      <ShoppingCart className="h-5 w-5 text-blue-600" />
                      <div>
                        <h3 className="font-medium text-gray-900">Delivery Order</h3>
                        <p className="text-sm text-gray-500">Regular order with specific products and quantities</p>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div 
                  className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    selectedVariant === 'visit' 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                  onClick={() => setSelectedVariant('visit')}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        selectedVariant === 'visit' ? 'border-blue-500' : 'border-gray-300'
                      }`}>
                        {selectedVariant === 'visit' && (
                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        )}
                      </div>
                      <Calendar className="h-5 w-5 text-purple-600" />
                      <div>
                        <h3 className="font-medium text-gray-900">Visit Order</h3>
                        <p className="text-sm text-gray-500">Schedule a visit without specific products</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Customer Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <User className="inline h-4 w-4 mr-1" />
                  Customer *
                </label>
                <CustomerSelector
                  value={selectedCustomerId}
                  onChange={handleCustomerChange}
                  customers={customers}
                  placeholder="Search for a customer..."
                  onCustomerCreated={handleCustomerCreated}
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
                <SearchableWarehouseSelector
                  value={selectedWarehouseId}
                  onChange={setSelectedWarehouseId}
                  placeholder="Warehouse"
                  required
                />
                <p className="mt-1 text-xs text-gray-500">
                  Stock availability will be checked from the selected warehouse
                </p>
              </div>
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
                        {addresses.map((address: Address) => (
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
            {/* Order Type Selection */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <OrderTypeSelector
                orderType={selectedVariant}
                onOrderTypeChange={handleVariantChange}
              />
            </div>
            
            {/* Order Flow Type Selection (for delivery orders with cylinders) */}
            {selectedVariant === 'delivery' && (() => {
              // Check if there are any cylinder products available
              const hasCylinders = products.some((p: Product) => 
                p.status === 'active' && 
                (p.product_type === 'cylinder' || !p.product_type) && 
                getStockInfo(p.id) > 0
              );
              
              return hasCylinders && (
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <OrderFlowTypeSelector
                    orderFlowType={orderFlowType}
                    onOrderFlowTypeChange={setOrderFlowType}
                  />
                </div>
              );
            })()}
            
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
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  Available Products ({selectedVariant === 'delivery' ? 'Delivery' : 'Visit'})
                </h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {(() => {
                    const availableProducts = products.filter((p: Product) => {
                      // Only show active products that have stock in the selected warehouse
                      if (p.status !== 'active') return false;
                      
                      // Handle cylinder-specific filtering
                      if (p.product_type === 'cylinder' || !p.product_type) {
                        // Prevent EMPTY variants from being sold
                        if (p.sku_variant === 'EMPTY') return false;
                        
                        // Filter by order flow type for cylinder variants
                        if (orderFlowType && p.sku_variant) {
                          if (orderFlowType === 'outright' && p.sku_variant !== 'FULL-OUT') return false;
                          if (orderFlowType === 'exchange' && p.sku_variant !== 'FULL-XCH') return false;
                        }
                      }
                      
                      // Accessories don't have Full/Empty variants and are not affected by order flow type
                      // They can be sold with any order flow type
                      
                      const stockAvailable = getStockInfo(p.id);
                      // Filter by selected variant
                      if (p.variant && p.variant !== selectedVariant) return false;
                      return stockAvailable > 0;
                    });
                    
                    if (availableProducts.length === 0) {
                      return (
                        <div className="text-center py-8 text-gray-500">
                          <Package className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                          <p className="text-lg font-medium">No {selectedVariant} products available</p>
                          <p className="text-sm">
                            {selectedWarehouseId 
                              ? `No ${selectedVariant} products have stock in the selected warehouse.` 
                              : 'Please select a warehouse to see available products.'}
                          </p>
                        </div>
                      );
                    }
                    
                    return availableProducts.map((product: Product) => {
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
                            
                            {/* Product-specific Information */}
                            {product.product_type === 'accessory' ? (
                              <div className="text-sm text-gray-600 mb-2">
                                <div className="flex flex-wrap gap-3">
                                  {product.brand && <span>Brand: {product.brand}</span>}
                                  {product.connection_type && <span>Connection: {product.connection_type}</span>}
                                  {product.outlet_pressure && <span>Pressure: {product.outlet_pressure}</span>}
                                  {product.length_m && <span>Length: {product.length_m}m</span>}
                                  {product.wattage && <span>Power: {product.wattage}W</span>}
                                  {product.fuel_type && <span>Fuel: {product.fuel_type}</span>}
                                </div>
                              </div>
                            ) : (
                              <div className="text-sm text-gray-600 mb-2">
                                <div className="flex flex-wrap gap-3">
                                  {product.capacity_kg && <span>Capacity: {product.capacity_kg}kg</span>}
                                  {product.valve_type && <span>Valve: {product.valve_type}</span>}
                                  {product.sku_variant && <span>Type: {product.sku_variant}</span>}
                                </div>
                              </div>
                            )}
                            
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

            {/* Cross-sell Suggestions */}
            {shouldShowCrossSellSuggestions() && (
              <CrossSellSuggestions
                cylinderProducts={getCylinderProductsInOrder()}
                suggestedProducts={getSuggestedAccessories()}
                onAddProduct={(product) => handleAddProduct(product.id)}
                onDismiss={() => setDismissedCrossSell(true)}
                getProductPrice={getProductPriceSync}
              />
            )}

            <div className="flex justify-between">
              <button
                onClick={() => setStep(1)}
                className="bg-gray-100 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-200"
              >
                Back
              </button>
              <button
                onClick={handleCreateOrder}
                disabled={!canCreateOrder || createOrder.isPending}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                <ShoppingCart className="h-4 w-4" />
                <span>{createOrder.isPending ? 'Creating...' : 'Create Order'}</span>
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
                      {warehouses.find((w: Warehouse) => w.id === selectedWarehouseId)?.name || 'Unknown Warehouse'}
                    </div>
                  </div>
                  {notes && (
                    <div>
                      <label className="text-sm font-medium text-gray-600">Notes:</label>
                      <div className="text-gray-900">{notes}</div>
                    </div>
                  )}
                  <div>
                    <label className="text-sm font-medium text-gray-600">Tax:</label>
                    <div className="text-gray-900">
                      {formatCurrencySync(taxAmount)}
                    </div>
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

            {/* Empty Return Credits Preview */}
            {(() => {
              // Calculate expected empty return credits for FULL-XCH cylinder products
              const exchangeProducts = orderLines.filter((line: OrderLineItem) => {
                const product = products.find((p: Product) => p.id === line.product_id);
                return product?.sku_variant === 'FULL-XCH' && 
                       (product?.product_type === 'cylinder' || !product?.product_type);
              });

              if (exchangeProducts.length === 0) return null;

              return (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="text-lg font-medium text-blue-900 mb-3 flex items-center">
                    <RotateCcw className="h-5 w-5 mr-2" />
                    Empty Return Credits (Auto-Generated)
                  </h3>
                  <p className="text-sm text-blue-800 mb-3">
                    The following empty return credits will be automatically created for exchange products:
                  </p>
                  <div className="space-y-2">
                    {exchangeProducts.map((line: OrderLineItem) => {
                      const product = products.find((p: Product) => p.id === line.product_id);
                      if (!product) return null;
                      
                      // Estimate deposit amount (this would ideally come from deposit rates)
                      const estimatedDeposit = product.capacity_kg ? product.capacity_kg * 50 : 0; // Rough estimate
                      
                      return (
                        <div key={line.product_id} className="flex justify-between items-center py-2 bg-white rounded px-3">
                          <div>
                            <div className="font-medium text-gray-900">{product.name}</div>
                            <div className="text-sm text-gray-600">
                              {line.quantity} empty cylinder{line.quantity > 1 ? 's' : ''} expected to return
                            </div>
                            <div className="text-xs text-blue-600">
                              Return by: {new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString()} 
                              (Expires: {new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()})
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-medium text-green-600">
                              +{formatCurrencySync(estimatedDeposit * line.quantity)}
                            </div>
                            <div className="text-xs text-gray-500">credit value</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-3 pt-3 border-t border-blue-200">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-blue-900">Total Empty Return Credit:</span>
                      <span className="font-bold text-green-600">
                        +{formatCurrencySync(
                          exchangeProducts.reduce((total: number, line: OrderLineItem) => {
                            const product = products.find((p: Product) => p.id === line.product_id);
                            const estimatedDeposit = product?.capacity_kg ? product.capacity_kg * 50 : 0;
                            return total + (estimatedDeposit * line.quantity);
                          }, 0)
                        )}
                      </span>
                    </div>
                    <p className="text-xs text-blue-700 mt-1">
                      * Credit amounts are estimates. Actual amounts will be based on current deposit rates.
                    </p>
                  </div>
                </div>
              );
            })()}

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