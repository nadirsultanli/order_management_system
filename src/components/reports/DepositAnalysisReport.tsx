import React, { useState, useMemo } from 'react';
import { Download, Filter, RefreshCw, AlertTriangle, Users, DollarSign, Calendar, TrendingUp, TrendingDown, Target, FileText, Search } from 'lucide-react';
import { 
  useDepositAnalysisReport, 
  useCustomersForReports,
  formatReportFilename,
  downloadCSV,
  downloadPDF 
} from '../../hooks/useReports';
import { BarChart } from './BarChart';
import { PieChart } from './PieChart';
import { DataTable } from './DataTable';
import { DepositAnalysisParams, BarChartData, PieChartData, TableColumn } from '../../types/reports';
import { formatCurrencySync } from '../../utils/pricing';

interface DepositAnalysisReportProps {
  dateRange: { start: string; end: string };
  className?: string;
}

export const DepositAnalysisReport: React.FC<DepositAnalysisReportProps> = ({
  dateRange,
  className = '',
}) => {
  // Default risk threshold in KES
  const [riskThreshold, setRiskThreshold] = useState<number>(50000);
  const [customerSearch, setCustomerSearch] = useState<string>('');
  
  // State for filters
  const [filters, setFilters] = useState<DepositAnalysisParams>({
    customer_id: undefined,
    aging_buckets: true,
    include_zero_balances: false,
    min_days_outstanding: undefined,
    threshold_amount: riskThreshold,
    start_date: dateRange.start,
    end_date: dateRange.end,
    page: 1,
    limit: 100,
  });

  const [showFilters, setShowFilters] = useState(false);

  // Update filters when date range changes
  React.useEffect(() => {
    setFilters(prev => ({
      ...prev,
      start_date: dateRange.start,
      end_date: dateRange.end,
      threshold_amount: riskThreshold,
    }));
  }, [dateRange, riskThreshold]);

  // Fetch data
  const { 
    data: reportData, 
    isLoading, 
    error, 
    refetch 
  } = useDepositAnalysisReport(filters);

  const { data: customers = [] } = useCustomersForReports();

  // Filter customers based on search
  const filteredCustomers = useMemo(() => {
    if (!customerSearch) return customers;
    return customers.filter(customer => 
      customer.name.toLowerCase().includes(customerSearch.toLowerCase())
    );
  }, [customers, customerSearch]);

  // Prepare aging analysis bar chart data
  const agingBarChartData: BarChartData[] = useMemo(() => {
    if (!reportData?.aging_breakdown) return [];
    
    return reportData.aging_breakdown.map(bucket => ({
      warehouse_name: bucket.bucket,
      full_value: bucket.total_amount,
      empty_value: 0, // Not applicable for aging analysis
      total_value: bucket.total_amount,
    }));
  }, [reportData]);

  // Prepare risk level pie chart data
  const riskPieChartData: PieChartData[] = useMemo(() => {
    if (!reportData?.data) return [];

    const highRisk = reportData.data.filter(item => item.exceeds_threshold);
    const mediumRisk = reportData.data.filter(item => !item.exceeds_threshold && item.days_outstanding > 60);
    const lowRisk = reportData.data.filter(item => !item.exceeds_threshold && item.days_outstanding <= 60);

    const total = reportData.data.length;
    if (total === 0) return [];

    return [
      {
        name: 'High Risk',
        value: highRisk.length,
        percentage: Math.round((highRisk.length / total) * 100),
        fill: '#EF4444', // red-500
      },
      {
        name: 'Medium Risk',
        value: mediumRisk.length,
        percentage: Math.round((mediumRisk.length / total) * 100),
        fill: '#F59E0B', // amber-500
      },
      {
        name: 'Low Risk',
        value: lowRisk.length,
        percentage: Math.round((lowRisk.length / total) * 100),
        fill: '#10B981', // emerald-500
      },
    ].filter(item => item.value > 0);
  }, [reportData]);

  // Table columns
  const tableColumns: TableColumn[] = [
    { key: 'customer_name', label: 'Customer', sortable: true },
    { 
      key: 'outstanding_amount', 
      label: 'Outstanding Amount', 
      sortable: true, 
      align: 'right',
      formatter: (value: number) => formatCurrencySync(value)
    },
    { key: 'cylinder_count', label: 'Cylinders', sortable: true, align: 'right' },
    { 
      key: 'days_outstanding', 
      label: 'Days Outstanding', 
      sortable: true, 
      align: 'right',
      formatter: (value: number) => `${value} days`
    },
    { key: 'aging_bucket', label: 'Age Bucket', sortable: true },
    { 
      key: 'oldest_deposit_date', 
      label: 'Oldest Deposit', 
      sortable: true,
      formatter: (value: string) => new Date(value).toLocaleDateString()
    },
    { 
      key: 'last_return_date', 
      label: 'Last Return', 
      sortable: true,
      formatter: (value: string | null) => value ? new Date(value).toLocaleDateString() : 'Never'
    },
    {
      key: 'exceeds_threshold',
      label: 'Risk Level',
      sortable: true,
      formatter: (value: boolean, row: any) => {
        if (value) return '🔴 High Risk';
        if (row.days_outstanding > 60) return '🟡 Medium Risk';
        return '🟢 Low Risk';
      }
    },
  ];

  // Handle filter changes
  const handleFilterChange = (key: keyof DepositAnalysisParams, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value, page: 1 }));
  };

  // Export functions
  const generateDepositAnalysisCSV = () => {
    if (!reportData) return '';

    const headers = [
      'Customer Name',
      'Outstanding Amount',
      'Cylinder Count',
      'Days Outstanding',
      'Aging Bucket',
      'Oldest Deposit Date',
      'Last Return Date',
      'Exceeds Threshold',
      'Risk Level',
    ];

    const rows = reportData.data.map(item => [
      item.customer_name,
      item.outstanding_amount.toFixed(2),
      item.cylinder_count.toString(),
      item.days_outstanding.toString(),
      item.aging_bucket,
      item.oldest_deposit_date,
      item.last_return_date || 'Never',
      item.exceeds_threshold ? 'Yes' : 'No',
      item.exceeds_threshold ? 'High Risk' : (item.days_outstanding > 60 ? 'Medium Risk' : 'Low Risk'),
    ]);

    const csvContent = [
      ['Deposit Analysis Report'],
      [`As of Date: ${reportData.as_of_date}`],
      [`Period: ${dateRange.start} to ${dateRange.end}`],
      [`Risk Threshold: ${formatCurrencySync(riskThreshold)}`],
      [`Generated: ${new Date().toISOString()}`],
      [],
      headers,
      ...rows,
      [],
      // Summary section
      ['SUMMARY'],
      ['Total Outstanding Amount', reportData.summary.total_outstanding_amount.toFixed(2)],
      ['Customers with Deposits', reportData.summary.customers_with_deposits.toString()],
      ['Total Cylinders on Deposit', reportData.summary.total_cylinders_on_deposit.toString()],
      ['Average Outstanding per Customer', reportData.summary.average_outstanding_per_customer.toFixed(2)],
      ['Customers Exceeding Threshold', reportData.summary.customers_exceeding_threshold.toString()],
      [],
      // Aging breakdown
      ['AGING BREAKDOWN'],
      ['Age Bucket', 'Customer Count', 'Total Amount', 'Cylinder Count'],
      ...(reportData.aging_breakdown?.map(bucket => [
        bucket.bucket,
        bucket.customer_count.toString(),
        bucket.total_amount.toFixed(2),
        bucket.cylinder_count.toString(),
      ]) || []),
    ].filter(row => row.length > 0).map(row => row.join(',')).join('\n');

    return csvContent;
  };

  const generateDepositAnalysisPDF = () => {
    if (!reportData) return '';

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Deposit Analysis Report</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; color: #333; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #ddd; padding-bottom: 20px; }
            .title { font-size: 24px; font-weight: bold; margin-bottom: 10px; }
            .subtitle { color: #666; font-size: 14px; }
            .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 30px 0; }
            .summary-card { border: 1px solid #ddd; padding: 15px; border-radius: 8px; text-align: center; }
            .summary-value { font-size: 18px; font-weight: bold; margin-bottom: 5px; }
            .summary-label { font-size: 12px; color: #666; }
            .risk-alerts { background: #fef2f2; border: 1px solid #fecaca; padding: 15px; border-radius: 8px; margin: 20px 0; }
            .risk-alert { color: #dc2626; font-weight: bold; margin-bottom: 5px; }
            table { width: 100%; border-collapse: collapse; margin-top: 30px; font-size: 11px; }
            th, td { border: 1px solid #ddd; padding: 6px; text-align: left; }
            th { background-color: #f5f5f5; font-weight: bold; }
            .text-right { text-align: right; }
            .high-risk { background-color: #fef2f2; }
            .medium-risk { background-color: #fefce8; }
            .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #666; font-size: 12px; }
            @media print {
              body { margin: 20px; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">Accounts Receivable - Deposit Analysis Report</div>
            <div class="subtitle">
              As of: ${reportData.as_of_date}
              <br>Period: ${dateRange.start} to ${dateRange.end}
              <br>Risk Threshold: ${formatCurrencySync(riskThreshold)}
              <br>Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}
            </div>
          </div>

          <div class="summary">
            <div class="summary-card">
              <div class="summary-value">Ksh ${reportData.summary.total_outstanding_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
              <div class="summary-label">Total Outstanding</div>
            </div>
            <div class="summary-card">
              <div class="summary-value">${reportData.summary.customers_with_deposits.toLocaleString()}</div>
              <div class="summary-label">Customers with Deposits</div>
            </div>
            <div class="summary-card">
              <div class="summary-value">${reportData.summary.total_cylinders_on_deposit.toLocaleString()}</div>
              <div class="summary-label">Cylinders on Deposit</div>
            </div>
            <div class="summary-card">
              <div class="summary-value">${reportData.summary.customers_exceeding_threshold.toLocaleString()}</div>
              <div class="summary-label">High Risk Customers</div>
            </div>
          </div>

          ${reportData.summary.customers_exceeding_threshold > 0 ? `
          <div class="risk-alerts">
            <div class="risk-alert">⚠️ RISK ALERTS</div>
            <div>${reportData.summary.customers_exceeding_threshold} customer(s) exceed the risk threshold of ${formatCurrencySync(riskThreshold)}</div>
            <div>Immediate attention required for accounts receivable management</div>
          </div>
          ` : ''}

          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th class="text-right">Outstanding</th>
                <th class="text-right">Cylinders</th>
                <th class="text-right">Days</th>
                <th>Age Bucket</th>
                <th>Oldest Deposit</th>
                <th>Last Return</th>
                <th>Risk Level</th>
              </tr>
            </thead>
            <tbody>
              ${reportData.data.map(item => `
                <tr class="${item.exceeds_threshold ? 'high-risk' : (item.days_outstanding > 60 ? 'medium-risk' : '')}">
                  <td>${item.customer_name}</td>
                  <td class="text-right">Ksh ${item.outstanding_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  <td class="text-right">${item.cylinder_count.toLocaleString()}</td>
                  <td class="text-right">${item.days_outstanding}</td>
                  <td>${item.aging_bucket}</td>
                  <td>${new Date(item.oldest_deposit_date).toLocaleDateString()}</td>
                  <td>${item.last_return_date ? new Date(item.last_return_date).toLocaleDateString() : 'Never'}</td>
                  <td>${item.exceeds_threshold ? 'High Risk' : (item.days_outstanding > 60 ? 'Medium Risk' : 'Low Risk')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          ${reportData.aging_breakdown ? `
          <h3 style="margin-top: 40px;">Aging Analysis Breakdown</h3>
          <table>
            <thead>
              <tr>
                <th>Age Bucket</th>
                <th class="text-right">Customer Count</th>
                <th class="text-right">Total Amount</th>
                <th class="text-right">Cylinder Count</th>
              </tr>
            </thead>
            <tbody>
              ${reportData.aging_breakdown.map(bucket => `
                <tr>
                  <td>${bucket.bucket}</td>
                  <td class="text-right">${bucket.customer_count.toLocaleString()}</td>
                  <td class="text-right">Ksh ${bucket.total_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  <td class="text-right">${bucket.cylinder_count.toLocaleString()}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          ` : ''}

          <div class="footer">
            <p>This report was generated by the Order Management System</p>
            <p>Total records: ${reportData.data.length} | Page ${reportData.currentPage} of ${reportData.totalPages}</p>
            <p><strong>Recommendations:</strong></p>
            <ul style="text-align: left; display: inline-block;">
              <li>Contact high-risk customers immediately for deposit recovery</li>
              <li>Implement automated reminder system for customers in 31-60 day bucket</li>
              <li>Review credit terms for customers with extended deposit periods</li>
              <li>Consider deposit insurance for high-value customers</li>
            </ul>
          </div>

          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `;

    return htmlContent;
  };

  // Handle CSV export
  const handleExportCSV = () => {
    const csvContent = generateDepositAnalysisCSV();
    const filename = formatReportFilename('deposit-analysis', dateRange, 'csv');
    downloadCSV(csvContent, filename);
  };

  // Handle PDF export
  const handleExportPDF = () => {
    const htmlContent = generateDepositAnalysisPDF();
    const filename = formatReportFilename('deposit-analysis', dateRange, 'pdf');
    downloadPDF(htmlContent, filename);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="animate-pulse">
          {/* Summary cards skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="h-4 bg-gray-200 rounded w-2/3 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-3/4"></div>
              </div>
            ))}
          </div>
          {/* Charts skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="h-96 bg-gray-200 rounded-lg"></div>
            <div className="h-96 bg-gray-200 rounded-lg"></div>
          </div>
          {/* Table skeleton */}
          <div className="h-64 bg-gray-200 rounded-lg"></div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={`bg-red-50 border border-red-200 rounded-lg p-6 ${className}`}>
        <div className="flex items-center space-x-3">
          <div className="text-red-600">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-base font-medium text-red-800">Failed to load deposit analysis report</h3>
            <p className="text-sm text-red-700 mt-1">
              {error instanceof Error ? error.message : 'An unexpected error occurred'}
            </p>
            <button
              onClick={() => refetch()}
              className="mt-2 inline-flex items-center space-x-2 text-sm text-red-800 hover:text-red-900"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Try again</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // No data state
  if (!reportData || reportData.data.length === 0) {
    return (
      <div className={`bg-gray-50 rounded-lg p-12 text-center border border-gray-200 ${className}`}>
        <DollarSign className="h-16 w-16 text-gray-400 mx-auto mb-4" />
        <h4 className="text-lg font-medium text-gray-900 mb-2">No deposit analysis data</h4>
        <p className="text-gray-600">No outstanding deposits found for the current filters.</p>
        <button
          onClick={() => setFilters(prev => ({ 
            ...prev, 
            customer_id: undefined, 
            min_days_outstanding: undefined,
            include_zero_balances: true,
          }))}
          className="mt-4 inline-flex items-center space-x-2 text-blue-600 hover:text-blue-700"
        >
          <RefreshCw className="h-4 w-4" />
          <span>Include zero balances</span>
        </button>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header with filters and export */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Deposit Analysis & Risk Assessment</h3>
          <p className="text-gray-600">
            Track cylinder deposits, customer liabilities, and aging analysis as of {reportData.as_of_date}
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center space-x-2 px-4 py-2 border rounded-lg transition-colors ${
              showFilters || filters.customer_id || filters.min_days_outstanding
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Filter className="h-4 w-4" />
            <span>Filters</span>
          </button>
          
          <button
            onClick={() => refetch()}
            disabled={isLoading}
            className="inline-flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
          >
            <Download className="h-4 w-4" />
            <span>CSV</span>
          </button>
          
          <button
            onClick={handleExportPDF}
            className="inline-flex items-center space-x-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
          >
            <FileText className="h-4 w-4" />
            <span>PDF</span>
          </button>
        </div>
      </div>

      {/* Filters panel */}
      {showFilters && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h4 className="text-lg font-medium text-gray-900 mb-4">Filter Options</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Customer filter with search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Customer
              </label>
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-3 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search customers..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {customerSearch && (
                <select
                  value={filters.customer_id || ''}
                  onChange={(e) => handleFilterChange('customer_id', e.target.value || undefined)}
                  className="w-full mt-2 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Customers</option>
                  {filteredCustomers.map(customer => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
            
            {/* Risk threshold */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Risk Threshold (KES)
              </label>
              <input
                type="number"
                value={riskThreshold}
                onChange={(e) => setRiskThreshold(Number(e.target.value))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="50000"
                min="0"
                step="1000"
              />
            </div>

            {/* Minimum days outstanding */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Min Days Outstanding
              </label>
              <input
                type="number"
                value={filters.min_days_outstanding || ''}
                onChange={(e) => handleFilterChange('min_days_outstanding', e.target.value ? Number(e.target.value) : undefined)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0"
                min="0"
              />
            </div>
            
            {/* Options */}
            <div className="flex flex-col space-y-2">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="include_zero_balances"
                  checked={filters.include_zero_balances || false}
                  onChange={(e) => handleFilterChange('include_zero_balances', e.target.checked)}
                  className="mr-2"
                />
                <label htmlFor="include_zero_balances" className="text-sm text-gray-700">
                  Include zero balances
                </label>
              </div>
              <button
                onClick={() => {
                  setFilters(prev => ({ 
                    ...prev, 
                    customer_id: undefined, 
                    min_days_outstanding: undefined,
                    include_zero_balances: false,
                    page: 1 
                  }));
                  setCustomerSearch('');
                  setRiskThreshold(50000);
                }}
                className="w-full px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Risk Alerts */}
      {reportData.summary.customers_exceeding_threshold > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="h-6 w-6 text-red-600" />
            <div>
              <h4 className="text-base font-medium text-red-800">High Risk Alert</h4>
              <p className="text-sm text-red-700 mt-1">
                {reportData.summary.customers_exceeding_threshold} customer(s) exceed the risk threshold of {formatCurrencySync(riskThreshold)}. 
                Immediate attention required for accounts receivable management.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-6 border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-600">Total Outstanding</p>
              <p className="text-2xl font-bold text-blue-900">
                {formatCurrencySync(reportData.summary.total_outstanding_amount)}
              </p>
            </div>
            <DollarSign className="h-8 w-8 text-blue-600" />
          </div>
          <div className="mt-4">
            <span className="text-sm text-blue-700">
              {reportData.summary.customers_with_deposits} customer{reportData.summary.customers_with_deposits !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        <div className="bg-gradient-to-r from-green-50 to-green-100 rounded-lg p-6 border border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-600">Cylinders on Deposit</p>
              <p className="text-2xl font-bold text-green-900">
                {reportData.summary.total_cylinders_on_deposit.toLocaleString()}
              </p>
            </div>
            <Target className="h-8 w-8 text-green-600" />
          </div>
          <div className="mt-4">
            <span className="text-sm text-green-700">
              Avg: {formatCurrencySync(reportData.summary.average_outstanding_per_customer)}/customer
            </span>
          </div>
        </div>

        <div className={`bg-gradient-to-r rounded-lg p-6 border ${
          reportData.summary.customers_exceeding_threshold > 0 
            ? 'from-red-50 to-red-100 border-red-200' 
            : 'from-emerald-50 to-emerald-100 border-emerald-200'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm font-medium ${
                reportData.summary.customers_exceeding_threshold > 0 ? 'text-red-600' : 'text-emerald-600'
              }`}>
                High Risk Customers
              </p>
              <p className={`text-2xl font-bold ${
                reportData.summary.customers_exceeding_threshold > 0 ? 'text-red-900' : 'text-emerald-900'
              }`}>
                {reportData.summary.customers_exceeding_threshold}
              </p>
            </div>
            {reportData.summary.customers_exceeding_threshold > 0 ? (
              <TrendingUp className="h-8 w-8 text-red-600" />
            ) : (
              <TrendingDown className="h-8 w-8 text-emerald-600" />
            )}
          </div>
          <div className="mt-4">
            <span className={`text-sm ${
              reportData.summary.customers_exceeding_threshold > 0 ? 'text-red-700' : 'text-emerald-700'
            }`}>
              Threshold: {formatCurrencySync(riskThreshold)}
            </span>
          </div>
        </div>

        <div className="bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg p-6 border border-purple-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-purple-600">Active Customers</p>
              <p className="text-2xl font-bold text-purple-900">
                {reportData.summary.customers_with_deposits}
              </p>
            </div>
            <Users className="h-8 w-8 text-purple-600" />
          </div>
          <div className="mt-4">
            <span className="text-sm text-purple-700">
              With outstanding deposits
            </span>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BarChart
          data={agingBarChartData}
          title="Aging Analysis by Days Outstanding"
          height={300}
        />
        
        <PieChart
          data={riskPieChartData}
          title="Customer Risk Level Distribution"
          size={280}
        />
      </div>

      {/* Data Table */}
      <DataTable
        data={reportData.data}
        columns={tableColumns}
        title="Customer Deposit Details"
        rowsPerPage={20}
      />

      {/* Pagination info */}
      {reportData.totalPages > 1 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>
              Showing page {reportData.currentPage} of {reportData.totalPages} 
              ({reportData.totalCount} total records)
            </span>
            {reportData.currentPage < reportData.totalPages && (
              <button
                onClick={() => handleFilterChange('page', filters.page! + 1)}
                className="text-blue-600 hover:text-blue-700"
              >
                Load more data
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};