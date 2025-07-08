import React, { useState } from 'react';
import { Search, Package, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import { Card } from '../ui/Card';
import { CustomerBalance } from '../../types/delivery';
import { CustomerSelector } from '../customers/CustomerSelector';
import { useCustomers } from '../../hooks/useCustomers';
import { useCustomerBalance } from '../../hooks/useDeliveries';

export const CustomerBalanceCard: React.FC = () => {
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch customers for the selector
  const { data: customersData, isLoading: isLoadingCustomers } = useCustomers({
    search: searchTerm,
    limit: 50,
  });

  // Fetch balance data for selected customer
  const { data: balanceData, isLoading: isLoadingBalance } = useCustomerBalance(selectedCustomerId);

  const customers = customersData?.customers || [];
  const balances = balanceData || [];

  const totalCylinders = balances.reduce((sum: number, balance: CustomerBalance) => sum + balance.cylinders_with_customer, 0);
  const totalToReturn = balances.reduce((sum: number, balance: CustomerBalance) => sum + balance.cylinders_to_return, 0);
  const totalDeposit = balances.reduce((sum: number, balance: CustomerBalance) => sum + balance.deposit_amount, 0);
  const totalCredit = balances.reduce((sum: number, balance: CustomerBalance) => sum + balance.credit_balance, 0);

  return (
    <div className="space-y-6">
      {/* Customer Selection */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Select Customer
          </label>
          <CustomerSelector
            value={selectedCustomerId}
            onChange={setSelectedCustomerId}
            customers={customers}
            placeholder="Search and select a customer..."
          />
        </div>
      </div>

      {selectedCustomerId && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Cylinders</p>
                  <p className="text-2xl font-bold text-gray-900">{totalCylinders}</p>
                </div>
                <Package className="h-8 w-8 text-blue-500" />
              </div>
              <p className="mt-2 text-xs text-gray-500">With customer</p>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">To Return</p>
                  <p className="text-2xl font-bold text-orange-600">{totalToReturn}</p>
                </div>
                <AlertCircle className="h-8 w-8 text-orange-500" />
              </div>
              <p className="mt-2 text-xs text-gray-500">Empty cylinders</p>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Deposit</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {totalDeposit.toLocaleString('en-US', {
                      style: 'currency',
                      currency: 'KES',
                      minimumFractionDigits: 0,
                    })}
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-500" />
              </div>
              <p className="mt-2 text-xs text-gray-500">Security deposit</p>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Credit Balance</p>
                  <p className={`text-2xl font-bold ${totalCredit < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {totalCredit.toLocaleString('en-US', {
                      style: 'currency',
                      currency: 'KES',
                      minimumFractionDigits: 0,
                    })}
                  </p>
                </div>
                <TrendingDown className={`h-8 w-8 ${totalCredit < 0 ? 'text-red-500' : 'text-green-500'}`} />
              </div>
              <p className="mt-2 text-xs text-gray-500">
                {totalCredit < 0 ? 'Customer owes' : 'Customer credit'}
              </p>
            </Card>
          </div>

          {/* Balance Details Table */}
          <Card>
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Cylinder Balance Details</h3>
              
              {isLoadingBalance ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-2 text-sm text-gray-600">Loading balance data...</p>
                </div>
              ) : balances.length === 0 ? (
                <div className="text-center py-8">
                  <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No cylinder balance found for this customer.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Product
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          With Customer
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          To Return
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Deposit
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Credit
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Last Transaction
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {balances.map((balance: CustomerBalance) => (
                        <tr key={balance.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {balance.product_name}
                              </div>
                              <div className="text-sm text-gray-500">{balance.product_sku}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm font-medium text-gray-900">
                              {balance.cylinders_with_customer}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`text-sm font-medium ${
                              balance.cylinders_to_return > 0 ? 'text-orange-600' : 'text-gray-900'
                            }`}>
                              {balance.cylinders_to_return}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {balance.deposit_amount.toLocaleString('en-US', {
                              style: 'currency',
                              currency: 'KES',
                              minimumFractionDigits: 0,
                            })}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`text-sm font-medium ${
                              balance.credit_balance < 0 ? 'text-red-600' : 'text-green-600'
                            }`}>
                              {balance.credit_balance.toLocaleString('en-US', {
                                style: 'currency',
                                currency: 'KES',
                                minimumFractionDigits: 0,
                              })}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {balance.last_transaction_date 
                              ? new Date(balance.last_transaction_date).toLocaleDateString()
                              : 'N/A'
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </Card>
        </>
      )}

      {!selectedCustomerId && (
        <Card className="p-8 text-center">
          <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Select a customer to view their cylinder balance.</p>
        </Card>
      )}
    </div>
  );
}; 