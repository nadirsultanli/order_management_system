import { 
  TruckCapacityInfo, 
  TruckWithInventory, 
  TruckAllocation,
  DailyTruckSchedule,
  TruckPerformanceMetrics 
} from '../types/truck';
import { Order, OrderLine } from '../types/order';
import { Product } from '../types/product';

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
 */
export function calculateOrderWeight(
  orderLines: OrderLine[],
  products: Product[]
): { total_weight_kg: number; line_estimates: WeightEstimate[] } {
  const line_estimates: WeightEstimate[] = [];
  let total_weight_kg = 0;

  for (const line of orderLines) {
    const product = products.find(p => p.id === line.product_id);
    if (!product) continue;

    let estimated_weight_kg = 0;
    
    // For variant products, use specific weights
    if (product.is_variant && product.variant_name) {
      const parentProduct = products.find(p => p.id === product.parent_product_id);
      if (parentProduct && parentProduct.capacity_kg) {
        // Use cylinder weights based on capacity
        const capacity = `${parentProduct.capacity_kg}kg` as keyof typeof CYLINDER_WEIGHTS;
        const weights = CYLINDER_WEIGHTS[capacity];
        
        if (weights) {
          if (product.variant_name === 'full') {
            estimated_weight_kg = weights.full * line.quantity;
          } else if (product.variant_name === 'empty') {
            estimated_weight_kg = weights.empty * line.quantity;
          }
        }
      }
    } else {
      // For non-variant products, use product capacity or default estimation
      if (product.capacity_kg) {
        // Assume full cylinders for non-variant products
        estimated_weight_kg = (product.capacity_kg + (product.tare_weight_kg || 10)) * line.quantity;
      } else {
        // Default estimation for unknown products (assume 13kg cylinder)
        estimated_weight_kg = 27 * line.quantity;
      }
    }

    line_estimates.push({
      product_id: line.product_id,
      product_name: product.name,
      quantity: line.quantity,
      estimated_weight_kg,
      variant_name: product.variant_name
    });

    total_weight_kg += estimated_weight_kg;
  }

  return { total_weight_kg, line_estimates };
}

/**
 * Calculate truck capacity information for a given date
 */
export function calculateTruckCapacity(
  truck: TruckWithInventory,
  allocations: TruckAllocation[],
  date: string
): TruckCapacityInfo {
  const dateAllocations = allocations.filter(
    a => a.allocation_date === date && a.status !== 'cancelled'
  );

  const allocated_weight_kg = dateAllocations.reduce(
    (sum, allocation) => sum + allocation.estimated_weight_kg, 
    0
  );

  const total_capacity_kg = truck.capacity_kg;
  const available_weight_kg = Math.max(0, total_capacity_kg - allocated_weight_kg);
  const utilization_percentage = total_capacity_kg > 0 
    ? (allocated_weight_kg / total_capacity_kg) * 100 
    : 0;

  return {
    truck_id: truck.id,
    total_capacity_kg,
    allocated_weight_kg,
    available_weight_kg,
    utilization_percentage,
    orders_count: dateAllocations.length,
    is_overallocated: allocated_weight_kg > total_capacity_kg
  };
}

/**
 * Find best truck for order allocation based on capacity and availability
 */
export function findBestTruckForOrder(
  order: Order,
  orderWeight: number,
  trucks: TruckWithInventory[],
  allAllocations: TruckAllocation[],
  targetDate: string
): {
  recommendations: Array<{
    truck: TruckWithInventory;
    capacity_info: TruckCapacityInfo;
    fit_score: number;
    can_accommodate: boolean;
  }>;
  best_truck?: TruckWithInventory;
} {
  const recommendations = trucks
    .filter(truck => truck.active && truck.status === 'active')
    .map(truck => {
      const capacity_info = calculateTruckCapacity(truck, allAllocations, targetDate);
      const can_accommodate = capacity_info.available_weight_kg >= orderWeight;
      
      // Calculate fit score (higher is better)
      let fit_score = 0;
      if (can_accommodate) {
        // Prefer trucks with good utilization (not too empty, not overloaded)
        const utilization_after = ((capacity_info.allocated_weight_kg + orderWeight) / capacity_info.total_capacity_kg) * 100;
        
        if (utilization_after <= 85) {
          fit_score = 100 - Math.abs(utilization_after - 75); // Prefer ~75% utilization
        } else {
          fit_score = 20; // Penalize high utilization
        }
        
        // Bonus for fewer existing orders (easier routing)
        fit_score += Math.max(0, 10 - capacity_info.orders_count);
      }

      return {
        truck,
        capacity_info,
        fit_score,
        can_accommodate
      };
    })
    .sort((a, b) => b.fit_score - a.fit_score);

  const best_truck = recommendations.find(r => r.can_accommodate)?.truck;

  return { recommendations, best_truck };
}

/**
 * Validate truck allocation for potential issues
 */
export function validateTruckAllocation(
  truck: TruckWithInventory,
  order: Order,
  orderWeight: number,
  existingAllocations: TruckAllocation[],
  targetDate: string
): {
  is_valid: boolean;
  warnings: string[];
  errors: string[];
} {
  const warnings: string[] = [];
  const errors: string[] = [];

  // Check truck status
  if (!truck.active) {
    errors.push('Truck is inactive');
  }

  if (truck.status === 'maintenance') {
    errors.push('Truck is scheduled for maintenance');
  }

  if (truck.status === 'inactive') {
    errors.push('Truck status is inactive');
  }

  // Check capacity
  const capacity_info = calculateTruckCapacity(truck, existingAllocations, targetDate);
  
  if (orderWeight > capacity_info.available_weight_kg) {
    errors.push(`Order weight (${orderWeight}kg) exceeds available capacity (${capacity_info.available_weight_kg}kg)`);
  }

  const utilization_after = ((capacity_info.allocated_weight_kg + orderWeight) / capacity_info.total_capacity_kg) * 100;
  
  if (utilization_after > 90) {
    warnings.push(`High utilization after allocation: ${utilization_after.toFixed(1)}%`);
  }

  if (capacity_info.orders_count >= 15) {
    warnings.push(`Many orders already allocated (${capacity_info.orders_count}), may affect delivery efficiency`);
  }

  // Check maintenance due
  if (truck.next_maintenance_due) {
    const maintenanceDue = new Date(truck.next_maintenance_due);
    const allocationDate = new Date(targetDate);
    
    if (allocationDate >= maintenanceDue) {
      warnings.push('Truck maintenance is due around this date');
    }
  }

  return {
    is_valid: errors.length === 0,
    warnings,
    errors
  };
}

/**
 * Generate daily truck schedule with capacity optimization
 */
export function generateDailyTruckSchedule(
  trucks: TruckWithInventory[],
  allocations: TruckAllocation[],
  date: string
): DailyTruckSchedule[] {
  return trucks.map(truck => {
    const truckAllocations = allocations.filter(
      a => a.truck_id === truck.id && a.allocation_date === date
    );

    const capacity_info = calculateTruckCapacity(truck, allocations, date);
    
    // Check maintenance due
    const maintenance_due = truck.next_maintenance_due 
      ? new Date(truck.next_maintenance_due) <= new Date(date)
      : false;

    // Estimate fuel requirements (rough calculation)
    const estimated_distance = truckAllocations.length * 25; // ~25km per delivery average
    const fuel_needed = truck.avg_fuel_consumption 
      ? (estimated_distance / 100) * truck.avg_fuel_consumption
      : estimated_distance * 0.12; // default 12L/100km
    
    const fuel_sufficient = truck.fuel_capacity_liters 
      ? fuel_needed <= truck.fuel_capacity_liters * 0.8 // 80% of tank
      : true; // assume sufficient if unknown

    return {
      date,
      truck_id: truck.id,
      truck,
      route: truck.current_route,
      allocations: truckAllocations,
      capacity_info,
      maintenance_due,
      fuel_sufficient
    };
  });
}

/**
 * Calculate fleet-wide capacity utilization
 */
export function calculateFleetUtilization(
  schedules: DailyTruckSchedule[]
): {
  total_capacity_kg: number;
  total_allocated_kg: number;
  overall_utilization: number;
  active_trucks: number;
  overallocated_trucks: number;
  maintenance_due_trucks: number;
} {
  const activeSchedules = schedules.filter(s => s.truck.active && s.truck.status === 'active');
  
  const total_capacity_kg = activeSchedules.reduce((sum, s) => sum + s.capacity_info.total_capacity_kg, 0);
  const total_allocated_kg = activeSchedules.reduce((sum, s) => sum + s.capacity_info.allocated_weight_kg, 0);
  const overall_utilization = total_capacity_kg > 0 ? (total_allocated_kg / total_capacity_kg) * 100 : 0;
  
  return {
    total_capacity_kg,
    total_allocated_kg,
    overall_utilization,
    active_trucks: activeSchedules.length,
    overallocated_trucks: schedules.filter(s => s.capacity_info.is_overallocated).length,
    maintenance_due_trucks: schedules.filter(s => s.maintenance_due).length
  };
}

/**
 * Optimize truck allocations for better capacity utilization
 */
export function optimizeTruckAllocations(
  orders: Order[],
  orderWeights: Map<string, number>,
  trucks: TruckWithInventory[],
  targetDate: string
): {
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
} {
  const activeTrucks = trucks.filter(t => t.active && t.status === 'active');
  const optimized_allocations: Array<{
    order_id: string;
    truck_id: string;
    estimated_weight_kg: number;
    confidence_score: number;
  }> = [];
  
  const unallocated_orders: string[] = [];
  const currentAllocations: TruckAllocation[] = [];

  // Sort orders by weight (heaviest first) for better packing
  const sortedOrders = orders
    .filter(order => orderWeights.has(order.id))
    .sort((a, b) => (orderWeights.get(b.id) || 0) - (orderWeights.get(a.id) || 0));

  for (const order of sortedOrders) {
    const orderWeight = orderWeights.get(order.id) || 0;
    const { best_truck } = findBestTruckForOrder(
      order, 
      orderWeight, 
      activeTrucks, 
      currentAllocations, 
      targetDate
    );

    if (best_truck) {
      const allocation = {
        id: `${order.id}-${best_truck.id}`,
        truck_id: best_truck.id,
        order_id: order.id,
        allocation_date: targetDate,
        estimated_weight_kg: orderWeight,
        status: 'planned' as const,
        created_at: new Date().toISOString()
      };

      currentAllocations.push(allocation);
      optimized_allocations.push({
        order_id: order.id,
        truck_id: best_truck.id,
        estimated_weight_kg: orderWeight,
        confidence_score: 85 // Could be more sophisticated
      });
    } else {
      unallocated_orders.push(order.id);
    }
  }

  // Calculate final utilization
  const schedules = generateDailyTruckSchedule(activeTrucks, currentAllocations, targetDate);
  const { overall_utilization } = calculateFleetUtilization(schedules);

  return {
    optimized_allocations,
    unallocated_orders,
    optimization_summary: {
      total_orders: orders.length,
      allocated_orders: optimized_allocations.length,
      fleet_utilization: overall_utilization
    }
  };
} 