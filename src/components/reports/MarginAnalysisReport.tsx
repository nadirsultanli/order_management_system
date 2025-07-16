import React, { useState, useMemo } from 'react';
import { Download, Filter, RefreshCw, TrendingUp, TrendingDown, DollarSign, Package, Users, BarChart3, PieChart as PieChartIcon, FileText, AlertTriangle } from 'lucide-react';
import { 
  useMarginAnalysisReport, 
  useWarehousesForReports,
  useProductsForReports,
  useCustomersForReports,
  downloadCSV,
  downloadPDF,
  formatReportFilename 
} from '../../hooks/useReports';
import { BarChart } from './BarChart';
import { PieChart } from './PieChart';
import { DataTable } from './DataTable';
import { MarginAnalysisParams, BarChartData, PieChartData, TableColumn } from '../../types/reports';
import { formatCurrencySync } from '../../utils/pricing';

interface MarginAnalysisReportProps {
  dateRange: { start: string; end: string };
  className?: string;
}

export const MarginAnalysisReport: React.FC<MarginAnalysisReportProps> = ({
  dateRange,
  className = '',
}) => {
  // State for filters
  const [filters, setFilters] = useState<MarginAnalysisParams>({
    order_type: 'all',
    product_id: undefined,
    customer_id: undefined,
    warehouse_id: undefined,
    group_by: 'order_type',
    include_costs_breakdown: true,
    start_date: dateRange.start,
    end_date: dateRange.end,
    page: 1,
    limit: 100,
  });

  const [showFilters, setShowFilters] = useState(false);
  const [marginTarget, setMarginTarget] = useState<number>(30);

  // Update filters when dateRange changes
  React.useEffect(() => {
    setFilters(prev => ({
      ...prev,
      start_date: dateRange.start,
      end_date: dateRange.end,
      page: 1,
    }));
  }, [dateRange]);

  // Fetch data
  const { 
    data: reportData, 
    isLoading, 
    error, 
    refetch 
  } = useMarginAnalysisReport(filters);

  const { data: warehouses = [] } = useWarehousesForReports();
  const { data: products = [] } = useProductsForReports();
  const { data: customers = [] } = useCustomersForReports();

  // Prepare margin vs costs bar chart data
  const marginBarChartData: BarChartData[] = useMemo(() => {
    if (!reportData?.grouped_data) return [];
    
    return reportData.grouped_data.map(group => ({
      warehouse_name: group.order_type || group.product_id || group.customer_id || 'Unknown',
      full_value: group.revenue,
      empty_value: group.cogs,
      total_value: group.gross_margin,
    }));
  }, [reportData]);

  // Prepare costs breakdown pie chart data
  const costsBreakdownData: PieChartData[] = useMemo(() => {
    if (!reportData?.summary) return [];

    const gasFileCosts = reportData.summary.total_gas_fill_costs;
    const handlingCosts = reportData.summary.total_handling_costs;
    const total = gasFileCosts + handlingCosts;

    if (total === 0) return [];

    return [
      {
        name: 'Gas Fill Costs',
        value: gasFileCosts,
        percentage: Math.round((gasFileCosts / total) * 100),
        fill: '#EF4444', // red-500
      },
      {
        name: 'Cylinder Handling',
        value: handlingCosts,
        percentage: Math.round((handlingCosts / total) * 100),
        fill: '#F59E0B', // amber-500
      },
    ];
  }, [reportData]);

  // Prepare order type comparison data
  const orderTypeComparisonData: PieChartData[] = useMemo(() => {
    if (!reportData?.grouped_data || filters.group_by !== 'order_type') return [];

    return reportData.grouped_data.map((group, index) => ({
      name: group.order_type || 'Unknown',
      value: group.gross_margin,
      percentage: Math.round((group.gross_margin / reportData.summary.total_gross_margin) * 100),
      fill: index === 0 ? '#3B82F6' : index === 1 ? '#10B981' : '#8B5CF6', // blue, green, purple
    }));
  }, [reportData, filters.group_by]);

  // Table columns
  const tableColumns: TableColumn[] = [
    { key: 'order_id', label: 'Order ID', sortable: true },
    { key: 'order_type', label: 'Type', sortable: true },
    { key: 'order_date', label: 'Date', sortable: true, formatter: (value: string) => new Date(value).toLocaleDateString() },
    { key: 'customer_name', label: 'Customer', sortable: true },
    { key: 'product_name', label: 'Product', sortable: true },
    { key: 'quantity', label: 'Qty', sortable: true, align: 'right' },
    { 
      key: 'revenue', 
      label: 'Revenue', 
      sortable: true, 
      align: 'right',
      formatter: (value: number) => formatCurrencySync(value)
    },
    { 
      key: 'gas_fill_cost', 
      label: 'Gas Cost', 
      sortable: true, 
      align: 'right',
      formatter: (value: number) => formatCurrencySync(value)
    },
    { 
      key: 'cylinder_handling_cost', 
      label: 'Handling Cost', 
      sortable: true, 
      align: 'right',
      formatter: (value: number) => formatCurrencySync(value)
    },
    { 
      key: 'total_cogs', 
      label: 'Total COGS', 
      sortable: true, 
      align: 'right',
      formatter: (value: number) => formatCurrencySync(value)
    },
    { 
      key: 'gross_margin', 
      label: 'Gross Margin', 
      sortable: true, 
      align: 'right',
      formatter: (value: number) => formatCurrencySync(value)
    },
    { 
      key: 'margin_percentage', 
      label: 'Margin %', 
      sortable: true, 
      align: 'right',
      formatter: (value: number) => `${value.toFixed(1)}%`
    },
  ];

  // Handle filter changes
  const handleFilterChange = (key: keyof MarginAnalysisParams, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value, page: 1 }));
  };

  // Generate CSV export content
  const generateMarginAnalysisCSV = () => {
    if (!reportData) return '';
    
    const headers = [
      'Order ID',
      'Order Type',
      'Order Date',
      'Customer',
      'Product',
      'Quantity',
      'Revenue',
      'Gas Fill Cost',
      'Cylinder Handling Cost',
      'Total COGS',
      'Gross Margin',
      'Margin Percentage',
    ];

    const rows = reportData.data.map(item => [
      item.order_id,
      item.order_type,
      item.order_date,
      item.customer_name,
      item.product_name,
      item.quantity.toString(),
      item.revenue.toFixed(2),
      item.gas_fill_cost.toFixed(2),
      item.cylinder_handling_cost.toFixed(2),
      item.total_cogs.toFixed(2),
      item.gross_margin.toFixed(2),
      item.margin_percentage.toFixed(2),
    ]);

    const csvContent = [
      ['Margin Analysis Report'],
      [`Period: ${dateRange.start} to ${dateRange.end}`],
      [`Generated: ${new Date().toISOString()}`],
      [`Margin Target: ${marginTarget}%`],
      [],
      headers,
      ...rows,
      [],
      // Summary section
      ['SUMMARY'],
      ['Total Revenue', reportData.summary.total_revenue.toFixed(2)],
      ['Total COGS', reportData.summary.total_cogs.toFixed(2)],
      ['Gas Fill Costs', reportData.summary.total_gas_fill_costs.toFixed(2)],
      ['Handling Costs', reportData.summary.total_handling_costs.toFixed(2)],
      ['Total Gross Margin', reportData.summary.total_gross_margin.toFixed(2)],
      ['Average Margin %', reportData.summary.average_margin_percentage.toFixed(2)],
      ['Order Count', reportData.summary.order_count.toString()],
    ].filter(row => row.length > 0).map(row => row.join(',')).join('\n');

    return csvContent;
  };

  // Generate PDF export content
  const generateMarginAnalysisPDF = () => {
    if (!reportData) return '';
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Margin Analysis Report</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; color: #333; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #ddd; padding-bottom: 20px; }
            .title { font-size: 24px; font-weight: bold; margin-bottom: 10px; }
            .subtitle { color: #666; font-size: 14px; }
            .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 30px 0; }
            .summary-card { border: 1px solid #ddd; padding: 15px; border-radius: 8px; text-align: center; }
            .summary-value { font-size: 18px; font-weight: bold; margin-bottom: 5px; }
            .summary-label { font-size: 12px; color: #666; }
            .insights { background: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 8px; margin: 20px 0; }
            .insight-title { font-weight: bold; margin-bottom: 10px; color: #374151; }
            .insight-item { margin-bottom: 5px; color: #6b7280; }
            table { width: 100%; border-collapse: collapse; margin-top: 30px; font-size: 11px; }
            th, td { border: 1px solid #ddd; padding: 6px; text-align: left; }
            th { background-color: #f5f5f5; font-weight: bold; }
            .text-right { text-align: right; }
            .below-target { background-color: #fef2f2; }
            .above-target { background-color: #f0fdf4; }
            .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #666; font-size: 12px; }
            @media print {
              body { margin: 20px; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">Profitability & Margin Analysis Report</div>
            <div class="subtitle">
              Period: ${dateRange.start} to ${dateRange.end}
              <br>Margin Target: ${marginTarget}%
              <br>Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}
            </div>
          </div>

          <div class="summary">
            <div class="summary-card">
              <div class="summary-value">Ksh ${reportData.summary.total_revenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
              <div class="summary-label">Total Revenue</div>
            </div>
            <div class="summary-card">
              <div class="summary-value">Ksh ${reportData.summary.total_gross_margin.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
              <div class="summary-label">Gross Margin</div>
            </div>
            <div class="summary-card">
              <div class="summary-value">${reportData.summary.average_margin_percentage.toFixed(1)}%</div>
              <div class="summary-label">Average Margin %</div>
            </div>
            <div class="summary-card">
              <div class="summary-value">${reportData.summary.order_count.toLocaleString()}</div>
              <div class="summary-label">Total Orders</div>
            </div>
          </div>

          <div class="insights">
            <div class="insight-title">📊 Key Insights & Recommendations</div>
            <div class="insight-item">• Gas fill costs represent ${reportData.costs_breakdown ? ((reportData.summary.total_gas_fill_costs / reportData.summary.total_cogs) * 100).toFixed(1) : 'N/A'}% of total COGS</div>
            <div class="insight-item">• Cylinder handling costs represent ${reportData.costs_breakdown ? ((reportData.summary.total_handling_costs / reportData.summary.total_cogs) * 100).toFixed(1) : 'N/A'}% of total COGS</div>
            <div class="insight-item">• Current margin ${reportData.summary.average_margin_percentage > marginTarget ? 'exceeds' : 'falls below'} target of ${marginTarget}%</div>
            <div class="insight-item">• ${reportData.data.filter(item => item.margin_percentage < marginTarget).length} orders below margin target require attention</div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Type</th>
                <th>Customer</th>
                <th>Product</th>
                <th class="text-right">Qty</th>
                <th class="text-right">Revenue</th>
                <th class="text-right">COGS</th>
                <th class="text-right">Margin</th>
                <th class="text-right">Margin %</th>
              </tr>
            </thead>
            <tbody>
              ${reportData.data.slice(0, 50).map(item => `
                <tr class="${item.margin_percentage < marginTarget ? 'below-target' : 'above-target'}">
                  <td>${item.order_id}</td>
                  <td>${item.order_type}</td>
                  <td>${item.customer_name}</td>
                  <td>${item.product_name}</td>
                  <td class="text-right">${item.quantity}</td>
                  <td class="text-right">Ksh ${item.revenue.toFixed(2)}</td>
                  <td class="text-right">Ksh ${item.total_cogs.toFixed(2)}</td>
                  <td class="text-right">Ksh ${item.gross_margin.toFixed(2)}</td>
                  <td class="text-right">${item.margin_percentage.toFixed(1)}%</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="footer">
            <p>This report was generated by the Order Management System</p>
            <p>Showing top 50 records | Total records: ${reportData.data.length}</p>
            <p><strong>Legend:</strong> Green = Above target margin | Red = Below target margin</p>
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
    const csvContent = generateMarginAnalysisCSV();
    const filename = formatReportFilename('margin-analysis', dateRange, 'csv');
    downloadCSV(csvContent, filename);
  };

  // Handle PDF export
  const handleExportPDF = () => {
    const htmlContent = generateMarginAnalysisPDF();
    const filename = formatReportFilename('margin-analysis', dateRange, 'pdf');
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
            <TrendingUp className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-base font-medium text-red-800">Failed to load margin analysis report</h3>
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
        <TrendingUp className="h-16 w-16 text-gray-400 mx-auto mb-4" />
        <h4 className="text-lg font-medium text-gray-900 mb-2">No margin analysis data</h4>
        <p className="text-gray-600">No orders found for the current filters and date range.</p>
        <button
          onClick={() => setFilters(prev => ({ 
            ...prev, 
            order_type: 'all',
            product_id: undefined, 
            customer_id: undefined,
            warehouse_id: undefined,
            page: 1 
          }))}
          className="mt-4 inline-flex items-center space-x-2 text-blue-600 hover:text-blue-700"
        >
          <RefreshCw className="h-4 w-4" />
          <span>Clear filters</span>
        </button>
      </div>
    );
  }

  const averageMargin = reportData.summary.average_margin_percentage;
  const isAboveTarget = averageMargin >= marginTarget;

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header with filters and export */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Margin Analysis & Profitability</h3>
          <p className="text-gray-600">
            Gas fill revenue analysis and cost breakdown for {reportData.data.length} orders
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700">Target:</label>
            <input
              type="number"
              value={marginTarget}
              onChange={(e) => setMarginTarget(Number(e.target.value))}
              className="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              min="0"
              max="100"
            />
            <span className="text-sm text-gray-600">%</span>
          </div>
          
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center space-x-2 px-4 py-2 border rounded-lg transition-colors ${
              showFilters || filters.order_type !== 'all' || filters.product_id || filters.customer_id || filters.warehouse_id
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Order Type
              </label>
              <select
                value={filters.order_type || 'all'}
                onChange={(e) => handleFilterChange('order_type', e.target.value as any)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Types</option>
                <option value="FULL-OUT">FULL-OUT</option>
                <option value="FULL-XCH">FULL-XCH</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Product
              </label>
              <select
                value={filters.product_id || ''}
                onChange={(e) => handleFilterChange('product_id', e.target.value || undefined)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Products</option>
                {products.map(product => (
                  <option key={product.id} value={product.id}>
                    {product.label}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Customer
              </label>
              <select
                value={filters.customer_id || ''}
                onChange={(e) => handleFilterChange('customer_id', e.target.value || undefined)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Customers</option>
                {customers.map(customer => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Warehouse
              </label>
              <select
                value={filters.warehouse_id || ''}
                onChange={(e) => handleFilterChange('warehouse_id', e.target.value || undefined)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Warehouses</option>
                {warehouses.map(warehouse => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="mt-4 flex items-center justify-between">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Group By
              </label>
              <select
                value={filters.group_by || 'order_type'}
                onChange={(e) => handleFilterChange('group_by', e.target.value as any)}
                className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="order_type">Order Type</option>
                <option value="product">Product</option>
                <option value="customer">Customer</option>
                <option value="date">Date</option>
              </select>
            </div>
            
            <button
              onClick={() => setFilters(prev => ({ 
                ...prev, 
                order_type: 'all',
                product_id: undefined, 
                customer_id: undefined,
                warehouse_id: undefined,
                page: 1 
              }))}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Clear Filters
            </button>
          </div>
        </div>
      )}

      {/* Performance Alert */}
      {!isAboveTarget && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <div>
              <h4 className="text-sm font-medium text-amber-800">Margin Below Target</h4>
              <p className="text-sm text-amber-700">
                Current margin of {averageMargin.toFixed(1)}% is below the target of {marginTarget}%. 
                Consider reviewing pricing strategy or cost optimization.
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
              <p className="text-sm font-medium text-blue-600">Total Revenue</p>
              <p className="text-2xl font-bold text-blue-900">
                {formatCurrencySync(reportData.summary.total_revenue)}
              </p>
            </div>
            <DollarSign className="h-8 w-8 text-blue-600" />
          </div>
          <div className="mt-4">
            <span className="text-sm text-blue-700">
              {reportData.summary.order_count} orders
            </span>
          </div>
        </div>

        <div className={`bg-gradient-to-r ${isAboveTarget ? 'from-green-50 to-green-100' : 'from-red-50 to-red-100'} rounded-lg p-6 border ${isAboveTarget ? 'border-green-200' : 'border-red-200'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm font-medium ${isAboveTarget ? 'text-green-600' : 'text-red-600'}`}>Average Margin</p>
              <p className={`text-2xl font-bold ${isAboveTarget ? 'text-green-900' : 'text-red-900'}`}>
                {averageMargin.toFixed(1)}%
              </p>
            </div>
            {isAboveTarget ? (
              <TrendingUp className="h-8 w-8 text-green-600" />
            ) : (
              <TrendingDown className="h-8 w-8 text-red-600" />
            )}
          </div>
          <div className="mt-4">
            <span className={`text-sm ${isAboveTarget ? 'text-green-700' : 'text-red-700'}`}>
              Target: {marginTarget}%
            </span>
          </div>
        </div>

        <div className="bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg p-6 border border-purple-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-purple-600">Gross Margin</p>
              <p className="text-2xl font-bold text-purple-900">
                {formatCurrencySync(reportData.summary.total_gross_margin)}
              </p>
            </div>
            <BarChart3 className="h-8 w-8 text-purple-600" />
          </div>
          <div className="mt-4">
            <span className="text-sm text-purple-700">
              Total profit
            </span>
          </div>
        </div>

        <div className="bg-gradient-to-r from-orange-50 to-orange-100 rounded-lg p-6 border border-orange-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-orange-600">Total COGS</p>
              <p className="text-2xl font-bold text-orange-900">
                {formatCurrencySync(reportData.summary.total_cogs)}
              </p>
            </div>
            <Package className="h-8 w-8 text-orange-600" />
          </div>
          <div className="mt-4">
            <span className="text-sm text-orange-700">
              Gas + Handling costs
            </span>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BarChart
          data={marginBarChartData}
          title={`Revenue vs Costs by ${filters.group_by?.replace('_', ' ') || 'Order Type'}`}
          height={300}
        />
        
        {costsBreakdownData.length > 0 && (
          <PieChart
            data={costsBreakdownData}
            title="COGS Breakdown"
            size={280}
          />
        )}
        
        {orderTypeComparisonData.length > 0 && filters.group_by === 'order_type' && (
          <PieChart
            data={orderTypeComparisonData}
            title="Margin by Order Type"
            size={280}
          />
        )}
      </div>

      {/* Data Table */}
      <DataTable
        data={reportData.data}
        columns={tableColumns}
        title="Detailed Margin Analysis"
        rowsPerPage={20}
      />

      {/* Performance Summary */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h4 className="text-lg font-semibold text-gray-900 mb-4">Performance Summary</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {reportData.data.filter(item => item.margin_percentage >= marginTarget).length}
            </div>
            <div className="text-sm text-gray-600">Orders Above Target</div>
            <div className="text-xs text-gray-500 mt-1">
              {((reportData.data.filter(item => item.margin_percentage >= marginTarget).length / reportData.data.length) * 100).toFixed(1)}% of total
            </div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">
              {reportData.data.filter(item => item.margin_percentage < marginTarget).length}
            </div>
            <div className="text-sm text-gray-600">Orders Below Target</div>
            <div className="text-xs text-gray-500 mt-1">
              Need attention
            </div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {reportData.costs_breakdown ? ((reportData.summary.total_gas_fill_costs / reportData.summary.total_cogs) * 100).toFixed(1) : 'N/A'}%
            </div>
            <div className="text-sm text-gray-600">Gas Fill Cost Ratio</div>
            <div className="text-xs text-gray-500 mt-1">
              Of total COGS
            </div>
          </div>
        </div>
      </div>

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