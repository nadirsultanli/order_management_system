import React, { useState } from 'react';
import { Search, Users, DollarSign, AlertCircle, Plus, Minus, Eye } from 'lucide-react';
import { useCustomers } from '../../hooks/useCustomers';
import { useCustomerDepositBalance } from '../../hooks/useDeposits';
import { CustomerDepositHistory } from './CustomerDepositHistory';
import { DepositChargeModal } from './DepositChargeModal';
import { DepositRefundModal } from './DepositRefundModal';

export const CustomerDepositBalance: React.FC = () => {
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [showChargeModal, setShowChargeModal] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState(false);

  // Get customers for selection
  const { data: customersData } = useCustomers({ 
    search: customerSearch,
    limit: 50 
  });

  // Get deposit balance for selected customer
  const { data: depositBalance, isLoading: balanceLoading } = useCustomerDepositBalance(selectedCustomerId);

  const customers = customersData?.customers || [];

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const handleCustomerSelect = (customerId: string) => {
    setSelectedCustomerId(customerId);
    setShowHistory(false);
  };

  return (
    <div className="space-y-6">
      {/* Customer Selection */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Select Customer</h3>
        
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search customers..."
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {customers.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-64 overflow-y-auto">
              {customers.map((customer) => (
                <button
                  key={customer.id}
                  onClick={() => handleCustomerSelect(customer.id)}
                  className={`p-3 text-left border rounded-lg transition-colors ${
                    selectedCustomerId === customer.id
                      ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="font-medium text-gray-900">{customer.name}</div>
                  {customer.external_id && (
                    <div className="text-sm text-gray-500">ID: {customer.external_id}</div>
                  )}
                  {customer.email && (
                    <div className="text-sm text-gray-500">{customer.email}</div>
                  )}
                </button>
              ))}
            </div>
          ) : customerSearch ? (
            <div className="text-center py-8">
              <Users className="h-8 w-8 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500">No customers found matching "{customerSearch}"</p>
            </div>
          ) : (
            <div className="text-center py-8">
              <Users className="h-8 w-8 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500">Start typing to search for customers</p>
            </div>
          )}
        </div>
      </div>

      {/* Deposit Balance Display */}
      {selectedCustomerId && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {balanceLoading ? (
            <div className="p-6">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2 mb-4"></div>
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-full"></div>
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                </div>
              </div>
            </div>
          ) : depositBalance ? (
            <div>
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    {depositBalance.customer_name}
                  </h3>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setShowChargeModal(true)}
                      className="flex items-center space-x-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Charge</span>
                    </button>
                    <button
                      onClick={() => setShowRefundModal(true)}
                      className="flex items-center space-x-1 px-3 py-1.5 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 transition-colors"
                      disabled={depositBalance.total_deposit_balance <= 0}
                    >
                      <Minus className="h-4 w-4" />
                      <span>Refund</span>
                    </button>
                    <button
                      onClick={() => setShowHistory(!showHistory)}
                      className="flex items-center space-x-1 px-3 py-1.5 bg-gray-600 text-white text-sm rounded-md hover:bg-gray-700 transition-colors"
                    >
                      <Eye className="h-4 w-4" />
                      <span>History</span>
                    </button>
                  </div>
                </div>

                {/* Balance Summary */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <DollarSign className="h-5 w-5 text-blue-600" />
                      <span className="text-sm font-medium text-blue-900">Total Balance</span>
                    </div>
                    <div className="text-2xl font-bold text-blue-900">
                      {formatCurrency(depositBalance.total_deposit_balance, depositBalance.currency_code)}
                    </div>
                  </div>

                  <div className="bg-yellow-50 p-4 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <AlertCircle className="h-5 w-5 text-yellow-600" />
                      <span className="text-sm font-medium text-yellow-900">Pending Refunds</span>
                    </div>
                    <div className="text-2xl font-bold text-yellow-900">
                      {formatCurrency(depositBalance.pending_refunds, depositBalance.currency_code)}
                    </div>
                  </div>

                  <div className="bg-green-50 p-4 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <DollarSign className="h-5 w-5 text-green-600" />
                      <span className="text-sm font-medium text-green-900">Available for Refund</span>
                    </div>
                    <div className="text-2xl font-bold text-green-900">
                      {formatCurrency(depositBalance.available_for_refund, depositBalance.currency_code)}
                    </div>
                  </div>
                </div>

                {/* Cylinder Breakdown */}
                {depositBalance.cylinder_breakdown && depositBalance.cylinder_breakdown.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-3">Cylinder Breakdown</h4>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                              Capacity
                            </th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                              Quantity
                            </th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                              Unit Deposit
                            </th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                              Total Deposit
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {depositBalance.cylinder_breakdown.map((item, index) => (
                            <tr key={index}>
                              <td className="px-4 py-2 text-sm text-gray-900">{item.capacity_l}L</td>
                              <td className="px-4 py-2 text-sm text-gray-900">{item.quantity}</td>
                              <td className="px-4 py-2 text-sm text-gray-900">
                                {formatCurrency(item.unit_deposit, depositBalance.currency_code)}
                              </td>
                              <td className="px-4 py-2 text-sm font-medium text-gray-900">
                                {formatCurrency(item.total_deposit, depositBalance.currency_code)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Last Updated */}
              <div className="px-6 py-3 bg-gray-50 text-sm text-gray-500">
                Last updated: {new Date(depositBalance.last_updated).toLocaleString()}
              </div>
            </div>
          ) : (
            <div className="p-6 text-center">
              <AlertCircle className="h-8 w-8 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500">No deposit information found for this customer</p>
            </div>
          )}
        </div>
      )}

      {/* Customer Deposit History */}
      {showHistory && selectedCustomerId && (
        <CustomerDepositHistory customerId={selectedCustomerId} />
      )}

      {/* Charge Modal */}
      {showChargeModal && selectedCustomerId && (
        <DepositChargeModal
          isOpen={showChargeModal}
          onClose={() => setShowChargeModal(false)}
          customerId={selectedCustomerId}
          customerName={depositBalance?.customer_name || ''}
        />
      )}

      {/* Refund Modal */}
      {showRefundModal && selectedCustomerId && (
        <DepositRefundModal
          isOpen={showRefundModal}
          onClose={() => setShowRefundModal(false)}
          customerId={selectedCustomerId}
          customerName={depositBalance?.customer_name || ''}
          currentBalance={depositBalance?.total_deposit_balance || 0}
          availableForRefund={depositBalance?.available_for_refund || 0}
          currencyCode={depositBalance?.currency_code || 'KES'}
        />
      )}
    </div>
  );
};