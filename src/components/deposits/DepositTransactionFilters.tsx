import React from 'react';
import { Search, RotateCcw, Calendar, DollarSign, User } from 'lucide-react';
import { DepositTransactionFilters as FilterType, TRANSACTION_TYPES } from '../../types/deposits';

interface DepositTransactionFiltersProps {
  filters: FilterType;
  onFiltersChange: (filters: FilterType) => void;
}

export const DepositTransactionFilters: React.FC<DepositTransactionFiltersProps> = ({
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

  const handleCustomerIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFiltersChange({
      ...filters,
      customer_id: e.target.value || undefined,
      page: 1,
    });
  };

  const handleTransactionTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onFiltersChange({
      ...filters,
      transaction_type: e.target.value as any || undefined,
      page: 1,
    });
  };

  const handleDateFromChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFiltersChange({
      ...filters,
      date_from: e.target.value || undefined,
      page: 1,
    });
  };

  const handleDateToChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFiltersChange({
      ...filters,
      date_to: e.target.value || undefined,
      page: 1,
    });
  };

  const handleAmountMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFiltersChange({
      ...filters,
      amount_min: e.target.value ? Number(e.target.value) : undefined,
      page: 1,
    });
  };

  const handleAmountMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFiltersChange({
      ...filters,
      amount_max: e.target.value ? Number(e.target.value) : undefined,
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

  const handleVoidedChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    onFiltersChange({
      ...filters,
      is_voided: value === '' ? undefined : value === 'true',
      page: 1,
    });
  };

  const handleReset = () => {
    onFiltersChange({ page: 1 });
  };

  const commonCurrencies = ['KES', 'USD', 'EUR', 'GBP'];

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
      <div className="space-y-4">
        {/* First Row - Search and Customer */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by transaction ID, notes, or order..."
              value={filters.search || ''}
              onChange={handleSearchChange}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="relative">
            <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Customer ID..."
              value={filters.customer_id || ''}
              onChange={handleCustomerIdChange}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Second Row - Type, Currency, Voided Status */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <select
              value={filters.transaction_type || ''}
              onChange={handleTransactionTypeChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white"
            >
              <option value="">All Transaction Types</option>
              {TRANSACTION_TYPES.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          <div>
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

          <div>
            <select
              value={filters.is_voided === undefined ? '' : filters.is_voided.toString()}
              onChange={handleVoidedChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white"
            >
              <option value="">All Status</option>
              <option value="false">Active</option>
              <option value="true">Voided</option>
            </select>
          </div>
        </div>

        {/* Third Row - Date Range and Amount Range */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="grid grid-cols-2 gap-2">
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="date"
                placeholder="From date"
                value={filters.date_from || ''}
                onChange={handleDateFromChange}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="date"
                placeholder="To date"
                value={filters.date_to || ''}
                onChange={handleDateToChange}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="number"
                placeholder="Min amount"
                min="0"
                step="0.01"
                value={filters.amount_min || ''}
                onChange={handleAmountMinChange}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="number"
                placeholder="Max amount"
                min="0"
                step="0.01"
                value={filters.amount_max || ''}
                onChange={handleAmountMaxChange}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Reset Button */}
        <div className="flex justify-end">
          <button
            onClick={handleReset}
            className="flex items-center space-x-2 px-3 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-md transition-colors"
            title="Reset filters"
          >
            <RotateCcw className="h-4 w-4" />
            <span>Reset Filters</span>
          </button>
        </div>
      </div>

      {/* Active filters indicator */}
      {(filters.search || 
        filters.customer_id || 
        filters.transaction_type || 
        filters.date_from || 
        filters.date_to || 
        filters.amount_min || 
        filters.amount_max || 
        filters.currency_code || 
        filters.is_voided !== undefined) && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex flex-wrap gap-2">
            <span className="text-sm text-gray-500">Active filters:</span>
            
            {filters.search && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                Search: {filters.search}
              </span>
            )}
            
            {filters.customer_id && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                Customer: {filters.customer_id.substring(0, 8)}...
              </span>
            )}
            
            {filters.transaction_type && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Type: {filters.transaction_type}
              </span>
            )}
            
            {filters.currency_code && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                Currency: {filters.currency_code}
              </span>
            )}
            
            {filters.date_from && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                From: {filters.date_from}
              </span>
            )}
            
            {filters.date_to && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                To: {filters.date_to}
              </span>
            )}
            
            {(filters.amount_min !== undefined || filters.amount_max !== undefined) && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                Amount: {filters.amount_min || 0} - {filters.amount_max || '∞'}
              </span>
            )}
            
            {filters.is_voided !== undefined && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                Status: {filters.is_voided ? 'Voided' : 'Active'}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};