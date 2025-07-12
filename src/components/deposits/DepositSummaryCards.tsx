import React from 'react';
import { DollarSign, Users, Package, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import { DepositSummaryStats } from '../../types/deposits';

interface DepositSummaryCardsProps {
  stats?: DepositSummaryStats;
  loading?: boolean;
}

export const DepositSummaryCards: React.FC<DepositSummaryCardsProps> = ({
  stats,
  loading = false,
}) => {
  
  const formatCurrency = (amount: number, currency: string = 'KES') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, index) => (
          <div key={index} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="animate-pulse">
              <div className="flex items-center justify-between">
                <div className="w-8 h-8 bg-gray-200 rounded"></div>
                <div className="w-6 h-4 bg-gray-200 rounded"></div>
              </div>
              <div className="mt-4">
                <div className="h-8 bg-gray-200 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2 mt-2"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="text-center">
          <AlertCircle className="h-8 w-8 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-500">Unable to load deposit summary</p>
        </div>
      </div>
    );
  }

  const cards = [
    {
      title: 'Total Outstanding Deposits',
      value: formatCurrency(stats.total_outstanding, stats.currency_code),
      icon: DollarSign,
      color: 'blue',
      description: 'Total deposits held for customers',
    },
    {
      title: 'Customers with Deposits',
      value: formatNumber(stats.total_customers_with_deposits),
      icon: Users,
      color: 'green',
      description: 'Active customers holding deposits',
    },
    {
      title: 'Total Cylinders on Deposit',
      value: formatNumber(stats.total_cylinders_on_deposit),
      icon: Package,
      color: 'purple',
      description: 'Cylinders currently on deposit',
    },
    {
      title: 'Period Net Change',
      value: formatCurrency(stats.net_change, stats.currency_code),
      icon: stats.net_change >= 0 ? TrendingUp : TrendingDown,
      color: stats.net_change >= 0 ? 'green' : 'red',
      description: 'Net deposit change this period',
      isChange: true,
    },
  ];

  const getColorClasses = (color: string) => {
    const colors = {
      blue: {
        bg: 'bg-blue-50',
        icon: 'text-blue-600',
        text: 'text-blue-900',
      },
      green: {
        bg: 'bg-green-50',
        icon: 'text-green-600',
        text: 'text-green-900',
      },
      purple: {
        bg: 'bg-purple-50',
        icon: 'text-purple-600',
        text: 'text-purple-900',
      },
      red: {
        bg: 'bg-red-50',
        icon: 'text-red-600',
        text: 'text-red-900',
      },
    };
    return colors[color as keyof typeof colors] || colors.blue;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {cards.map((card, index) => {
        const colorClasses = getColorClasses(card.color);
        const IconComponent = card.icon;

        return (
          <div key={index} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div className={`p-2 rounded-lg ${colorClasses.bg}`}>
                <IconComponent className={`h-6 w-6 ${colorClasses.icon}`} />
              </div>
              {card.isChange && (
                <div className={`text-xs font-medium px-2 py-1 rounded-full ${
                  stats.net_change >= 0 
                    ? 'bg-green-100 text-green-700' 
                    : 'bg-red-100 text-red-700'
                }`}>
                  {stats.net_change >= 0 ? '+' : ''}{((stats.net_change / (stats.total_outstanding || 1)) * 100).toFixed(1)}%
                </div>
              )}
            </div>
            
            <div className="mt-4">
              <h3 className={`text-2xl font-bold ${colorClasses.text}`}>
                {card.value}
              </h3>
              <p className="text-sm font-medium text-gray-900 mt-1">
                {card.title}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {card.description}
              </p>
            </div>

            {/* Additional period metrics for the first card */}
            {index === 0 && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="text-xs font-medium text-gray-500">Charges</div>
                    <div className="text-sm font-bold text-blue-600">
                      {formatCurrency(stats.period_charges, stats.currency_code)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-gray-500">Refunds</div>
                    <div className="text-sm font-bold text-green-600">
                      {formatCurrency(stats.period_refunds, stats.currency_code)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-gray-500">Adjustments</div>
                    <div className="text-sm font-bold text-yellow-600">
                      {formatCurrency(stats.period_adjustments, stats.currency_code)}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};