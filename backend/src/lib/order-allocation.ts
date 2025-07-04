import { TRPCError } from '@trpc/server';

export interface OrderAllocationRequest {
  order_id: string;
  truck_id?: string; // Optional - system can auto-assign
  allocation_date: string;
  force_allocation?: boolean; // Override capacity warnings
}

export interface TruckCapacityInfo {
  truck_id: string;
  total_capacity_kg: number;
  allocated_weight_kg: number;
  available_capacity_kg: number;
  utilization_percentage: number;
  orders_count: number;
  is_overallocated: boolean;
}

export interface AllocationSuggestion {
  truck_id: string;
  fleet_number: string;
  capacity_info: TruckCapacityInfo;
  score: number; // 0-100, higher is better
  reasons: string[];
}

export class OrderAllocationService {
  constructor(private supabase: any, private logger: any, private tenant_id: string) {}

  /**
   * Calculate order weight based on product variants and quantities
   */
  async calculateOrderWeight(order_id: string): Promise<number> {
    try {
      // Get order lines with product details
      const { data: orderLines, error: linesError } = await this.supabase
        .from('order_lines')
        .select(`
          id,
          quantity,
          product:products (
            id,
            sku,
            name,
            is_variant,
            variant_name,
            capacity_kg,
            tare_weight_kg,
            parent_product_id
          )
        `)
        .eq('order_id', order_id);

      if (linesError) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch order lines for weight calculation',
        });
      }

      let totalWeight = 0;

      for (const line of orderLines || []) {
        const product = line.product;
        if (!product) continue;

        let unitWeight = 0;

        if (product.capacity_kg && product.tare_weight_kg) {
          if (product.is_variant && product.variant_name === 'full') {
            // Full cylinder: tare weight + gas weight
            unitWeight = product.tare_weight_kg + product.capacity_kg;
          } else if (product.is_variant && product.variant_name === 'empty') {
            // Empty cylinder: just tare weight
            unitWeight = product.tare_weight_kg;
          } else {
            // Non-variant product or other variants
            unitWeight = product.tare_weight_kg || product.capacity_kg || 27; // Default 27kg for typical 13kg cylinder
          }
        } else {
          // Default weight estimation for products without weight data
          unitWeight = 27; // Typical 13kg LPG cylinder total weight
        }

        totalWeight += line.quantity * unitWeight;
      }

      this.logger.info(`Calculated order weight: ${totalWeight}kg for order ${order_id}`);
      return totalWeight;
    } catch (error) {
      this.logger.error('Error calculating order weight:', error);
      throw error;
    }
  }

  /**
   * Get truck capacity information for a specific date
   */
  async getTruckCapacity(truck_id: string, date: string): Promise<TruckCapacityInfo> {
    try {
      // Get truck details
      const { data: truck, error: truckError } = await this.supabase
        .from('truck')
        .select('*')
        .eq('id', truck_id)
        .single();

      if (truckError || !truck) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Truck not found',
        });
      }

      // Calculate total capacity (use capacity_kg if available, otherwise estimate from cylinders)
      const totalCapacity = truck.capacity_kg || (truck.capacity_cylinders * 27);

      // Get existing allocations for the date
      const { data: allocations, error: allocError } = await this.supabase
        .from('truck_allocations')
        .select('estimated_weight_kg')
        .eq('truck_id', truck_id)
        .eq('allocation_date', date)
        .neq('status', 'cancelled');

      if (allocError) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch truck allocations',
        });
      }

      const allocatedWeight = allocations?.reduce((sum, alloc) => sum + (alloc.estimated_weight_kg || 0), 0) || 0;
      const availableCapacity = totalCapacity - allocatedWeight;
      const utilizationPercentage = totalCapacity > 0 ? (allocatedWeight / totalCapacity) * 100 : 0;

      return {
        truck_id,
        total_capacity_kg: totalCapacity,
        allocated_weight_kg: allocatedWeight,
        available_capacity_kg: availableCapacity,
        utilization_percentage: Math.round(utilizationPercentage * 100) / 100,
        orders_count: allocations?.length || 0,
        is_overallocated: allocatedWeight > totalCapacity,
      };
    } catch (error) {
      this.logger.error('Error getting truck capacity:', error);
      throw error;
    }
  }

  /**
   * Find best truck suggestions for an order
   */
  async findBestTrucks(order_id: string, allocation_date: string, order_weight?: number): Promise<AllocationSuggestion[]> {
    try {
      // Calculate order weight if not provided
      const orderWeight = order_weight || await this.calculateOrderWeight(order_id);

      // Get all active trucks
      const { data: trucks, error: trucksError } = await this.supabase
        .from('truck')
        .select('*')
        .eq('active', true)
        .order('fleet_number');

      if (trucksError) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch trucks',
        });
      }

      const suggestions: AllocationSuggestion[] = [];

      for (const truck of trucks || []) {
        const capacityInfo = await this.getTruckCapacity(truck.id, allocation_date);
        
        let score = 0;
        const reasons: string[] = [];

        // Scoring logic
        if (capacityInfo.available_capacity_kg >= orderWeight) {
          score += 50; // Can fit the order
          reasons.push('Has sufficient capacity');

          // Prefer trucks with better utilization (not too empty, not too full)
          const newUtilization = ((capacityInfo.allocated_weight_kg + orderWeight) / capacityInfo.total_capacity_kg) * 100;
          if (newUtilization >= 60 && newUtilization <= 85) {
            score += 30; // Good utilization range
            reasons.push('Optimal capacity utilization');
          } else if (newUtilization >= 85 && newUtilization <= 95) {
            score += 20; // High but acceptable utilization
            reasons.push('High capacity utilization');
          } else if (newUtilization < 60) {
            score += 10; // Low utilization
            reasons.push('Low capacity utilization');
          }

          // Prefer trucks with fewer existing orders (easier routing)
          if (capacityInfo.orders_count <= 3) {
            score += 15;
            reasons.push('Few existing orders');
          } else if (capacityInfo.orders_count <= 6) {
            score += 10;
            reasons.push('Moderate order count');
          } else {
            score += 5;
            reasons.push('Many existing orders');
          }

        } else {
          // Cannot fit - negative score
          score = -10;
          reasons.push('Insufficient capacity');
          
          if (capacityInfo.is_overallocated) {
            score -= 20;
            reasons.push('Already overallocated');
          }
        }

        suggestions.push({
          truck_id: truck.id,
          fleet_number: truck.fleet_number,
          capacity_info: capacityInfo,
          score,
          reasons,
        });
      }

      // Sort by score (highest first)
      suggestions.sort((a, b) => b.score - a.score);

      return suggestions;
    } catch (error) {
      this.logger.error('Error finding best trucks:', error);
      throw error;
    }
  }

  /**
   * Allocate order to truck
   */
  async allocateOrder(request: OrderAllocationRequest, user_id?: string): Promise<any> {
    try {
      // Calculate order weight
      const orderWeight = await this.calculateOrderWeight(request.order_id);

      // If no truck specified, find the best one
      let truck_id = request.truck_id;
      if (!truck_id) {
        const suggestions = await this.findBestTrucks(request.order_id, request.allocation_date, orderWeight);
        const bestTruck = suggestions.find(s => s.score > 0);
        
        if (!bestTruck) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'No suitable truck found for this order',
          });
        }
        
        truck_id = bestTruck.truck_id;
      }

      // Validate allocation if not forced
      if (!request.force_allocation) {
        const capacityInfo = await this.getTruckCapacity(truck_id, request.allocation_date);
        
        if (capacityInfo.available_capacity_kg < orderWeight) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Order weight (${orderWeight}kg) exceeds truck capacity (${capacityInfo.available_capacity_kg}kg available)`,
          });
        }
      }

      // Create truck allocation
      const allocationData = {
        truck_id,
        order_id: request.order_id,
        allocation_date: request.allocation_date,
        estimated_weight_kg: orderWeight,
        status: 'planned',
        allocated_by_user_id: user_id,
        allocated_at: new Date().toISOString(),
        tenant_id: this.tenant_id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await this.supabase
        .from('truck_allocations')
        .insert([allocationData])
        .select()
        .single();

      if (error) {
        this.logger.error('Error creating truck allocation:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to allocate order to truck',
        });
      }

      // Update order with truck assignment
      const { error: orderUpdateError } = await this.supabase
        .from('orders')
        .update({
          assigned_truck_id: truck_id,
          truck_assigned_date: request.allocation_date,
          updated_at: new Date().toISOString(),
        })
        .eq('id', request.order_id);

      if (orderUpdateError) {
        this.logger.error('Error updating order with truck assignment:', orderUpdateError);
        // Don't throw here as allocation was created successfully
      }

      this.logger.info(`Order ${request.order_id} allocated to truck ${truck_id} for ${request.allocation_date}`);
      return data;
    } catch (error) {
      this.logger.error('Error allocating order:', error);
      throw error;
    }
  }

  /**
   * Remove truck allocation
   */
  async removeAllocation(allocation_id: string): Promise<void> {
    try {
      // Get allocation details first
      const { data: allocation, error: getAllocError } = await this.supabase
        .from('truck_allocations')
        .select('order_id')
        .eq('id', allocation_id)
        .single();

      if (getAllocError || !allocation) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Truck allocation not found',
        });
      }

      // Remove allocation
      const { error: deleteError } = await this.supabase
        .from('truck_allocations')
        .delete()
        .eq('id', allocation_id);

      if (deleteError) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to remove truck allocation',
        });
      }

      // Update order to remove truck assignment
      const { error: orderUpdateError } = await this.supabase
        .from('orders')
        .update({
          assigned_truck_id: null,
          truck_assigned_date: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', allocation.order_id);

      if (orderUpdateError) {
        this.logger.error('Error updating order after removing allocation:', orderUpdateError);
      }

      this.logger.info(`Truck allocation ${allocation_id} removed`);
    } catch (error) {
      this.logger.error('Error removing allocation:', error);
      throw error;
    }
  }

  /**
   * Get daily schedule for all trucks
   */
  async getDailySchedule(date: string): Promise<any[]> {
    try {
      const { data: trucks, error: trucksError } = await this.supabase
        .from('truck')
        .select('*')
        .eq('active', true)
        .order('fleet_number');

      if (trucksError) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch trucks',
        });
      }

      const schedule = [];

      for (const truck of trucks || []) {
        // Get capacity info
        const capacityInfo = await this.getTruckCapacity(truck.id, date);

        // Get allocations with order details
        const { data: allocations, error: allocError } = await this.supabase
          .from('truck_allocations')
          .select(`
            *,
            order:orders (
              id,
              customer_id,
              order_date,
              scheduled_date,
              status,
              total_amount,
              order_type,
              customer:customers (name, phone),
              delivery_address:addresses (line1, city, postal_code)
            )
          `)
          .eq('truck_id', truck.id)
          .eq('allocation_date', date)
          .neq('status', 'cancelled')
          .order('stop_sequence', { nullsFirst: false });

        if (allocError) {
          this.logger.error(`Error fetching allocations for truck ${truck.id}:`, allocError);
          continue;
        }

        schedule.push({
          truck: {
            ...truck,
            capacity_kg: truck.capacity_kg || (truck.capacity_cylinders * 27),
          },
          capacity_info: capacityInfo,
          allocations: allocations || [],
          total_orders: allocations?.length || 0,
          route_status: this.calculateRouteStatus(allocations || []),
        });
      }

      return schedule;
    } catch (error) {
      this.logger.error('Error getting daily schedule:', error);
      throw error;
    }
  }

  private calculateRouteStatus(allocations: any[]): string {
    if (allocations.length === 0) return 'unassigned';
    
    const statuses = allocations.map(a => a.status);
    
    if (statuses.every(s => s === 'delivered')) return 'completed';
    if (statuses.some(s => s === 'loaded')) return 'in_progress';
    if (statuses.every(s => s === 'planned')) return 'planned';
    
    return 'mixed';
  }
}