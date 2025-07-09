import React from 'react';
import { Search, Filter } from 'lucide-react';
import { TruckFilters as FilterType } from '../../types/truck';

interface TruckFiltersProps {
  filters: FilterType;
  onFiltersChange: (filters: FilterType) => void;
}

export const TruckFilters: React.FC<TruckFiltersProps> = ({
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

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    const validSortValues = ['capacity_asc', 'capacity_desc'];
    onFiltersChange({
      ...filters,
      sort_by: value && validSortValues.includes(value) ? value as 'capacity_asc' | 'capacity_desc' : undefined,
      page: 1, // Reset to first page when sorting
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
              placeholder="Search by fleet number or license plate..."
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
              value={filters.sort_by || ''}
              onChange={handleSortChange}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white"
            >
              <option value="">All Capacities</option>
              <option value="capacity_asc">Capacity (Low to High)</option>
              <option value="capacity_desc">Capacity (High to Low)</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};