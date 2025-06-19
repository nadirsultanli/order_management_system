import React, { useEffect } from 'react';
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

  const handleFormSubmit = (data: OrderStatusChange) => {
    onSubmit(data);
  };

  const statusInfo = getOrderStatusInfo(newStatus as any);
  const requiresScheduledDate = newStatus === 'scheduled';

  // Validation based on new status
  const getValidationErrors = () => {
    const errors: string[] = [];

    if (newStatus === 'confirmed') {
      const validation = validateOrderForConfirmation(order);
      errors.push(...validation.errors);
    } else if (newStatus === 'scheduled') {
      if (!watchedScheduledDate) {
        errors.push('Scheduled date is required');
      }
      if (!order.delivery_address) {
        errors.push('Delivery address is required');
      }
    }

    return errors;
  };

  const validationErrors = getValidationErrors();
  const canProceed = validationErrors.length === 0;

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
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getOrderStatusInfo(order.status as any).color}`}>
                      {order.status.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">New Status:</span>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusInfo.color}`}>
                      {newStatus.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                  <div className="mt-2 text-sm text-gray-600">
                    {statusInfo.description}
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

                {/* Notes */}
                {newStatus === 'cancelled' && (
                  <div>
                    <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
                      Notes *
                    </label>
                    <textarea
                      id="notes"
                      rows={3}
                      {...register('notes', {
                        required: 'Cancellation reason is required',
                      })}
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="Please provide a reason for cancellation..."
                    />
                    {errors.notes && (
                      <p className="mt-1 text-sm text-red-600">{errors.notes.message}</p>
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
                  `Change to ${statusInfo.label}`
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