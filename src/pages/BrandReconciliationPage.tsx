import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Download, Settings, AlertTriangle } from 'lucide-react';
import { BrandReconciliationReport } from '../components/brands/BrandReconciliationReport';
import { useBrandReconciliationReport, useUpdateBrandReconciliation } from '../hooks/useDeposits';
import { BrandBalance, BrandReconciliationSummary } from '../types/brands';

export const BrandReconciliationPage: React.FC = () => {
  const navigate = useNavigate();
  const [dateRange, setDateRange] = useState({
    fromDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    toDate: new Date().toISOString().split('T')[0]
  });
  const [brandFilter, setBrandFilter] = useState<string>('');
  const [capacityFilter, setCapacityFilter] = useState<number | undefined>();

  const { 
    data: reconciliationData, 
    isLoading, 
    error, 
    refetch 
  } = useBrandReconciliationReport({
    from_date: dateRange.fromDate,
    to_date: dateRange.toDate,
    brand_code: brandFilter || undefined,
    capacity_l: capacityFilter,
  });

  const updateBrandReconciliation = useUpdateBrandReconciliation();

  const handleDateRangeChange = (fromDate: string, toDate: string) => {
    setDateRange({ fromDate, toDate });
  };

  const handleExportData = () => {
    if (!reconciliationData) return;
    
    // Create CSV data for export
    const csvData = reconciliationData.brand_balances.map((balance: BrandBalance) => ({
      'Brand Code': balance.brand_code,
      'Brand Name': balance.brand_name,
      'Capacity (L)': balance.capacity_l,
      'Cylinders Given': balance.cylinders_given,
      'Cylinders Received': balance.cylinders_received,
      'Net Balance': balance.net_balance,
      'Pending Reconciliation': balance.pending_reconciliation,
      'Last Updated': balance.last_updated,
    }));

    // Convert to CSV string
    const headers = Object.keys(csvData[0] || {}).join(',');
    const rows = csvData.map(row => Object.values(row).join(','));
    const csvContent = [headers, ...rows].join('\n');

    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `brand-reconciliation-${dateRange.fromDate}-to-${dateRange.toDate}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const handleRefresh = () => {
    refetch();
  };

  const handleBulkReconciliation = (creditIds: string[], newStatus: 'pending' | 'matched' | 'generic_accepted') => {
    updateBrandReconciliation.mutate({
      credit_ids: creditIds,
      new_status: newStatus,
      notes: `Bulk update to ${newStatus} status`,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/deposits')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Brand Reconciliation</h1>
            <p className="text-gray-600">
              Track cross-brand cylinder exchanges and reconciliation status
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
            title="Refresh Data"
          >
            <RefreshCw className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          
          <button
            onClick={handleExportData}
            disabled={!reconciliationData}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <span className="text-red-800 font-medium">Error loading brand reconciliation data</span>
          </div>
          <p className="text-red-700 text-sm mt-2">
            {(error as any)?.message || 'An unexpected error occurred'}
          </p>
        </div>
      )}

      {/* Additional Filters */}
      <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="brand-filter" className="block text-sm font-medium text-gray-700">
              Filter by Brand
            </label>
            <input
              id="brand-filter"
              type="text"
              value={brandFilter}
              onChange={(e) => setBrandFilter(e.target.value)}
              placeholder="e.g., TOTAL, SHELL"
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          </div>
          
          <div>
            <label htmlFor="capacity-filter" className="block text-sm font-medium text-gray-700">
              Filter by Capacity (L)
            </label>
            <input
              id="capacity-filter"
              type="number"
              value={capacityFilter || ''}
              onChange={(e) => setCapacityFilter(e.target.value ? parseInt(e.target.value) : undefined)}
              placeholder="e.g., 13, 6"
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          </div>
          
          <div className="flex items-end">
            <button
              onClick={() => {
                setBrandFilter('');
                setCapacityFilter(undefined);
              }}
              className="w-full px-4 py-2 text-sm text-gray-600 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Brand Reconciliation Report */}
      <BrandReconciliationReport
        data={reconciliationData}
        loading={isLoading}
        onDateRangeChange={handleDateRangeChange}
        onExportData={handleExportData}
        onRefresh={handleRefresh}
      />

      {/* Quick Actions Panel */}
      {reconciliationData && reconciliationData.pending_reconciliations > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              <div>
                <h3 className="text-sm font-medium text-yellow-800">
                  Pending Reconciliations
                </h3>
                <p className="text-sm text-yellow-700">
                  {reconciliationData.pending_reconciliations} cylinder exchanges require reconciliation
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate('/deposits/empty-returns')}
              className="inline-flex items-center px-3 py-2 border border-yellow-300 shadow-sm text-sm leading-4 font-medium rounded-md text-yellow-800 bg-yellow-100 hover:bg-yellow-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
            >
              <Settings className="h-4 w-4 mr-2" />
              Manage Reconciliations
            </button>
          </div>
        </div>
      )}

      {/* Help Text */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="text-sm font-medium text-blue-900 mb-2">Understanding Brand Reconciliation</h4>
        <div className="text-sm text-blue-800 space-y-1">
          <p><strong>Cylinders Given:</strong> Number of cylinders of this brand provided to customers</p>
          <p><strong>Cylinders Received:</strong> Number of cylinders of this brand returned by customers</p>
          <p><strong>Net Balance:</strong> Positive = We are owed cylinders, Negative = We owe cylinders</p>
          <p><strong>Pending:</strong> Cross-brand exchanges that need manual reconciliation</p>
        </div>
      </div>
    </div>
  );
}; 