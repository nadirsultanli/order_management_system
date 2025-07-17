import React from 'react';
import { CheckCircle, Clock, RotateCcw, XCircle, AlertTriangle, Calendar, Camera, Package2 } from 'lucide-react';

interface ReturnStatusBadgeProps {
  status: 'pending' | 'partial_returned' | 'fully_returned' | 'expired' | 'cancelled' | 'grace_period' | 'overdue' | 'expiring_soon';
  daysUntilDeadline?: number;
  cylinderStatus?: 'good' | 'damaged' | 'lost';
  damageAssessment?: {
    severity: 'minor' | 'moderate' | 'severe';
    damage_type: string;
    repair_cost_estimate?: number;
    description?: string;
  };
  lostCylinderFee?: {
    total_fee: number;
    currency_code: string;
  };
  quantityInfo?: {
    returned: number;
    remaining: number;
    total: number;
  };
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  showDamageIndicator?: boolean;
  showQuantityInfo?: boolean;
  interactive?: boolean;
  onClick?: () => void;
}

export const ReturnStatusBadge: React.FC<ReturnStatusBadgeProps> = ({
  status,
  daysUntilDeadline,
  cylinderStatus,
  damageAssessment,
  lostCylinderFee,
  quantityInfo,
  size = 'md',
  showIcon = true,
  showDamageIndicator = true,
  showQuantityInfo = false,
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

  const getDamageIndicator = () => {
    if (!showDamageIndicator || !cylinderStatus || cylinderStatus === 'good') return null;
    
    if (cylinderStatus === 'lost') {
      return (
        <span className="ml-1.5 inline-flex items-center space-x-1">
          <XCircle className="h-3 w-3 text-red-500" />
          <span className="text-xs text-red-600 font-medium">LOST</span>
          {lostCylinderFee && size !== 'sm' && (
            <span className="text-xs text-red-500 bg-red-100 px-1 rounded">
              Fee: {new Intl.NumberFormat('en-KE', {
                style: 'currency',
                currency: lostCylinderFee.currency_code,
                minimumFractionDigits: 0
              }).format(lostCylinderFee.total_fee)}
            </span>
          )}
        </span>
      );
    }
    
    if (cylinderStatus === 'damaged') {
      const severityColors = {
        minor: 'text-yellow-500',
        moderate: 'text-orange-500',
        severe: 'text-red-500'
      };
      const severityBgColors = {
        minor: 'bg-yellow-100',
        moderate: 'bg-orange-100',
        severe: 'bg-red-100'
      };
      const severity = damageAssessment?.severity || 'minor';
      
      return (
        <span className="ml-1.5 inline-flex items-center space-x-1">
          <AlertTriangle className={`h-3 w-3 ${severityColors[severity]}`} />
          <span className={`text-xs font-medium ${severityColors[severity]}`}>
            {severity.toUpperCase()}
          </span>
          {damageAssessment?.damage_type && size !== 'sm' && (
            <span className={`text-xs ${severityColors[severity]} ${severityBgColors[severity]} px-1 rounded`}>
              {damageAssessment.damage_type.replace('_', ' ').substring(0, 8)}
            </span>
          )}
          {damageAssessment?.repair_cost_estimate && size === 'lg' && (
            <span className={`text-xs ${severityColors[severity]} ${severityBgColors[severity]} px-1 rounded`}>
              Est: {new Intl.NumberFormat('en-KE', {
                style: 'currency',
                currency: 'KES',
                minimumFractionDigits: 0
              }).format(damageAssessment.repair_cost_estimate)}
            </span>
          )}
        </span>
      );
    }
    
    return null;
  };

  const getQuantityIndicator = () => {
    if (!showQuantityInfo || !quantityInfo) return null;
    
    if (quantityInfo.returned > 0 && quantityInfo.remaining > 0) {
      return (
        <span className="ml-1.5 inline-flex items-center space-x-1">
          <Package2 className="h-3 w-3 text-blue-500" />
          <span className="text-xs text-blue-600 font-medium">
            {quantityInfo.returned}/{quantityInfo.total}
          </span>
        </span>
      );
    }
    
    return null;
  };

  const badgeContent = (
    <>
      {showIcon && <IconComponent className={`${iconSizeClasses} mr-1.5`} />}
      <span className="font-medium">{config.label}</span>
      {daysUntilDeadline !== undefined && (
        <span className="ml-1 opacity-75">
          ({daysUntilDeadline > 0 ? `${daysUntilDeadline}d` : `${Math.abs(daysUntilDeadline)}d overdue`})
        </span>
      )}
      {getQuantityIndicator()}
      {getDamageIndicator()}
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