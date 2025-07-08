import React from 'react';
import { Search, RotateCcw } from 'lucide-react';
import { InventoryFilters as FilterType } from '../../types/inventory';
import { SearchableWarehouseSelector } from '../warehouses/SearchableWarehouseSelector';

interface InventoryFiltersProps {
  filters: FilterType;
  onFiltersChange: (filters: FilterType) => void;
}

export const InventoryFilters: React.FC<InventoryFiltersProps> = ({
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

  const handleWarehouseChange = (warehouseId: string) => {
    onFiltersChange({
      ...filters,
      warehouse_id: warehouseId || undefined,
      page: 1,
    });
  };



  const handleReset = () => {
    onFiltersChange({ page: 1 });
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by product SKU or name..."
              value={filters.search || ''}
              onChange={handleSearchChange}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="sm:w-64">
            <SearchableWarehouseSelector
              value={filters.warehouse_id}
              onChange={handleWarehouseChange}
              placeholder="All Warehouses"
            />
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
    </div>
  );
};