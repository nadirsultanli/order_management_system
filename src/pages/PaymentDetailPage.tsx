import React, { useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertCircle, Loader2 } from 'lucide-react';
import { PaymentDetailView } from '../components/payments/PaymentDetailView';
import { usePayment, useUpdatePaymentStatus } from '../hooks/usePayments';
import { PaymentStatus } from '../types/payment';
import { Card } from '../components/ui/Card';
import toast from 'react-hot-toast';

export const PaymentDetailPage: React.FC = () => {
  const { paymentId } = useParams<{ paymentId: string }>();
  const navigate = useNavigate();

  // Hooks
  const {
    data: payment,
    isLoading,
    error,
    refetch,
  } = usePayment(paymentId || '');

  const updatePaymentStatus = useUpdatePaymentStatus();

  // Handle status update
  const handleStatusUpdate = useCallback(async (status: PaymentStatus) => {
    if (!paymentId) return;

    try {
      await updatePaymentStatus.mutateAsync({
        payment_id: paymentId,
        payment_status: status,
      });
      
      // Refresh payment data
      refetch();
      
      toast.success(`Payment status updated to ${status}`);
    } catch (error) {
      console.error('Failed to update payment status:', error);
      toast.error('Failed to update payment status');
    }
  }, [paymentId, updatePaymentStatus, refetch]);

  // Handle print receipt
  const handlePrintReceipt = useCallback(() => {
    if (!payment) return;

    // Create a printable receipt
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Unable to open print window. Please check your popup blocker.');
      return;
    }

    const receiptHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Payment Receipt - ${payment.id}</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 20px; }
            .details { margin-bottom: 20px; }
            .row { display: flex; justify-content: space-between; margin-bottom: 10px; }
            .label { font-weight: bold; }
            .footer { text-align: center; margin-top: 40px; font-size: 12px; color: #666; }
            @media print { body { margin: 0; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Payment Receipt</h1>
            <p>Receipt #${payment.id}</p>
          </div>
          
          <div class="details">
            <div class="row">
              <span class="label">Payment ID:</span>
              <span>${payment.id}</span>
            </div>
            <div class="row">
              <span class="label">Amount:</span>
              <span>$${payment.amount.toFixed(2)}</span>
            </div>
            <div class="row">
              <span class="label">Payment Method:</span>
              <span>${payment.payment_method}</span>
            </div>
            <div class="row">
              <span class="label">Status:</span>
              <span>${payment.payment_status}</span>
            </div>
            <div class="row">
              <span class="label">Payment Date:</span>
              <span>${new Date(payment.payment_date).toLocaleDateString()}</span>
            </div>
            ${payment.transaction_id ? `
            <div class="row">
              <span class="label">Transaction ID:</span>
              <span>${payment.transaction_id}</span>
            </div>
            ` : ''}
            ${payment.reference_number ? `
            <div class="row">
              <span class="label">Reference Number:</span>
              <span>${payment.reference_number}</span>
            </div>
            ` : ''}
            ${payment.order ? `
            <div class="row">
              <span class="label">Order ID:</span>
              <span>${payment.order.id}</span>
            </div>
            <div class="row">
              <span class="label">Order Total:</span>
              <span>$${payment.order.total_amount.toFixed(2)}</span>
            </div>
            ` : ''}
            ${payment.order?.customer ? `
            <div class="row">
              <span class="label">Customer:</span>
              <span>${payment.order.customer.name}</span>
            </div>
            <div class="row">
              <span class="label">Customer Email:</span>
              <span>${payment.order.customer.email}</span>
            </div>
            ` : ''}
            ${payment.notes ? `
            <div class="row">
              <span class="label">Notes:</span>
              <span>${payment.notes}</span>
            </div>
            ` : ''}
          </div>

          <div class="footer">
            <p>Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
            <p>Thank you for your business!</p>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(receiptHTML);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }, [payment]);

  // Handle download receipt
  const handleDownloadReceipt = useCallback(() => {
    if (!payment) return;

    // Create a blob with receipt data
    const receiptData = {
      paymentId: payment.id,
      amount: payment.amount,
      paymentMethod: payment.payment_method,
      status: payment.payment_status,
      paymentDate: payment.payment_date,
      transactionId: payment.transaction_id,
      referenceNumber: payment.reference_number,
      orderId: payment.order?.id,
      orderTotal: payment.order?.total_amount,
      customerName: payment.order?.customer?.name,
      customerEmail: payment.order?.customer?.email,
      notes: payment.notes,
      generatedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(receiptData, null, 2)], {
      type: 'application/json',
    });

    // Create download link
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `payment-receipt-${payment.id}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success('Receipt downloaded successfully');
  }, [payment]);

  // Handle view order
  const handleViewOrder = useCallback(() => {
    if (!payment?.order?.id) return;
    navigate(`/orders/${payment.order.id}`);
  }, [payment, navigate]);

  // Handle refresh
  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  // Handle back navigation
  const handleBack = useCallback(() => {
    navigate('/payments');
  }, [navigate]);

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="p-8">
          <div className="flex items-center space-x-4">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <div>
              <h3 className="text-lg font-medium text-gray-900">Loading Payment Details</h3>
              <p className="text-gray-500">Please wait while we fetch the payment information...</p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // Error state
  if (error || !payment) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="p-8 max-w-md mx-auto text-center">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {error ? 'Error Loading Payment' : 'Payment Not Found'}
          </h3>
          <p className="text-gray-500 mb-6">
            {error 
              ? (error.message || 'Failed to load payment details')
              : 'The payment you are looking for does not exist or has been removed.'
            }
          </p>
          <div className="flex space-x-3 justify-center">
            <button
              onClick={handleBack}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Back to Payments
            </button>
            {error && (
              <button
                onClick={handleRefresh}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Try Again
              </button>
            )}
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
          <div className="flex items-center space-x-4">
            <button
              onClick={handleBack}
              className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Payments
            </button>
            
            <div className="border-l border-gray-300 pl-4">
              <h1 className="text-2xl font-bold text-gray-900">
                Payment Details
              </h1>
              <p className="text-gray-600">
                View and manage payment information
              </p>
            </div>
          </div>
        </div>

        {/* Payment Detail View */}
        <PaymentDetailView
          payment={payment}
          loading={isLoading}
          onStatusUpdate={handleStatusUpdate}
          onPrintReceipt={handlePrintReceipt}
          onDownloadReceipt={handleDownloadReceipt}
          onViewOrder={payment.order ? handleViewOrder : undefined}
          onRefresh={handleRefresh}
          canEdit={true}
        />

        {/* Additional Actions */}
        <div className="mt-8">
          <Card>
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Additional Actions</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 border border-gray-200 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">Payment History</h4>
                  <p className="text-sm text-gray-600 mb-3">
                    View all payments for this order and customer
                  </p>
                  <button
                    onClick={() => payment.order && navigate(`/orders/${payment.order.id}/payments`)}
                    disabled={!payment.order}
                    className="text-sm text-blue-600 hover:text-blue-800 disabled:text-gray-400 disabled:cursor-not-allowed"
                  >
                    View Order Payments →
                  </button>
                </div>

                <div className="p-4 border border-gray-200 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">Customer Details</h4>
                  <p className="text-sm text-gray-600 mb-3">
                    View complete customer profile and history
                  </p>
                  <button
                    onClick={() => payment.order?.customer && navigate(`/customers/${payment.order.customer.id}`)}
                    disabled={!payment.order?.customer}
                    className="text-sm text-blue-600 hover:text-blue-800 disabled:text-gray-400 disabled:cursor-not-allowed"
                  >
                    View Customer Profile →
                  </button>
                </div>

                <div className="p-4 border border-gray-200 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">Similar Payments</h4>
                  <p className="text-sm text-gray-600 mb-3">
                    Find payments with similar characteristics
                  </p>
                  <button
                    onClick={() => navigate(`/payments?payment_method=${payment.payment_method}&payment_status=${payment.payment_status}`)}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    Search Similar →
                  </button>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Debug Information (for development) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-8">
            <Card>
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Debug Information</h3>
                <div className="bg-gray-50 rounded-md p-4">
                  <pre className="text-xs text-gray-700 overflow-x-auto">
                    {JSON.stringify(payment, null, 2)}
                  </pre>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};