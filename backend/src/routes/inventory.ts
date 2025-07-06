import { z } from 'zod';
import { router, protectedProcedure } from '../lib/trpc';
import { requireAuth } from '../lib/auth';
import { TRPCError } from '@trpc/server';

// Validation schemas
const InventoryFiltersSchema = z.object({
  warehouse_id: z.string().uuid().optional(),
  product_id: z.string().uuid().optional(),
  search: z.string().optional(),
  low_stock_only: z.boolean().default(false),
  out_of_stock_only: z.boolean().default(false),
  overstocked_only: z.boolean().default(false),
  critical_stock_only: z.boolean().default(false),
  product_status: z.enum(['active', 'end_of_sale', 'obsolete']).optional(),
  stock_threshold_days: z.number().min(1).max(365).default(30),
  min_qty_available: z.number().min(0).optional(),
  max_qty_available: z.number().min(0).optional(),
  include_reserved: z.boolean().default(true),
  sort_by: z.enum(['updated_at', 'qty_available', 'product_name', 'warehouse_name', 'stock_level_ratio']).default('updated_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc'),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(50),
});

const StockAdjustmentSchema = z.object({
  inventory_id: z.string().uuid(),
  adjustment_type: z.enum(['received_full', 'received_empty', 'physical_count', 'damage_loss', 'other']),
  qty_full_change: z.number(),
  qty_empty_change: z.number(),
  reason: z.string().min(1, 'Reason is required'),
});

const StockTransferSchema = z.object({
  from_warehouse_id: z.string().uuid(),
  to_warehouse_id: z.string().uuid(),
  product_id: z.string().uuid(),
  qty_full: z.number().min(0),
  qty_empty: z.number().min(0),
  notes: z.string().optional(),
});

const CreateInventoryBalanceSchema = z.object({
  warehouse_id: z.string().uuid(),
  product_id: z.string().uuid(),
  qty_full: z.number().min(0).default(0),
  qty_empty: z.number().min(0).default(0),
  qty_reserved: z.number().min(0).default(0),
});

const ReservationSchema = z.object({
  order_id: z.string().uuid().optional(),
  reservations: z.array(z.object({
    product_id: z.string().uuid(),
    quantity: z.number().positive(),
    warehouse_id: z.string().uuid().optional(),
  })),
});

export const inventoryRouter = router({
  // GET /inventory - List inventory with advanced filtering and business logic
  list: protectedProcedure
    .input(InventoryFiltersSchema)
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Fetching inventory with advanced filters:', input);
      
      let query = ctx.supabase
        .from('inventory_balance')
        .select(`
          *,
          warehouse:warehouses!inventory_balance_warehouse_id_fkey(id, name),
          product:products!inventory_balance_product_id_fkey(id, sku, name, unit_of_measure, status, capacity_kg)
        `, { count: 'exact' });

      // Apply warehouse filter
      if (input.warehouse_id) {
        query = query.eq('warehouse_id', input.warehouse_id);
      }

      // Apply product filter
      if (input.product_id) {
        query = query.eq('product_id', input.product_id);
      }

      // Apply product status filter
      if (input.product_status) {
        query = query.eq('product.status', input.product_status);
      }

      // Enhanced search filter
      if (input.search) {
        query = query.or(`
          product.sku.ilike.%${input.search}%,
          product.name.ilike.%${input.search}%,
          warehouse.name.ilike.%${input.search}%
        `);
      }

      // Apply quantity range filters
      if (input.min_qty_available !== undefined) {
        query = query.gte('qty_full', input.min_qty_available);
      }
      if (input.max_qty_available !== undefined) {
        query = query.lte('qty_full', input.max_qty_available);
      }

      const { data, error, count } = await query;

      if (error) {
        ctx.logger.error('Inventory listing error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message
        });
      }

      let inventory = (data || []).map(item => {
        const qtyAvailable = input.include_reserved ? item.qty_full : (item.qty_full - item.qty_reserved);
        // Use default values since reorder_level and max_stock_level columns may not exist yet
        // These should be configurable per product after migration is applied
        const reorderLevel = item.product?.reorder_level || (item.product?.capacity_kg >= 50 ? 5 : item.product?.capacity_kg >= 20 ? 10 : 20);
        const maxStockLevel = item.product?.max_stock_level || (item.product?.capacity_kg >= 50 ? 50 : item.product?.capacity_kg >= 20 ? 100 : 200);
        const stockLevel = calculateStockLevel(qtyAvailable, reorderLevel, maxStockLevel);
        
        return {
          ...item,
          qty_available: qtyAvailable,
          stock_level: stockLevel,
          stock_level_ratio: maxStockLevel > 0 ? qtyAvailable / maxStockLevel : 0,
          days_of_stock: calculateDaysOfStock(item, input.stock_threshold_days),
          is_critical: stockLevel === 'critical',
          is_low: stockLevel === 'low',
          is_out_of_stock: qtyAvailable <= 0,
          is_overstocked: stockLevel === 'overstocked',
          turnover_rate: calculateTurnoverRate(item),
          storage_cost: calculateStorageCost(item),
        };
      });

      // Apply business logic filters
      if (input.low_stock_only) {
        inventory = inventory.filter(item => item.is_low);
      }
      if (input.out_of_stock_only) {
        inventory = inventory.filter(item => item.is_out_of_stock);
      }
      if (input.overstocked_only) {
        inventory = inventory.filter(item => item.is_overstocked);
      }
      if (input.critical_stock_only) {
        inventory = inventory.filter(item => item.is_critical);
      }

      // Apply sorting
      inventory = applySorting(inventory, input.sort_by, input.sort_order);

      // Apply pagination after filtering
      const totalFiltered = inventory.length;
      const from = (input.page - 1) * input.limit;
      const to = from + input.limit;
      inventory = inventory.slice(from, to);

      return {
        inventory,
        totalCount: totalFiltered,
        totalPages: Math.ceil(totalFiltered / input.limit),
        currentPage: input.page,
        // Include summary analytics
        summary: generateInventorySummary(data || []),
      };
    }),

  // GET /inventory/warehouse/{id} - Get inventory for specific warehouse
  getByWarehouse: protectedProcedure
    .input(z.object({
      warehouse_id: z.string().uuid(),
    }))
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Fetching warehouse inventory:', input.warehouse_id);
      
      const { data, error } = await ctx.supabase
        .from('inventory_balance')
        .select(`
          *,
          product:products!inventory_balance_product_id_fkey(id, sku, name, unit_of_measure)
        `)
        .eq('warehouse_id', input.warehouse_id)
        .order('updated_at', { ascending: false });

      if (error) {
        ctx.logger.error('Warehouse inventory error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message
        });
      }

      return data || [];
    }),

  // GET /inventory/product/{id} - Get inventory for specific product across warehouses
  getByProduct: protectedProcedure
    .input(z.object({
      product_id: z.string().uuid(),
    }))
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Fetching product inventory:', input.product_id);
      
      const { data, error } = await ctx.supabase
        .from('inventory_balance')
        .select(`
          *,
          warehouse:warehouses!inventory_balance_warehouse_id_fkey(id, name)
        `)
        .eq('product_id', input.product_id)
        .order('updated_at', { ascending: false });

      if (error) {
        ctx.logger.error('Product inventory error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message
        });
      }

      return data || [];
    }),

  // GET /inventory/stats - Get inventory statistics
  getStats: protectedProcedure
    .input(z.object({
      warehouse_id: z.string().uuid().optional(),
    }))
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Fetching inventory statistics');
      
      let query = ctx.supabase
        .from('inventory_balance')
        .select('qty_full, qty_empty, qty_reserved')
        ;

      if (input.warehouse_id) {
        query = query.eq('warehouse_id', input.warehouse_id);
      }

      const { data, error } = await query;

      if (error) {
        ctx.logger.error('Inventory stats error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message
        });
      }

      const stats = {
        total_cylinders: (data || []).reduce((sum, item) => sum + item.qty_full + item.qty_empty, 0),
        total_full: (data || []).reduce((sum, item) => sum + item.qty_full, 0),
        total_empty: (data || []).reduce((sum, item) => sum + item.qty_empty, 0),
        total_reserved: (data || []).reduce((sum, item) => sum + item.qty_reserved, 0),
        total_available: (data || []).reduce((sum, item) => sum + (item.qty_full - item.qty_reserved), 0),
        low_stock_products: (data || []).filter(item => (item.qty_full - item.qty_reserved) <= 10).length,
      };

      ctx.logger.info('Inventory stats:', stats);
      return stats;
    }),

  // POST /inventory/adjust - Adjust inventory levels
  adjustStock: protectedProcedure
    .input(StockAdjustmentSchema)
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Adjusting stock:', input);

      // Validate inventory exists
      const { data: currentInventory, error: fetchError } = await ctx.supabase
        .from('inventory_balance')
        .select('*')
        .eq('id', input.inventory_id)
        .single();

      if (fetchError || !currentInventory) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Inventory record not found'
        });
      }

      // Calculate new quantities
      const newQtyFull = currentInventory.qty_full + input.qty_full_change;
      const newQtyEmpty = currentInventory.qty_empty + input.qty_empty_change;

      // Validate quantities
      if (newQtyFull < 0 || newQtyEmpty < 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Stock quantities cannot be negative'
        });
      }

      // Validate reserved stock doesn't exceed available
      if (newQtyFull < currentInventory.qty_reserved) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Cannot reduce full stock below reserved quantity (${currentInventory.qty_reserved})`
        });
      }

      // Update inventory in a transaction-like manner
      const { data, error } = await ctx.supabase
        .from('inventory_balance')
        .update({
          qty_full: newQtyFull,
          qty_empty: newQtyEmpty,
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.inventory_id)
        .select(`
          *,
          warehouse:warehouses!inventory_balance_warehouse_id_fkey(id, name),
          product:products!inventory_balance_product_id_fkey(id, sku, name, unit_of_measure)
        `)
        .single();

      if (error) {
        ctx.logger.error('Stock adjustment error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message
        });
      }

      // Note: Stock movement audit trail would be implemented here
      // Requires stock_movements table with: movement_type, inventory_id, 
      // old_qty_full, new_qty_full, old_qty_empty, new_qty_empty, reason, user_id, timestamp

      ctx.logger.info('Stock adjusted successfully:', data);
      return data;
    }),

  // POST /inventory/transfer - Transfer stock between warehouses
  transferStock: protectedProcedure
    .input(StockTransferSchema)
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Transferring stock:', input);

      // Validate source and destination are different
      if (input.from_warehouse_id === input.to_warehouse_id) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Source and destination warehouses must be different'
        });
      }

      // Validate both warehouses exist
      const { data: warehouses, error: warehouseError } = await ctx.supabase
        .from('warehouses')
        .select('id')
        .in('id', [input.from_warehouse_id, input.to_warehouse_id]);

      if (warehouseError || warehouses.length !== 2) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'One or both warehouses not found'
        });
      }

      // Get source inventory
      const { data: sourceInventory, error: sourceError } = await ctx.supabase
        .from('inventory_balance')
        .select('*')
        .eq('warehouse_id', input.from_warehouse_id)
        .eq('product_id', input.product_id)
        .single();

      if (sourceError) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Source inventory not found'
        });
      }

      // Validate transfer quantities
      if (input.qty_full > sourceInventory.qty_full) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Cannot transfer more full cylinders than available (${sourceInventory.qty_full})`
        });
      }
      if (input.qty_empty > sourceInventory.qty_empty) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Cannot transfer more empty cylinders than available (${sourceInventory.qty_empty})`
        });
      }

      // Check if transfer would leave less than reserved stock
      const remainingFull = sourceInventory.qty_full - input.qty_full;
      if (remainingFull < sourceInventory.qty_reserved) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Transfer would leave insufficient stock to cover reservations (${sourceInventory.qty_reserved} reserved)`
        });
      }

      // Get or create destination inventory
      let { data: destInventory, error: destError } = await ctx.supabase
        .from('inventory_balance')
        .select('*')
        .eq('warehouse_id', input.to_warehouse_id)
        .eq('product_id', input.product_id)
        .single();

      if (destError && destError.code === 'PGRST116') {
        // Create new inventory record for destination
        const { data: newDestInventory, error: createError } = await ctx.supabase
          .from('inventory_balance')
          .insert([{
            warehouse_id: input.to_warehouse_id,
            product_id: input.product_id,
            qty_full: 0,
            qty_empty: 0,
            qty_reserved: 0,
            updated_at: new Date().toISOString(),
          }])
          .select()
          .single();

        if (createError) {
          ctx.logger.error('Destination inventory creation error:', createError);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: createError.message
          });
        }

        destInventory = newDestInventory;
      } else if (destError) {
        ctx.logger.error('Destination inventory error:', destError);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: destError.message
        });
      }

      // Execute transfer using atomic RPC function
      const { data: transferResult, error: transferError } = await ctx.supabase.rpc('transfer_stock', {
        p_from_warehouse_id: input.from_warehouse_id,
        p_to_warehouse_id: input.to_warehouse_id,
        p_product_id: input.product_id,
        p_qty_full: input.qty_full,
        p_qty_empty: input.qty_empty,
      });

      if (transferError) {
        ctx.logger.error('Atomic transfer failed:', transferError);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Transfer failed: ${transferError.message}`
        });
      }

      ctx.logger.info('Atomic transfer completed successfully:', transferResult);

      // Get updated inventory records for response
      const { data: updatedSourceInventory } = await ctx.supabase
        .from('inventory_balance')
        .select(`
          *,
          warehouse:warehouses!inventory_balance_warehouse_id_fkey(id, name),
          product:products!inventory_balance_product_id_fkey(id, sku, name, unit_of_measure)
        `)
        .eq('id', sourceInventory.id)
        .single();

      const { data: updatedDestInventory } = await ctx.supabase
        .from('inventory_balance')
        .select(`
          *,
          warehouse:warehouses!inventory_balance_warehouse_id_fkey(id, name),
          product:products!inventory_balance_product_id_fkey(id, sku, name, unit_of_measure)
        `)
        .eq('id', destInventory.id)
        .single();

      const response = {
        success: true,
        transfer_result: transferResult,
        transfer: {
          from_warehouse_id: input.from_warehouse_id,
          to_warehouse_id: input.to_warehouse_id,
          product_id: input.product_id,
          qty_full: input.qty_full,
          qty_empty: input.qty_empty,
          notes: input.notes,
          timestamp: new Date().toISOString(),
        },
        source_inventory: updatedSourceInventory,
        destination_inventory: updatedDestInventory,
      };

      ctx.logger.info('Stock transferred successfully:', response);
      return response;
    }),

  // POST /inventory/create - Create new inventory balance record
  create: protectedProcedure
    .input(CreateInventoryBalanceSchema)
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Creating inventory balance:', input);

      // Validate warehouse exists
      const { data: warehouse, error: warehouseError } = await ctx.supabase
        .from('warehouses')
        .select('id')
        .eq('id', input.warehouse_id)
        .single();

      if (warehouseError || !warehouse) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Warehouse not found'
        });
      }

      const { data: product, error: productError } = await ctx.supabase
        .from('products')
        .select('id')
        .eq('id', input.product_id)
        .single();

      if (productError || !product) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Product not found'
        });
      }

      // Check if inventory balance already exists
      const { data: existing } = await ctx.supabase
        .from('inventory_balance')
        .select('id')
        .eq('warehouse_id', input.warehouse_id)
        .eq('product_id', input.product_id)
        .single();

      if (existing) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Inventory balance already exists for this product and warehouse'
        });
      }

      const { data, error } = await ctx.supabase
        .from('inventory_balance')
        .insert([{
          warehouse_id: input.warehouse_id,
          product_id: input.product_id,
          qty_full: input.qty_full,
          qty_empty: input.qty_empty,
          qty_reserved: input.qty_reserved,
          updated_at: new Date().toISOString(),
        }])
        .select(`
          *,
          warehouse:warehouses!inventory_balance_warehouse_id_fkey(id, name),
          product:products!inventory_balance_product_id_fkey(id, sku, name, unit_of_measure)
        `)
        .single();

      if (error) {
        ctx.logger.error('Inventory creation error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message
        });
      }

      ctx.logger.info('Inventory balance created successfully:', data);
      return data;
    }),

  // POST /inventory/reserve - Reserve inventory for orders (idempotent)
  reserve: protectedProcedure
    .input(ReservationSchema)
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Reserving inventory:', input);

      const results = [];

      for (const reservation of input.reservations) {
        // Find appropriate inventory record
        let query = ctx.supabase
          .from('inventory_balance')
          .select('*')
          .eq('product_id', reservation.product_id)
          .gt('qty_full', 0); // Only consider records with stock

        if (reservation.warehouse_id) {
          query = query.eq('warehouse_id', reservation.warehouse_id);
        }

        query = query.order('qty_full', { ascending: false }); // Prefer warehouses with more stock

        const { data: inventoryRecords, error } = await query;

        if (error) {
          ctx.logger.error('Inventory reservation query error:', error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: error.message
          });
        }

        if (!inventoryRecords || inventoryRecords.length === 0) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: `No available inventory found for product ${reservation.product_id}`
          });
        }

        let remainingToReserve = reservation.quantity;
        
        for (const inventory of inventoryRecords) {
          if (remainingToReserve <= 0) break;

          const availableStock = inventory.qty_full - inventory.qty_reserved;
          if (availableStock <= 0) continue;

          const toReserve = Math.min(remainingToReserve, availableStock);
          const newReserved = inventory.qty_reserved + toReserve;

          // Update reservation atomically
          const { data: updated, error: updateError } = await ctx.supabase
            .from('inventory_balance')
            .update({
              qty_reserved: newReserved,
              updated_at: new Date().toISOString(),
            })
            .eq('id', inventory.id)
            .eq('qty_reserved', inventory.qty_reserved) // Optimistic locking
            .select()
            .single();

          if (updateError) {
            ctx.logger.error('Inventory reservation update error:', updateError);
            // Continue to next inventory record if this update failed due to concurrency
            continue;
          }

          results.push({
            inventory_id: updated.id,
            warehouse_id: updated.warehouse_id,
            product_id: updated.product_id,
            quantity_reserved: toReserve,
          });

          remainingToReserve -= toReserve;
        }

        if (remainingToReserve > 0) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Insufficient stock to reserve ${reservation.quantity} units of product ${reservation.product_id}. Could only reserve ${reservation.quantity - remainingToReserve} units.`
          });
        }
      }

      ctx.logger.info('Inventory reserved successfully:', results);
      return { reservations: results };
    }),

  // GET /inventory/movements - Get recent stock movements
  getMovements: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(10),
      warehouse_id: z.string().uuid().optional(),
      product_id: z.string().uuid().optional(),
    }))
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Fetching recent stock movements');
      
      // Note: This endpoint would query a stock_movements table in production
      // For now, returning empty array as the audit table doesn't exist yet
      // Future implementation would track all inventory changes with timestamps
      
      return [];
    }),

  // POST /inventory/validate-adjustment - Validate stock adjustment business rules
  validateAdjustment: protectedProcedure
    .input(z.object({
      inventory_id: z.string().uuid(),
      qty_full_change: z.number(),
      qty_empty_change: z.number(),
      adjustment_type: z.enum(['received_full', 'received_empty', 'physical_count', 'damage_loss', 'other']),
    }))
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      const errors: string[] = [];
      const warnings: string[] = [];

      // Get current inventory data
      const { data: inventory, error: inventoryError } = await ctx.supabase
        .from('inventory_balance')
        .select(`
          *,
          warehouse:warehouses(id, name),
          product:products(id, sku, name, unit_of_measure)
        `)
        .eq('id', input.inventory_id)
        .single();

      if (inventoryError || !inventory) {
        errors.push('Inventory record not found');
        return { valid: false, errors, warnings };
      }

      // Business rule: Cannot result in negative inventory
      const newQtyFull = inventory.qty_full + input.qty_full_change;
      const newQtyEmpty = inventory.qty_empty + input.qty_empty_change;

      if (newQtyFull < 0) {
        errors.push(`Full quantity cannot be negative. Current: ${inventory.qty_full}, Change: ${input.qty_full_change}`);
      }

      if (newQtyEmpty < 0) {
        errors.push(`Empty quantity cannot be negative. Current: ${inventory.qty_empty}, Change: ${input.qty_empty_change}`);
      }

      // Business rule: Large adjustments need validation
      const fullChangePercent = Math.abs(input.qty_full_change) / Math.max(inventory.qty_full, 1) * 100;
      const emptyChangePercent = Math.abs(input.qty_empty_change) / Math.max(inventory.qty_empty, 1) * 100;

      if (fullChangePercent > 50) {
        warnings.push(`Large adjustment to full quantity (${fullChangePercent.toFixed(1)}% change) - please verify`);
      }

      if (emptyChangePercent > 50) {
        warnings.push(`Large adjustment to empty quantity (${emptyChangePercent.toFixed(1)}% change) - please verify`);
      }

      // Business rule: Check reserved stock implications
      if (input.qty_full_change < 0 && inventory.qty_reserved > 0) {
        const newAvailableStock = newQtyFull - inventory.qty_reserved;
        if (newAvailableStock < 0) {
          errors.push(`Adjustment would result in insufficient stock to cover ${inventory.qty_reserved} reserved units`);
        } else if (newAvailableStock < inventory.qty_reserved * 0.1) {
          warnings.push(`Adjustment will leave very little available stock after covering reservations`);
        }
      }

      // Business rule: Validate adjustment type consistency
      if (input.adjustment_type === 'received_full' && input.qty_full_change <= 0) {
        errors.push('Received full cylinders adjustment must increase full quantity');
      }

      if (input.adjustment_type === 'received_empty' && input.qty_empty_change <= 0) {
        errors.push('Received empty cylinders adjustment must increase empty quantity');
      }

      if (input.adjustment_type === 'damage_loss' && (input.qty_full_change > 0 || input.qty_empty_change > 0)) {
        errors.push('Damage/Loss adjustments should decrease quantities');
      }

      // Business rule: Maximum adjustment limits
      const maxSingleAdjustment = 1000;
      if (Math.abs(input.qty_full_change) > maxSingleAdjustment) {
        errors.push(`Single adjustment cannot exceed ${maxSingleAdjustment} units for full quantity`);
      }

      if (Math.abs(input.qty_empty_change) > maxSingleAdjustment) {
        errors.push(`Single adjustment cannot exceed ${maxSingleAdjustment} units for empty quantity`);
      }

      // Business rule: Check for pending transfers
      const { data: pendingTransfers } = await ctx.supabase
        .from('multi_sku_transfers')
        .select('id, status')
        .eq('source_warehouse_id', inventory.warehouse_id)
        .in('status', ['pending', 'approved', 'in_transit'])
        .contains('items', [{ product_id: inventory.product_id }]);

      if (pendingTransfers && pendingTransfers.length > 0) {
        warnings.push(`Product has ${pendingTransfers.length} pending transfers - adjustment may affect transfer availability`);
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        current_stock: {
          qty_full: inventory.qty_full,
          qty_empty: inventory.qty_empty,
          qty_reserved: inventory.qty_reserved,
        },
        resulting_stock: {
          qty_full: newQtyFull,
          qty_empty: newQtyEmpty,
          qty_reserved: inventory.qty_reserved,
        },
      };
    }),

  // GET /inventory/low-stock - Get low stock items with intelligent thresholds
  getLowStock: protectedProcedure
    .input(z.object({
      warehouse_id: z.string().uuid().optional(),
      urgency_level: z.enum(['critical', 'low', 'warning']).default('low'),
      days_ahead: z.number().min(1).max(90).default(14),
      include_seasonal: z.boolean().default(true),
    }))
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Fetching low stock items:', input);
      
      let query = ctx.supabase
        .from('inventory_balance')
        .select(`
          *,
          warehouse:warehouses(id, name),
          product:products(id, sku, name, unit_of_measure, status, capacity_kg)
        `);

      if (input.warehouse_id) {
        query = query.eq('warehouse_id', input.warehouse_id);
      }

      // Only active products
      query = query.eq('product.status', 'active');

      const { data, error } = await query;

      if (error) {
        ctx.logger.error('Low stock query error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message
        });
      }

      const inventory = (data || []).map(item => {
        const stockAnalysis = analyzeStockLevel(item, input.days_ahead, input.include_seasonal);
        return {
          ...item,
          ...stockAnalysis,
        };
      });

      const filtered = inventory.filter(item => {
        switch (input.urgency_level) {
          case 'critical':
            return item.urgency_level === 'critical';
          case 'low':
            return ['critical', 'low'].includes(item.urgency_level);
          case 'warning':
            return ['critical', 'low', 'warning'].includes(item.urgency_level);
          default:
            return false;
        }
      });

      // Sort by urgency and days of stock
      const sorted = filtered.sort((a, b) => {
        const urgencyOrder = { critical: 3, low: 2, warning: 1, ok: 0 };
        const urgencyDiff = urgencyOrder[b.urgency_level] - urgencyOrder[a.urgency_level];
        if (urgencyDiff !== 0) return urgencyDiff;
        return a.projected_days_remaining - b.projected_days_remaining;
      });

      return {
        low_stock_items: sorted,
        summary: {
          total_items: sorted.length,
          critical_items: sorted.filter(item => item.urgency_level === 'critical').length,
          total_reorder_cost: sorted.reduce((sum, item) => sum + (item.suggested_reorder_cost || 0), 0),
          total_potential_stockout_cost: sorted.reduce((sum, item) => sum + (item.stockout_risk_cost || 0), 0),
        }
      };
    }),

  // GET /inventory/availability - Check product availability with business rules
  checkAvailability: protectedProcedure
    .input(z.object({
      products: z.array(z.object({
        product_id: z.string().uuid(),
        quantity_requested: z.number().positive(),
        warehouse_preference: z.string().uuid().optional(),
      })),
      delivery_date: z.string().optional(),
      priority: z.enum(['normal', 'high', 'urgent']).default('normal'),
    }))
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Checking product availability:', input);
      
      const availabilityResults = [];

      for (const productRequest of input.products) {
        let query = ctx.supabase
          .from('inventory_balance')
          .select(`
            *,
            warehouse:warehouses(id, name),
            product:products(id, sku, name, unit_of_measure)
          `)
          .eq('product_id', productRequest.product_id)
          .gt('qty_full', 0);

        if (productRequest.warehouse_preference) {
          query = query.eq('warehouse_id', productRequest.warehouse_preference);
        }

        const { data, error } = await query;

        if (error) {
          ctx.logger.error('Availability check error:', error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: error.message
          });
        }

        const availability = analyzeProductAvailability(
          data || [],
          productRequest.quantity_requested,
          input.delivery_date,
          input.priority
        );

        availabilityResults.push({
          product_id: productRequest.product_id,
          quantity_requested: productRequest.quantity_requested,
          ...availability,
        });
      }

      return {
        availability_results: availabilityResults,
        overall_fulfillment: {
          can_fulfill_all: availabilityResults.every(result => result.can_fulfill),
          partial_fulfillment_possible: availabilityResults.some(result => result.partial_quantity > 0),
          recommended_action: determineRecommendedAction(availabilityResults),
        }
      };
    }),
});

// Helper functions for inventory business logic

function calculateStockLevel(qtyAvailable: number, reorderLevel: number, maxStockLevel: number): 'critical' | 'low' | 'normal' | 'overstocked' {
  if (qtyAvailable <= 0) return 'critical';
  if (qtyAvailable <= reorderLevel * 0.5) return 'critical';
  if (qtyAvailable <= reorderLevel) return 'low';
  if (qtyAvailable >= maxStockLevel * 1.2) return 'overstocked';
  return 'normal';
}

function calculateDaysOfStock(item: any, defaultDays: number): number {
  // Simple calculation - in production, this would use historical consumption data
  const avgDailyUsage = (item.qty_full + item.qty_empty) / defaultDays || 1;
  return item.qty_full / avgDailyUsage;
}

function calculateTurnoverRate(item: any): number {
  // Placeholder - would calculate based on historical data
  // Higher turnover = more frequent movement
  return Math.random() * 10; // Mock value
}

function calculateStorageCost(item: any): number {
  // Calculate storage cost per unit based on warehouse type and product size
  const baseStorageCost = 2; // Base cost per unit per month
  const sizeFactor = (item.product?.capacity_kg || 1) / 10;
  return baseStorageCost * sizeFactor;
}

function applySorting(inventory: any[], sortBy: string, sortOrder: string): any[] {
  return inventory.sort((a, b) => {
    let aValue, bValue;
    
    switch (sortBy) {
      case 'qty_available':
        aValue = a.qty_available;
        bValue = b.qty_available;
        break;
      case 'product_name':
        aValue = a.product?.name || '';
        bValue = b.product?.name || '';
        break;
      case 'warehouse_name':
        aValue = a.warehouse?.name || '';
        bValue = b.warehouse?.name || '';
        break;
      case 'stock_level_ratio':
        aValue = a.stock_level_ratio;
        bValue = b.stock_level_ratio;
        break;
      default:
        aValue = a.updated_at;
        bValue = b.updated_at;
    }
    
    if (typeof aValue === 'string') {
      return sortOrder === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
    }
    
    return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
  });
}

function generateInventorySummary(inventory: any[]): any {
  const summary = {
    total_items: inventory.length,
    total_full_cylinders: inventory.reduce((sum, item) => sum + item.qty_full, 0),
    total_empty_cylinders: inventory.reduce((sum, item) => sum + item.qty_empty, 0),
    total_reserved: inventory.reduce((sum, item) => sum + item.qty_reserved, 0),
    warehouses_count: new Set(inventory.map(item => item.warehouse_id)).size,
    products_count: new Set(inventory.map(item => item.product_id)).size,
    stock_levels: {
      critical: 0,
      low: 0,
      normal: 0,
      overstocked: 0,
    }
  };

  inventory.forEach(item => {
    const stockLevel = calculateStockLevel(
      item.qty_full - item.qty_reserved,
      item.product?.reorder_level || 10,
      item.product?.max_stock_level || 100
    );
    summary.stock_levels[stockLevel]++;
  });

  return summary;
}

function analyzeStockLevel(item: any, daysAhead: number, includeSeasonal: boolean): any {
  const currentStock = item.qty_full - item.qty_reserved;
  const reorderLevel = item.product?.reorder_level || 10;
  const seasonalFactor = includeSeasonal ? (item.product?.seasonal_demand_factor || 1) : 1;
  
  // Calculate projected consumption
  const avgDailyUsage = currentStock / 30; // Simplified calculation
  const projectedUsage = avgDailyUsage * daysAhead * seasonalFactor;
  const projectedStock = currentStock - projectedUsage;
  
  let urgencyLevel: 'critical' | 'low' | 'warning' | 'ok' = 'ok';
  if (projectedStock <= 0) urgencyLevel = 'critical';
  else if (projectedStock <= reorderLevel * 0.5) urgencyLevel = 'critical';
  else if (projectedStock <= reorderLevel) urgencyLevel = 'low';
  else if (projectedStock <= reorderLevel * 1.5) urgencyLevel = 'warning';
  
  return {
    current_stock: currentStock,
    projected_stock: Math.max(0, projectedStock),
    projected_days_remaining: avgDailyUsage > 0 ? currentStock / avgDailyUsage : 999,
    urgency_level: urgencyLevel,
    suggested_reorder_quantity: Math.max(0, reorderLevel * 2 - currentStock),
    suggested_reorder_cost: Math.max(0, reorderLevel * 2 - currentStock) * 50, // Estimated cost
    stockout_risk_cost: urgencyLevel === 'critical' ? 1000 : 0, // Business impact cost
  };
}

function analyzeProductAvailability(inventoryRecords: any[], quantityRequested: number, deliveryDate?: string, priority: string = 'normal'): any {
  const totalAvailable = inventoryRecords.reduce((sum, record) => sum + (record.qty_full - record.qty_reserved), 0);
  const canFulfill = totalAvailable >= quantityRequested;
  
  // Sort warehouses by preference (closest, highest stock, etc.)
  const sortedWarehouses = inventoryRecords
    .filter(record => (record.qty_full - record.qty_reserved) > 0)
    .sort((a, b) => {
      // Priority: highest available stock first
      const stockDiff = (b.qty_full - b.qty_reserved) - (a.qty_full - a.qty_reserved);
      if (stockDiff !== 0) return stockDiff;
      
      // Secondary: warehouse name preference (alphabetical)
      return a.warehouse?.name?.localeCompare(b.warehouse?.name || '') || 0;
    });
  
  const allocationPlan = [];
  let remainingQuantity = quantityRequested;
  
  for (const warehouse of sortedWarehouses) {
    if (remainingQuantity <= 0) break;
    
    const availableHere = warehouse.qty_full - warehouse.qty_reserved;
    const allocateHere = Math.min(remainingQuantity, availableHere);
    
    if (allocateHere > 0) {
      allocationPlan.push({
        warehouse_id: warehouse.warehouse_id,
        warehouse_name: warehouse.warehouse?.name,
        quantity: allocateHere,
        estimated_availability_date: deliveryDate || new Date().toISOString().split('T')[0],
      });
      remainingQuantity -= allocateHere;
    }
  }
  
  return {
    can_fulfill: canFulfill,
    total_available: totalAvailable,
    partial_quantity: quantityRequested - remainingQuantity,
    allocation_plan: allocationPlan,
    estimated_fulfillment_date: deliveryDate || new Date().toISOString().split('T')[0],
    alternative_products: [], // Could suggest similar products
  };
}

function determineRecommendedAction(availabilityResults: any[]): string {
  const canFulfillAll = availabilityResults.every(result => result.can_fulfill);
  const canPartiallyFulfill = availabilityResults.some(result => result.partial_quantity > 0);
  
  if (canFulfillAll) return 'proceed_with_order';
  if (canPartiallyFulfill) return 'partial_fulfillment_available';
  return 'consider_alternative_products';
}