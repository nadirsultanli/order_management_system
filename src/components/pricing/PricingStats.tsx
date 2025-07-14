import React from 'react';
import { DollarSign, CheckCircle, Clock, XCircle, AlertTriangle, Package, Database, Users } from 'lucide-react';
import { usePricingStatsNew } from '../../hooks/usePricing';
import { useDepositSummaryStats } from '../../hooks/useDeposits';

interface PricingStatsProps {
  showDepositStats?: boolean;
}

export const PricingStats: React.FC<PricingStatsProps> = ({ showDepositStats = false }) => {
  const { data: stats, isLoading } = usePricingStatsNew();
  const { data: depositStats, isLoading: depositLoading } = useDepositSummaryStats();

  if (isLoading || (showDepositStats && depositLoading)) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
            {[...Array(showDepositStats ? 8 : 6)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  let statItems = [
    {
      name: 'Total Price Lists',
      value: stats.total_price_lists,
      icon: DollarSign,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      name: 'Active',
      value: stats.active_price_lists,
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      name: 'Future',
      value: stats.future_price_lists,
      icon: Clock,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      name: 'Expired',
      value: stats.expired_price_lists,
      icon: XCircle,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
    },
    {
      name: 'Expiring Soon',
      value: stats.expiring_soon,
      icon: AlertTriangle,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
    },
    {
      name: 'No Pricing',
      value: stats.products_without_pricing,
      icon: Package,
      color: 'text-gray-600',
      bgColor: 'bg-gray-50',
    },
  ];

  // Add deposit statistics if requested and available
  if (showDepositStats && depositStats) {
    statItems = [
      ...statItems.slice(0, 4), // Keep first 4 pricing stats
      {
        name: 'Outstanding Deposits',
        value: formatCurrency(depositStats.total_outstanding, depositStats.currency_code),
        icon: Database,
        color: 'text-green-600',
        bgColor: 'bg-green-50',
        isString: true,
      },
      {
        name: 'Customers with Deposits',
        value: depositStats.total_customers_with_deposits,
        icon: Users,
        color: 'text-purple-600',
        bgColor: 'bg-purple-50',
      },
      ...statItems.slice(4), // Keep remaining pricing stats
    ];
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        {showDepositStats ? 'Pricing & Deposits Overview' : 'Pricing Overview'}
      </h3>
      <div className={`grid grid-cols-2 gap-4 ${showDepositStats ? 'lg:grid-cols-4 xl:grid-cols-8' : 'lg:grid-cols-6'}`}>
        {statItems.map((item) => (
          <div key={item.name} className="text-center">
            <div className={`inline-flex items-center justify-center w-12 h-12 rounded-full ${item.bgColor} mb-2`}>
              <item.icon className={`h-6 w-6 ${item.color}`} />
            </div>
            <div className={`${(item as any).isString ? 'text-lg' : 'text-2xl'} font-bold text-gray-900`}>
              {item.value}
            </div>
            <div className="text-sm text-gray-600">{item.name}</div>
          </div>
        ))}
      </div>
    </div>
  );
};