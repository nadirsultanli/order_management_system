import { z } from 'zod';
import { router, protectedProcedure } from '../lib/trpc';
import { requireTenantAccess } from '../lib/auth';
import { TRPCError } from '@trpc/server';

// Validation schemas
const TransferItemSchema = z.object({
  product_id: z.string().uuid(),
  product_sku: z.string().optional(),
  product_name: z.string().optional(),
  variant_name: z.string().optional(),
  variant_type: z.enum(['cylinder', 'refillable', 'disposable']).optional(),
  quantity_to_transfer: z.number().positive(),
  available_stock: z.number().min(0).optional(),
  reserved_stock: z.number().min(0).optional(),
  unit_weight_kg: z.number().min(0).optional(),
  unit_cost: z.number().min(0).optional(),
  source_location: z.string().optional(),
  batch_number: z.string().optional(),
  expiry_date: z.string().optional(),
});

const CreateTransferSchema = z.object({
  source_warehouse_id: z.string().uuid(),
  destination_warehouse_id: z.string().uuid(),
  transfer_date: z.string(),
  scheduled_date: z.string().optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  transfer_reference: z.string().optional(),
  reason: z.string().optional(),
  notes: z.string().optional(),
  instructions: z.string().optional(),
  items: z.array(TransferItemSchema).min(1),
});

const TransferFiltersSchema = z.object({
  source_warehouse_id: z.string().uuid().optional(),
  destination_warehouse_id: z.string().uuid().optional(),
  status: z.array(z.enum(['draft', 'pending', 'approved', 'in_transit', 'completed', 'cancelled'])).optional(),
  transfer_type: z.enum(['internal', 'external', 'adjustment', 'return']).optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  created_by_user_id: z.string().uuid().optional(),
  search_text: z.string().optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
  sort_by: z.enum(['created_at', 'transfer_date', 'total_items', 'total_weight_kg']).default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc'),
});

const UpdateTransferStatusSchema = z.object({
  transfer_id: z.string().uuid(),
  new_status: z.enum(['draft', 'pending', 'approved', 'in_transit', 'completed', 'cancelled']),
  notes: z.string().optional(),
  completed_items: z.array(z.string().uuid()).optional(),
});

const ValidateTransferSchema = z.object({
  source_warehouse_id: z.string().uuid(),
  destination_warehouse_id: z.string().uuid(),
  transfer_date: z.string(),
  items: z.array(TransferItemSchema).min(1),
});

// Helper functions extracted from frontend validation logic
function validateTransferBasics(transfer: any) {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!transfer.source_warehouse_id) {
    errors.push('Source warehouse is required');
  }

  if (!transfer.destination_warehouse_id) {
    errors.push('Destination warehouse is required');
  }

  if (transfer.source_warehouse_id === transfer.destination_warehouse_id) {
    errors.push('Source and destination warehouses must be different');
  }

  if (!transfer.transfer_date) {
    errors.push('Transfer date is required');
  }

  if (!transfer.items || transfer.items.length === 0) {
    errors.push('At least one item must be selected for transfer');
  }

  // Validate transfer date
  if (transfer.transfer_date) {
    const transferDate = new Date(transfer.transfer_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (transferDate < today) {
      errors.push('Transfer date cannot be in the past');
    }
  }

  return { errors, warnings };
}

function calculateTransferSummary(items: any[]) {
  const validItems = items.filter(item => item.is_valid !== false);
  const total_quantity = items.reduce((sum, item) => sum + item.quantity_to_transfer, 0);
  const total_weight_kg = items.reduce((sum, item) => sum + (item.total_weight_kg || (item.unit_weight_kg || 0) * item.quantity_to_transfer), 0);
  const total_cost = items.reduce((sum, item) => sum + (item.total_cost || (item.unit_cost || 0) * item.quantity_to_transfer), 0);

  // Find unique variants
  const variantSet = new Set(items.map(item => item.variant_name || 'default'));
  const unique_variants = variantSet.size;

  return {
    total_products: items.length,
    total_quantity,
    total_weight_kg,
    total_cost: total_cost > 0 ? total_cost : undefined,
    unique_variants,
    validation_summary: {
      valid_items: validItems.length,
      invalid_items: items.length - validItems.length,
      items_with_warnings: 0
    }
  };
}

function generateTransferReference(
  sourceWarehouseCode: string,
  destinationWarehouseCode: string,
  transferDate: string
): string {
  const date = new Date(transferDate);
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  
  return `TR-${sourceWarehouseCode}-${destinationWarehouseCode}-${dateStr}-${randomSuffix}`;
}

export const transfersRouter = router({
  // GET /transfers - List transfers with filtering and pagination
  list: protectedProcedure
    .input(TransferFiltersSchema)
    .query(async ({ input, ctx }) => {
      const user = requireTenantAccess(ctx);
      
      ctx.logger.info('Fetching transfers with filters:', input);
      
      let query = ctx.supabase
        .from('transfers')
        .select(`
          *,
          source_warehouse:source_warehouse_id(id, name, code),
          destination_warehouse:destination_warehouse_id(id, name, code),
          items:transfer_lines(
            id,
            product_id,
            quantity_full,
            quantity_empty,
            product:product_id(id, sku, name, unit_of_measure)
          )
        `, { count: 'exact' })
        
        .order(input.sort_by, { ascending: input.sort_order === 'asc' });

      // Apply filters
      if (input.source_warehouse_id) {
        query = query.eq('source_warehouse_id', input.source_warehouse_id);
      }
      if (input.destination_warehouse_id) {
        query = query.eq('destination_warehouse_id', input.destination_warehouse_id);
      }
      if (input.status && input.status.length > 0) {
        query = query.in('status', input.status);
      }
      if (input.transfer_type) {
        query = query.eq('transfer_type', input.transfer_type);
      }
      if (input.date_from) {
        query = query.gte('transfer_date', input.date_from);
      }
      if (input.date_to) {
        query = query.lte('transfer_date', input.date_to);
      }
      if (input.created_by_user_id) {
        query = query.eq('created_by_user_id', input.created_by_user_id);
      }

      // Apply search filter
      if (input.search_text) {
        query = query.or(`id.ilike.%${input.search_text}%,transfer_reference.ilike.%${input.search_text}%,notes.ilike.%${input.search_text}%`);
      }

      // Apply pagination
      const from = (input.page - 1) * input.limit;
      const to = from + input.limit - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) {
        ctx.logger.error('Transfer listing error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message
        });
      }

      // Calculate total items for each transfer
      const transfers = (data || []).map(transfer => ({
        ...transfer,
        total_items: transfer.items?.length || 0,
        total_quantity: transfer.items?.reduce((sum: number, item: any) => sum + item.quantity_full + item.quantity_empty, 0) || 0,
      }));

      return {
        transfers,
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / input.limit),
        currentPage: input.page,
      };
    }),

  // GET /transfers/{id} - Get single transfer with details
  getById: protectedProcedure
    .input(z.object({
      transfer_id: z.string().uuid(),
    }))
    .query(async ({ input, ctx }) => {
      const user = requireTenantAccess(ctx);
      
      ctx.logger.info('Fetching transfer:', input.transfer_id);
      
      const { data, error } = await ctx.supabase
        .from('transfers')
        .select(`
          *,
          source_warehouse:source_warehouse_id(id, name, code),
          destination_warehouse:destination_warehouse_id(id, name, code),
          items:transfer_lines(
            id,
            product_id,
            quantity_full,
            quantity_empty,
            product:product_id(id, sku, name, unit_of_measure, capacity_kg, tare_weight_kg, is_variant, variant_name, variant_type)
          )
        `)
        .eq('id', input.transfer_id)
        
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Transfer not found'
          });
        }
        ctx.logger.error('Transfer fetch error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message
        });
      }

      return data;
    }),

  // POST /transfers/validate - Validate transfer request
  validate: protectedProcedure
    .input(ValidateTransferSchema)
    .mutation(async ({ input, ctx }) => {
      const user = requireTenantAccess(ctx);
      
      ctx.logger.info('Validating transfer:', input);

      // Basic validation
      const basicValidation = validateTransferBasics(input);
      let errors = [...basicValidation.errors];
      let warnings = [...basicValidation.warnings];
      const blocked_items: string[] = [];

      // Validate warehouses exist and belong to tenant
      const { data: warehouses, error: warehouseError } = await ctx.supabase
        .from('warehouses')
        .select('id, name, code')
        
        .in('id', [input.source_warehouse_id, input.destination_warehouse_id]);

      if (warehouseError || warehouses.length !== 2) {
        errors.push('One or both warehouses not found');
      }

      // Get stock information for all items
      const productIds = input.items.map(item => item.product_id);
      const { data: stockData, error: stockError } = await ctx.supabase
        .from('inventory_balance')
        .select(`
          *,
          product:product_id(id, sku, name, capacity_kg, tare_weight_kg, is_variant, variant_name, variant_type)
        `)
        .eq('warehouse_id', input.source_warehouse_id)
        
        .in('product_id', productIds);

      if (stockError) {
        ctx.logger.error('Stock data fetch error:', stockError);
        errors.push('Failed to fetch stock information');
      }

      // Validate each item
      let total_weight_kg = 0;
      let estimated_cost = 0;

      for (const item of input.items) {
        const stockInfo = stockData?.find(stock => stock.product_id === item.product_id);

        // Basic item validation
        if (!item.product_id) {
          errors.push(`Product ID is required for item`);
          blocked_items.push(item.product_id);
          continue;
        }

        if (!item.quantity_to_transfer || item.quantity_to_transfer <= 0) {
          errors.push(`Transfer quantity must be greater than 0 for product ${item.product_id}`);
          blocked_items.push(item.product_id);
          continue;
        }

        if (item.quantity_to_transfer % 1 !== 0) {
          errors.push(`Transfer quantity must be a whole number for product ${item.product_id}`);
          blocked_items.push(item.product_id);
          continue;
        }

        // Stock availability validation
        if (stockInfo) {
          const availableForTransfer = stockInfo.qty_full - (stockInfo.qty_reserved || 0);
          
          if (item.quantity_to_transfer > availableForTransfer) {
            errors.push(`Insufficient stock for product ${stockInfo.product?.name || item.product_id}. Available: ${availableForTransfer}, Requested: ${item.quantity_to_transfer}`);
            blocked_items.push(item.product_id);
            continue;
          }

          if (item.quantity_to_transfer > stockInfo.qty_full * 0.9) {
            warnings.push(`Transferring more than 90% of available stock for product ${stockInfo.product?.name || item.product_id}`);
          }

          // Calculate weights if product has specifications
          if (stockInfo.product?.capacity_kg && stockInfo.product?.tare_weight_kg) {
            const unitWeight = stockInfo.product.capacity_kg + stockInfo.product.tare_weight_kg;
            total_weight_kg += unitWeight * item.quantity_to_transfer;
          }
        } else {
          errors.push(`Stock information not found for product ${item.product_id}`);
          blocked_items.push(item.product_id);
        }

        // Quantity limits
        if (item.quantity_to_transfer > 1000) {
          warnings.push(`Large quantity transfer (${item.quantity_to_transfer}) may require special approval`);
        }
      }

      // Check for duplicate items
      const itemKeys = input.items.map(item => `${item.product_id}-${item.variant_name || 'default'}`);
      const uniqueKeys = new Set(itemKeys);
      if (itemKeys.length !== uniqueKeys.size) {
        errors.push('Duplicate products with same variant are not allowed');
      }

      // Check transfer limits
      if (input.items.length > 100) {
        warnings.push('Large transfers with over 100 items may take longer to process');
      }

      if (total_weight_kg > 5000) {
        warnings.push('Heavy transfer (over 5 tons) may require special handling');
      }

      const result = {
        is_valid: errors.length === 0,
        errors,
        warnings,
        blocked_items,
        total_weight_kg,
        estimated_cost: estimated_cost > 0 ? estimated_cost : undefined
      };

      ctx.logger.info('Transfer validation result:', result);
      return result;
    }),

  // POST /transfers/create - Create new transfer
  create: protectedProcedure
    .input(CreateTransferSchema)
    .mutation(async ({ input, ctx }) => {
      const user = requireTenantAccess(ctx);
      
      ctx.logger.info('Creating transfer:', input);

      // Validate first using inline validation
      const basicValidation = validateTransferBasics(input);
      let errors = [...basicValidation.errors];
      let warnings = [...basicValidation.warnings];
      const blocked_items: string[] = [];

      // Validate warehouses exist and belong to tenant
      const { data: warehouses, error: warehouseError } = await ctx.supabase
        .from('warehouses')
        .select('id, name, code')
        
        .in('id', [input.source_warehouse_id, input.destination_warehouse_id]);

      if (warehouseError || warehouses.length !== 2) {
        errors.push('One or both warehouses not found');
      }

      // Get stock information for all items
      const productIds = input.items.map(item => item.product_id);
      const { data: stockData, error: stockError } = await ctx.supabase
        .from('inventory_balance')
        .select(`
          *,
          product:product_id(id, sku, name, capacity_kg, tare_weight_kg, is_variant, variant_name, variant_type)
        `)
        .eq('warehouse_id', input.source_warehouse_id)
        
        .in('product_id', productIds);

      if (stockError) {
        ctx.logger.error('Stock data fetch error:', stockError);
        errors.push('Failed to fetch stock information');
      }

      // Validate each item
      for (const item of input.items) {
        const stockInfo = stockData?.find(stock => stock.product_id === item.product_id);

        if (!stockInfo) {
          errors.push(`Stock information not found for product ${item.product_id}`);
          blocked_items.push(item.product_id);
          continue;
        }

        const availableForTransfer = stockInfo.qty_full - (stockInfo.qty_reserved || 0);
        
        if (item.quantity_to_transfer > availableForTransfer) {
          errors.push(`Insufficient stock for product ${stockInfo.product?.name || item.product_id}. Available: ${availableForTransfer}, Requested: ${item.quantity_to_transfer}`);
          blocked_items.push(item.product_id);
        }
      }

      if (errors.length > 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Transfer validation failed: ${errors.join(', ')}`
        });
      }

      // Use already fetched warehouses for reference generation
      const sourceWarehouse = warehouses?.find(w => w.id === input.source_warehouse_id);
      const destWarehouse = warehouses?.find(w => w.id === input.destination_warehouse_id);

      // Generate transfer reference if not provided
      const transferReference = input.transfer_reference || generateTransferReference(
        sourceWarehouse?.code || 'WH',
        destWarehouse?.code || 'WH',
        input.transfer_date
      );

      // Calculate totals
      const summary = calculateTransferSummary(input.items);

      // Create transfer record
      const transferData = {
        source_warehouse_id: input.source_warehouse_id,
        destination_warehouse_id: input.destination_warehouse_id,
        transfer_date: input.transfer_date,
        scheduled_date: input.scheduled_date,
        status: 'draft' as const,
        transfer_type: 'internal' as const,
        priority: input.priority,
        transfer_reference: transferReference,
        reason: input.reason,
        notes: input.notes,
        instructions: input.instructions,
        total_items: summary.total_products,
        total_quantity: summary.total_quantity,
        total_weight_kg: summary.total_weight_kg,
        total_cost: summary.total_cost,
        
        created_by_user_id: user.id,
        qty_tagged: 0,
        qty_untagged: summary.total_quantity,
        variance_flag: false,
      };

      const { data: transfer, error: transferError } = await ctx.supabase
        .from('transfers')
        .insert(transferData)
        .select()
        .single();

      if (transferError) {
        ctx.logger.error('Transfer creation error:', transferError);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: transferError.message
        });
      }

      // Create transfer items
      const transferItems = input.items.map(item => ({
        transfer_id: transfer.id,
        product_id: item.product_id,
        quantity_full: item.quantity_to_transfer,
        quantity_empty: 0,
        
      }));

      const { error: itemsError } = await ctx.supabase
        .from('transfer_lines')
        .insert(transferItems);

      if (itemsError) {
        ctx.logger.error('Transfer items creation error:', itemsError);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: itemsError.message
        });
      }

      ctx.logger.info('Transfer created successfully:', transfer);
      return transfer;
    }),

  // POST /transfers/{id}/status - Update transfer status
  updateStatus: protectedProcedure
    .input(UpdateTransferStatusSchema)
    .mutation(async ({ input, ctx }) => {
      const user = requireTenantAccess(ctx);
      
      ctx.logger.info('Updating transfer status:', input);

      // Get current transfer
      const { data: currentTransfer, error: transferError } = await ctx.supabase
        .from('transfers')
        .select(`
          *,
          items:transfer_lines(product_id, quantity_full, quantity_empty)
        `)
        .eq('id', input.transfer_id)
        
        .single();

      if (transferError || !currentTransfer) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Transfer not found'
        });
      }

      // Validate status transition
      const validTransitions: Record<string, string[]> = {
        'draft': ['pending', 'cancelled'],
        'pending': ['approved', 'cancelled'],
        'approved': ['in_transit', 'cancelled'],
        'in_transit': ['completed', 'cancelled'],
        'completed': [],
        'cancelled': []
      };

      if (!validTransitions[currentTransfer.status]?.includes(input.new_status)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Cannot transition from ${currentTransfer.status} to ${input.new_status}`
        });
      }

      // Handle inventory updates based on status change
      if (input.new_status === 'completed' && currentTransfer.status === 'in_transit') {
        // Execute the actual stock transfer
        if (currentTransfer.items) {
          for (const item of currentTransfer.items) {
            try {
              // Use the inventory transfer logic
              await ctx.supabase.rpc('transfer_stock', {
                p_from_warehouse_id: currentTransfer.source_warehouse_id,
                p_to_warehouse_id: currentTransfer.destination_warehouse_id,
                p_product_id: item.product_id,
                p_qty_full: item.quantity_full,
                p_qty_empty: item.quantity_empty,
                
              });
            } catch (error) {
              ctx.logger.error('Stock transfer execution failed:', error);
              throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: `Failed to execute stock transfer for product ${item.product_id}`
              });
            }
          }
        }
      }

      // Update transfer status
      const updateData: any = {
        status: input.new_status,
        updated_at: new Date().toISOString(),
      };

      if (input.new_status === 'completed') {
        updateData.completed_date = new Date().toISOString();
        updateData.processed_by_user_id = user.id;
      } else if (input.new_status === 'approved') {
        updateData.approved_at = new Date().toISOString();
        updateData.approved_by_user_id = user.id;
      }

      if (input.notes) {
        updateData.notes = currentTransfer.notes ? `${currentTransfer.notes}\n\n${input.notes}` : input.notes;
      }

      const { data: updatedTransfer, error: updateError } = await ctx.supabase
        .from('transfers')
        .update(updateData)
        .eq('id', input.transfer_id)
        
        .select()
        .single();

      if (updateError) {
        ctx.logger.error('Transfer status update error:', updateError);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: updateError.message
        });
      }

      ctx.logger.info('Transfer status updated successfully:', updatedTransfer);
      return updatedTransfer;
    }),

  // GET /transfers/warehouse-stock - Get warehouse stock information for transfer planning
  getWarehouseStock: protectedProcedure
    .input(z.object({
      warehouse_id: z.string().uuid(),
      search_text: z.string().optional(),
      variant_type: z.enum(['cylinder', 'refillable', 'disposable']).optional(),
      variant_name: z.string().optional(),
      has_stock: z.boolean().default(true),
      page: z.number().min(1).default(1),
      limit: z.number().min(1).max(100).default(50),
    }))
    .query(async ({ input, ctx }) => {
      const user = requireTenantAccess(ctx);
      
      ctx.logger.info('Fetching warehouse stock info:', input);
      
      let query = ctx.supabase
        .from('inventory_balance')
        .select(`
          *,
          warehouse:warehouse_id(id, name),
          product:product_id(
            id,
            sku,
            name,
            variant_name,
            variant_type,
            capacity_kg,
            tare_weight_kg,
            is_variant
          )
        `)
        .eq('warehouse_id', input.warehouse_id)
        ;

      // Apply filters
      if (input.has_stock) {
        query = query.gt('qty_full', 0);
      }

      // Apply pagination
      const from = (input.page - 1) * input.limit;
      const to = from + input.limit - 1;
      query = query.range(from, to);

      const { data, error } = await query;

      if (error) {
        ctx.logger.error('Warehouse stock fetch error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message
        });
      }

      // Transform data to warehouse stock info format
      let stockData = (data || []).map((item: any) => ({
        warehouse_id: item.warehouse_id,
        warehouse_name: item.warehouse.name,
        product_id: item.product_id,
        product_sku: item.product.sku,
        product_name: item.product.name,
        variant_name: item.product.variant_name,
        qty_available: item.qty_full + item.qty_empty,
        qty_reserved: item.qty_reserved,
        qty_on_order: 0, // TODO: Calculate from pending orders
        qty_full: item.qty_full,
        qty_empty: item.qty_empty,
        locations: [], // TODO: Fetch location details
        last_updated: item.updated_at,
        reorder_level: 10, // TODO: Get from product settings
        max_capacity: 1000 // TODO: Get from warehouse settings
      }));

      // Apply search filter
      if (input.search_text) {
        const searchLower = input.search_text.toLowerCase();
        stockData = stockData.filter((item: any) =>
          item.product_name.toLowerCase().includes(searchLower) ||
          item.product_sku.toLowerCase().includes(searchLower)
        );
      }

      return stockData;
    }),

  // GET /transfers/{id}/cost-analysis - Get transfer cost analysis
  getCostAnalysis: protectedProcedure
    .input(z.object({
      transfer_id: z.string().uuid(),
    }))
    .query(async ({ input, ctx }) => {
      const user = requireTenantAccess(ctx);
      
      ctx.logger.info('Fetching transfer cost analysis:', input.transfer_id);
      
      // Get transfer with items
      const { data: transfer, error } = await ctx.supabase
        .from('transfers')
        .select(`
          *,
          items:transfer_lines(
            product_id,
            quantity_full,
            quantity_empty,
            product:product_id(id, sku, name, capacity_kg, tare_weight_kg)
          )
        `)
        .eq('id', input.transfer_id)
        
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Transfer not found'
          });
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message
        });
      }

      // Calculate cost analysis
      let total_weight = 0;
      let total_volume = 0;
      let handling_cost = 0;
      let transport_cost = 0;
      
      for (const item of transfer.items || []) {
        const quantity = item.quantity_full + item.quantity_empty;
        const product = item.product;
        
        if (product?.capacity_kg && product?.tare_weight_kg) {
          const unit_weight = product.capacity_kg + product.tare_weight_kg;
          total_weight += unit_weight * quantity;
        }
        
        // Basic cost calculations (would integrate with actual pricing system)
        handling_cost += quantity * 2; // $2 per item handling
      }

      // Basic transport cost calculation (would integrate with routing system)
      const distance_km = 50; // placeholder
      transport_cost = (total_weight / 1000) * distance_km * 0.5; // $0.5 per ton per km

      const analysis = {
        transfer_id: input.transfer_id,
        total_weight_kg: total_weight,
        total_volume_m3: total_volume,
        estimated_costs: {
          handling_cost,
          transport_cost,
          total_cost: handling_cost + transport_cost,
        },
        efficiency_metrics: {
          cost_per_kg: total_weight > 0 ? (handling_cost + transport_cost) / total_weight : 0,
          cost_per_item: transfer.total_items > 0 ? (handling_cost + transport_cost) / transfer.total_items : 0,
        },
        estimated_duration: {
          preparation_hours: (transfer.total_items * 0.25) + 0.5,
          transport_hours: (distance_km / 50) + 1,
          total_hours: (transfer.total_items * 0.25) + 0.5 + (distance_km / 50) + 1,
        }
      };

      return analysis;
    }),

  // POST /transfers/search-products - Search products for transfer
  searchProducts: protectedProcedure
    .input(z.object({
      warehouse_id: z.string().uuid().optional(),
      search_text: z.string().optional(),
      variant_type: z.enum(['cylinder', 'refillable', 'disposable']).optional(),
      variant_name: z.string().optional(),
      page: z.number().min(1).default(1),
      limit: z.number().min(1).max(100).default(50),
    }))
    .query(async ({ input, ctx }) => {
      const user = requireTenantAccess(ctx);
      
      ctx.logger.info('Searching products for transfer:', input);
      
      let query = ctx.supabase
        .from('products')
        .select('*')
        
        .eq('status', 'active')
        .order('name');

      // Apply filters
      if (input.variant_type) {
        query = query.eq('variant_type', input.variant_type);
      }
      if (input.variant_name) {
        query = query.eq('variant_name', input.variant_name);
      }

      // Apply pagination
      const from = (input.page - 1) * input.limit;
      const to = from + input.limit - 1;
      query = query.range(from, to);

      const { data, error } = await query;

      if (error) {
        ctx.logger.error('Product search error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message
        });
      }

      // Apply search filter
      let filteredProducts = data || [];
      if (input.search_text) {
        const searchLower = input.search_text.toLowerCase();
        filteredProducts = filteredProducts.filter(product =>
          product.name.toLowerCase().includes(searchLower) ||
          product.sku.toLowerCase().includes(searchLower)
        );
      }

      return filteredProducts;
    }),
});