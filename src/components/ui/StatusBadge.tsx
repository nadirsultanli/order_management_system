import React from 'react';

interface StatusBadgeProps {
  status: 'active' | 'credit_hold' | 'closed' | string;
  className?: string;
  children?: React.ReactNode;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className = '', children }) => {
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

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusStyles()} ${className}`}
    >
      {getStatusLabel()}
    </span>
  );
};