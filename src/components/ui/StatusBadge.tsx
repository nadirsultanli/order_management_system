import React from 'react';

interface StatusBadgeProps {
  status: 'active' | 'credit_hold' | 'closed' | string;
  className?: string;
  children?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className = '', children, size = 'md' }) => {
  const getStatusStyles = () => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'credit_hold':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'closed':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusLabel = () => {
    if (children) return children;
    
    switch (status) {
      case 'active':
        return 'Active';
      case 'credit_hold':
        return 'Credit Hold';
      case 'closed':
        return 'Closed';
      default:
        return status;
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return 'px-1.5 py-0.5 text-xs';
      case 'lg':
        return 'px-3 py-1 text-sm';
      default:
        return 'px-2.5 py-0.5 text-xs';
    }
  };

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium border ${getStatusStyles()} ${getSizeStyles()} ${className}`}
    >
      {getStatusLabel()}
    </span>
  );
};