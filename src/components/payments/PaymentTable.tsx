import React, { useState, useMemo } from 'react';
import { 
  Eye, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  Search, 
  Filter, 
  Download, 
  RefreshCw,
  CreditCard,
  Smartphone,
  Banknote,
  Receipt,
  Clock,
  CheckCircle,
  XCircle,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Calendar,
  DollarSign
} from 'lucide-react';
import { Card } from '../ui/Card';
import { StatusBadge } from '../ui/StatusBadge';
import { Pagination } from '../ui/Pagination';
import { PaymentListItem, PaymentFilters, PaymentMethod, PaymentStatus } from '../../types/payment';
import { formatCurrencySync } from '../../utils/pricing';
import { formatDateSync } from '../../utils/order';

type SortField = 'payment_date' | 'amount' | 'payment_method' | 'payment_status' | 'created_at';
type SortDirection = 'asc' | 'desc';

interface PaymentTableProps {
  payments: PaymentListItem[];
  loading?: boolean;
  totalCount: number;
  currentPage: number;
  totalPages: number;
  filters: PaymentFilters;
  onFiltersChange: (filters: PaymentFilters) => void;
  onPageChange: (page: number) => void;
  onPaymentClick: (payment: PaymentListItem) => void;
  onStatusUpdate?: (paymentId: string, status: PaymentStatus) => void;
  onExport?: () => void;
  onRefresh?: () => void;
  showBulkActions?: boolean;
  selectedPayments?: string[];
  onSelectionChange?: (paymentIds: string[]) => void;
}

// Payment method icons and colors
const getPaymentMethodIcon = (method: PaymentMethod) => {
  switch (method) {
    case 'Cash':
      return <Banknote className="h-4 w-4 text-green-600" />;
    case 'Mpesa':
      return <Smartphone className="h-4 w-4 text-green-600" />;
    case 'Card':
      return <CreditCard className="h-4 w-4 text-blue-600" />;
    default:
      return <DollarSign className="h-4 w-4 text-gray-600" />;
  }
};

// Payment status configurations
const getPaymentStatusConfig = (status: PaymentStatus) => {
  switch (status) {
    case 'completed':
      return { 
        bg: 'bg-green-100', 
        text: 'text-green-800', 
        dot: 'bg-green-500',
        icon: <CheckCircle className="h-4 w-4" />
      };
    case 'pending':
      return { 
        bg: 'bg-yellow-100', 
        text: 'text-yellow-800', 
        dot: 'bg-yellow-500',
        icon: <Clock className="h-4 w-4" />
      };
    case 'failed':
      return { 
        bg: 'bg-red-100', 
        text: 'text-red-800', 
        dot: 'bg-red-500',
        icon: <XCircle className="h-4 w-4" />
      };
    case 'refunded':
      return { 
        bg: 'bg-gray-100', 
        text: 'text-gray-800', 
        dot: 'bg-gray-500',
        icon: <RotateCcw className="h-4 w-4" />
      };
    default:
      return { 
        bg: 'bg-gray-100', 
        text: 'text-gray-800', 
        dot: 'bg-gray-500',
        icon: <Clock className="h-4 w-4" />
      };
  }
};

// Status update options
const statusOptions = [
  { value: 'pending', label: 'Pending' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
  { value: 'refunded', label: 'Refunded' },
];

export const PaymentTable: React.FC<PaymentTableProps> = ({
  payments,
  loading = false,
  totalCount,
  currentPage,
  totalPages,
  filters,
  onFiltersChange,
  onPageChange,
  onPaymentClick,
  onStatusUpdate,
  onExport,
  onRefresh,
  showBulkActions = false,
  selectedPayments = [],
  onSelectionChange,
}) => {
  const [showFilters, setShowFilters] = useState(false);
  const [sortField, setSortField] = useState<SortField>('payment_date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [searchTerm, setSearchTerm] = useState(filters.search || '');

  // Handle sorting
  const handleSort = (field: SortField) => {
    const newDirection = sortField === field && sortDirection === 'desc' ? 'asc' : 'desc';
    setSortField(field);
    setSortDirection(newDirection);
    onFiltersChange({
      ...filters,
      sort_by: field,
      sort_order: newDirection,
    });
  };

  // Handle search
  const handleSearch = (value: string) => {
    setSearchTerm(value);
    onFiltersChange({
      ...filters,
      search: value || undefined,
      page: 1, // Reset to first page on search
    });
  };

  // Handle filter changes
  const handleFilterChange = (key: keyof PaymentFilters, value: any) => {
    onFiltersChange({
      ...filters,
      [key]: value,
      page: 1, // Reset to first page on filter change
    });
  };

  // Handle selection
  const handleSelectAll = (checked: boolean) => {
    if (onSelectionChange) {
      onSelectionChange(checked ? payments.map(p => p.id) : []);
    }
  };

  const handleSelectPayment = (paymentId: string, checked: boolean) => {
    if (onSelectionChange) {
      if (checked) {
        onSelectionChange([...selectedPayments, paymentId]);
      } else {
        onSelectionChange(selectedPayments.filter(id => id !== paymentId));
      }
    }
  };

  // Render sort icon
  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4 text-gray-400" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="h-4 w-4 text-blue-600" />
      : <ArrowDown className="h-4 w-4 text-blue-600" />;
  };

  const isAllSelected = payments.length > 0 && selectedPayments.length === payments.length;
  const isSomeSelected = selectedPayments.length > 0 && selectedPayments.length < payments.length;

  return (
    <Card className="overflow-hidden">
      {/* Header with search, filters, and actions */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900">
              Payments ({totalCount.toLocaleString()})
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              Manage and track all payment transactions
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={loading}
                className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            )}

            {onExport && (
              <button
                onClick={onExport}
                className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </button>
            )}

            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`inline-flex items-center px-3 py-2 border rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                showFilters || Object.keys(filters).some(key => filters[key as keyof PaymentFilters] !== undefined && key !== 'page' && key !== 'limit')
                  ? 'border-blue-300 text-blue-700 bg-blue-50'
                  : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'
              }`}
            >
              <Filter className="h-4 w-4 mr-2" />
              Filters
            </button>
          </div>
        </div>

        {/* Search bar */}
        <div className="mt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search payments by ID, transaction ID, reference number, or customer..."
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Payment Method Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Method
                </label>
                <select
                  value={filters.payment_method || ''}
                  onChange={(e) => handleFilterChange('payment_method', e.target.value || undefined)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Methods</option>
                  <option value="Cash">Cash</option>
                  <option value="Mpesa">M-Pesa</option>
                  <option value="Card">Card</option>
                </select>
              </div>

              {/* Payment Status Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  value={filters.payment_status || ''}
                  onChange={(e) => handleFilterChange('payment_status', e.target.value || undefined)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="completed">Completed</option>
                  <option value="failed">Failed</option>
                  <option value="refunded">Refunded</option>
                </select>
              </div>

              {/* Date From */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date From
                </label>
                <input
                  type="date"
                  value={filters.date_from || ''}
                  onChange={(e) => handleFilterChange('date_from', e.target.value || undefined)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Date To */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date To
                </label>
                <input
                  type="date"
                  value={filters.date_to || ''}
                  onChange={(e) => handleFilterChange('date_to', e.target.value || undefined)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Amount Min */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Min Amount
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={filters.amount_min || ''}
                  onChange={(e) => handleFilterChange('amount_min', e.target.value ? parseFloat(e.target.value) : undefined)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Amount Max */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max Amount
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={filters.amount_max || ''}
                  onChange={(e) => handleFilterChange('amount_max', e.target.value ? parseFloat(e.target.value) : undefined)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Clear Filters */}
            <div className="flex justify-end">
              <button
                onClick={() => {
                  setSearchTerm('');
                  onFiltersChange({ page: 1, limit: filters.limit });
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                Clear All Filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {showBulkActions && onSelectionChange && (
                <th className="px-6 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    ref={(input) => {
                      if (input) input.indeterminate = isSomeSelected;
                    }}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                </th>
              )}

              <th 
                onClick={() => handleSort('payment_date')}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              >
                <div className="flex items-center">
                  Date
                  {renderSortIcon('payment_date')}
                </div>
              </th>

              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Payment ID
              </th>

              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Order
              </th>

              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Customer
              </th>

              <th 
                onClick={() => handleSort('amount')}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              >
                <div className="flex items-center">
                  Amount
                  {renderSortIcon('amount')}
                </div>
              </th>

              <th 
                onClick={() => handleSort('payment_method')}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              >
                <div className="flex items-center">
                  Method
                  {renderSortIcon('payment_method')}
                </div>
              </th>

              <th 
                onClick={() => handleSort('payment_status')}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              >
                <div className="flex items-center">
                  Status
                  {renderSortIcon('payment_status')}
                </div>
              </th>

              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Reference
              </th>

              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>

          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={showBulkActions ? 10 : 9} className="px-6 py-12 text-center">
                  <div className="flex items-center justify-center">
                    <RefreshCw className="h-6 w-6 animate-spin text-gray-400 mr-2" />
                    <span className="text-gray-500">Loading payments...</span>
                  </div>
                </td>
              </tr>
            ) : payments.length === 0 ? (
              <tr>
                <td colSpan={showBulkActions ? 10 : 9} className="px-6 py-12 text-center">
                  <div className="text-gray-500">
                    <Receipt className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p className="text-lg font-medium mb-2">No payments found</p>
                    <p className="text-sm">Try adjusting your search criteria or filters</p>
                  </div>
                </td>
              </tr>
            ) : (
              payments.map((payment) => {
                const statusConfig = getPaymentStatusConfig(payment.payment_status);
                const isSelected = selectedPayments.includes(payment.id);

                return (
                  <tr 
                    key={payment.id} 
                    className={`hover:bg-gray-50 ${isSelected ? 'bg-blue-50' : ''}`}
                  >
                    {showBulkActions && onSelectionChange && (
                      <td className="px-6 py-4">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => handleSelectPayment(payment.id, e.target.checked)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                      </td>
                    )}

                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 text-gray-400 mr-2" />
                        {formatDateSync(payment.payment_date)}
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {payment.id.slice(0, 8)}...
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {payment.order ? (
                        <div>
                          <div className="font-medium">{payment.order.id.slice(0, 8)}...</div>
                          <div className="text-gray-500">{formatCurrencySync(payment.order.total_amount)}</div>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {payment.order?.customer ? (
                        <div>
                          <div className="font-medium">{payment.order.customer.name}</div>
                          <div className="text-gray-500">{payment.order.customer.email}</div>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                      {formatCurrencySync(payment.amount)}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center">
                        {getPaymentMethodIcon(payment.payment_method)}
                        <span className="ml-2">{payment.payment_method}</span>
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <StatusBadge
                        status={payment.payment_status}
                        size="sm"
                        interactive={!!onStatusUpdate}
                        options={statusOptions}
                        onStatusChange={(newStatus) => 
                          onStatusUpdate?.(payment.id, newStatus as PaymentStatus)
                        }
                      />
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {payment.reference_number || payment.transaction_id || (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => onPaymentClick(payment)}
                        className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        View
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalCount}
          itemsPerPage={filters.limit || 50}
          onPageChange={onPageChange}
          className="border-t"
        />
      )}
    </Card>
  );
};