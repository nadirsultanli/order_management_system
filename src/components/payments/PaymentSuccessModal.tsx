import React from 'react';
import { 
  CheckCircle, 
  X, 
  CreditCard, 
  Banknote, 
  Smartphone, 
  Copy, 
  Download, 
  Eye,
  DollarSign,
  Calendar,
  FileText
} from 'lucide-react';
import { PaymentMethod } from '../../types/payment';

interface PaymentSuccessModalProps {
  paymentId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  orderBalance: number;
  onClose: () => void;
  onViewPayment?: () => void;
  onDownloadReceipt?: () => void;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    minimumFractionDigits: 2,
  }).format(amount);
};

const getPaymentMethodIcon = (method: PaymentMethod) => {
  switch (method) {
    case 'Cash':
      return <Banknote className="w-6 h-6 text-green-600" />;
    case 'Card':
      return <CreditCard className="w-6 h-6 text-blue-600" />;
    case 'Mpesa':
      return <Smartphone className="w-6 h-6 text-purple-600" />;
    default:
      return <DollarSign className="w-6 h-6 text-gray-600" />;
  }
};

const getPaymentMethodColor = (method: PaymentMethod) => {
  switch (method) {
    case 'Cash':
      return 'text-green-700 bg-green-50 border-green-200';
    case 'Card':
      return 'text-blue-700 bg-blue-50 border-blue-200';
    case 'Mpesa':
      return 'text-purple-700 bg-purple-50 border-purple-200';
    default:
      return 'text-gray-700 bg-gray-50 border-gray-200';
  }
};

const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text).then(() => {
    // Could add a toast notification here
    console.log('Copied to clipboard:', text);
  }).catch(err => {
    console.error('Failed to copy to clipboard:', err);
  });
};

export const PaymentSuccessModal: React.FC<PaymentSuccessModalProps> = ({
  paymentId,
  amount,
  paymentMethod,
  orderBalance,
  onClose,
  onViewPayment,
  onDownloadReceipt
}) => {
  const isOrderFullyPaid = orderBalance <= 0;
  const timestamp = new Date().toLocaleString('en-KE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-90vh overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <CheckCircle className="w-6 h-6 text-green-600" />
            <h2 className="text-xl font-semibold text-gray-900">Payment Successful</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Success Message */}
          <div className="text-center mb-6">
            <div className="mx-auto flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Payment Recorded Successfully!
            </h3>
            <p className="text-gray-600">
              Your {paymentMethod.toLowerCase()} payment has been processed and recorded.
            </p>
          </div>

          {/* Payment Details */}
          <div className="space-y-4">
            {/* Payment Amount */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600">Payment Amount</span>
                <span className="text-2xl font-bold text-gray-900">{formatCurrency(amount)}</span>
              </div>
            </div>

            {/* Payment Method */}
            <div className={`border rounded-lg p-4 ${getPaymentMethodColor(paymentMethod)}`}>
              <div className="flex items-center space-x-3">
                {getPaymentMethodIcon(paymentMethod)}
                <div>
                  <h4 className="font-medium">{paymentMethod} Payment</h4>
                  <p className="text-sm opacity-80">
                    {paymentMethod === 'Cash' && 'Cash payment received'}
                    {paymentMethod === 'Card' && 'Card payment processed'}
                    {paymentMethod === 'Mpesa' && 'M-Pesa payment completed'}
                  </p>
                </div>
              </div>
            </div>

            {/* Payment ID */}
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <span className="text-sm font-medium text-gray-600">Payment ID</span>
                <p className="text-sm font-mono text-gray-900">{paymentId}</p>
              </div>
              <button
                onClick={() => copyToClipboard(paymentId)}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                title="Copy Payment ID"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>

            {/* Timestamp */}
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <Calendar className="w-4 h-4" />
              <span>Recorded on {timestamp}</span>
            </div>

            {/* Order Balance Status */}
            <div className={`p-4 rounded-lg border ${
              isOrderFullyPaid 
                ? 'bg-green-50 border-green-200' 
                : 'bg-orange-50 border-orange-200'
            }`}>
              <div className="flex items-start space-x-3">
                <div className={`flex-shrink-0 w-5 h-5 rounded-full ${
                  isOrderFullyPaid ? 'bg-green-500' : 'bg-orange-500'
                }`}></div>
                <div>
                  <h4 className={`font-medium ${
                    isOrderFullyPaid ? 'text-green-800' : 'text-orange-800'
                  }`}>
                    {isOrderFullyPaid ? 'Order Fully Paid' : 'Partial Payment'}
                  </h4>
                  <p className={`text-sm ${
                    isOrderFullyPaid ? 'text-green-700' : 'text-orange-700'
                  }`}>
                    {isOrderFullyPaid 
                      ? 'This order has been paid in full.' 
                      : `Remaining balance: ${formatCurrency(orderBalance)}`
                    }
                  </p>
                </div>
              </div>
            </div>

            {/* Next Steps */}
            {!isOrderFullyPaid && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="font-medium text-blue-800 mb-2">Next Steps</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• Record additional payments to complete the order</li>
                  <li>• Track payment status in the order details</li>
                  <li>• Download receipt for this payment</li>
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              Close
            </button>
            
            <div className="flex space-x-3">
              {/* View Payment Details */}
              {onViewPayment && (
                <button
                  onClick={onViewPayment}
                  className="px-4 py-2 text-sm text-blue-700 border border-blue-300 rounded-md hover:bg-blue-50 transition-colors flex items-center space-x-2"
                >
                  <Eye className="w-4 h-4" />
                  <span>View Details</span>
                </button>
              )}
              
              {/* Download Receipt */}
              {onDownloadReceipt && (
                <button
                  onClick={onDownloadReceipt}
                  className="px-4 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors flex items-center space-x-2"
                >
                  <Download className="w-4 h-4" />
                  <span>Receipt</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Payment Method Specific Info */}
        {paymentMethod === 'Mpesa' && (
          <div className="px-6 pb-6">
            <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
              <div className="flex items-start space-x-2">
                <Smartphone className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-purple-700">
                  <p className="font-medium mb-1">M-Pesa Payment Confirmed</p>
                  <p>You should receive an SMS confirmation from M-Pesa with transaction details.</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};