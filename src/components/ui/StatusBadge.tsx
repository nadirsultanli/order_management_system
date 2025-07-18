import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md' | 'lg';
  interactive?: boolean;
  onStatusChange?: (newStatus: string) => void;
  options?: Array<{ value: string; label: string }>;
}

const getStatusConfig = (status: string) => {
  if (!status) return { bg: 'bg-gray-100', text: 'text-gray-800', dot: 'bg-gray-500' };
  
  const configs: Record<string, { bg: string; text: string; dot: string }> = {
    // Trip statuses
    planned: { bg: 'bg-blue-100', text: 'text-blue-800', dot: 'bg-blue-500' },
    loaded: { bg: 'bg-indigo-100', text: 'text-indigo-800', dot: 'bg-indigo-500' },
    in_transit: { bg: 'bg-purple-100', text: 'text-purple-800', dot: 'bg-purple-500' },
    offloaded: { bg: 'bg-amber-100', text: 'text-amber-800', dot: 'bg-amber-500' },
    completed: { bg: 'bg-green-100', text: 'text-green-800', dot: 'bg-green-500' },
    cancelled: { bg: 'bg-red-100', text: 'text-red-800', dot: 'bg-red-500' },
    
    // Order statuses
    draft: { bg: 'bg-gray-100', text: 'text-gray-800', dot: 'bg-gray-500' },
    confirmed: { bg: 'bg-blue-100', text: 'text-blue-800', dot: 'bg-blue-500' },
    scheduled: { bg: 'bg-purple-100', text: 'text-purple-800', dot: 'bg-purple-500' },
    en_route: { bg: 'bg-yellow-100', text: 'text-yellow-800', dot: 'bg-yellow-500' },
    delivered: { bg: 'bg-green-100', text: 'text-green-800', dot: 'bg-green-500' },
    invoiced: { bg: 'bg-indigo-100', text: 'text-indigo-800', dot: 'bg-indigo-500' },
    
    // Customer account statuses
    active: { bg: 'bg-green-100', text: 'text-green-800', dot: 'bg-green-500' },
    credit_hold: { bg: 'bg-yellow-100', text: 'text-yellow-800', dot: 'bg-yellow-500' },
    closed: { bg: 'bg-red-100', text: 'text-red-800', dot: 'bg-red-500' },
    
    // Product statuses
    obsolete: { bg: 'bg-gray-100', text: 'text-gray-800', dot: 'bg-gray-500' },
    
    // Transfer statuses
    pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', dot: 'bg-yellow-500' },
    
    // Payment statuses
    failed: { bg: 'bg-red-100', text: 'text-red-800', dot: 'bg-red-500' },
    refunded: { bg: 'bg-purple-100', text: 'text-purple-800', dot: 'bg-purple-500' },
  };

  return configs[status] || { bg: 'bg-gray-100', text: 'text-gray-800', dot: 'bg-gray-500' };
};

const formatStatusLabel = (status: string) => {
  if (!status) return '';
  return status
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const getSizeClasses = (size: 'sm' | 'md' | 'lg') => {
  switch (size) {
    case 'sm':
      return {
        container: 'px-2 py-1 text-xs',
        dot: 'w-1.5 h-1.5',
        icon: 'w-3 h-3'
      };
    case 'lg':
      return {
        container: 'px-3 py-2 text-sm',
        dot: 'w-2.5 h-2.5',
        icon: 'w-4 h-4'
      };
    default: // md
      return {
        container: 'px-2.5 py-1.5 text-sm',
        dot: 'w-2 h-2',
        icon: 'w-3.5 h-3.5'
      };
  }
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'md',
  interactive = false,
  onStatusChange,
  options = []
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const config = getStatusConfig(status);
  const sizeClasses = getSizeClasses(size);
  const label = formatStatusLabel(status);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleStatusSelect = (newStatus: string) => {
    setIsOpen(false);
    if (onStatusChange && newStatus !== status) {
      onStatusChange(newStatus);
    }
  };

  if (!interactive || !onStatusChange || options.length === 0) {
    // Static badge
    return (
      <span className={`inline-flex items-center space-x-1.5 font-medium rounded-full ${config.bg} ${config.text} ${sizeClasses.container}`}>
        <span className={`rounded-full ${config.dot} ${sizeClasses.dot}`}></span>
        <span>{label}</span>
      </span>
    );
  }

  // Interactive badge with dropdown
  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`inline-flex items-center space-x-1.5 font-medium rounded-full transition-all duration-200 hover:shadow-sm ${config.bg} ${config.text} ${sizeClasses.container} ${isOpen ? 'ring-2 ring-blue-500 ring-opacity-50' : ''}`}
        title="Click to change status"
      >
        <span className={`rounded-full ${config.dot} ${sizeClasses.dot}`}></span>
        <span>{label}</span>
        <ChevronDown className={`${sizeClasses.icon} transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-32 bg-white rounded-md shadow-lg border border-gray-200 py-1">
          {options.map((option) => {
            const optionConfig = getStatusConfig(option.value);
            const isSelected = option.value === status;
            
            return (
              <button
                key={option.value}
                onClick={() => handleStatusSelect(option.value)}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 transition-colors flex items-center space-x-2 ${isSelected ? 'bg-blue-50' : ''}`}
              >
                <span className={`w-2 h-2 rounded-full ${optionConfig.dot}`}></span>
                <span className={optionConfig.text}>{option.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};