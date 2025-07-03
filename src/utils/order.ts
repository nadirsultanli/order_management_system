import { OrderStatus, OrderWorkflowStep } from '../types/order';
import { trpc } from '../lib/trpc-client';

// Note: Business logic has been moved to backend. 
// These functions now use backend APIs for consistency and centralized logic.

// Cache for workflow data to avoid repeated API calls
let workflowCache: OrderWorkflowStep[] | null = null;

export const getOrderWorkflow = async (): Promise<OrderWorkflowStep[]> => {
  if (workflowCache) {
    return workflowCache;
  }
  
  try {
    const workflow = await trpc.orders.getWorkflow.query();
    workflowCache = workflow;
    return workflow;
  } catch (error) {
    console.error('Failed to fetch workflow from backend:', error);
    // Fallback to local data if backend is unavailable
    return getOrderWorkflowFallback();
  }
};

// Fallback workflow data for offline scenarios
const getOrderWorkflowFallback = (): OrderWorkflowStep[] => [
  {
    status: 'draft',
    label: 'Draft',
    description: 'Order is being created',
    color: 'bg-gray-100 text-gray-800 border-gray-200',
    icon: 'FileText',
    allowedTransitions: ['confirmed', 'cancelled'],
  },
  {
    status: 'confirmed',
    label: 'Confirmed',
    description: 'Order confirmed, stock reserved',
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    icon: 'CheckCircle',
    allowedTransitions: ['scheduled', 'cancelled'],
  },
  {
    status: 'scheduled',
    label: 'Scheduled',
    description: 'Delivery date scheduled',
    color: 'bg-purple-100 text-purple-800 border-purple-200',
    icon: 'Calendar',
    allowedTransitions: ['en_route', 'cancelled'],
  },
  {
    status: 'en_route',
    label: 'En Route',
    description: 'Out for delivery',
    color: 'bg-orange-100 text-orange-800 border-orange-200',
    icon: 'Truck',
    allowedTransitions: ['delivered'],
  },
  {
    status: 'delivered',
    label: 'Delivered',
    description: 'Successfully delivered',
    color: 'bg-green-100 text-green-800 border-green-200',
    icon: 'Package',
    allowedTransitions: ['invoiced'],
  },
  {
    status: 'invoiced',
    label: 'Invoiced',
    description: 'Invoice generated',
    color: 'bg-teal-100 text-teal-800 border-teal-200',
    icon: 'Receipt',
    allowedTransitions: [],
  },
  {
    status: 'cancelled',
    label: 'Cancelled',
    description: 'Order cancelled',
    color: 'bg-red-100 text-red-800 border-red-200',
    icon: 'XCircle',
    allowedTransitions: [],
  },
];

export const getOrderStatusInfo = async (status: OrderStatus): Promise<OrderWorkflowStep> => {
  const workflow = await getOrderWorkflow();
  return workflow.find(step => step.status === status) || workflow[0];
};

export const canTransitionTo = async (currentStatus: OrderStatus, newStatus: OrderStatus): Promise<boolean> => {
  try {
    const result = await trpc.orders.validateTransition.mutate({
      current_status: currentStatus,
      new_status: newStatus,
    });
    return result.valid;
  } catch (error) {
    console.error('Failed to validate transition:', error);
    // Fallback to local logic
    const currentStep = await getOrderStatusInfo(currentStatus);
    return currentStep.allowedTransitions.includes(newStatus);
  }
};

export const formatOrderId = async (id: string): Promise<string> => {
  try {
    const result = await trpc.orders.formatOrderId.mutate({ order_id: id });
    return result.formatted_id;
  } catch (error) {
    console.error('Failed to format order ID:', error);
    // Fallback to local logic
    return `#${id.slice(-8).toUpperCase()}`;
  }
};

// Synchronous version for backward compatibility
export const formatOrderIdSync = (id: string): string => {
  return `#${id.slice(-8).toUpperCase()}`;
};

export const calculateOrderTotal = (lines: { quantity: number; unit_price: number }[]): number => {
  return lines.reduce((total, line) => total + (line.quantity * line.unit_price), 0);
};

export const calculateOrderTotalWithTax = async (
  lines: { quantity: number; unit_price: number; subtotal?: number }[], 
  taxPercent: number = 0
): Promise<{ subtotal: number; taxAmount: number; grandTotal: number }> => {
  try {
    const result = await trpc.orders.calculateTotals.mutate({
      lines,
      tax_percent: taxPercent,
    });
    return result;
  } catch (error) {
    console.error('Failed to calculate totals:', error);
    // Fallback to local logic
    const subtotal = lines.reduce((total, line) => total + (line.subtotal || line.quantity * line.unit_price), 0);
    const taxAmount = subtotal * (taxPercent / 100);
    const grandTotal = subtotal + taxAmount;
    return { subtotal, taxAmount, grandTotal };
  }
};

export const formatDate = async (dateString: string): Promise<string> => {
  try {
    const result = await trpc.orders.formatDate.mutate({ date: dateString });
    return result.formatted_date;
  } catch (error) {
    console.error('Failed to format date:', error);
    // Fallback to local logic
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }
};

// Synchronous version for backward compatibility
export const formatDateSync = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

export const formatCurrency = async (amount: number): Promise<string> => {
  try {
    const result = await trpc.orders.formatCurrency.mutate({ amount });
    return result.formatted_amount;
  } catch (error) {
    console.error('Failed to format currency:', error);
    // Fallback to local logic
    return `Ksh ${amount.toLocaleString('en-KE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
};

// Synchronous version for backward compatibility
export const formatCurrencySync = (amount: number): string => {
  return `Ksh ${amount.toLocaleString('en-KE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

export const isOrderEditable = async (status: OrderStatus): Promise<boolean> => {
  try {
    // We can get this from workflow info, but for now use local logic for performance
    return ['draft', 'confirmed'].includes(status);
  } catch (error) {
    console.error('Failed to check if order is editable:', error);
    return ['draft', 'confirmed'].includes(status);
  }
};

export const isOrderCancellable = async (status: OrderStatus): Promise<boolean> => {
  try {
    // We can get this from workflow info, but for now use local logic for performance
    return ['draft', 'confirmed', 'scheduled'].includes(status);
  } catch (error) {
    console.error('Failed to check if order is cancellable:', error);
    return ['draft', 'confirmed', 'scheduled'].includes(status);
  }
};

export const getStatusColor = async (status: OrderStatus): Promise<string> => {
  const statusInfo = await getOrderStatusInfo(status);
  return statusInfo.color;
};

export const getNextPossibleStatuses = async (currentStatus: OrderStatus): Promise<OrderStatus[]> => {
  const currentStep = await getOrderStatusInfo(currentStatus);
  return currentStep.allowedTransitions;
};

export const validateOrderForConfirmation = async (order: any): Promise<{ valid: boolean; errors: string[] }> => {
  try {
    const result = await trpc.orders.validateForConfirmation.mutate({ order });
    return result;
  } catch (error) {
    console.error('Failed to validate order for confirmation:', error);
    // Fallback to local logic
    const errors: string[] = [];

    if (!order.customer_id) {
      errors.push('Customer is required');
    }

    if (!order.delivery_address_id) {
      errors.push('Delivery address is required');
    }

    if (!order.order_lines || order.order_lines.length === 0) {
      errors.push('At least one product is required');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
};

export const validateOrderForScheduling = async (order: any): Promise<{ valid: boolean; errors: string[] }> => {
  try {
    const result = await trpc.orders.validateForScheduling.mutate({ order });
    return result;
  } catch (error) {
    console.error('Failed to validate order for scheduling:', error);
    // Fallback to local logic
    const errors: string[] = [];

    if (!order.scheduled_date) {
      errors.push('Scheduled date is required');
    }

    if (!order.delivery_address_id && !order.delivery_address) {
      errors.push('Delivery address is required');
    }

    // Validate scheduled date is not in the past
    if (order.scheduled_date) {
      const scheduledDate = new Date(order.scheduled_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (scheduledDate < today) {
        errors.push('Scheduled date cannot be in the past');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
};

export const validateOrderDeliveryWindow = async (order: any): Promise<{ valid: boolean; errors: string[] }> => {
  try {
    const result = await trpc.orders.validateDeliveryWindow.mutate({ order });
    return result;
  } catch (error) {
    console.error('Failed to validate order delivery window:', error);
    // Fallback to local logic
    const errors: string[] = [];
    
    // Time window is completely optional for orders
    if (order.delivery_address?.delivery_window_start && order.delivery_address?.delivery_window_end) {
      const startTime = new Date(`1970-01-01T${order.delivery_address.delivery_window_start}`);
      const endTime = new Date(`1970-01-01T${order.delivery_address.delivery_window_end}`);
      
      if (startTime >= endTime) {
        errors.push('Delivery window end time must be after start time');
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
    };
  }
};

// Additional utility function to get comprehensive workflow info for an order
export const getOrderWorkflowInfo = async (orderId: string) => {
  try {
    const result = await trpc.orders.getWorkflowInfo.query({ order_id: orderId });
    return result;
  } catch (error) {
    console.error('Failed to get order workflow info:', error);
    throw error;
  }
};

// Synchronous versions for backward compatibility where async isn't feasible
export const getOrderStatusInfoSync = (status: OrderStatus): OrderWorkflowStep => {
  const workflow = getOrderWorkflowFallback();
  return workflow.find(step => step.status === status) || workflow[0];
};

export const canTransitionToSync = (currentStatus: OrderStatus, newStatus: OrderStatus): boolean => {
  const currentStep = getOrderStatusInfoSync(currentStatus);
  return currentStep.allowedTransitions.includes(newStatus);
};

export const getStatusColorSync = (status: OrderStatus): string => {
  const statusInfo = getOrderStatusInfoSync(status);
  return statusInfo.color;
};

export const getNextPossibleStatusesSync = (currentStatus: OrderStatus): OrderStatus[] => {
  const currentStep = getOrderStatusInfoSync(currentStatus);
  return currentStep.allowedTransitions;
};

export const isOrderEditableSync = (status: OrderStatus): boolean => {
  return ['draft', 'confirmed'].includes(status);
};

export const isOrderCancellableSync = (status: OrderStatus): boolean => {
  return ['draft', 'confirmed', 'scheduled'].includes(status);
};