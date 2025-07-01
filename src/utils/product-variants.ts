import { Product, CreateProductData, CreateVariantData } from '../types/product';
import { Order, CreateOrderData } from '../types/order';

// Product variant utilities
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

export const generateVariantSKU = (parentSKU: string, variantName: string): string => {
  return `${parentSKU}-${variantName.toLowerCase()}`;
};

export const createVariantProduct = (
  parentProduct: Product, 
  variantName: string, 
  description?: string
): CreateVariantData => {
  return {
    parent_product_id: parentProduct.id,
    variant_name: variantName,
    sku: generateVariantSKU(parentProduct.sku, variantName),
    name: `${parentProduct.name} (${variantName})`,
    description: description || `${variantName} variant of ${parentProduct.name}`,
    status: parentProduct.status,
    barcode_uid: undefined,
  };
};

// Standard cylinder variants
export const STANDARD_CYLINDER_VARIANTS = [
  { name: 'full', description: 'Full cylinder ready for delivery' },
  { name: 'empty', description: 'Empty cylinder for exchange/pickup' },
];

// Order type utilities
export const getOrderTypeDisplayName = (orderType: string): string => {
  switch (orderType) {
    case 'delivery':
      return 'Standard Delivery';
    case 'refill':
      return 'Refill Service';
    case 'exchange':
      return 'Cylinder Exchange';
    case 'pickup':
      return 'Empty Pickup';
    default:
      return orderType;
  }
};

export const getServiceTypeDisplayName = (serviceType: string): string => {
  switch (serviceType) {
    case 'standard':
      return 'Standard Service';
    case 'express':
      return 'Express Service';
    case 'scheduled':
      return 'Scheduled Service';
    default:
      return serviceType;
  }
};

// Business logic for order types
export const calculateExchangeQuantity = (order: CreateOrderData): number => {
  if (order.order_type === 'refill' || order.order_type === 'exchange') {
    // For refill orders, exchange quantity equals delivery quantity
    return order.exchange_empty_qty || 0;
  }
  return 0;
};

export const shouldRequirePickup = (orderType: string): boolean => {
  return orderType === 'exchange' || orderType === 'pickup';
};

export const validateOrderType = (order: CreateOrderData): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  // Validate refill orders
  if (order.order_type === 'refill') {
    if (order.exchange_empty_qty <= 0) {
      errors.push('Refill orders must specify quantity of empty cylinders to exchange');
    }
  }
  
  // Validate exchange orders
  if (order.order_type === 'exchange') {
    if (!order.requires_pickup) {
      errors.push('Exchange orders must require pickup of empty cylinders');
    }
    if (order.exchange_empty_qty <= 0) {
      errors.push('Exchange orders must specify quantity of empty cylinders');
    }
  }
  
  // Validate pickup orders
  if (order.order_type === 'pickup') {
    if (order.exchange_empty_qty <= 0) {
      errors.push('Pickup orders must specify quantity of cylinders to collect');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
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

export const calculateInventoryMovements = (order: Order): InventoryMovement[] => {
  const movements: InventoryMovement[] = [];
  
  if (!order.order_lines) return movements;
  
  for (const line of order.order_lines) {
    if (!line.product) continue;
    
    const product = line.product;
    const quantity = line.quantity;
    
    switch (order.order_type) {
      case 'delivery':
        // Standard delivery: deduct full cylinders
        movements.push({
          product_id: product.id,
          variant_name: 'full',
          qty_full_change: -quantity,
          qty_empty_change: 0,
          movement_type: 'delivery',
          description: `Delivered ${quantity} full ${product.name}`,
        });
        break;
        
      case 'refill':
        // Refill: deduct full, add empty
        movements.push({
          product_id: product.id,
          variant_name: 'full',
          qty_full_change: -quantity,
          qty_empty_change: 0,
          movement_type: 'delivery',
          description: `Delivered ${quantity} full ${product.name}`,
        });
        movements.push({
          product_id: product.id,
          variant_name: 'empty',
          qty_full_change: 0,
          qty_empty_change: quantity, // Picked up empties
          movement_type: 'pickup',
          description: `Picked up ${quantity} empty ${product.name}`,
        });
        break;
        
      case 'exchange':
        // Exchange: deduct full, add empty
        movements.push({
          product_id: product.id,
          variant_name: 'full',
          qty_full_change: -quantity,
          qty_empty_change: 0,
          movement_type: 'delivery',
          description: `Exchanged ${quantity} full ${product.name}`,
        });
        movements.push({
          product_id: product.id,
          variant_name: 'empty',
          qty_full_change: 0,
          qty_empty_change: order.exchange_empty_qty,
          movement_type: 'exchange',
          description: `Collected ${order.exchange_empty_qty} empty ${product.name}`,
        });
        break;
        
      case 'pickup':
        // Pickup only: add empty cylinders
        movements.push({
          product_id: product.id,
          variant_name: 'empty',
          qty_full_change: 0,
          qty_empty_change: order.exchange_empty_qty,
          movement_type: 'pickup',
          description: `Picked up ${order.exchange_empty_qty} empty ${product.name}`,
        });
        break;
    }
  }
  
  return movements;
};

// Product variant filtering and grouping
export const groupProductsByParent = (products: Product[]): { [parentId: string]: Product[] } => {
  const grouped: { [parentId: string]: Product[] } = {};
  
  products.forEach(product => {
    if (product.is_variant && product.parent_product_id) {
      if (!grouped[product.parent_product_id]) {
        grouped[product.parent_product_id] = [];
      }
      grouped[product.parent_product_id].push(product);
    }
  });
  
  return grouped;
};

export const getParentProducts = (products: Product[]): Product[] => {
  return products.filter(product => !product.is_variant);
};

export const getVariantProducts = (products: Product[]): Product[] => {
  return products.filter(product => product.is_variant);
}; 