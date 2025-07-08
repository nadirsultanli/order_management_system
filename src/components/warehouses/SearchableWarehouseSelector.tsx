import React, { useState, useRef, useEffect } from 'react';
import { Warehouse, ChevronDown, Search } from 'lucide-react';
import { useWarehouseOptions } from '../../hooks/useWarehouses';

interface SearchableWarehouseSelectorProps {
  value?: string;
  onChange: (warehouseId: string) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
}

export const SearchableWarehouseSelector: React.FC<SearchableWarehouseSelectorProps> = ({
  value,
  onChange,
  placeholder = "All Warehouses",
  className = "",
  required = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  const { data: warehouses, isLoading } = useWarehouseOptions();

  // Filter warehouses based on search term
  const filteredWarehouses = warehouses?.filter((warehouse: any) => 
    warehouse.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    warehouse.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    warehouse.state?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const selectedWarehouse = warehouses?.find((w: any) => w.id === value);

  const getDisplayText = () => {
    if (!selectedWarehouse) return placeholder;
    
    const location = [selectedWarehouse.city, selectedWarehouse.state].filter(Boolean).join(', ');
    return location ? `${selectedWarehouse.name} (${location})` : selectedWarehouse.name;
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const handleSelect = (warehouseId: string) => {
    onChange(warehouseId);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleToggle = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      setSearchTerm('');
    }
  };

  if (isLoading) {
    return (
      <div className={`relative ${className}`}>
        <div className="flex items-center space-x-2 px-3 py-2 border border-gray-300 rounded-md bg-gray-50">
          <Warehouse className="h-4 w-4 text-gray-400" />
          <span className="text-gray-500">Loading warehouses...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={handleToggle}
        className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center space-x-2">
          <Warehouse className="h-4 w-4 text-gray-400" />
          <span className={selectedWarehouse ? 'text-gray-900' : 'text-gray-500'}>
            {getDisplayText()}
          </span>
        </div>
        <ChevronDown className={`h-4 w-4 text-gray-400 transform transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white rounded-md shadow-lg border border-gray-200 max-h-64 overflow-hidden">
          {/* Search input */}
          <div className="p-2 border-b border-gray-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search warehouses..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>

          {/* Options list */}
          <div className="max-h-48 overflow-y-auto">
            {/* Clear selection option */}
            <button
              type="button"
              onClick={() => handleSelect('')}
              className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 transition-colors ${
                !value ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
              }`}
            >
              {placeholder}
            </button>

                         {filteredWarehouses.length > 0 ? (
               filteredWarehouses.map((warehouse: any) => {
                 const isSelected = warehouse.id === value;
                 const location = [warehouse.city, warehouse.state].filter(Boolean).join(', ');
                 const displayText = location ? `${warehouse.name} (${location})` : warehouse.name;

                return (
                  <button
                    key={warehouse.id}
                    type="button"
                    onClick={() => handleSelect(warehouse.id)}
                    className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 transition-colors ${
                      isSelected ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                    }`}
                  >
                    {displayText}
                  </button>
                );
              })
            ) : (
              <div className="px-4 py-2 text-sm text-gray-500">
                No warehouses found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}; 