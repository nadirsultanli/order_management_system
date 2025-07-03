import React from 'react';
import { Search, Filter, AlertTriangle, RotateCcw } from 'lucide-react';
import { InventoryFilters as FilterType } from '../../types/inventory';
import { WarehouseSelector } from '../warehouses/WarehouseSelector';

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

  const handleLowStockToggle = () => {
    onFiltersChange({
      ...filters,
      low_stock_only: !filters.low_stock_only,
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
            <WarehouseSelector
              value={filters.warehouse_id}
              onChange={handleWarehouseChange}
              placeholder="All Warehouses"
            />
          </div>

          <button
            onClick={handleLowStockToggle}
            className={`flex items-center space-x-2 px-3 py-2 rounded-md transition-colors ${
              filters.low_stock_only
                ? 'bg-red-100 text-red-800 border border-red-200'
                : 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200'
            }`}
            title="Show items with intelligent low stock detection"
          >
            <AlertTriangle className="h-4 w-4" />
            <span>Smart Low Stock</span>
          </button>

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