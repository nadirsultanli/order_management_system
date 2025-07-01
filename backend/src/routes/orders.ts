import { z } from 'zod';
import { router, protectedProcedure } from '../lib/trpc';
import { requireTenantAccess } from '../lib/auth';
import { TRPCError } from '@trpc/server';

const OrderStatusEnum = z.enum(['draft', 'confirmed', 'scheduled', 'en_route', 'delivered', 'invoiced', 'cancelled']);

export const ordersRouter = router({
  // GET /orders - List orders with optional analytics
  list: protectedProcedure
    .input(z.object({
      status: OrderStatusEnum.optional(),
      customer_id: z.string().uuid().optional(),
      search: z.string().optional(),
      order_date_from: z.string().optional(),
      order_date_to: z.string().optional(),
      scheduled_date_from: z.string().optional(),
      scheduled_date_to: z.string().optional(),
      include_analytics: z.boolean().default(false),
      page: z.number().min(1).default(1),
      limit: z.number().min(1).max(100).default(50),
    }))
    .query(async ({ input, ctx }) => {
      const user = requireTenantAccess(ctx);
      
      ctx.logger.info('Fetching orders with filters:', input);
      
      let query = ctx.supabase
        .from('orders')
        .select(`
          *,
          customer:customers(id, name, email, phone, account_status, credit_terms_days),
          delivery_address:addresses(id, line1, line2, city, state, postal_code, country, instructions),
          order_lines(
            id,
            product_id,
            quantity,
            unit_price,
            subtotal,
            product:products(id, sku, name, unit_of_measure)
          )
        `, { count: 'exact' })
        .eq('tenant_id', user.tenant_id)
        .order('created_at', { ascending: false });

      // Apply search filter
      if (input.search) {
        query = query.or(`id.ilike.%${input.search}%,customer.name.ilike.%${input.search}%`);
      }

      // Apply status filter
      if (input.status) {
        query = query.eq('status', input.status);
      }

      // Apply customer filter
      if (input.customer_id) {
        query = query.eq('customer_id', input.customer_id);
      }

      // Apply date filters
      if (input.order_date_from) {
        query = query.gte('order_date', input.order_date_from);
      }
      if (input.order_date_to) {
        query = query.lte('order_date', input.order_date_to);
      }
      if (input.scheduled_date_from) {
        query = query.gte('scheduled_date', input.scheduled_date_from);
      }
      if (input.scheduled_date_to) {
        query = query.lte('scheduled_date', input.scheduled_date_to);
      }

      // Apply pagination
      const from = (input.page - 1) * input.limit;
      const to = from + input.limit - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) {
        ctx.logger.error('Supabase orders error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message
        });
      }

      return {
        orders: data || [],
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / input.limit),
        currentPage: input.page,
      };
    }),

  // GET /orders/{id} - Get single order
  getById: protectedProcedure
    .input(z.object({
      order_id: z.string().uuid(),
    }))
    .query(async ({ input, ctx }) => {
      const user = requireTenantAccess(ctx);
      
      ctx.logger.info('Fetching order:', input.order_id);
      
      const { data, error } = await ctx.supabase
        .from('orders')
        .select(`
          *,
          customer:customers(id, name, email, phone, account_status, credit_terms_days, 
            billing_address:addresses!customers_billing_address_id_fkey(id, line1, line2, city, state, postal_code, country)),
          delivery_address:addresses(id, line1, line2, city, state, postal_code, country, instructions),
          order_lines(
            id,
            product_id,
            quantity,
            unit_price,
            subtotal,
            product:products(id, sku, name, unit_of_measure, weight, volume)
          )
        `)
        .eq('id', input.order_id)
        .eq('tenant_id', user.tenant_id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Order not found'
          });
        }
        ctx.logger.error('Supabase order error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message
        });
      }

      return data;
    }),

  // POST /orders - Create new order
  create: protectedProcedure
    .input(z.object({
      customer_id: z.string().uuid(),
      delivery_address_id: z.string().uuid().optional(),
      scheduled_date: z.string().datetime().optional(),
      notes: z.string().optional(),
      order_lines: z.array(z.object({
        product_id: z.string().uuid(),
        quantity: z.number().positive(),
        unit_price: z.number().positive().optional(),
      })),
    }))
    .mutation(async ({ input, ctx }) => {
      const user = requireTenantAccess(ctx);
      
      ctx.logger.info('Creating order for customer:', input.customer_id);

      // Verify customer belongs to user's tenant
      const { data: customer, error: customerError } = await ctx.supabase
        .from('customers')
        .select('id, name')
        .eq('id', input.customer_id)
        .eq('tenant_id', user.tenant_id)
        .single();

      if (customerError || !customer) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Customer not found'
        });
      }

      // Create order
      const orderData = {
        customer_id: input.customer_id,
        delivery_address_id: input.delivery_address_id,
        scheduled_date: input.scheduled_date,
        notes: input.notes,
        status: 'draft' as const,
        order_date: new Date().toISOString(),
        tenant_id: user.tenant_id,
        created_by: user.id,
      };

      const { data: order, error: orderError } = await ctx.supabase
        .from('orders')
        .insert(orderData)
        .select()
        .single();

      if (orderError) {
        ctx.logger.error('Order creation error:', orderError);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: orderError.message
        });
      }

      // Create order lines
      const orderLinesData = input.order_lines.map(line => ({
        order_id: order.id,
        product_id: line.product_id,
        quantity: line.quantity,
        unit_price: line.unit_price || 0,
        subtotal: (line.unit_price || 0) * line.quantity,
        tenant_id: user.tenant_id,
      }));

      const { error: linesError } = await ctx.supabase
        .from('order_lines')
        .insert(orderLinesData);

      if (linesError) {
        ctx.logger.error('Order lines creation error:', linesError);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: linesError.message
        });
      }

      // Calculate and update order total
      await calculateOrderTotal(ctx, order.id, user.tenant_id);

      // Return complete order with relations
      return await getOrderById(ctx, order.id, user.tenant_id);
    }),

  // POST /orders/{id}/calculate-total - Calculate order total
  calculateTotal: protectedProcedure
    .input(z.object({
      order_id: z.string().uuid(),
    }))
    .mutation(async ({ input, ctx }) => {
      const user = requireTenantAccess(ctx);
      
      return await calculateOrderTotal(ctx, input.order_id, user.tenant_id);
    }),

  // POST /orders/{id}/status - Update order status
  updateStatus: protectedProcedure
    .input(z.object({
      order_id: z.string().uuid(),
      new_status: OrderStatusEnum,
      scheduled_date: z.string().datetime().optional(),
      reason: z.string().optional(),
      metadata: z.record(z.any()).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const user = requireTenantAccess(ctx);
      
      ctx.logger.info('Changing order status:', input);

      // Get current order
      const { data: currentOrder, error: orderError } = await ctx.supabase
        .from('orders')
        .select(`
          *,
          order_lines(product_id, quantity)
        `)
        .eq('id', input.order_id)
        .eq('tenant_id', user.tenant_id)
        .single();

      if (orderError || !currentOrder) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Order not found'
        });
      }

      // Handle inventory updates based on status change
      if (input.new_status === 'confirmed' && currentOrder.status === 'draft') {
        // Reserve inventory
        if (currentOrder.order_lines) {
          for (const line of currentOrder.order_lines) {
            await ctx.supabase.rpc('reserve_stock', {
              p_product_id: line.product_id,
              p_quantity: line.quantity,
              p_tenant_id: user.tenant_id,
            });
          }
        }
      } else if (input.new_status === 'delivered' && 
                 ['confirmed', 'scheduled', 'en_route'].includes(currentOrder.status)) {
        // Deduct actual stock and release reserved
        if (currentOrder.order_lines) {
          for (const line of currentOrder.order_lines) {
            await ctx.supabase.rpc('fulfill_order_line', {
              p_product_id: line.product_id,
              p_quantity: line.quantity,
              p_tenant_id: user.tenant_id,
            });
          }
        }
      } else if (input.new_status === 'cancelled' && currentOrder.status === 'confirmed') {
        // Release reserved stock
        if (currentOrder.order_lines) {
          for (const line of currentOrder.order_lines) {
            await ctx.supabase.rpc('release_reserved_stock', {
              p_product_id: line.product_id,
              p_quantity: line.quantity,
              p_tenant_id: user.tenant_id,
            });
          }
        }
      }

      // Update order status
      const updateData: any = {
        status: input.new_status,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      };

      if (input.scheduled_date) {
        updateData.scheduled_date = input.scheduled_date;
      }

      const { data: updatedOrder, error: updateError } = await ctx.supabase
        .from('orders')
        .update(updateData)
        .eq('id', input.order_id)
        .eq('tenant_id', user.tenant_id)
        .select()
        .single();

      if (updateError) {
        ctx.logger.error('Order status update error:', updateError);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: updateError.message
        });
      }

      ctx.logger.info('Order status updated successfully:', updatedOrder);
      return updatedOrder;
    }),

  // POST /orders/{id}/update-tax - Update order tax
  updateTax: protectedProcedure
    .input(z.object({
      order_id: z.string().uuid(),
      tax_percent: z.number().min(0).max(100),
    }))
    .mutation(async ({ input, ctx }) => {
      const user = requireTenantAccess(ctx);
      
      return await updateOrderTax(ctx, input.order_id, input.tax_percent, user.tenant_id);
    }),
});

// Helper function to calculate order total
async function calculateOrderTotal(ctx: any, orderId: string, tenantId: string) {
  ctx.logger.info('Calculating order total for:', orderId);

  // Get order lines with quantity and unit_price
  const { data: lines, error: linesError } = await ctx.supabase
    .from('order_lines')
    .select('quantity, unit_price, subtotal')
    .eq('order_id', orderId)
    .eq('tenant_id', tenantId);

  if (linesError) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: linesError.message
    });
  }

  // Get order tax information
  const { data: order, error: orderError } = await ctx.supabase
    .from('orders')
    .select('tax_amount, tax_percent')
    .eq('id', orderId)
    .eq('tenant_id', tenantId)
    .single();

  if (orderError) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: orderError.message
    });
  }

  if (lines) {
    const subtotal = lines.reduce((sum, line) => {
      const lineSubtotal = line.subtotal || (line.quantity * line.unit_price);
      return sum + lineSubtotal;
    }, 0);
    
    const taxAmount = order?.tax_amount || 0;
    const grandTotal = subtotal + taxAmount;
    
    ctx.logger.info('Order total calculation:', { orderId, subtotal, taxAmount, grandTotal });
    
    const { error: updateError } = await ctx.supabase
      .from('orders')
      .update({ 
        total_amount: grandTotal,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)
      .eq('tenant_id', tenantId);

    if (updateError) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: updateError.message
      });
    }

    return {
      subtotal,
      tax_amount: taxAmount,
      total_amount: grandTotal,
      breakdown: lines.map(line => ({
        quantity: line.quantity,
        unit_price: line.unit_price,
        subtotal: line.subtotal || (line.quantity * line.unit_price)
      }))
    };
  }

  throw new TRPCError({
    code: 'NOT_FOUND',
    message: 'No order lines found'
  });
}

// Helper function to update order tax and recalculate total
async function updateOrderTax(ctx: any, orderId: string, taxPercent: number, tenantId: string) {
  ctx.logger.info('Updating order tax:', { orderId, taxPercent });

  // Get order lines with quantity and unit_price
  const { data: lines, error: linesError } = await ctx.supabase
    .from('order_lines')
    .select('quantity, unit_price, subtotal')
    .eq('order_id', orderId)
    .eq('tenant_id', tenantId);

  if (linesError) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: linesError.message
    });
  }

  if (lines) {
    const subtotal = lines.reduce((sum, line) => {
      const lineSubtotal = line.subtotal || (line.quantity * line.unit_price);
      return sum + lineSubtotal;
    }, 0);
    
    const taxAmount = subtotal * (taxPercent / 100);
    const grandTotal = subtotal + taxAmount;
    
    ctx.logger.info('Order tax update:', { orderId, taxPercent, subtotal, taxAmount, grandTotal });
    
    const { error: updateError } = await ctx.supabase
      .from('orders')
      .update({ 
        tax_percent: taxPercent,
        tax_amount: taxAmount,
        total_amount: grandTotal,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)
      .eq('tenant_id', tenantId);

    if (updateError) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: updateError.message
      });
    }

    return {
      subtotal,
      tax_percent: taxPercent,
      tax_amount: taxAmount,
      total_amount: grandTotal
    };
  }

  throw new TRPCError({
    code: 'NOT_FOUND',
    message: 'No order lines found'
  });
}

// Helper function to get order by ID with all relations
async function getOrderById(ctx: any, orderId: string, tenantId: string) {
  const { data, error } = await ctx.supabase
    .from('orders')
    .select(`
      *,
      customer:customers(id, name, email, phone, account_status, credit_terms_days),
      delivery_address:addresses(id, line1, line2, city, state, postal_code, country, instructions),
      order_lines(
        id,
        product_id,
        quantity,
        unit_price,
        subtotal,
        product:products(id, sku, name, unit_of_measure)
      )
    `)
    .eq('id', orderId)
    .eq('tenant_id', tenantId)
    .single();

  if (error) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: error.message
    });
  }

  return data;
}