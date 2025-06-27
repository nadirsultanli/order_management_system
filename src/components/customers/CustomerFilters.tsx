import React from 'react';
import { Search, Filter } from 'lucide-react';
import { CustomerFilters as FilterType } from '../../types/customer';

interface CustomerFiltersProps {
  filters: FilterType;
  onFiltersChange: (filters: FilterType) => void;
}

export const CustomerFilters: React.FC<CustomerFiltersProps> = ({
  filters,
  onFiltersChange,
}) => {
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFiltersChange({
      ...filters,
      search: e.target.value || undefined,
      page: 1, // Reset to first page when searching
    });
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onFiltersChange({
      ...filters,
      account_status: e.target.value || undefined,
      page: 1, // Reset to first page when filtering
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, email, or tax ID..."
              value={filters.search || ''}
              onChange={handleSearchChange}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
        
        <div className="sm:w-48">
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <select
              value={filters.account_status || ''}
              onChange={handleStatusChange}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white"
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="credit_hold">Credit Hold</option>
              <option value="closed">Closed</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};