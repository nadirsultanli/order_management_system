import React, { useState } from 'react';
import { Clock, CheckCircle, XCircle, AlertTriangle, Package, Calendar, DollarSign } from 'lucide-react';
import { formatCurrencySync } from '../../utils/pricing';

interface EmptyReturnCredit {
  id: string;
  order_id: string;
  customer_id: string;
  product_id: string;
  quantity: number;
  capacity_l: number;
  unit_credit_amount: number;
  total_credit_amount: number;
  currency_code: string;
  expected_return_date: string;
  actual_return_date?: string;
  return_deadline: string;
  status: 'pending' | 'returned' | 'cancelled' | 'expired';
  cancelled_reason?: string;
  created_at: string;
  order?: {
    id: string;
    order_number: string;
    order_date: string;
    delivery_date?: string;
  };
  customer?: {
    id: string;
    name: string;
    phone?: string;
  };
  product?: {
    id: string;
    name: string;
    sku: string;
    capacity_l: number;
  };
}

interface EmptyReturnCreditsTableProps {
  credits: EmptyReturnCredit[];
  loading: boolean;
  onProcessReturn: (creditId: string) => void;
  onCancelCredit: (creditId: string, reason: string) => void;
  showCustomerInfo?: boolean;
}

export const EmptyReturnCreditsTable: React.FC<EmptyReturnCreditsTableProps> = ({
  credits,
  loading,
  onProcessReturn,
  onCancelCredit,
  showCustomerInfo = true,
}) => {
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [showCancelDialog, setShowCancelDialog] = useState<string | null>(null);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'returned':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'cancelled':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'expired':
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'returned':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      case 'expired':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const isOverdue = (returnDeadline: string) => {
    return new Date(returnDeadline) < new Date();
  };

  const isExpiringSoon = (returnDeadline: string) => {
    const deadline = new Date(returnDeadline);
    const soon = new Date();
    soon.setDate(soon.getDate() + 7); // 7 days from now
    return deadline <= soon && deadline >= new Date();
  };

  const handleProcessReturn = async (creditId: string) => {
    setProcessingId(creditId);
    try {
      await onProcessReturn(creditId);
    } finally {
      setProcessingId(null);
    }
  };

  const handleCancelCredit = async (creditId: string) => {
    if (!cancelReason.trim()) {
      alert('Please provide a reason for cancellation');
      return;
    }
    
    try {
      await onCancelCredit(creditId, cancelReason);
      setShowCancelDialog(null);
      setCancelReason('');
    } catch (error) {
      console.error('Error cancelling credit:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
      </div>
    );
  }

  if (credits.length === 0) {
    return (
      <div className="text-center py-8">
        <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Empty Return Credits</h3>
        <p className="text-gray-600">No empty cylinder return credits found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Order & Product
              </th>
              {showCustomerInfo && (
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
              )}
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Quantity & Credit
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Return Dates
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {credits.map((credit) => (
              <tr key={credit.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      Order #{credit.order?.order_number || credit.order_id.slice(-8)}
                    </div>
                    <div className="text-sm text-gray-500">
                      {credit.product?.name || 'Product'} ({credit.capacity_l}kg)
                    </div>
                    <div className="text-xs text-gray-400">
                      SKU: {credit.product?.sku || 'N/A'}
                    </div>
                  </div>
                </td>
                
                {showCustomerInfo && (
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {credit.customer?.name || 'Unknown Customer'}
                      </div>
                      {credit.customer?.phone && (
                        <div className="text-sm text-gray-500">
                          {credit.customer.phone}
                        </div>
                      )}
                    </div>
                  </td>
                )}
                
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {credit.quantity} cylinder{credit.quantity > 1 ? 's' : ''}
                    </div>
                    <div className="text-sm text-gray-500">
                      {formatCurrencySync(credit.total_credit_amount, credit.currency_code)} credit
                    </div>
                    <div className="text-xs text-gray-400">
                      {formatCurrencySync(credit.unit_credit_amount, credit.currency_code)} each
                    </div>
                  </div>
                </td>
                
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-1">
                      <Calendar className="h-3 w-3 text-gray-400" />
                      <span className="text-gray-600">Expected:</span>
                      <span>{new Date(credit.expected_return_date).toLocaleDateString()}</span>
                    </div>
                    <div className={`flex items-center space-x-1 ${
                      isOverdue(credit.return_deadline) ? 'text-red-600' :
                      isExpiringSoon(credit.return_deadline) ? 'text-yellow-600' : 'text-gray-600'
                    }`}>
                      <AlertTriangle className="h-3 w-3" />
                      <span>Deadline:</span>
                      <span>{new Date(credit.return_deadline).toLocaleDateString()}</span>
                    </div>
                    {credit.actual_return_date && (
                      <div className="flex items-center space-x-1 text-green-600">
                        <CheckCircle className="h-3 w-3" />
                        <span>Returned:</span>
                        <span>{new Date(credit.actual_return_date).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                </td>
                
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(credit.status)}
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(credit.status)}`}>
                      {credit.status.charAt(0).toUpperCase() + credit.status.slice(1)}
                    </span>
                  </div>
                  {credit.cancelled_reason && (
                    <div className="text-xs text-gray-500 mt-1">
                      {credit.cancelled_reason}
                    </div>
                  )}
                </td>
                
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  {credit.status === 'pending' && (
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        onClick={() => handleProcessReturn(credit.id)}
                        disabled={processingId === credit.id}
                        className="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700 disabled:opacity-50"
                      >
                        {processingId === credit.id ? 'Processing...' : 'Process Return'}
                      </button>
                      <button
                        onClick={() => setShowCancelDialog(credit.id)}
                        className="bg-red-600 text-white px-3 py-1 rounded text-xs hover:bg-red-700"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Cancel Credit Dialog */}
      {showCancelDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Cancel Empty Return Credit</h3>
            <p className="text-sm text-gray-600 mb-4">
              This will cancel the empty return credit and charge the customer the deposit amount. 
              Please provide a reason for the cancellation.
            </p>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Reason for cancellation..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
              rows={3}
            />
            <div className="flex justify-end space-x-3 mt-4">
              <button
                onClick={() => {
                  setShowCancelDialog(null);
                  setCancelReason('');
                }}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={() => handleCancelCredit(showCancelDialog)}
                disabled={!cancelReason.trim()}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
              >
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}; 