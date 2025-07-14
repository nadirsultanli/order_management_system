import React from 'react';
import { Banknote, CreditCard, Smartphone } from 'lucide-react';
import { PaymentMethod } from '../../types/payment';

interface PaymentMethodIconProps {
  method: PaymentMethod;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

interface PaymentMethodConfig {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  color: string;
}

const paymentMethodConfigs: Record<PaymentMethod, PaymentMethodConfig> = {
  Cash: {
    icon: Banknote,
    label: 'Cash',
    color: 'text-green-600'
  },
  Card: {
    icon: CreditCard,
    label: 'Card',
    color: 'text-blue-600'
  },
  Mpesa: {
    icon: Smartphone,
    label: 'M-Pesa',
    color: 'text-purple-600'
  }
};

const getSizeClass = (size: 'sm' | 'md' | 'lg'): string => {
  switch (size) {
    case 'sm':
      return 'w-4 h-4';
    case 'lg':
      return 'w-8 h-8';
    default:
      return 'w-5 h-5';
  }
};

export const PaymentMethodIcon: React.FC<PaymentMethodIconProps> = ({
  method,
  className = '',
  size = 'md'
}) => {
  const config = paymentMethodConfigs[method];
  const IconComponent = config.icon;
  const sizeClass = getSizeClass(size);
  
  return (
    <IconComponent 
      className={`${sizeClass} ${config.color} ${className}`}
      title={config.label}
    />
  );
};

export const getPaymentMethodConfig = (method: PaymentMethod) => {
  return paymentMethodConfigs[method];
};

export const getPaymentMethodIcon = (method: PaymentMethod, className?: string) => {
  const config = paymentMethodConfigs[method];
  const IconComponent = config.icon;
  return <IconComponent className={className} />;
};