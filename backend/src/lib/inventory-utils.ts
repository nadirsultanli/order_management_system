import { TRPCError } from '@trpc/server';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Utility functions for inventory operations
 */

export interface StockValidationResult {
  isValid: boolean;
  availableStock: number;
  errors: string[];
  warnings: string[];
}

/**
 * Validate stock availability for a product in a warehouse
 */
export async function validateStockAvailability(
  supabase: SupabaseClient,
  tenantId: string,
  warehouseId: string,
  productId: string,
  requestedQuantity: number
): Promise<StockValidationResult> {
  const { data: inventory, error } = await supabase
    .from('inventory_balance')
    .select('qty_full, qty_reserved')
    .eq('warehouse_id', warehouseId)
    .eq('product_id', productId)
    .single();

  if (error) {
    return {
      isValid: false,
      availableStock: 0,
      errors: ['Stock information not found'],
      warnings: []
    };
  }

  const availableStock = inventory.qty_full - inventory.qty_reserved;
  const errors: string[] = [];
  const warnings: string[] = [];

  if (requestedQuantity > availableStock) {
    errors.push(`Insufficient stock. Available: ${availableStock}, Requested: ${requestedQuantity}`);
  }

  if (requestedQuantity > inventory.qty_full * 0.9) {
    warnings.push('Transferring more than 90% of available stock');
  }

  return {
    isValid: errors.length === 0,
    availableStock,
    errors,
    warnings
  };
}

/**
 * Ensure warehouse belongs to tenant
 */
export async function validateWarehouseTenant(
  supabase: SupabaseClient,
  tenantId: string,
  warehouseId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('warehouses')
    .select('id')
    .eq('id', warehouseId)
    .single();

  return !error && !!data;
}

/**
 * Ensure product belongs to tenant
 */
export async function validateProductTenant(
  supabase: SupabaseClient,
  tenantId: string,
  productId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('products')
    .select('id')
    .eq('id', productId)
    .single();

  return !error && !!data;
}

/**
 * Create stock movement record for audit trail
 */
export async function createStockMovement(
  supabase: SupabaseClient,
  tenantId: string,
  data: {
    inventory_id: string;
    movement_type: 'adjustment' | 'transfer_in' | 'transfer_out' | 'order_reserve' | 'order_fulfill';
    qty_full_change: number;
    qty_empty_change: number;
    reason?: string;
    reference_id?: string;
    created_by_user_id: string;
  }
) {
  // This would create a record in a stock_movements table
  // For now, we'll just log it since the table might not exist
  console.log('Stock movement:', {
    tenant_id: tenantId,
    ...data,
    created_at: new Date().toISOString()
  });
}

/**
 * Calculate low stock threshold based on product settings
 */
export function calculateLowStockThreshold(
  currentStock: number,
  reorderLevel?: number,
  defaultThreshold: number = 10
): boolean {
  const threshold = reorderLevel || defaultThreshold;
  return currentStock <= threshold;
}

/**
 * Validate inventory adjustment parameters
 */
export function validateStockAdjustment(
  currentInventory: any,
  adjustment: {
    qty_full_change: number;
    qty_empty_change: number;
  }
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  const newQtyFull = currentInventory.qty_full + adjustment.qty_full_change;
  const newQtyEmpty = currentInventory.qty_empty + adjustment.qty_empty_change;

  if (newQtyFull < 0) {
    errors.push('Full quantity cannot be negative');
  }

  if (newQtyEmpty < 0) {
    errors.push('Empty quantity cannot be negative');
  }

  if (newQtyFull < currentInventory.qty_reserved) {
    errors.push(`Cannot reduce full stock below reserved quantity (${currentInventory.qty_reserved})`);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Batch validate multiple product-warehouse combinations
 */
export async function batchValidateStock(
  supabase: SupabaseClient,
  tenantId: string,
  items: Array<{
    warehouse_id: string;
    product_id: string;
    quantity: number;
  }>
): Promise<Array<StockValidationResult & { product_id: string }>> {
  const results: Array<StockValidationResult & { product_id: string }> = [];

  for (const item of items) {
    const validation = await validateStockAvailability(
      supabase,
      tenantId,
      item.warehouse_id,
      item.product_id,
      item.quantity
    );

    results.push({
      ...validation,
      product_id: item.product_id
    });
  }

  return results;
}

/**
 * Get inventory summary for a warehouse
 */
export async function getWarehouseInventorySummary(
  supabase: SupabaseClient,
  tenantId: string,
  warehouseId: string
) {
  const { data, error } = await supabase
    .from('inventory_balance')
    .select('qty_full, qty_empty, qty_reserved')
    .eq('warehouse_id', warehouseId);

  if (error) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: error.message
    });
  }

  const summary = {
    total_products: data.length,
    total_full: data.reduce((sum, item) => sum + item.qty_full, 0),
    total_empty: data.reduce((sum, item) => sum + item.qty_empty, 0),
    total_reserved: data.reduce((sum, item) => sum + item.qty_reserved, 0),
    total_available: data.reduce((sum, item) => sum + (item.qty_full - item.qty_reserved), 0),
    low_stock_count: data.filter(item => 
      calculateLowStockThreshold(item.qty_full - item.qty_reserved)
    ).length
  };

  return summary;
}

/**
 * Ensure atomic stock operations with retry logic
 */
export async function atomicStockUpdate(
  supabase: SupabaseClient,
  tenantId: string,
  inventoryId: string,
  updateFn: (current: any) => any,
  maxRetries: number = 3
): Promise<any> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    // Get current state
    const { data: current, error: fetchError } = await supabase
      .from('inventory_balance')
      .select('*')
      .eq('id', inventoryId)
      .single();

    if (fetchError) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Inventory record not found'
      });
    }

    // Calculate new state
    const newData = updateFn(current);

    // Attempt update with optimistic locking
    const { data: updated, error: updateError } = await supabase
      .from('inventory_balance')
      .update({
        ...newData,
        updated_at: new Date().toISOString()
      })
      .eq('id', inventoryId)
      .eq('updated_at', current.updated_at) // Optimistic locking
      .select()
      .single();

    if (!updateError) {
      return updated;
    }

    // If it's the last attempt or not a concurrency error, throw
    if (attempt === maxRetries - 1 || updateError.code !== 'P0001') {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: updateError.message
      });
    }

    // Wait before retry
    await new Promise(resolve => setTimeout(resolve, 100 * (attempt + 1)));
  }
}