import React, { useState, useMemo } from 'react';
import { 
  BarChart3, 
  Download, 
  Calendar, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle, 
  TrendingUp,
  ArrowUpDown,
  Filter
} from 'lucide-react';
import { BrandBalance, BrandReconciliationSummary, getBrandByCode, formatBrandName } from '../../types/brands';

interface BrandReconciliationReportProps {
  data?: BrandReconciliationSummary;
  loading?: boolean;
  onDateRangeChange?: (fromDate: string, toDate: string) => void;
  onExportData?: () => void;
  onRefresh?: () => void;
}

interface BrandReconciliationTableProps {
  brandBalances: BrandBalance[];
  showDetails?: boolean;
  sortBy?: 'brand' | 'balance' | 'received' | 'given';
  sortOrder?: 'asc' | 'desc';
  onSort?: (field: string) => void;
}

const BrandReconciliationTable: React.FC<BrandReconciliationTableProps> = ({
  brandBalances,
  showDetails = false,
  sortBy = 'brand',
  sortOrder = 'asc',
  onSort
}) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
    }).format(amount);
  };

  const getBrandColor = (brandCode: string) => {
    const brand = getBrandByCode(brandCode);
    return brand?.color || '#9E9E9E';
  };

  const getBalanceStatus = (balance: number) => {
    if (balance === 0) return { icon: CheckCircle, color: 'text-green-600', label: 'Balanced' };
    if (balance > 0) return { icon: TrendingUp, color: 'text-blue-600', label: 'Owed to us' };
    return { icon: ArrowUpDown, color: 'text-red-600', label: 'We owe' };
  };

  const sortedBalances = useMemo(() => {
    return [...brandBalances].sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortBy) {
        case 'brand':
          aValue = a.brand_name.toLowerCase();
          bValue = b.brand_name.toLowerCase();
          break;
        case 'balance':
          aValue = Math.abs(a.net_balance);
          bValue = Math.abs(b.net_balance);
          break;
        case 'received':
          aValue = a.cylinders_received;
          bValue = b.cylinders_received;
          break;
        case 'given':
          aValue = a.cylinders_given;
          bValue = b.cylinders_given;
          break;
        default:
          aValue = a.brand_name.toLowerCase();
          bValue = b.brand_name.toLowerCase();
      }

      if (sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });
  }, [brandBalances, sortBy, sortOrder]);

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th 
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              onClick={() => onSort?.('brand')}
            >
              <div className="flex items-center space-x-1">
                <span>Brand</span>
                <ArrowUpDown className="h-3 w-3" />
              </div>
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Capacity
            </th>
            <th 
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              onClick={() => onSort?.('given')}
            >
              <div className="flex items-center space-x-1">
                <span>Given Out</span>
                <ArrowUpDown className="h-3 w-3" />
              </div>
            </th>
            <th 
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              onClick={() => onSort?.('received')}
            >
              <div className="flex items-center space-x-1">
                <span>Received Back</span>
                <ArrowUpDown className="h-3 w-3" />
              </div>
            </th>
            <th 
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              onClick={() => onSort?.('balance')}
            >
              <div className="flex items-center space-x-1">
                <span>Net Balance</span>
                <ArrowUpDown className="h-3 w-3" />
              </div>
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status
            </th>
            {showDetails && (
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Pending
              </th>
            )}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {sortedBalances.map((balance, index) => {
            const balanceStatus = getBalanceStatus(balance.net_balance);
            const StatusIcon = balanceStatus.icon;
            
            return (
              <tr key={`${balance.brand_code}-${balance.capacity_l}`} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center space-x-3">
                    <div 
                      className="w-4 h-4 rounded-full border-2 border-gray-300"
                      style={{ backgroundColor: getBrandColor(balance.brand_code) }}
                    />
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {balance.brand_name}
                      </div>
                      <div className="text-xs text-gray-500 font-mono">
                        {balance.brand_code}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {balance.capacity_l}L
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {balance.cylinders_given}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {balance.cylinders_received}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`text-sm font-medium ${
                    balance.net_balance === 0 ? 'text-green-600' :
                    balance.net_balance > 0 ? 'text-blue-600' : 'text-red-600'
                  }`}>
                    {balance.net_balance > 0 ? '+' : ''}{balance.net_balance}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center space-x-2">
                    <StatusIcon className={`h-4 w-4 ${balanceStatus.color}`} />
                    <span className={`text-xs ${balanceStatus.color}`}>
                      {balanceStatus.label}
                    </span>
                  </div>
                </td>
                {showDetails && (
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {balance.pending_reconciliation > 0 && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        {balance.pending_reconciliation} pending
                      </span>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export const BrandReconciliationReport: React.FC<BrandReconciliationReportProps> = ({
  data,
  loading = false,
  onDateRangeChange,
  onExportData,
  onRefresh
}) => {
  const [dateRange, setDateRange] = useState({
    fromDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    toDate: new Date().toISOString().split('T')[0]
  });
  const [showDetails, setShowDetails] = useState(false);
  const [sortBy, setSortBy] = useState<'brand' | 'balance' | 'received' | 'given'>('brand');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const handleDateRangeChange = (field: 'fromDate' | 'toDate', value: string) => {
    const newRange = { ...dateRange, [field]: value };
    setDateRange(newRange);
    onDateRangeChange?.(newRange.fromDate, newRange.toDate);
  };

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field as any);
      setSortOrder('asc');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
    }).format(amount);
  };

  // Calculate summary stats
  const summaryStats = useMemo(() => {
    if (!data?.brand_balances) return null;

    const totalImbalances = data.brand_balances.filter(b => b.net_balance !== 0).length;
    const positiveBalances = data.brand_balances.filter(b => b.net_balance > 0);
    const negativeBalances = data.brand_balances.filter(b => b.net_balance < 0);
    const totalCylindersOwed = positiveBalances.reduce((sum, b) => sum + b.net_balance, 0);
    const totalCylindersWeOwe = Math.abs(negativeBalances.reduce((sum, b) => sum + b.net_balance, 0));

    return {
      totalImbalances,
      totalCylindersOwed,
      totalCylindersWeOwe,
      totalPendingReconciliations: data.pending_reconciliations || 0
    };
  }, [data]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <BarChart3 className="h-6 w-6 text-blue-600" />
          <h2 className="text-xl font-semibold text-gray-900">Brand Reconciliation Report</h2>
        </div>
        <div className="flex items-center space-x-3">
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={loading}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              title="Refresh Data"
            >
              <RefreshCw className="h-5 w-5" />
            </button>
          )}
          {onExportData && (
            <button
              onClick={onExportData}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </button>
          )}
        </div>
      </div>

      {/* Date Range Filter */}
      <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
        <div className="flex items-center space-x-4">
          <Calendar className="h-5 w-5 text-gray-400" />
          <div className="flex items-center space-x-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">From</label>
              <input
                type="date"
                value={dateRange.fromDate}
                onChange={(e) => handleDateRangeChange('fromDate', e.target.value)}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">To</label>
              <input
                type="date"
                value={dateRange.toDate}
                onChange={(e) => handleDateRangeChange('toDate', e.target.value)}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={showDetails}
                onChange={(e) => setShowDetails(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Show details</span>
            </label>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      {summaryStats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <AlertTriangle className="h-8 w-8 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Imbalanced Brands</p>
                <p className="text-2xl font-semibold text-gray-900">{summaryStats.totalImbalances}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <TrendingUp className="h-8 w-8 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Cylinders Owed to Us</p>
                <p className="text-2xl font-semibold text-gray-900">{summaryStats.totalCylindersOwed}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ArrowUpDown className="h-8 w-8 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Cylinders We Owe</p>
                <p className="text-2xl font-semibold text-gray-900">{summaryStats.totalCylindersWeOwe}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <RefreshCw className="h-8 w-8 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Pending Reconciliations</p>
                <p className="text-2xl font-semibold text-gray-900">{summaryStats.totalPendingReconciliations}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Exchange Fees Summary */}
      {data && data.total_exchange_fees > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <RefreshCw className="h-5 w-5 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">
                Total Exchange Fees for Period:
              </span>
            </div>
            <span className="text-lg font-bold text-blue-600">
              {formatCurrency(data.total_exchange_fees)}
            </span>
          </div>
        </div>
      )}

      {/* Brand Balance Table */}
      {data?.brand_balances && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Brand Balance Details</h3>
            <p className="text-sm text-gray-500 mt-1">
              Cross-brand cylinder exchange tracking and reconciliation status
            </p>
          </div>
          <BrandReconciliationTable 
            brandBalances={data.brand_balances}
            showDetails={showDetails}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSort={handleSort}
          />
        </div>
      )}

      {/* Empty State */}
      {!data?.brand_balances?.length && !loading && (
        <div className="text-center py-12">
          <BarChart3 className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No brand reconciliation data</h3>
          <p className="mt-1 text-sm text-gray-500">
            No cross-brand cylinder exchanges found for the selected date range.
          </p>
        </div>
      )}
    </div>
  );
};