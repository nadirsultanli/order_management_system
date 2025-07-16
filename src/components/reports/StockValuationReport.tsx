import React, { useState, useMemo } from 'react';
import { Download, Filter, RefreshCw, Warehouse, Package, BarChart3, PieChart as PieChartIcon, FileText } from 'lucide-react';
import { 
  useStockValuationReport, 
  useWarehousesForReports,
  generateStockValuationCSV,
  generateStockValuationPDF,
  downloadCSV,
  downloadPDF,
  formatReportFilename 
} from '../../hooks/useReports';
import { BarChart } from './BarChart';
import { PieChart } from './PieChart';
import { DataTable } from './DataTable';
import { StockValuationParams, BarChartData, PieChartData, TableColumn } from '../../types/reports';
import { formatCurrencySync } from '../../utils/pricing';

interface StockValuationReportProps {
  dateRange: { start: string; end: string };
  className?: string;
}

export const StockValuationReport: React.FC<StockValuationReportProps> = ({
  dateRange,
  className = '',
}) => {
  // State for filters
  const [filters, setFilters] = useState<StockValuationParams>({
    warehouse_id: undefined,
    product_id: undefined,
    group_by: 'warehouse',
    include_summary: true,
    page: 1,
    limit: 100,
  });

  const [showFilters, setShowFilters] = useState(false);

  // Fetch data
  const { 
    data: reportData, 
    isLoading, 
    error, 
    refetch 
  } = useStockValuationReport(filters);

  const { data: warehouses = [] } = useWarehousesForReports();

  // Prepare chart data
  const barChartData: BarChartData[] = useMemo(() => {
    if (!reportData?.grouped_data) return [];
    
    return reportData.grouped_data.map(group => ({
      warehouse_name: group.warehouse_name || 'Unknown',
      full_value: group.items.reduce((sum, item) => sum + item.full_valuation, 0),
      empty_value: group.items.reduce((sum, item) => sum + item.empty_valuation, 0),
      total_value: group.total_valuation,
    }));
  }, [reportData]);

  const pieChartData: PieChartData[] = useMemo(() => {
    if (!reportData?.summary) return [];

    const fullValue = reportData.summary.full_valuation;
    const emptyValue = reportData.summary.empty_valuation;
    const total = fullValue + emptyValue;

    if (total === 0) return [];

    return [
      {
        name: 'Full Cylinders',
        value: fullValue,
        percentage: Math.round((fullValue / total) * 100),
        fill: '#3B82F6', // blue-500
      },
      {
        name: 'Empty Cylinders',
        value: emptyValue,
        percentage: Math.round((emptyValue / total) * 100),
        fill: '#9CA3AF', // gray-400
      },
    ];
  }, [reportData]);

  // Table columns
  const tableColumns: TableColumn[] = [
    { key: 'warehouse_name', label: 'Warehouse', sortable: true },
    { key: 'product_name', label: 'Product', sortable: true },
    { key: 'product_sku', label: 'SKU', sortable: true },
    { 
      key: 'capacity_kg', 
      label: 'Capacity (kg)', 
      sortable: true, 
      align: 'right',
      formatter: (value: number) => `${value} kg`
    },
    { key: 'qty_full', label: 'Full Qty', sortable: true, align: 'right' },
    { key: 'qty_empty', label: 'Empty Qty', sortable: true, align: 'right' },
    { key: 'total_cylinders', label: 'Total Qty', sortable: true, align: 'right' },
    { 
      key: 'standard_cost', 
      label: 'Unit Cost', 
      sortable: true, 
      align: 'right',
      formatter: (value: number) => formatCurrencySync(value)
    },
    { 
      key: 'full_valuation', 
      label: 'Full Value', 
      sortable: true, 
      align: 'right',
      formatter: (value: number) => formatCurrencySync(value)
    },
    { 
      key: 'empty_valuation', 
      label: 'Empty Value', 
      sortable: true, 
      align: 'right',
      formatter: (value: number) => formatCurrencySync(value)
    },
    { 
      key: 'total_valuation', 
      label: 'Total Value', 
      sortable: true, 
      align: 'right',
      formatter: (value: number) => formatCurrencySync(value)
    },
  ];

  // Handle filter changes
  const handleFilterChange = (key: keyof StockValuationParams, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value, page: 1 }));
  };

  // Handle CSV export
  const handleExportCSV = () => {
    if (!reportData) return;
    
    const csvContent = generateStockValuationCSV(reportData, dateRange);
    const filename = formatReportFilename('stock-valuation', dateRange, 'csv');
    downloadCSV(csvContent, filename);
  };

  // Handle PDF export
  const handleExportPDF = () => {
    if (!reportData) return;
    
    const htmlContent = generateStockValuationPDF(reportData, dateRange);
    const filename = formatReportFilename('stock-valuation', dateRange, 'pdf');
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
            <BarChart3 className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-base font-medium text-red-800">Failed to load stock valuation report</h3>
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
        <BarChart3 className="h-16 w-16 text-gray-400 mx-auto mb-4" />
        <h4 className="text-lg font-medium text-gray-900 mb-2">No stock valuation data</h4>
        <p className="text-gray-600">No inventory data found for the current filters.</p>
        <button
          onClick={() => setFilters(prev => ({ ...prev, warehouse_id: undefined, product_id: undefined }))}
          className="mt-4 inline-flex items-center space-x-2 text-blue-600 hover:text-blue-700"
        >
          <RefreshCw className="h-4 w-4" />
          <span>Clear filters</span>
        </button>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header with filters and export */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Stock Valuation Analysis</h3>
          <p className="text-gray-600">
            Comprehensive overview of cylinder inventory values and movement as of {reportData.as_of_date}
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center space-x-2 px-4 py-2 border rounded-lg transition-colors ${
              showFilters || filters.warehouse_id || filters.product_id
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Group By
              </label>
              <select
                value={filters.group_by || 'warehouse'}
                onChange={(e) => handleFilterChange('group_by', e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="warehouse">Warehouse</option>
                <option value="product">Product</option>
                <option value="cylinder_type">Cylinder Type</option>
              </select>
            </div>
            
            <div className="flex items-end">
              <button
                onClick={() => setFilters(prev => ({ 
                  ...prev, 
                  warehouse_id: undefined, 
                  product_id: undefined,
                  page: 1 
                }))}
                className="w-full px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      {reportData.summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-6 border border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600">Total Stock Value</p>
                <p className="text-2xl font-bold text-blue-900">
                  {formatCurrencySync(reportData.summary.total_valuation)}
                </p>
              </div>
              <BarChart3 className="h-8 w-8 text-blue-600" />
            </div>
            <div className="mt-4">
              <span className="text-sm text-blue-700">
                {reportData.summary.total_warehouses} warehouse{reportData.summary.total_warehouses !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          <div className="bg-gradient-to-r from-green-50 to-green-100 rounded-lg p-6 border border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600">Total Cylinders</p>
                <p className="text-2xl font-bold text-green-900">
                  {reportData.summary.total_cylinders.toLocaleString()}
                </p>
              </div>
              <Package className="h-8 w-8 text-green-600" />
            </div>
            <div className="mt-4">
              <span className="text-sm text-green-700">
                {reportData.summary.total_products} product{reportData.summary.total_products !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          <div className="bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg p-6 border border-purple-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-600">Full Cylinders</p>
                <p className="text-2xl font-bold text-purple-900">
                  {reportData.summary.total_full_cylinders.toLocaleString()}
                </p>
              </div>
              <Warehouse className="h-8 w-8 text-purple-600" />
            </div>
            <div className="mt-4">
              <span className="text-sm text-purple-700">
                {formatCurrencySync(reportData.summary.full_valuation)} value
              </span>
            </div>
          </div>

          <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Empty Cylinders</p>
                <p className="text-2xl font-bold text-gray-900">
                  {reportData.summary.total_empty_cylinders.toLocaleString()}
                </p>
              </div>
              <Package className="h-8 w-8 text-gray-600" />
            </div>
            <div className="mt-4">
              <span className="text-sm text-gray-700">
                {formatCurrencySync(reportData.summary.empty_valuation)} value
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BarChart
          data={barChartData}
          title="Inventory Value by Warehouse"
          height={300}
        />
        
        <PieChart
          data={pieChartData}
          title="Full vs Empty Cylinder Distribution"
          size={280}
        />
      </div>

      {/* Data Table */}
      <DataTable
        data={reportData.data}
        columns={tableColumns}
        title="Detailed Stock Valuation"
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