import React from 'react';
import { 
  CreditCard, 
  CheckCircle, 
  Clock, 
  XCircle, 
  RefreshCw, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  BarChart3,
  Percent
} from 'lucide-react';
import { PaymentSummaryStats } from '../../types/payment';
import { formatCurrencySync } from '../../utils/pricing';

interface PaymentStatsCardsProps {
  stats: PaymentSummaryStats;
  isLoading?: boolean;
  className?: string;
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ComponentType<any>;
  color: string;
  bgColor: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  subtitle?: string;
}

const StatCard: React.FC<StatCardProps> = ({ 
  title, 
  value, 
  icon: Icon, 
  color, 
  bgColor, 
  trend, 
  subtitle 
}) => (
  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
    <div className="flex items-center justify-between">
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-600">{title}</p>
        <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
        {subtitle && (
          <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
        )}
        {trend && (
          <div className="flex items-center mt-2">
            {trend.isPositive ? (
              <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-500 mr-1" />
            )}
            <span className={`text-sm ${trend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
              {Math.abs(trend.value)}%
            </span>
          </div>
        )}
      </div>
      <div className={`p-3 rounded-full ${bgColor}`}>
        <Icon className={`h-6 w-6 ${color}`} />
      </div>
    </div>
  </div>
);

const LoadingSkeleton: React.FC = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
    {[...Array(8)].map((_, i) => (
      <div key={i} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="animate-pulse">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="h-4 bg-gray-200 rounded w-20 mb-2"></div>
              <div className="h-8 bg-gray-200 rounded w-16 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-12"></div>
            </div>
            <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
          </div>
        </div>
      </div>
    ))}
  </div>
);

export const PaymentStatsCards: React.FC<PaymentStatsCardsProps> = ({ 
  stats, 
  isLoading = false, 
  className = '' 
}) => {
  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (!stats) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="text-center text-gray-500">
          <BarChart3 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p>No payment statistics available</p>
        </div>
      </div>
    );
  }

  // Calculate success rate
  const successRate = stats.total_count > 0 
    ? Math.round((stats.completed_count / stats.total_count) * 100) 
    : 0;

  // Calculate average payment amount
  const avgPaymentAmount = stats.total_count > 0 
    ? stats.total_amount / stats.total_count 
    : 0;

  const statCards = [
    {
      title: 'Total Payments',
      value: stats.total_count.toLocaleString(),
      icon: CreditCard,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      subtitle: formatCurrencySync(stats.total_amount),
    },
    {
      title: 'Completed',
      value: stats.completed_count.toLocaleString(),
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      subtitle: formatCurrencySync(stats.completed_amount),
    },
    {
      title: 'Pending',
      value: stats.pending_count.toLocaleString(),
      icon: Clock,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
      subtitle: formatCurrencySync(stats.pending_amount),
    },
    {
      title: 'Failed',
      value: stats.failed_count.toLocaleString(),
      icon: XCircle,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      subtitle: formatCurrencySync(stats.failed_amount),
    },
    {
      title: 'Refunded',
      value: stats.by_status.refunded.count.toLocaleString(),
      icon: RefreshCw,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      subtitle: formatCurrencySync(stats.by_status.refunded.amount),
    },
    {
      title: 'Success Rate',
      value: `${successRate}%`,
      icon: Percent,
      color: successRate >= 90 ? 'text-green-600' : successRate >= 70 ? 'text-yellow-600' : 'text-red-600',
      bgColor: successRate >= 90 ? 'bg-green-50' : successRate >= 70 ? 'bg-yellow-50' : 'bg-red-50',
      subtitle: `${stats.completed_count} of ${stats.total_count} payments`,
    },
    {
      title: 'Average Payment',
      value: formatCurrencySync(avgPaymentAmount),
      icon: DollarSign,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
      subtitle: 'Per transaction',
    },
    {
      title: 'Total Revenue',
      value: formatCurrencySync(stats.completed_amount),
      icon: TrendingUp,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
      subtitle: 'From completed payments',
    },
  ];

  return (
    <div className={className}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card, index) => (
          <StatCard key={index} {...card} />
        ))}
      </div>

      {/* Payment Method Breakdown */}
      <div className="mt-8 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Methods Breakdown</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-50 mb-3">
              <DollarSign className="h-6 w-6 text-green-600" />
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {stats.by_method.Cash.count}
            </div>
            <div className="text-sm text-gray-600 mb-1">Cash Payments</div>
            <div className="text-lg font-semibold text-green-600">
              {formatCurrencySync(stats.by_method.Cash.amount)}
            </div>
          </div>

          <div className="text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-50 mb-3">
              <CreditCard className="h-6 w-6 text-blue-600" />
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {stats.by_method.Card.count}
            </div>
            <div className="text-sm text-gray-600 mb-1">Card Payments</div>
            <div className="text-lg font-semibold text-blue-600">
              {formatCurrencySync(stats.by_method.Card.amount)}
            </div>
          </div>

          <div className="text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-orange-50 mb-3">
              <CreditCard className="h-6 w-6 text-orange-600" />
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {stats.by_method.Mpesa.count}
            </div>
            <div className="text-sm text-gray-600 mb-1">M-Pesa Payments</div>
            <div className="text-lg font-semibold text-orange-600">
              {formatCurrencySync(stats.by_method.Mpesa.amount)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentStatsCards;