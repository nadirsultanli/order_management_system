import React, { useState } from 'react';
import { 
  DollarSign, 
  Package, 
  Calculator, 
  ArrowRight, 
  Info, 
  CheckCircle, 
  AlertCircle,
  ShoppingCart,
  RotateCcw,
  TrendingUp,
  Users,
  FileText,
  Eye,
  X
} from 'lucide-react';
import { formatCurrencySync } from '../../utils/pricing';

interface DepositDemoData {
  // Deposit rates by capacity
  depositRates: {
    capacity_l: number;
    deposit_amount: number;
    currency_code: string;
    is_active: boolean;
  }[];
  
  // Sample products with capacities
  products: {
    id: string;
    name: string;
    sku: string;
    capacity_kg: number;
    capacity_l: number; // Calculated or provided
    gas_price: number;
    deposit_rate: number;
  }[];
  
  // Sample customer
  customer: {
    id: string;
    name: string;
    deposit_balance: number;
    cylinder_breakdown: {
      capacity_l: number;
      quantity: number;
      unit_deposit: number;
      total_deposit: number;
    }[];
  };
}

const DEMO_DATA: DepositDemoData = {
  depositRates: [
    { capacity_l: 5, deposit_amount: 25, currency_code: 'EUR', is_active: true },
    { capacity_l: 12.5, deposit_amount: 50, currency_code: 'EUR', is_active: true },
    { capacity_l: 19, deposit_amount: 75, currency_code: 'EUR', is_active: true },
    { capacity_l: 35, deposit_amount: 100, currency_code: 'EUR', is_active: true },
    { capacity_l: 47, deposit_amount: 150, currency_code: 'EUR', is_active: true },
  ],
  
  products: [
    {
      id: 'prod-1',
      name: 'Propane 5L Cylinder',
      sku: 'PROP-5L',
      capacity_kg: 2.1,
      capacity_l: 5,
      gas_price: 15.50,
      deposit_rate: 25
    },
    {
      id: 'prod-2', 
      name: 'Propane 12.5L Cylinder',
      sku: 'PROP-12.5L',
      capacity_kg: 5.25,
      capacity_l: 12.5,
      gas_price: 35.75,
      deposit_rate: 50
    },
    {
      id: 'prod-3',
      name: 'Propane 19L Cylinder', 
      sku: 'PROP-19L',
      capacity_kg: 8,
      capacity_l: 19,
      gas_price: 52.20,
      deposit_rate: 75
    }
  ],
  
  customer: {
    id: 'cust-1',
    name: 'Restaurant Europa',
    deposit_balance: 275,
    cylinder_breakdown: [
      { capacity_l: 5, quantity: 2, unit_deposit: 25, total_deposit: 50 },
      { capacity_l: 12.5, quantity: 3, unit_deposit: 50, total_deposit: 150 },
      { capacity_l: 19, quantity: 1, unit_deposit: 75, total_deposit: 75 }
    ]
  }
};

interface OrderLineDemo {
  product_id: string;
  product_name: string;
  capacity_l: number;
  quantity: number;
  gas_charge: number;
  deposit_charge: number;
  line_total: number;
}

export const DepositWorkflowDemo: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'rates' | 'order' | 'calculation' | 'tracking' | 'business'>('rates');
  const [selectedProducts, setSelectedProducts] = useState<OrderLineDemo[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const addProductToOrder = (product: typeof DEMO_DATA.products[0]) => {
    const existingLine = selectedProducts.find(line => line.product_id === product.id);
    
    if (existingLine) {
      setSelectedProducts(prev => prev.map(line => 
        line.product_id === product.id 
          ? {
              ...line,
              quantity: line.quantity + 1,
              line_total: (line.quantity + 1) * (product.gas_price + product.deposit_rate)
            }
          : line
      ));
    } else {
      const newLine: OrderLineDemo = {
        product_id: product.id,
        product_name: product.name,
        capacity_l: product.capacity_l,
        quantity: 1,
        gas_charge: product.gas_price,
        deposit_charge: product.deposit_rate,
        line_total: product.gas_price + product.deposit_rate
      };
      setSelectedProducts(prev => [...prev, newLine]);
    }
  };

  const removeProductFromOrder = (productId: string) => {
    setSelectedProducts(prev => prev.filter(line => line.product_id !== productId));
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeProductFromOrder(productId);
      return;
    }
    
    setSelectedProducts(prev => prev.map(line => 
      line.product_id === productId 
        ? {
            ...line,
            quantity,
            line_total: quantity * (line.gas_charge + line.deposit_charge)
          }
        : line
    ));
  };

  const getTotalGasCharges = () => selectedProducts.reduce((sum, line) => sum + (line.gas_charge * line.quantity), 0);
  const getTotalDepositCharges = () => selectedProducts.reduce((sum, line) => sum + (line.deposit_charge * line.quantity), 0);
  const getGrandTotal = () => getTotalGasCharges() + getTotalDepositCharges();

  const TabButton: React.FC<{ id: string; label: string; icon: React.ReactNode; isActive: boolean; onClick: () => void }> = 
    ({ id, label, icon, isActive, onClick }) => (
      <button
        onClick={onClick}
        className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all ${
          isActive 
            ? 'bg-blue-600 text-white shadow-md' 
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
      >
        {icon}
        <span>{label}</span>
      </button>
    );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-2">Deposit Workflow Demo</h1>
            <p className="text-blue-100">
              Comprehensive demonstration of the deposit system based on the OMS Playbook
            </p>
          </div>
          <div className="text-right">
            <div className="text-blue-100 text-sm">Current System Status</div>
            <div className="flex items-center space-x-2 mt-1">
              <CheckCircle className="h-5 w-5 text-green-300" />
              <span className="font-medium">Fully Operational</span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2">
        <TabButton
          id="rates"
          label="Deposit Rates"
          icon={<DollarSign className="h-4 w-4" />}
          isActive={activeTab === 'rates'}
          onClick={() => setActiveTab('rates')}
        />
        <TabButton
          id="order"
          label="Order Creation"
          icon={<ShoppingCart className="h-4 w-4" />}
          isActive={activeTab === 'order'}
          onClick={() => setActiveTab('order')}
        />
        <TabButton
          id="calculation"
          label="Pricing Formula"
          icon={<Calculator className="h-4 w-4" />}
          isActive={activeTab === 'calculation'}
          onClick={() => setActiveTab('calculation')}
        />
        <TabButton
          id="tracking"
          label="Deposit Tracking"
          icon={<TrendingUp className="h-4 w-4" />}
          isActive={activeTab === 'tracking'}
          onClick={() => setActiveTab('tracking')}
        />
        <TabButton
          id="business"
          label="Business Logic"
          icon={<FileText className="h-4 w-4" />}
          isActive={activeTab === 'business'}
          onClick={() => setActiveTab('business')}
        />
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {/* Deposit Rates Tab */}
        {activeTab === 'rates' && (
          <div className="p-6 space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                1. Deposit Rates Configuration
              </h2>
              <p className="text-gray-600 mb-4">
                Deposit rates are set by cylinder capacity in liters. Each capacity has a fixed deposit amount that customers pay upfront.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {DEMO_DATA.depositRates.map((rate) => (
                <div key={rate.capacity_l} className="border border-green-200 rounded-lg p-4 bg-green-50">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <Package className="h-5 w-5 text-green-600" />
                      <span className="font-semibold text-gray-900">{rate.capacity_l}L</span>
                    </div>
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                      Active
                    </span>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-700">
                      {formatCurrencySync(rate.deposit_amount, rate.currency_code)}
                    </div>
                    <div className="text-sm text-gray-600">Deposit Amount</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <strong>Key Points:</strong>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>Deposit rates are automatically looked up based on product capacity</li>
                    <li>Rates are effective immediately and apply to all new orders</li>
                    <li>Historical rates are preserved for audit and refund calculations</li>
                    <li>Each capacity has one active rate at any given time</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Order Creation Tab */}
        {activeTab === 'order' && (
          <div className="p-6 space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                2. Order Creation with Automatic Deposit Lookup
              </h2>
              <p className="text-gray-600 mb-4">
                When creating orders, the system automatically looks up deposit rates based on product capacity. 
                Customers are charged both gas fees and deposits.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Available Products */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Available Products</h3>
                <div className="space-y-3">
                  {DEMO_DATA.products.map((product) => (
                    <div key={product.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <div className="font-medium text-gray-900">{product.name}</div>
                          <div className="text-sm text-gray-500">SKU: {product.sku}</div>
                          <div className="text-sm text-gray-500">
                            Capacity: {product.capacity_l}L ({product.capacity_kg}kg)
                          </div>
                        </div>
                        <button
                          onClick={() => addProductToOrder(product)}
                          className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                        >
                          Add
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="bg-gray-50 p-2 rounded">
                          <div className="text-gray-600">Gas Price</div>
                          <div className="font-medium">{formatCurrencySync(product.gas_price)}</div>
                        </div>
                        <div className="bg-yellow-50 p-2 rounded">
                          <div className="text-gray-600">Deposit</div>
                          <div className="font-medium text-yellow-700">{formatCurrencySync(product.deposit_rate)}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Order Summary */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Order Summary</h3>
                {selectedProducts.length > 0 ? (
                  <div className="space-y-3">
                    {selectedProducts.map((line) => (
                      <div key={line.product_id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-medium text-gray-900">{line.product_name}</div>
                          <button
                            onClick={() => removeProductFromOrder(line.product_id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="flex items-center space-x-2 mb-3">
                          <label className="text-sm text-gray-600">Qty:</label>
                          <input
                            type="number"
                            min="1"
                            value={line.quantity}
                            onChange={(e) => updateQuantity(line.product_id, parseInt(e.target.value) || 0)}
                            className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-sm">
                          <div className="text-center">
                            <div className="text-gray-600">Gas</div>
                            <div className="font-medium">{formatCurrencySync(line.gas_charge * line.quantity)}</div>
                          </div>
                          <div className="text-center">
                            <div className="text-gray-600">Deposit</div>
                            <div className="font-medium text-yellow-700">{formatCurrencySync(line.deposit_charge * line.quantity)}</div>
                          </div>
                          <div className="text-center">
                            <div className="text-gray-600">Total</div>
                            <div className="font-medium text-green-700">{formatCurrencySync(line.line_total)}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    <div className="border-t pt-4 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Total Gas Charges:</span>
                        <span className="font-medium">{formatCurrencySync(getTotalGasCharges())}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Total Deposits:</span>
                        <span className="font-medium text-yellow-700">{formatCurrencySync(getTotalDepositCharges())}</span>
                      </div>
                      <div className="flex justify-between text-lg font-semibold">
                        <span>Grand Total:</span>
                        <span className="text-green-700">{formatCurrencySync(getGrandTotal())}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 border border-gray-200 rounded-lg">
                    <Package className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">No products added yet</p>
                    <p className="text-sm text-gray-400">Add products from the left to see order calculation</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Pricing Formula Tab */}
        {activeTab === 'calculation' && (
          <div className="p-6 space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                3. Pricing Formula: LineTotal = GasCharge + Deposit
              </h2>
              <p className="text-gray-600 mb-4">
                The total line amount for each product includes both the gas charge and the deposit charge.
                This ensures clear separation between revenue and deposit liability.
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Formula Breakdown</h3>
              
              <div className="space-y-4">
                <div className="flex items-center space-x-4">
                  <div className="bg-blue-100 text-blue-800 px-3 py-2 rounded-lg font-mono text-sm">
                    LineTotal = GasCharge + DepositCharge
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-2">Gas Charge</h4>
                    <p className="text-sm text-gray-600 mb-2">Revenue-generating portion</p>
                    <ul className="text-xs text-gray-500 space-y-1">
                      <li>• Based on product pricing</li>
                      <li>• Recognized as revenue immediately</li>
                      <li>• Subject to taxes</li>
                    </ul>
                  </div>
                  
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-2">Deposit Charge</h4>
                    <p className="text-sm text-gray-600 mb-2">Liability/security portion</p>
                    <ul className="text-xs text-gray-500 space-y-1">
                      <li>• Based on cylinder capacity</li>
                      <li>• Recorded as customer liability</li>
                      <li>• Refundable upon return</li>
                    </ul>
                  </div>
                  
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-2">Line Total</h4>
                    <p className="text-sm text-gray-600 mb-2">Amount charged to customer</p>
                    <ul className="text-xs text-gray-500 space-y-1">
                      <li>• Sum of gas + deposit</li>
                      <li>• Appears on invoice</li>
                      <li>• Customer payment amount</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* Example Calculation */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Example Calculation</h3>
              
              <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">Order: 2x Propane 12.5L Cylinders</h4>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Gas Charge (2 × €35.75):</span>
                      <span className="font-mono">€71.50</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Deposit Charge (2 × €50.00):</span>
                      <span className="font-mono text-yellow-700">€100.00</span>
                    </div>
                    <div className="border-t pt-2 flex justify-between font-medium">
                      <span>Total Line Amount:</span>
                      <span className="font-mono text-green-700">€171.50</span>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="bg-blue-50 p-3 rounded">
                    <strong>Accounting Treatment:</strong>
                    <ul className="mt-1 space-y-1 text-xs">
                      <li>• Revenue: €71.50</li>
                      <li>• Customer Deposit Liability: €100.00</li>
                      <li>• Cash Received: €171.50</li>
                    </ul>
                  </div>
                  
                  <div className="bg-yellow-50 p-3 rounded">
                    <strong>Customer Impact:</strong>
                    <ul className="mt-1 space-y-1 text-xs">
                      <li>• Pays total: €171.50</li>
                      <li>• Gets: 2 filled cylinders</li>
                      <li>• Deposit balance: +€100.00</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Deposit Tracking Tab */}
        {activeTab === 'tracking' && (
          <div className="p-6 space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                4. Deposit Tracking for Returns/Refunds
              </h2>
              <p className="text-gray-600 mb-4">
                The system tracks customer deposit balances and cylinder breakdown for future returns and refunds.
                Each transaction is recorded with complete audit trail.
              </p>
            </div>

            {/* Customer Deposit Summary */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Customer: {DEMO_DATA.customer.name}
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Current Deposit Balance</h4>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                    <div className="text-3xl font-bold text-green-700 mb-1">
                      {formatCurrencySync(DEMO_DATA.customer.deposit_balance)}
                    </div>
                    <div className="text-sm text-green-600">Total Outstanding Deposits</div>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Cylinder Breakdown</h4>
                  <div className="space-y-2">
                    {DEMO_DATA.customer.cylinder_breakdown.map((breakdown) => (
                      <div key={breakdown.capacity_l} className="flex items-center justify-between bg-gray-50 p-3 rounded">
                        <div className="flex items-center space-x-3">
                          <Package className="h-4 w-4 text-gray-500" />
                          <span className="text-sm font-medium">{breakdown.capacity_l}L</span>
                          <span className="text-sm text-gray-600">× {breakdown.quantity}</span>
                        </div>
                        <div className="text-sm font-medium">
                          {formatCurrencySync(breakdown.total_deposit)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Return Process */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Return & Refund Process</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-lg">
                  <div className="flex items-center space-x-2 mb-3">
                    <RotateCcw className="h-5 w-5 text-blue-600" />
                    <span className="font-medium">1. Return Cylinders</span>
                  </div>
                  <p className="text-sm text-gray-600">
                    Customer returns empty cylinders. System records condition and calculates refund amount.
                  </p>
                </div>
                
                <div className="bg-white p-4 rounded-lg">
                  <div className="flex items-center space-x-2 mb-3">
                    <Calculator className="h-5 w-5 text-green-600" />
                    <span className="font-medium">2. Calculate Refund</span>
                  </div>
                  <p className="text-sm text-gray-600">
                    Refund amount based on original deposit minus any damage deductions.
                  </p>
                </div>
                
                <div className="bg-white p-4 rounded-lg">
                  <div className="flex items-center space-x-2 mb-3">
                    <DollarSign className="h-5 w-5 text-purple-600" />
                    <span className="font-medium">3. Process Refund</span>
                  </div>
                  <p className="text-sm text-gray-600">
                    Issue refund via cash, check, or account credit. Update customer deposit balance.
                  </p>
                </div>
              </div>
            </div>

            {/* Transaction History Example */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Sample Transaction History</h3>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-gray-200">
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <div>
                      <div className="font-medium text-sm">Deposit Charge</div>
                      <div className="text-xs text-gray-500">Order #ORD-12345 • 2024-07-14</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium text-blue-600">+€100.00</div>
                    <div className="text-xs text-gray-500">2× 12.5L cylinders</div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between py-2 border-b border-gray-200">
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <div>
                      <div className="font-medium text-sm">Deposit Refund</div>
                      <div className="text-xs text-gray-500">Return #RET-67890 • 2024-07-10</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium text-green-600">-€50.00</div>
                    <div className="text-xs text-gray-500">1× 12.5L cylinder (good condition)</div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <div>
                      <div className="font-medium text-sm">Deposit Charge</div>
                      <div className="text-xs text-gray-500">Order #ORD-11111 • 2024-07-05</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium text-blue-600">+€225.00</div>
                    <div className="text-xs text-gray-500">2× 5L, 3× 12.5L, 1× 19L cylinders</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Business Logic Tab */}
        {activeTab === 'business' && (
          <div className="p-6 space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                5. Complete Business Logic Implementation
              </h2>
              <p className="text-gray-600 mb-4">
                Summary of how the deposit workflow integrates with the overall Order Management System.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Key Features */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900">Key Features Implemented</h3>
                
                <div className="space-y-3">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <span className="font-medium">Automatic Deposit Lookup</span>
                    </div>
                    <p className="text-sm text-gray-600">
                      Products automatically reference deposit rates based on capacity_l field
                    </p>
                  </div>
                  
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <span className="font-medium">Separated Accounting</span>
                    </div>
                    <p className="text-sm text-gray-600">
                      Clear separation between revenue (gas charges) and liabilities (deposits)
                    </p>
                  </div>
                  
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <span className="font-medium">Customer Tracking</span>
                    </div>
                    <p className="text-sm text-gray-600">
                      Complete audit trail of all deposit transactions per customer
                    </p>
                  </div>
                  
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <span className="font-medium">Refund Management</span>
                    </div>
                    <p className="text-sm text-gray-600">
                      Condition-based refund calculations with damage deductions
                    </p>
                  </div>
                </div>
              </div>

              {/* Integration Points */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900">System Integration</h3>
                
                <div className="space-y-3">
                  <div className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <Package className="h-5 w-5 text-blue-600" />
                      <span className="font-medium">Product Management</span>
                    </div>
                    <p className="text-sm text-gray-600">
                      Products link to deposits via capacity_l field for automatic rate lookup
                    </p>
                  </div>
                  
                  <div className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <ShoppingCart className="h-5 w-5 text-purple-600" />
                      <span className="font-medium">Order Processing</span>
                    </div>
                    <p className="text-sm text-gray-600">
                      Orders automatically calculate and include deposit charges in line totals
                    </p>
                  </div>
                  
                  <div className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <Users className="h-5 w-5 text-green-600" />
                      <span className="font-medium">Customer Management</span>
                    </div>
                    <p className="text-sm text-gray-600">
                      Customer records maintain deposit balances and cylinder breakdown
                    </p>
                  </div>
                  
                  <div className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <FileText className="h-5 w-5 text-orange-600" />
                      <span className="font-medium">Financial Reporting</span>
                    </div>
                    <p className="text-sm text-gray-600">
                      Complete analytics and reporting for deposit liability management
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* API Endpoints Summary */}
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Key API Endpoints</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Deposit Rate Management</h4>
                  <ul className="space-y-1 text-gray-600 font-mono text-xs">
                    <li>GET /deposits/rates</li>
                    <li>POST /deposits/rates</li>
                    <li>GET /deposits/rates/by-capacity</li>
                    <li>PUT /deposits/rates/:id</li>
                  </ul>
                </div>
                
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Customer Deposits</h4>
                  <ul className="space-y-1 text-gray-600 font-mono text-xs">
                    <li>GET /deposits/customers/:id/balance</li>
                    <li>POST /deposits/customers/:id/charge</li>
                    <li>POST /deposits/customers/:id/refund</li>
                    <li>GET /deposits/customers/:id/history</li>
                  </ul>
                </div>
                
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Transaction Management</h4>
                  <ul className="space-y-1 text-gray-600 font-mono text-xs">
                    <li>GET /deposits/transactions</li>
                    <li>GET /deposits/transactions/:id</li>
                    <li>POST /deposits/transactions/:id/void</li>
                    <li>POST /deposits/calculate-refund</li>
                  </ul>
                </div>
                
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Analytics & Reporting</h4>
                  <ul className="space-y-1 text-gray-600 font-mono text-xs">
                    <li>GET /deposits/summary</li>
                    <li>GET /deposits/analytics</li>
                    <li>GET /deposits/outstanding-report</li>
                    <li>POST /deposits/validate-refund</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quick Action Button */}
      <div className="text-center">
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-gradient-to-r from-blue-600 to-blue-800 text-white px-6 py-3 rounded-lg font-medium hover:from-blue-700 hover:to-blue-900 transition-all shadow-lg"
        >
          <Eye className="h-5 w-5 inline mr-2" />
          View Implementation Details
        </button>
      </div>

      {/* Implementation Details Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-gray-900">
                  Deposit System Implementation Details
                </h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              
              <div className="space-y-6">
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Database Schema</h4>
                  <div className="bg-gray-50 p-4 rounded-lg font-mono text-sm overflow-x-auto">
                    <pre>{`// Deposit Rates Table
deposit_rates {
  id: string
  capacity_l: number
  deposit_amount: number
  currency_code: string
  effective_date: string
  end_date?: string
  is_active: boolean
  notes?: string
  created_at: string
  updated_at: string
}

// Customer Deposit Transactions
deposit_transactions {
  id: string
  customer_id: string
  transaction_type: 'charge' | 'refund' | 'adjustment'
  amount: number
  currency_code: string
  transaction_date: string
  order_id?: string
  notes?: string
  is_voided: boolean
  cylinder_details: CylinderTransactionDetail[]
}

// Product to Deposit Rate Relationship
// Products have capacity_kg which converts to capacity_l
// System automatically looks up deposit rate by capacity_l`}</pre>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Business Rules</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
                    <li>Each cylinder capacity has exactly one active deposit rate at any time</li>
                    <li>Products automatically lookup deposit rates via capacity_l field</li>
                    <li>Order line totals = Gas charge + Deposit charge</li>
                    <li>Deposits are recorded as customer liabilities, not revenue</li>
                    <li>Refunds are calculated based on cylinder condition and original deposit</li>
                    <li>All transactions maintain complete audit trail</li>
                    <li>Historical rates are preserved for accurate refund calculations</li>
                  </ul>
                </div>
                
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Component Architecture</h4>
                  <div className="bg-gray-50 p-4 rounded-lg text-sm">
                    <ul className="space-y-1">
                      <li><strong>CapacityDepositManager:</strong> Manages deposit rates by capacity</li>
                      <li><strong>DepositRateForm:</strong> Create/edit deposit rates</li>
                      <li><strong>CustomerDepositBalance:</strong> Display customer deposit status</li>
                      <li><strong>DepositTransaction:</strong> Record charge/refund transactions</li>
                      <li><strong>useDeposits hooks:</strong> API integration for all deposit operations</li>
                    </ul>
                  </div>
                </div>
              </div>
              
              <div className="mt-6 text-center">
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};