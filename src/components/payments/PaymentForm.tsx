import React, { useState, useEffect } from 'react';
import { AlertTriangle, DollarSign, CreditCard, Smartphone, User, Calendar, FileText, Hash, Info, CheckCircle, XCircle, Clock } from 'lucide-react';
import { 
  PaymentMethod, 
  RecordPaymentInput, 
  InitiateMpesaPaymentInput,
  PaymentFormData,
  MpesaFormData
} from '../../types/payment';
import { OrderBase, CustomerBase } from '../../types/payment';
import { useOrderNew } from '../../hooks/useOrders';
import { useCustomers } from '../../hooks/useCustomers';
import { usePaymentsByOrder, useCreatePayment, useInitiateMpesa } from '../../hooks/usePayments';
import { Card } from '../ui/Card';
import { PaymentMethodSelector } from './PaymentMethodSelector';
import { MpesaPaymentFlow } from './MpesaPaymentFlow';
import { PaymentSuccessModal } from './PaymentSuccessModal';

interface PaymentFormProps {
  orderId?: string;
  onSuccess?: (paymentId: string) => void;
  onCancel?: () => void;
  className?: string;
}

interface FormData {
  order_id: string;
  amount: number;
  payment_method: PaymentMethod;
  payment_date: string;
  reference_number: string;
  notes: string;
  paid_by: string;
  metadata: Record<string, any>;
  // Mpesa specific fields
  phone_number: string;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    minimumFractionDigits: 2,
  }).format(amount);
};

const formatPhoneNumber = (phone: string) => {
  // Remove any non-digit characters
  const cleaned = phone.replace(/\D/g, '');
  
  // Convert to 254 format if needed
  if (cleaned.startsWith('0')) {
    return '254' + cleaned.slice(1);
  } else if (cleaned.startsWith('7') || cleaned.startsWith('1')) {
    return '254' + cleaned;
  }
  
  return cleaned;
};

export const PaymentForm: React.FC<PaymentFormProps> = ({
  orderId = '',
  onSuccess,
  onCancel,
  className = ''
}) => {
  const [formData, setFormData] = useState<FormData>({
    order_id: orderId,
    amount: 0,
    payment_method: 'Cash',
    payment_date: new Date().toISOString().slice(0, 16),
    reference_number: '',
    notes: '',
    paid_by: '',
    metadata: {},
    phone_number: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [lastPaymentId, setLastPaymentId] = useState<string>('');
  const [showMpesaFlow, setShowMpesaFlow] = useState(false);

  // Hooks
  const { data: customers } = useCustomers({ limit: 1000 });
  const { data: order, isLoading: orderLoading } = useOrderNew(formData.order_id);
  const { data: orderPayments, refetch: refetchPayments } = usePaymentsByOrder(formData.order_id);
  const createPayment = useCreatePayment();
  const initiateMpesa = useInitiateMpesa();

  // Calculate balance and payment status
  const orderTotal = order?.total_amount || 0;
  const totalPaid = orderPayments?.summary?.total_payments || 0;
  const balance = orderPayments?.summary?.balance || orderTotal;
  const isFullyPaid = balance <= 0;

  // Auto-fill amount with remaining balance
  useEffect(() => {
    if (balance > 0 && formData.amount === 0) {
      setFormData(prev => ({ ...prev, amount: balance }));
    }
  }, [balance, formData.amount]);

  // Auto-fill customer phone for Mpesa
  useEffect(() => {
    if (formData.payment_method === 'Mpesa' && order?.customer?.phone && !formData.phone_number) {
      setFormData(prev => ({ 
        ...prev, 
        phone_number: formatPhoneNumber(order.customer!.phone!)
      }));
    }
  }, [formData.payment_method, order?.customer?.phone, formData.phone_number]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.order_id) {
      newErrors.order_id = 'Order is required';
    }

    if (!formData.amount || formData.amount <= 0) {
      newErrors.amount = 'Amount must be greater than 0';
    } else if (formData.amount > balance) {
      newErrors.amount = `Amount cannot exceed balance of ${formatCurrency(balance)}`;
    }

    if (!formData.paid_by) {
      newErrors.paid_by = 'Customer is required';
    }

    if (formData.payment_method === 'Mpesa') {
      if (!formData.phone_number) {
        newErrors.phone_number = 'Phone number is required for M-Pesa';
      } else {
        const formatted = formatPhoneNumber(formData.phone_number);
        if (!/^254[71]\d{8}$/.test(formatted)) {
          newErrors.phone_number = 'Invalid phone number format (use 254XXXXXXXXX)';
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    try {
      if (formData.payment_method === 'Mpesa') {
        // Show Mpesa flow for STK push
        setShowMpesaFlow(true);
      } else {
        // Direct payment for Cash/Card
        const paymentData: RecordPaymentInput = {
          order_id: formData.order_id,
          amount: formData.amount,
          payment_method: formData.payment_method,
          payment_date: formData.payment_date || undefined,
          reference_number: formData.reference_number || undefined,
          notes: formData.notes || undefined,
          metadata: Object.keys(formData.metadata).length > 0 ? formData.metadata : undefined,
          paid_by: formData.paid_by
        };

        const result = await createPayment.mutateAsync(paymentData);
        setLastPaymentId(result.id);
        setShowSuccessModal(true);
        refetchPayments();
      }
    } catch (error) {
      console.error('Payment creation error:', error);
    }
  };

  const handleMpesaSuccess = (paymentId: string) => {
    setLastPaymentId(paymentId);
    setShowMpesaFlow(false);
    setShowSuccessModal(true);
    refetchPayments();
  };

  const handleMpesaCancel = () => {
    setShowMpesaFlow(false);
  };

  const handleSuccessModalClose = () => {
    setShowSuccessModal(false);
    if (onSuccess) {
      onSuccess(lastPaymentId);
    }
  };

  const updateFormData = (field: keyof FormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  if (orderLoading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600">Loading order details...</span>
        </div>
      </Card>
    );
  }

  if (!order) {
    return (
      <Card className="p-6">
        <div className="text-center py-8">
          <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Order Not Found</h3>
          <p className="text-gray-600">The specified order could not be found.</p>
        </div>
      </Card>
    );
  }

  if (isFullyPaid) {
    return (
      <Card className="p-6">
        <div className="text-center py-8">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Order Fully Paid</h3>
          <p className="text-gray-600">This order has been fully paid.</p>
          <div className="mt-4 p-4 bg-green-50 rounded-lg">
            <p className="text-sm text-green-800">
              Total: {formatCurrency(orderTotal)} | 
              Paid: {formatCurrency(totalPaid)} | 
              Balance: {formatCurrency(balance)}
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <>
      <form onSubmit={handleSubmit} className={className}>
        <div className="space-y-6">
          {/* Order Information */}
          <Card className="p-6">
            <div className="flex items-center space-x-2 mb-4">
              <FileText className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-medium text-gray-900">Order Information</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Order ID
                </label>
                <input
                  type="text"
                  value={formData.order_id}
                  onChange={(e) => updateFormData('order_id', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter order ID"
                />
                {errors.order_id && (
                  <p className="mt-1 text-sm text-red-600">{errors.order_id}</p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Customer
                </label>
                <p className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-gray-900">
                  {order.customer?.name || 'Unknown Customer'}
                </p>
              </div>
            </div>

            {/* Payment Summary */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="text-sm font-medium text-blue-900 mb-2">Payment Summary</h4>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-blue-700">Order Total:</span>
                  <p className="font-semibold text-blue-900">{formatCurrency(orderTotal)}</p>
                </div>
                <div>
                  <span className="text-blue-700">Total Paid:</span>
                  <p className="font-semibold text-blue-900">{formatCurrency(totalPaid)}</p>
                </div>
                <div>
                  <span className="text-blue-700">Balance:</span>
                  <p className="font-semibold text-blue-900">{formatCurrency(balance)}</p>
                </div>
              </div>
            </div>
          </Card>

          {/* Payment Details */}
          <Card className="p-6">
            <div className="flex items-center space-x-2 mb-4">
              <DollarSign className="w-5 h-5 text-green-600" />
              <h3 className="text-lg font-medium text-gray-900">Payment Details</h3>
            </div>

            <div className="space-y-4">
              {/* Payment Method */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payment Method
                </label>
                <PaymentMethodSelector
                  selectedMethod={formData.payment_method}
                  onMethodChange={(method) => updateFormData('payment_method', method)}
                />
              </div>

              {/* Amount */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Payment Amount *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-gray-500 text-sm">KES</span>
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max={balance}
                      value={formData.amount || ''}
                      onChange={(e) => updateFormData('amount', parseFloat(e.target.value) || 0)}
                      className="w-full pl-12 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0.00"
                    />
                  </div>
                  {errors.amount && (
                    <p className="mt-1 text-sm text-red-600">{errors.amount}</p>
                  )}
                  <p className="mt-1 text-xs text-gray-500">
                    Maximum: {formatCurrency(balance)}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Payment Date
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.payment_date}
                    onChange={(e) => updateFormData('payment_date', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Customer Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Paid By (Customer) *
                </label>
                <select
                  value={formData.paid_by}
                  onChange={(e) => updateFormData('paid_by', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select customer...</option>
                  {order.customer && (
                    <option value={order.customer.id}>
                      {order.customer.name} (Order Customer)
                    </option>
                  )}
                  {customers?.customers
                    ?.filter(c => c.id !== order.customer?.id)
                    ?.map(customer => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                    </option>
                  ))}
                </select>
                {errors.paid_by && (
                  <p className="mt-1 text-sm text-red-600">{errors.paid_by}</p>
                )}
              </div>

              {/* Mpesa Phone Number */}
              {formData.payment_method === 'Mpesa' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    M-Pesa Phone Number *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Smartphone className="w-4 h-4 text-gray-400" />
                    </div>
                    <input
                      type="tel"
                      value={formData.phone_number}
                      onChange={(e) => updateFormData('phone_number', e.target.value)}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="254712345678"
                    />
                  </div>
                  {errors.phone_number && (
                    <p className="mt-1 text-sm text-red-600">{errors.phone_number}</p>
                  )}
                  <p className="mt-1 text-xs text-gray-500">
                    Format: 254XXXXXXXXX (Safaricom/Airtel)
                  </p>
                </div>
              )}

              {/* Reference Number */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reference Number
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Hash className="w-4 h-4 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    value={formData.reference_number}
                    onChange={(e) => updateFormData('reference_number', e.target.value)}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Transaction reference (optional)"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => updateFormData('notes', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Additional notes (optional)"
                />
              </div>
            </div>
          </Card>

          {/* Action Buttons */}
          <div className="flex items-center justify-between space-x-4">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            )}
            
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, amount: balance }))}
                className="px-4 py-2 text-sm border border-blue-300 text-blue-700 rounded-md hover:bg-blue-50 transition-colors"
              >
                Pay Full Balance
              </button>
              
              <button
                type="submit"
                disabled={createPayment.isLoading || initiateMpesa.isLoading}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {(createPayment.isLoading || initiateMpesa.isLoading) && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                )}
                <span>
                  {formData.payment_method === 'Mpesa' ? 'Initiate M-Pesa Payment' : 'Record Payment'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* Mpesa Payment Flow Modal */}
      {showMpesaFlow && (
        <MpesaPaymentFlow
          orderId={formData.order_id}
          amount={formData.amount}
          phoneNumber={formatPhoneNumber(formData.phone_number)}
          customerId={formData.paid_by}
          reference={formData.reference_number}
          notes={formData.notes}
          onSuccess={handleMpesaSuccess}
          onCancel={handleMpesaCancel}
        />
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <PaymentSuccessModal
          paymentId={lastPaymentId}
          amount={formData.amount}
          paymentMethod={formData.payment_method}
          orderBalance={balance - formData.amount}
          onClose={handleSuccessModalClose}
        />
      )}
    </>
  );
};