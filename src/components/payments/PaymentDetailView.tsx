import React, { useState } from 'react';
import {
  CreditCard,
  Smartphone,
  Banknote,
  Calendar,
  DollarSign,
  FileText,
  User,
  MapPin,
  Clock,
  CheckCircle,
  XCircle,
  RotateCcw,
  Receipt,
  Download,
  Edit,
  RefreshCw,
  ExternalLink,
  Copy,
  Phone,
  Mail,
  Building,
  Hash,
  AlertCircle,
  Info,
  ChevronRight
} from 'lucide-react';
import { Card } from '../ui/Card';
import { StatusBadge } from '../ui/StatusBadge';
import { PaymentDetailResponse, PaymentStatus } from '../../types/payment';
import { formatCurrencySync } from '../../utils/pricing';
import { formatDateSync } from '../../utils/order';

interface PaymentDetailViewProps {
  payment: PaymentDetailResponse;
  loading?: boolean;
  onStatusUpdate?: (status: PaymentStatus) => void;
  onPrintReceipt?: () => void;
  onDownloadReceipt?: () => void;
  onViewOrder?: () => void;
  onRefresh?: () => void;
  canEdit?: boolean;
}

// Payment method configurations
const getPaymentMethodConfig = (method: string) => {
  switch (method) {
    case 'Cash':
      return {
        icon: <Banknote className="h-6 w-6" />,
        color: 'text-green-600',
        bg: 'bg-green-100',
        label: 'Cash Payment'
      };
    case 'Mpesa':
      return {
        icon: <Smartphone className="h-6 w-6" />,
        color: 'text-green-600',
        bg: 'bg-green-100',
        label: 'M-Pesa Payment'
      };
    case 'Card':
      return {
        icon: <CreditCard className="h-6 w-6" />,
        color: 'text-blue-600',
        bg: 'bg-blue-100',
        label: 'Card Payment'
      };
    default:
      return {
        icon: <DollarSign className="h-6 w-6" />,
        color: 'text-gray-600',
        bg: 'bg-gray-100',
        label: 'Payment'
      };
  }
};

// Payment status configurations
const getPaymentStatusConfig = (status: PaymentStatus) => {
  switch (status) {
    case 'completed':
      return {
        icon: <CheckCircle className="h-5 w-5 text-green-600" />,
        color: 'text-green-600',
        bg: 'bg-green-100',
        description: 'Payment has been successfully processed and completed.'
      };
    case 'pending':
      return {
        icon: <Clock className="h-5 w-5 text-yellow-600" />,
        color: 'text-yellow-600',
        bg: 'bg-yellow-100',
        description: 'Payment is being processed and awaiting confirmation.'
      };
    case 'failed':
      return {
        icon: <XCircle className="h-5 w-5 text-red-600" />,
        color: 'text-red-600',
        bg: 'bg-red-100',
        description: 'Payment failed to process. Please try again or contact support.'
      };
    case 'refunded':
      return {
        icon: <RotateCcw className="h-5 w-5 text-gray-600" />,
        color: 'text-gray-600',
        bg: 'bg-gray-100',
        description: 'Payment has been refunded to the customer.'
      };
    default:
      return {
        icon: <AlertCircle className="h-5 w-5 text-gray-600" />,
        color: 'text-gray-600',
        bg: 'bg-gray-100',
        description: 'Payment status is unknown.'
      };
  }
};

// Status update options
const statusOptions = [
  { value: 'pending', label: 'Pending' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
  { value: 'refunded', label: 'Refunded' },
];

// Copy to clipboard helper
const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    // You might want to show a toast notification here
  } catch (err) {
    console.error('Failed to copy text: ', err);
  }
};

export const PaymentDetailView: React.FC<PaymentDetailViewProps> = ({
  payment,
  loading = false,
  onStatusUpdate,
  onPrintReceipt,
  onDownloadReceipt,
  onViewOrder,
  onRefresh,
  canEdit = false,
}) => {
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  
  const methodConfig = getPaymentMethodConfig(payment.payment_method);
  const statusConfig = getPaymentStatusConfig(payment.payment_status);

  const handleStatusUpdate = async (newStatus: PaymentStatus) => {
    if (!onStatusUpdate) return;
    
    setIsUpdatingStatus(true);
    try {
      await onStatusUpdate(newStatus);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="animate-pulse">
            <div className="p-6">
              <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
              <div className="space-y-2">
                <div className="h-3 bg-gray-200 rounded"></div>
                <div className="h-3 bg-gray-200 rounded w-5/6"></div>
                <div className="h-3 bg-gray-200 rounded w-3/4"></div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <div className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-4">
              <div className={`p-3 rounded-lg ${methodConfig.bg}`}>
                <div className={methodConfig.color}>
                  {methodConfig.icon}
                </div>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {methodConfig.label}
                </h1>
                <p className="text-sm text-gray-500 mt-1">
                  Payment ID: {payment.id}
                </p>
                <div className="flex items-center mt-2">
                  {statusConfig.icon}
                  <span className={`ml-2 font-medium ${statusConfig.color}`}>
                    {payment.payment_status.charAt(0).toUpperCase() + payment.payment_status.slice(1)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {onRefresh && (
                <button
                  onClick={onRefresh}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </button>
              )}

              {onPrintReceipt && (
                <button
                  onClick={onPrintReceipt}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <Receipt className="h-4 w-4 mr-2" />
                  Print
                </button>
              )}

              {onDownloadReceipt && (
                <button
                  onClick={onDownloadReceipt}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </button>
              )}
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Payment Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Payment Information */}
          <Card>
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Payment Information</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Amount</label>
                    <p className="mt-1 text-2xl font-bold text-gray-900">
                      {formatCurrencySync(payment.amount)}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-500">Payment Date</label>
                    <div className="mt-1 flex items-center text-gray-900">
                      <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                      {formatDateSync(payment.payment_date)}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-500">Payment Method</label>
                    <div className="mt-1 flex items-center text-gray-900">
                      {getPaymentMethodConfig(payment.payment_method).icon}
                      <span className="ml-2">{payment.payment_method}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Status</label>
                    <div className="mt-1">
                      <StatusBadge
                        status={payment.payment_status}
                        size="md"
                        interactive={canEdit && !!onStatusUpdate}
                        options={statusOptions}
                        onStatusChange={(status) => handleStatusUpdate(status as PaymentStatus)}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        {statusConfig.description}
                      </p>
                    </div>
                  </div>

                  {payment.transaction_id && (
                    <div>
                      <label className="block text-sm font-medium text-gray-500">Transaction ID</label>
                      <div className="mt-1 flex items-center">
                        <code className="text-sm font-mono text-gray-900 bg-gray-100 px-2 py-1 rounded">
                          {payment.transaction_id}
                        </code>
                        <button
                          onClick={() => copyToClipboard(payment.transaction_id!)}
                          className="ml-2 p-1 text-gray-400 hover:text-gray-600"
                          title="Copy to clipboard"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )}

                  {payment.reference_number && (
                    <div>
                      <label className="block text-sm font-medium text-gray-500">Reference Number</label>
                      <div className="mt-1 flex items-center">
                        <code className="text-sm font-mono text-gray-900 bg-gray-100 px-2 py-1 rounded">
                          {payment.reference_number}
                        </code>
                        <button
                          onClick={() => copyToClipboard(payment.reference_number!)}
                          className="ml-2 p-1 text-gray-400 hover:text-gray-600"
                          title="Copy to clipboard"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {payment.notes && (
                <div className="mt-6">
                  <label className="block text-sm font-medium text-gray-500">Notes</label>
                  <div className="mt-1 p-3 bg-gray-50 rounded-md">
                    <p className="text-sm text-gray-900">{payment.notes}</p>
                  </div>
                </div>
              )}

              {/* Metadata */}
              {payment.metadata && Object.keys(payment.metadata).length > 0 && (
                <div className="mt-6">
                  <label className="block text-sm font-medium text-gray-500 mb-2">Additional Information</label>
                  <div className="bg-gray-50 rounded-md p-3">
                    <pre className="text-xs text-gray-700 overflow-x-auto">
                      {JSON.stringify(payment.metadata, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Order Information */}
          {payment.order && (
            <Card>
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">Related Order</h2>
                  {onViewOrder && (
                    <button
                      onClick={onViewOrder}
                      className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      View Order
                      <ExternalLink className="h-4 w-4 ml-2" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Order ID</label>
                    <div className="mt-1 flex items-center">
                      <Hash className="h-4 w-4 mr-2 text-gray-400" />
                      <code className="text-sm font-mono text-gray-900">
                        {payment.order.id}
                      </code>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-500">Order Total</label>
                    <p className="mt-1 text-lg font-semibold text-gray-900">
                      {formatCurrencySync(payment.order.total_amount)}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-500">Order Status</label>
                    <div className="mt-1">
                      <StatusBadge status={payment.order.status} size="sm" />
                    </div>
                  </div>

                  {payment.order.payment_status_cache && (
                    <div>
                      <label className="block text-sm font-medium text-gray-500">Payment Status</label>
                      <div className="mt-1">
                        <StatusBadge status={payment.order.payment_status_cache} size="sm" />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          )}

          {/* Customer Information */}
          {payment.order?.customer && (
            <Card>
              <div className="p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Customer Information</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-500">Customer Name</label>
                      <div className="mt-1 flex items-center">
                        <User className="h-4 w-4 mr-2 text-gray-400" />
                        <span className="text-gray-900">{payment.order.customer.name}</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-500">Email</label>
                      <div className="mt-1 flex items-center">
                        <Mail className="h-4 w-4 mr-2 text-gray-400" />
                        <a 
                          href={`mailto:${payment.order.customer.email}`}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          {payment.order.customer.email}
                        </a>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-500">Customer ID</label>
                      <div className="mt-1 flex items-center">
                        <Building className="h-4 w-4 mr-2 text-gray-400" />
                        <code className="text-sm font-mono text-gray-900">
                          {payment.order.customer.id}
                        </code>
                      </div>
                    </div>

                    {payment.order.customer.phone && (
                      <div>
                        <label className="block text-sm font-medium text-gray-500">Phone</label>
                        <div className="mt-1 flex items-center">
                          <Phone className="h-4 w-4 mr-2 text-gray-400" />
                          <a 
                            href={`tel:${payment.order.customer.phone}`}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            {payment.order.customer.phone}
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Payment Timeline */}
          <Card>
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Timeline</h3>
              
              <div className="space-y-4">
                {payment.created_at && (
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-900">Payment Created</p>
                      <p className="text-xs text-gray-500">{formatDateSync(payment.created_at)}</p>
                      {payment.created_by && (
                        <p className="text-xs text-gray-500">by {payment.created_by}</p>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <div className={`w-2 h-2 rounded-full mt-2 ${
                      payment.payment_status === 'completed' ? 'bg-green-500' :
                      payment.payment_status === 'failed' ? 'bg-red-500' :
                      payment.payment_status === 'refunded' ? 'bg-gray-500' :
                      'bg-yellow-500'
                    }`}></div>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-900">Payment {payment.payment_status}</p>
                    <p className="text-xs text-gray-500">{formatDateSync(payment.payment_date)}</p>
                  </div>
                </div>

                {payment.updated_at && payment.updated_at !== payment.created_at && (
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <div className="w-2 h-2 bg-gray-400 rounded-full mt-2"></div>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-900">Last Updated</p>
                      <p className="text-xs text-gray-500">{formatDateSync(payment.updated_at)}</p>
                      {payment.updated_by && (
                        <p className="text-xs text-gray-500">by {payment.updated_by}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Quick Actions */}
          <Card>
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
              
              <div className="space-y-3">
                {payment.order && onViewOrder && (
                  <button
                    onClick={onViewOrder}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-700 bg-gray-50 rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <div className="flex items-center">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      View Order Details
                    </div>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                )}

                {onPrintReceipt && (
                  <button
                    onClick={onPrintReceipt}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-700 bg-gray-50 rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <div className="flex items-center">
                      <Receipt className="h-4 w-4 mr-2" />
                      Print Receipt
                    </div>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                )}

                {onDownloadReceipt && (
                  <button
                    onClick={onDownloadReceipt}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-700 bg-gray-50 rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <div className="flex items-center">
                      <Download className="h-4 w-4 mr-2" />
                      Download Receipt
                    </div>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                )}

                {payment.order?.customer?.email && (
                  <a
                    href={`mailto:${payment.order.customer.email}?subject=Payment Receipt - ${payment.id}`}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-700 bg-gray-50 rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <div className="flex items-center">
                      <Mail className="h-4 w-4 mr-2" />
                      Email Customer
                    </div>
                    <ChevronRight className="h-4 w-4" />
                  </a>
                )}
              </div>
            </div>
          </Card>

          {/* Payment Summary */}
          <Card>
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Summary</h3>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-gray-200">
                  <span className="text-sm text-gray-600">Payment Amount</span>
                  <span className="text-sm font-medium text-gray-900">
                    {formatCurrencySync(payment.amount)}
                  </span>
                </div>

                {payment.order && (
                  <>
                    <div className="flex justify-between items-center py-2 border-b border-gray-200">
                      <span className="text-sm text-gray-600">Order Total</span>
                      <span className="text-sm font-medium text-gray-900">
                        {formatCurrencySync(payment.order.total_amount)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center py-2">
                      <span className="text-sm text-gray-600">Remaining Balance</span>
                      <span className={`text-sm font-medium ${
                        payment.order.total_amount - payment.amount > 0 
                          ? 'text-red-600' 
                          : 'text-green-600'
                      }`}>
                        {formatCurrencySync(payment.order.total_amount - payment.amount)}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};