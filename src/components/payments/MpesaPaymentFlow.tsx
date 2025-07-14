import React, { useState, useEffect, useRef } from 'react';
import { 
  Smartphone, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  RefreshCcw, 
  X,
  Loader2,
  Phone,
  Timer
} from 'lucide-react';
import { 
  InitiateMpesaPaymentInput, 
  InitiateMpesaPaymentResponse,
  ManualStatusCheckResponse
} from '../../types/payment';
import { useInitiateMpesa, useMpesaStatusCheck } from '../../hooks/usePayments';

interface MpesaPaymentFlowProps {
  orderId: string;
  amount: number;
  phoneNumber: string;
  customerId: string;
  reference?: string;
  notes?: string;
  onSuccess: (paymentId: string) => void;
  onCancel: () => void;
}

type FlowStep = 'initiating' | 'waiting' | 'checking' | 'success' | 'failed' | 'timeout';

interface FlowState {
  step: FlowStep;
  message: string;
  checkoutRequestId?: string;
  paymentId?: string;
  error?: string;
  retryCount: number;
  timeRemaining: number;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    minimumFractionDigits: 2,
  }).format(amount);
};

const formatPhoneNumber = (phone: string) => {
  // Format 254712345678 as +254 712 345 678
  if (phone.startsWith('254') && phone.length === 12) {
    return `+254 ${phone.slice(3, 6)} ${phone.slice(6, 9)} ${phone.slice(9)}`;
  }
  return phone;
};

export const MpesaPaymentFlow: React.FC<MpesaPaymentFlowProps> = ({
  orderId,
  amount,
  phoneNumber,
  customerId,
  reference,
  notes,
  onSuccess,
  onCancel
}) => {
  const [flowState, setFlowState] = useState<FlowState>({
    step: 'initiating',
    message: 'Preparing M-Pesa payment...',
    retryCount: 0,
    timeRemaining: 120 // 2 minutes
  });

  const initiateMpesa = useInitiateMpesa();
  const statusCheck = useMpesaStatusCheck();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const statusIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup intervals on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (statusIntervalRef.current) clearInterval(statusIntervalRef.current);
    };
  }, []);

  // Auto-initiate payment on mount
  useEffect(() => {
    initiatePayment();
  }, []);

  // Countdown timer
  useEffect(() => {
    if (flowState.step === 'waiting' || flowState.step === 'checking') {
      intervalRef.current = setInterval(() => {
        setFlowState(prev => {
          const newTime = prev.timeRemaining - 1;
          if (newTime <= 0) {
            return {
              ...prev,
              step: 'timeout',
              message: 'Payment request timed out',
              timeRemaining: 0
            };
          }
          return { ...prev, timeRemaining: newTime };
        });
      }, 1000);

      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    }
  }, [flowState.step]);

  const initiatePayment = async () => {
    try {
      setFlowState(prev => ({
        ...prev,
        step: 'initiating',
        message: 'Initiating M-Pesa payment...'
      }));

      const paymentData: InitiateMpesaPaymentInput = {
        order_id: orderId,
        customer_id: customerId,
        amount,
        phone_number: phoneNumber,
        reference,
        notes
      };

      const result = await initiateMpesa.mutateAsync(paymentData);

      setFlowState(prev => ({
        ...prev,
        step: 'waiting',
        message: 'STK push sent to your phone. Please check your device.',
        checkoutRequestId: result.checkout_request_id,
        paymentId: result.payment_id,
        timeRemaining: 120
      }));

      // Start status checking after 5 seconds
      setTimeout(() => {
        startStatusPolling(result.checkout_request_id);
      }, 5000);

    } catch (error: any) {
      console.error('M-Pesa initiation error:', error);
      setFlowState(prev => ({
        ...prev,
        step: 'failed',
        message: 'Failed to initiate M-Pesa payment',
        error: error.message || 'Unknown error occurred'
      }));
    }
  };

  const startStatusPolling = (checkoutRequestId: string) => {
    setFlowState(prev => ({
      ...prev,
      step: 'checking',
      message: 'Checking payment status...'
    }));

    statusIntervalRef.current = setInterval(async () => {
      try {
        await checkPaymentStatus(checkoutRequestId);
      } catch (error) {
        console.error('Status check error:', error);
      }
    }, 5000); // Check every 5 seconds
  };

  const checkPaymentStatus = async (checkoutRequestId: string) => {
    try {
      const result = await statusCheck.mutateAsync({ 
        checkout_request_id: checkoutRequestId 
      });

      if (result.success && result.payment_status) {
        if (result.payment_status === 'completed') {
          setFlowState(prev => ({
            ...prev,
            step: 'success',
            message: 'Payment completed successfully!'
          }));
          
          // Clear intervals
          if (statusIntervalRef.current) clearInterval(statusIntervalRef.current);
          if (intervalRef.current) clearInterval(intervalRef.current);
          
          // Call success callback after a brief delay
          setTimeout(() => {
            if (flowState.paymentId) {
              onSuccess(flowState.paymentId);
            }
          }, 2000);
          
        } else if (result.payment_status === 'failed') {
          setFlowState(prev => ({
            ...prev,
            step: 'failed',
            message: 'Payment was declined or failed',
            error: result.error || 'Payment failed'
          }));
          
          if (statusIntervalRef.current) clearInterval(statusIntervalRef.current);
          if (intervalRef.current) clearInterval(intervalRef.current);
        }
      }
    } catch (error: any) {
      console.error('Manual status check error:', error);
    }
  };

  const handleRetry = () => {
    setFlowState(prev => ({
      ...prev,
      retryCount: prev.retryCount + 1,
      timeRemaining: 120
    }));
    
    // Clear all intervals
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (statusIntervalRef.current) clearInterval(statusIntervalRef.current);
    
    // Retry initiation
    initiatePayment();
  };

  const handleManualCheck = () => {
    if (flowState.checkoutRequestId) {
      checkPaymentStatus(flowState.checkoutRequestId);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStepIcon = () => {
    switch (flowState.step) {
      case 'initiating':
        return <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />;
      case 'waiting':
        return <Smartphone className="w-8 h-8 text-purple-600 animate-pulse" />;
      case 'checking':
        return <RefreshCcw className="w-8 h-8 text-blue-600 animate-spin" />;
      case 'success':
        return <CheckCircle className="w-8 h-8 text-green-600" />;
      case 'failed':
        return <XCircle className="w-8 h-8 text-red-600" />;
      case 'timeout':
        return <Clock className="w-8 h-8 text-orange-600" />;
      default:
        return <AlertCircle className="w-8 h-8 text-gray-600" />;
    }
  };

  const getStepColor = () => {
    switch (flowState.step) {
      case 'initiating':
      case 'checking':
        return 'border-blue-200 bg-blue-50';
      case 'waiting':
        return 'border-purple-200 bg-purple-50';
      case 'success':
        return 'border-green-200 bg-green-50';
      case 'failed':
        return 'border-red-200 bg-red-50';
      case 'timeout':
        return 'border-orange-200 bg-orange-50';
      default:
        return 'border-gray-200 bg-gray-50';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-90vh overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <Smartphone className="w-6 h-6 text-purple-600" />
            <h2 className="text-xl font-semibold text-gray-900">M-Pesa Payment</h2>
          </div>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Payment Details */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Amount:</span>
                <p className="font-semibold text-gray-900">{formatCurrency(amount)}</p>
              </div>
              <div>
                <span className="text-gray-600">Phone:</span>
                <p className="font-semibold text-gray-900">{formatPhoneNumber(phoneNumber)}</p>
              </div>
              <div className="col-span-2">
                <span className="text-gray-600">Order ID:</span>
                <p className="font-semibold text-gray-900">{orderId}</p>
              </div>
            </div>
          </div>

          {/* Status Display */}
          <div className={`border-2 rounded-lg p-6 text-center ${getStepColor()}`}>
            <div className="flex flex-col items-center space-y-4">
              {getStepIcon()}
              
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {flowState.message}
                </h3>
                
                {/* Time remaining */}
                {(flowState.step === 'waiting' || flowState.step === 'checking') && (
                  <div className="flex items-center justify-center space-x-2 text-sm text-gray-600">
                    <Timer className="w-4 h-4" />
                    <span>Time remaining: {formatTime(flowState.timeRemaining)}</span>
                  </div>
                )}

                {/* Error message */}
                {flowState.error && (
                  <p className="text-sm text-red-600 mt-2">{flowState.error}</p>
                )}
              </div>
            </div>
          </div>

          {/* Step-specific content */}
          {flowState.step === 'waiting' && (
            <div className="mt-6 p-4 bg-purple-50 border border-purple-200 rounded-lg">
              <div className="flex items-start space-x-3">
                <Phone className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-purple-800">
                  <h4 className="font-medium mb-1">Check your phone</h4>
                  <ul className="space-y-1 text-purple-700">
                    <li>• A payment prompt has been sent to {formatPhoneNumber(phoneNumber)}</li>
                    <li>• Enter your M-Pesa PIN to complete the payment</li>
                    <li>• Payment will be verified automatically</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {flowState.step === 'checking' && (
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center space-x-3">
                <RefreshCcw className="w-5 h-5 text-blue-600 animate-spin" />
                <p className="text-sm text-blue-800">
                  Verifying payment status with M-Pesa servers...
                </p>
              </div>
            </div>
          )}

          {flowState.step === 'success' && (
            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-start space-x-3">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-green-800">
                  <h4 className="font-medium mb-1">Payment Successful!</h4>
                  <p>Your M-Pesa payment has been processed successfully.</p>
                </div>
              </div>
            </div>
          )}

          {(flowState.step === 'failed' || flowState.step === 'timeout') && (
            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start space-x-3">
                <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-red-800">
                  <h4 className="font-medium mb-1">
                    {flowState.step === 'timeout' ? 'Payment Timeout' : 'Payment Failed'}
                  </h4>
                  <p>
                    {flowState.step === 'timeout' 
                      ? 'The payment request has timed out. Please try again.'
                      : flowState.error || 'The payment could not be processed.'
                    }
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between space-x-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              {flowState.step === 'success' ? 'Close' : 'Cancel'}
            </button>
            
            <div className="flex space-x-3">
              {/* Manual status check */}
              {(flowState.step === 'waiting' || flowState.step === 'checking') && flowState.checkoutRequestId && (
                <button
                  onClick={handleManualCheck}
                  disabled={statusCheck.isLoading}
                  className="px-4 py-2 text-sm text-blue-700 border border-blue-300 rounded-md hover:bg-blue-50 transition-colors disabled:opacity-50 flex items-center space-x-2"
                >
                  {statusCheck.isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Check Status</span>
                </button>
              )}
              
              {/* Retry button */}
              {(flowState.step === 'failed' || flowState.step === 'timeout') && flowState.retryCount < 3 && (
                <button
                  onClick={handleRetry}
                  disabled={initiateMpesa.isLoading}
                  className="px-4 py-2 text-sm bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center space-x-2"
                >
                  {initiateMpesa.isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Retry Payment</span>
                </button>
              )}
            </div>
          </div>
          
          {/* Retry count indicator */}
          {flowState.retryCount > 0 && (
            <p className="text-xs text-gray-500 mt-2">
              Attempt {flowState.retryCount + 1} of 4
            </p>
          )}
        </div>
      </div>
    </div>
  );
};