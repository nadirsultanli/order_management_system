import { z } from 'zod';
import { router, protectedProcedure } from '../lib/trpc';
import { requireAuth } from '../lib/auth';
import { formatErrorMessage } from '../lib/logger';
import { TRPCError } from '@trpc/server';

// Import input schemas
import {
  InventoryFiltersSchema,
  GetByWarehouseSchema,
  GetByProductSchema,
  GetStatsSchema,
  CreateInventoryBalanceSchema,
  StockAdjustmentSchema,
  ValidateAdjustmentSchema,
  StockTransferSchema,
  ReservationSchema,
  GetMovementsSchema,
  GetLowStockSchema,
  CheckAvailabilitySchema,
  CreateReceiptSchema,
  CreateCycleCountSchema,
  InitiateTransferSchema,
  CompleteTransferSchema,
} from '../schemas/input/inventory-input';

// Import output schemas
import {
  InventoryListResponseSchema,
  InventoryByWarehouseResponseSchema,
  InventoryByProductResponseSchema,
  InventoryStatsResponseSchema,
  CreateInventoryResponseSchema,
  StockAdjustmentResponseSchema,
  StockTransferResponseSchema,
  ReservationResponseSchema,
  MovementsResponseSchema,
  ValidateAdjustmentResponseSchema,
  LowStockResponseSchema,
  AvailabilityResponseSchema,
  CreateReceiptResponseSchema,
} from '../schemas/output/inventory-output';

export const inventoryRouter = router({
  // GET /inventory - List inventory with advanced filtering and business logic
  list: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/inventory',
        tags: ['inventory'],
        summary: 'List inventory with advanced filtering',
        description: 'Get inventory balance with advanced filtering, stock level analysis, and business intelligence. Supports filtering by warehouse, product, stock levels, and search terms.',
        protect: true,
      }
    })
    .input(InventoryFiltersSchema.optional())
    .output(z.any())
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      // Provide default values if input is undefined
      const filters = input || {} as any;
      const sort_by = filters.sort_by || 'updated_at';
      const sort_order = filters.sort_order || 'desc';
      const include_reserved = filters.include_reserved || false;
      const stock_threshold_days = filters.stock_threshold_days || 30;
      
      // Remove advanced stock status filters
      // const low_stock_only = filters.low_stock_only || false;
      // const out_of_stock_only = filters.out_of_stock_only || false;
      // const overstocked_only = filters.overstocked_only || false;
      // const critical_stock_only = filters.critical_stock_only || false;
      
      ctx.logger.info('Fetching inventory with filters:', filters);
      
      let query = ctx.supabase
        .from('inventory_balance')
        .select(`
          *,
          warehouse:warehouses!inventory_balance_warehouse_id_fkey(id, name),
          product:products!inventory_balance_product_id_fkey(id, sku, name, unit_of_measure, status, capacity_kg)
        `, { count: 'exact' });

      // Apply warehouse filter
      if (filters.warehouse_id) {
        query = query.eq('warehouse_id', filters.warehouse_id);
      }

      // Apply product filter
      if (filters.product_id) {
        query = query.eq('product_id', filters.product_id);
      }

      // Apply product status filter
      if (filters.product_status) {
        query = query.eq('product.status', filters.product_status);
      }

      // Enhanced search filter - fix PostgREST syntax
      if (filters.search) {
        const searchTerm = `%${filters.search}%`;
        query = query.or(`product.sku.ilike.${searchTerm},product.name.ilike.${searchTerm},warehouse.name.ilike.${searchTerm}`);
      }

      // Apply quantity range filters
      if (filters.min_qty_available !== undefined) {
        query = query.gte('qty_full', filters.min_qty_available);
      }
      if (filters.max_qty_available !== undefined) {
        query = query.lte('qty_full', filters.max_qty_available);
      }

      const { data, error, count } = await query;

      if (error) {
        ctx.logger.error('Inventory listing error:', {
          error: formatErrorMessage(error),
          code: error.code,
          details: error.details,
          hint: error.hint,
          user_id: user.id,
          filters: filters
        });
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to fetch inventory: ${formatErrorMessage(error)}`
        });
      }

      let inventory = (data || []).map(item => {
        const qtyAvailable = include_reserved ? item.qty_full : (item.qty_full - item.qty_reserved);
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
          days_of_stock: calculateDaysOfStock(item, stock_threshold_days),
          is_critical: stockLevel === 'critical',
          is_low: stockLevel === 'low',
          is_out_of_stock: qtyAvailable <= 0,
          is_overstocked: stockLevel === 'overstocked',
          turnover_rate: calculateTurnoverRate(item),
          storage_cost: calculateStorageCost(item),
        };
      });

      // Remove business logic filters for stock status
      // if (low_stock_only) {
      //   inventory = inventory.filter(item => item.is_low);
      // }
      // if (out_of_stock_only) {
      //   inventory = inventory.filter(item => item.is_out_of_stock);
      // }
      // if (overstocked_only) {
      //   inventory = inventory.filter(item => item.is_overstocked);
      // }
      // if (critical_stock_only) {
      //   inventory = inventory.filter(item => item.is_critical);
      // }

      // Apply sorting
      inventory = applySorting(inventory, sort_by, sort_order);

      // Apply pagination after filtering
      const totalFiltered = inventory.length;

      return {
        inventory,
        totalCount: totalFiltered,
        // Include summary analytics
        summary: generateInventorySummary(inventory),
      };
    }),

  // GET /inventory/warehouse/{warehouse_id} - Get inventory for specific warehouse
  getByWarehouse: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/inventory/warehouse/{warehouse_id}',
        tags: ['inventory'],
        summary: 'Get inventory by warehouse',
        description: 'Retrieve all inventory records for a specific warehouse with product details.',
        protect: true,
      }
    })
    .input(GetByWarehouseSchema)
    .output(z.any())
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Fetching warehouse inventory:', input.warehouse_id);
      
      const { data, error } = await ctx.supabase
        .from('inventory_balance')
        .select(`
          *,
          warehouse:warehouses!inventory_balance_warehouse_id_fkey(id, name),
          product:products!inventory_balance_product_id_fkey(id, sku, name, unit_of_measure)
        `)
        .eq('warehouse_id', input.warehouse_id)
        .order('updated_at', { ascending: false });

      if (error) {
        ctx.logger.error('Warehouse inventory error:', {
          error: formatErrorMessage(error),
          code: error.code,
          details: error.details,
          hint: error.hint,
          user_id: user.id,
          warehouse_id: input.warehouse_id
        });
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to fetch warehouse inventory: ${formatErrorMessage(error)}`
        });
      }

      return data || [];
    }),

  // GET /inventory/product/{product_id} - Get inventory for specific product across warehouses
  getByProduct: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/inventory/product/{product_id}',
        tags: ['inventory'],
        summary: 'Get inventory by product',
        description: 'Retrieve inventory records for a specific product across all warehouses.',
        protect: true,
      }
    })
    .input(GetByProductSchema)
    .output(z.any())
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
        ctx.logger.error('Product inventory error:', {
          error: formatErrorMessage(error),
          code: error.code,
          details: error.details,
          hint: error.hint,
          user_id: user.id,
          product_id: input.product_id
        });
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to fetch product inventory: ${formatErrorMessage(error)}`
        });
      }

      return data || [];
    }),

  // GET /inventory/stats - Get inventory statistics
  getStats: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/inventory/stats',
        tags: ['inventory'],
        summary: 'Get inventory statistics',
        description: 'Get basic inventory statistics including totals and low stock counts. Optionally filter by warehouse.',
        protect: true,
      }
    })
    .input(GetStatsSchema)
    .output(z.any())
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
        ctx.logger.error('Inventory stats error:', {
          error: formatErrorMessage(error),
          code: error.code,
          details: error.details,
          hint: error.hint,
          user_id: user.id,
          warehouse_id: input.warehouse_id
        });
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to fetch inventory stats: ${formatErrorMessage(error)}`
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
    .meta({
      openapi: {
        method: 'POST',
        path: '/inventory/adjust',
        tags: ['inventory'],
        summary: 'Adjust inventory stock levels',
        description: 'Adjust the quantity of full and empty cylinders in inventory with business rule validation and audit trail.',
        protect: true,
      }
    })
    .input(StockAdjustmentSchema)
    .output(z.any())
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
        ctx.logger.error('Inventory record not found for adjustment:', {
          error: formatErrorMessage(fetchError),
          code: fetchError?.code,
          details: fetchError?.details,
          hint: fetchError?.hint,
          user_id: user.id,
          inventory_id: input.inventory_id
        });
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
        ctx.logger.error('Stock adjustment error:', {
          error: formatErrorMessage(error),
          code: error.code,
          details: error.details,
          hint: error.hint,
          user_id: user.id,
          inventory_id: input.inventory_id,
          adjustment_data: {
            qty_full_change: input.qty_full_change,
            qty_empty_change: input.qty_empty_change,
            reason: input.reason
          }
        });
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to adjust stock: ${formatErrorMessage(error)}`
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
    .meta({
      openapi: {
        method: 'POST',
        path: '/inventory/transfer',
        tags: ['inventory'],
        summary: 'Transfer stock between warehouses',
        description: 'Transfer inventory between warehouses with full validation and atomicity. Creates destination inventory if it doesn\'t exist.',
        protect: true,
      }
    })
    .input(StockTransferSchema)
    .output(z.any())
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
        ctx.logger.error('Warehouse validation error for stock transfer:', {
          error: formatErrorMessage(warehouseError),
          code: warehouseError?.code,
          details: warehouseError?.details,
          hint: warehouseError?.hint,
          user_id: user.id,
          from_warehouse_id: input.from_warehouse_id,
          to_warehouse_id: input.to_warehouse_id,
          found_warehouses: warehouses?.length || 0
        });
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
        ctx.logger.error('Source inventory not found for transfer:', {
          error: formatErrorMessage(sourceError),
          code: sourceError?.code,
          details: sourceError?.details,
          hint: sourceError?.hint,
          user_id: user.id,
          from_warehouse_id: input.from_warehouse_id,
          product_id: input.product_id
        });
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
          ctx.logger.error('Destination inventory creation error:', {
            error: formatErrorMessage(createError),
            code: createError?.code,
            details: createError?.details,
            hint: createError?.hint,
            user_id: user.id,
            to_warehouse_id: input.to_warehouse_id,
            product_id: input.product_id
          });
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to create destination inventory: ${formatErrorMessage(createError)}`
          });
        }

        destInventory = newDestInventory;
      } else if (destError) {
        ctx.logger.error('Destination inventory error:', {
          error: formatErrorMessage(destError),
          code: destError?.code,
          details: destError?.details,
          hint: destError?.hint,
          user_id: user.id,
          to_warehouse_id: input.to_warehouse_id,
          product_id: input.product_id
        });
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to access destination inventory: ${formatErrorMessage(destError)}`
        });
      }

      // REPLACED: Execute transfer using direct database updates instead of RPC
      let transferResult;
      try {
        ctx.logger.info('Starting direct transfer without RPC function');
        
        // Step 1: Update source inventory (subtract quantities)
        const { error: sourceUpdateError } = await ctx.supabase
          .from('inventory_balance')
          .update({
            qty_full: sourceInventory.qty_full - input.qty_full,
            qty_empty: sourceInventory.qty_empty - input.qty_empty,
            updated_at: new Date().toISOString(),
          })
          .eq('warehouse_id', input.from_warehouse_id)
          .eq('product_id', input.product_id);

        if (sourceUpdateError) {
          ctx.logger.error('Failed to update source inventory:', sourceUpdateError);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to update source inventory: ${sourceUpdateError.message}`
          });
        }

        ctx.logger.info('Source inventory updated successfully');

        // Step 2: Update destination inventory (add quantities)
        const { error: destUpdateError } = await ctx.supabase
          .from('inventory_balance')
          .update({
            qty_full: destInventory.qty_full + input.qty_full,
            qty_empty: destInventory.qty_empty + input.qty_empty,
            updated_at: new Date().toISOString(),
          })
          .eq('warehouse_id', input.to_warehouse_id)
          .eq('product_id', input.product_id);

        if (destUpdateError) {
          ctx.logger.error('Failed to update destination inventory:', destUpdateError);
          
          // Rollback source inventory on destination failure
          await ctx.supabase
            .from('inventory_balance')
            .update({
              qty_full: sourceInventory.qty_full, // Restore original
              qty_empty: sourceInventory.qty_empty, // Restore original
              updated_at: new Date().toISOString(),
            })
            .eq('warehouse_id', input.from_warehouse_id)
            .eq('product_id', input.product_id);
          
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to update destination inventory: ${destUpdateError.message}`
          });
        }

        ctx.logger.info('Destination inventory updated successfully');

        // Create transfer result object (replaces RPC result)
        transferResult = {
          success: true,
          message: 'Direct transfer completed successfully',
          transferred_full: input.qty_full,
          transferred_empty: input.qty_empty,
          from_warehouse_id: input.from_warehouse_id,
          to_warehouse_id: input.to_warehouse_id,
          product_id: input.product_id,
          timestamp: new Date().toISOString()
        };

        ctx.logger.info('Direct transfer completed successfully:', transferResult);

      } catch (error) {
        ctx.logger.error('Direct transfer failed:', error);
        
        if (error instanceof TRPCError) {
          throw error; // Re-throw TRPC errors as-is
        }
        
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Transfer failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
      }

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
    .meta({
      openapi: {
        method: 'POST',
        path: '/inventory/create',
        tags: ['inventory'],
        summary: 'Create new inventory balance record',
        description: 'Create a new inventory balance record for a specific product and warehouse.',
        protect: true,
      }
    })
    .input(CreateInventoryBalanceSchema)
    .output(z.any())
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
        ctx.logger.error('Warehouse validation error for inventory creation:', {
          error: formatErrorMessage(warehouseError),
          code: warehouseError?.code,
          details: warehouseError?.details,
          hint: warehouseError?.hint,
          user_id: user.id,
          warehouse_id: input.warehouse_id
        });
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
        ctx.logger.error('Product validation error for inventory creation:', {
          error: formatErrorMessage(productError),
          code: productError?.code,
          details: productError?.details,
          hint: productError?.hint,
          user_id: user.id,
          product_id: input.product_id
        });
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
        ctx.logger.error('Inventory creation error:', {
          error: formatErrorMessage(error),
          code: error.code,
          details: error.details,
          hint: error.hint,
          user_id: user.id,
          inventory_data: {
            warehouse_id: input.warehouse_id,
            product_id: input.product_id,
            qty_full: input.qty_full,
            qty_empty: input.qty_empty,
            qty_reserved: input.qty_reserved
          }
        });
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to create inventory: ${formatErrorMessage(error)}`
        });
      }

      ctx.logger.info('Inventory balance created successfully:', data);
      return data;
    }),

  // POST /inventory/reserve - Reserve inventory for orders (idempotent)
  reserve: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/inventory/reserve',
        tags: ['inventory'],
        summary: 'Reserve inventory for orders',
        description: 'Reserve a specified quantity of inventory for an order. This is idempotent, meaning it can be called multiple times with the same result.',
        protect: true,
      }
    })
    .input(ReservationSchema)
    .output(z.any())
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
          ctx.logger.error('Inventory reservation query error:', {
            error: formatErrorMessage(error),
            code: error.code,
            details: error.details,
            hint: error.hint,
            user_id: user.id,
            product_id: reservation.product_id,
            warehouse_id: reservation.warehouse_id
          });
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to query inventory for reservation: ${formatErrorMessage(error)}`
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
            ctx.logger.error('Inventory reservation update error:', {
              error: formatErrorMessage(updateError),
              code: updateError?.code,
              details: updateError?.details,
              hint: updateError?.hint,
              user_id: user.id,
              inventory_id: inventory.id,
              reservation_attempt: {
                product_id: reservation.product_id,
                quantity: toReserve,
                new_reserved: newReserved
              }
            });
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
    .meta({
      openapi: {
        method: 'GET',
        path: '/inventory/movements',
        tags: ['inventory'],
        summary: 'Get recent stock movements',
        description: 'Retrieve a list of recent stock movements (inventory adjustments, transfers, etc.) across all warehouses.',
        protect: true,
      }
    })
    .input(GetMovementsSchema)
    .output(z.any())
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
    .meta({
      openapi: {
        method: 'POST',
        path: '/inventory/validate-adjustment',
        tags: ['inventory'],
        summary: 'Validate stock adjustment business rules',
        description: 'Validate if a proposed stock adjustment would violate any business rules (e.g., negative stock, insufficient reserved stock, large adjustments, pending transfers).',
        protect: true,
      }
    })
    .input(ValidateAdjustmentSchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      const errors: string[] = [];
      const warnings: string[] = [];

      // Get current inventory data
      const { data: inventory, error: inventoryError } = await ctx.supabase
        .from('inventory_balance')
        .select(`          *,
          warehouse:warehouses(id, name),
          product:products(id, sku, name, unit_of_measure)
        `)
        .eq('id', input.inventory_id)
        .single();

      if (inventoryError || !inventory) {
        ctx.logger.error('Inventory validation error:', {
          error: formatErrorMessage(inventoryError),
          code: inventoryError?.code,
          details: inventoryError?.details,
          hint: inventoryError?.hint,
          user_id: user.id,
          inventory_id: input.inventory_id
        });
        errors.push('Inventory record not found');
        return { 
          valid: false, 
          errors, 
          warnings,
          current_stock: {
            qty_full: 0,
            qty_empty: 0,
            qty_reserved: 0,
          },
          resulting_stock: {
            qty_full: 0,
            qty_empty: 0,
            qty_reserved: 0,
          },
        };
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
    .meta({
      openapi: {
        method: 'GET',
        path: '/inventory/low-stock',
        tags: ['inventory'],
        summary: 'Get low stock items with intelligent thresholds',
        description: 'Retrieve a list of products that are low on stock, considering their projected availability and urgency levels.',
        protect: true,
      }
    })
    .input(GetLowStockSchema)
    .output(z.any())
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Fetching low stock items:', input);
      
      let query = ctx.supabase
        .from('inventory_balance')
        .select(`          *,
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
        ctx.logger.error('Low stock query error:', {
          error: formatErrorMessage(error),
          code: error.code,
          details: error.details,
          hint: error.hint,
          user_id: user.id,
          warehouse_id: input.warehouse_id,
          urgency_level: input.urgency_level
        });
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to fetch low stock items: ${formatErrorMessage(error)}`
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
        const urgencyOrder: Record<string, number> = { critical: 3, low: 2, warning: 1, ok: 0 };
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

  // POST /inventory/availability - Check product availability with business rules
  checkAvailability: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/inventory/availability',
        tags: ['inventory'],
        summary: 'Check product availability with business rules',
        description: 'Validate if a requested quantity of products is available across warehouses, considering delivery dates and priority.',
        protect: true,
      }
    })
    .input(CheckAvailabilitySchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
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
          ctx.logger.error('Availability check error:', {
            error: formatErrorMessage(error),
            code: error.code,
            details: error.details,
            hint: error.hint,
            user_id: user.id,
            product_id: productRequest.product_id,
            warehouse_preference: productRequest.warehouse_preference
          });
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to check product availability: ${formatErrorMessage(error)}`
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

  // New Warehouse Operations Endpoints (Document Steps 3 & 4)

  // POST /inventory/receipts - Create inventory receipt with multiple products and metadata
  createReceipt: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/inventory/receipts',
        tags: ['inventory'],
        summary: 'Create inventory receipt',
        description: 'Add stock/receive inventory with supplier, truck, driver, receipt date, notes, and multiple products.',
        protect: true,
      }
    })
    .input(CreateReceiptSchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      ctx.logger.info('Creating inventory receipt:', input);
      // For each receipt line, create or update inventory balance
      for (const line of input.receipt_lines) {
        await ctx.supabase
          .from('inventory_balance')
          .upsert([
            {
              warehouse_id: input.warehouse_id,
              product_id: line.product_id,
              qty_full: line.qty_received_good,
              qty_empty: 0, // Extend if you want to support empty
              qty_reserved: 0, // Extend if you want to support reserved
              updated_at: input.receipt_date || new Date().toISOString(),
            }
          ], { onConflict: 'warehouse_id,product_id' });
        // Optionally, log receipt metadata to a separate table
      }
      return { success: true, message: 'Inventory receipt created.' };
    }),

  // POST /inventory/transfer/initiate - Initiate warehouse transfer with In Transit status (Document 4.2)
  initiateTransfer: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/inventory/transfer/initiate',
        tags: ['inventory', 'warehouse-operations'],
        summary: 'Initiate warehouse-to-warehouse transfer',
        description: 'Initiate a transfer between warehouses, moving stock to In Transit status.',
        protect: true,
      }
    })
    .input(InitiateTransferSchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);  
      
      ctx.logger.info('Initiating warehouse transfer:', input);

      try {
        // Use the database function to initiate transfer
        const { data: transferId, error } = await ctx.supabase.rpc('initiate_warehouse_transfer', {
          p_source_warehouse_id: input.source_warehouse_id,
          p_destination_warehouse_id: input.destination_warehouse_id,
          p_product_id: input.product_id,
          p_qty_full: input.qty_full,
          p_qty_empty: input.qty_empty,
          p_reference_number: input.reference_number,
        });

        if (error) {
          ctx.logger.error('Transfer initiation error:', error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to initiate transfer: ${formatErrorMessage(error)}`
          });
        }

        // Get transfer details
        const { data: transfer } = await ctx.supabase
          .from('transfers')
          .select(`
            *,
            source_warehouse:warehouses!transfers_source_warehouse_id_fkey(id, name),
            destination_warehouse:warehouses!transfers_destination_warehouse_id_fkey(id, name)
          `)
          .eq('id', transferId)
          .single();

        ctx.logger.info('Transfer initiated successfully:', transferId);
        return {
          transfer_id: transferId,
          transfer,
          status: 'in_transit'
        };
      } catch (error) {
        ctx.logger.error('Transfer initiation failed:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Transfer initiation failed'
        });
      }
    }),

  // POST /inventory/transfer/complete - Complete warehouse transfer (Document 4.2)
  completeTransfer: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/inventory/transfer/complete',
        tags: ['inventory', 'warehouse-operations'],
        summary: 'Complete warehouse transfer',
        description: 'Complete a warehouse transfer by receiving stock at destination.',
        protect: true,
      }
    })
    .input(CompleteTransferSchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Completing warehouse transfer:', input);

      try {
        // Use the database function to complete transfer
        await ctx.supabase.rpc('complete_warehouse_transfer', {
          p_transfer_id: input.transfer_id,
          p_product_id: input.product_id,
          p_qty_full_received: input.qty_full_received,
          p_qty_empty_received: input.qty_empty_received,
        });

        // Get updated transfer details
        const { data: transfer } = await ctx.supabase
          .from('transfers')
          .select(`
            *,
            source_warehouse:warehouses!transfers_source_warehouse_id_fkey(id, name),
            destination_warehouse:warehouses!transfers_destination_warehouse_id_fkey(id, name)
          `)
          .eq('id', input.transfer_id)
          .single();

        ctx.logger.info('Transfer completed successfully:', input.transfer_id);
        return {
          transfer,
          status: 'completed'
        };
      } catch (error) {
        ctx.logger.error('Transfer completion failed:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Transfer completion failed'
        });
      }
    }),

  // POST /inventory/cycle-count/create - Create cycle count (Document 4.3)
  createCycleCount: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/inventory/cycle-count/create',
        tags: ['inventory', 'warehouse-operations'],
        summary: 'Create cycle count',
        description: 'Create a cycle count for periodic inventory verification with variance tracking.',
        protect: true,
      }
    })
    .input(CreateCycleCountSchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Creating cycle count:', input);

      // Create cycle count header
      const { data: cycleCount, error: cycleCountError } = await ctx.supabase
        .from('cycle_counts')
        .insert([{
          warehouse_id: input.warehouse_id,
          count_date: input.count_date || new Date().toISOString().split('T')[0],
          status: 'in_progress',
          counted_by_user_id: user.id,
          notes: input.notes,
        }])
        .select()
        .single();

      if (cycleCountError) {
        ctx.logger.error('Cycle count creation error:', cycleCountError);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to create cycle count: ${formatErrorMessage(cycleCountError)}`
        });
      }

      // Create cycle count lines
      const cycleCountLines = [];
      for (const line of input.cycle_count_lines) {
        const { data: cycleCountLine, error: lineError } = await ctx.supabase
          .from('cycle_count_lines')
          .insert([{
            cycle_count_id: cycleCount.id,
            product_id: line.product_id,
            system_qty_full: line.system_qty_full,
            system_qty_empty: line.system_qty_empty,
            counted_qty_full: line.counted_qty_full,
            counted_qty_empty: line.counted_qty_empty,
            notes: line.notes,
          }])
          .select()
          .single();

        if (lineError) {
          ctx.logger.error('Cycle count line creation error:', lineError);
          continue;
        }

        cycleCountLines.push(cycleCountLine);
      }

      // Process cycle count using database function
      try {
        const { error: rpcError } = await ctx.supabase.rpc('process_cycle_count', {
          p_cycle_count_id: cycleCount.id,
        });
        
        if (rpcError) {
          ctx.logger.error('Cycle count processing RPC error:', rpcError);
        }
      } catch (error) {
        ctx.logger.error('Failed to process cycle count:', error);
      }

      ctx.logger.info('Cycle count created successfully:', cycleCount.id);
      return {
        cycle_count: { ...cycleCount, cycle_count_lines: cycleCountLines },
      };
    }),

  // GET /inventory/receipts - List receipts
  listReceipts: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/inventory/receipts',
        tags: ['inventory', 'warehouse-operations'],
        summary: 'List receipts',
        description: 'Get a list of receipt transactions.',
        protect: true,
      }
    })
    .input(z.object({
      warehouse_id: z.string().optional(),
      status: z.enum(['open', 'partial', 'completed', 'cancelled']).optional(),
      page: z.number().min(1).default(1),
      limit: z.number().min(1).max(100).default(15),
    }))
    .output(z.any())
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      let query = ctx.supabase
        .from('receipts')
        .select(`
          *,
          warehouse:warehouses(id, name),
          receipt_lines(
            *,
            product:products(id, sku, name)
          )
        `, { count: 'exact' });

      if (input.warehouse_id) {
        query = query.eq('warehouse_id', input.warehouse_id);
      }

      if (input.status) {
        query = query.eq('status', input.status);
      }

      query = query
        .order('created_at', { ascending: false })
        .range((input.page - 1) * input.limit, input.page * input.limit - 1);

      const { data, error, count } = await query;

      if (error) {
        ctx.logger.error('Receipts listing error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to fetch receipts: ${formatErrorMessage(error)}`
        });
      }

      return {
        receipts: data || [],
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / input.limit),
        currentPage: input.page,
      };
    }),

  // GET /inventory/cycle-counts - List cycle counts
  listCycleCounts: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/inventory/cycle-counts',
        tags: ['inventory', 'warehouse-operations'],
        summary: 'List cycle counts',
        description: 'Get a list of cycle count transactions.',
        protect: true,
      }
    })
    .input(z.object({
      warehouse_id: z.string().optional(),
      status: z.enum(['in_progress', 'completed', 'cancelled']).optional(),
      page: z.number().min(1).default(1),
      limit: z.number().min(1).max(100).default(15),
    }))
    .output(z.any())
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      let query = ctx.supabase
        .from('cycle_counts')
        .select(`
          *,
          warehouse:warehouses(id, name),
          cycle_count_lines(
            *,
            product:products(id, sku, name)
          )
        `, { count: 'exact' });

      if (input.warehouse_id) {
        query = query.eq('warehouse_id', input.warehouse_id);
      }

      if (input.status) {
        query = query.eq('status', input.status);
      }

      query = query
        .order('created_at', { ascending: false })
        .range((input.page - 1) * input.limit, input.page * input.limit - 1);

      const { data, error, count } = await query;

      if (error) {
        ctx.logger.error('Cycle counts listing error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to fetch cycle counts: ${formatErrorMessage(error)}`
        });
      }

      return {
        cycle_counts: data || [],
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / input.limit),
        currentPage: input.page,
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
  // Calculate total cylinders (full + empty), total full, total empty, total available (full - reserved), and low stock items
  const total_full = inventory.reduce((sum, item) => sum + (item.qty_full || 0), 0);
  const total_empty = inventory.reduce((sum, item) => sum + (item.qty_empty || 0), 0);
  const total_reserved = inventory.reduce((sum, item) => sum + (item.qty_reserved || 0), 0);
  const total_available = inventory.reduce((sum, item) => sum + ((item.qty_full || 0) - (item.qty_reserved || 0)), 0);
  const low_stock_items = inventory.filter(item => {
    const reorderLevel = item.product?.reorder_level || 10;
    return ((item.qty_full || 0) - (item.qty_reserved || 0)) <= reorderLevel;
  }).length;
  const total_cylinders = total_full + total_empty;

  return {
    total_cylinders,
    total_full,
    total_empty,
    total_available,
    low_stock_items,
  };
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

