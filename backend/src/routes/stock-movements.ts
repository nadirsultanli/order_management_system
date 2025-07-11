import { z } from 'zod';
import { router, protectedProcedure } from '../lib/trpc';
import { requireAuth } from '../lib/auth';
import { TRPCError } from '@trpc/server';

// Import input schemas
import {
  MovementTypeEnum,
  StockMovementFiltersSchema,
  GetStockMovementByIdSchema,
  CreateStockMovementSchema,
  BulkMovementSchema,
  RefillOrderProcessSchema,
  StockMovementSummarySchema,
} from '../schemas/input/stock-movements-input';

// Import output schemas
import {
  StockMovementListResponseSchema,
  StockMovementDetailResponseSchema,
  CreateStockMovementResponseSchema,
  BulkStockMovementResponseSchema,
  RefillOrderProcessResponseSchema,
  StockMovementSummaryResponseSchema,
} from '../schemas/output/stock-movements-output';

export const stockMovementsRouter = router({
  // GET /stock-movements - List stock movements with filters
  list: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/stock-movements',
        tags: ['stock-movements'],
        summary: 'List stock movements with filters',
        description: 'Retrieve a paginated list of stock movements with comprehensive filtering options including search, product, warehouse, truck, order, movement type, and date range filters.',
        protect: true,
      }
    })
    .input(StockMovementFiltersSchema.optional())
    .output(z.any())
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      // Provide default values if input is undefined
      const filters = input || {} as any;
      const page = filters.page || 1;
      const limit = filters.limit || 50;
      const sort_by = filters.sort_by || 'movement_date';
      const sort_order = filters.sort_order || 'desc';
      
      ctx.logger.info('Fetching stock movements with filters:', filters);
      
      let query = ctx.supabase
        .from('stock_movements')
        .select(`
          *,
          product:product_id (
            id,
            sku,
            name,
            variant_name,
            is_variant
          ),
          warehouse:warehouse_id (
            id,
            name,
            code
          ),
          truck:truck_id (
            id,
            fleet_number,
            license_plate
          ),
          order:order_id (
            id,
            order_date,
            status
          )
        `, { count: 'exact' })
        .order(sort_by, { ascending: sort_order === 'asc' });

      // Apply filters
      if (filters.search) {
        query = query.or(`reference_number.ilike.%${filters.search}%,notes.ilike.%${filters.search}%`);
      }

      if (filters.product_id) {
        query = query.eq('product_id', filters.product_id);
      }

      if (filters.warehouse_id) {
        query = query.eq('warehouse_id', filters.warehouse_id);
      }

      if (filters.truck_id) {
        query = query.eq('truck_id', filters.truck_id);
      }

      if (filters.order_id) {
        query = query.eq('order_id', filters.order_id);
      }

      if (filters.movement_type) {
        query = query.eq('movement_type', filters.movement_type);
      }

      if (filters.date_from) {
        query = query.gte('movement_date', filters.date_from);
      }

      if (filters.date_to) {
        query = query.lte('movement_date', filters.date_to);
      }

      // Apply pagination
      const from = (page - 1) * limit;
      const to = from + limit - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) {
        ctx.logger.error('Error fetching stock movements:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch stock movements',
        });
      }

      return {
        movements: data || [],
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
        currentPage: page,
      };
    }),

  // GET /stock-movements/:id - Get specific stock movement
  get: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/stock-movements/{id}',
        tags: ['stock-movements'],
        summary: 'Get stock movement by ID',
        description: 'Retrieve a specific stock movement by its unique identifier.',
        protect: true,
      }
    })
    .input(GetStockMovementByIdSchema)
    .output(z.any())
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Fetching stock movement:', input.id);
      
      const { data, error } = await ctx.supabase
        .from('stock_movements')
        .select(`
          *,
          product:product_id (
            id,
            sku,
            name,
            variant_name,
            is_variant,
            capacity_kg,
            tare_weight_kg
          ),
          warehouse:warehouse_id (
            id,
            name,
            code
          ),
          truck:truck_id (
            id,
            fleet_number,
            license_plate
          ),
          order:order_id (
            id,
            order_date,
            status,
            order_type
          )
        `)
        .eq('id', input.id)
        .single();

      if (error) {
        ctx.logger.error('Error fetching stock movement:', error);
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Stock movement not found',
        });
      }

      return data;
    }),

  // POST /stock-movements - Create stock movement
  create: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/stock-movements',
        tags: ['stock-movements'],
        summary: 'Create stock movement',
        description: 'Create a new stock movement record.',
        protect: true,
      }
    })
    .input(CreateStockMovementSchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Creating stock movement:', input);
      
      // Validate that at least one quantity is specified
      const totalQty = input.qty_full_in + input.qty_full_out + input.qty_empty_in + input.qty_empty_out;
      if (totalQty === 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'At least one quantity must be greater than 0',
        });
      }

      const movementData = {
        ...input,
        created_by_user_id: user.user_id,
        created_at: new Date().toISOString(),
      };

      const { data, error } = await ctx.supabase
        .from('stock_movements')
        .insert([movementData])
        .select()
        .single();

      if (error) {
        ctx.logger.error('Error creating stock movement:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create stock movement',
        });
      }

      // Update inventory balances
      await updateInventoryFromMovement(ctx, data);

      return data;
    }),

  // POST /stock-movements/bulk - Create multiple stock movements
  createBulk: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/stock-movements/bulk',
        tags: ['stock-movements'],
        summary: 'Create multiple stock movements',
        description: 'Create multiple stock movement records in a single batch.',
        protect: true,
      }
    })
    .input(BulkMovementSchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Creating bulk stock movements:', input.movements.length);
      
      const movementsData = input.movements.map(movement => ({
        ...movement,
        created_by_user_id: user.user_id,
        created_at: new Date().toISOString(),
      }));

      const { data, error } = await ctx.supabase
        .from('stock_movements')
        .insert(movementsData)
        .select();

      if (error) {
        ctx.logger.error('Error creating bulk stock movements:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create stock movements',
        });
      }

      // Update inventory balances for each movement
      for (const movement of data || []) {
        await updateInventoryFromMovement(ctx, movement);
      }

      return data || [];
    }),

  // POST /stock-movements/process-refill-order - Process refill order stock movements
  processRefillOrder: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/stock-movements/process-refill-order',
        tags: ['stock-movements'],
        summary: 'Process refill order stock movements',
        description: 'Process the stock movements for a specific refill order, updating inventory balances and marking the order as processed.',
        protect: true,
      }
    })
    .input(RefillOrderProcessSchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Processing refill order stock movements:', input.order_id);
      
      // Call the database function to process refill order
      const { data, error } = await ctx.supabase.rpc('process_refill_order', {
        p_order_id: input.order_id
      });

      if (error) {
        ctx.logger.error('Error processing refill order:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to process refill order stock movements',
        });
      }

      return { success: true };
    }),

  // GET /stock-movements/summary - Get stock movement summary for a period
  getSummary: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/stock-movements/summary',
        tags: ['stock-movements'],
        summary: 'Get stock movement summary for a period',
        description: 'Retrieve a summary of stock movements for a specific date range, product, warehouse, and truck.',
        protect: true,
      }
    })
    .input(StockMovementSummarySchema)
    .output(z.any())
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Fetching stock movement summary:', input);
      
      let query = ctx.supabase
        .from('stock_movements')
        .select(`
          movement_type,
          qty_full_in,
          qty_full_out,
          qty_empty_in,
          qty_empty_out,
          product:product_id (
            id,
            sku,
            name,
            variant_name
          )
        `)
        .gte('movement_date', input.date_from)
        .lte('movement_date', input.date_to);

      if (input.product_id) {
        query = query.eq('product_id', input.product_id);
      }

      if (input.warehouse_id) {
        query = query.eq('warehouse_id', input.warehouse_id);
      }

      if (input.truck_id) {
        query = query.eq('truck_id', input.truck_id);
      }

      const { data, error } = await query;

      if (error) {
        ctx.logger.error('Error fetching stock movement summary:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch stock movement summary',
        });
      }

      // Process summary data
      const summary = {
        total_movements: data?.length || 0,
        total_full_in: 0,
        total_full_out: 0,
        total_empty_in: 0,
        total_empty_out: 0,
        by_movement_type: {} as Record<string, any>,
        by_product: {} as Record<string, any>,
      };

      for (const movement of data || []) {
        summary.total_full_in += movement.qty_full_in || 0;
        summary.total_full_out += movement.qty_full_out || 0;
        summary.total_empty_in += movement.qty_empty_in || 0;
        summary.total_empty_out += movement.qty_empty_out || 0;

        // Group by movement type
        if (!summary.by_movement_type[movement.movement_type]) {
          summary.by_movement_type[movement.movement_type] = {
            count: 0,
            qty_full_in: 0,
            qty_full_out: 0,
            qty_empty_in: 0,
            qty_empty_out: 0,
          };
        }
        summary.by_movement_type[movement.movement_type].count++;
        summary.by_movement_type[movement.movement_type].qty_full_in += movement.qty_full_in || 0;
        summary.by_movement_type[movement.movement_type].qty_full_out += movement.qty_full_out || 0;
        summary.by_movement_type[movement.movement_type].qty_empty_in += movement.qty_empty_in || 0;
        summary.by_movement_type[movement.movement_type].qty_empty_out += movement.qty_empty_out || 0;

        // Group by product
        const productKey = `${(movement as any).product?.sku}-${(movement as any).product?.variant_name || 'main'}`;
        if (!summary.by_product[productKey]) {
          summary.by_product[productKey] = {
            product: (movement as any).product,
            count: 0,
            qty_full_in: 0,
            qty_full_out: 0,
            qty_empty_in: 0,
            qty_empty_out: 0,
          };
        }
        summary.by_product[productKey].count++;
        summary.by_product[productKey].qty_full_in += movement.qty_full_in || 0;
        summary.by_product[productKey].qty_full_out += movement.qty_full_out || 0;
        summary.by_product[productKey].qty_empty_in += movement.qty_empty_in || 0;
        summary.by_product[productKey].qty_empty_out += movement.qty_empty_out || 0;
      }

      return summary;
    }),

});

// Helper function to update inventory balances from stock movement
async function updateInventoryFromMovement(ctx: any, movement: any) {
    // Get current inventory balance
    const { data: currentInventory, error: invError } = await ctx.supabase
      .from('inventory_balance')
      .select('*')
      .eq('product_id', movement.product_id)
      .eq('warehouse_id', movement.warehouse_id || '00000000-0000-0000-0000-000000000000')
      .maybeSingle();

    if (invError && invError.code !== 'PGRST116') { // PGRST116 = no rows returned
      ctx.logger.error('Error fetching current inventory:', invError);
      return;
    }

    const currentQtyFull = currentInventory?.qty_full || 0;
    const currentQtyEmpty = currentInventory?.qty_empty || 0;
    const currentQtyReserved = currentInventory?.qty_reserved || 0;

    // Calculate new quantities
    const newQtyFull = currentQtyFull + (movement.qty_full_in || 0) - (movement.qty_full_out || 0);
    const newQtyEmpty = currentQtyEmpty + (movement.qty_empty_in || 0) - (movement.qty_empty_out || 0);

    const inventoryData = {
      product_id: movement.product_id,
      warehouse_id: movement.warehouse_id || '00000000-0000-0000-0000-000000000000',
      qty_full: Math.max(0, newQtyFull),
      qty_empty: Math.max(0, newQtyEmpty),
      qty_reserved: currentQtyReserved,
      updated_at: new Date().toISOString(),
    };

    if (currentInventory) {
      // Update existing inventory
      const { error: updateError } = await ctx.supabase
        .from('inventory_balance')
        .update(inventoryData)
        .eq('id', currentInventory.id);

      if (updateError) {
        ctx.logger.error('Error updating inventory balance:', updateError);
      }
    } else {
      // Create new inventory record
      const { error: insertError } = await ctx.supabase
        .from('inventory_balance')
        .insert([inventoryData]);

      if (insertError) {
        ctx.logger.error('Error creating inventory balance:', insertError);
      }
    }
}