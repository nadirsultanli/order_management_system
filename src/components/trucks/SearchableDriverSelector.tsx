import React, { useState, useRef, useEffect } from 'react';
import { User, ChevronDown, Search, Loader2 } from 'lucide-react';

interface Driver {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
}

interface SearchableDriverSelectorProps {
  drivers?: Driver[];
  value?: string;
  onChange: (driverId: string) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
  loading?: boolean;
  disabled?: boolean;
}

export const SearchableDriverSelector: React.FC<SearchableDriverSelectorProps> = ({
  drivers,
  value,
  onChange,
  placeholder = 'Select a driver...',
  className = '',
  required = false,
  loading = false,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const filteredDrivers = (drivers || []).filter((driver) => {
    const searchLower = searchTerm.toLowerCase();
    const name = driver.name || '';
    const email = driver.email || '';
    const phone = driver.phone || '';
    
    return (
      name.toLowerCase().includes(searchLower) ||
      email.toLowerCase().includes(searchLower) ||
      phone.toLowerCase().includes(searchLower)
    );
  });

  const selected = (drivers || []).find((driver) => driver.id === value);

  const displayText = selected 
    ? `${selected.name || 'Unknown'} - ${selected.email || 'No email'}`
    : placeholder;

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
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

  const handleSelect = (id: string) => {
    onChange(id);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleToggle = () => {
    if (!disabled && !loading) {
      setIsOpen((prev) => !prev);
    }
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={handleToggle}
        disabled={disabled || loading}
        className={`w-full flex items-center justify-between px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white ${
          disabled || loading 
            ? 'bg-gray-50 cursor-not-allowed' 
            : 'hover:bg-gray-50 cursor-pointer'
        }`}
      >
        <div className="flex items-center space-x-2">
          {loading ? (
            <Loader2 className="h-4 w-4 text-gray-400 animate-spin" />
          ) : (
            <User className="h-4 w-4 text-gray-400" />
          )}
          <span className={selected ? 'text-gray-900' : 'text-gray-500'}>
            {loading ? 'Loading drivers...' : displayText}
          </span>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-gray-400 transform transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && !loading && (
        <div className="absolute z-50 mt-1 w-full bg-white rounded-md shadow-lg border border-gray-200 max-h-80 overflow-hidden">
          {/* Search Input */}
          <div className="p-2 border-b border-gray-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search drivers by name, email, or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>

          {/* Options List */}
          <div className="max-h-60 overflow-y-auto">
            {/* Clear option */}
            {!required && (
              <button
                type="button"
                onClick={() => handleSelect('')}
                className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 ${
                  !value ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <User className="h-4 w-4 text-gray-400" />
                  <span>{placeholder}</span>
                </div>
              </button>
            )}

            {/* Driver options */}
            {filteredDrivers.length > 0 ? (
              filteredDrivers.map((driver) => {
                const isSelected = driver.id === value;
                return (
                  <button
                    key={driver.id}
                    type="button"
                    onClick={() => handleSelect(driver.id)}
                    className={`w-full px-4 py-3 text-left text-sm hover:bg-gray-50 ${
                      isSelected ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <User className="h-4 w-4 flex-shrink-0 text-gray-400" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-gray-900 truncate">
                              {driver.name || 'Unknown Name'}
                            </div>
                            <div className="flex flex-col space-y-0.5">
                              {driver.email && (
                                <div className="text-xs text-gray-500 truncate">
                                  {driver.email}
                                </div>
                              )}
                              {driver.phone && (
                                <div className="text-xs text-gray-500">
                                  {driver.phone}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                      {isSelected && (
                        <div className="ml-2 flex-shrink-0">
                          <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="px-4 py-3 text-sm text-gray-500 text-center">
                {searchTerm ? 'No drivers found matching your search' : 'No drivers available'}
              </div>
            )}
          </div>

          {/* Footer with count */}
          {filteredDrivers.length > 0 && (
            <div className="px-4 py-2 bg-gray-50 border-t border-gray-200">
              <div className="text-xs text-gray-500">
                {filteredDrivers.length} driver{filteredDrivers.length !== 1 ? 's' : ''} 
                {searchTerm && ' found'}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};