import { z } from 'zod';
import { router, protectedProcedure } from '../lib/trpc';
import { requireTenantAccess } from '../lib/auth';
import { TRPCError } from '@trpc/server';

// Validation schemas
const MovementTypeEnum = z.enum(['delivery', 'pickup', 'refill', 'exchange', 'transfer', 'adjustment']);

const StockMovementFiltersSchema = z.object({
  search: z.string().optional(),
  product_id: z.string().uuid().optional(),
  warehouse_id: z.string().uuid().optional(),
  truck_id: z.string().uuid().optional(),
  order_id: z.string().uuid().optional(),
  movement_type: MovementTypeEnum.optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(50),
  sort_by: z.enum(['movement_date', 'created_at', 'movement_type']).default('movement_date'),
  sort_order: z.enum(['asc', 'desc']).default('desc'),
});

const CreateStockMovementSchema = z.object({
  product_id: z.string().uuid(),
  warehouse_id: z.string().uuid().optional(),
  truck_id: z.string().uuid().optional(),
  order_id: z.string().uuid().optional(),
  movement_type: MovementTypeEnum,
  qty_full_in: z.number().int().min(0).default(0),
  qty_full_out: z.number().int().min(0).default(0),
  qty_empty_in: z.number().int().min(0).default(0),
  qty_empty_out: z.number().int().min(0).default(0),
  movement_date: z.string(),
  reference_number: z.string().optional(),
  notes: z.string().optional(),
});

const BulkMovementSchema = z.object({
  movements: z.array(CreateStockMovementSchema).min(1),
});

const RefillOrderProcessSchema = z.object({
  order_id: z.string().uuid(),
  warehouse_id: z.string().uuid().optional(),
});

export const stockMovementsRouter = router({
  // GET /stock-movements - List stock movements with filters
  list: protectedProcedure
    .input(StockMovementFiltersSchema)
    .query(async ({ input, ctx }) => {
      const user = requireTenantAccess(ctx);
      
      ctx.logger.info('Fetching stock movements with filters:', input);
      
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
        .order(input.sort_by, { ascending: input.sort_order === 'asc' });

      // Apply filters
      if (input.search) {
        query = query.or(`reference_number.ilike.%${input.search}%,notes.ilike.%${input.search}%`);
      }

      if (input.product_id) {
        query = query.eq('product_id', input.product_id);
      }

      if (input.warehouse_id) {
        query = query.eq('warehouse_id', input.warehouse_id);
      }

      if (input.truck_id) {
        query = query.eq('truck_id', input.truck_id);
      }

      if (input.order_id) {
        query = query.eq('order_id', input.order_id);
      }

      if (input.movement_type) {
        query = query.eq('movement_type', input.movement_type);
      }

      if (input.date_from) {
        query = query.gte('movement_date', input.date_from);
      }

      if (input.date_to) {
        query = query.lte('movement_date', input.date_to);
      }

      // Apply pagination
      const from = (input.page - 1) * input.limit;
      const to = from + input.limit - 1;
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
        totalPages: Math.ceil((count || 0) / input.limit),
        currentPage: input.page,
      };
    }),

  // GET /stock-movements/:id - Get specific stock movement
  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const user = requireTenantAccess(ctx);
      
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
    .input(CreateStockMovementSchema)
    .mutation(async ({ input, ctx }) => {
      const user = requireTenantAccess(ctx);
      
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
        tenant_id: user.tenant_id,
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
    .input(BulkMovementSchema)
    .mutation(async ({ input, ctx }) => {
      const user = requireTenantAccess(ctx);
      
      ctx.logger.info('Creating bulk stock movements:', input.movements.length);
      
      const movementsData = input.movements.map(movement => ({
        ...movement,
        tenant_id: user.tenant_id,
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
    .input(RefillOrderProcessSchema)
    .mutation(async ({ input, ctx }) => {
      const user = requireTenantAccess(ctx);
      
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
    .input(z.object({
      date_from: z.string(),
      date_to: z.string(),
      product_id: z.string().uuid().optional(),
      warehouse_id: z.string().uuid().optional(),
      truck_id: z.string().uuid().optional(),
    }))
    .query(async ({ input, ctx }) => {
      const user = requireTenantAccess(ctx);
      
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
      tenant_id: movement.tenant_id,
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