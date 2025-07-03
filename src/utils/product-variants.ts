import { Product, CreateProductData, CreateVariantData } from '../types/product';
import { Order, CreateOrderData } from '../types/order';
import { trpc } from '../lib/trpc-client';

// Pure UI utility functions - these are acceptable as they only format data
export const isParentProduct = (product: Product): boolean => {
  return !product.is_variant && product.variant_type !== undefined;
};

export const isVariantProduct = (product: Product): boolean => {
  return product.is_variant && !!product.parent_product_id;
};

export const getVariantDisplayName = (product: Product): string => {
  if (product.variant_name) {
    return `${product.name} (${product.variant_name})`;
  }
  return product.name;
};

export const generateVariantSKU = async (parentSKU: string, variantName: string): Promise<string> => {
  try {
    const result = await trpc.products.generateVariantSku.mutate({
      parent_sku: parentSKU,
      variant_name: variantName,
    });
    return result.variant_sku;
  } catch (error) {
    console.error('Failed to generate variant SKU via API:', error);
    throw new Error('Variant SKU generation failed. Please try again.');
  }
};

export const createVariantProduct = async (
  parentProduct: Product, 
  variantName: string, 
  description?: string
): Promise<CreateVariantData> => {
  try {
    const result = await trpc.products.createVariantData.mutate({
      parent_product: {
        id: parentProduct.id,
        sku: parentProduct.sku,
        name: parentProduct.name,
        status: parentProduct.status,
      },
      variant_name: variantName,
      description,
    });
    return result;
  } catch (error) {
    console.error('Failed to create variant data via API:', error);
    throw new Error('Variant product creation failed. Please try again.');
  }
};

// UI-only placeholder - NO business data
export const STANDARD_CYLINDER_VARIANTS = [
  { name: 'Loading...', description: 'Please use getStandardCylinderVariants() API' },
];

// Standard cylinder variants - Now fetched from backend
export const getStandardCylinderVariants = async (): Promise<Array<{ name: string; description: string }>> => {
  try {
    const result = await trpc.products.getStandardCylinderVariants.query();
    return result.variants;
  } catch (error) {
    console.error('Failed to fetch standard cylinder variants via API:', error);
    throw new Error('Cylinder variants must be fetched from backend. No local fallback.');
  }
};

// Display name functions for backward compatibility
export const getOrderTypeDisplayName = (orderType: string): string => {
  const orderTypeMap: Record<string, string> = {
    delivery: 'Delivery',
    refill: 'Refill',
    exchange: 'Exchange',
    pickup: 'Pickup',
  };
  return orderTypeMap[orderType] || orderType;
};

export const getServiceTypeDisplayName = (serviceType: string): string => {
  const serviceTypeMap: Record<string, string> = {
    standard: 'Standard',
    express: 'Express',
    emergency: 'Emergency',
    scheduled: 'Scheduled',
  };
  return serviceTypeMap[serviceType] || serviceType;
};

// Business logic for order types - Now uses backend API
export const calculateExchangeQuantity = async (order: CreateOrderData): Promise<number> => {
  try {
    const result = await trpc.products.calculateExchangeQuantity.mutate({
      order: {
        order_type: order.order_type,
        exchange_empty_qty: order.exchange_empty_qty || 0,
      },
    });
    return result.exchange_quantity;
  } catch (error) {
    console.error('Failed to calculate exchange quantity via API:', error);
    throw new Error('Exchange quantity calculation failed. Please try again.');
  }
};

export const shouldRequirePickup = async (orderType: string): Promise<boolean> => {
  try {
    const result = await trpc.products.shouldRequirePickup.mutate({
      order_type: orderType as 'delivery' | 'refill' | 'exchange' | 'pickup',
    });
    return result.requires_pickup;
  } catch (error) {
    console.error('Failed to check pickup requirement via API:', error);
    throw new Error('Pickup requirement check failed. Please try again.');
  }
};

export const validateOrderType = async (order: CreateOrderData): Promise<{ valid: boolean; errors: string[] }> => {
  try {
    const result = await trpc.products.validateOrderType.mutate({
      order: {
        order_type: order.order_type,
        exchange_empty_qty: order.exchange_empty_qty || 0,
        requires_pickup: order.requires_pickup || false,
      },
    });
    return result;
  } catch (error) {
    console.error('Failed to validate order type via API:', error);
    throw new Error('Order type validation failed. Please try again.');
  }
};

// Inventory movement calculations
export interface InventoryMovement {
  product_id: string;
  variant_name: string;
  qty_full_change: number;
  qty_empty_change: number;
  movement_type: 'delivery' | 'pickup' | 'exchange';
  description: string;
}

export const calculateInventoryMovements = async (order: Order): Promise<InventoryMovement[]> => {
  try {
    const result = await trpc.products.calculateInventoryMovements.mutate({
      order: {
        id: order.id,
        order_type: order.order_type,
        exchange_empty_qty: order.exchange_empty_qty || 0,
        order_lines: (order.order_lines || []).map(line => ({
          id: line.id,
          product_id: line.product_id,
          quantity: line.quantity,
          product: {
            id: line.product?.id || line.product_id,
            name: line.product?.name || 'Unknown Product',
          },
        })),
      },
    });
    return result.movements;
  } catch (error) {
    console.error('Failed to calculate inventory movements via API:', error);
    throw new Error('Inventory movements calculation failed. Please try again.');
  }
};

// Removed local business logic to achieve 100% UI purity.
// Use backend API for product filtering and grouping operations. 