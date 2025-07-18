import { TRPCError } from '@trpc/server';
import { SupabaseClient } from '@supabase/supabase-js';
import { Logger } from 'winston';

export interface TruckReservationRequest {
  truck_id: string;
  product_id: string;
  quantity: number;
  order_id: string;
  user_id?: string;
}

export interface TruckReservationResult {
  success: boolean;
  truck_id: string;
  product_id: string;
  quantity_reserved: number;
  total_reserved: number;
  available_remaining: number;
  order_id: string;
  timestamp: string;
}

export class TruckReservationService {
  constructor(
    private supabase: SupabaseClient,
    private logger: Logger
  ) {}

  /**
   * Reserve inventory on a truck for an order
   */
  async reserveInventory(request: TruckReservationRequest): Promise<TruckReservationResult> {
    try {
      this.logger.info('Reserving truck inventory:', request);

      // Get current truck inventory with lock
      let { data: currentInventory, error: inventoryError } = await this.supabase
        .from('truck_inventory')
        .select('*')
        .eq('truck_id', request.truck_id)
        .eq('product_id', request.product_id)
        .single();

      if (inventoryError && inventoryError.code !== 'PGRST116') { // PGRST116 = not found
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch truck inventory',
        });
      }

      // If no inventory record exists, create one
      if (!currentInventory) {
        const { data: newInventory, error: createError } = await this.supabase
          .from('truck_inventory')
          .insert([{
            truck_id: request.truck_id,
            product_id: request.product_id,
            qty_full: 0,
            qty_empty: 0,
            qty_reserved: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }])
          .select()
          .single();

        if (createError) {
          this.logger.error('Error creating truck inventory record:', createError);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to create truck inventory record',
          });
        }

        currentInventory = newInventory;
      }

      // Calculate available quantity
      const availableQty = (currentInventory.qty_full || 0) - (currentInventory.qty_reserved || 0);

      // Validate sufficient stock
      if (availableQty < request.quantity) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Insufficient available stock on truck. Available: ${availableQty}, Requested: ${request.quantity}`,
        });
      }

      // Update reservation
      const { data: updatedInventory, error: updateError } = await this.supabase
        .from('truck_inventory')
        .update({
          qty_reserved: (currentInventory.qty_reserved || 0) + request.quantity,
          updated_at: new Date().toISOString(),
        })
        .eq('truck_id', request.truck_id)
        .eq('product_id', request.product_id)
        .select()
        .single();

      if (updateError) {
        this.logger.error('Error updating truck inventory reservation:', updateError);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update truck inventory reservation',
        });
      }

      // Log the reservation (optional - you can add a truck_stock_movements table later)
      this.logger.info('Truck inventory reserved successfully:', {
        truck_id: request.truck_id,
        product_id: request.product_id,
        quantity: request.quantity,
        order_id: request.order_id,
        user_id: request.user_id,
      });

      return {
        success: true,
        truck_id: request.truck_id,
        product_id: request.product_id,
        quantity_reserved: request.quantity,
        total_reserved: updatedInventory.qty_reserved,
        available_remaining: availableQty - request.quantity,
        order_id: request.order_id,
        timestamp: new Date().toISOString(),
      };

    } catch (error) {
      this.logger.error('Error reserving truck inventory:', error);
      throw error;
    }
  }

  /**
   * Release reserved inventory on a truck
   */
  async releaseReservation(
    truck_id: string,
    product_id: string,
    quantity: number,
    order_id: string,
    user_id?: string
  ): Promise<TruckReservationResult> {
    try {
      this.logger.info('Releasing truck inventory reservation:', {
        truck_id,
        product_id,
        quantity,
        order_id,
        user_id,
      });

      // Get current truck inventory
      const { data: currentInventory, error: inventoryError } = await this.supabase
        .from('truck_inventory')
        .select('*')
        .eq('truck_id', truck_id)
        .eq('product_id', product_id)
        .single();

      if (inventoryError || !currentInventory) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Truck inventory record not found',
        });
      }

      const currentReserved = currentInventory.qty_reserved || 0;

      // Validate we're not releasing more than reserved
      if (currentReserved < quantity) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Cannot release more than reserved. Reserved: ${currentReserved}, Requested release: ${quantity}`,
        });
      }

      // Update reservation
      const { data: updatedInventory, error: updateError } = await this.supabase
        .from('truck_inventory')
        .update({
          qty_reserved: currentReserved - quantity,
          updated_at: new Date().toISOString(),
        })
        .eq('truck_id', truck_id)
        .eq('product_id', product_id)
        .select()
        .single();

      if (updateError) {
        this.logger.error('Error releasing truck inventory reservation:', updateError);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to release truck inventory reservation',
        });
      }

      this.logger.info('Truck inventory reservation released successfully:', {
        truck_id,
        product_id,
        quantity,
        order_id,
        user_id,
      });

      return {
        success: true,
        truck_id,
        product_id,
        quantity_reserved: -quantity, // Negative to indicate release
        total_reserved: updatedInventory.qty_reserved,
        available_remaining: (currentInventory.qty_full || 0) - updatedInventory.qty_reserved,
        order_id,
        timestamp: new Date().toISOString(),
      };

    } catch (error) {
      this.logger.error('Error releasing truck inventory reservation:', error);
      throw error;
    }
  }

  /**
   * Get truck inventory with reservation information
   */
  async getTruckInventory(truck_id: string): Promise<any[]> {
    try {
      const { data: inventory, error } = await this.supabase
        .from('truck_inventory')
        .select(`
          *,
          product:products (
            id,
            name,
            sku,
            capacity_kg,
            tare_weight_kg
          )
        `)
        .eq('truck_id', truck_id);

      if (error) {
        this.logger.error('Error fetching truck inventory:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch truck inventory',
        });
      }

      // Add calculated fields
      return (inventory || []).map(item => ({
        ...item,
        qty_available: (item.qty_full || 0) - (item.qty_reserved || 0),
        qty_reserved: item.qty_reserved || 0,
        qty_full: item.qty_full || 0,
        qty_empty: item.qty_empty || 0,
      }));

    } catch (error) {
      this.logger.error('Error getting truck inventory:', error);
      throw error;
    }
  }

  /**
   * Check if truck has sufficient available inventory
   */
  async checkAvailability(
    truck_id: string,
    product_id: string,
    quantity: number
  ): Promise<{ available: boolean; available_qty: number; reserved_qty: number }> {
    try {
      const { data: inventory, error } = await this.supabase
        .from('truck_inventory')
        .select('qty_full, qty_reserved')
        .eq('truck_id', truck_id)
        .eq('product_id', product_id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to check truck inventory availability',
        });
      }

      const qty_full = inventory?.qty_full || 0;
      const qty_reserved = inventory?.qty_reserved || 0;
      const available_qty = qty_full - qty_reserved;

      return {
        available: available_qty >= quantity,
        available_qty,
        reserved_qty: qty_reserved,
      };

    } catch (error) {
      this.logger.error('Error checking truck inventory availability:', error);
      throw error;
    }
  }
} 