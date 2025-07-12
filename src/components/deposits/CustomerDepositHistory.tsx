import React, { useState } from 'react';
import { Calendar, TrendingUp, TrendingDown, Edit3, Eye, Loader2 } from 'lucide-react';
import { useCustomerDepositHistory } from '../../hooks/useDeposits';
import { CustomerPagination } from '../customers/CustomerPagination';
import { DepositStatusBadge } from './DepositStatusBadge';
import { formatDateSync } from '../../utils/order';
import { TRANSACTION_TYPES } from '../../types/deposits';

interface CustomerDepositHistoryProps {
  customerId: string;
}

export const CustomerDepositHistory: React.FC<CustomerDepositHistoryProps> = ({
  customerId,
}) => {
  const [filters, setFilters] = useState({
    page: 1,
    limit: 10,
    transaction_type: undefined as 'charge' | 'refund' | 'adjustment' | undefined,
    date_from: '',
    date_to: '',
  });

  const { data: historyData, isLoading } = useCustomerDepositHistory(customerId, filters);

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'charge':
        return <TrendingUp className="h-4 w-4 text-blue-600" />;
      case 'refund':
        return <TrendingDown className="h-4 w-4 text-green-600" />;
      case 'adjustment':
        return <Edit3 className="h-4 w-4 text-yellow-600" />;
      default:
        return <Eye className="h-4 w-4 text-gray-600" />;
    }
  };

  const getAmountDisplay = (transaction: any) => {
    const sign = transaction.transaction_type === 'refund' ? '-' : '+';
    const color = transaction.transaction_type === 'refund' ? 'text-green-600' : 'text-blue-600';
    
    return (
      <span className={`font-medium ${color}`}>
        {sign}{formatCurrency(Math.abs(transaction.amount), transaction.currency_code)}
      </span>
    );
  };

  const handlePageChange = (page: number) => {
    setFilters(prev => ({ ...prev, page }));
  };

  const handleTypeFilterChange = (type: string) => {
    setFilters(prev => ({ 
      ...prev, 
      transaction_type: type === '' ? undefined : type as any,
      page: 1 
    }));
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center space-x-2">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            <span className="text-gray-600">Loading transaction history...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!historyData || historyData.transactions.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Transaction History</h3>
          <div className="text-center py-8">
            <Calendar className="h-8 w-8 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500">No deposit transactions found</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Transaction History</h3>
          <div className="text-sm text-gray-500">
            {historyData.customerName || 'Customer History'}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 p-3 rounded-lg">
            <div className="text-sm font-medium text-blue-900">Total Charged</div>
            <div className="text-lg font-bold text-blue-900">
              {formatCurrency(historyData.summary.total_charged, historyData.transactions[0]?.currency_code || 'KES')}
            </div>
          </div>
          <div className="bg-green-50 p-3 rounded-lg">
            <div className="text-sm font-medium text-green-900">Total Refunded</div>
            <div className="text-lg font-bold text-green-900">
              {formatCurrency(historyData.summary.total_refunded, historyData.transactions[0]?.currency_code || 'KES')}
            </div>
          </div>
          <div className="bg-yellow-50 p-3 rounded-lg">
            <div className="text-sm font-medium text-yellow-900">Adjustments</div>
            <div className="text-lg font-bold text-yellow-900">
              {formatCurrency(historyData.summary.total_adjustments, historyData.transactions[0]?.currency_code || 'KES')}
            </div>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="text-sm font-medium text-gray-900">Current Balance</div>
            <div className="text-lg font-bold text-gray-900">
              {formatCurrency(historyData.summary.current_balance, historyData.transactions[0]?.currency_code || 'KES')}
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <select
              value={filters.transaction_type || ''}
              onChange={(e) => handleTypeFilterChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Transaction Types</option>
              {TRANSACTION_TYPES.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <input
              type="date"
              value={filters.date_from}
              onChange={(e) => setFilters(prev => ({ ...prev, date_from: e.target.value, page: 1 }))}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="From date"
            />
            <input
              type="date"
              value={filters.date_to}
              onChange={(e) => setFilters(prev => ({ ...prev, date_to: e.target.value, page: 1 }))}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="To date"
            />
          </div>
        </div>
      </div>

      {/* Transaction List */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date & Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Amount
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Cylinders
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Notes
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {historyData.transactions.map((transaction) => (
              <tr key={transaction.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center space-x-2">
                    {getTransactionIcon(transaction.transaction_type)}
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {formatDateSync(transaction.transaction_date)}
                      </div>
                      <div className="text-sm text-gray-500 capitalize">
                        {transaction.transaction_type}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {getAmountDisplay(transaction)}
                </td>
                <td className="px-6 py-4">
                  <div className="space-y-1">
                    {transaction.cylinder_details.map((cylinder, index) => (
                      <div key={index} className="text-sm text-gray-900">
                        {cylinder.quantity}x {cylinder.capacity_l}L {cylinder.product_name}
                        {cylinder.condition && (
                          <span className="text-gray-500 ml-1">({cylinder.condition})</span>
                        )}
                      </div>
                    ))}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <DepositStatusBadge 
                    type={transaction.transaction_type}
                    isVoided={transaction.is_voided}
                  />
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-gray-500 max-w-xs truncate">
                    {transaction.notes || '-'}
                  </div>
                  {transaction.order_id && (
                    <div className="text-xs text-blue-600 mt-1">
                      Order: {transaction.order_id.substring(0, 8)}...
                    </div>
                  )}
                  {transaction.is_voided && (
                    <div className="text-xs text-red-600 mt-1">
                      Voided: {transaction.void_reason}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {historyData.totalPages > 1 && (
        <div className="border-t border-gray-200 px-6 py-3">
          <CustomerPagination
            currentPage={historyData.currentPage}
            totalPages={historyData.totalPages}
            totalCount={historyData.totalCount}
            onPageChange={handlePageChange}
            itemsPerPage={filters.limit}
          />
        </div>
      )}
    </div>
  );
};