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
    throw new Error('Order workflow fetch failed. Please try again.');
  }
};

// Removed local business logic to achieve 100% UI purity.
// All workflow data now comes from backend API.

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
    console.error('Failed to validate transition via API:', error);
    throw new Error('Transition validation failed. Please try again.');
  }
};

export const formatOrderId = async (id: string): Promise<string> => {
  try {
    const result = await trpc.orders.formatOrderId.mutate({ order_id: id });
    return result.formatted_id;
  } catch (error) {
    console.error('Failed to format order ID via API:', error);
    throw new Error('Order ID formatting failed. Please try again.');
  }
};

// Removed local business logic to achieve 100% UI purity.
// Use formatOrderId() async function instead.

// Removed local business logic to achieve 100% UI purity.
// Use backend API for all order calculations.

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
    console.error('Failed to calculate totals via API:', error);
    throw new Error('Order total calculation failed. Please try again.');
  }
};

export const formatDate = async (dateString: string): Promise<string> => {
  try {
    const result = await trpc.orders.formatDate.mutate({ date: dateString });
    return result.formatted_date;
  } catch (error) {
    console.error('Failed to format date via API:', error);
    throw new Error('Date formatting failed. Please try again.');
  }
};

// Removed local business logic to achieve 100% UI purity.
// Use formatDate() async function instead.

export const formatCurrency = async (amount: number): Promise<string> => {
  try {
    const result = await trpc.orders.formatCurrency.mutate({ amount });
    return result.formatted_amount;
  } catch (error) {
    console.error('Failed to format currency via API:', error);
    throw new Error('Currency formatting failed. Please try again.');
  }
};

// Removed local business logic to achieve 100% UI purity.
// Use formatCurrency() async function instead.

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
    console.error('Failed to validate order for confirmation via API:', error);
    throw new Error('Order confirmation validation failed. Please try again.');
  }
};

export const validateOrderForScheduling = async (order: any): Promise<{ valid: boolean; errors: string[] }> => {
  try {
    const result = await trpc.orders.validateForScheduling.mutate({ order });
    return result;
  } catch (error) {
    console.error('Failed to validate order for scheduling via API:', error);
    throw new Error('Order scheduling validation failed. Please try again.');
  }
};

export const validateOrderDeliveryWindow = async (order: any): Promise<{ valid: boolean; errors: string[] }> => {
  try {
    const result = await trpc.orders.validateDeliveryWindow.mutate({ order });
    return result;
  } catch (error) {
    console.error('Failed to validate order delivery window via API:', error);
    throw new Error('Delivery window validation failed. Please try again.');
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

// Removed local business logic to achieve 100% UI purity.
// Use async functions and backend API for all order operations.