import { useQuery } from '@tanstack/react-query';
import { trpc } from '../lib/trpc-client';
import {
  StockValuationReport,
  StockValuationParams,
  DepositAnalysisReport,
  DepositAnalysisParams,
  MarginAnalysisReport,
  MarginAnalysisParams,
  OperationalKPIReport,
  OperationalKPIParams,
  DashboardSummary,
} from '../types/reports';

// ============ Stock Valuation Report Hooks ============

export const useStockValuationReport = (params: StockValuationParams) => {
  return useQuery({
    queryKey: ['reports', 'stock-valuation', params],
    queryFn: async (): Promise<StockValuationReport> => {
      const response = await trpc.reports.getStockValuation.query({
        warehouse_id: params.warehouse_id,
        product_id: params.product_id,
        as_of_date: params.as_of_date,
        include_summary: params.include_summary ?? true,
        group_by: params.group_by ?? 'warehouse',
        page: params.page ?? 1,
        limit: params.limit ?? 100,
      });
      return response;
    },
    enabled: Boolean(params),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });
};

// ============ Deposit Analysis Report Hooks ============

export const useDepositAnalysisReport = (params: DepositAnalysisParams) => {
  return useQuery({
    queryKey: ['reports', 'deposit-analysis', params],
    queryFn: async (): Promise<DepositAnalysisReport> => {
      const response = await trpc.reports.getDepositAnalysis.query({
        customer_id: params.customer_id,
        aging_buckets: params.aging_buckets ?? true,
        include_zero_balances: params.include_zero_balances ?? false,
        min_days_outstanding: params.min_days_outstanding,
        threshold_amount: params.threshold_amount,
        as_of_date: params.as_of_date,
        start_date: params.start_date,
        end_date: params.end_date,
        page: params.page ?? 1,
        limit: params.limit ?? 100,
      });
      return response;
    },
    enabled: Boolean(params.start_date && params.end_date),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });
};

// ============ Margin Analysis Report Hooks ============

export const useMarginAnalysisReport = (params: MarginAnalysisParams) => {
  return useQuery({
    queryKey: ['reports', 'margin-analysis', params],
    queryFn: async (): Promise<MarginAnalysisReport> => {
      const response = await trpc.reports.getMarginAnalysis.query({
        order_type: params.order_type ?? 'all',
        product_id: params.product_id,
        customer_id: params.customer_id,
        warehouse_id: params.warehouse_id,
        group_by: params.group_by ?? 'order_type',
        include_costs_breakdown: params.include_costs_breakdown ?? true,
        start_date: params.start_date,
        end_date: params.end_date,
        page: params.page ?? 1,
        limit: params.limit ?? 100,
      });
      return response;
    },
    enabled: Boolean(params.start_date && params.end_date),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });
};

// ============ Operational KPIs Report Hooks ============

export const useOperationalKPIReport = (params: OperationalKPIParams) => {
  return useQuery({
    queryKey: ['reports', 'operational-kpis', params],
    queryFn: async (): Promise<OperationalKPIReport> => {
      const response = await trpc.reports.getOperationalKPIs.query({
        customer_id: params.customer_id,
        product_capacity: params.product_capacity,
        include_trends: params.include_trends ?? true,
        kpi_types: params.kpi_types ?? ['return_rates', 'deposit_liability', 'lost_cylinders', 'aging'],
        start_date: params.start_date,
        end_date: params.end_date,
        page: params.page ?? 1,
        limit: params.limit ?? 100,
      });
      return response;
    },
    enabled: Boolean(params.start_date && params.end_date),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });
};

// ============ Dashboard Summary Hook ============

export const useReportsDashboardSummary = (periodDays: number = 30) => {
  return useQuery({
    queryKey: ['reports', 'dashboard-summary', periodDays],
    queryFn: async (): Promise<DashboardSummary> => {
      const response = await trpc.reports.getDashboardSummary.query({
        period_days: periodDays,
      });
      return response;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchOnWindowFocus: false,
  });
};

// ============ Utility Hooks for Filters ============

// Hook to get unique warehouses for filtering
export const useWarehousesForReports = () => {
  return useQuery({
    queryKey: ['warehouses', 'for-reports'],
    queryFn: async () => {
      try {
        const response = await trpc.warehouses.list.query();
        return response.warehouses.map((warehouse: any) => ({
          id: warehouse.id,
          name: warehouse.name,
          label: warehouse.name,
          value: warehouse.id,
        }));
      } catch (error) {
        console.error('Failed to fetch warehouses for reports:', error);
        return [];
      }
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
  });
};

// Hook to get unique products for filtering
export const useProductsForReports = () => {
  return useQuery({
    queryKey: ['products', 'for-reports'],
    queryFn: async () => {
      try {
        const response = await trpc.products.list.query();
        return response.products.map((product: any) => ({
          id: product.id,
          name: product.name,
          sku: product.sku,
          capacity_kg: product.capacity_kg,
          label: `${product.name} (${product.sku})`,
          value: product.id,
        }));
      } catch (error) {
        console.error('Failed to fetch products for reports:', error);
        return [];
      }
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
  });
};

// Hook to get unique customers for filtering
export const useCustomersForReports = () => {
  return useQuery({
    queryKey: ['customers', 'for-reports'],
    queryFn: async () => {
      try {
        const response = await trpc.customers.list.query();
        return response.customers.map((customer: any) => ({
          id: customer.id,
          name: customer.name,
          label: customer.name,
          value: customer.id,
        }));
      } catch (error) {
        console.error('Failed to fetch customers for reports:', error);
        return [];
      }
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
  });
};

// ============ Export Utility Functions ============

export const generateStockValuationCSV = (data: StockValuationReport, dateRange?: { start: string; end: string }) => {
  const headers = [
    'Warehouse',
    'Product Name',
    'Product SKU',
    'Capacity (kg)',
    'Full Cylinders',
    'Empty Cylinders',
    'Total Cylinders',
    'Standard Cost',
    'Full Valuation',
    'Empty Valuation',
    'Total Valuation',
  ];

  const rows = data.data.map(item => [
    item.warehouse_name,
    item.product_name,
    item.product_sku,
    item.capacity_kg.toString(),
    item.qty_full.toString(),
    item.qty_empty.toString(),
    item.total_cylinders.toString(),
    item.standard_cost.toFixed(2),
    item.full_valuation.toFixed(2),
    item.empty_valuation.toFixed(2),
    item.total_valuation.toFixed(2),
  ]);

  const csvContent = [
    ['Stock Valuation Report'],
    [`As of Date: ${data.as_of_date}`],
    dateRange ? [`Period: ${dateRange.start} to ${dateRange.end}`] : [],
    [`Generated: ${new Date().toISOString()}`],
    [],
    headers,
    ...rows,
    [],
    // Summary section
    ['SUMMARY'],
    ['Total Warehouses', data.summary?.total_warehouses?.toString() || '0'],
    ['Total Products', data.summary?.total_products?.toString() || '0'],
    ['Total Full Cylinders', data.summary?.total_full_cylinders?.toString() || '0'],
    ['Total Empty Cylinders', data.summary?.total_empty_cylinders?.toString() || '0'],
    ['Total Cylinders', data.summary?.total_cylinders?.toString() || '0'],
    ['Total Valuation', data.summary?.total_valuation?.toFixed(2) || '0.00'],
  ].filter(row => row.length > 0).map(row => row.join(',')).join('\n');

  return csvContent;
};

export const downloadCSV = (content: string, filename: string) => {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const formatReportFilename = (reportType: string, dateRange?: { start: string; end: string }, format: 'csv' | 'pdf' = 'csv') => {
  const timestamp = new Date().toISOString().split('T')[0];
  const dateRangeStr = dateRange ? `_${dateRange.start}_to_${dateRange.end}` : `_${timestamp}`;
  return `${reportType.replace('-', '_')}_report${dateRangeStr}.${format}`;
};

// PDF Export utility - creates a printable HTML page
export const generateStockValuationPDF = (data: StockValuationReport, dateRange?: { start: string; end: string }) => {
  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Stock Valuation Report</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; color: #333; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #ddd; padding-bottom: 20px; }
          .title { font-size: 24px; font-weight: bold; margin-bottom: 10px; }
          .subtitle { color: #666; font-size: 14px; }
          .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 30px 0; }
          .summary-card { border: 1px solid #ddd; padding: 15px; border-radius: 8px; text-align: center; }
          .summary-value { font-size: 18px; font-weight: bold; margin-bottom: 5px; }
          .summary-label { font-size: 12px; color: #666; }
          table { width: 100%; border-collapse: collapse; margin-top: 30px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
          th { background-color: #f5f5f5; font-weight: bold; }
          .text-right { text-align: right; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #666; font-size: 12px; }
          @media print {
            body { margin: 20px; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">Stock Valuation Report</div>
          <div class="subtitle">
            As of: ${data.as_of_date}
            ${dateRange ? `<br>Period: ${dateRange.start} to ${dateRange.end}` : ''}
            <br>Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}
          </div>
        </div>

        ${data.summary ? `
        <div class="summary">
          <div class="summary-card">
            <div class="summary-value">Ksh ${data.summary.total_valuation.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
            <div class="summary-label">Total Stock Value</div>
          </div>
          <div class="summary-card">
            <div class="summary-value">${data.summary.total_cylinders.toLocaleString()}</div>
            <div class="summary-label">Total Cylinders</div>
          </div>
          <div class="summary-card">
            <div class="summary-value">${data.summary.total_full_cylinders.toLocaleString()}</div>
            <div class="summary-label">Full Cylinders</div>
          </div>
          <div class="summary-card">
            <div class="summary-value">${data.summary.total_empty_cylinders.toLocaleString()}</div>
            <div class="summary-label">Empty Cylinders</div>
          </div>
        </div>
        ` : ''}

        <table>
          <thead>
            <tr>
              <th>Warehouse</th>
              <th>Product Name</th>
              <th>SKU</th>
              <th>Capacity (kg)</th>
              <th class="text-right">Full Qty</th>
              <th class="text-right">Empty Qty</th>
              <th class="text-right">Total Qty</th>
              <th class="text-right">Unit Cost</th>
              <th class="text-right">Full Value</th>
              <th class="text-right">Empty Value</th>
              <th class="text-right">Total Value</th>
            </tr>
          </thead>
          <tbody>
            ${data.data.map(item => `
              <tr>
                <td>${item.warehouse_name}</td>
                <td>${item.product_name}</td>
                <td>${item.product_sku}</td>
                <td class="text-right">${item.capacity_kg}</td>
                <td class="text-right">${item.qty_full.toLocaleString()}</td>
                <td class="text-right">${item.qty_empty.toLocaleString()}</td>
                <td class="text-right">${item.total_cylinders.toLocaleString()}</td>
                <td class="text-right">Ksh ${item.standard_cost.toFixed(2)}</td>
                <td class="text-right">Ksh ${item.full_valuation.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                <td class="text-right">Ksh ${item.empty_valuation.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                <td class="text-right">Ksh ${item.total_valuation.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="footer">
          <p>This report was generated by the Order Management System</p>
          <p>Total records: ${data.data.length} | Page ${data.currentPage} of ${data.totalPages}</p>
        </div>

        <script>
          // Auto-print on load for PDF generation
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
    </html>
  `;

  return htmlContent;
};

export const downloadPDF = (htmlContent: string, filename: string) => {
  // Create a new window with the HTML content for printing
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    
    // Focus the window and trigger print
    printWindow.focus();
    
    // Note: This will open the browser's print dialog
    // Users can choose "Save as PDF" as the destination
    setTimeout(() => {
      printWindow.print();
    }, 500);
  } else {
    // Fallback: create a downloadable HTML file
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename.replace('.pdf', '.html');
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
};

// ============ Deposit Analysis Export Functions ============

export const generateDepositAnalysisCSV = (data: DepositAnalysisReport, dateRange?: { start: string; end: string }, riskThreshold: number = 50000) => {
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

  const rows = data.data.map(item => [
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
    [`As of Date: ${data.as_of_date}`],
    dateRange ? [`Period: ${dateRange.start} to ${dateRange.end}`] : [],
    [`Risk Threshold: KES ${riskThreshold.toFixed(2)}`],
    [`Generated: ${new Date().toISOString()}`],
    [],
    headers,
    ...rows,
    [],
    // Summary section
    ['SUMMARY'],
    ['Total Outstanding Amount', data.summary.total_outstanding_amount.toFixed(2)],
    ['Customers with Deposits', data.summary.customers_with_deposits.toString()],
    ['Total Cylinders on Deposit', data.summary.total_cylinders_on_deposit.toString()],
    ['Average Outstanding per Customer', data.summary.average_outstanding_per_customer.toFixed(2)],
    ['Customers Exceeding Threshold', data.summary.customers_exceeding_threshold.toString()],
    [],
    // Aging breakdown
    ['AGING BREAKDOWN'],
    ['Age Bucket', 'Customer Count', 'Total Amount', 'Cylinder Count'],
    ...(data.aging_breakdown?.map(bucket => [
      bucket.bucket,
      bucket.customer_count.toString(),
      bucket.total_amount.toFixed(2),
      bucket.cylinder_count.toString(),
    ]) || []),
  ].filter(row => row.length > 0).map(row => row.join(',')).join('\n');

  return csvContent;
};

// ============ Margin Analysis Export Functions ============

export const generateMarginAnalysisCSV = (data: MarginAnalysisReport, dateRange?: { start: string; end: string }, marginTarget: number = 30) => {
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

  const rows = data.data.map(item => [
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
    dateRange ? [`Period: ${dateRange.start} to ${dateRange.end}`] : [],
    [`Generated: ${new Date().toISOString()}`],
    [`Margin Target: ${marginTarget}%`],
    [],
    headers,
    ...rows,
    [],
    // Summary section
    ['SUMMARY'],
    ['Total Revenue', data.summary.total_revenue.toFixed(2)],
    ['Total COGS', data.summary.total_cogs.toFixed(2)],
    ['Gas Fill Costs', data.summary.total_gas_fill_costs.toFixed(2)],
    ['Handling Costs', data.summary.total_handling_costs.toFixed(2)],
    ['Total Gross Margin', data.summary.total_gross_margin.toFixed(2)],
    ['Average Margin %', data.summary.average_margin_percentage.toFixed(2)],
    ['Order Count', data.summary.order_count.toString()],
    [],
    // Performance analysis
    ['PERFORMANCE ANALYSIS'],
    ['Orders Above Target', data.data.filter(item => item.margin_percentage >= marginTarget).length.toString()],
    ['Orders Below Target', data.data.filter(item => item.margin_percentage < marginTarget).length.toString()],
    ['Above Target %', ((data.data.filter(item => item.margin_percentage >= marginTarget).length / data.data.length) * 100).toFixed(1)],
    ['Gas Fill Cost Ratio', data.costs_breakdown ? ((data.summary.total_gas_fill_costs / data.summary.total_cogs) * 100).toFixed(1) : 'N/A'],
    ['Handling Cost Ratio', data.costs_breakdown ? ((data.summary.total_handling_costs / data.summary.total_cogs) * 100).toFixed(1) : 'N/A'],
  ].filter(row => row.length > 0).map(row => row.join(',')).join('\n');

  return csvContent;
};

export const generateMarginAnalysisPDF = (data: MarginAnalysisReport, dateRange?: { start: string; end: string }, marginTarget: number = 30) => {
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
            ${dateRange ? `Period: ${dateRange.start} to ${dateRange.end}` : ''}
            <br>Margin Target: ${marginTarget}%
            <br>Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}
          </div>
        </div>

        <div class="summary">
          <div class="summary-card">
            <div class="summary-value">Ksh ${data.summary.total_revenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
            <div class="summary-label">Total Revenue</div>
          </div>
          <div class="summary-card">
            <div class="summary-value">Ksh ${data.summary.total_gross_margin.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
            <div class="summary-label">Gross Margin</div>
          </div>
          <div class="summary-card">
            <div class="summary-value">${data.summary.average_margin_percentage.toFixed(1)}%</div>
            <div class="summary-label">Average Margin %</div>
          </div>
          <div class="summary-card">
            <div class="summary-value">${data.summary.order_count.toLocaleString()}</div>
            <div class="summary-label">Total Orders</div>
          </div>
        </div>

        <div class="insights">
          <div class="insight-title">📊 Key Insights & Recommendations</div>
          <div class="insight-item">• Gas fill costs represent ${data.costs_breakdown ? ((data.summary.total_gas_fill_costs / data.summary.total_cogs) * 100).toFixed(1) : 'N/A'}% of total COGS</div>
          <div class="insight-item">• Cylinder handling costs represent ${data.costs_breakdown ? ((data.summary.total_handling_costs / data.summary.total_cogs) * 100).toFixed(1) : 'N/A'}% of total COGS</div>
          <div class="insight-item">• Current margin ${data.summary.average_margin_percentage > marginTarget ? 'exceeds' : 'falls below'} target of ${marginTarget}%</div>
          <div class="insight-item">• ${data.data.filter(item => item.margin_percentage < marginTarget).length} orders below margin target require attention</div>
          <div class="insight-item">• ${((data.data.filter(item => item.margin_percentage >= marginTarget).length / data.data.length) * 100).toFixed(1)}% of orders meet or exceed margin targets</div>
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
            ${data.data.slice(0, 50).map(item => `
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
          <p>Showing top 50 records | Total records: ${data.data.length}</p>
          <p><strong>Legend:</strong> Green = Above target margin | Red = Below target margin</p>
          <p><strong>Recommendations:</strong></p>
          <ul style="text-align: left; display: inline-block;">
            <li>Focus on optimizing gas fill costs which represent the largest portion of COGS</li>
            <li>Review pricing strategy for products/customers with consistently low margins</li>
            <li>Implement cost tracking to better understand cylinder handling expenses</li>
            <li>Consider volume discounts for high-margin customers to increase loyalty</li>
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

// ============ Operational KPIs Export Functions ============

export const generateOperationalKPIsCSV = (data: OperationalKPIReport, dateRange?: { start: string; end: string }) => {
  const headers = [
    'KPI Metric',
    'Current Value',
    'Unit',
    'Target',
    'Variance',
    'Trend Direction',
    'Performance Status',
  ];

  const rows = data.data.map(item => [
    item.metric_name,
    item.metric_value.toFixed(2),
    item.metric_unit || '',
    item.benchmark?.toFixed(2) || 'N/A',
    item.variance?.toFixed(2) || 'N/A',
    item.trend_direction,
    item.benchmark && item.metric_value >= item.benchmark ? 'Meeting Target' : 'Below Target',
  ]);

  const csvContent = [
    ['Operational KPIs Report'],
    dateRange ? [`Period: ${dateRange.start} to ${dateRange.end}`] : [],
    [`Generated: ${new Date().toISOString()}`],
    [],
    headers,
    ...rows,
    [],
    // Summary section
    ['SUMMARY'],
    ['Total Metrics', data.summary.total_metrics.toString()],
    ['Metrics with Benchmarks', data.summary.metrics_with_benchmarks.toString()],
    ['Metrics Meeting Benchmarks', data.summary.metrics_meeting_benchmarks.toString()],
    ['Overall Performance Score', `${((data.summary.metrics_meeting_benchmarks / data.summary.total_metrics) * 100).toFixed(1)}%`],
    [],
    // Trends section
    ...(data.trends ? [
      ['TRENDS ANALYSIS'],
      ['Period Comparison', data.trends.period_comparison],
      ['Metrics Improving', data.trends.metrics_improving.toString()],
      ['Metrics Declining', data.trends.metrics_declining.toString()],
      ['Metrics Stable', data.trends.metrics_stable.toString()],
    ] : []),
  ].filter(row => row.length > 0).map(row => row.join(',')).join('\n');

  return csvContent;
};

export const generateOperationalKPIsPDF = (data: OperationalKPIReport, dateRange?: { start: string; end: string }) => {
  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Operational KPIs Report</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; color: #333; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #ddd; padding-bottom: 20px; }
          .title { font-size: 24px; font-weight: bold; margin-bottom: 10px; }
          .subtitle { color: #666; font-size: 14px; }
          .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 30px 0; }
          .summary-card { border: 1px solid #ddd; padding: 15px; border-radius: 8px; text-align: center; }
          .summary-value { font-size: 18px; font-weight: bold; margin-bottom: 5px; }
          .summary-label { font-size: 12px; color: #666; }
          .insights { background: #f0f9ff; border: 1px solid #0ea5e9; padding: 15px; border-radius: 8px; margin: 20px 0; }
          .insight-title { font-weight: bold; margin-bottom: 10px; color: #0c4a6e; }
          .insight-item { margin-bottom: 5px; color: #0369a1; }
          table { width: 100%; border-collapse: collapse; margin-top: 30px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
          th { background-color: #f5f5f5; font-weight: bold; }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          .meeting-target { background-color: #f0fdf4; }
          .below-target { background-color: #fef2f2; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #666; font-size: 12px; }
          @media print {
            body { margin: 20px; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">Operational KPIs Dashboard Report</div>
          <div class="subtitle">
            ${dateRange ? `Period: ${dateRange.start} to ${dateRange.end}` : ''}
            <br>Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}
          </div>
        </div>

        <div class="summary">
          <div class="summary-card">
            <div class="summary-value">${data.summary.total_metrics}</div>
            <div class="summary-label">Total KPIs Tracked</div>
          </div>
          <div class="summary-card">
            <div class="summary-value">${data.summary.metrics_meeting_benchmarks}</div>
            <div class="summary-label">KPIs Meeting Targets</div>
          </div>
          <div class="summary-card">
            <div class="summary-value">${((data.summary.metrics_meeting_benchmarks / data.summary.total_metrics) * 100).toFixed(1)}%</div>
            <div class="summary-label">Overall Performance Score</div>
          </div>
          <div class="summary-card">
            <div class="summary-value">${data.summary.metrics_with_benchmarks}</div>
            <div class="summary-label">Metrics with Benchmarks</div>
          </div>
        </div>

        ${data.trends ? `
        <div class="insights">
          <div class="insight-title">📈 Performance Trends</div>
          <div class="insight-item">• ${data.trends.metrics_improving} metrics showing improvement</div>
          <div class="insight-item">• ${data.trends.metrics_declining} metrics showing decline</div>
          <div class="insight-item">• ${data.trends.metrics_stable} metrics remaining stable</div>
          <div class="insight-item">• Period comparison: ${data.trends.period_comparison}</div>
        </div>
        ` : ''}

        <table>
          <thead>
            <tr>
              <th>KPI Metric</th>
              <th class="text-right">Current Value</th>
              <th class="text-center">Unit</th>
              <th class="text-right">Target</th>
              <th class="text-right">Variance</th>
              <th class="text-center">Trend</th>
              <th class="text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            ${data.data.map(item => `
              <tr class="${item.benchmark && item.metric_value >= item.benchmark ? 'meeting-target' : 'below-target'}">
                <td>${item.metric_name}</td>
                <td class="text-right">${item.metric_value.toFixed(2)}</td>
                <td class="text-center">${item.metric_unit || ''}</td>
                <td class="text-right">${item.benchmark?.toFixed(2) || 'N/A'}</td>
                <td class="text-right">${item.variance?.toFixed(2) || 'N/A'}</td>
                <td class="text-center">${item.trend_direction === 'up' ? '📈 Up' : item.trend_direction === 'down' ? '📉 Down' : '➡️ Stable'}</td>
                <td class="text-center">${item.benchmark && item.metric_value >= item.benchmark ? '✅ Meeting' : '⚠️ Below'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="footer">
          <p>This report was generated by the Order Management System</p>
          <p>Total KPI metrics: ${data.data.length}</p>
          <p><strong>Key Recommendations:</strong></p>
          <ul style="text-align: left; display: inline-block;">
            <li>Focus on KPIs showing red status for immediate improvement</li>
            <li>Monitor trending patterns to predict future performance</li>
            <li>Set up automated alerts for KPIs falling below targets</li>
            <li>Review processes for consistently underperforming metrics</li>
            <li>Conduct regular KPI reviews to maintain operational excellence</li>
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

export const generateDepositAnalysisPDF = (data: DepositAnalysisReport, dateRange?: { start: string; end: string }, riskThreshold: number = 50000) => {
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
            As of: ${data.as_of_date}
            ${dateRange ? `<br>Period: ${dateRange.start} to ${dateRange.end}` : ''}
            <br>Risk Threshold: KES ${riskThreshold.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            <br>Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}
          </div>
        </div>

        <div class="summary">
          <div class="summary-card">
            <div class="summary-value">KES ${data.summary.total_outstanding_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
            <div class="summary-label">Total Outstanding</div>
          </div>
          <div class="summary-card">
            <div class="summary-value">${data.summary.customers_with_deposits.toLocaleString()}</div>
            <div class="summary-label">Customers with Deposits</div>
          </div>
          <div class="summary-card">
            <div class="summary-value">${data.summary.total_cylinders_on_deposit.toLocaleString()}</div>
            <div class="summary-label">Cylinders on Deposit</div>
          </div>
          <div class="summary-card">
            <div class="summary-value">${data.summary.customers_exceeding_threshold.toLocaleString()}</div>
            <div class="summary-label">High Risk Customers</div>
          </div>
        </div>

        ${data.summary.customers_exceeding_threshold > 0 ? `
        <div class="risk-alerts">
          <div class="risk-alert">⚠️ RISK ALERTS</div>
          <div>${data.summary.customers_exceeding_threshold} customer(s) exceed the risk threshold of KES ${riskThreshold.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
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
            ${data.data.map(item => `
              <tr class="${item.exceeds_threshold ? 'high-risk' : (item.days_outstanding > 60 ? 'medium-risk' : '')}">
                <td>${item.customer_name}</td>
                <td class="text-right">KES ${item.outstanding_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
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

        ${data.aging_breakdown ? `
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
            ${data.aging_breakdown.map(bucket => `
              <tr>
                <td>${bucket.bucket}</td>
                <td class="text-right">${bucket.customer_count.toLocaleString()}</td>
                <td class="text-right">KES ${bucket.total_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                <td class="text-right">${bucket.cylinder_count.toLocaleString()}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        ` : ''}

        <div class="footer">
          <p>This report was generated by the Order Management System</p>
          <p>Total records: ${data.data.length} | Page ${data.currentPage} of ${data.totalPages}</p>
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