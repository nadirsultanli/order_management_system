import React from 'react';
import { Edit, Trash2, Loader2, DollarSign, Calendar, AlertTriangle } from 'lucide-react';
import { DepositRate } from '../../types/deposits';
import { formatDateSync } from '../../utils/order';

interface DepositRateTableProps {
  rates: DepositRate[];
  loading?: boolean;
  onEdit: (rate: DepositRate) => void;
  onDelete: (rate: DepositRate) => void;
}

export const DepositRateTable: React.FC<DepositRateTableProps> = ({
  rates,
  loading = false,
  onEdit,
  onDelete,
}) => {

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center space-x-2">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            <span className="text-gray-600">Loading deposit rates...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!rates || rates.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="text-center py-12">
          <div className="mb-4">
            <DollarSign className="h-12 w-12 text-gray-300 mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No deposit rates found</h3>
          <p className="text-gray-500">
            Get started by creating your first deposit rate.
          </p>
        </div>
      </div>
    );
  }

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatDateRange = (startDate: string, endDate?: string | null) => {
    const start = formatDateSync(startDate);
    if (!endDate) {
      return `${start} - Ongoing`;
    }
    const end = formatDateSync(endDate);
    return `${start} - ${end}`;
  };

  const getStatusInfo = (rate: DepositRate) => {
    const now = new Date();
    const effectiveDate = new Date(rate.effective_date);
    const endDate = rate.end_date ? new Date(rate.end_date) : null;

    if (!rate.is_active) {
      return { 
        status: 'inactive', 
        label: 'Inactive', 
        color: 'bg-gray-100 text-gray-800 border-gray-200' 
      };
    }

    if (effectiveDate > now) {
      return { 
        status: 'future', 
        label: 'Future', 
        color: 'bg-blue-100 text-blue-800 border-blue-200' 
      };
    }

    if (endDate && endDate < now) {
      return { 
        status: 'expired', 
        label: 'Expired', 
        color: 'bg-red-100 text-red-800 border-red-200' 
      };
    }

    // Check if expiring soon (within 30 days)
    const isExpiringSoon = endDate && (endDate.getTime() - now.getTime()) <= (30 * 24 * 60 * 60 * 1000);

    return { 
      status: 'active', 
      label: 'Active', 
      color: 'bg-green-100 text-green-800 border-green-200',
      isExpiringSoon
    };
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Capacity
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Deposit Amount
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Currency
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Effective Period
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Created
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {rates.map((rate) => {
              const statusInfo = getStatusInfo(rate);

              return (
                <tr key={rate.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {rate.capacity_l}L
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {formatCurrency(rate.deposit_amount, rate.currency_code)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 font-mono">
                      {rate.currency_code}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <div className="text-sm text-gray-900">
                        {formatDateRange(rate.effective_date, rate.end_date)}
                      </div>
                      {statusInfo.isExpiringSoon && (
                        <AlertTriangle className="h-4 w-4 text-yellow-500" title="Expiring soon" />
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusInfo.color}`}>
                      {statusInfo.label}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDateSync(rate.created_at)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        onClick={() => onEdit(rate)}
                        className="text-gray-600 hover:text-gray-900 p-1 rounded hover:bg-gray-50 transition-colors"
                        title="Edit deposit rate"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => onDelete(rate)}
                        className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50 transition-colors"
                        title="Delete deposit rate"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Notes section for any rates with notes */}
      {rates.some(rate => rate.notes) && (
        <div className="border-t border-gray-200 bg-gray-50 px-6 py-3">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Notes:</h4>
          {rates.filter(rate => rate.notes).map(rate => (
            <div key={rate.id} className="text-sm text-gray-600 mb-1">
              <span className="font-medium">{rate.capacity_l}L:</span> {rate.notes}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};