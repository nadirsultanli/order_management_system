import React, { useState, useCallback } from 'react';
import { AlertCircle, Download, FileText, TrendingUp } from 'lucide-react';
import { usePaymentSummary } from '../../hooks/usePayments';
import { PaymentSummaryFilters } from '../../types/payment';
import PaymentStatsCards from './PaymentStatsCards';
import PaymentSummaryFilters from './PaymentSummaryFilters';
import PaymentTrendsChart from './PaymentTrendsChart';
import { formatCurrencySync } from '../../utils/pricing';

interface PaymentSummaryDashboardProps {
  className?: string;
  showHeader?: boolean;
  compactMode?: boolean;
}

const LoadingSkeleton: React.FC = () => (
  <div className="space-y-6">
    {/* Filters skeleton */}
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="animate-pulse">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex gap-4">
            <div className="h-10 bg-gray-200 rounded w-40"></div>
            <div className="h-10 bg-gray-200 rounded w-32"></div>
          </div>
          <div className="flex gap-2">
            <div className="h-10 bg-gray-200 rounded w-20"></div>
            <div className="h-10 bg-gray-200 rounded w-20"></div>
          </div>
        </div>
      </div>
    </div>
    
    {/* Stats cards skeleton */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {[...Array(8)].map((_, i) => (
        <div key={i} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="animate-pulse">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="h-4 bg-gray-200 rounded w-20 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-16"></div>
              </div>
              <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
            </div>
          </div>
        </div>
      ))}
    </div>
    
    {/* Chart skeleton */}
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/3 mb-6"></div>
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-8 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

const ErrorState: React.FC<{ error: any; onRetry: () => void }> = ({ error, onRetry }) => (
  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
    <div className="text-center">
      <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-500" />
      <h3 className="text-lg font-medium text-gray-900 mb-2">
        Failed to Load Payment Analytics
      </h3>
      <p className="text-gray-600 mb-4">
        {error?.message || 'An error occurred while loading the payment summary.'}
      </p>
      <button
        onClick={onRetry}
        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
      >
        Try Again
      </button>
    </div>
  </div>
);

const EmptyState: React.FC = () => (
  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
    <div className="text-center">
      <FileText className="h-12 w-12 mx-auto mb-4 text-gray-400" />
      <h3 className="text-lg font-medium text-gray-900 mb-2">
        No Payment Data Available
      </h3>
      <p className="text-gray-600">
        No payments found for the selected filters. Try adjusting your date range or filters.
      </p>
    </div>
  </div>
);

export const PaymentSummaryDashboard: React.FC<PaymentSummaryDashboardProps> = ({
  className = '',
  showHeader = true,
  compactMode = false,
}) => {
  const [filters, setFilters] = useState<PaymentSummaryFilters>({});

  const {
    data: summaryStats,
    isLoading,
    isError,
    error,
    refetch,
  } = usePaymentSummary(filters);

  // Handle export functionality
  const handleExport = useCallback(() => {
    if (!summaryStats) return;

    // Create CSV data
    const csvData = [
      ['Payment Analytics Report'],
      ['Generated on:', new Date().toLocaleString()],
      ['Date Range:', filters.date_from && filters.date_to 
        ? `${filters.date_from} to ${filters.date_to}` 
        : 'All time'],
      ['Payment Method:', filters.payment_method || 'All methods'],
      [''],
      ['Summary Statistics'],
      ['Total Payments:', summaryStats.total_count.toString()],
      ['Total Amount:', formatCurrencySync(summaryStats.total_amount)],
      ['Completed Payments:', summaryStats.completed_count.toString()],
      ['Completed Amount:', formatCurrencySync(summaryStats.completed_amount)],
      ['Pending Payments:', summaryStats.pending_count.toString()],
      ['Pending Amount:', formatCurrencySync(summaryStats.pending_amount)],
      ['Failed Payments:', summaryStats.failed_count.toString()],
      ['Failed Amount:', formatCurrencySync(summaryStats.failed_amount)],
      [''],
      ['Payment Methods Breakdown'],
      ['Method', 'Count', 'Amount'],
      ['Cash', summaryStats.by_method.Cash.count.toString(), formatCurrencySync(summaryStats.by_method.Cash.amount)],
      ['M-Pesa', summaryStats.by_method.Mpesa.count.toString(), formatCurrencySync(summaryStats.by_method.Mpesa.amount)],
      ['Card', summaryStats.by_method.Card.count.toString(), formatCurrencySync(summaryStats.by_method.Card.amount)],
    ];

    // Convert to CSV string
    const csvContent = csvData.map(row => row.join(',')).join('\n');
    
    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `payment-analytics-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [summaryStats, filters]);

  // Handle filters change
  const handleFiltersChange = useCallback((newFilters: PaymentSummaryFilters) => {
    setFilters(newFilters);
  }, []);

  // Handle refresh
  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  if (isLoading) {
    return (
      <div className={className}>
        <LoadingSkeleton />
      </div>
    );
  }

  if (isError) {
    return (
      <div className={className}>
        <ErrorState error={error} onRetry={handleRefresh} />
      </div>
    );
  }

  if (!summaryStats || summaryStats.total_count === 0) {
    return (
      <div className={className}>
        <div className="space-y-6">
          <PaymentSummaryFilters
            filters={filters}
            onFiltersChange={handleFiltersChange}
            onRefresh={handleRefresh}
            onExport={handleExport}
            isLoading={isLoading}
          />
          <EmptyState />
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      {showHeader && (
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Payment Analytics</h1>
            <p className="text-gray-600 mt-1">
              Comprehensive overview of payment statistics and trends
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <div className="text-right">
              <div className="text-2xl font-bold text-green-600">
                {formatCurrencySync(summaryStats.completed_amount)}
              </div>
              <div className="text-sm text-gray-600">Total Revenue</div>
            </div>
            <div className="p-2 bg-green-50 rounded-full">
              <TrendingUp className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <PaymentSummaryFilters
        filters={filters}
        onFiltersChange={handleFiltersChange}
        onRefresh={handleRefresh}
        onExport={handleExport}
        isLoading={isLoading}
      />

      {/* Statistics Cards */}
      <PaymentStatsCards 
        stats={summaryStats} 
        isLoading={isLoading}
        className={compactMode ? 'mb-4' : ''}
      />

      {/* Trends Chart */}
      <div className={compactMode ? 'grid grid-cols-1 lg:grid-cols-2 gap-6' : ''}>
        <PaymentTrendsChart 
          stats={summaryStats}
          title="Payment Methods Analysis"
        />
        
        {!compactMode && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Key Performance Indicators
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Success Rate</span>
                <div className="flex items-center">
                  <div className="w-32 bg-gray-200 rounded-full h-2 mr-3">
                    <div
                      className="bg-green-500 h-2 rounded-full"
                      style={{
                        width: `${Math.round((summaryStats.completed_count / summaryStats.total_count) * 100)}%`,
                      }}
                    ></div>
                  </div>
                  <span className="font-medium">
                    {Math.round((summaryStats.completed_count / summaryStats.total_count) * 100)}%
                  </span>
                </div>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Average Payment</span>
                <span className="font-medium">
                  {formatCurrencySync(summaryStats.total_amount / summaryStats.total_count)}
                </span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Pending Amount</span>
                <span className="font-medium text-yellow-600">
                  {formatCurrencySync(summaryStats.pending_amount)}
                </span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Failed Amount</span>
                <span className="font-medium text-red-600">
                  {formatCurrencySync(summaryStats.failed_amount)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Additional Insights */}
      {!compactMode && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h4 className="text-lg font-semibold text-gray-900 mb-3">
              Most Popular Method
            </h4>
            <div className="text-center">
              {Object.entries(summaryStats.by_method)
                .sort(([,a], [,b]) => b.count - a.count)
                .slice(0, 1)
                .map(([method, stats]) => (
                  <div key={method}>
                    <div className="text-3xl font-bold text-blue-600 mb-2">
                      {method}
                    </div>
                    <div className="text-gray-600">
                      {stats.count} payments ({Math.round((stats.count / summaryStats.total_count) * 100)}%)
                    </div>
                  </div>
                ))}
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h4 className="text-lg font-semibold text-gray-900 mb-3">
              Highest Revenue Method
            </h4>
            <div className="text-center">
              {Object.entries(summaryStats.by_method)
                .sort(([,a], [,b]) => b.amount - a.amount)
                .slice(0, 1)
                .map(([method, stats]) => (
                  <div key={method}>
                    <div className="text-3xl font-bold text-green-600 mb-2">
                      {method}
                    </div>
                    <div className="text-gray-600">
                      {formatCurrencySync(stats.amount)} ({Math.round((stats.amount / summaryStats.total_amount) * 100)}%)
                    </div>
                  </div>
                ))}
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h4 className="text-lg font-semibold text-gray-900 mb-3">
              Payment Status
            </h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-green-600">Completed</span>
                <span className="font-medium">
                  {Math.round((summaryStats.completed_count / summaryStats.total_count) * 100)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-yellow-600">Pending</span>
                <span className="font-medium">
                  {Math.round((summaryStats.pending_count / summaryStats.total_count) * 100)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-red-600">Failed</span>
                <span className="font-medium">
                  {Math.round((summaryStats.failed_count / summaryStats.total_count) * 100)}%
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentSummaryDashboard;