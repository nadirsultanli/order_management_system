import React from 'react';
import { Search, RotateCcw, DollarSign, Calendar } from 'lucide-react';
import { DepositRateFilters as FilterType } from '../../types/deposits';

interface DepositRateFiltersProps {
  filters: FilterType;
  onFiltersChange: (filters: FilterType) => void;
}

export const DepositRateFilters: React.FC<DepositRateFiltersProps> = ({
  filters,
  onFiltersChange,
}) => {
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFiltersChange({
      ...filters,
      search: e.target.value || undefined,
      page: 1,
    });
  };

  const handleCapacityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onFiltersChange({
      ...filters,
      capacity_l: e.target.value ? Number(e.target.value) : undefined,
      page: 1,
    });
  };

  const handleCurrencyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onFiltersChange({
      ...filters,
      currency_code: e.target.value || undefined,
      page: 1,
    });
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    onFiltersChange({
      ...filters,
      is_active: value === '' ? undefined : value === 'true',
      page: 1,
    });
  };

  const handleReset = () => {
    onFiltersChange({ page: 1 });
  };

  const commonCapacities = [5, 9, 13, 19, 47.5];
  const commonCurrencies = ['KES', 'USD', 'EUR', 'GBP'];

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by capacity, amount, or notes..."
              value={filters.search || ''}
              onChange={handleSearchChange}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="sm:w-32">
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <select
                value={filters.capacity_l || ''}
                onChange={handleCapacityChange}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white"
              >
                <option value="">All Sizes</option>
                {commonCapacities.map(capacity => (
                  <option key={capacity} value={capacity}>
                    {capacity}L
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="sm:w-28">
            <select
              value={filters.currency_code || ''}
              onChange={handleCurrencyChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white"
            >
              <option value="">All Currencies</option>
              {commonCurrencies.map(currency => (
                <option key={currency} value={currency}>
                  {currency}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:w-32">
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <select
                value={filters.is_active === undefined ? '' : filters.is_active.toString()}
                onChange={handleStatusChange}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white"
              >
                <option value="">All Status</option>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
          </div>

          <button
            onClick={handleReset}
            className="flex items-center space-x-2 px-3 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-md transition-colors"
            title="Reset filters"
          >
            <RotateCcw className="h-4 w-4" />
            <span className="hidden sm:inline">Reset</span>
          </button>
        </div>
      </div>

      {/* Active filters indicator */}
      {(filters.search || filters.capacity_l || filters.currency_code || filters.is_active !== undefined) && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <div className="flex flex-wrap gap-2">
            <span className="text-sm text-gray-500">Active filters:</span>
            
            {filters.search && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                Search: {filters.search}
              </span>
            )}
            
            {filters.capacity_l && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Size: {filters.capacity_l}L
              </span>
            )}
            
            {filters.currency_code && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                Currency: {filters.currency_code}
              </span>
            )}
            
            {filters.is_active !== undefined && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                Status: {filters.is_active ? 'Active' : 'Inactive'}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};