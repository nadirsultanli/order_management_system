import React from 'react';
import { CheckCircle, Clock, XCircle, RotateCcw } from 'lucide-react';
import { PaymentStatus } from '../../types/payment';

interface PaymentStatusBadgeProps {
  status: PaymentStatus;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  className?: string;
}

interface PaymentStatusConfig {
  label: string;
  color: string;
  bgColor: string;
  dotColor: string;
  icon: React.ComponentType<{ className?: string }>;
}

const paymentStatusConfigs: Record<PaymentStatus, PaymentStatusConfig> = {
  pending: {
    label: 'Pending',
    color: 'text-yellow-800',
    bgColor: 'bg-yellow-100',
    dotColor: 'bg-yellow-500',
    icon: Clock
  },
  completed: {
    label: 'Completed',
    color: 'text-green-800',
    bgColor: 'bg-green-100',
    dotColor: 'bg-green-500',
    icon: CheckCircle
  },
  failed: {
    label: 'Failed',
    color: 'text-red-800',
    bgColor: 'bg-red-100',
    dotColor: 'bg-red-500',
    icon: XCircle
  },
  refunded: {
    label: 'Refunded',
    color: 'text-purple-800',
    bgColor: 'bg-purple-100',
    dotColor: 'bg-purple-500',
    icon: RotateCcw
  }
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
    default:
      return {
        container: 'px-2.5 py-1.5 text-sm',
        dot: 'w-2 h-2',
        icon: 'w-3.5 h-3.5'
      };
  }
};

export const PaymentStatusBadge: React.FC<PaymentStatusBadgeProps> = ({
  status,
  size = 'md',
  showIcon = false,
  className = ''
}) => {
  const config = paymentStatusConfigs[status];
  const sizeClasses = getSizeClasses(size);
  const IconComponent = config.icon;

  return (
    <span 
      className={`inline-flex items-center space-x-1.5 font-medium rounded-full ${config.bgColor} ${config.color} ${sizeClasses.container} ${className}`}
    >
      {showIcon ? (
        <IconComponent className={sizeClasses.icon} />
      ) : (
        <span className={`rounded-full ${config.dotColor} ${sizeClasses.dot}`}></span>
      )}
      <span>{config.label}</span>
    </span>
  );
};

export const getPaymentStatusConfig = (status: PaymentStatus) => {
  return paymentStatusConfigs[status];
};