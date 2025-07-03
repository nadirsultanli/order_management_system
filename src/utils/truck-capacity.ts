import { 
  TruckCapacityInfo, 
  TruckWithInventory, 
  TruckAllocation,
  DailyTruckSchedule,
  TruckPerformanceMetrics 
} from '../types/truck';
import { Order, OrderLine } from '../types/order';
import { Product } from '../types/product';
import { trpc } from '../lib/trpc-client';

// Note: Cylinder weights are now managed by the backend API.
// Local constants have been removed to achieve 100% UI purity.

export interface WeightEstimate {
  product_id: string;
  product_name: string;
  quantity: number;
  estimated_weight_kg: number;
  variant_name?: string; // 'full', 'empty', etc.
}

/**
 * Calculate estimated weight for an order based on product variants and quantities
 * Uses backend API for calculation
 */
export async function calculateOrderWeight(
  orderLines: OrderLine[]
): Promise<{ total_weight_kg: number; line_estimates: WeightEstimate[] }> {
  try {
    const result = await trpc.trucks.calculateOrderWeight.mutate({
      order_lines: orderLines
    });
    return result;
  } catch (error) {
    console.error('Failed to calculate order weight via API:', error);
    throw new Error('Order weight calculation failed. Please try again.');
  }
}

// Fallback calculation removed to achieve 100% UI purity.
// All weight calculations now handled by backend API.

/**
 * Calculate truck capacity information for a given date
 * Uses backend API for calculation
 */
export async function calculateTruckCapacity(
  truck_id: string,
  date: string
): Promise<TruckCapacityInfo> {
  try {
    const result = await trpc.trucks.calculateCapacity.query({
      truck_id,
      date
    });
    return result;
  } catch (error) {
    console.error('Failed to calculate truck capacity via API:', error);
    throw new Error('Truck capacity calculation failed. Please try again.');
  }
}

/**
 * Find best truck for order allocation based on capacity and availability
 * Uses backend API for calculation
 */
export async function findBestTruckForOrder(
  order_id: string,
  order_weight: number,
  target_date: string
): Promise<{
  recommendations: Array<{
    truck: TruckWithInventory;
    capacity_info: TruckCapacityInfo;
    fit_score: number;
    can_accommodate: boolean;
  }>;
  best_truck?: TruckWithInventory;
}> {
  try {
    const result = await trpc.trucks.findBestAllocation.mutate({
      order_id,
      order_weight,
      target_date
    });
    return result;
  } catch (error) {
    console.error('Failed to find best truck allocation via API:', error);
    throw new Error('Truck allocation search failed. Please try again.');
  }
}

/**
 * Validate truck allocation for potential issues
 * Uses backend API for validation
 */
export async function validateTruckAllocation(
  truck_id: string,
  order_id: string,
  order_weight: number,
  target_date: string
): Promise<{
  is_valid: boolean;
  warnings: string[];
  errors: string[];
}> {
  try {
    const result = await trpc.trucks.validateAllocation.mutate({
      truck_id,
      order_id,
      order_weight,
      target_date
    });
    return result;
  } catch (error) {
    console.error('Failed to validate truck allocation via API:', error);
    throw new Error('Truck allocation validation failed. Please try again.');
  }
}

/**
 * Generate daily truck schedule with capacity optimization
 * Uses backend API for schedule generation
 */
export async function generateDailyTruckSchedule(
  date: string
): Promise<{
  schedules: DailyTruckSchedule[];
  fleet_utilization: {
    total_capacity_kg: number;
    total_allocated_kg: number;
    overall_utilization: number;
    active_trucks: number;
    overallocated_trucks: number;
    maintenance_due_trucks: number;
  };
}> {
  try {
    const result = await trpc.trucks.generateSchedule.query({
      date
    });
    return result;
  } catch (error) {
    console.error('Failed to generate truck schedule via API:', error);
    throw new Error('Truck schedule generation failed. Please try again.');
  }
}

/**
 * Calculate fleet-wide capacity utilization
 * This is now handled by the backend API in generateDailyTruckSchedule
 * Keeping for backward compatibility, but redirects to the schedule API
 */
export async function calculateFleetUtilization(
  date: string
): Promise<{
  total_capacity_kg: number;
  total_allocated_kg: number;
  overall_utilization: number;
  active_trucks: number;
  overallocated_trucks: number;
  maintenance_due_trucks: number;
}> {
  try {
    const result = await generateDailyTruckSchedule(date);
    return result.fleet_utilization;
  } catch (error) {
    console.error('Failed to calculate fleet utilization:', error);
    throw new Error('Fleet utilization calculation failed. Please try again.');
  }
}

/**
 * Optimize truck allocations for better capacity utilization
 * Uses backend API for optimization
 */
export async function optimizeTruckAllocations(
  order_ids: string[],
  target_date: string
): Promise<{
  optimized_allocations: Array<{
    order_id: string;
    truck_id: string;
    estimated_weight_kg: number;
    confidence_score: number;
  }>;
  unallocated_orders: string[];
  optimization_summary: {
    total_orders: number;
    allocated_orders: number;
    fleet_utilization: number;
  };
}> {
  try {
    const result = await trpc.trucks.optimizeAllocations.mutate({
      order_ids,
      target_date
    });
    return result;
  } catch (error) {
    console.error('Failed to optimize truck allocations via API:', error);
    throw new Error('Truck allocation optimization failed. Please try again.');
  }
} 