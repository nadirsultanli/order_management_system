import { z } from 'zod';
import { router, protectedProcedure } from '../lib/trpc';
import { requireAuth } from '../lib/auth';
import { TRPCError } from '@trpc/server';
import { formatErrorMessage } from '../lib/logger';
import {
  validateMultiSkuTransfer,
  validateTransferItem,
  calculateTransferItemDetails,
  generateTransferSummary,
  validateWarehouseCapacity,
  checkTransferConflicts,
  formatValidationErrors,
  generateTransferReference as generateTransferReferenceFromLib,
  estimateTransferDuration,
  validateInventoryAvailability,
  type MultiSkuTransferItem,
  type MultiSkuTransfer,
  type TransferValidationResult,
  type WarehouseStockInfo,
  type TransferSummary,
  type Product
} from '../lib/transfer-validation';

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

// Helper function to check if destination is a truck
async function isTruckDestination(supabase: any, destinationId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('truck')
    .select('id')
    .eq('id', destinationId)
    .single();
  
  return !error && !!data;
}

// Helper function to convert transfer item schema to MultiSkuTransferItem
function createTransferItem(item: any): MultiSkuTransferItem {
  return {
    product_id: item.product_id,
    product_sku: item.product_sku || '',
    product_name: item.product_name || 'Unknown Product',
    variant_name: item.variant_name,
    variant_type: item.variant_type,
    quantity_to_transfer: item.quantity_to_transfer,
    available_stock: item.available_stock || 0,
    reserved_stock: item.reserved_stock,
    unit_weight_kg: item.unit_weight_kg,
    total_weight_kg: item.total_weight_kg,
    unit_cost: item.unit_cost,
    total_cost: item.total_cost,
    source_location: item.source_location,
    batch_number: item.batch_number,
    expiry_date: item.expiry_date,
    is_valid: true,
    validation_errors: [],
    validation_warnings: []
  };
}

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
    .input(TransferFiltersSchema.optional())
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      // Provide default values if input is undefined
      const filters = input || {} as any;
      const page = filters.page || 1;
      const limit = filters.limit || 20;
      const sort_by = filters.sort_by || 'created_at';
      const sort_order = filters.sort_order || 'desc';
      
      ctx.logger.info('Fetching transfers with filters:', filters);
      
      let query = ctx.supabase
        .from('transfers')
        .select(`
          *,
          source_warehouse:source_warehouse_id(id, name),
          destination_warehouse:destination_warehouse_id(id, name),
          items:transfer_lines(
            id,
            product_id,
            quantity_full,
            quantity_empty,
            product:product_id(id, sku, name, unit_of_measure)
          )
        `, { count: 'exact' })
        
        .order(sort_by, { ascending: sort_order === 'asc' });

      // Apply filters
      if (filters.source_warehouse_id) {
        query = query.eq('source_warehouse_id', filters.source_warehouse_id);
      }
      if (filters.destination_warehouse_id) {
        query = query.eq('destination_warehouse_id', filters.destination_warehouse_id);
      }
      if (filters.status && filters.status.length > 0) {
        query = query.in('status', filters.status);
      }
      if (filters.transfer_type) {
        query = query.eq('transfer_type', filters.transfer_type);
      }
      if (filters.date_from) {
        query = query.gte('transfer_date', filters.date_from);
      }
      if (filters.date_to) {
        query = query.lte('transfer_date', filters.date_to);
      }
      if (filters.created_by_user_id) {
        query = query.eq('created_by_user_id', filters.created_by_user_id);
      }

      // Apply search filter
      if (filters.search_text) {
        query = query.or(`id.ilike.%${filters.search_text}%,transfer_reference.ilike.%${filters.search_text}%,notes.ilike.%${filters.search_text}%`);
      }

      // Apply pagination
      const from = (page - 1) * limit;
      const to = from + limit - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) {
        ctx.logger.error('Transfer listing error:', error);
        const errorMessage = formatErrorMessage(error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: errorMessage
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
        totalPages: Math.ceil((count || 0) / limit),
        currentPage: page,
      };
    }),

  // GET /transfers/{id} - Get single transfer with details
  getById: protectedProcedure
    .input(z.object({
      transfer_id: z.string().uuid(),
    }))
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Fetching transfer:', input.transfer_id);
      
      const { data, error } = await ctx.supabase
        .from('transfers')
        .select(`
          *,
          source_warehouse:source_warehouse_id(id, name),
          destination_warehouse:destination_warehouse_id(id, name),
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
        const errorMessage = formatErrorMessage(error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: errorMessage
        });
      }

      return data;
    }),

  // POST /transfers/validate - Validate transfer request using atomic validation
  validate: protectedProcedure
    .input(ValidateTransferSchema)
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      // Enhanced logging with step tracking
      const transferId = `validation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      ctx.logger.info(`[${transferId}] 🔍 STEP 1: Starting transfer validation`, {
        transferId,
        sourceWarehouseId: input.source_warehouse_id,
        destinationWarehouseId: input.destination_warehouse_id,
        itemCount: input.items.length,
        transferDate: input.transfer_date,
        userId: user.id,
        timestamp: new Date().toISOString()
      });

      // For single-item transfers, use atomic validation function
      if (input.items.length === 1) {
        const item = input.items[0];
        
        ctx.logger.info(`[${transferId}] 🔍 STEP 2: Single-item atomic validation`, {
          transferId,
          productId: item.product_id,
          requestedQuantity: item.quantity_to_transfer,
          validationMethod: 'atomic_database_function'
        });
        
        const { data: validationResult, error: validationError } = await ctx.supabase.rpc('validate_transfer_request', {
          p_from_warehouse_id: input.source_warehouse_id,
          p_to_warehouse_id: input.destination_warehouse_id,
          p_product_id: item.product_id,
          p_qty_full: item.quantity_to_transfer,
          p_qty_empty: 0, // Default to 0 for now, could be extended
        });

        if (validationError) {
          ctx.logger.error(`[${transferId}] ❌ STEP 2 FAILED: Database validation error`, {
            transferId,
            error: validationError,
            function: 'validate_transfer_request',
            parameters: {
              from_warehouse: input.source_warehouse_id,
              to_warehouse: input.destination_warehouse_id,
              product: item.product_id,
              qty_full: item.quantity_to_transfer
            }
          });
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Validation failed: ${validationError.message}`
          });
        }

        // Transform database result to expected format
        const result = {
          is_valid: validationResult.is_valid,
          errors: validationResult.errors || [],
          warnings: validationResult.warnings || [],
          blocked_items: validationResult.is_valid ? [] : [item.product_id],
          total_weight_kg: 0, // Calculate from source_stock if needed
          estimated_cost: undefined,
          source_stock: validationResult.source_stock
        };

        ctx.logger.info(`[${transferId}] ✅ STEP 2 COMPLETE: Atomic validation result`, {
          transferId,
          isValid: result.is_valid,
          errorCount: result.errors.length,
          warningCount: result.warnings.length,
          blockedItems: result.blocked_items.length,
          sourceStock: result.source_stock,
          validationDuration: Date.now() - parseInt(transferId.split('_')[1])
        });
        return result;
      }

      // For multi-item transfers, use existing validation logic
      ctx.logger.info(`[${transferId}] 🔍 STEP 2: Multi-item validation`, {
        transferId,
        itemCount: input.items.length,
        validationMethod: 'multi_item_validation'
      });
      
      const basicValidation = validateTransferBasics(input);
      let errors = [...basicValidation.errors];
      let warnings = [...basicValidation.warnings];
      const blocked_items: string[] = [];

      ctx.logger.info(`[${transferId}] 🔍 STEP 2.1: Basic validation complete`, {
        transferId,
        basicErrors: basicValidation.errors,
        basicWarnings: basicValidation.warnings
      });

      // Validate warehouses exist
      ctx.logger.info(`[${transferId}] 🔍 STEP 2.2: Validating warehouses`, {
        transferId,
        sourceWarehouseId: input.source_warehouse_id,
        destinationWarehouseId: input.destination_warehouse_id
      });
      
      const { data: warehouses, error: warehouseError } = await ctx.supabase
        .from('warehouses')
        .select('id, name')
        .in('id', [input.source_warehouse_id, input.destination_warehouse_id]);

      if (warehouseError || warehouses.length !== 2) {
        ctx.logger.error(`[${transferId}] ❌ STEP 2.2 FAILED: Warehouse validation error`, {
          transferId,
          error: warehouseError,
          warehousesFound: warehouses?.length || 0,
          expectedWarehouses: 2
        });
        errors.push('One or both warehouses not found');
      } else {
        ctx.logger.info(`[${transferId}] ✅ STEP 2.2 COMPLETE: Warehouses validated`, {
          transferId,
          warehouses: warehouses.map(w => ({ id: w.id, name: w.name }))
        });
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

      // Validate each item using enhanced validation
      let total_weight_kg = 0;
      let estimated_cost = 0;

      for (const item of input.items) {
        // Use atomic validation for each item
        const { data: itemValidation } = await ctx.supabase.rpc('validate_transfer_request', {
          p_from_warehouse_id: input.source_warehouse_id,
          p_to_warehouse_id: input.destination_warehouse_id,
          p_product_id: item.product_id,
          p_qty_full: item.quantity_to_transfer,
          p_qty_empty: 0,
        });

        if (itemValidation && !itemValidation.is_valid) {
          errors.push(...itemValidation.errors.map((error: string) => `${item.product_id}: ${error}`));
          blocked_items.push(item.product_id);
        }

        if (itemValidation && itemValidation.warnings) {
          warnings.push(...itemValidation.warnings.map((warning: string) => `${item.product_id}: ${warning}`));
        }

        // Calculate weights from stock data
        const stockInfo = stockData?.find(stock => stock.product_id === item.product_id);
        if (stockInfo?.product?.capacity_kg && stockInfo?.product?.tare_weight_kg) {
          const unitWeight = stockInfo.product.capacity_kg + stockInfo.product.tare_weight_kg;
          total_weight_kg += unitWeight * item.quantity_to_transfer;
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

      ctx.logger.info(`[${transferId}] ✅ STEP 2 COMPLETE: Multi-item validation result`, {
        transferId,
        isValid: result.is_valid,
        errorCount: result.errors.length,
        warningCount: result.warnings.length,
        blockedItems: result.blocked_items.length,
        totalWeightKg: result.total_weight_kg,
        estimatedCost: result.estimated_cost,
        validationDuration: Date.now() - parseInt(transferId.split('_')[1])
      });
      return result;
    }),

  // POST /transfers/create - Create new transfer
  create: protectedProcedure
    .input(CreateTransferSchema)
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      // Enhanced logging with step tracking for transfer creation
      const transferId = `create_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      ctx.logger.info(`[${transferId}] 🚀 STEP 1: Starting transfer creation`, {
        transferId,
        sourceWarehouseId: input.source_warehouse_id,
        destinationWarehouseId: input.destination_warehouse_id,
        itemCount: input.items.length,
        transferDate: input.transfer_date,
        priority: input.priority,
        transferReference: input.transfer_reference,
        userId: user.id,
        timestamp: new Date().toISOString()
      });

      // Validate first using inline validation
      const basicValidation = validateTransferBasics(input);
      let errors = [...basicValidation.errors];
      let warnings = [...basicValidation.warnings];
      const blocked_items: string[] = [];

      // Validate warehouses exist and belong to tenant
      const { data: warehouses, error: warehouseError } = await ctx.supabase
        .from('warehouses')
        .select('id, name')
        
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
        sourceWarehouse?.name?.substring(0, 3).toUpperCase() || 'WH',
        destWarehouse?.name?.substring(0, 3).toUpperCase() || 'WH',
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
        ctx.logger.error(`[${transferId}] ❌ STEP 4 FAILED: Transfer creation error`, {
          transferId,
          error: transferError,
          transferData: transferData
        });
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: transferError.message
        });
      }

      ctx.logger.info(`[${transferId}] ✅ STEP 4 COMPLETE: Transfer record created`, {
        transferId,
        createdTransferId: transfer.id,
        transferReference: transfer.transfer_reference,
        status: transfer.status
      });

      // Create transfer items
      ctx.logger.info(`[${transferId}] 🚀 STEP 5: Creating transfer items`, {
        transferId,
        transferDbId: transfer.id,
        itemCount: input.items.length
      });
      
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
        ctx.logger.error(`[${transferId}] ❌ STEP 5 FAILED: Transfer items creation error`, {
          transferId,
          error: itemsError,
          transferItems: transferItems
        });
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: itemsError.message
        });
      }

      ctx.logger.info(`[${transferId}] 🎉 TRANSFER CREATION COMPLETE`, {
        transferId,
        createdTransferId: transfer.id,
        transferReference: transfer.transfer_reference,
        itemCount: transferItems.length,
        totalQuantity: summary.total_quantity,
        totalWeight: summary.total_weight_kg,
        creationDuration: Date.now() - parseInt(transferId.split('_')[1]),
        status: 'success'
      });
      return transfer;
    }),

  // POST /transfers/{id}/status - Update transfer status
  updateStatus: protectedProcedure
    .input(UpdateTransferStatusSchema)
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      // Enhanced logging with step tracking for status updates
      const updateId = `status_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      ctx.logger.info(`[${updateId}] 🔄 STEP 1: Starting transfer status update`, {
        updateId,
        transferId: input.transfer_id,
        newStatus: input.new_status,
        userId: user.id,
        timestamp: new Date().toISOString()
      });

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
        ctx.logger.info(`[${updateId}] 🚀 STEP 3: Executing stock transfer completion`, {
          updateId,
          transferId: currentTransfer.id,
          itemCount: currentTransfer.items?.length || 0,
          sourceWarehouse: currentTransfer.source_warehouse_id,
          destinationWarehouse: currentTransfer.destination_warehouse_id
        });
        
        // Execute the actual stock transfer
        if (currentTransfer.items && currentTransfer.items.length > 0) {
          const transferResults: any[] = [];
          let completedItems = 0;
          let failedItems = 0;
          
          for (const [index, item] of currentTransfer.items.entries()) {
            try {
              ctx.logger.info(`[${updateId}] 🔄 STEP 3.${index + 1}: Processing item ${index + 1}/${currentTransfer.items.length}`, {
                updateId,
                itemIndex: index + 1,
                totalItems: currentTransfer.items.length,
                productId: item.product_id,
                qtyFull: item.quantity_full,
                qtyEmpty: item.quantity_empty
              });
              
              // Determine transfer type and use appropriate function
              const isToTruck = currentTransfer.destination_warehouse_id && 
                               await isTruckDestination(ctx.supabase, currentTransfer.destination_warehouse_id);
              
              ctx.logger.info(`[${updateId}] 🎯 Determined transfer type: ${isToTruck ? 'truck' : 'warehouse'}`, {
                updateId,
                destinationType: isToTruck ? 'truck' : 'warehouse',
                destinationId: currentTransfer.destination_warehouse_id
              });
              
              let transferResult;
              let transferError;
              
              if (isToTruck) {
                // Transfer to truck
                ctx.logger.info(`[${updateId}] 🚛 Executing warehouse-to-truck transfer`, {
                  updateId,
                  function: 'transfer_stock_to_truck',
                  parameters: {
                    from_warehouse: currentTransfer.source_warehouse_id,
                    to_truck: currentTransfer.destination_warehouse_id,
                    product: item.product_id,
                    qty_full: item.quantity_full,
                    qty_empty: item.quantity_empty
                  }
                });
                const { data, error } = await ctx.supabase.rpc('transfer_stock_to_truck', {
                  p_from_warehouse_id: currentTransfer.source_warehouse_id,
                  p_to_truck_id: currentTransfer.destination_warehouse_id,
                  p_product_id: item.product_id,
                  p_qty_full: item.quantity_full,
                  p_qty_empty: item.quantity_empty,
                });
                transferResult = data;
                transferError = error;
              } else {
                // Standard warehouse-to-warehouse transfer
                ctx.logger.info(`[${updateId}] 🏢 Executing warehouse-to-warehouse transfer`, {
                  updateId,
                  function: 'transfer_stock',
                  parameters: {
                    from_warehouse: currentTransfer.source_warehouse_id,
                    to_warehouse: currentTransfer.destination_warehouse_id,
                    product: item.product_id,
                    qty_full: item.quantity_full,
                    qty_empty: item.quantity_empty
                  }
                });
                const { data, error } = await ctx.supabase.rpc('transfer_stock', {
                  p_from_warehouse_id: currentTransfer.source_warehouse_id,
                  p_to_warehouse_id: currentTransfer.destination_warehouse_id,
                  p_product_id: item.product_id,
                  p_qty_full: item.quantity_full,
                  p_qty_empty: item.quantity_empty,
                });
                transferResult = data;
                transferError = error;
              }
              
              if (transferError) {
                ctx.logger.error('Database function returned error:', transferError);
                throw transferError;
              }
              
              if (!transferResult) {
                ctx.logger.error('Database function returned null result');
                throw new Error('Transfer function returned null result');
              }
              
              if (!transferResult.success) {
                ctx.logger.error('Transfer function reported failure:', transferResult);
                throw new Error(`Transfer function failed: ${transferResult.error || 'Unknown error'}`);
              }
              
              transferResults.push({
                product_id: item.product_id,
                success: true,
                result: transferResult
              });
              
              completedItems++;
              ctx.logger.info(`Stock transfer executed successfully for product ${item.product_id}:`, transferResult);
              
            } catch (error) {
              failedItems++;
              const errorMessage = formatErrorMessage(error);
              ctx.logger.error(`Stock transfer execution failed for product ${item.product_id}:`, errorMessage);
              
              transferResults.push({
                product_id: item.product_id,
                success: false,
                error: errorMessage
              });
              
              // Continue with other items but track the failure
              ctx.logger.warn('Continuing with remaining transfer items despite failure');
            }
          }
          
          ctx.logger.info(`Transfer completion summary: ${completedItems} completed, ${failedItems} failed out of ${currentTransfer.items.length} total items`);
          
          // If any items failed, don't mark the transfer as completed
          if (failedItems > 0) {
            const failureDetails = transferResults
              .filter(r => !r.success)
              .map(r => `Product ${r.product_id}: ${r.error}`)
              .join('; ');
              
            ctx.logger.error('Transfer completion failed due to item failures:', failureDetails);
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: `Transfer completion failed. ${failedItems} of ${currentTransfer.items.length} items failed: ${failureDetails}`
            });
          }
          
          ctx.logger.info('All transfer items completed successfully, proceeding with status update');
        } else {
          ctx.logger.warn('No items found in transfer, proceeding with status update anyway');
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
      const user = requireAuth(ctx);
      
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
        const errorMessage = formatErrorMessage(error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: errorMessage
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
        qty_on_order: 0, // Future: Calculate from pending purchase orders when implemented
        qty_full: item.qty_full,
        qty_empty: item.qty_empty,
        locations: item.locations || [], // Storage locations within warehouse
        last_updated: item.updated_at,
        reorder_level: item.product?.reorder_level || (item.product?.capacity_kg >= 50 ? 5 : item.product?.capacity_kg >= 20 ? 10 : 20),
        max_capacity: item.warehouse.max_capacity || 1000
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
      const user = requireAuth(ctx);
      
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
        const errorMessage = formatErrorMessage(error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: errorMessage
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
      const user = requireAuth(ctx);
      
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
        const errorMessage = formatErrorMessage(error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: errorMessage
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

  // POST /transfers/validate-multi-sku - Validate multi-SKU transfer with enhanced logic
  validateMultiSkuTransfer: protectedProcedure
    .input(z.object({
      source_warehouse_id: z.string().uuid(),
      destination_warehouse_id: z.string().uuid(),
      transfer_date: z.string(),
      items: z.array(TransferItemSchema).min(1),
      notes: z.string().optional(),
      reason: z.string().optional(),
      priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
    }))
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Validating multi-SKU transfer:', input);

      // Get warehouse stock information
      const productIds = input.items.map(item => item.product_id);
      const { data: stockData, error: stockError } = await ctx.supabase
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
        .eq('warehouse_id', input.source_warehouse_id)
        .in('product_id', productIds);

      if (stockError) {
        ctx.logger.error('Stock data fetch error:', stockError);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch stock information'
        });
      }

      // Transform stock data to warehouse stock info format
      const warehouseStockData: WarehouseStockInfo[] = (stockData || []).map((item: any) => ({
        warehouse_id: item.warehouse_id,
        warehouse_name: item.warehouse?.name || 'Unknown',
        product_id: item.product_id,
        product_sku: item.product?.sku || '',
        product_name: item.product?.name || 'Unknown Product',
        variant_name: item.product?.variant_name,
        qty_available: item.qty_full + item.qty_empty,
        qty_reserved: item.qty_reserved || 0,
        qty_on_order: 0,
        qty_full: item.qty_full,
        qty_empty: item.qty_empty,
        locations: [],
        last_updated: item.updated_at,
        reorder_level: 10,
        max_capacity: 1000
      }));

      // Create partial transfer object for validation
      const transferData: Partial<MultiSkuTransfer> = {
        source_warehouse_id: input.source_warehouse_id,
        destination_warehouse_id: input.destination_warehouse_id,
        transfer_date: input.transfer_date,
        items: input.items.map(item => createTransferItem(item))
      };

      // Perform validation
      const validationResult = validateMultiSkuTransfer(transferData, warehouseStockData);

      ctx.logger.info('Multi-SKU transfer validation result:', validationResult);
      return validationResult;
    }),

  // POST /transfers/calculate-details - Calculate transfer item details
  calculateTransferDetails: protectedProcedure
    .input(z.object({
      items: z.array(TransferItemSchema).min(1),
    }))
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Calculating transfer details:', input);

      // Get product information for all items
      const productIds = input.items.map(item => item.product_id);
      const { data: products, error: productError } = await ctx.supabase
        .from('products')
        .select('*')
        .in('id', productIds);

      if (productError) {
        ctx.logger.error('Product fetch error:', productError);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch product information'
        });
      }

      // Calculate details for each item
      const itemsWithDetails = input.items.map(item => {
        const product = products?.find(p => p.id === item.product_id);
        if (!product) {
          const transferItem = createTransferItem(item);
          transferItem.is_valid = false;
          transferItem.validation_errors = ['Product not found'];
          return transferItem;
        }

        const transferItem = createTransferItem({
          ...item,
          product_sku: product.sku,
          product_name: product.name
        });

        return calculateTransferItemDetails(transferItem, product);
      });

      // Generate summary
      const summary = generateTransferSummary(itemsWithDetails);

      ctx.logger.info('Transfer details calculation complete');
      return {
        items: itemsWithDetails,
        summary
      };
    }),

  // POST /transfers/validate-capacity - Validate warehouse capacity
  validateTransferCapacity: protectedProcedure
    .input(z.object({
      warehouse_id: z.string().uuid(),
      items: z.array(TransferItemSchema).min(1),
      warehouse_capacity_kg: z.number().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Validating transfer capacity:', input);

      // Get warehouse information
      const { data: warehouse, error: warehouseError } = await ctx.supabase
        .from('warehouses')
        .select('id, name, capacity_kg')
        .eq('id', input.warehouse_id)
        .single();

      if (warehouseError) {
        ctx.logger.error('Warehouse fetch error:', warehouseError);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch warehouse information'
        });
      }

      // Prepare transfer items with calculated weights
      const transferItems: MultiSkuTransferItem[] = input.items.map(item => createTransferItem(item));

      // Validate capacity
      const capacityValidation = validateWarehouseCapacity(
        input.warehouse_id,
        transferItems,
        input.warehouse_capacity_kg || warehouse.capacity_kg
      );

      ctx.logger.info('Warehouse capacity validation result:', capacityValidation);
      return capacityValidation;
    }),

  // POST /transfers/validate-inventory - Validate inventory availability
  validateInventoryAvailability: protectedProcedure
    .input(z.object({
      warehouse_id: z.string().uuid(),
      items: z.array(TransferItemSchema).min(1),
    }))
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Validating inventory availability:', input);

      // Prepare transfer items
      const transferItems: MultiSkuTransferItem[] = input.items.map(item => createTransferItem(item));

      // Validate inventory availability
      const availabilityValidation = await validateInventoryAvailability(
        ctx.supabase,
        input.warehouse_id,
        transferItems
      );

      ctx.logger.info('Inventory availability validation result:', availabilityValidation);
      return availabilityValidation;
    }),

  // POST /transfers/check-conflicts - Check for transfer conflicts
  checkTransferConflicts: protectedProcedure
    .input(z.object({
      source_warehouse_id: z.string().uuid(),
      destination_warehouse_id: z.string().uuid(),
      transfer_date: z.string(),
      items: z.array(TransferItemSchema).min(1),
    }))
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Checking transfer conflicts:', input);

      // Get existing transfers on the same date
      const { data: existingTransfers, error: transferError } = await ctx.supabase
        .from('transfers')
        .select(`
          *,
          items:transfer_lines(
            product_id,
            quantity_full,
            quantity_empty,
            product:product_id(id, sku, name, variant_name)
          )
        `)
        .eq('source_warehouse_id', input.source_warehouse_id)
        .eq('transfer_date', input.transfer_date)
        .in('status', ['pending', 'approved', 'in_transit']);

      if (transferError) {
        ctx.logger.error('Existing transfers fetch error:', transferError);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch existing transfers'
        });
      }

      // Transform existing transfers to the expected format
      const transformedExistingTransfers: MultiSkuTransfer[] = (existingTransfers || []).map(transfer => ({
        ...transfer,
        items: transfer.items.map((item: any) => createTransferItem({
          ...item,
          product_sku: item.product?.sku || '',
          product_name: item.product?.name || 'Unknown Product',
          variant_name: item.product?.variant_name,
          quantity_to_transfer: item.quantity_full + item.quantity_empty,
          available_stock: 0
        }))
      }));

      // Prepare new transfer data
      const newTransferData: Partial<MultiSkuTransfer> = {
        source_warehouse_id: input.source_warehouse_id,
        destination_warehouse_id: input.destination_warehouse_id,
        transfer_date: input.transfer_date,
        items: input.items.map(item => createTransferItem(item))
      };

      // Check for conflicts
      const conflictCheck = checkTransferConflicts(newTransferData, transformedExistingTransfers);

      ctx.logger.info('Transfer conflicts check result:', conflictCheck);
      return conflictCheck;
    }),

  // POST /transfers/estimate-duration - Estimate transfer duration
  estimateTransferDuration: protectedProcedure
    .input(z.object({
      items: z.array(TransferItemSchema).min(1),
      estimated_distance_km: z.number().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Estimating transfer duration:', input);

      // Prepare transfer items
      const transferItems: MultiSkuTransferItem[] = input.items.map(item => createTransferItem(item));

      // Calculate duration estimate
      const durationEstimate = estimateTransferDuration(
        transferItems,
        input.estimated_distance_km
      );

      ctx.logger.info('Transfer duration estimation complete:', durationEstimate);
      return durationEstimate;
    }),

  // POST /transfers/format-validation-errors - Format validation errors for display
  formatValidationErrors: protectedProcedure
    .input(z.object({
      validation_result: z.object({
        is_valid: z.boolean(),
        errors: z.array(z.string()),
        warnings: z.array(z.string()),
        blocked_items: z.array(z.string()),
        total_weight_kg: z.number(),
        estimated_cost: z.number().optional(),
      }),
    }))
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Formatting validation errors:', input);

      // Format validation errors
      const formattedErrors = formatValidationErrors(input.validation_result as TransferValidationResult);

      ctx.logger.info('Validation errors formatted');
      return formattedErrors;
    }),
});