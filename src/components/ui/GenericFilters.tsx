import React from 'react';
import { Search, Filter, RotateCcw, Calendar, LucideIcon } from 'lucide-react';

export interface FilterField {
  key: string;
  label?: string;
  type: 'text' | 'select' | 'date' | 'checkbox' | 'search' | 'sort';
  options?: { value: string; label: string }[];
  placeholder?: string;
  icon?: LucideIcon;
}

interface GenericFiltersProps<T> {
  filters: T;
  onFiltersChange: (filters: T) => void;
  fields: FilterField[];
  searchPlaceholder?: string;
  showReset?: boolean;
  customActions?: React.ReactNode;
}

export function GenericFilters<T extends Record<string, any>>({
  filters,
  onFiltersChange,
  fields,
  searchPlaceholder = "Search...",
  showReset = true,
  customActions
}: GenericFiltersProps<T>) {
  const handleFilterChange = (key: string, value: any) => {
    onFiltersChange({ ...filters, [key]: value, page: 1 });
  };

  const handleSortChange = (value: string) => {
    const [sort_by, sort_order] = value.split(':');
    onFiltersChange({
      ...filters,
      sort_by: sort_by || 'created_at',
      sort_order: (sort_order as 'asc' | 'desc') || 'desc',
      page: 1,
    });
  };

  const handleReset = () => {
    const resetFilters = { page: 1 } as any;
    onFiltersChange(resetFilters);
  };

  const hasActiveFilters = Object.keys(filters).some(key => 
    key !== 'page' && key !== 'limit' && filters[key] !== undefined && filters[key] !== ''
  );

  const searchField = fields.find(f => f.type === 'search');
  const otherFields = fields.filter(f => f.type !== 'search');

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Search Field */}
        {searchField && (
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder={searchField.placeholder || searchPlaceholder}
                value={filters[searchField.key] || ''}
                onChange={(e) => handleFilterChange(searchField.key, e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        )}
        
        <div className="flex flex-col sm:flex-row gap-4">

          {/* Dynamic Filter Fields */}
          {otherFields.map((field) => (
            <div key={field.key} className="relative">
              {field.type === 'select' && (
                <div className="sm:w-40">
                  <div className="relative">
                    {field.icon && <field.icon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />}
                    <select
                      value={filters[field.key] || ''}
                      onChange={(e) => handleFilterChange(field.key, e.target.value)}
                      className={`w-full pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white ${field.icon ? 'pl-10' : 'pl-3'}`}
                    >
                      <option value="">{field.label || `All ${field.key}`}</option>
                      {field.options?.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {field.type === 'sort' && (
                <div className="sm:w-48">
                  <select
                    value={`${filters.sort_by || 'created_at'}:${filters.sort_order || 'desc'}`}
                    onChange={(e) => handleSortChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white"
                  >
                    {field.options?.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {field.type === 'date' && (
                <>
                  <input
                    type="date"
                    value={filters[field.key] || ''}
                    onChange={(e) => handleFilterChange(field.key, e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                </>
              )}

              {field.type === 'text' && (
                <input
                  type="text"
                  placeholder={field.placeholder}
                  value={filters[field.key] || ''}
                  onChange={(e) => handleFilterChange(field.key, e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              )}

              {field.type === 'checkbox' && (
                <label className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-md">
                  <input
                    type="checkbox"
                    checked={filters[field.key] || false}
                    onChange={(e) => handleFilterChange(field.key, e.target.checked)}
                    className="rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">{field.label}</span>
                </label>
              )}
            </div>
          ))}

          {/* Custom Actions */}
          {customActions}

          {/* Reset Button */}
          {showReset && (
            <button
              onClick={handleReset}
              disabled={!hasActiveFilters}
              className="flex items-center space-x-2 px-3 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Reset filters"
            >
              <RotateCcw className="h-4 w-4" />
              <span className="hidden sm:inline">Reset</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}