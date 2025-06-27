import React from 'react';
import { Package, Eye, EyeOff } from 'lucide-react';
import { GenericFilters, FilterField } from '../ui/GenericFilters';
import { ProductFilters as FilterType } from '../../types/product';

interface ProductFiltersProps {
  filters: FilterType;
  onFiltersChange: (filters: FilterType) => void;
}

export const ProductFilters: React.FC<ProductFiltersProps> = ({
  filters,
  onFiltersChange,
}) => {
  const filterFields: FilterField[] = [
    {
      type: 'search',
      key: 'search',
      placeholder: 'Search by SKU, name, or description...',
    },
    {
      type: 'select',
      key: 'status',
      label: 'All Statuses',
      icon: Package,
      options: [
        { value: 'active', label: 'Active' },
        { value: 'end_of_sale', label: 'End of Sale' },
        { value: 'obsolete', label: 'Obsolete' },
      ],
    },
    {
      type: 'select',
      key: 'unit_of_measure',
      label: 'All Types',
      icon: Package,
      options: [
        { value: 'cylinder', label: 'Cylinders' },
        { value: 'kg', label: 'By Weight (kg)' },
      ],
    },
    {
      type: 'sort',
      key: 'sort',
      options: [
        { value: 'created_at:desc', label: 'Newest First' },
        { value: 'created_at:asc', label: 'Oldest First' },
        { value: 'name:asc', label: 'Name A-Z' },
        { value: 'name:desc', label: 'Name Z-A' },
        { value: 'sku:asc', label: 'SKU A-Z' },
        { value: 'sku:desc', label: 'SKU Z-A' },
        { value: 'capacity_kg:desc', label: 'Capacity High-Low' },
        { value: 'capacity_kg:asc', label: 'Capacity Low-High' },
      ],
    },
  ];

  const customActions = (
    <button
      onClick={() => onFiltersChange({ ...filters, show_obsolete: !filters.show_obsolete, page: 1 })}
      className={`flex items-center space-x-2 px-3 py-2 rounded-md transition-colors ${
        filters.show_obsolete
          ? 'bg-red-100 text-red-800 border border-red-200'
          : 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200'
      }`}
      title={filters.show_obsolete ? 'Hide obsolete products' : 'Show obsolete products'}
    >
      {filters.show_obsolete ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      <span className="hidden sm:inline">
        {filters.show_obsolete ? 'Hide Obsolete' : 'Show Obsolete'}
      </span>
    </button>
  );

  return (
    <GenericFilters
      filters={filters}
      onFiltersChange={onFiltersChange}
      fields={filterFields}
      customActions={customActions}
    />
  );
};