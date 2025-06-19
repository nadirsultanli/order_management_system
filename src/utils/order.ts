import { OrderStatus, OrderWorkflowStep } from '../types/order';

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

export const getOrderStatusInfo = (status: OrderStatus) => {
  const workflow = getOrderWorkflow();
  return workflow.find(step => step.status === status) || workflow[0];
};

export const canTransitionTo = (currentStatus: OrderStatus, newStatus: OrderStatus): boolean => {
  const currentStep = getOrderStatusInfo(currentStatus);
  return currentStep.allowedTransitions.includes(newStatus);
};

export const formatOrderId = (id: string): string => {
  return `#${id.slice(-8).toUpperCase()}`;
};

export const calculateOrderTotal = (lines: { quantity: number; unit_price: number }[]): number => {
  return lines.reduce((total, line) => total + (line.quantity * line.unit_price), 0);
};

export const calculateOrderTotalWithTax = (
  lines: { quantity: number; unit_price: number; subtotal?: number }[], 
  taxPercent: number = 0
): { subtotal: number; taxAmount: number; grandTotal: number } => {
  const subtotal = lines.reduce((total, line) => total + (line.subtotal || line.quantity * line.unit_price), 0);
  const taxAmount = subtotal * (taxPercent / 100);
  const grandTotal = subtotal + taxAmount;
  
  return { subtotal, taxAmount, grandTotal };
};

export const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

export const formatCurrency = (amount: number) => {
  return `Ksh ${amount.toLocaleString('en-KE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

export const isOrderEditable = (status: OrderStatus): boolean => {
  return ['draft', 'confirmed'].includes(status);
};

export const isOrderCancellable = (status: OrderStatus): boolean => {
  return ['draft', 'confirmed', 'scheduled'].includes(status);
};

export const getStatusColor = (status: OrderStatus): string => {
  const statusInfo = getOrderStatusInfo(status);
  return statusInfo.color;
};

export const getNextPossibleStatuses = (currentStatus: OrderStatus): OrderStatus[] => {
  const currentStep = getOrderStatusInfo(currentStatus);
  return currentStep.allowedTransitions;
};

export const validateOrderForConfirmation = (order: any): { valid: boolean; errors: string[] } => {
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
};

export const validateOrderForScheduling = (order: any): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!order.scheduled_date) {
    errors.push('Scheduled date is required');
  }

  if (!order.delivery_address) {
    errors.push('Delivery address is required');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};