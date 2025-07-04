import { z } from 'zod';

// Order status enum
export type OrderStatus = 'draft' | 'confirmed' | 'scheduled' | 'en_route' | 'delivered' | 'invoiced' | 'cancelled';

// Order workflow step interface
export interface OrderWorkflowStep {
  status: OrderStatus;
  label: string;
  description: string;
  color: string;
  icon: string;
  allowedTransitions: OrderStatus[];
  estimatedDuration?: number; // in hours
}

// Order validation interfaces
export interface OrderValidationResult {
  valid: boolean;
  errors: string[];
}

export interface OrderTotalCalculation {
  subtotal: number;
  taxAmount: number;
  grandTotal: number;
}

// Order workflow definition
export const getOrderWorkflow = (): OrderWorkflowStep[] => [
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

// Get order status information
export const getOrderStatusInfo = (status: OrderStatus): OrderWorkflowStep => {
  const workflow = getOrderWorkflow();
  return workflow.find(step => step.status === status) || workflow[0];
};

// Check if status transition is allowed
export const canTransitionTo = (currentStatus: OrderStatus, newStatus: OrderStatus): boolean => {
  const currentStep = getOrderStatusInfo(currentStatus);
  return currentStep.allowedTransitions.includes(newStatus);
};

// Validate status transition
export const validateTransition = (currentStatus: OrderStatus, newStatus: OrderStatus): OrderValidationResult => {
  const errors: string[] = [];
  
  if (currentStatus === newStatus) {
    errors.push('New status must be different from current status');
  }
  
  if (!canTransitionTo(currentStatus, newStatus)) {
    const currentStep = getOrderStatusInfo(currentStatus);
    const allowedTransitions = currentStep.allowedTransitions.map(status => 
      getOrderStatusInfo(status).label
    ).join(', ');
    
    errors.push(`Cannot transition from ${currentStep.label} to ${getOrderStatusInfo(newStatus).label}. Allowed transitions: ${allowedTransitions}`);
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
};

// Format order ID for display
export const formatOrderId = (id: string): string => {
  return `#${id.slice(-8).toUpperCase()}`;
};

// Calculate order total
export const calculateOrderTotal = (lines: { quantity: number; unit_price: number }[]): number => {
  return lines.reduce((total, line) => total + (line.quantity * line.unit_price), 0);
};

// Calculate order total with tax
export const calculateOrderTotalWithTax = (
  lines: { quantity: number; unit_price: number; subtotal?: number }[], 
  taxPercent: number = 0
): OrderTotalCalculation => {
  const subtotal = lines.reduce((total, line) => total + (line.subtotal || line.quantity * line.unit_price), 0);
  const taxAmount = subtotal * (taxPercent / 100);
  const grandTotal = subtotal + taxAmount;
  
  return { subtotal, taxAmount, grandTotal };
};

// Format date for display
export const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

// Format currency
export const formatCurrency = (amount: number): string => {
  // Handle invalid input gracefully
  if (typeof amount !== 'number' || isNaN(amount) || !isFinite(amount)) {
    return 'Ksh 0.00';
  }
  
  try {
    return `Ksh ${amount.toLocaleString('en-KE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  } catch (error) {
    // Fallback if locale string fails
    return `Ksh ${amount.toFixed(2)}`;
  }
};

// Check if order is editable
export const isOrderEditable = (status: OrderStatus): boolean => {
  return ['draft', 'confirmed'].includes(status);
};

// Check if order is cancellable
export const isOrderCancellable = (status: OrderStatus): boolean => {
  return ['draft', 'confirmed', 'scheduled'].includes(status);
};

// Get status color
export const getStatusColor = (status: OrderStatus): string => {
  const statusInfo = getOrderStatusInfo(status);
  return statusInfo.color;
};

// Get next possible statuses
export const getNextPossibleStatuses = (currentStatus: OrderStatus): OrderStatus[] => {
  const currentStep = getOrderStatusInfo(currentStatus);
  return currentStep.allowedTransitions;
};

// Validate order for confirmation
export const validateOrderForConfirmation = (order: any): OrderValidationResult => {
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

  // Validate order lines have valid quantities and prices
  if (order.order_lines) {
    order.order_lines.forEach((line: any, index: number) => {
      if (!line.quantity || line.quantity <= 0) {
        errors.push(`Line ${index + 1}: Quantity must be greater than 0`);
      }
      if (!line.unit_price || line.unit_price <= 0) {
        errors.push(`Line ${index + 1}: Unit price must be greater than 0`);
      }
      if (!line.product_id) {
        errors.push(`Line ${index + 1}: Product is required`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

// Validate order for scheduling
export const validateOrderForScheduling = (order: any): OrderValidationResult => {
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
};

// Validate order delivery window
export const validateOrderDeliveryWindow = (order: any): OrderValidationResult => {
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
};

// Zod schemas for validation
export const OrderStatusSchema = z.enum(['draft', 'confirmed', 'scheduled', 'en_route', 'delivered', 'invoiced', 'cancelled']);

export const OrderLineSchema = z.object({
  quantity: z.number().positive(),
  unit_price: z.number().positive(),
  subtotal: z.number().optional(),
});

export const OrderValidationSchema = z.object({
  customer_id: z.string().uuid(),
  delivery_address_id: z.string().uuid().optional(),
  order_lines: z.array(OrderLineSchema),
  scheduled_date: z.string().datetime().optional(),
});

export const StatusTransitionSchema = z.object({
  current_status: OrderStatusSchema,
  new_status: OrderStatusSchema,
});

export const CalculateTotalsSchema = z.object({
  lines: z.array(z.object({
    quantity: z.number().positive(),
    unit_price: z.number().positive(),
    subtotal: z.number().optional(),
  })),
  tax_percent: z.number().min(0).max(100).optional(),
});