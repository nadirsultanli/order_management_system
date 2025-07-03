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

// Standard cylinder weights (kg) - can be customized per product
export const CYLINDER_WEIGHTS = {
  '6kg': { full: 16, empty: 10, net: 6 },
  '13kg': { full: 27, empty: 14, net: 13 },
  '48kg': { full: 98, empty: 50, net: 48 },
  '90kg': { full: 180, empty: 90, net: 90 }
} as const;

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
    console.error('Failed to calculate order weight via API, using fallback:', error);
    // Fallback to local calculation if API fails
    return calculateOrderWeightFallback(orderLines);
  }
}

/**
 * Fallback calculation for order weight (original implementation)
 */
function calculateOrderWeightFallback(
  orderLines: OrderLine[]
): { total_weight_kg: number; line_estimates: WeightEstimate[] } {
  const line_estimates: WeightEstimate[] = [];
  let total_weight_kg = 0;

  for (const line of orderLines) {
    // Fallback estimation without product details (assume 13kg cylinder)
    const estimated_weight_kg = 27 * line.quantity;

    line_estimates.push({
      product_id: line.product_id,
      product_name: 'Unknown Product',
      quantity: line.quantity,
      estimated_weight_kg,
      variant_name: undefined
    });

    total_weight_kg += estimated_weight_kg;
  }

  return { total_weight_kg, line_estimates };
}

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
    console.error('Failed to calculate truck capacity via API, using fallback:', error);
    // Fallback to basic calculation
    return {
      truck_id,
      total_capacity_kg: 0,
      allocated_weight_kg: 0,
      available_weight_kg: 0,
      utilization_percentage: 0,
      orders_count: 0,
      is_overallocated: false
    };
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
    // Return empty result on failure
    return {
      recommendations: [],
      best_truck: undefined
    };
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
    // Return invalid result on failure
    return {
      is_valid: false,
      warnings: [],
      errors: ['Failed to validate allocation']
    };
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
    // Return empty result on failure
    return {
      schedules: [],
      fleet_utilization: {
        total_capacity_kg: 0,
        total_allocated_kg: 0,
        overall_utilization: 0,
        active_trucks: 0,
        overallocated_trucks: 0,
        maintenance_due_trucks: 0
      }
    };
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
    return {
      total_capacity_kg: 0,
      total_allocated_kg: 0,
      overall_utilization: 0,
      active_trucks: 0,
      overallocated_trucks: 0,
      maintenance_due_trucks: 0
    };
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
    // Return empty result on failure
    return {
      optimized_allocations: [],
      unallocated_orders: order_ids,
      optimization_summary: {
        total_orders: order_ids.length,
        allocated_orders: 0,
        fleet_utilization: 0
      }
    };
  }
} 