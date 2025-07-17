import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Package, User, MapPin, Calendar, ShoppingCart, AlertTriangle, Plus, X, Info, DollarSign, Trash2, Clock, FileText, ChevronRight, Gauge } from 'lucide-react';
import { useCustomers } from '../hooks/useCustomers';
import { useAddresses, useCreateAddress } from '../hooks/useAddresses';
import { useProducts } from '../hooks/useProducts';
import { useCreateOrderNew } from '../hooks/useOrders';
import { useWarehouses } from '../hooks/useWarehouses';
import { useInventoryNew } from '../hooks/useInventory';
import { useProductPrices } from '../hooks/useProductPricing';
import { useDepositRateByCapacity, useAllDepositRates } from '../hooks/useDeposits';
import { formatCurrencySync } from '../utils/pricing';
import { formatAddressForSelect } from '../utils/address';
import { CustomerSelector } from '../components/customers/CustomerSelector';
import { AddressForm } from '../components/addresses/AddressForm';
import { trpc } from '../lib/trpc-client';
import { FillPercentageSelector } from '../components/orders/FillPercentageSelector';
import { CreateOrderData } from '../types/order';
import { CreateAddressData, Address } from '../types/address';
import { Customer } from '../types/customer';
import { Product } from '../types/product';
import { Warehouse } from '../types/warehouse';

interface OrderLineItem {
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
  // Partial fill fields
  fill_percentage?: number;
  is_partial_fill?: boolean;
  partial_fill_notes?: string;
  // Product info for fill logic
  variant_type?: 'cylinder' | 'refillable' | 'disposable';
  unit_of_measure?: string;
  // Enhanced pricing breakdown
  gas_charge?: number;
  deposit_amount?: number;
  adjusted_weight?: number;
  original_weight?: number;
  pricing_method?: string;
}

export const CreateOrderPageV2: React.FC = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  
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
  // Fill percentages for gas products
  const [fillPercentages, setFillPercentages] = useState<{[key: string]: number}>({});
  const [fillNotes, setFillNotes] = useState<{[key: string]: string}>({});
  
  // Step 4: Delivery Notes
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().split('T')[0]);
  const [deliveryTimeStart, setDeliveryTimeStart] = useState('');
  const [deliveryTimeEnd, setDeliveryTimeEnd] = useState('');
  const [deliveryInstructions, setDeliveryInstructions] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  
  // Step 5: Review
  const [orderStatus, setOrderStatus] = useState<'draft' | 'confirmed'>('draft');
  
  // Data hooks - Optimized for parallel loading
  const { data: customersData } = useCustomers({ limit: 1000 });
  const { data: addresses = [] } = useAddresses(selectedCustomerId);
  const { data: productsData, isLoading: isProductsLoading } = useProducts({ 
    limit: 1000,
    is_variant: true // Only show variants, not parent products
  });
  const { data: warehousesData } = useWarehouses({ limit: 1000 });
  const { data: inventoryData } = useInventoryNew({});
  const createOrder = useCreateOrderNew();
  const createAddress = useCreateAddress();
  
  const customers = customersData?.customers || [];
  const products = productsData?.products || [];
  const warehouses = warehousesData?.warehouses || [];
  
  const selectedCustomer = customers.find((c: Customer) => c.id === selectedCustomerId);
  const selectedAddress = addresses.find((a: Address) => a.id === selectedAddressId);
  const selectedWarehouse = warehouses.find((w: Warehouse) => w.id === selectedWarehouseId);
  
  // Get product IDs immediately - don't wait for full product load
  const productIds = useMemo(() => {
    return products.map(p => p.id);
  }, [products]);
  
  // Prefetch product prices early - even if products are still loading
  const { data: productPrices, isLoading: isPricesLoading } = useProductPrices(
    productIds, 
    selectedCustomerId || undefined, 
    productIds.length > 0 // Enable as soon as we have product IDs
  );
  
  // Prefetch deposit rates immediately - they don't depend on products
  const { data: depositRatesData, isLoading: isDepositRatesLoading } = useAllDepositRates();
  const depositRates = depositRatesData?.rates || [];
  
  // Create deposit lookup function
  const getDepositAmountByCapacity = (product: any): number => {
    if (!product) {
      console.log('❌ getDepositAmountByCapacity: No product provided');
      return 0;
    }
    
    console.log('🔍 getDepositAmountByCapacity called for product:', {
      id: product.id,
      sku: product.sku,
      name: product.name,
      is_variant: product.is_variant,
      parent_products_id: product.parent_products_id,
      capacity_l: product.capacity_l,
      capacity_kg: product.capacity_kg,
      fullProduct: product
    });
    
    // Get capacity from the product itself first (if it has capacity_l)
    let capacityL = product.capacity_l;
    
    // If no direct capacity_l, check if this is a variant and use capacity_kg
    if (!capacityL && product.capacity_kg) {
      // For LPG cylinders, capacity in kg is approximately equal to capacity in liters
      // 6kg ≈ 6L, 13kg ≈ 13L, 25kg ≈ 25L, 50kg ≈ 50L
      capacityL = product.capacity_kg;
      console.log(`🔄 Using capacity_kg (${product.capacity_kg}) as capacity_l for product ${product.sku}`);
    }
    
    if (!capacityL || capacityL <= 0) {
      console.log(`❌ No valid capacity found for product ${product.sku}. capacity_l: ${product.capacity_l}, capacity_kg: ${product.capacity_kg}`);
      return 0;
    }
    
    console.log(`📏 Using capacity ${capacityL}L for deposit lookup`);
    
    // Find exact match first in deposit rates
    const exactMatch = depositRates.find(rate => rate.capacity_l === capacityL);
    if (exactMatch) {
      console.log(`✅ Found exact deposit rate for ${capacityL}L: ${exactMatch.deposit_amount} ${exactMatch.currency_code || 'KES'}`);
      return exactMatch.deposit_amount;
    }
    
    // If no exact match, find closest capacity
    const sortedRates = depositRates
      .filter(rate => rate.capacity_l > 0)
      .sort((a, b) => Math.abs(a.capacity_l - capacityL) - Math.abs(b.capacity_l - capacityL));
    
    if (sortedRates.length > 0) {
      console.log(`🔍 Using closest deposit rate: ${sortedRates[0].capacity_l}L (${sortedRates[0].deposit_amount}) for ${capacityL}L capacity`);
      return sortedRates[0].deposit_amount;
    }
    
    console.log(`⚠️ No deposit rates found in database, using fallback values. Available rates:`, depositRates);
    
    // Fallback based on common cylinder sizes if no database data
    // Based on your screenshot: 6L=2500, 13L=3500, 25L=5500, 50L=8500, etc.
    if (capacityL === 6) return 2500;
    else if (capacityL === 13) return 3500;
    else if (capacityL === 25) return 5500;
    else if (capacityL === 50) return 8500;
    else if (capacityL === 60) return 10000;
    else {
      console.log(`⚠️ No fallback for capacity ${capacityL}L, using default 2500`);
      return 2500; // Default fallback
    }
  };
  
  // Auto-select primary address when customer changes
  useEffect(() => {
    if (selectedCustomerId && addresses.length > 0 && !selectedAddressId) {
      const primaryAddress = addresses.find((a: Address) => a.is_primary);
      if (primaryAddress) {
        setSelectedAddressId(primaryAddress.id);
      } else {
        setSelectedAddressId(addresses[0].id);
      }
    }
  }, [selectedCustomerId, addresses, selectedAddressId]);
  
  // Prefetch pricing data when user selects customer (Step 2) to prepare for Step 3
  useEffect(() => {
    if (selectedCustomerId && products.length > 0 && currentStep >= 2) {
      console.log('🚀 Prefetching pricing data for Step 3...');
      // This will trigger the pricing queries to start loading early
      // so they're ready when user reaches Step 3
    }
  }, [selectedCustomerId, products.length, currentStep]);
  
  // Prefetch pricing data when component mounts to reduce Step 3 loading time
  useEffect(() => {
    // Trigger deposit rates fetch immediately when component loads
    if (depositRates.length === 0 && !isDepositRatesLoading) {
      console.log('🚀 Prefetching deposit rates for faster Step 3 loading...');
    }
  }, []);
  
  // Load delivery instructions from selected address
  useEffect(() => {
    if (selectedAddress) {
      // Set time window from address if available
      if (selectedAddress.delivery_window_start) {
        setDeliveryTimeStart(selectedAddress.delivery_window_start);
      }
      if (selectedAddress.delivery_window_end) {
        setDeliveryTimeEnd(selectedAddress.delivery_window_end);
      }
      // Set instructions from address
      if (selectedAddress.instructions) {
        setDeliveryInstructions(selectedAddress.instructions);
      }
    }
  }, [selectedAddress]);
  
  // Calculate order totals with deposits
  const calculateTotals = useMemo(() => {
    let subtotal = 0;
    let depositTotal = 0;
    let taxAmount = 0;
    let grandTotal = 0;
    
    // Calculate based on order lines which have proper tax calculation
    orderLines.forEach(line => {
      // Use price_excluding_tax (gas price before tax) for subtotal
      const gasPrice = line.price_excluding_tax || line.unit_price;
      subtotal += gasPrice * line.quantity;
      
      // Add tax amount from order line
      if (line.tax_amount !== undefined) {
        taxAmount += line.tax_amount * line.quantity;
      }
      
      // Add deposit amount from order line if available
      if (line.deposit_amount !== undefined) {
        depositTotal += line.deposit_amount * line.quantity;
      }
    });
    
    // If order lines don't have deposit amounts, calculate them separately
    // This is a fallback in case the order lines aren't updated yet
    if (depositTotal === 0) {
      Object.entries(selectedProducts).forEach(([productId, quantity]) => {
        const product = products.find(p => p.id === productId);
        if (product && product.capacity_l && product.capacity_l > 0) {
          const depositRate = getDepositAmountByCapacity(product);
          depositTotal += depositRate * quantity;
        }
      });
    }
    
    grandTotal = subtotal + depositTotal + taxAmount;
    
    return { subtotal, taxAmount, grandTotal, depositTotal };
  }, [orderLines, selectedProducts, products]);
  
  const { subtotal, taxAmount, grandTotal, depositTotal } = calculateTotals;
  
  // Utility function to check if a product supports partial fills (gas cylinders)
  const isGasProduct = (product: Product) => {
    return product.variant_type === 'cylinder' || product.variant_type === 'refillable';
  };
  
  // Utility function to calculate pro-rated pricing for partial fills
  const calculatePartialFillPrice = (basePrice: number, fillPercentage: number) => {
    if (fillPercentage >= 100) return basePrice;
    // For partial fills, reduce the entire price proportionally
    // Note: Deposits will be added separately at checkout
    return basePrice * (fillPercentage / 100);
  };
  
  // Get available warehouses based on selected products
  const getAvailableWarehouses = () => {
    if (!inventoryData?.inventory || Object.keys(selectedProducts).length === 0) {
      return warehouses;
    }
    
    // Filter warehouses that have ALL selected products with required quantities
    return warehouses.filter(warehouse => {
      return Object.entries(selectedProducts).every(([productId, requiredQty]) => {
        const warehouseInventory = inventoryData.inventory.filter(
          (inv: any) => inv.product_id === productId && inv.warehouse_id === warehouse.id
        );
        
        if (warehouseInventory.length === 0) return false;
        
        const totalAvailable = warehouseInventory.reduce(
          (sum: number, inv: any) => {
            const qtyFull = Number(inv.qty_full) || 0;
            const qtyReserved = Number(inv.qty_reserved) || 0;
            const available = Math.max(0, qtyFull - qtyReserved);
            return sum + available;
          }, 
          0
        );
        
        return totalAvailable >= requiredQty;
      });
    });
  };
  
  const availableWarehouses = getAvailableWarehouses();
  
  // Get stock info for a product in selected warehouse
  const getStockInfo = (productId: string) => {
    if (!inventoryData?.inventory || !selectedWarehouseId) {
      return 0;
    }
    
    const productInventory = inventoryData.inventory.filter(
      (inv: any) => inv.product_id === productId && inv.warehouse_id === selectedWarehouseId
    );
    
    if (productInventory.length === 0) return 0;
    
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
  
  // Component to handle product pricing with deposits - Optimized for faster loading
  const ProductPricingWithDeposit = ({ product, quantity, fillPercentage }: { product: any, quantity: number, fillPercentage: number }) => {
    const pricingInfo = productPrices && productPrices[product.id];
    const isPartialFill = fillPercentage < 100;
    const isPricingLoaded = !isPricesLoading && !isDepositRatesLoading;
    
    // Get base gas price
    let gasPrice = pricingInfo?.finalPrice || 0;
    if (isGasProduct(product) && isPartialFill) {
      gasPrice = calculatePartialFillPrice(gasPrice, fillPercentage);
    }
    
    // Get deposit rate for this product's capacity - with fallback for fast display
    const depositAmount = getDepositAmountByCapacity(product);
    
    // Calculate totals
    const totalGasPrice = gasPrice * quantity;
    const totalDepositPrice = depositAmount * quantity;
    const totalPrice = totalGasPrice + totalDepositPrice;
    
    // Show loading state if data isn't ready
    if (!isPricingLoaded && (gasPrice === 0 || depositAmount === 0)) {
      return (
        <div className="space-y-1">
          <div className="text-sm text-gray-400 animate-pulse">
            Loading pricing...
          </div>
        </div>
      );
    }
    
    return (
      <div className="space-y-1">
        <div className="text-sm text-gray-500">
          Gas: {quantity} × {formatCurrencySync(gasPrice)} = {formatCurrencySync(totalGasPrice)}
          {isPartialFill && (
            <span className="text-orange-600 ml-1">(Partial Fill - {fillPercentage}%)</span>
          )}
        </div>
        {depositAmount > 0 && (
          <div className="text-sm text-blue-600">
            Deposit: {quantity} × {formatCurrencySync(depositAmount)} = {formatCurrencySync(totalDepositPrice)}
          </div>
        )}
        <div className="text-sm font-medium text-gray-900">
          Total: {formatCurrencySync(totalPrice)}
        </div>
      </div>
    );
  };
  
  // Handle customer change
  const handleCustomerChange = (customerId: string) => {
    setSelectedCustomerId(customerId);
    setSelectedAddressId('');
    setSelectedProducts({});
    setOrderLines([]);
    setFillPercentages({});
    setFillNotes({});
  };
  
  // Handle order type change
  const handleOrderTypeChange = (newOrderType: 'delivery' | 'visit') => {
    setOrderType(newOrderType);
    // Clear warehouse selection when switching to delivery (will be auto-selected in step 3)
    if (newOrderType === 'delivery') {
      setSelectedWarehouseId('');
    }
    // Clear products and order lines when switching order type
    setSelectedProducts({});
    setOrderLines([]);
    setFillPercentages({});
    setFillNotes({});
  };
  
  // Handle product selection
  const handleProductSelect = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      const newProducts = { ...selectedProducts };
      const newFillPercentages = { ...fillPercentages };
      const newFillNotes = { ...fillNotes };
      delete newProducts[productId];
      delete newFillPercentages[productId];
      delete newFillNotes[productId];
      setSelectedProducts(newProducts);
      setFillPercentages(newFillPercentages);
      setFillNotes(newFillNotes);
    } else {
      setSelectedProducts({
        ...selectedProducts,
        [productId]: quantity
      });
      
      // Initialize fill percentage to 100% for new gas products
      const product = products.find(p => p.id === productId);
      if (product && isGasProduct(product) && !fillPercentages[productId]) {
        setFillPercentages({
          ...fillPercentages,
          [productId]: 100
        });
      }
    }
  };
  
  // Handle fill percentage changes
  const handleFillPercentageChange = (productId: string, percentage: number, notes?: string) => {
    setFillPercentages({
      ...fillPercentages,
      [productId]: percentage
    });
    
    if (notes !== undefined) {
      setFillNotes({
        ...fillNotes,
        [productId]: notes
      });
    }
  };
  
  // Update order lines when warehouse is selected
  useEffect(() => {
    if (selectedWarehouseId && Object.keys(selectedProducts).length > 0) {
      const newOrderLines: OrderLineItem[] = [];
      
      Object.entries(selectedProducts).forEach(([productId, quantity]) => {
        const product = products.find(p => p.id === productId);
        if (!product) return;
        
        const pricingInfo = productPrices && productPrices[productId];
        let unitPrice = pricingInfo?.finalPrice || 0;
        const fillPercentage = fillPercentages[productId] || 100;
        const isPartialFill = fillPercentage < 100;
        
        // Apply pro-rated pricing for gas products with partial fills
        if (isGasProduct(product) && isPartialFill) {
          unitPrice = calculatePartialFillPrice(unitPrice, fillPercentage);
        }
        
        // Calculate tax amount based on gas price (even for partial fills)
        const taxRate = pricingInfo?.taxRate || 0.16; // 16% default
        const gasPrice = unitPrice; // This is the gas price after partial fill adjustment
        const taxAmountPerUnit = gasPrice * taxRate;
        
        // Calculate deposit amount based on capacity
        let depositAmountPerUnit = 0;
        if (product.capacity_l && product.capacity_l > 0) {
          depositAmountPerUnit = getDepositAmountByCapacity(product);
        }
        
        newOrderLines.push({
          product_id: productId,
          product_name: product.name,
          product_sku: product.sku,
          quantity,
          unit_price: unitPrice,
          subtotal: unitPrice * quantity,
          price_excluding_tax: gasPrice, // Gas price before tax
          tax_amount: taxAmountPerUnit, // Tax on gas portion only
          price_including_tax: gasPrice + taxAmountPerUnit, // Gas price including tax
          tax_rate: taxRate,
          // Add deposit amount to order line
          deposit_amount: depositAmountPerUnit,
          // Fill percentage data
          fill_percentage: fillPercentage,
          is_partial_fill: isPartialFill,
          partial_fill_notes: fillNotes[productId] || '',
          // Product info for display
          variant_type: product.variant_type,
          unit_of_measure: product.unit_of_measure,
        });
      });
      
      setOrderLines(newOrderLines);
    }
  }, [selectedWarehouseId, selectedProducts, products, productPrices, fillPercentages, fillNotes]);
  
  // Handle address creation
  const handleAddressSubmit = async (addressData: CreateAddressData) => {
    try {
      const newAddress = await createAddress.mutateAsync(addressData);
      setSelectedAddressId(newAddress.id);
      setIsAddressFormOpen(false);
    } catch (error) {
      console.error('Failed to create address:', error);
    }
  };
  
  // Handle order creation
  const handleCreateOrder = async () => {
    if (!selectedCustomerId || !selectedAddressId || (orderType === 'delivery' && (!selectedWarehouseId || orderLines.length === 0)) || (orderType === 'visit' && !selectedWarehouseId)) {
      return;
    }
    
    try {
      const orderData = {
        customer_id: selectedCustomerId,
        delivery_address_id: selectedAddressId,
        source_warehouse_id: selectedWarehouseId,
        order_date: new Date().toISOString().split('T')[0],
        delivery_date: deliveryDate,
        delivery_time_window_start: deliveryTimeStart || undefined,
        delivery_time_window_end: deliveryTimeEnd || undefined,
        delivery_instructions: deliveryInstructions || undefined,
        notes: orderNotes || undefined,
        status: orderStatus,
        order_type: orderType as 'delivery' | 'visit',
        // Only include order lines for delivery orders
        order_lines: orderType === 'delivery' ? orderLines.map(line => ({
          product_id: line.product_id,
          quantity: line.quantity,
          unit_price: line.unit_price,
          price_excluding_tax: line.price_excluding_tax,
          tax_amount: line.tax_amount,
          price_including_tax: line.price_including_tax,
          tax_rate: line.tax_rate,
          // Temporarily comment out fill percentage fields until DB migration is applied
          // fill_percentage: line.fill_percentage,
          // is_partial_fill: line.is_partial_fill,
          // partial_fill_notes: line.partial_fill_notes,
        })) : undefined,
      };
      
      const order = await createOrder.mutateAsync(orderData);
      navigate(`/orders/${order.id}`);
    } catch (error) {
      console.error('Error creating order:', error);
    }
  };
  
  // Navigation helpers
  const canProceedToStep2 = orderType !== '';
  const canProceedToStep3 = selectedCustomerId && selectedAddressId && 
    (orderType === 'delivery' || (orderType === 'visit' && selectedWarehouseId));
  const canProceedToStep4 = orderType === 'visit' ? canProceedToStep3 : Object.keys(selectedProducts).length > 0 && selectedWarehouseId;
  const canProceedToStep5 = deliveryDate !== '';
  const canCreateOrder = canProceedToStep5 && !createOrder.isPending;
  
  const goToStep = (step: number) => {
    if (step < currentStep) {
      setCurrentStep(step);
    } else if (step === 2 && canProceedToStep2) {
      setCurrentStep(2);
    } else if (step === 3 && canProceedToStep3 && orderType === 'delivery') {
      setCurrentStep(3);
    } else if (step === 4 && canProceedToStep4) {
      // For visit orders, skip step 3 and go directly to step 4
      setCurrentStep(4);
    } else if (step === 5 && canProceedToStep5) {
      setCurrentStep(5);
    }
  };
  
  const steps = [
    { number: 1, title: 'Order Type', icon: Package },
    { number: 2, title: 'Customer & Address', icon: User },
    { number: 3, title: 'Products', icon: ShoppingCart },
    { number: 4, title: 'Delivery Notes', icon: FileText },
    { number: 5, title: 'Review & Create', icon: Check }
  ];
  
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
        <div className="flex items-center justify-between mb-8">
          {steps.map((step, index) => {
            // For visit orders, skip step 3 (Products) in the display
            const isSkippedStep = orderType === 'visit' && step.number === 3;
            const isVisitStep4 = orderType === 'visit' && step.number === 4 && currentStep === 4;
            const isVisitStep5 = orderType === 'visit' && step.number === 5 && currentStep === 5;
            
            // For visit orders, treat step 4 as if it's step 3, and step 5 as step 4
            const adjustedCurrentStep = orderType === 'visit' && currentStep >= 4 ? currentStep - 1 : currentStep;
            const adjustedStepNumber = orderType === 'visit' && step.number >= 4 ? step.number - 1 : step.number;
            
            return (
              <React.Fragment key={step.number}>
                <div 
                  className={`flex items-center space-x-3 cursor-pointer ${
                    isSkippedStep 
                      ? 'text-gray-300 opacity-50' 
                      : adjustedCurrentStep >= adjustedStepNumber ? 'text-blue-600' : 'text-gray-400'
                  }`}
                  onClick={() => !isSkippedStep && goToStep(step.number)}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    isSkippedStep 
                      ? 'bg-gray-100 text-gray-300'
                      : adjustedCurrentStep >= adjustedStepNumber ? 'bg-blue-600 text-white' : 'bg-gray-200'
                  }`}>
                    {isSkippedStep ? (
                      <X className="h-5 w-5" />
                    ) : adjustedCurrentStep > adjustedStepNumber ? (
                      <Check className="h-5 w-5" />
                    ) : (
                      <span className="font-medium">{step.number}</span>
                    )}
                  </div>
                  <div>
                    <div className="font-medium">
                      {step.title}
                      {isSkippedStep && <span className="text-xs ml-1">(Skipped)</span>}
                    </div>
                    <div className="text-xs text-gray-500">
                      {step.number === 1 && (orderType ? `${orderType === 'delivery' ? 'Delivery' : 'Visit'} Order` : 'Select type')}
                      {step.number === 2 && (
                        orderType === 'visit' 
                          ? (selectedCustomer && selectedWarehouse ? `${selectedCustomer.name} → ${selectedWarehouse.name}` : selectedCustomer ? selectedCustomer.name : 'Select customer & warehouse')
                          : (selectedCustomer ? selectedCustomer.name : 'Select customer & address')
                      )}
                      {step.number === 3 && !isSkippedStep && (Object.keys(selectedProducts).length > 0 ? `${Object.keys(selectedProducts).length} products` : 'Add products')}
                      {step.number === 3 && isSkippedStep && 'Not needed for visits'}
                      {step.number === 4 && (deliveryDate ? `Delivery: ${new Date(deliveryDate).toLocaleDateString()}` : 'Set delivery')}
                      {step.number === 5 && (orderStatus ? `Status: ${orderStatus}` : 'Review order')}
                    </div>
                  </div>
                </div>
                {index < steps.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-4 ${
                    isSkippedStep 
                      ? 'bg-gray-200'
                      : adjustedCurrentStep > adjustedStepNumber ? 'bg-blue-600' : 'bg-gray-200'
                  }`}></div>
                )}
              </React.Fragment>
            );
          })}
        </div>
        
        {/* Step 1: Order Type */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold mb-4">Select Order Type</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={() => handleOrderTypeChange('delivery')}
                className={`p-6 border-2 rounded-lg text-left transition-all ${
                  orderType === 'delivery' 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-start space-x-3">
                  <div className={`p-3 rounded-lg ${
                    orderType === 'delivery' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
                  }`}>
                    <Package className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">Delivery Order</h3>
                    <p className="text-gray-600 mt-1">
                      An order with predefined product quantities for direct delivery to the customer.
                    </p>
                  </div>
                </div>
              </button>
              
              <button
                onClick={() => handleOrderTypeChange('visit')}
                className={`p-6 border-2 rounded-lg text-left transition-all ${
                  orderType === 'visit' 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-start space-x-3">
                  <div className={`p-3 rounded-lg ${
                    orderType === 'visit' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
                  }`}>
                    <User className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">Visit Order</h3>
                    <p className="text-gray-600 mt-1">
                      A placeholder order for scheduling a truck visit. Product quantities will be finalized at the customer site.
                    </p>
                  </div>
                </div>
              </button>
            </div>
            
            <div className="flex justify-end mt-8">
              <button
                onClick={() => goToStep(2)}
                disabled={!canProceedToStep2}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                <span>Next: Customer & Address</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
        
        {/* Step 2: Customer & Address */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold mb-4">Select Customer & Delivery Address</h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                  onCustomerCreated={(customer) => setSelectedCustomerId(customer.id)}
                />
                
                {selectedCustomer && (
                  <div className={`mt-3 p-3 rounded-lg ${
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
                        Status: {selectedCustomer.account_status}
                      </div>
                      {selectedCustomer.email && <div className="text-gray-600">{selectedCustomer.email}</div>}
                      {selectedCustomer.phone && <div className="text-gray-600">{selectedCustomer.phone}</div>}
                    </div>
                  </div>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <MapPin className="inline h-4 w-4 mr-1" />
                  Delivery Address *
                </label>
                
                {selectedCustomerId && (
                  <>
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
                            onClick={() => setIsAddressFormOpen(true)}
                            className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                        
                        {selectedAddress && (
                          <div className="p-4 bg-gray-50 rounded-lg">
                            <h4 className="font-medium text-gray-900 mb-2">Selected Address:</h4>
                            <div className="text-sm text-gray-700">
                              <div>{selectedAddress.line1}</div>
                              {selectedAddress.line2 && <div>{selectedAddress.line2}</div>}
                              <div>{selectedAddress.city}, {selectedAddress.state} {selectedAddress.postal_code}</div>
                              {selectedAddress.instructions && (
                                <div className="mt-2 text-gray-600">
                                  <strong>Default Instructions:</strong> {selectedAddress.instructions}
                                </div>
                              )}
                              {(selectedAddress.delivery_window_start || selectedAddress.delivery_window_end) && (
                                <div className="mt-1 text-gray-600">
                                  <strong>Default Time Window:</strong> {selectedAddress.delivery_window_start} - {selectedAddress.delivery_window_end}
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
                        <button
                          onClick={() => setIsAddressFormOpen(true)}
                          className="inline-flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                        >
                          <Plus className="h-4 w-4" />
                          <span>Add Address</span>
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
              
              {/* Warehouse Selection - Only for visit orders */}
              {orderType === 'visit' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Package className="inline h-4 w-4 mr-1" />
                    Source Warehouse *
                  </label>
                  <select
                    value={selectedWarehouseId}
                    onChange={(e) => setSelectedWarehouseId(e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">Choose a warehouse...</option>
                    {warehouses.map((warehouse) => (
                      <option key={warehouse.id} value={warehouse.id}>
                        {warehouse.name} - {warehouse.city}, {warehouse.state}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    This warehouse will be used for future product loading during the visit
                  </p>
                </div>
              )}
            </div>
            
            <div className="flex justify-between mt-8">
              <button
                onClick={() => goToStep(1)}
                className="bg-gray-100 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-200"
              >
                Back
              </button>
              <button
                onClick={() => {
                  if (orderType === 'visit') {
                    setCurrentStep(4); // Jump directly to step 4 for visit orders
                  } else {
                    goToStep(3);
                  }
                }}
                disabled={!canProceedToStep3}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                title={!canProceedToStep3 ? 
                  orderType === 'visit' 
                    ? 'Please select a customer, delivery address, and warehouse to continue'
                    : 'Please select a customer and delivery address to continue'
                  : ''}
              >
                <span>Next: {orderType === 'visit' ? 'Delivery Notes' : 'Add Products'}</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
        
        {/* Step 3: Products - Only for delivery orders */}
        {currentStep === 3 && orderType === 'delivery' && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold mb-4">Add Products</h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Product Selection */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Available Products</h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {products
                    .filter(p => p.status === 'active')
                    .map(product => {
                      const currentQty = selectedProducts[product.id] || 0;
                      const pricingInfo = productPrices && productPrices[product.id];
                      const unitPrice = pricingInfo?.finalPrice || 0;
                      const hasPrice = unitPrice > 0;
                      
                      return (
                        <div
                          key={product.id}
                          className={`p-3 border rounded-lg transition-all ${
                            currentQty > 0
                              ? 'bg-blue-50 border-blue-200'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="font-medium text-gray-900">{product.name}</div>
                              <div className="text-sm text-gray-500">SKU: {product.sku}</div>
                              {hasPrice ? (
                                <div className="text-sm text-green-600 font-medium">
                                  {formatCurrencySync(unitPrice)}
                                </div>
                              ) : (
                                <div className="text-sm text-red-600">No price set</div>
                              )}
                            </div>
                            
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => handleProductSelect(product.id, Math.max(0, currentQty - 1))}
                                disabled={currentQty === 0}
                                className="w-8 h-8 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                value={currentQty}
                                onChange={(e) => handleProductSelect(product.id, parseInt(e.target.value) || 0)}
                                className="w-16 text-center border border-gray-300 rounded px-2 py-1"
                                min="0"
                              />
                              <button
                                onClick={() => handleProductSelect(product.id, currentQty + 1)}
                                disabled={!hasPrice}
                                className="w-8 h-8 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                              >
                                +
                              </button>
                              {isGasProduct(product) && (
                                <div className="flex items-center space-x-1 text-xs text-gray-500">
                                  <Gauge className="h-3 w-3" />
                                  <span>{fillPercentages[product.id] || 100}%</span>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {/* Fill Percentage Selector for Gas Products */}
                          {currentQty > 0 && isGasProduct(product) && (
                            <div className="mt-3">
                              <FillPercentageSelector
                                key={`fill-selector-${product.id}`}
                                value={fillPercentages[product.id] || 100}
                                onChange={(percentage, notes) => handleFillPercentageChange(product.id, percentage, notes)}
                                notes={fillNotes[product.id] || ''}
                                onNotesChange={(notes) => handleFillPercentageChange(product.id, fillPercentages[product.id] || 100, notes)}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
              
              {/* Warehouse Selection & Summary */}
              <div className="space-y-6">
                {/* Selected Products Summary */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Selected Products</h3>
                  {Object.keys(selectedProducts).length > 0 ? (
                    <div className="space-y-2">
                      {Object.entries(selectedProducts).map(([productId, quantity]) => {
                        const product = products.find(p => p.id === productId);
                        if (!product) return null;
                        
                        const fillPercentage = fillPercentages[productId] || 100;
                        const isPartialFill = fillPercentage < 100;
                        
                        return (
                          <div key={productId} className="p-3 border border-gray-200 rounded-lg">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="flex items-center space-x-2">
                                  <div className="font-medium">{product.name}</div>
                                  {isGasProduct(product) && isPartialFill && (
                                    <div className="flex items-center space-x-1">
                                      <Gauge className="h-3 w-3 text-orange-500" />
                                      <span className="text-xs text-orange-600 font-medium">{fillPercentage}%</span>
                                    </div>
                                  )}
                                </div>
                                <ProductPricingWithDeposit 
                                  product={product} 
                                  quantity={quantity} 
                                  fillPercentage={fillPercentage} 
                                />
                              </div>
                              <button
                                onClick={() => handleProductSelect(productId, 0)}
                                className="text-red-600 hover:text-red-800"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8 border border-gray-200 rounded-lg">
                      <ShoppingCart className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-500">No products selected</p>
                    </div>
                  )}
                </div>
                
                {/* Warehouse Selection */}
                {Object.keys(selectedProducts).length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Package className="inline h-4 w-4 mr-1" />
                      Select Warehouse
                    </label>
                    {availableWarehouses.length > 0 ? (
                      <select
                        value={selectedWarehouseId}
                        onChange={(e) => setSelectedWarehouseId(e.target.value)}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="">Choose a warehouse...</option>
                        {availableWarehouses.map((warehouse) => (
                          <option key={warehouse.id} value={warehouse.id}>
                            {warehouse.name} - {warehouse.city}, {warehouse.state}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <AlertTriangle className="h-5 w-5 text-yellow-600 inline mr-2" />
                        <span className="text-yellow-800">
                          No warehouses have all selected products in the required quantities
                        </span>
                      </div>
                    )}
                    
                    {selectedWarehouseId && (
                      <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <h4 className="font-medium text-blue-900 mb-2">Stock Availability in {selectedWarehouse?.name}:</h4>
                        <div className="space-y-1 text-sm">
                          {Object.entries(selectedProducts).map(([productId, requiredQty]) => {
                            const product = products.find(p => p.id === productId);
                            const available = getStockInfo(productId);
                            const isEnough = available >= requiredQty;
                            
                            return (
                              <div key={productId} className={`flex justify-between ${isEnough ? 'text-green-700' : 'text-red-700'}`}>
                                <span>{product?.name}:</span>
                                <span>{available} available (need {requiredQty})</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex justify-between mt-8">
              <button
                onClick={() => goToStep(2)}
                className="bg-gray-100 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-200"
              >
                Back
              </button>
              <button
                onClick={() => goToStep(4)}
                disabled={!canProceedToStep4 || !selectedWarehouseId}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                <span>Next: Delivery Notes</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
        
        {/* Step 4: Delivery Notes */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold mb-4">Add Delivery Notes</h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Calendar className="inline h-4 w-4 mr-1" />
                  Delivery Date *
                </label>
                <input
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Clock className="inline h-4 w-4 mr-1" />
                  Time Window (Optional)
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="time"
                    value={deliveryTimeStart}
                    onChange={(e) => setDeliveryTimeStart(e.target.value)}
                    className="flex-1 rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <span className="text-gray-500">to</span>
                  <input
                    type="time"
                    value={deliveryTimeEnd}
                    onChange={(e) => setDeliveryTimeEnd(e.target.value)}
                    className="flex-1 rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                {selectedAddress && (selectedAddress.delivery_window_start || selectedAddress.delivery_window_end) && (
                  <p className="mt-1 text-xs text-gray-500">
                    Default from address: {selectedAddress.delivery_window_start} - {selectedAddress.delivery_window_end}
                  </p>
                )}
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <FileText className="inline h-4 w-4 mr-1" />
                Delivery Instructions
              </label>
              <textarea
                value={deliveryInstructions}
                onChange={(e) => setDeliveryInstructions(e.target.value)}
                rows={3}
                className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="e.g., Gate code: 1234, Ring doorbell twice, Leave at back door..."
              />
              {selectedAddress?.instructions && (
                <p className="mt-1 text-xs text-gray-500">
                  Default from address: {selectedAddress.instructions}
                </p>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Order Notes (Internal)
              </label>
              <textarea
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                rows={3}
                className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Optional internal notes about this order..."
              />
            </div>
            
            <div className="flex justify-between mt-8">
              <button
                onClick={() => {
                  if (orderType === 'visit') {
                    setCurrentStep(2); // Go back to step 2 for visit orders
                  } else {
                    goToStep(3);
                  }
                }}
                className="bg-gray-100 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-200"
              >
                Back
              </button>
              <button
                onClick={() => goToStep(5)}
                disabled={!canProceedToStep5}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                <span>Next: Review Order</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
        
        {/* Step 5: Review & Create */}
        {currentStep === 5 && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold mb-4">Review Order</h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Order Summary */}
              <div className="space-y-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-medium text-gray-900 mb-3">Order Details</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Order Type:</span>
                      <span className="font-medium">{orderType === 'delivery' ? 'Delivery Order' : 'Visit Order'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Customer:</span>
                      <span className="font-medium">{selectedCustomer?.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Delivery Date:</span>
                      <span className="font-medium">{new Date(deliveryDate).toLocaleDateString()}</span>
                    </div>
                    {(deliveryTimeStart || deliveryTimeEnd) && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Time Window:</span>
                        <span className="font-medium">{deliveryTimeStart} - {deliveryTimeEnd}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-600">Warehouse:</span>
                      <span className="font-medium">{selectedWarehouse?.name}</span>
                    </div>
                  </div>
                </div>
                
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-medium text-gray-900 mb-3">Delivery Address</h3>
                  <div className="text-sm text-gray-700">
                    <div>{selectedAddress?.line1}</div>
                    {selectedAddress?.line2 && <div>{selectedAddress.line2}</div>}
                    <div>{selectedAddress?.city}, {selectedAddress?.state} {selectedAddress?.postal_code}</div>
                  </div>
                  {deliveryInstructions && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <div className="text-sm font-medium text-gray-700">Delivery Instructions:</div>
                      <div className="text-sm text-gray-600 mt-1">{deliveryInstructions}</div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Products & Totals */}
              <div className="space-y-4">
                {orderType === 'delivery' ? (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="font-medium text-gray-900 mb-3">Order Items</h3>
                    <div className="space-y-2">
                      {orderLines.map((line) => {
                        const product = products.find(p => p.id === line.product_id);
                        const gasPrice = line.price_excluding_tax || line.unit_price;
                        const depositAmount = line.deposit_amount || 0;
                        const taxAmount = line.tax_amount || 0;
                        
                        return (
                          <div key={line.product_id} className="flex justify-between items-start py-2 border-b border-gray-200 last:border-0">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2">
                                <div className="font-medium text-sm">{line.product_name}</div>
                                {line.is_partial_fill && (
                                  <div className="flex items-center space-x-1">
                                    <Gauge className="h-3 w-3 text-orange-500" />
                                    <span className="text-xs text-orange-600 font-medium">{line.fill_percentage}%</span>
                                  </div>
                                )}
                              </div>
                              
                              {/* Enhanced pricing breakdown */}
                              <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                                <div>Gas: {line.quantity} × {formatCurrencySync(gasPrice)} = {formatCurrencySync(gasPrice * line.quantity)}</div>
                                {depositAmount > 0 && (
                                  <div className="text-blue-600">Deposit: {line.quantity} × {formatCurrencySync(depositAmount)} = {formatCurrencySync(depositAmount * line.quantity)}</div>
                                )}
                                {taxAmount > 0 && (
                                  <div>Tax: {formatCurrencySync(taxAmount * line.quantity)}</div>
                                )}
                                {line.is_partial_fill && (
                                  <div className="text-orange-600">Partial Fill ({line.fill_percentage}%)</div>
                                )}
                              </div>
                              
                              {line.partial_fill_notes && (
                                <div className="text-xs text-gray-400 mt-1">
                                  Note: {line.partial_fill_notes}
                                </div>
                              )}
                            </div>
                            <div className="font-medium text-sm text-right">
                              <div className="font-bold">{formatCurrencySync(line.subtotal + (depositAmount * line.quantity))}</div>
                              <div className="text-xs text-gray-500">Total</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    
                    <div className="mt-4 pt-4 border-t border-gray-300 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Gas Subtotal:</span>
                        <span className="font-medium">{formatCurrencySync(subtotal)}</span>
                      </div>
                      {depositTotal > 0 && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-blue-600">Deposits:</span>
                          <span className="font-medium text-blue-600">{formatCurrencySync(depositTotal)}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Tax:</span>
                        <span className="font-medium">{formatCurrencySync(taxAmount)}</span>
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t">
                        <span className="font-semibold">Total:</span>
                        <span className="font-bold text-lg text-green-700">{formatCurrencySync(grandTotal)}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                    <h3 className="font-medium text-blue-900 mb-3">Visit Order</h3>
                    <p className="text-sm text-blue-800">
                      This is a visit order. Product quantities will be determined during the customer visit.
                      The driver will update this order with actual products when at the customer location.
                    </p>
                  </div>
                )}
                
                {/* Order Status Selection */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="font-medium text-blue-900 mb-3">Save Order As:</h3>
                  <div className="space-y-2">
                    <label className="flex items-center space-x-3 cursor-pointer">
                      <input
                        type="radio"
                        value="draft"
                        checked={orderStatus === 'draft'}
                        onChange={(e) => setOrderStatus(e.target.value as 'draft')}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <div>
                        <div className="font-medium">Draft</div>
                        <div className="text-sm text-gray-600">Save for later editing</div>
                      </div>
                    </label>
                    <label className="flex items-center space-x-3 cursor-pointer">
                      <input
                        type="radio"
                        value="confirmed"
                        checked={orderStatus === 'confirmed'}
                        onChange={(e) => setOrderStatus(e.target.value as 'confirmed')}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <div>
                        <div className="font-medium">Confirmed</div>
                        <div className="text-sm text-gray-600">Confirm and reserve stock</div>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex justify-between mt-8">
              <button
                onClick={() => setCurrentStep(4)}
                className="bg-gray-100 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-200"
              >
                Back
              </button>
              <button
                onClick={handleCreateOrder}
                disabled={!canCreateOrder}
                className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                <ShoppingCart className="h-5 w-5" />
                <span>{createOrder.isPending ? 'Creating...' : `Create ${orderStatus === 'draft' ? 'Draft' : 'Confirmed'} Order`}</span>
              </button>
            </div>
          </div>
        )}
      </div>
      
      {/* Address Form Modal */}
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