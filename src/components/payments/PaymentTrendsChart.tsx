import React, { useMemo } from 'react';
import { BarChart3, TrendingUp, TrendingDown, Calendar, DollarSign } from 'lucide-react';
import { PaymentSummaryStats, PaymentMethod } from '../../types/payment';
import { formatCurrencySync } from '../../utils/pricing';

interface PaymentTrendsChartProps {
  stats: PaymentSummaryStats;
  className?: string;
  title?: string;
}

interface TrendData {
  method: PaymentMethod;
  amount: number;
  count: number;
  percentage: number;
  color: string;
  bgColor: string;
}

const LoadingSkeleton: React.FC = () => (
  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
    <div className="animate-pulse">
      <div className="h-6 bg-gray-200 rounded w-1/3 mb-6"></div>
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
            <div className="flex-1">
              <div className="h-4 bg-gray-200 rounded w-20 mb-2"></div>
              <div className="h-6 bg-gray-200 rounded w-full"></div>
            </div>
            <div className="text-right">
              <div className="h-4 bg-gray-200 rounded w-16 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-12"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const EmptyState: React.FC = () => (
  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
    <div className="text-center text-gray-500">
      <BarChart3 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
      <p className="text-lg font-medium mb-2">No Payment Data</p>
      <p className="text-sm">No payment trends available for the selected period</p>
    </div>
  </div>
);

export const PaymentTrendsChart: React.FC<PaymentTrendsChartProps> = ({
  stats,
  className = '',
  title = 'Payment Methods Breakdown',
}) => {
  const trendData: TrendData[] = useMemo(() => {
    if (!stats || stats.total_amount === 0) return [];

    const methods: { method: PaymentMethod; color: string; bgColor: string }[] = [
      { method: 'Cash', color: 'text-green-600', bgColor: 'bg-green-50' },
      { method: 'Mpesa', color: 'text-orange-600', bgColor: 'bg-orange-50' },
      { method: 'Card', color: 'text-blue-600', bgColor: 'bg-blue-50' },
    ];

    return methods.map(({ method, color, bgColor }) => {
      const methodStats = stats.by_method[method];
      const percentage = stats.total_amount > 0 
        ? Math.round((methodStats.amount / stats.total_amount) * 100) 
        : 0;

      return {
        method,
        amount: methodStats.amount,
        count: methodStats.count,
        percentage,
        color,
        bgColor,
      };
    }).sort((a, b) => b.amount - a.amount); // Sort by amount descending
  }, [stats]);

  if (!stats) {
    return <EmptyState />;
  }

  const maxAmount = Math.max(...trendData.map(d => d.amount));

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <div className="flex items-center text-sm text-gray-600">
          <DollarSign className="h-4 w-4 mr-1" />
          Total: {formatCurrencySync(stats.total_amount)}
        </div>
      </div>

      {/* Chart Bars */}
      <div className="space-y-6">
        {trendData.map((data) => (
          <div key={data.method} className="space-y-2">
            {/* Method Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className={`w-4 h-4 rounded-full ${data.bgColor.replace('bg-', 'bg-')} border-2 ${data.color.replace('text-', 'border-')}`}></div>
                <span className="font-medium text-gray-900">{data.method}</span>
                <span className="text-sm text-gray-500">
                  {data.count} payment{data.count !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="text-right">
                <div className="font-semibold text-gray-900">
                  {formatCurrencySync(data.amount)}
                </div>
                <div className="text-sm text-gray-500">
                  {data.percentage}%
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all duration-500 ease-out ${data.bgColor.replace('bg-', 'bg-').replace('-50', '-400')}`}
                style={{
                  width: maxAmount > 0 ? `${(data.amount / maxAmount) * 100}%` : '0%',
                }}
              ></div>
            </div>
          </div>
        ))}
      </div>

      {/* Summary Stats */}
      <div className="mt-8 pt-6 border-t border-gray-200">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">
              {stats.total_count}
            </div>
            <div className="text-sm text-gray-600">Total Payments</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {stats.completed_count}
            </div>
            <div className="text-sm text-gray-600">Completed</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600">
              {stats.pending_count}
            </div>
            <div className="text-sm text-gray-600">Pending</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">
              {stats.failed_count}
            </div>
            <div className="text-sm text-gray-600">Failed</div>
          </div>
        </div>
      </div>

      {/* Method Comparison */}
      {trendData.length > 1 && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Quick Insights</h4>
          <div className="space-y-2 text-sm">
            {/* Most used method */}
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Most popular method:</span>
              <span className="font-medium text-gray-900">
                {trendData[0]?.method} ({trendData[0]?.count} payments)
              </span>
            </div>
            
            {/* Highest revenue method */}
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Highest revenue method:</span>
              <span className="font-medium text-gray-900">
                {trendData[0]?.method} ({formatCurrencySync(trendData[0]?.amount || 0)})
              </span>
            </div>
            
            {/* Success rate */}
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Overall success rate:</span>
              <div className="flex items-center">
                {stats.total_count > 0 && (
                  <>
                    {Math.round((stats.completed_count / stats.total_count) * 100) >= 90 ? (
                      <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-500 mr-1" />
                    )}
                    <span className="font-medium text-gray-900">
                      {Math.round((stats.completed_count / stats.total_count) * 100)}%
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentTrendsChart;