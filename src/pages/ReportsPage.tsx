import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, BarChart3, Download, Calendar, DollarSign, TrendingUp, Activity, FileText } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/Tabs';
import { StockValuationReport } from '../components/reports/StockValuationReport';
import { DepositAnalysisReport } from '../components/reports/DepositAnalysisReport';
import { MarginAnalysisReport } from '../components/reports/MarginAnalysisReport';
import { OperationalKPIsReport } from '../components/reports/OperationalKPIsReport';

// Tab IDs for cylinder business reporting
type ReportTab = 'stock-valuation' | 'deposit-analysis' | 'margin-analysis' | 'operational-kpis';

interface DateRange {
  start: string;
  end: string;
}

export const ReportsPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Get tab from URL or default to stock-valuation
  const [activeTab, setActiveTab] = useState<ReportTab>(
    (searchParams.get('tab') as ReportTab) || 'stock-valuation'
  );
  
  // Date range state with default to last 30 days
  const [dateRange, setDateRange] = useState<DateRange>({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });

  // Update URL when tab changes
  useEffect(() => {
    setSearchParams({ tab: activeTab }, { replace: true });
  }, [activeTab, setSearchParams]);

  // Handle tab change
  const handleTabChange = (value: string) => {
    setActiveTab(value as ReportTab);
  };

  // Handle date range change
  const handleDateRangeChange = (field: 'start' | 'end', value: string) => {
    setDateRange(prev => ({ ...prev, [field]: value }));
  };

  // Export functionality for different formats
  const handleExport = (format: 'csv' | 'pdf') => {
    const filename = `${activeTab}-report-${dateRange.start}-to-${dateRange.end}.${format}`;
    
    if (format === 'csv') {
      // Create basic CSV structure for demo
      const csvContent = [
        [`${activeTab.replace('-', ' ').toUpperCase()} Report`],
        [`Date Range: ${dateRange.start} to ${dateRange.end}`],
        [`Generated: ${new Date().toISOString()}`],
        [],
        ['Metric', 'Value', 'Change %'],
        ['Sample Data', '1,234', '+5.2%'],
        ['Sample Data 2', '5,678', '-2.1%'],
      ].map(row => row.join(',')).join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } else {
      // PDF export would integrate with a PDF generation library
      console.log(`Exporting ${activeTab} report as PDF...`);
      // TODO: Implement PDF export functionality
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header with Breadcrumb */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Dashboard</span>
            </button>
            <div className="text-gray-400">/</div>
            <h1 className="text-3xl font-bold text-gray-900">Reports & Analytics</h1>
          </div>
          <div className="flex items-center space-x-3">
            <BarChart3 className="h-8 w-8 text-blue-600" />
          </div>
        </div>

        {/* Date Range Picker */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Report Filters</h2>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Calendar className="h-4 w-4 text-gray-400" />
                <label className="text-sm font-medium text-gray-700">From:</label>
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => handleDateRangeChange('start', e.target.value)}
                  className="text-sm border border-gray-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-gray-500">to</span>
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => handleDateRangeChange('end', e.target.value)}
                  className="text-sm border border-gray-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleExport('csv')}
                  className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Download className="h-4 w-4" />
                  <span>CSV</span>
                </button>
                <button
                  onClick={() => handleExport('pdf')}
                  className="flex items-center space-x-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
                >
                  <FileText className="h-4 w-4" />
                  <span>PDF</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation and Content */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <div className="border-b border-gray-200 px-6">
              <TabsList className="h-12 bg-transparent p-0">
                <TabsTrigger 
                  value="stock-valuation" 
                  className="flex items-center space-x-2 px-4 py-3 data-[state=active]:border-b-2 data-[state=active]:border-blue-500 data-[state=active]:bg-transparent rounded-none"
                >
                  <BarChart3 className="h-4 w-4" />
                  <span>Stock Valuation</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="deposit-analysis" 
                  className="flex items-center space-x-2 px-4 py-3 data-[state=active]:border-b-2 data-[state=active]:border-blue-500 data-[state=active]:bg-transparent rounded-none"
                >
                  <DollarSign className="h-4 w-4" />
                  <span>Deposit Analysis</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="margin-analysis" 
                  className="flex items-center space-x-2 px-4 py-3 data-[state=active]:border-b-2 data-[state=active]:border-blue-500 data-[state=active]:bg-transparent rounded-none"
                >
                  <TrendingUp className="h-4 w-4" />
                  <span>Margin Analysis</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="operational-kpis" 
                  className="flex items-center space-x-2 px-4 py-3 data-[state=active]:border-b-2 data-[state=active]:border-blue-500 data-[state=active]:bg-transparent rounded-none"
                >
                  <Activity className="h-4 w-4" />
                  <span>Operational KPIs</span>
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Stock Valuation Tab */}
            <TabsContent value="stock-valuation" className="p-6">
              <StockValuationReport dateRange={dateRange} />
            </TabsContent>

            {/* Deposit Analysis Tab */}
            <TabsContent value="deposit-analysis" className="p-6">
              <DepositAnalysisReport dateRange={dateRange} />
            </TabsContent>

            {/* Margin Analysis Tab */}
            <TabsContent value="margin-analysis" className="p-6">
              <MarginAnalysisReport dateRange={dateRange} />
            </TabsContent>

            {/* Operational KPIs Tab */}
            <TabsContent value="operational-kpis" className="p-6">
              <OperationalKPIsReport dateRange={dateRange} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};