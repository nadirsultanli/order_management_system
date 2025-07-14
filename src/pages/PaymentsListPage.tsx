import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, FileDown, TrendingUp } from 'lucide-react';
import { PaymentTable } from '../components/payments/PaymentTable';
import { PaymentStatsCards } from '../components/payments/PaymentStatsCards';
import { PaymentTrendsChart } from '../components/payments/PaymentTrendsChart';
import { usePayments, usePaymentSummary, useUpdatePaymentStatus } from '../hooks/usePayments';
import { PaymentFilters, PaymentStatus, PaymentListItem } from '../types/payment';
import { Card } from '../components/ui/Card';
import toast from 'react-hot-toast';

export const PaymentsListPage: React.FC = () => {
  const navigate = useNavigate();
  
  // State for filters and pagination
  const [filters, setFilters] = useState<PaymentFilters>({
    page: 1,
    limit: 50,
    sort_by: 'payment_date',
    sort_order: 'desc',
  });

  const [showAnalytics, setShowAnalytics] = useState(false);

  // Hooks
  const {
    data: paymentsData,
    isLoading: paymentsLoading,
    error: paymentsError,
    refetch: refetchPayments,
  } = usePayments(filters);

  const {
    data: summaryData,
    isLoading: summaryLoading,
    refetch: refetchSummary,
  } = usePaymentSummary({
    date_from: filters.date_from,
    date_to: filters.date_to,
    payment_method: filters.payment_method,
  });

  const updatePaymentStatus = useUpdatePaymentStatus();

  // Handle filter changes
  const handleFiltersChange = useCallback((newFilters: PaymentFilters) => {
    setFilters(newFilters);
  }, []);

  // Handle page changes
  const handlePageChange = useCallback((page: number) => {
    setFilters(prev => ({ ...prev, page }));
  }, []);

  // Handle payment click - navigate to detail page
  const handlePaymentClick = useCallback((payment: PaymentListItem) => {
    navigate(`/payments/${payment.id}`);
  }, [navigate]);

  // Handle status update
  const handleStatusUpdate = useCallback(async (paymentId: string, status: PaymentStatus) => {
    try {
      await updatePaymentStatus.mutateAsync({
        payment_id: paymentId,
        payment_status: status,
      });
      
      // Refresh data
      refetchPayments();
      refetchSummary();
      
      toast.success(`Payment status updated to ${status}`);
    } catch (error) {
      console.error('Failed to update payment status:', error);
      toast.error('Failed to update payment status');
    }
  }, [updatePaymentStatus, refetchPayments, refetchSummary]);

  // Handle export
  const handleExport = useCallback(() => {
    // TODO: Implement export functionality
    toast.success('Export functionality coming soon!');
  }, []);

  // Handle refresh
  const handleRefresh = useCallback(() => {
    refetchPayments();
    refetchSummary();
  }, [refetchPayments, refetchSummary]);

  // Navigate to create payment page
  const handleCreatePayment = useCallback(() => {
    navigate('/payments/create');
  }, [navigate]);

  // Error handling
  if (paymentsError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="p-6 max-w-md mx-auto">
          <div className="text-center">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              Error Loading Payments
            </h2>
            <p className="text-gray-600 mb-4">
              {paymentsError.message || 'Failed to load payments data'}
            </p>
            <button
              onClick={handleRefresh}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Try Again
            </button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Payments</h1>
              <p className="text-gray-600 mt-2">
                Manage and track all payment transactions across your business
              </p>
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={() => setShowAnalytics(!showAnalytics)}
                className={`inline-flex items-center px-4 py-2 border rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  showAnalytics
                    ? 'border-blue-300 text-blue-700 bg-blue-50'
                    : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'
                }`}
              >
                <TrendingUp className="h-4 w-4 mr-2" />
                Analytics
              </button>

              <button
                onClick={handleExport}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <FileDown className="h-4 w-4 mr-2" />
                Export
              </button>

              <button
                onClick={handleCreatePayment}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <Plus className="h-4 w-4 mr-2" />
                Record Payment
              </button>
            </div>
          </div>
        </div>

        {/* Payment Summary Stats */}
        {summaryData && (
          <div className="mb-8">
            <PaymentStatsCards
              stats={summaryData}
              loading={summaryLoading}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
            />
          </div>
        )}

        {/* Analytics Section */}
        {showAnalytics && summaryData && (
          <div className="mb-8">
            <Card>
              <div className="p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Payment Trends</h2>
                <PaymentTrendsChart 
                  data={summaryData}
                  loading={summaryLoading}
                />
              </div>
            </Card>
          </div>
        )}

        {/* Payments Table */}
        <PaymentTable
          payments={paymentsData?.payments || []}
          loading={paymentsLoading}
          totalCount={paymentsData?.totalCount || 0}
          currentPage={paymentsData?.currentPage || 1}
          totalPages={paymentsData?.totalPages || 1}
          filters={filters}
          onFiltersChange={handleFiltersChange}
          onPageChange={handlePageChange}
          onPaymentClick={handlePaymentClick}
          onStatusUpdate={handleStatusUpdate}
          onExport={handleExport}
          onRefresh={handleRefresh}
          showBulkActions={true}
        />

        {/* Quick Stats Summary at Bottom */}
        {paymentsData && (
          <div className="mt-8">
            <Card>
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Current Page Summary</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-900">
                      {paymentsData.payments.length}
                    </p>
                    <p className="text-sm text-gray-500">Payments Shown</p>
                  </div>
                  
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-900">
                      {paymentsData.totalCount.toLocaleString()}
                    </p>
                    <p className="text-sm text-gray-500">Total Payments</p>
                  </div>

                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-600">
                      {paymentsData.payments.filter(p => p.payment_status === 'completed').length}
                    </p>
                    <p className="text-sm text-gray-500">Completed (This Page)</p>
                  </div>

                  <div className="text-center">
                    <p className="text-2xl font-bold text-yellow-600">
                      {paymentsData.payments.filter(p => p.payment_status === 'pending').length}
                    </p>
                    <p className="text-sm text-gray-500">Pending (This Page)</p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Help Section */}
        <div className="mt-8">
          <Card>
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Need Help?</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                <div>
                  <h4 className="font-medium text-gray-900 mb-1">Search Payments</h4>
                  <p>Use the search bar to find payments by ID, transaction ID, reference number, or customer name.</p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 mb-1">Filter Results</h4>
                  <p>Use filters to narrow down results by payment method, status, date range, or amount.</p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 mb-1">Bulk Actions</h4>
                  <p>Select multiple payments to perform bulk operations like status updates or exports.</p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};