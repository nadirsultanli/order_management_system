import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { searchCountries, getCountryByCode, type Country } from '../../utils/countries';

interface CountrySelectorProps {
  value?: string;
  onChange: (countryCode: string) => void;
  disabled?: boolean;
  placeholder?: string;
  error?: string;
  className?: string;
}

export const CountrySelector: React.FC<CountrySelectorProps> = ({
  value,
  onChange,
  disabled = false,
  placeholder = "Select country...",
  error,
  className = "",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredCountries, setFilteredCountries] = useState<Country[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedCountry = value ? getCountryByCode(value) : null;

  useEffect(() => {
    setFilteredCountries(searchCountries(searchQuery));
  }, [searchQuery]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const handleToggleDropdown = () => {
    if (!disabled) {
      setIsOpen(!isOpen);
      setSearchQuery('');
    }
  };

  const handleSelectCountry = (country: Country) => {
    onChange(country.code);
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Selected Value Display */}
      <button
        type="button"
        onClick={handleToggleDropdown}
        disabled={disabled}
        className={`
          w-full flex items-center justify-between px-3 py-2 border rounded-md shadow-sm bg-white
          ${disabled 
            ? 'cursor-not-allowed opacity-50 bg-gray-50' 
            : 'cursor-pointer hover:border-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'
          }
          ${error ? 'border-red-300' : 'border-gray-300'}
        `}
      >
        <div className="flex items-center space-x-2 flex-1 text-left">
          {selectedCountry ? (
            <>
              <span className="text-lg">{selectedCountry.flag}</span>
              <span className="text-gray-900">{selectedCountry.name}</span>
              <span className="text-sm text-gray-500">({selectedCountry.code})</span>
            </>
          ) : (
            <span className="text-gray-500">{placeholder}</span>
          )}
        </div>
        <ChevronDown 
          className={`h-4 w-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
        />
      </button>

      {/* Error Message */}
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-64 overflow-hidden">
          {/* Search Input */}
          <div className="p-2 border-b border-gray-200">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder="Search countries..."
                className="w-full pl-8 pr-3 py-1 border border-gray-300 rounded text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Country List */}
          <div className="max-h-48 overflow-y-auto">
            {filteredCountries.length > 0 ? (
              filteredCountries.map((country) => (
                <button
                  key={country.code}
                  type="button"
                  onClick={() => handleSelectCountry(country)}
                  className={`
                    w-full flex items-center space-x-3 px-3 py-2 text-left hover:bg-blue-50 focus:bg-blue-50 focus:outline-none
                    ${selectedCountry?.code === country.code ? 'bg-blue-100' : ''}
                  `}
                >
                  <span className="text-lg">{country.flag}</span>
                  <div className="flex-1">
                    <span className="text-gray-900">{country.name}</span>
                    <span className="ml-2 text-sm text-gray-500">({country.code})</span>
                  </div>
                </button>
              ))
            ) : (
              <div className="px-3 py-8 text-center text-gray-500">
                <Search className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                <p>No countries found</p>
                <p className="text-sm mt-1">Try a different search term</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}; 