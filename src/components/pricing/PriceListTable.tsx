import React from 'react';
import { Edit, Copy, Star, Trash2, Loader2, DollarSign, Calendar, AlertTriangle } from 'lucide-react';
import { PriceList } from '../../types/pricing';
import { formatDateRange, formatCurrencySync } from '../../utils/pricing';
import { formatDateSync } from '../../utils/order';

interface PriceListTableProps {
  priceLists: (PriceList & { product_count?: number; status?: string; statusInfo?: { status: string; label: string; color: string }; isExpiringSoon?: boolean })[];
  loading?: boolean;
  onView: (priceList: PriceList) => void;
  onEdit: (priceList: PriceList) => void;
  onDuplicate: (priceList: PriceList) => void;
  onSetDefault: (priceList: PriceList) => void;
  onDelete: (priceList: PriceList) => void;
}

export const PriceListTable: React.FC<PriceListTableProps> = ({
  priceLists,
  loading = false,
  onView,
  onEdit,
  onDuplicate,
  onSetDefault,
  onDelete,
}) => {

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center space-x-2">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            <span className="text-gray-600">Loading price lists...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!priceLists || priceLists.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="text-center py-12">
          <div className="mb-4">
            <DollarSign className="h-12 w-12 text-gray-300 mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No price lists found</h3>
          <p className="text-gray-500">
            Get started by creating your first price list.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      {/* Header removed as per design update */}
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Price List
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Currency
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date Range
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Products
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
            {priceLists.map((priceList) => {
              // Use pre-computed values from backend instead of deprecated sync functions
              const statusInfo = priceList.statusInfo || { 
                status: 'active', 
                label: 'Active', 
                color: 'bg-green-100 text-green-800 border-green-200' 
              };
              const expiringSoon = priceList.isExpiringSoon || false;

              return (
                <tr key={priceList.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => onView(priceList)}
                          className="text-sm font-medium text-blue-600 hover:text-blue-900 hover:underline"
                        >
                          {priceList.name}
                        </button>
                        {priceList.is_default && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                            <Star className="h-3 w-3 mr-1" />
                            Default
                          </span>
                        )}
                        {expiringSoon && (
                          <AlertTriangle className="h-4 w-4 text-yellow-500" />
                        )}
                      </div>
                      {priceList.description && (
                        <div className="text-sm text-gray-500 mt-1 max-w-xs truncate">
                          {priceList.description}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 font-mono">
                      {priceList.currency_code}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <div className="text-sm text-gray-900">
                        {formatDateRange(priceList.start_date, priceList.end_date)}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusInfo.color}`}>
                      {statusInfo.label}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className="text-sm font-medium text-gray-900">
                      {priceList.product_count || 0}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDateSync(priceList.created_at)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        onClick={() => onEdit(priceList)}
                        className="text-gray-600 hover:text-gray-900 p-1 rounded hover:bg-gray-50 transition-colors"
                        title="Edit price list"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => onDuplicate(priceList)}
                        className="text-purple-600 hover:text-purple-900 p-1 rounded hover:bg-purple-50 transition-colors"
                        title="Duplicate price list"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                      {!priceList.is_default && (
                        <button
                          onClick={() => onSetDefault(priceList)}
                          className="text-green-600 hover:text-green-900 p-1 rounded hover:bg-green-50 transition-colors"
                          title="Set as default"
                        >
                          <Star className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => onDelete(priceList)}
                        className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50 transition-colors"
                        title="Delete price list"
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
    </div>
  );
};