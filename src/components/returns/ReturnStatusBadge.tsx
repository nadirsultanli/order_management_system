import React from 'react';
import { CheckCircle, Clock, RotateCcw, XCircle, AlertTriangle, Calendar } from 'lucide-react';

interface ReturnStatusBadgeProps {
  status: 'pending' | 'partial_returned' | 'fully_returned' | 'expired' | 'cancelled' | 'grace_period' | 'overdue' | 'expiring_soon';
  daysUntilDeadline?: number;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  interactive?: boolean;
  onClick?: () => void;
}

export const ReturnStatusBadge: React.FC<ReturnStatusBadgeProps> = ({
  status,
  daysUntilDeadline,
  size = 'md',
  showIcon = true,
  interactive = false,
  onClick,
}) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'pending':
        return {
          label: 'Pending Return',
          color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
          icon: Clock,
        };
      case 'partial_returned':
        return {
          label: 'Partially Returned',
          color: 'bg-blue-100 text-blue-800 border-blue-200',
          icon: RotateCcw,
        };
      case 'fully_returned':
        return {
          label: 'Fully Returned',
          color: 'bg-green-100 text-green-800 border-green-200',
          icon: CheckCircle,
        };
      case 'expired':
        return {
          label: 'Expired',
          color: 'bg-red-100 text-red-800 border-red-200',
          icon: XCircle,
        };
      case 'cancelled':
        return {
          label: 'Cancelled',
          color: 'bg-gray-100 text-gray-800 border-gray-200',
          icon: XCircle,
        };
      case 'grace_period':
        return {
          label: 'Grace Period',
          color: 'bg-orange-100 text-orange-800 border-orange-200',
          icon: Calendar,
        };
      case 'overdue':
        return {
          label: 'Overdue',
          color: 'bg-red-100 text-red-800 border-red-200',
          icon: AlertTriangle,
        };
      case 'expiring_soon':
        return {
          label: 'Expiring Soon',
          color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
          icon: AlertTriangle,
        };
      default:
        return {
          label: status,
          color: 'bg-gray-100 text-gray-800 border-gray-200',
          icon: Clock,
        };
    }
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'px-2 py-1 text-xs';
      case 'lg':
        return 'px-4 py-2 text-sm';
      default:
        return 'px-3 py-1.5 text-xs';
    }
  };

  const getIconSize = () => {
    switch (size) {
      case 'sm':
        return 'h-3 w-3';
      case 'lg':
        return 'h-5 w-5';
      default:
        return 'h-4 w-4';
    }
  };

  const config = getStatusConfig();
  const IconComponent = config.icon;
  const sizeClasses = getSizeClasses();
  const iconSizeClasses = getIconSize();

  const badgeContent = (
    <>
      {showIcon && <IconComponent className={`${iconSizeClasses} mr-1.5`} />}
      <span className="font-medium">{config.label}</span>
      {daysUntilDeadline !== undefined && (
        <span className="ml-1 opacity-75">
          ({daysUntilDeadline > 0 ? `${daysUntilDeadline}d` : `${Math.abs(daysUntilDeadline)}d overdue`})
        </span>
      )}
    </>
  );

  if (interactive) {
    return (
      <button
        onClick={onClick}
        className={`
          inline-flex items-center border rounded-full font-medium transition-all
          ${config.color} ${sizeClasses}
          hover:shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
        `}
      >
        {badgeContent}
      </button>
    );
  }

  return (
    <span className={`
      inline-flex items-center border rounded-full font-medium
      ${config.color} ${sizeClasses}
    `}>
      {badgeContent}
    </span>
  );
};