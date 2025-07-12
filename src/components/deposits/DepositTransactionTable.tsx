import React from 'react';
import { Eye, AlertCircle, Loader2, TrendingUp, TrendingDown, Edit3 } from 'lucide-react';
import { DepositTransaction } from '../../types/deposits';
import { DepositStatusBadge } from './DepositStatusBadge';
import { formatDateSync } from '../../utils/order';

interface DepositTransactionTableProps {
  transactions: DepositTransaction[];
  loading?: boolean;
  summary?: {
    total_charges: number;
    total_refunds: number;
    total_adjustments: number;
    net_deposits: number;
  };
}

export const DepositTransactionTable: React.FC<DepositTransactionTableProps> = ({
  transactions,
  loading = false,
  summary,
}) => {

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

  const getAmountDisplay = (transaction: DepositTransaction) => {
    const isNegative = transaction.transaction_type === 'refund' || 
                     (transaction.transaction_type === 'adjustment' && transaction.amount < 0);
    const sign = isNegative ? '-' : '+';
    const amount = Math.abs(transaction.amount);
    const color = transaction.transaction_type === 'refund' ? 'text-green-600' : 
                  transaction.transaction_type === 'adjustment' ? 'text-yellow-600' : 'text-blue-600';
    
    return (
      <span className={`font-medium ${color}`}>
        {sign}{formatCurrency(amount, transaction.currency_code)}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center space-x-2">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            <span className="text-gray-600">Loading transactions...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!transactions || transactions.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {summary && (
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Transaction Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 p-3 rounded-lg">
                <div className="text-sm font-medium text-blue-900">Total Charges</div>
                <div className="text-lg font-bold text-blue-900">
                  {formatCurrency(summary.total_charges, 'KES')}
                </div>
              </div>
              <div className="bg-green-50 p-3 rounded-lg">
                <div className="text-sm font-medium text-green-900">Total Refunds</div>
                <div className="text-lg font-bold text-green-900">
                  {formatCurrency(summary.total_refunds, 'KES')}
                </div>
              </div>
              <div className="bg-yellow-50 p-3 rounded-lg">
                <div className="text-sm font-medium text-yellow-900">Adjustments</div>
                <div className="text-lg font-bold text-yellow-900">
                  {formatCurrency(summary.total_adjustments, 'KES')}
                </div>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="text-sm font-medium text-gray-900">Net Deposits</div>
                <div className="text-lg font-bold text-gray-900">
                  {formatCurrency(summary.net_deposits, 'KES')}
                </div>
              </div>
            </div>
          </div>
        )}
        <div className="text-center py-12">
          <div className="mb-4">
            <AlertCircle className="h-12 w-12 text-gray-300 mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No transactions found</h3>
          <p className="text-gray-500">
            No deposit transactions match the current filters.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      {/* Summary Section */}
      {summary && (
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Transaction Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 p-3 rounded-lg">
              <div className="text-sm font-medium text-blue-900">Total Charges</div>
              <div className="text-lg font-bold text-blue-900">
                {formatCurrency(summary.total_charges, transactions[0]?.currency_code || 'KES')}
              </div>
            </div>
            <div className="bg-green-50 p-3 rounded-lg">
              <div className="text-sm font-medium text-green-900">Total Refunds</div>
              <div className="text-lg font-bold text-green-900">
                {formatCurrency(summary.total_refunds, transactions[0]?.currency_code || 'KES')}
              </div>
            </div>
            <div className="bg-yellow-50 p-3 rounded-lg">
              <div className="text-sm font-medium text-yellow-900">Adjustments</div>
              <div className="text-lg font-bold text-yellow-900">
                {formatCurrency(summary.total_adjustments, transactions[0]?.currency_code || 'KES')}
              </div>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="text-sm font-medium text-gray-900">Net Deposits</div>
              <div className="text-lg font-bold text-gray-900">
                {formatCurrency(summary.net_deposits, transactions[0]?.currency_code || 'KES')}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Transactions Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date & Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Customer
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
            {transactions.map((transaction) => (
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
                  <div className="text-sm text-gray-900">
                    Customer ID: {transaction.customer_id.substring(0, 8)}...
                  </div>
                  {transaction.created_by && (
                    <div className="text-sm text-gray-500">
                      By: {transaction.created_by}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {getAmountDisplay(transaction)}
                </td>
                <td className="px-6 py-4">
                  <div className="space-y-1">
                    {transaction.cylinder_details.map((cylinder, index) => (
                      <div key={index} className="text-sm text-gray-900">
                        {cylinder.quantity}x {cylinder.capacity_l}L 
                        <div className="text-xs text-gray-500 truncate max-w-32">
                          {cylinder.product_name}
                        </div>
                        {cylinder.condition && (
                          <div className="text-xs text-gray-500">
                            Condition: {cylinder.condition}
                          </div>
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
                  <div className="text-sm text-gray-500 max-w-xs">
                    {transaction.notes && (
                      <div className="mb-1 truncate">{transaction.notes}</div>
                    )}
                    {transaction.order_id && (
                      <div className="text-xs text-blue-600 mb-1">
                        Order: {transaction.order_id.substring(0, 8)}...
                      </div>
                    )}
                    {transaction.is_voided && (
                      <div className="text-xs text-red-600">
                        Voided: {transaction.void_reason}
                        {transaction.voided_at && (
                          <div className="text-xs text-gray-500">
                            {formatDateSync(transaction.voided_at)}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};