import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { X, Loader2, AlertTriangle } from 'lucide-react';
import { Order, OrderStatusChange } from '../../types/order';
import { getOrderStatusInfo, getNextPossibleStatuses, validateOrderForConfirmation, validateOrderForScheduling } from '../../utils/order';

interface OrderStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: OrderStatusChange) => void;
  order: Order;
  newStatus: string;
  loading?: boolean;
}

export const OrderStatusModal: React.FC<OrderStatusModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  order,
  newStatus,
  loading = false,
}) => {
  const [statusInfo, setStatusInfo] = useState<any>(null);
  const [currentStatusInfo, setCurrentStatusInfo] = useState<any>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isValidating, setIsValidating] = useState(false);

  // Fallback functions for when tRPC client is unavailable
  const getOrderStatusInfoFallback = (status: string) => {
    const statusMap: Record<string, { label: string; color: string; description: string }> = {
      'draft': { label: 'Draft', color: 'bg-gray-100 text-gray-800 border-gray-300', description: 'Order is being prepared' },
      'confirmed': { label: 'Confirmed', color: 'bg-blue-100 text-blue-800 border-blue-300', description: 'Order has been confirmed' },
      'scheduled': { label: 'Scheduled', color: 'bg-yellow-100 text-yellow-800 border-yellow-300', description: 'Order is scheduled for delivery' },
      'en_route': { label: 'En Route', color: 'bg-orange-100 text-orange-800 border-orange-300', description: 'Order is out for delivery' },
      'delivered': { label: 'Delivered', color: 'bg-green-100 text-green-800 border-green-300', description: 'Order has been delivered' },
      'cancelled': { label: 'Cancelled', color: 'bg-red-100 text-red-800 border-red-300', description: 'Order has been cancelled' },
    };
    return statusMap[status] || statusMap['draft'];
  };

  const validateOrderFallback = (order: Order, newStatus: string, scheduledDate?: string) => {
    const errors: string[] = [];
    
    // Basic validation rules
    if (!order.order_lines || order.order_lines.length === 0) {
      errors.push('Order must have at least one item');
    }
    
    if (!order.customer) {
      errors.push('Order must have a customer');
    }
    
    if (newStatus === 'confirmed') {
      // Validation for confirming order
      if (!order.delivery_address) {
        errors.push('Delivery address is required for confirmed orders');
      }
    } else if (newStatus === 'scheduled') {
      // Validation for scheduling order
      if (!scheduledDate) {
        errors.push('Scheduled date is required');
      }
      if (!order.delivery_address) {
        errors.push('Delivery address is required for scheduled orders');
      }
    }
    
    return { valid: errors.length === 0, errors };
  };

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
    watch,
  } = useForm<OrderStatusChange>({
    defaultValues: {
      order_id: order.id,
      new_status: newStatus,
      notes: '',
      scheduled_date: '',
    },
  });

  const watchedScheduledDate = watch('scheduled_date');

  useEffect(() => {
    reset({
      order_id: order.id,
      new_status: newStatus,
      notes: '',
      scheduled_date: newStatus === 'scheduled' ? new Date().toISOString().split('T')[0] : '',
    });
  }, [order.id, newStatus, reset]);

  // Fetch status info when modal opens or status changes
  useEffect(() => {
    const fetchStatusInfo = async () => {
      try {
        const [newStatusInfo, orderStatusInfo] = await Promise.all([
          getOrderStatusInfo(newStatus as any),
          getOrderStatusInfo(order.status as any)
        ]);
        setStatusInfo(newStatusInfo);
        setCurrentStatusInfo(orderStatusInfo);
      } catch (error) {
        console.error('Failed to fetch status info:', error);
        // Use fallback status info when tRPC client is unavailable
        const fallbackStatusInfo = getOrderStatusInfoFallback(newStatus);
        const fallbackCurrentStatusInfo = getOrderStatusInfoFallback(order.status);
        setStatusInfo(fallbackStatusInfo);
        setCurrentStatusInfo(fallbackCurrentStatusInfo);
      }
    };

    if (isOpen) {
      fetchStatusInfo();
    }
  }, [isOpen, newStatus, order.status]);

  // Validate order when status info is loaded or form data changes
  useEffect(() => {
    const validateOrder = () => {
      if (!statusInfo || !isOpen) return;

      setIsValidating(true);
      
      // Use fallback validation directly instead of trying tRPC first
      const fallbackValidation = validateOrderFallback(order, newStatus, watchedScheduledDate);
      setValidationErrors(fallbackValidation.errors);
      setIsValidating(false);
    };

    validateOrder();
  }, [statusInfo, newStatus, order, watchedScheduledDate, isOpen]);

  const handleFormSubmit = (data: OrderStatusChange) => {
    // Clean up the data before submission
    const submissionData = { ...data };
    
    // Handle scheduled_date field properly
    if (newStatus === 'scheduled') {
      if (submissionData.scheduled_date && submissionData.scheduled_date.length === 10) {
        // Convert YYYY-MM-DD to proper ISO datetime
        const date = new Date(submissionData.scheduled_date + 'T00:00:00.000Z');
        submissionData.scheduled_date = date.toISOString();
      } else if (!submissionData.scheduled_date) {
        // Remove empty scheduled_date to avoid validation errors
        delete submissionData.scheduled_date;
      }
    } else {
      // Remove scheduled_date for non-scheduled statuses
      delete submissionData.scheduled_date;
    }
    
    onSubmit(submissionData);
  };

  const requiresScheduledDate = newStatus === 'scheduled';
  const canProceed = validationErrors.length === 0 && !isValidating;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose} />
        
        <div className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg">
          <form onSubmit={handleSubmit(handleFormSubmit)}>
            <div className="bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold leading-6 text-gray-900">
                  Change Order Status
                </h3>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Status Change Info */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Current Status:</span>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${currentStatusInfo?.color || 'border-gray-300'}`}>
                      {order.status.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">New Status:</span>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusInfo?.color || 'border-gray-300'}`}>
                      {newStatus.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                  <div className="mt-2 text-sm text-gray-600">
                    {statusInfo?.description || 'Loading...'}
                  </div>
                </div>

                {/* Validation Errors */}
                {validationErrors.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-start space-x-2">
                      <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                      <div>
                        <h4 className="text-sm font-medium text-red-800">Cannot proceed:</h4>
                        <ul className="mt-1 text-sm text-red-700 list-disc list-inside">
                          {validationErrors.map((error, index) => (
                            <li key={index}>{error}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {/* Scheduled Date (if required) */}
                {requiresScheduledDate && (
                  <div>
                    <label htmlFor="scheduled_date" className="block text-sm font-medium text-gray-700">
                      Scheduled Delivery Date *
                    </label>
                    <input
                      type="date"
                      id="scheduled_date"
                      {...register('scheduled_date', { 
                        required: requiresScheduledDate ? 'Scheduled date is required' : false,
                        validate: (value) => {
                          if (requiresScheduledDate && value) {
                            const selectedDate = new Date(value);
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            if (selectedDate < today) {
                              return 'Scheduled date cannot be in the past';
                            }
                          }
                          return true;
                        }
                      })}
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      min={new Date().toISOString().split('T')[0]}
                    />
                    {errors.scheduled_date && (
                      <p className="mt-1 text-sm text-red-600">{errors.scheduled_date.message}</p>
                    )}
                  </div>
                )}

                {/* Status-specific warnings */}
                {newStatus === 'confirmed' && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm text-blue-800">
                      <strong>Note:</strong> Confirming this order will reserve inventory for all products.
                    </p>
                  </div>
                )}

                {newStatus === 'delivered' && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <p className="text-sm text-green-800">
                      <strong>Note:</strong> Marking as delivered will deduct inventory and release reserved stock.
                    </p>
                  </div>
                )}

                {newStatus === 'cancelled' && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-sm text-red-800">
                      <strong>Warning:</strong> Cancelling this order will release any reserved inventory.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
              <button
                type="submit"
                disabled={loading || !canProceed}
                className={`inline-flex w-full justify-center rounded-md px-3 py-2 text-sm font-semibold text-white shadow-sm sm:ml-3 sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed ${
                  newStatus === 'cancelled' 
                    ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
                    : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
                }`}
              >
                {loading ? (
                  <div className="flex items-center space-x-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Updating...</span>
                  </div>
                ) : (
                  `Change to ${statusInfo?.label || newStatus}`
                )}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};