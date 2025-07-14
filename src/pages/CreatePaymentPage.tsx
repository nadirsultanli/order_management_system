import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, DollarSign, Search, AlertTriangle, FileText, Package } from 'lucide-react';
import { PaymentForm } from '../components/payments/PaymentForm';
import { Card } from '../components/ui/Card';
import { useOrderNew } from '../hooks/useOrders';
import { usePaymentsByOrder } from '../hooks/usePayments';

interface OrderSearchResult {
  id: string;
  total_amount: number;
  status: string;
  customer?: {
    id: string;
    name: string;
  };
  balance?: number;
  payment_status?: string;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    minimumFractionDigits: 2,
  }).format(amount);
};

export const CreatePaymentPage: React.FC = () => {
  const navigate = useNavigate();
  const { orderId } = useParams<{ orderId?: string }>();
  const [searchParams] = useSearchParams();
  const [selectedOrderId, setSelectedOrderId] = useState<string>(orderId || '');
  const [showOrderSearch, setShowOrderSearch] = useState(!orderId);
  
  // Get order data if we have an order ID
  const { data: order, isLoading: orderLoading, error: orderError } = useOrderNew(selectedOrderId);
  const { data: orderPayments } = usePaymentsByOrder(selectedOrderId);

  // Auto-select order from URL parameter or search params
  useEffect(() => {
    const orderIdFromParams = orderId || searchParams.get('orderId');
    if (orderIdFromParams) {
      setSelectedOrderId(orderIdFromParams);
      setShowOrderSearch(false);
    }
  }, [orderId, searchParams]);

  const handleOrderSelect = (orderIdToSelect: string) => {
    setSelectedOrderId(orderIdToSelect);
    setShowOrderSearch(false);
    // Update URL to include order ID
    navigate(`/payments/create/${orderIdToSelect}`, { replace: true });
  };

  const handlePaymentSuccess = (paymentId: string) => {
    // Navigate to payment details or back to order
    navigate(`/orders/${selectedOrderId}`, {
      state: { paymentCreated: paymentId }
    });
  };

  const handleCancel = () => {
    if (selectedOrderId) {
      navigate(`/orders/${selectedOrderId}`);
    } else {
      navigate('/orders');
    }
  };

  const orderBalance = orderPayments?.summary?.balance || 0;
  const isOrderFullyPaid = orderBalance <= 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate(-1)}
                className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                <span>Back</span>
              </button>
              <div className="h-6 w-px bg-gray-300"></div>
              <div className="flex items-center space-x-3">
                <DollarSign className="w-6 h-6 text-green-600" />
                <h1 className="text-xl font-semibold text-gray-900">Create Payment</h1>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Order Selection */}
        {showOrderSearch && (
          <Card className="p-6 mb-6">
            <div className="flex items-center space-x-2 mb-4">
              <Search className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-medium text-gray-900">Select Order</h2>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Order ID
                </label>
                <div className="flex space-x-3">
                  <input
                    type="text"
                    value={selectedOrderId}
                    onChange={(e) => setSelectedOrderId(e.target.value)}
                    placeholder="Enter order ID..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={() => handleOrderSelect(selectedOrderId)}
                    disabled={!selectedOrderId.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Select Order
                  </button>
                </div>
              </div>
              
              <div className="text-sm text-gray-600">
                <p>Enter the Order ID for which you want to record a payment.</p>
              </div>
            </div>
          </Card>
        )}

        {/* Order Summary */}
        {selectedOrderId && order && (
          <Card className="p-6 mb-6">
            <div className="flex items-center space-x-2 mb-4">
              <Package className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-medium text-gray-900">Order Summary</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Order Info */}
              <div>
                <h3 className="text-sm font-medium text-gray-600 mb-2">Order Details</h3>
                <div className="space-y-1 text-sm">
                  <p><span className="text-gray-500">Order ID:</span> <span className="font-mono">{order.id}</span></p>
                  <p><span className="text-gray-500">Status:</span> <span className="capitalize">{order.status}</span></p>
                  <p><span className="text-gray-500">Customer:</span> {order.customer?.name || 'Unknown'}</p>
                </div>
              </div>
              
              {/* Financial Summary */}
              <div>
                <h3 className="text-sm font-medium text-gray-600 mb-2">Financial Summary</h3>
                <div className="space-y-1 text-sm">
                  <p><span className="text-gray-500">Order Total:</span> <span className="font-semibold">{formatCurrency(order.total_amount)}</span></p>
                  <p><span className="text-gray-500">Total Paid:</span> <span className="font-semibold">{formatCurrency((orderPayments?.summary?.total_payments || 0))}</span></p>
                  <p><span className="text-gray-500">Balance:</span> <span className={`font-semibold ${orderBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {formatCurrency(orderBalance)}
                  </span></p>
                </div>
              </div>
              
              {/* Payment Status */}
              <div>
                <h3 className="text-sm font-medium text-gray-600 mb-2">Payment Status</h3>
                <div className="space-y-2">
                  <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                    isOrderFullyPaid
                      ? 'bg-green-100 text-green-800'
                      : orderPayments?.summary?.total_payments && orderPayments.summary.total_payments > 0
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {isOrderFullyPaid ? 'Fully Paid' : 
                     orderPayments?.summary?.total_payments && orderPayments.summary.total_payments > 0 ? 'Partially Paid' : 'Unpaid'}
                  </div>
                  {orderPayments?.summary && orderPayments.summary.payment_count > 0 && (
                    <p className="text-xs text-gray-500">
                      {orderPayments.summary.payment_count} payment(s) recorded
                    </p>
                  )}
                </div>
              </div>
            </div>
            
            {/* Fully Paid Warning */}
            {isOrderFullyPaid && (
              <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-start space-x-3">
                  <FileText className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-medium text-green-800">Order Fully Paid</h4>
                    <p className="text-sm text-green-700 mt-1">
                      This order has been paid in full. You can still record additional payments if needed (for overpayments or refunds).
                    </p>
                  </div>
                </div>
              </div>
            )}
          </Card>
        )}

        {/* Error States */}
        {selectedOrderId && orderError && (
          <Card className="p-6 mb-6">
            <div className="text-center py-8">
              <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Order Not Found</h3>
              <p className="text-gray-600 mb-4">
                The order with ID "{selectedOrderId}" could not be found.
              </p>
              <button
                onClick={() => setShowOrderSearch(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Try Another Order
              </button>
            </div>
          </Card>
        )}

        {/* Loading State */}
        {selectedOrderId && orderLoading && (
          <Card className="p-6 mb-6">
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-gray-600">Loading order details...</span>
            </div>
          </Card>
        )}

        {/* Payment Form */}
        {selectedOrderId && order && !orderError && (
          <PaymentForm
            orderId={selectedOrderId}
            onSuccess={handlePaymentSuccess}
            onCancel={handleCancel}
          />
        )}

        {/* Help Text */}
        {!selectedOrderId && !showOrderSearch && (
          <Card className="p-6">
            <div className="text-center py-8">
              <DollarSign className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Create Payment</h3>
              <p className="text-gray-600 mb-4">
                Select an order to record a payment against.
              </p>
              <button
                onClick={() => setShowOrderSearch(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Select Order
              </button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};