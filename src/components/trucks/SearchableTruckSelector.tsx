import React, { useState, useRef, useEffect } from 'react';
import { Truck, ChevronDown, Search } from 'lucide-react';
import { trpc } from '../../lib/trpc-client';

interface SearchableTruckSelectorProps {
  value?: string;
  onChange: (truckId: string) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
}

export const SearchableTruckSelector: React.FC<SearchableTruckSelectorProps> = ({
  value,
  onChange,
  placeholder = "Select a truck",
  className = "",
  required = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  const { data: trucksData, isLoading } = trpc.trucks.list.useQuery({ active: true });
  const trucks = trucksData?.trucks || [];

  // Filter trucks based on search term
  const filteredTrucks = trucks.filter((truck: any) => 
    truck.fleet_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    truck.license_plate?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    truck.driver_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedTruck = trucks.find((t: any) => t.id === value);

  const getDisplayText = () => {
    if (!selectedTruck) return placeholder;
    
    return `${selectedTruck.fleet_number} - ${selectedTruck.license_plate}`;
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

  const handleSelect = (truckId: string) => {
    onChange(truckId);
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
          <Truck className="h-4 w-4 text-gray-400" />
          <span className="text-gray-500">Loading trucks...</span>
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
          <Truck className="h-4 w-4 text-gray-400" />
          <span className={selectedTruck ? 'text-gray-900' : 'text-gray-500'}>
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
                placeholder="Search trucks by fleet number, license plate, or driver..."
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

            {filteredTrucks.length > 0 ? (
              filteredTrucks.map((truck: any) => {
                const isSelected = truck.id === value;
                
                return (
                  <button
                    key={truck.id}
                    type="button"
                    onClick={() => handleSelect(truck.id)}
                    className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 transition-colors ${
                      isSelected ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <Truck className="h-4 w-4 text-gray-400" />
                      <div className="flex-1">
                        <div className="font-medium">{truck.fleet_number}</div>
                        <div className="text-xs text-gray-500">
                          License: {truck.license_plate}
                          {truck.driver_name && ` • Driver: ${truck.driver_name}`}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="px-4 py-2 text-sm text-gray-500">
                No trucks found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};