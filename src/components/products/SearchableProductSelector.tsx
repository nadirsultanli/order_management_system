import React, { useState, useRef, useEffect } from 'react';
import { Package, ChevronDown, Search } from 'lucide-react';

interface SearchableProductSelectorProps {
  products?: { id: string; name: string; sku: string; variant?: 'outright' | 'refill' }[];
  value?: string;
  onChange: (productId: string) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
}

export const SearchableProductSelector: React.FC<SearchableProductSelectorProps> = ({
  products,
  value,
  onChange,
  placeholder = 'Select a product...',
  className = '',
  required = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const filteredProducts = (products || []).filter((p) =>
    `${p.name} ${p.sku}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selected = (products || []).find((p) => p.id === value);

  const displayText = selected ? `${selected.name} (${selected.sku}${selected.variant ? ` • ${selected.variant}` : ''})` : placeholder;

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

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white hover:bg-gray-50"
      >
        <div className="flex items-center space-x-2">
          <Package className="h-4 w-4 text-gray-400" />
          <span className={selected ? 'text-gray-900' : 'text-gray-500'}>{displayText}</span>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-gray-400 transform transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white rounded-md shadow-lg border border-gray-200 max-h-64 overflow-hidden">
          <div className="p-2 border-b border-gray-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {/* Clear option */}
            <button
              type="button"
              onClick={() => handleSelect('')}
              className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 ${!value ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}`}
            >
              {placeholder}
            </button>
            {filteredProducts.length > 0 ? (
              filteredProducts.map((product) => {
                const isSel = product.id === value;
                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => handleSelect(product.id)}
                    className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 ${isSel ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        {product.name} ({product.sku})
                      </div>
                      {product.variant && (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          product.variant === 'outright' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {product.variant === 'outright' ? 'Outright' : 'Refill'}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="px-4 py-2 text-sm text-gray-500">No products found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}; 