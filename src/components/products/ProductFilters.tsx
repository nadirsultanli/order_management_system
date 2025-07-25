import React from 'react';
import { Search, Filter, Eye, EyeOff } from 'lucide-react';
import { ProductFilters as FilterType } from '../../types/product';

interface ProductFiltersProps {
  filters: FilterType;
  onFiltersChange: (filters: FilterType) => void;
}

export const ProductFilters: React.FC<ProductFiltersProps> = ({
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

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedStatus = e.target.value || undefined;
    
    // Auto-enable "Show obsolete" when obsolete status is selected
    const shouldShowObsolete = selectedStatus === 'obsolete' ? true : filters.show_obsolete;
    
    onFiltersChange({
      ...filters,
      status: selectedStatus,
      show_obsolete: shouldShowObsolete,
      page: 1,
    });
  };

  const handleVariantChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedVariant = e.target.value || undefined;
    onFiltersChange({
      ...filters,
      variant: selectedVariant as 'outright' | 'refill' | undefined,
      page: 1,
    });
  };

  const handlePricingMethodChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedPricingMethod = e.target.value || undefined;
    onFiltersChange({
      ...filters,
      pricing_method: selectedPricingMethod as 'per_unit' | 'per_kg' | 'flat_rate' | 'tiered' | undefined,
      page: 1,
    });
  };

  const handleProductTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedProductType = e.target.value || undefined;
    onFiltersChange({
      ...filters,
      product_type: selectedProductType as 'cylinder' | 'accessory' | undefined,
      page: 1,
    });
  };


  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const [sort_by, sort_order] = e.target.value.split(':');
    onFiltersChange({
      ...filters,
      sort_by: sort_by || 'created_at',
      sort_order: (sort_order as 'asc' | 'desc') || 'desc',
      page: 1,
    });
  };

  const handleToggleObsolete = () => {
    onFiltersChange({
      ...filters,
      show_obsolete: !filters.show_obsolete,
      page: 1,
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by SKU, name, or description..."
              value={filters.search || ''}
              onChange={handleSearchChange}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="sm:w-40">
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <select
                value={filters.status || ''}
                onChange={handleStatusChange}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white"
              >
                <option value="">All Statuses</option>
                <option value="active">Active</option>
                <option value="obsolete">Obsolete</option>
              </select>
            </div>
          </div>

          <div className="sm:w-40">
            <select
              value={filters.product_type || ''}
              onChange={handleProductTypeChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white"
            >
              <option value="">All Types</option>
              <option value="cylinder">Cylinders</option>
              <option value="accessory">Accessories</option>
            </select>
          </div>

          <div className="sm:w-40">
            <select
              value={filters.variant || ''}
              onChange={handleVariantChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white"
            >
              <option value="">All Variants</option>
              <option value="outright">Outright</option>
              <option value="refill">Refill</option>
            </select>
          </div>

          <div className="sm:w-44">
            <select
              value={filters.pricing_method || ''}
              onChange={handlePricingMethodChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white"
            >
              <option value="">All Pricing Methods</option>
              <option value="per_unit">Per Unit</option>
              <option value="per_kg">Per Kilogram</option>
              <option value="flat_rate">Flat Rate</option>
              <option value="tiered">Tiered Pricing</option>
            </select>
          </div>


          <div className="sm:w-48">
            <select
              value={`${filters.sort_by || 'created_at'}:${filters.sort_order || 'desc'}`}
              onChange={handleSortChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white"
            >
              <option value="created_at:desc">Newest First</option>
              <option value="created_at:asc">Oldest First</option>
              <option value="name:asc">Name A-Z</option>
              <option value="name:desc">Name Z-A</option>
              <option value="sku:asc">SKU A-Z</option>
              <option value="sku:desc">SKU Z-A</option>
              <option value="capacity_kg:desc">Capacity High-Low</option>
              <option value="capacity_kg:asc">Capacity Low-High</option>
            </select>
          </div>

          <button
            onClick={handleToggleObsolete}
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
        </div>
      </div>
    </div>
  );
};