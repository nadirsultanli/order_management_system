import { TRPCError } from '@trpc/server';
import type { SupabaseClient } from '@supabase/supabase-js';

// Transfer validation types
export interface MultiSkuTransferItem {
  id?: string;
  product_id: string;
  product_sku: string;
  product_name: string;
  variant_name?: string;
  variant_type?: 'cylinder' | 'refillable' | 'disposable';
  quantity_to_transfer: number;
  available_stock?: number;
  reserved_stock?: number;
  unit_weight_kg?: number;
  total_weight_kg?: number;
  unit_cost?: number;
  total_cost?: number;
  source_location?: string;
  batch_number?: string;
  expiry_date?: string;
  is_valid: boolean;
  validation_errors: string[];
  validation_warnings: string[];
}

export interface MultiSkuTransfer {
  id?: string;
  transfer_reference?: string;
  source_warehouse_id: string;
  source_warehouse_name?: string;
  destination_warehouse_id: string;
  destination_warehouse_name?: string;
  transfer_date: string;
  scheduled_date?: string;
  completed_date?: string;
  status: 'draft' | 'pending' | 'approved' | 'in_transit' | 'completed' | 'cancelled';
  transfer_type: 'internal' | 'external' | 'adjustment' | 'return';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  items: MultiSkuTransferItem[];
  total_items: number;
  total_quantity: number;
  total_weight_kg?: number;
  total_cost?: number;
  notes?: string;
  reason?: string;
  instructions?: string;
  created_by_user_id: string;
  created_by_user_name?: string;
  approved_by_user_id?: string;
  approved_by_user_name?: string;
  processed_by_user_id?: string;
  created_at: string;
  updated_at: string;
  approved_at?: string;
  processed_at?: string;
  truck_id?: string;
  route_id?: string;
  tracking_number?: string;
  external_reference?: string;
}

export interface TransferValidationResult {
  is_valid: boolean;
  errors: string[];
  warnings: string[];
  blocked_items: string[];
  total_weight_kg: number;
  estimated_cost?: number;
}

export interface WarehouseStockInfo {
  warehouse_id: string;
  warehouse_name: string;
  product_id: string;
  product_sku: string;
  product_name: string;
  variant_name?: string;
  qty_available: number;
  qty_reserved: number;
  qty_on_order: number;
  qty_full?: number;
  qty_empty?: number;
  locations: Array<{
    location_code: string;
    location_name: string;
    quantity: number;
  }>;
  last_updated: string;
  reorder_level?: number;
  max_capacity?: number;
}

export interface TransferSummary {
  total_products: number;
  total_quantity: number;
  total_weight_kg: number;
  total_cost?: number;
  unique_variants: number;
  heaviest_item?: MultiSkuTransferItem;
  most_expensive_item?: MultiSkuTransferItem;
  validation_summary: {
    valid_items: number;
    invalid_items: number;
    items_with_warnings: number;
  };
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  description?: string;
  unit_of_measure: 'cylinder' | 'kg';
  capacity_kg?: number;
  tare_weight_kg?: number;
  valve_type?: string;
  status: 'active' | 'obsolete';
  barcode_uid?: string;
  requires_tag: boolean;
  created_at: string;
  variant_type: 'cylinder' | 'refillable' | 'disposable';
  parent_product_id?: string;
  variant_name?: string;
  is_variant: boolean;
  parent_product?: Product;
  variants?: Product[];
  // Tax-related fields
  tax_category?: string;
  tax_rate?: number;
}

// Standard cylinder weights (kg) - can be customized per product
export const CYLINDER_WEIGHTS = {
  '6kg': { full: 16, empty: 10, net: 6 },
  '13kg': { full: 27, empty: 14, net: 13 },
  '48kg': { full: 98, empty: 50, net: 48 },
  '90kg': { full: 180, empty: 90, net: 90 }
} as const;

/**
 * Validate a complete multi-SKU transfer
 */
export function validateMultiSkuTransfer(
  transfer: Partial<MultiSkuTransfer>,
  warehouseStockData: WarehouseStockInfo[]
): TransferValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const blocked_items: string[] = [];
  let total_weight_kg = 0;
  let estimated_cost = 0;

  // Basic transfer validation
  if (!transfer.source_warehouse_id) {
    errors.push('Source warehouse is required');
  }

  if (!transfer.destination_warehouse_id) {
    errors.push('Destination warehouse is required');
  }

  if (transfer.source_warehouse_id === transfer.destination_warehouse_id) {
    errors.push('Source and destination warehouses must be different');
  }

  if (!transfer.transfer_date) {
    errors.push('Transfer date is required');
  }

  if (!transfer.items || transfer.items.length === 0) {
    errors.push('At least one item must be selected for transfer');
  }

  // Validate transfer date
  if (transfer.transfer_date) {
    // Parse the date string and create a date at midnight in local timezone
    const [year, month, day] = transfer.transfer_date.split('-').map(Number);
    const transferDate = new Date(year, month - 1, day); // month is 0-indexed
    
    // Get today's date at midnight in local timezone
    const today = new Date();
    const todayAtMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    if (transferDate < todayAtMidnight) {
      errors.push('Transfer date cannot be in the past');
    }
  }

  // Validate each item
  if (transfer.items) {
    for (const item of transfer.items) {
      const itemValidation = validateTransferItem(item, warehouseStockData);
      
      if (!itemValidation.is_valid) {
        blocked_items.push(item.product_id);
        errors.push(...itemValidation.errors.map(e => `${item.product_name}: ${e}`));
      }
      
      if (itemValidation.warnings.length > 0) {
        warnings.push(...itemValidation.warnings.map(w => `${item.product_name}: ${w}`));
      }

      total_weight_kg += item.total_weight_kg || 0;
      estimated_cost += item.total_cost || 0;
    }

    // Check for duplicate items
    const itemKeys = transfer.items.map(item => `${item.product_id}-${item.variant_name || 'default'}`);
    const uniqueKeys = new Set(itemKeys);
    if (itemKeys.length !== uniqueKeys.size) {
      errors.push('Duplicate products with same variant are not allowed');
    }

    // Check transfer limits
    if (transfer.items.length > 100) {
      warnings.push('Large transfers with over 100 items may take longer to process');
    }

    if (total_weight_kg > 5000) {
      warnings.push('Heavy transfer (over 5 tons) may require special handling');
    }
  }

  return {
    is_valid: errors.length === 0,
    errors,
    warnings,
    blocked_items,
    total_weight_kg,
    estimated_cost: estimated_cost > 0 ? estimated_cost : undefined
  };
}

/**
 * Validate a single transfer item
 */
export function validateTransferItem(
  item: MultiSkuTransferItem,
  warehouseStockData: WarehouseStockInfo[]
): { is_valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Find stock info for this item
  const stockInfo = warehouseStockData.find(
    stock => stock.product_id === item.product_id && 
             stock.variant_name === item.variant_name
  );

  // Basic validation
  if (!item.product_id) {
    errors.push('Product ID is required');
  }

  if (!item.quantity_to_transfer || item.quantity_to_transfer <= 0) {
    errors.push('Transfer quantity must be greater than 0');
  }

  if (item.quantity_to_transfer % 1 !== 0) {
    errors.push('Transfer quantity must be a whole number');
  }

  // Stock availability validation
  if (stockInfo) {
    const availableForTransfer = stockInfo.qty_available - (stockInfo.qty_reserved || 0);
    
    if (item.quantity_to_transfer > availableForTransfer) {
      errors.push(`Insufficient stock. Available: ${availableForTransfer}, Requested: ${item.quantity_to_transfer}`);
    }

    if (item.quantity_to_transfer > stockInfo.qty_available * 0.9) {
      warnings.push('Transferring more than 90% of available stock');
    }

    // Check reorder levels
    if (stockInfo.reorder_level && 
        (stockInfo.qty_available - item.quantity_to_transfer) < stockInfo.reorder_level) {
      warnings.push(`Stock will fall below reorder level (${stockInfo.reorder_level})`);
    }
  } else {
    errors.push('Stock information not found for this product');
  }

  // Quantity limits
  if (item.quantity_to_transfer > 1000) {
    warnings.push('Large quantity transfer may require special approval');
  }

  return {
    is_valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Calculate transfer item weight and cost
 */
export function calculateTransferItemDetails(
  item: MultiSkuTransferItem,
  product: Product
): MultiSkuTransferItem {
  let unit_weight_kg = 0;
  let unit_cost = 0;

  // Calculate weight based on product type and variant
  if (product.is_variant && product.variant_name && product.parent_product_id) {
    // For cylinder variants, use standard weights
    if (product.capacity_kg) {
      const capacity = `${product.capacity_kg}kg` as keyof typeof CYLINDER_WEIGHTS;
      const weights = CYLINDER_WEIGHTS[capacity];
      
      if (weights) {
        if (product.variant_name === 'full') {
          unit_weight_kg = weights.full;
        } else if (product.variant_name === 'empty') {
          unit_weight_kg = weights.empty;
        }
      }
    }
  } else {
    // For non-variant products, use product specifications
    if (product.capacity_kg && product.tare_weight_kg) {
      unit_weight_kg = product.capacity_kg + product.tare_weight_kg;
    } else if (product.capacity_kg) {
      unit_weight_kg = product.capacity_kg + 10; // default tare weight
    }
  }

  // Calculate costs - would integrate with PricingService in production
  unit_cost = 0; // Future: Get from inventory_balance.unit_cost or PricingService

  return {
    ...item,
    unit_weight_kg,
    total_weight_kg: unit_weight_kg * item.quantity_to_transfer,
    unit_cost,
    total_cost: unit_cost * item.quantity_to_transfer
  };
}

/**
 * Generate transfer summary
 */
export function generateTransferSummary(items: MultiSkuTransferItem[]): TransferSummary {
  const validItems = items.filter(item => item.is_valid);
  const invalidItems = items.filter(item => !item.is_valid);
  const itemsWithWarnings = items.filter(item => item.validation_warnings.length > 0);

  const total_quantity = items.reduce((sum, item) => sum + item.quantity_to_transfer, 0);
  const total_weight_kg = items.reduce((sum, item) => sum + (item.total_weight_kg || 0), 0);
  const total_cost = items.reduce((sum, item) => sum + (item.total_cost || 0), 0);

  // Find unique variants
  const variantSet = new Set(items.map(item => item.variant_name || 'default'));
  const unique_variants = variantSet.size;

  // Find heaviest and most expensive items
  const heaviest_item = items.reduce((heaviest, current) => {
    const currentWeight = current.total_weight_kg || 0;
    const heaviestWeight = heaviest?.total_weight_kg || 0;
    return currentWeight > heaviestWeight ? current : heaviest;
  }, items[0]);

  const most_expensive_item = items.reduce((expensive, current) => {
    const currentCost = current.total_cost || 0;
    const expensiveCost = expensive?.total_cost || 0;
    return currentCost > expensiveCost ? current : expensive;
  }, items[0]);

  return {
    total_products: items.length,
    total_quantity,
    total_weight_kg,
    total_cost: total_cost > 0 ? total_cost : undefined,
    unique_variants,
    heaviest_item: (heaviest_item?.total_weight_kg || 0) > 0 ? heaviest_item : undefined,
    most_expensive_item: (most_expensive_item?.total_cost || 0) > 0 ? most_expensive_item : undefined,
    validation_summary: {
      valid_items: validItems.length,
      invalid_items: invalidItems.length,
      items_with_warnings: itemsWithWarnings.length
    }
  };
}

/**
 * Validate warehouse capacity for incoming transfer
 */
export function validateWarehouseCapacity(
  warehouseId: string,
  items: MultiSkuTransferItem[],
  warehouseCapacityKg?: number
): { can_accommodate: boolean; warnings: string[] } {
  const warnings: string[] = [];
  
  if (!warehouseCapacityKg) {
    warnings.push('Warehouse capacity not defined - cannot validate space availability');
    return { can_accommodate: true, warnings };
  }

  const total_incoming_weight = items.reduce((sum, item) => sum + (item.total_weight_kg || 0), 0);
  
  // This would need actual current warehouse utilization
  // For now, we'll assume 70% current utilization as example
  const current_utilization = warehouseCapacityKg * 0.7;
  const utilization_after = current_utilization + total_incoming_weight;
  const utilization_percentage = (utilization_after / warehouseCapacityKg) * 100;

  if (utilization_percentage > 100) {
    return {
      can_accommodate: false,
      warnings: [`Transfer would exceed warehouse capacity by ${(utilization_after - warehouseCapacityKg).toFixed(0)}kg`]
    };
  }

  if (utilization_percentage > 90) {
    warnings.push(`Transfer will utilize ${utilization_percentage.toFixed(1)}% of warehouse capacity`);
  }

  return { can_accommodate: true, warnings };
}

/**
 * Check for potential conflicts with existing transfers
 */
export function checkTransferConflicts(
  newTransfer: Partial<MultiSkuTransfer>,
  existingTransfers: MultiSkuTransfer[]
): { has_conflicts: boolean; conflicts: string[] } {
  const conflicts: string[] = [];

  if (!newTransfer.items || !newTransfer.source_warehouse_id) {
    return { has_conflicts: false, conflicts };
  }

  // Check for transfers on the same date from same warehouse
  const sameDate = existingTransfers.filter(
    transfer => transfer.source_warehouse_id === newTransfer.source_warehouse_id &&
               transfer.transfer_date === newTransfer.transfer_date &&
               ['pending', 'approved', 'in_transit'].includes(transfer.status)
  );

  if (sameDate.length > 0) {
    const totalExistingItems = sameDate.reduce((sum, t) => sum + t.total_items, 0);
    const newItems = newTransfer.items.length;
    
    if (totalExistingItems + newItems > 50) {
      conflicts.push(`High volume of transfers scheduled for this date (${totalExistingItems + newItems} total items)`);
    }
  }

  // Check for overlapping products
  for (const item of newTransfer.items) {
    const overlapping = existingTransfers.find(transfer =>
      transfer.source_warehouse_id === newTransfer.source_warehouse_id &&
      transfer.transfer_date === newTransfer.transfer_date &&
      ['pending', 'approved'].includes(transfer.status) &&
      transfer.items.some(existingItem => 
        existingItem.product_id === item.product_id &&
        existingItem.variant_name === item.variant_name
      )
    );

    if (overlapping) {
      conflicts.push(`Product ${item.product_name} is already scheduled for transfer on this date`);
    }
  }

  return {
    has_conflicts: conflicts.length > 0,
    conflicts
  };
}

/**
 * Format validation errors for display
 */
export function formatValidationErrors(
  validationResult: TransferValidationResult
): { severity: 'error' | 'warning'; message: string }[] {
  const messages: { severity: 'error' | 'warning'; message: string }[] = [];

  validationResult.errors.forEach(error => {
    messages.push({ severity: 'error', message: error });
  });

  validationResult.warnings.forEach(warning => {
    messages.push({ severity: 'warning', message: warning });
  });

  return messages;
}

/**
 * Generate transfer reference number
 */
export function generateTransferReference(
  sourceWarehouseCode: string,
  destinationWarehouseCode: string,
  transferDate: string
): string {
  const date = new Date(transferDate);
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  
  return `TR-${sourceWarehouseCode}-${destinationWarehouseCode}-${dateStr}-${randomSuffix}`;
}

/**
 * Calculate estimated transfer duration based on items and distance
 */
export function estimateTransferDuration(
  items: MultiSkuTransferItem[],
  estimatedDistanceKm?: number
): {
  preparation_hours: number;
  transport_hours: number;
  total_hours: number;
} {
  // Base preparation time: 15 minutes per item + 30 minutes setup
  const preparation_hours = (items.length * 0.25) + 0.5;
  
  // Transport time: assume 50km/h average + loading/unloading
  const transport_hours = estimatedDistanceKm 
    ? (estimatedDistanceKm / 50) + 1 // +1 hour for loading/unloading
    : 2; // default 2 hours for unknown distance

  return {
    preparation_hours,
    transport_hours,
    total_hours: preparation_hours + transport_hours
  };
}

/**
 * Check if inventory is available for transfer
 */
export async function validateInventoryAvailability(
  supabase: SupabaseClient,
  warehouseId: string,
  items: MultiSkuTransferItem[]
): Promise<{ is_available: boolean; errors: string[]; warnings: string[] }> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Get stock information for all items
  const productIds = items.map(item => item.product_id);
  const { data: stockData, error: stockError } = await supabase
    .from('inventory_balance')
    .select(`
      *,
      product:product_id(id, sku, name, capacity_kg, tare_weight_kg, is_variant, variant_name, variant_type)
    `)
    .eq('warehouse_id', warehouseId)
    .in('product_id', productIds);

  if (stockError) {
    errors.push('Failed to fetch stock information');
    return { is_available: false, errors, warnings };
  }

  // Validate each item
  for (const item of items) {
    const stockInfo = stockData?.find(stock => stock.product_id === item.product_id);

    if (!stockInfo) {
      errors.push(`Stock information not found for product ${item.product_id}`);
      continue;
    }

    const availableForTransfer = stockInfo.qty_full - (stockInfo.qty_reserved || 0);
    
    if (item.quantity_to_transfer > availableForTransfer) {
      errors.push(`Insufficient stock for product ${stockInfo.product?.name || item.product_id}. Available: ${availableForTransfer}, Requested: ${item.quantity_to_transfer}`);
    }

    if (item.quantity_to_transfer > stockInfo.qty_full * 0.9) {
      warnings.push(`Transferring more than 90% of available stock for product ${stockInfo.product?.name || item.product_id}`);
    }
  }

  return {
    is_available: errors.length === 0,
    errors,
    warnings
  };
}