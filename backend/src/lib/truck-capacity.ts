import { TRPCError } from '@trpc/server';

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
  variant_name?: string;
}

export interface TruckCapacityInfo {
  truck_id: string;
  total_capacity_kg: number;
  allocated_weight_kg: number;
  available_weight_kg: number;
  utilization_percentage: number;
  orders_count: number;
  is_overallocated: boolean;
}

export interface TruckAllocation {
  id: string;
  truck_id: string;
  order_id: string;
  allocation_date: string;
  estimated_weight_kg: number;
  status: 'planned' | 'loaded' | 'delivered' | 'cancelled';
  created_at: string;
  stop_sequence?: number;
}

export interface TruckWithInventory {
  id: string;
  fleet_number: string;
  license_plate: string;
  capacity_cylinders: number;
  capacity_kg: number;
  driver_name?: string;
  active: boolean;
  status: 'active' | 'inactive' | 'maintenance';
  last_maintenance_date?: string;
  next_maintenance_due?: string;
  maintenance_interval_days?: number;
  fuel_capacity_liters?: number;
  avg_fuel_consumption?: number;
  current_route?: any;
  inventory?: any[];
}

export interface Order {
  id: string;
  customer_id: string;
  status: string;
  delivery_date?: string;
  total_amount: number;
}

export interface OrderLine {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  is_variant: boolean;
  variant_name?: string;
  parent_product_id?: string;
  capacity_kg?: number;
  tare_weight_kg?: number;
  // Tax-related fields
  tax_category?: string;
  tax_rate?: number;
}

export interface DailyTruckSchedule {
  date: string;
  truck_id: string;
  truck: TruckWithInventory;
  route?: any;
  allocations: TruckAllocation[];
  capacity_info: TruckCapacityInfo;
  maintenance_due: boolean;
  fuel_sufficient: boolean;
}

export interface TruckPerformanceMetrics {
  truck_id: string;
  total_deliveries: number;
  avg_utilization: number;
  maintenance_cost: number;
  fuel_efficiency: number;
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
 * FIXED: Now includes actual truck inventory in addition to allocations
 */
export function calculateTruckCapacity(
  truck: TruckWithInventory,
  allocations: TruckAllocation[],
  date: string
): TruckCapacityInfo {
  const dateAllocations = allocations.filter(
    a => a.allocation_date === date && a.status !== 'cancelled'
  );

  // Calculate weight from order allocations
  const allocation_weight_kg = dateAllocations.reduce(
    (sum, allocation) => sum + allocation.estimated_weight_kg, 
    0
  );

  // CRITICAL FIX: Calculate actual inventory weight on the truck
  const inventory_weight_kg = (truck.inventory || []).reduce((sum, item) => {
    // Calculate weight based on actual inventory
    // Use product weight information if available, otherwise use default weights
    let item_weight = 0;
    
    if (item.weight_kg) {
      // Use pre-calculated weight if available
      item_weight = item.weight_kg;
    } else {
      // Calculate weight based on cylinder type and quantities
      // For full cylinders: assume 27kg each (13kg gas + 14kg tare)
      // For empty cylinders: assume 14kg each (tare weight only)
      item_weight = (item.qty_full * 27) + (item.qty_empty * 14);
    }
    
    return sum + item_weight;
  }, 0);

  // Use the MAXIMUM of allocated weight or actual inventory weight
  // This ensures we account for both planned orders and actual transferred inventory
  const allocated_weight_kg = Math.max(allocation_weight_kg, inventory_weight_kg);

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
 * Validate truck loading capacity constraints
 * Implements the requirement: "Do not allow confirmation if either weight > capacity OR bottle count > slots"
 */
export function validateTruckLoadingCapacity(
  truck: TruckWithInventory,
  itemsToLoad: Array<{ product_id: string; qty_full: number; qty_empty: number; weight_kg?: number }>
): {
  is_valid: boolean;
  warnings: string[];
  errors: string[];
  capacity_check: {
    current_cylinders: number;
    cylinders_to_add: number;
    total_cylinders_after: number;
    cylinder_capacity: number;
    cylinder_overflow: number;
    current_weight_kg: number;
    weight_to_add_kg: number;
    total_weight_after_kg: number;
    weight_capacity_kg: number;
    weight_overflow_kg: number;
  };
} {
  const warnings: string[] = [];
  const errors: string[] = [];

  // Check truck status first
  if (!truck.active) {
    errors.push('Truck is inactive');
  }

  if (truck.status === 'maintenance') {
    errors.push('Truck is scheduled for maintenance');
  }

  if (truck.status === 'inactive') {
    errors.push('Truck status is inactive');
  }

  // Calculate current truck inventory
  const currentInventory = truck.inventory || [];
  const current_cylinders = currentInventory.reduce(
    (sum, item) => sum + (item.qty_full || 0) + (item.qty_empty || 0), 
    0
  );
  
  // Calculate current weight
  const current_weight_kg = currentInventory.reduce((sum, item) => {
    // Use pre-calculated weight if available, otherwise estimate
    if (item.weight_kg) {
      return sum + item.weight_kg;
    }
    // Default estimation: 27kg per full cylinder, 14kg per empty cylinder
    return sum + (item.qty_full * 27) + (item.qty_empty * 14);
  }, 0);

  // Calculate new items to be loaded
  const cylinders_to_add = itemsToLoad.reduce(
    (sum, item) => sum + item.qty_full + item.qty_empty, 
    0
  );
  
  const weight_to_add_kg = itemsToLoad.reduce((sum, item) => {
    if (item.weight_kg) {
      return sum + item.weight_kg;
    }
    // Default estimation: 27kg per full cylinder, 14kg per empty cylinder
    return sum + (item.qty_full * 27) + (item.qty_empty * 14);
  }, 0);

  // Calculate totals after loading
  const total_cylinders_after = current_cylinders + cylinders_to_add;
  const total_weight_after_kg = current_weight_kg + weight_to_add_kg;

  // Get truck capacities
  const cylinder_capacity = truck.capacity_cylinders;
  const weight_capacity_kg = truck.capacity_kg || (cylinder_capacity * 27); // Default: assume 27kg per cylinder capacity

  // Calculate overflows
  const cylinder_overflow = total_cylinders_after - cylinder_capacity;
  const weight_overflow_kg = total_weight_after_kg - weight_capacity_kg;

  const capacity_check = {
    current_cylinders,
    cylinders_to_add,
    total_cylinders_after,
    cylinder_capacity,
    cylinder_overflow,
    current_weight_kg,
    weight_to_add_kg,
    total_weight_after_kg,
    weight_capacity_kg,
    weight_overflow_kg
  };

  // CRITICAL VALIDATION: Do not allow confirmation if either constraint is violated
  if (cylinder_overflow > 0) {
    errors.push(
      `Cylinder capacity exceeded: trying to load ${cylinders_to_add} cylinders but only ${cylinder_capacity - current_cylinders} slots available (${total_cylinders_after}/${cylinder_capacity} total)`
    );
  }

  if (weight_overflow_kg > 0) {
    errors.push(
      `Weight capacity exceeded: trying to load ${weight_to_add_kg.toFixed(1)}kg but only ${(weight_capacity_kg - current_weight_kg).toFixed(1)}kg capacity available (${total_weight_after_kg.toFixed(1)}/${weight_capacity_kg.toFixed(1)}kg total)`
    );
  }

  // Warnings for near-capacity situations
  const cylinder_utilization = (total_cylinders_after / cylinder_capacity) * 100;
  const weight_utilization = (total_weight_after_kg / weight_capacity_kg) * 100;

  if (cylinder_utilization > 90 && cylinder_overflow <= 0) {
    warnings.push(`High cylinder utilization after loading: ${cylinder_utilization.toFixed(1)}% (${total_cylinders_after}/${cylinder_capacity})`);
  }

  if (weight_utilization > 90 && weight_overflow_kg <= 0) {
    warnings.push(`High weight utilization after loading: ${weight_utilization.toFixed(1)}% (${total_weight_after_kg.toFixed(1)}/${weight_capacity_kg.toFixed(1)}kg)`);
  }

  return {
    is_valid: errors.length === 0,
    warnings,
    errors,
    capacity_check
  };
}

/**
 * Validate truck allocation for potential issues
 * Enhanced to include both weight and cylinder capacity checks
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

  // Check capacity using enhanced calculation
  const capacity_info = calculateTruckCapacity(truck, existingAllocations, targetDate);
  
  // ENHANCED: Check both weight and cylinder capacity constraints
  const weight_capacity_kg = truck.capacity_kg || (truck.capacity_cylinders * 27);
  
  if (orderWeight > capacity_info.available_weight_kg) {
    errors.push(`Order weight (${orderWeight}kg) exceeds available weight capacity (${capacity_info.available_weight_kg}kg)`);
  }

  // Calculate current cylinder count from inventory
  const currentInventory = truck.inventory || [];
  const current_cylinders = currentInventory.reduce(
    (sum, item) => sum + (item.qty_full || 0) + (item.qty_empty || 0), 
    0
  );
  
  // Estimate cylinders needed for order (rough estimation)
  const estimated_cylinders_needed = Math.ceil(orderWeight / 20); // Rough estimate: 20kg average per cylinder
  const available_cylinder_slots = truck.capacity_cylinders - current_cylinders;
  
  if (estimated_cylinders_needed > available_cylinder_slots) {
    errors.push(`Order requires approximately ${estimated_cylinders_needed} cylinders but only ${available_cylinder_slots} slots available`);
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
 * Process truck inventory data with weight calculations
 * Extracted from duplicated logic in trucks.ts routes
 */
export function processTruckInventory(inventoryData: any[] | null): any[] {
  return (inventoryData || []).map((item: any) => {
    const product = item.product;
    let weight_kg = 0;
    
    if (product && product.capacity_kg && product.tare_weight_kg) {
      weight_kg = (item.qty_full * (product.capacity_kg + product.tare_weight_kg)) +
                 (item.qty_empty * product.tare_weight_kg);
    } else {
      // Use default weights if product details not available
      weight_kg = (item.qty_full * 27) + (item.qty_empty * 14);
    }

    return {
      product_id: item.product_id,
      product_name: product?.name || 'Unknown Product',
      product_sku: product?.sku || '',
      product_variant_name: product?.variant_name,
      qty_full: item.qty_full,
      qty_empty: item.qty_empty,
      weight_kg,
      updated_at: item.updated_at
    };
  });
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