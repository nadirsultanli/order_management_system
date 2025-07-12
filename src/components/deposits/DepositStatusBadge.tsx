import React from 'react';
import { TRANSACTION_TYPES } from '../../types/deposits';

interface DepositStatusBadgeProps {
  type: 'charge' | 'refund' | 'adjustment';
  isVoided?: boolean;
  size?: 'sm' | 'md';
}

export const DepositStatusBadge: React.FC<DepositStatusBadgeProps> = ({
  type,
  isVoided = false,
  size = 'sm',
}) => {
  
  const getStatusConfig = () => {
    if (isVoided) {
      return {
        label: 'Voided',
        color: 'bg-red-100 text-red-800 border-red-200',
      };
    }

    const transactionType = TRANSACTION_TYPES.find(t => t.value === type);
    
    switch (type) {
      case 'charge':
        return {
          label: 'Charged',
          color: 'bg-blue-100 text-blue-800 border-blue-200',
        };
      case 'refund':
        return {
          label: 'Refunded',
          color: 'bg-green-100 text-green-800 border-green-200',
        };
      case 'adjustment':
        return {
          label: 'Adjusted',
          color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        };
      default:
        return {
          label: 'Unknown',
          color: 'bg-gray-100 text-gray-800 border-gray-200',
        };
    }
  };

  const config = getStatusConfig();
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm';

  return (
    <span 
      className={`inline-flex items-center rounded-full font-medium border ${config.color} ${sizeClasses}`}
    >
      {config.label}
    </span>
  );
};