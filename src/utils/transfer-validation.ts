import { 
  MultiSkuTransferItem, 
  MultiSkuTransfer, 
  TransferValidationResult, 
  WarehouseStockInfo,
  TransferSummary 
} from '../types/transfer';
import { Product } from '../types/product';
// Note: Cylinder weights are now managed by the backend API.
import { trpc } from '../lib/trpc-client';

/**
 * Validate a complete multi-SKU transfer using backend API
 */
export async function validateMultiSkuTransfer(
  transfer: Partial<MultiSkuTransfer>
): Promise<TransferValidationResult> {
  try {
    // Prepare the transfer data for API call
    const transferData = {
      source_warehouse_id: transfer.source_warehouse_id!,
      destination_warehouse_id: transfer.destination_warehouse_id!,
      transfer_date: transfer.transfer_date!,
      items: transfer.items?.map(item => ({
        product_id: item.product_id,
        product_sku: item.product_sku,
        product_name: item.product_name,
        variant_name: item.variant_name,
        variant_type: item.variant_type,
        quantity_to_transfer: item.quantity_to_transfer,
        available_stock: item.available_stock,
        reserved_stock: item.reserved_stock,
        unit_weight_kg: item.unit_weight_kg,
        unit_cost: item.unit_cost,
        source_location: item.source_location,
        batch_number: item.batch_number,
        expiry_date: item.expiry_date
      })) || [],
      notes: transfer.notes,
      reason: transfer.reason,
      priority: transfer.priority || 'normal'
    };

    const result = await trpc.transfers.validateMultiSkuTransfer.mutate(transferData);
    return result;
  } catch (error) {
    console.error('Failed to validate transfer via API:', error);
    throw new Error('Transfer validation failed. Please try again.');
  }
}

// Fallback validation removed to achieve 100% UI purity.
// All transfer validation now handled by backend API.

/**
 * Validate inventory availability using backend API
 */
export async function validateInventoryAvailability(
  warehouseId: string,
  items: MultiSkuTransferItem[]
): Promise<{ is_available: boolean; errors: string[]; warnings: string[] }> {
  try {
    const itemData = items.map(item => ({
      product_id: item.product_id,
      product_sku: item.product_sku,
      product_name: item.product_name,
      variant_name: item.variant_name,
      variant_type: item.variant_type,
      quantity_to_transfer: item.quantity_to_transfer,
      available_stock: item.available_stock,
      reserved_stock: item.reserved_stock,
      unit_weight_kg: item.unit_weight_kg,
      unit_cost: item.unit_cost,
      source_location: item.source_location,
      batch_number: item.batch_number,
      expiry_date: item.expiry_date
    }));

    const result = await trpc.transfers.validateInventoryAvailability.mutate({
      warehouse_id: warehouseId,
      items: itemData
    });

    return result;
  } catch (error) {
    console.error('Failed to validate inventory availability via API:', error);
    throw new Error('Inventory availability validation failed. Please try again.');
  }
}

// Removed local business logic to achieve 100% UI purity.
// Use validateMultiSkuTransfer() async function instead.

/**
 * Calculate transfer details using backend API
 */
export async function calculateTransferDetails(
  items: MultiSkuTransferItem[]
): Promise<{ items: MultiSkuTransferItem[]; summary: TransferSummary }> {
  try {
    const itemData = items.map(item => ({
      product_id: item.product_id,
      product_sku: item.product_sku,
      product_name: item.product_name,
      variant_name: item.variant_name,
      variant_type: item.variant_type,
      quantity_to_transfer: item.quantity_to_transfer,
      available_stock: item.available_stock,
      reserved_stock: item.reserved_stock,
      unit_weight_kg: item.unit_weight_kg,
      unit_cost: item.unit_cost,
      source_location: item.source_location,
      batch_number: item.batch_number,
      expiry_date: item.expiry_date
    }));

    const result = await trpc.transfers.calculateTransferDetails.mutate({
      items: itemData
    });

    return result;
  } catch (error) {
    console.error('Failed to calculate transfer details via API:', error);
    throw new Error('Transfer details calculation failed. Please try again.');
  }
}

// Removed local business logic to achieve 100% UI purity.
// Use calculateTransferDetails() async function instead.

// Fallback calculation removed to achieve 100% UI purity.
// All transfer details calculations now handled by backend API.

// Removed local business logic to achieve 100% UI purity.
// Use calculateTransferDetails() async function instead.

/**
 * Validate warehouse capacity using backend API
 */
export async function validateWarehouseCapacity(
  warehouseId: string,
  items: MultiSkuTransferItem[],
  warehouseCapacityKg?: number
): Promise<{ can_accommodate: boolean; warnings: string[] }> {
  try {
    const itemData = items.map(item => ({
      product_id: item.product_id,
      product_sku: item.product_sku,
      product_name: item.product_name,
      variant_name: item.variant_name,
      variant_type: item.variant_type,
      quantity_to_transfer: item.quantity_to_transfer,
      available_stock: item.available_stock,
      reserved_stock: item.reserved_stock,
      unit_weight_kg: item.unit_weight_kg,
      unit_cost: item.unit_cost,
      source_location: item.source_location,
      batch_number: item.batch_number,
      expiry_date: item.expiry_date
    }));

    const result = await trpc.transfers.validateTransferCapacity.mutate({
      warehouse_id: warehouseId,
      items: itemData,
      warehouse_capacity_kg: warehouseCapacityKg
    });

    return result;
  } catch (error) {
    console.error('Failed to validate warehouse capacity via API:', error);
    throw new Error('Warehouse capacity validation failed. Please try again.');
  }
}

// Fallback capacity validation removed to achieve 100% UI purity.
// All warehouse capacity validation now handled by backend API.

/**
 * Check for transfer conflicts using backend API
 */
export async function checkTransferConflicts(
  sourceWarehouseId: string,
  destinationWarehouseId: string,
  transferDate: string,
  items: MultiSkuTransferItem[]
): Promise<{ has_conflicts: boolean; conflicts: string[] }> {
  try {
    const itemData = items.map(item => ({
      product_id: item.product_id,
      product_sku: item.product_sku,
      product_name: item.product_name,
      variant_name: item.variant_name,
      variant_type: item.variant_type,
      quantity_to_transfer: item.quantity_to_transfer,
      available_stock: item.available_stock,
      reserved_stock: item.reserved_stock,
      unit_weight_kg: item.unit_weight_kg,
      unit_cost: item.unit_cost,
      source_location: item.source_location,
      batch_number: item.batch_number,
      expiry_date: item.expiry_date
    }));

    const result = await trpc.transfers.checkTransferConflicts.mutate({
      source_warehouse_id: sourceWarehouseId,
      destination_warehouse_id: destinationWarehouseId,
      transfer_date: transferDate,
      items: itemData
    });

    return result;
  } catch (error) {
    console.error('Failed to check transfer conflicts via API:', error);
    throw new Error('Transfer conflict check failed. Please try again.');
  }
}

// Removed local business logic to achieve 100% UI purity.
// Use checkTransferConflicts() async function instead.

/**
 * Format validation errors for display using backend API
 */
export async function formatValidationErrors(
  validationResult: TransferValidationResult
): Promise<{ severity: 'error' | 'warning'; message: string }[]> {
  try {
    const result = await trpc.transfers.formatValidationErrors.mutate({
      validation_result: validationResult
    });

    return result;
  } catch (error) {
    console.error('Failed to format validation errors via API:', error);
    throw new Error('Validation error formatting failed. Please try again.');
  }
}

// Error formatting fallback removed to achieve 100% UI purity.
// All validation error formatting now handled by backend API.

// Removed local business logic to achieve 100% UI purity.
// Use backend API for transfer reference generation.

/**
 * Calculate estimated transfer duration using backend API
 */
export async function estimateTransferDuration(
  items: MultiSkuTransferItem[],
  estimatedDistanceKm?: number
): Promise<{
  preparation_hours: number;
  transport_hours: number;
  total_hours: number;
}> {
  try {
    const itemData = items.map(item => ({
      product_id: item.product_id,
      product_sku: item.product_sku,
      product_name: item.product_name,
      variant_name: item.variant_name,
      variant_type: item.variant_type,
      quantity_to_transfer: item.quantity_to_transfer,
      available_stock: item.available_stock,
      reserved_stock: item.reserved_stock,
      unit_weight_kg: item.unit_weight_kg,
      unit_cost: item.unit_cost,
      source_location: item.source_location,
      batch_number: item.batch_number,
      expiry_date: item.expiry_date
    }));

    const result = await trpc.transfers.estimateTransferDuration.mutate({
      items: itemData,
      estimated_distance_km: estimatedDistanceKm
    });

    return result;
  } catch (error) {
    console.error('Failed to estimate transfer duration via API:', error);
    throw new Error('Transfer duration estimation failed. Please try again.');
  }
}

// Duration estimation fallback removed to achieve 100% UI purity.
// All transfer duration estimation now handled by backend API. 