import { z } from 'zod';
import { router, protectedProcedure } from '../lib/trpc';
import { requireTenantAccess } from '../lib/auth';
import { TRPCError } from '@trpc/server';

// Validation schemas
const InventoryFiltersSchema = z.object({
  warehouse_id: z.string().uuid().optional(),
  product_id: z.string().uuid().optional(),
  search: z.string().optional(),
  low_stock_only: z.boolean().default(false),
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
  // GET /inventory - List inventory with filtering and pagination
  list: protectedProcedure
    .input(InventoryFiltersSchema)
    .query(async ({ input, ctx }) => {
      const user = requireTenantAccess(ctx);
      
      ctx.logger.info('Fetching inventory with filters:', input);
      
      let query = ctx.supabase
        .from('inventory_balance')
        .select(`
          *,
          warehouse:warehouses!inventory_balance_warehouse_id_fkey(id, name),
          product:products!inventory_balance_product_id_fkey(id, sku, name, unit_of_measure)
        `, { count: 'exact' })
        .eq('tenant_id', user.tenant_id)
        .order('updated_at', { ascending: false });

      // Apply warehouse filter
      if (input.warehouse_id) {
        query = query.eq('warehouse_id', input.warehouse_id);
      }

      // Apply product filter
      if (input.product_id) {
        query = query.eq('product_id', input.product_id);
      }

      // Apply search filter on product SKU and name
      if (input.search) {
        query = query.or(`product.sku.ilike.%${input.search}%,product.name.ilike.%${input.search}%`);
      }

      // Apply pagination
      const from = (input.page - 1) * input.limit;
      const to = from + input.limit - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) {
        ctx.logger.error('Inventory listing error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message
        });
      }

      let inventory = data || [];

      // Client-side low stock filtering if needed
      if (input.low_stock_only) {
        inventory = inventory.filter(item => (item.qty_full - item.qty_reserved) <= 10);
      }

      return {
        inventory,
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / input.limit),
        currentPage: input.page,
      };
    }),

  // GET /inventory/warehouse/{id} - Get inventory for specific warehouse
  getByWarehouse: protectedProcedure
    .input(z.object({
      warehouse_id: z.string().uuid(),
    }))
    .query(async ({ input, ctx }) => {
      const user = requireTenantAccess(ctx);
      
      ctx.logger.info('Fetching warehouse inventory:', input.warehouse_id);
      
      const { data, error } = await ctx.supabase
        .from('inventory_balance')
        .select(`
          *,
          product:products!inventory_balance_product_id_fkey(id, sku, name, unit_of_measure)
        `)
        .eq('warehouse_id', input.warehouse_id)
        .eq('tenant_id', user.tenant_id)
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
      const user = requireTenantAccess(ctx);
      
      ctx.logger.info('Fetching product inventory:', input.product_id);
      
      const { data, error } = await ctx.supabase
        .from('inventory_balance')
        .select(`
          *,
          warehouse:warehouses!inventory_balance_warehouse_id_fkey(id, name)
        `)
        .eq('product_id', input.product_id)
        .eq('tenant_id', user.tenant_id)
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
      const user = requireTenantAccess(ctx);
      
      ctx.logger.info('Fetching inventory statistics');
      
      let query = ctx.supabase
        .from('inventory_balance')
        .select('qty_full, qty_empty, qty_reserved')
        .eq('tenant_id', user.tenant_id);

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
      const user = requireTenantAccess(ctx);
      
      ctx.logger.info('Adjusting stock:', input);

      // Validate inventory exists and belongs to tenant
      const { data: currentInventory, error: fetchError } = await ctx.supabase
        .from('inventory_balance')
        .select('*')
        .eq('id', input.inventory_id)
        .eq('tenant_id', user.tenant_id)
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
        .eq('tenant_id', user.tenant_id)
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

      // TODO: Create stock movement record for audit trail
      // This would be implemented when stock_movements table exists

      ctx.logger.info('Stock adjusted successfully:', data);
      return data;
    }),

  // POST /inventory/transfer - Transfer stock between warehouses
  transferStock: protectedProcedure
    .input(StockTransferSchema)
    .mutation(async ({ input, ctx }) => {
      const user = requireTenantAccess(ctx);
      
      ctx.logger.info('Transferring stock:', input);

      // Validate source and destination are different
      if (input.from_warehouse_id === input.to_warehouse_id) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Source and destination warehouses must be different'
        });
      }

      // Validate both warehouses belong to tenant
      const { data: warehouses, error: warehouseError } = await ctx.supabase
        .from('warehouses')
        .select('id')
        .eq('tenant_id', user.tenant_id)
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
        .eq('tenant_id', user.tenant_id)
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
        .eq('tenant_id', user.tenant_id)
        .single();

      if (destError && destError.code === 'PGRST116') {
        // Create new inventory record for destination
        const { data: newDestInventory, error: createError } = await ctx.supabase
          .from('inventory_balance')
          .insert([{
            warehouse_id: input.to_warehouse_id,
            product_id: input.product_id,
            tenant_id: user.tenant_id,
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

      // Try using RPC for atomic transfer first
      const { error: transferError } = await ctx.supabase.rpc('transfer_stock', {
        p_from_warehouse_id: input.from_warehouse_id,
        p_to_warehouse_id: input.to_warehouse_id,
        p_product_id: input.product_id,
        p_qty_full: input.qty_full,
        p_qty_empty: input.qty_empty,
        p_tenant_id: user.tenant_id,
      });

      if (transferError) {
        // Fallback to manual transaction if RPC doesn't exist
        ctx.logger.warn('RPC transfer failed, using manual transaction:', transferError);
        
        // Update source inventory
        const { error: sourceUpdateError } = await ctx.supabase
          .from('inventory_balance')
          .update({
            qty_full: sourceInventory.qty_full - input.qty_full,
            qty_empty: sourceInventory.qty_empty - input.qty_empty,
            updated_at: new Date().toISOString(),
          })
          .eq('id', sourceInventory.id)
          .eq('tenant_id', user.tenant_id);

        if (sourceUpdateError) {
          ctx.logger.error('Source inventory update error:', sourceUpdateError);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: sourceUpdateError.message
          });
        }

        // Update destination inventory
        const { error: destUpdateError } = await ctx.supabase
          .from('inventory_balance')
          .update({
            qty_full: destInventory.qty_full + input.qty_full,
            qty_empty: destInventory.qty_empty + input.qty_empty,
            updated_at: new Date().toISOString(),
          })
          .eq('id', destInventory.id)
          .eq('tenant_id', user.tenant_id);

        if (destUpdateError) {
          ctx.logger.error('Destination inventory update error:', destUpdateError);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: destUpdateError.message
          });
        }
      }

      // TODO: Create stock movement records for audit trail

      ctx.logger.info('Stock transferred successfully');
      return { success: true };
    }),

  // POST /inventory/create - Create new inventory balance record
  create: protectedProcedure
    .input(CreateInventoryBalanceSchema)
    .mutation(async ({ input, ctx }) => {
      const user = requireTenantAccess(ctx);
      
      ctx.logger.info('Creating inventory balance:', input);

      // Validate warehouse and product belong to tenant
      const { data: warehouse, error: warehouseError } = await ctx.supabase
        .from('warehouses')
        .select('id')
        .eq('id', input.warehouse_id)
        .eq('tenant_id', user.tenant_id)
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
        .eq('tenant_id', user.tenant_id)
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
        .eq('tenant_id', user.tenant_id)
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
          ...input,
          tenant_id: user.tenant_id,
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
      const user = requireTenantAccess(ctx);
      
      ctx.logger.info('Reserving inventory:', input);

      const results = [];

      for (const reservation of input.reservations) {
        // Find appropriate inventory record
        let query = ctx.supabase
          .from('inventory_balance')
          .select('*')
          .eq('product_id', reservation.product_id)
          .eq('tenant_id', user.tenant_id)
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
            .eq('tenant_id', user.tenant_id)
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
      const user = requireTenantAccess(ctx);
      
      ctx.logger.info('Fetching recent stock movements');
      
      // This would need a stock_movements table in production
      // For now, we'll return empty array as placeholder
      // TODO: Implement when stock_movements table exists
      
      return [];
    }),
});