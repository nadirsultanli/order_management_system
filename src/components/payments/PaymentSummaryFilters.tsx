import React, { useState, useEffect } from 'react';
import { Calendar, Filter, Download, RefreshCw, X } from 'lucide-react';
import { PaymentMethod, PaymentSummaryFilters as FilterType } from '../../types/payment';

interface PaymentSummaryFiltersProps {
  filters: FilterType;
  onFiltersChange: (filters: FilterType) => void;
  onExport?: () => void;
  onRefresh?: () => void;
  isLoading?: boolean;
  className?: string;
}

interface DateRange {
  label: string;
  value: string;
  getDateRange: () => { date_from: string; date_to: string };
}

const DATE_RANGES: DateRange[] = [
  {
    label: 'Today',
    value: 'today',
    getDateRange: () => {
      const today = new Date();
      const dateStr = today.toISOString().split('T')[0];
      return { date_from: dateStr, date_to: dateStr };
    },
  },
  {
    label: 'Yesterday',
    value: 'yesterday',
    getDateRange: () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateStr = yesterday.toISOString().split('T')[0];
      return { date_from: dateStr, date_to: dateStr };
    },
  },
  {
    label: 'Last 7 Days',
    value: 'last7days',
    getDateRange: () => {
      const today = new Date();
      const last7Days = new Date();
      last7Days.setDate(today.getDate() - 7);
      return {
        date_from: last7Days.toISOString().split('T')[0],
        date_to: today.toISOString().split('T')[0],
      };
    },
  },
  {
    label: 'Last 30 Days',
    value: 'last30days',
    getDateRange: () => {
      const today = new Date();
      const last30Days = new Date();
      last30Days.setDate(today.getDate() - 30);
      return {
        date_from: last30Days.toISOString().split('T')[0],
        date_to: today.toISOString().split('T')[0],
      };
    },
  },
  {
    label: 'This Month',
    value: 'thismonth',
    getDateRange: () => {
      const today = new Date();
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      return {
        date_from: firstDay.toISOString().split('T')[0],
        date_to: today.toISOString().split('T')[0],
      };
    },
  },
  {
    label: 'Last Month',
    value: 'lastmonth',
    getDateRange: () => {
      const today = new Date();
      const firstDayLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastDayLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
      return {
        date_from: firstDayLastMonth.toISOString().split('T')[0],
        date_to: lastDayLastMonth.toISOString().split('T')[0],
      };
    },
  },
  {
    label: 'This Year',
    value: 'thisyear',
    getDateRange: () => {
      const today = new Date();
      const firstDay = new Date(today.getFullYear(), 0, 1);
      return {
        date_from: firstDay.toISOString().split('T')[0],
        date_to: today.toISOString().split('T')[0],
      };
    },
  },
];

const PAYMENT_METHODS: { label: string; value: PaymentMethod }[] = [
  { label: 'Cash', value: 'Cash' },
  { label: 'M-Pesa', value: 'Mpesa' },
  { label: 'Card', value: 'Card' },
];

export const PaymentSummaryFilters: React.FC<PaymentSummaryFiltersProps> = ({
  filters,
  onFiltersChange,
  onExport,
  onRefresh,
  isLoading = false,
  className = '',
}) => {
  const [selectedDateRange, setSelectedDateRange] = useState<string>('last30days');
  const [showCustomDate, setShowCustomDate] = useState(false);
  const [customDateFrom, setCustomDateFrom] = useState('');
  const [customDateTo, setCustomDateTo] = useState('');

  // Initialize with last 30 days on mount
  useEffect(() => {
    if (!filters.date_from && !filters.date_to) {
      const defaultRange = DATE_RANGES.find(r => r.value === 'last30days');
      if (defaultRange) {
        const { date_from, date_to } = defaultRange.getDateRange();
        onFiltersChange({ ...filters, date_from, date_to });
      }
    }
  }, []);

  // Update filters when date range selection changes
  const handleDateRangeChange = (rangeValue: string) => {
    setSelectedDateRange(rangeValue);
    
    if (rangeValue === 'custom') {
      setShowCustomDate(true);
      return;
    }

    setShowCustomDate(false);
    const range = DATE_RANGES.find(r => r.value === rangeValue);
    if (range) {
      const { date_from, date_to } = range.getDateRange();
      onFiltersChange({ ...filters, date_from, date_to });
    }
  };

  // Handle custom date range
  const handleCustomDateApply = () => {
    if (customDateFrom && customDateTo) {
      onFiltersChange({
        ...filters,
        date_from: customDateFrom,
        date_to: customDateTo,
      });
    }
  };

  // Handle payment method filter
  const handlePaymentMethodChange = (method: PaymentMethod | undefined) => {
    onFiltersChange({ ...filters, payment_method: method });
  };

  // Clear all filters
  const handleClearFilters = () => {
    setSelectedDateRange('');
    setShowCustomDate(false);
    setCustomDateFrom('');
    setCustomDateTo('');
    onFiltersChange({});
  };

  // Count active filters
  const activeFiltersCount = Object.values(filters).filter(value => 
    value !== undefined && value !== '' && value !== null
  ).length;

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-6 ${className}`}>
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        {/* Left side - Filters */}
        <div className="flex flex-col sm:flex-row gap-4 flex-1">
          {/* Date Range Filter */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-700">Date Range</label>
            <div className="flex gap-2">
              <select
                value={selectedDateRange}
                onChange={(e) => handleDateRangeChange(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              >
                <option value="">Select Date Range</option>
                {DATE_RANGES.map((range) => (
                  <option key={range.value} value={range.value}>
                    {range.label}
                  </option>
                ))}
                <option value="custom">Custom Range</option>
              </select>
              {showCustomDate && (
                <div className="flex gap-2 items-center">
                  <input
                    type="date"
                    value={customDateFrom}
                    onChange={(e) => setCustomDateFrom(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    placeholder="From"
                  />
                  <span className="text-gray-500">to</span>
                  <input
                    type="date"
                    value={customDateTo}
                    onChange={(e) => setCustomDateTo(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    placeholder="To"
                  />
                  <button
                    onClick={handleCustomDateApply}
                    disabled={!customDateFrom || !customDateTo}
                    className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    Apply
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Payment Method Filter */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-700">Payment Method</label>
            <select
              value={filters.payment_method || ''}
              onChange={(e) => handlePaymentMethodChange(e.target.value as PaymentMethod | undefined)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            >
              <option value="">All Methods</option>
              {PAYMENT_METHODS.map((method) => (
                <option key={method.value} value={method.value}>
                  {method.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Right side - Actions */}
        <div className="flex gap-2">
          {/* Active Filters Indicator */}
          {activeFiltersCount > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">
                {activeFiltersCount} filter{activeFiltersCount > 1 ? 's' : ''} active
              </span>
              <button
                onClick={handleClearFilters}
                className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <X className="h-4 w-4" />
                Clear
              </button>
            </div>
          )}

          {/* Refresh Button */}
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="flex items-center gap-2 px-3 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          )}

          {/* Export Button */}
          {onExport && (
            <button
              onClick={onExport}
              disabled={isLoading}
              className="flex items-center gap-2 px-3 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Export</span>
            </button>
          )}
        </div>
      </div>

      {/* Current Filters Display */}
      {(filters.date_from || filters.payment_method) && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex flex-wrap gap-2">
            {filters.date_from && filters.date_to && (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                <Calendar className="h-3 w-3" />
                {filters.date_from === filters.date_to 
                  ? new Date(filters.date_from).toLocaleDateString()
                  : `${new Date(filters.date_from).toLocaleDateString()} - ${new Date(filters.date_to).toLocaleDateString()}`
                }
              </span>
            )}
            {filters.payment_method && (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                <Filter className="h-3 w-3" />
                {filters.payment_method}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentSummaryFilters;