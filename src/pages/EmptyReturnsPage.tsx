import React, { useState } from 'react';
import { RefreshCw, Download, AlertTriangle, CheckCircle, Clock, Package } from 'lucide-react';
import { EmptyReturnCreditsTable } from '../components/deposits/EmptyReturnCreditsTable';
import { ReturnProcessingModal } from '../components/returns/ReturnProcessingModal';
import { Card } from '../components/ui/Card';
import { 
  useEmptyReturnCredits, 
  useEmptyReturnsSummary, 
  useProcessEmptyReturn, 
  useCancelEmptyReturn, 
  useExpireOverdueReturns 
} from '../hooks/useDeposits';
import { formatCurrencySync } from '../utils/pricing';

interface ReturnProcessingData {
  credit_id: string;
  quantity_returned: number;
  return_reason: string;
  notes?: string;
  condition_at_return: 'good' | 'damaged' | 'unusable';
  cylinder_status: 'good' | 'damaged' | 'lost';
  damage_assessment?: {
    damage_type: string;
    severity: 'minor' | 'moderate' | 'severe';
    repair_cost_estimate?: number;
    photos?: File[];
    description: string;
  };
  lost_cylinder_fee?: {
    base_fee: number;
    replacement_cost: number;
    administrative_fee: number;
    total_fee: number;
    currency_code: string;
  };
  photo_urls?: string[];
}

export const EmptyReturnsPage: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedCredit, setSelectedCredit] = useState<any>(null);
  const [showProcessingModal, setShowProcessingModal] = useState(false);
  
  // API Hooks
  const { 
    data: creditsData, 
    isLoading: creditsLoading, 
    refetch: refetchCredits 
  } = useEmptyReturnCredits({
    status: statusFilter === 'all' ? undefined : statusFilter as any,
  });
  
  const { 
    data: summaryData, 
    isLoading: summaryLoading 
  } = useEmptyReturnsSummary();
  
  const processReturnMutation = useProcessEmptyReturn();
  const cancelReturnMutation = useCancelEmptyReturn();
  const expireOverdueMutation = useExpireOverdueReturns();

  const handleProcessReturn = (creditId: string) => {
    const credit = creditsData?.credits?.find(c => c.id === creditId);
    if (credit) {
      setSelectedCredit(credit);
      setShowProcessingModal(true);
    }
  };

  const handleSubmitProcessing = async (data: ReturnProcessingData) => {
    try {
      await processReturnMutation.mutateAsync(data);
      setShowProcessingModal(false);
      setSelectedCredit(null);
    } catch (error) {
      console.error('Error processing return:', error);
    }
  };

  const handleCancelCredit = async (creditId: string, reason: string) => {
    try {
      await cancelReturnMutation.mutateAsync({
        credit_id: creditId,
        reason: reason,
      });
    } catch (error) {
      console.error('Error cancelling credit:', error);
    }
  };

  const handleExpireOverdue = async () => {
    try {
      await expireOverdueMutation.mutateAsync({});
    } catch (error) {
      console.error('Error expiring credits:', error);
    }
  };

  const handleRefresh = () => {
    refetchCredits();
  };

  const handleExport = () => {
    if (credits.length === 0) {
      alert('No data to export');
      return;
    }

    // Create CSV headers
    const headers = [
      'Order Number',
      'Customer Name',
      'Customer Phone',
      'Product Name',
      'Product SKU',
      'Capacity (kg)',
      'Total Quantity',
      'Quantity Returned',
      'Quantity Remaining',
      'Unit Credit Amount',
      'Total Credit Amount',
      'Remaining Credit Amount',
      'Expected Return Date',
      'Return Deadline',
      'Actual Return Date',
      'Status',
      'Cylinder Status',
      'Condition at Return',
      'Return Reason',
      'Damage Type',
      'Damage Severity',
      'Repair Cost Estimate',
      'Lost Cylinder Fee',
      'Cancelled Reason',
      'Created At',
    ];

    // Convert data to CSV rows
    const rows = credits.map(credit => [
      credit.order?.order_number || '',
      credit.customer?.name || '',
      credit.customer?.phone || '',
      credit.product?.name || '',
      credit.product?.sku || '',
      credit.capacity_l || credit.product?.capacity_l || '',
      credit.quantity || '',
      credit.quantity_returned || 0,
      credit.quantity_remaining || credit.quantity || '',
      credit.unit_credit_amount || '',
      credit.total_credit_amount || '',
      credit.remaining_credit_amount || credit.total_credit_amount || '',
      credit.expected_return_date || '',
      credit.return_deadline || '',
      credit.actual_return_date || '',
      credit.status || '',
      credit.cylinder_status || '',
      credit.condition_at_return || '',
      credit.return_reason || '',
      credit.damage_assessment?.damage_type || '',
      credit.damage_assessment?.severity || '',
      credit.damage_assessment?.repair_cost_estimate || '',
      credit.lost_cylinder_fee?.total_fee || '',
      credit.cancelled_reason || '',
      credit.created_at || '',
    ]);

    // Create CSV content
    const csvContent = [headers, ...rows]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    // Download CSV file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `empty_returns_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const credits = creditsData?.credits || [];
  const summary = summaryData || {
    total_pending_credits: 0,
    total_pending_quantity: 0,
    credits_expiring_soon: 0,
    credits_overdue: 0,
  };

  const loading = creditsLoading || summaryLoading || 
                 processReturnMutation.isLoading || 
                 cancelReturnMutation.isLoading || 
                 expireOverdueMutation.isLoading;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Empty Return Credits</h1>
          <p className="text-gray-600">Manage cylinder return credits and deadlines</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleExpireOverdue}
            disabled={expireOverdueMutation.isLoading}
            className="flex items-center space-x-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            <AlertTriangle className="h-4 w-4" />
            <span>{expireOverdueMutation.isLoading ? 'Processing...' : 'Expire Overdue'}</span>
          </button>
          <button 
            onClick={handleExport}
            disabled={credits.length === 0}
            className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            <span>Export</span>
          </button>
          <button 
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center space-x-2 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="p-6">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Clock className="h-6 w-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <h3 className="text-sm font-medium text-gray-500">Total Pending</h3>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrencySync(summary.total_pending_credits)}
              </p>
              <p className="text-sm text-gray-500">{summary.total_pending_quantity} cylinders</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center">
            <div className="p-2 bg-orange-100 rounded-lg">
              <AlertTriangle className="h-6 w-6 text-orange-600" />
            </div>
            <div className="ml-4">
              <h3 className="text-sm font-medium text-gray-500">Expiring Soon</h3>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrencySync(summary.credits_expiring_soon)}
              </p>
              <p className="text-sm text-gray-500">Within 7 days</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center">
            <div className="p-2 bg-red-100 rounded-lg">
              <Package className="h-6 w-6 text-red-600" />
            </div>
            <div className="ml-4">
              <h3 className="text-sm font-medium text-gray-500">Overdue</h3>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrencySync(summary.credits_overdue)}
              </p>
              <p className="text-sm text-gray-500">Past deadline</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <h3 className="text-sm font-medium text-gray-500">Completed Today</h3>
              <p className="text-2xl font-bold text-gray-900">0</p>
              <p className="text-sm text-gray-500">Returns processed</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-6">
        <div className="flex items-center space-x-4">
          <h3 className="text-sm font-medium text-gray-700">Filter by Status:</h3>
          <div className="flex items-center space-x-2">
            {['all', 'pending', 'partial_returned', 'fully_returned', 'cancelled', 'expired'].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                  statusFilter === status
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {status === 'all' ? 'All' : 
                 status === 'partial_returned' ? 'Partial' :
                 status === 'fully_returned' ? 'Completed' :
                 status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Credits Table */}
      <Card>
        <div className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Empty Return Credits</h2>
          <EmptyReturnCreditsTable
            credits={credits}
            loading={creditsLoading}
            onProcessReturn={handleProcessReturn}
            onCancelCredit={handleCancelCredit}
            showCustomerInfo={true}
          />
        </div>
      </Card>

      {/* Return Processing Modal */}
      <ReturnProcessingModal
        isOpen={showProcessingModal}
        onClose={() => {
          setShowProcessingModal(false);
          setSelectedCredit(null);
        }}
        onSubmit={handleSubmitProcessing}
        emptyReturnCredit={selectedCredit}
        loading={processReturnMutation.isLoading}
      />
    </div>
  );
}; 