import { TRPCError } from '@trpc/server';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Utility functions for transfer operations
 */

export interface TransferValidationResult {
  is_valid: boolean;
  errors: string[];
  warnings: string[];
  blocked_items: string[];
  total_weight_kg: number;
  estimated_cost?: number;
}

export interface TransferSummary {
  total_products: number;
  total_quantity: number;
  total_weight_kg: number;
  total_cost?: number;
  unique_variants: number;
  validation_summary: {
    valid_items: number;
    invalid_items: number;
    items_with_warnings: number;
  };
}

/**
 * Standard cylinder weights for calculation
 */
export const CYLINDER_WEIGHTS = {
  '5kg': { full: 14, empty: 9 },
  '9kg': { full: 17, empty: 8 },
  '12kg': { full: 25, empty: 13 },
  '19kg': { full: 38, empty: 19 },
  '45kg': { full: 88, empty: 43 },
  '90kg': { full: 174, empty: 84 }
} as const;

/**
 * Validate basic transfer requirements
 */
export function validateTransferBasics(transfer: any): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

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
    const transferDate = new Date(transfer.transfer_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (transferDate < today) {
      errors.push('Transfer date cannot be in the past');
    }
  }

  return { errors, warnings };
}

/**
 * Calculate transfer item details including weight and cost
 */
export function calculateTransferItemDetails(
  item: any,
  product?: any
): any {
  let unit_weight_kg = 0;
  let unit_cost = 0;

  // Calculate weight based on product type and variant
  if (product?.is_variant && product?.variant_name && product?.parent_product_id) {
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
    if (product?.capacity_kg && product?.tare_weight_kg) {
      unit_weight_kg = product.capacity_kg + product.tare_weight_kg;
    } else if (product?.capacity_kg) {
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
export function generateTransferSummary(items: any[]): TransferSummary {
  const validItems = items.filter(item => item.is_valid !== false);
  const invalidItems = items.filter(item => item.is_valid === false);
  const itemsWithWarnings = items.filter(item => 
    item.validation_warnings && item.validation_warnings.length > 0
  );

  const total_quantity = items.reduce((sum, item) => sum + item.quantity_to_transfer, 0);
  const total_weight_kg = items.reduce((sum, item) => 
    sum + (item.total_weight_kg || (item.unit_weight_kg || 0) * item.quantity_to_transfer), 0
  );
  const total_cost = items.reduce((sum, item) => 
    sum + (item.total_cost || (item.unit_cost || 0) * item.quantity_to_transfer), 0
  );

  // Find unique variants
  const variantSet = new Set(items.map(item => item.variant_name || 'default'));
  const unique_variants = variantSet.size;

  return {
    total_products: items.length,
    total_quantity,
    total_weight_kg,
    total_cost: total_cost > 0 ? total_cost : undefined,
    unique_variants,
    validation_summary: {
      valid_items: validItems.length,
      invalid_items: invalidItems.length,
      items_with_warnings: itemsWithWarnings.length
    }
  };
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
 * Calculate estimated transfer duration
 */
export function estimateTransferDuration(
  items: any[],
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
 * Validate warehouse capacity for incoming transfer
 */
export function validateWarehouseCapacity(
  warehouseId: string,
  items: any[],
  warehouseCapacityKg?: number
): { can_accommodate: boolean; warnings: string[] } {
  const warnings: string[] = [];
  
  if (!warehouseCapacityKg) {
    warnings.push('Warehouse capacity not defined - cannot validate space availability');
    return { can_accommodate: true, warnings };
  }

  const total_incoming_weight = items.reduce((sum, item) => 
    sum + (item.total_weight_kg || 0), 0
  );
  
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
export async function checkTransferConflicts(
  supabase: SupabaseClient,
  tenantId: string,
  newTransfer: any
): Promise<{ has_conflicts: boolean; conflicts: string[] }> {
  const conflicts: string[] = [];

  if (!newTransfer.items || !newTransfer.source_warehouse_id) {
    return { has_conflicts: false, conflicts };
  }

  // Get existing transfers on the same date from same warehouse
  const { data: existingTransfers, error } = await supabase
    .from('transfers')
    .select(`
      id,
      total_items,
      items:transfer_lines(product_id)
    `)
    .eq('source_warehouse_id', newTransfer.source_warehouse_id)
    .eq('transfer_date', newTransfer.transfer_date)
    .eq('tenant_id', tenantId)
    .in('status', ['pending', 'approved', 'in_transit']);

  if (error) {
    // If we can't check conflicts, allow the transfer but warn
    conflicts.push('Could not check for transfer conflicts');
    return { has_conflicts: false, conflicts };
  }

  if (existingTransfers && existingTransfers.length > 0) {
    const totalExistingItems = existingTransfers.reduce((sum, t) => sum + t.total_items, 0);
    const newItems = newTransfer.items.length;
    
    if (totalExistingItems + newItems > 50) {
      conflicts.push(`High volume of transfers scheduled for this date (${totalExistingItems + newItems} total items)`);
    }

    // Check for overlapping products
    const existingProductIds = new Set();
    existingTransfers.forEach(transfer => {
      transfer.items.forEach((item: any) => {
        existingProductIds.add(item.product_id);
      });
    });

    for (const item of newTransfer.items) {
      if (existingProductIds.has(item.product_id)) {
        conflicts.push(`Product ${item.product_id} is already scheduled for transfer on this date`);
        break; // Only report once
      }
    }
  }

  return {
    has_conflicts: conflicts.length > 0,
    conflicts
  };
}

/**
 * Validate transfer status transition
 */
export function validateStatusTransition(
  currentStatus: string,
  newStatus: string
): { isValid: boolean; error?: string } {
  const validTransitions: Record<string, string[]> = {
    'draft': ['pending', 'cancelled'],
    'pending': ['approved', 'cancelled'],
    'approved': ['in_transit', 'cancelled'],
    'in_transit': ['completed', 'cancelled'],
    'completed': [],
    'cancelled': []
  };

  if (!validTransitions[currentStatus]?.includes(newStatus)) {
    return {
      isValid: false,
      error: `Cannot transition from ${currentStatus} to ${newStatus}`
    };
  }

  return { isValid: true };
}

/**
 * Create transfer history record
 */
export async function createTransferHistory(
  supabase: SupabaseClient,
  tenantId: string,
  data: {
    transfer_id: string;
    action: 'created' | 'updated' | 'approved' | 'started' | 'completed' | 'cancelled';
    action_by_user_id: string;
    notes?: string;
    previous_status?: string;
    new_status?: string;
    changes?: Record<string, any>;
  }
) {
  // This would create a record in a transfer_history table
  // For now, we'll just log it since the table might not exist
  console.log('Transfer history:', {
    tenant_id: tenantId,
    action_date: new Date().toISOString(),
    ...data
  });
}

/**
 * Get transfer cost analysis
 */
export function calculateTransferCosts(
  transfer: any,
  distanceKm: number = 50
): {
  total_weight_kg: number;
  total_volume_m3: number;
  estimated_costs: {
    handling_cost: number;
    transport_cost: number;
    total_cost: number;
  };
  efficiency_metrics: {
    cost_per_kg: number;
    cost_per_item: number;
  };
} {
  let total_weight = 0;
  let total_volume = 0;
  let handling_cost = 0;

  for (const item of transfer.items || []) {
    const quantity = item.quantity_full + item.quantity_empty;
    const product = item.product;
    
    if (product?.capacity_kg && product?.tare_weight_kg) {
      const unit_weight = product.capacity_kg + product.tare_weight_kg;
      total_weight += unit_weight * quantity;
    }
    
    // Basic cost calculations (would integrate with actual pricing system)
    handling_cost += quantity * 2; // $2 per item handling
  }

  // Basic transport cost calculation (would integrate with routing system)
  const transport_cost = (total_weight / 1000) * distanceKm * 0.5; // $0.5 per ton per km
  const total_cost = handling_cost + transport_cost;

  return {
    total_weight_kg: total_weight,
    total_volume_m3: total_volume,
    estimated_costs: {
      handling_cost,
      transport_cost,
      total_cost,
    },
    efficiency_metrics: {
      cost_per_kg: total_weight > 0 ? total_cost / total_weight : 0,
      cost_per_item: transfer.total_items > 0 ? total_cost / transfer.total_items : 0,
    }
  };
}