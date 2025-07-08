// import express from 'express';
// import { any, z } from 'zod';

// // Import your existing modules (adjust paths as needed)
// import { requireAuth } from '../lib/auth';
// import { formatErrorMessage } from '../lib/logger';
// import {
//   getOrderWorkflow,
//   getOrderStatusInfo,
//   canTransitionTo,
//   validateTransition,
//   calculateOrderTotalWithTax,
//   validateOrderForConfirmation,
//   validateOrderForScheduling,
//   validateOrderDeliveryWindow,
//   formatOrderId,
//   formatCurrency,
//   formatDate,
//   isOrderEditable,
//   isOrderCancellable,
//   getStatusColor,
//   getNextPossibleStatuses,
//   OrderStatusSchema,
//   OrderLineSchema,
//   StatusTransitionSchema,
//   CalculateTotalsSchema,
//   OrderValidationSchema,
//   type OrderStatus,
//   type OrderWorkflowStep,
//   type OrderValidationResult,
//   type OrderTotalCalculation,
// } from '../lib/order-workflow';
// import { PricingService } from '../lib/pricing';
// import { supabaseAdmin } from '../lib/supabase';
// import { logger } from '../lib/logger';

// const router = express.Router();

// // Zod schemas for validation
// const OrderStatusEnum = z.enum(['draft', 'confirmed', 'scheduled', 'en_route', 'delivered', 'invoiced', 'cancelled']);

// const OrderListQuerySchema = z.object({
//   status: OrderStatusEnum.optional(),
//   customer_id: z.string().uuid().optional(),
//   search: z.string().optional(),
//   order_date_from: z.string().optional(),
//   order_date_to: z.string().optional(),
//   scheduled_date_from: z.string().optional(),
//   scheduled_date_to: z.string().optional(),
//   amount_min: z.preprocess((v) => v === undefined ? undefined : Number(v), z.number().optional()),
//   amount_max: z.preprocess((v) => v === undefined ? undefined : Number(v), z.number().optional()),
//   delivery_area: z.string().optional(),
//   is_overdue: z.preprocess((v) => v === 'true' || v === true, z.boolean().optional()),
//   delivery_method: z.enum(['pickup', 'delivery']).optional(),
//   priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
//   payment_status: z.enum(['pending', 'paid', 'overdue']).optional(),
//   sort_by: z.enum(['created_at', 'order_date', 'scheduled_date', 'total_amount', 'customer_name']).optional(),
//   sort_order: z.enum(['asc', 'desc']).optional(),
//   include_analytics: z.preprocess((v) => v === 'true' || v === true, z.boolean().optional()),
//   page: z.preprocess((v) => v === undefined ? undefined : Number(v), z.number().min(1).optional()),
//   limit: z.preprocess((v) => v === undefined ? undefined : Number(v), z.number().min(1).max(100).optional()),
// });

// const OrderCreateSchema = z.object({
//   customer_id: z.string().uuid(),
//   delivery_address_id: z.string().uuid().optional(),
//   source_warehouse_id: z.string().uuid(),
//   order_date: z.string().optional(),
//   scheduled_date: z.string().datetime().optional(),
//   notes: z.string().optional(),
//   idempotency_key: z.string().optional(),
//   validate_pricing: z.boolean().default(true),
//   skip_inventory_check: z.boolean().default(false),
//   order_type: z.enum(['delivery', 'refill', 'exchange', 'pickup']).default('delivery'),
//   service_type: z.enum(['standard', 'express', 'scheduled']).default('standard'),
//   exchange_empty_qty: z.number().min(0).default(0),
//   requires_pickup: z.boolean().default(false),
//   order_lines: z.array(z.object({
//     product_id: z.string().uuid(),
//     quantity: z.number().positive(),
//     unit_price: z.number().positive().optional(),
//     expected_price: z.number().positive().optional(),
//     price_list_id: z.string().uuid().optional(),
//   })).min(1, 'At least one order line is required'),
// });

// const OrderStatusUpdateSchema = z.object({
//   new_status: OrderStatusEnum,
//   scheduled_date: z.string().datetime().optional(),
//   reason: z.string().optional(),
//   metadata: z.record(z.any()).optional(),
// });

// const OrderTaxUpdateSchema = z.object({
//   tax_percent: z.number().min(0).max(100),
// });

// const OverdueQuerySchema = z.object({
//   days_overdue_min: z.coerce.number().min(0).default(1),
//   include_cancelled: z.coerce.boolean().default(false),
//   priority_filter: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
// });

// const DeliveryCalendarQuerySchema = z.object({
//   date_from: z.string(),
//   date_to: z.string(),
//   delivery_area: z.string().optional(),
//   truck_capacity_filter: z.coerce.boolean().default(false),
//   optimize_routes: z.coerce.boolean().default(false),
// });

// const TruckAllocationSchema = z.object({
//   truck_id: z.string().uuid().optional(),
//   allocation_date: z.string(),
//   force_allocation: z.boolean().default(false),
// });

// const TruckCapacityValidationSchema = z.object({
//   truck_id: z.string().uuid(),
//   order_ids: z.array(z.string().uuid()).min(1),
// });

// const OrderPricingValidationSchema = z.object({
//   customer_id: z.string().uuid(),
//   order_lines: z.array(z.object({
//     product_id: z.string().uuid(),
//     quantity: z.number().positive(),
//     expected_price: z.number().positive().optional(),
//     price_list_id: z.string().uuid().optional(),
//   })).min(1),
// });

// // Middleware for authentication and context
// const authMiddleware = (req: any, res: any, next: any) => {
//   try {
//     const user = requireAuth(req); // Adjust this based on your auth implementation
//     req.user = user;
//     req.ctx = {
//       user,
//       supabase: req.supabase, // Assuming supabase is attached to req
//       logger: req.logger || console, // Assuming logger is attached to req
//     };
//     next();
//   } catch (error) {
//     res.status(401).json({ error: 'Unauthorized' });
//   }
// };

// // Apply auth middleware to all routes
// router.use(authMiddleware);

// // Error handler wrapper
// const asyncHandler = (fn: any) => (req: any, res: any, next: any) => {
//   Promise.resolve(fn(req, res, next)).catch(next);
// };

// // GET /api/v1/orders - List all orders with advanced filtering
// router.get('/', async (req, res) => {
//   try {
//     // Validate and parse query params
//     const filters = OrderListQuerySchema.parse(req.query);
//     const page = filters.page || 1;
//     const limit = filters.limit || 50;
//     const sort_by = filters.sort_by || 'created_at';
//     const sort_order = filters.sort_order || 'desc';
//     const include_analytics = filters.include_analytics || false;

//     logger.info('REST: Fetching orders with advanced filters:', filters);

//     let query = supabaseAdmin
//       .from('orders')
//       .select(`
//         *,
//         customer:customers(id, name, email, phone, account_status, credit_terms_days),
//         delivery_address:addresses(id, line1, line2, city, state, postal_code, country, instructions),
//         source_warehouse:warehouses(id, name, is_mobile),
//         order_lines(
//           id,
//           product_id,
//           quantity,
//           unit_price,
//           subtotal,
//           product:products(id, sku, name, unit_of_measure)
//         ),
//         payments(
//           id,
//           amount,
//           payment_method,
//           payment_status,
//           payment_date,
//           transaction_id
//         )
//       `, { count: 'exact' });

//     // Apply filters (same as tRPC logic)
//     if (filters.status) query = query.eq('status', filters.status);
//     if (filters.customer_id) query = query.eq('customer_id', filters.customer_id);
//     if (filters.search) {
//       query = query.or(`
//         id.ilike.%${filters.search}%,
//         customer.name.ilike.%${filters.search}%,
//         customer.email.ilike.%${filters.search}%,
//         order_lines.product.sku.ilike.%${filters.search}%,
//         order_lines.product.name.ilike.%${filters.search}%,
//         delivery_address.city.ilike.%${filters.search}%
//       `);
//     }
//     if (filters.order_date_from) query = query.gte('order_date', filters.order_date_from);
//     if (filters.order_date_to) query = query.lte('order_date', filters.order_date_to);
//     if (filters.scheduled_date_from) query = query.gte('scheduled_date', filters.scheduled_date_from);
//     if (filters.scheduled_date_to) query = query.lte('scheduled_date', filters.scheduled_date_to);
//     if (filters.amount_min !== undefined) query = query.gte('total_amount', filters.amount_min);
//     if (filters.amount_max !== undefined) query = query.lte('total_amount', filters.amount_max);
//     if (filters.delivery_area) {
//       query = query.or(`
//         delivery_address.city.ilike.%${filters.delivery_area}%,
//         delivery_address.state.ilike.%${filters.delivery_area}%,
//         delivery_address.postal_code.ilike.%${filters.delivery_area}%
//       `);
//     }
//     if (filters.is_overdue) {
//       const today = new Date().toISOString().split('T')[0];
//       query = query.eq('status', 'scheduled').lt('scheduled_date', today);
//     }
//     if (filters.delivery_method) query = query.eq('delivery_method', filters.delivery_method);
//     if (filters.priority) query = query.eq('priority', filters.priority);
//     if (filters.payment_status) {
//       if (filters.payment_status === 'overdue') {
//         const overdueDate = new Date();
//         overdueDate.setDate(overdueDate.getDate() - 30);
//         query = query.eq('status', 'invoiced').lt('invoice_date', overdueDate.toISOString());
//       } else if (filters.payment_status === 'paid') {
//         query = query.not('payment_date', 'is', null);
//       } else if (filters.payment_status === 'pending') {
//         query = query.is('payment_date', null);
//       }
//     }
//     // Sorting
//     const sortMapping = {
//       'created_at': 'created_at',
//       'order_date': 'order_date',
//       'scheduled_date': 'scheduled_date',
//       'total_amount': 'total_amount',
//       'customer_name': 'customer.name',
//     };
//     const sortField = sortMapping[sort_by] || 'created_at';
//     query = query.order(sortField, { ascending: sort_order === 'asc' });
//     // Pagination
//     const from = (page - 1) * limit;
//     const to = from + limit - 1;
//     query = query.range(from, to);

//     const { data, error, count } = await query;
//     if (error) {
//       logger.error('Supabase orders error:', error);
//       return res.status(500).json({ error: error.message });
//     }
//     let orders = data || [];
//     // Post-process for business logic
//     orders = orders.map(order => {
//       const paymentSummary = calculateOrderPaymentSummary(order);
//       return {
//         ...order,
//         is_high_value: (order.total_amount || 0) > 1000,
//         days_since_order: Math.floor((new Date().getTime() - new Date(order.order_date).getTime()) / (1000 * 60 * 60 * 24)),
//         estimated_delivery_window: calculateDeliveryWindow(order),
//         risk_level: calculateOrderRisk(order),
//         payment_summary: paymentSummary,
//         payment_balance: paymentSummary.balance,
//         payment_status: order.payment_status_cache || paymentSummary.status,
//       };
//     });
//     // Analytics (placeholder)
//     const analytics = include_analytics ? await generateOrderAnalytics(orders) : undefined;
//     return res.json({
//       orders,
//       totalCount: count || 0,
//       totalPages: Math.ceil((count || 0) / limit),
//       currentPage: page,
//       analytics,
//     });
//   } catch (err) {
//     if (err instanceof z.ZodError) {
//       return res.status(400).json({ error: err.errors });
//     }
//     logger.error('REST: List orders error:', err);
//     res.status(500).json({ error: 'Internal server error' });
//   }
// });

// // GET /api/v1/orders/:id - Get order by ID
// router.get('/:id', asyncHandler(async (req: any, res: any) => {
//   const orderId = req.params.id;
//   const { ctx } = req;
  
//   if (!z.string().uuid().safeParse(orderId).success) {
//     return res.status(400).json({ error: 'Invalid order ID format' });
//   }
  
//   ctx.logger.info('Fetching order:', orderId);
  
//   const { data, error } = await ctx.supabase
//     .from('orders')
//     .select(`
//       *,
//       customer:customers(id, name, email, phone, account_status, credit_terms_days),
//       delivery_address:addresses(id, line1, line2, city, state, postal_code, country, instructions),
//       source_warehouse:warehouses(id, name, is_mobile),
//       order_lines(
//         id,
//         product_id,
//         quantity,
//         unit_price,
//         subtotal,
//         product:products(id, sku, name, unit_of_measure, capacity_kg, tare_weight_kg)
//       ),
//       payments(
//         id,
//         amount,
//         payment_method,
//         payment_status,
//         payment_date,
//         transaction_id,
//         reference_number
//       )
//     `)
//     .eq('id', orderId)
//     .single();

//   if (error) {
//     if (error.code === 'PGRST116') {
//       return res.status(404).json({ error: 'Order not found' });
//     }
//     ctx.logger.error('Supabase order error:', error);
//     return res.status(500).json({ error: error.message });
//   }

//   const paymentSummary = calculateOrderPaymentSummary(data);
  
//   res.json({
//     ...data,
//     payment_summary: paymentSummary,
//     payment_balance: paymentSummary.balance,
//     payment_status: data.payment_status_cache || paymentSummary.status,
//   });
// }));

// // GET /api/v1/orders/overdue - Get overdue orders
// router.get('/overdue', asyncHandler(async (req: any, res: any) => {
//   const filters = OverdueQuerySchema.parse(req.query);
//   const { ctx } = req;
  
//   ctx.logger.info('Fetching overdue orders with criteria:', filters);
  
//   const cutoffDate = new Date();
//   cutoffDate.setDate(cutoffDate.getDate() - filters.days_overdue_min);
  
//   let query = ctx.supabase
//     .from('orders')
//     .select(`
//       *,
//       customer:customers(id, name, email, phone, account_status),
//       delivery_address:addresses(id, line1, line2, city, state, postal_code, country)
//     `)
//     .eq('status', 'scheduled')
//     .lt('scheduled_date', cutoffDate.toISOString().split('T')[0]);

//   if (!filters.include_cancelled) {
//     query = query.neq('status', 'cancelled');
//   }

//   if (filters.priority_filter) {
//     query = query.eq('priority', filters.priority_filter);
//   }

//   query = query.order('scheduled_date', { ascending: true });

//   const { data, error } = await query;

//   if (error) {
//     ctx.logger.error('Overdue orders error:', error);
//     return res.status(500).json({ error: error.message });
//   }

//   const orders = (data || []).map(order => ({
//     ...order,
//     days_overdue: Math.floor((new Date().getTime() - new Date(order.scheduled_date).getTime()) / (1000 * 60 * 60 * 24)),
//     urgency_score: calculateUrgencyScore(order),
//   }));

//   res.json({
//     orders,
//     summary: {
//       total_overdue: orders.length,
//       total_value: orders.reduce((sum, order) => sum + (order.total_amount || 0), 0),
//       avg_days_overdue: orders.length > 0 ? orders.reduce((sum, order) => sum + order.days_overdue, 0) / orders.length : 0,
//       high_priority_count: orders.filter(order => order.urgency_score >= 8).length,
//     }
//   });
// }));

// // GET /api/v1/orders/delivery-calendar - Get delivery calendar
// router.get('/delivery-calendar', asyncHandler(async (req: any, res: any) => {
//   const filters = DeliveryCalendarQuerySchema.parse(req.query);
//   const { ctx } = req;
  
//   ctx.logger.info('Fetching delivery calendar:', filters);
  
//   let query = ctx.supabase
//     .from('orders')
//     .select(`
//       *,
//       customer:customers(id, name, email, phone),
//       delivery_address:addresses(id, line1, line2, city, state, postal_code, country, latitude, longitude),
//       order_lines(
//         id,
//         product_id,
//         quantity,
//         product:products(id, sku, name, capacity_kg, tare_weight_kg)
//       )
//     `)
//     .gte('scheduled_date', filters.date_from)
//     .lte('scheduled_date', filters.date_to)
//     .in('status', ['scheduled', 'en_route']);

//   if (filters.delivery_area) {
//     query = query.or(`
//       delivery_address.city.ilike.%${filters.delivery_area}%,
//       delivery_address.state.ilike.%${filters.delivery_area}%
//     `);
//   }

//   query = query.order('scheduled_date', { ascending: true });

//   const { data, error } = await query;

//   if (error) {
//     ctx.logger.error('Delivery calendar error:', error);
//     return res.status(500).json({ error: error.message });
//   }

//   const orders = data || [];
  
//   // Group by date and calculate logistics metrics
//   const deliveryDays = orders.reduce((acc, order) => {
//     const date = order.scheduled_date;
//     if (!acc[date]) {
//       acc[date] = {
//         date,
//         orders: [],
//         total_orders: 0,
//         total_value: 0,
//         total_weight: 0,
//         total_volume: 0,
//         estimated_route_time: 0,
//         delivery_areas: new Set(),
//       };
//     }

//     const orderWeight = calculateOrderWeight(order);
//     const orderVolume = calculateOrderVolume(order);
    
//     acc[date].orders.push({
//       ...order,
//       order_weight: orderWeight,
//       order_volume: orderVolume,
//       estimated_service_time: calculateServiceTime(order),
//     });

//     acc[date].total_orders++;
//     acc[date].total_value += order.total_amount || 0;
//     acc[date].total_weight += orderWeight;
//     acc[date].total_volume += orderVolume;
//     acc[date].delivery_areas.add(order.delivery_address?.city || 'Unknown');

//     return acc;
//   }, {} as Record<string, any>);

//   // Convert Sets to arrays for JSON serialization
//   Object.values(deliveryDays).forEach((day: any) => {
//     day.delivery_areas = Array.from(day.delivery_areas);
//     day.estimated_route_time = calculateRouteTime(day.orders);
//     day.truck_requirements = calculateTruckRequirements(day.total_weight, day.total_volume);
//   });

//   res.json({
//     delivery_schedule: Object.values(deliveryDays),
//     summary: {
//       total_delivery_days: Object.keys(deliveryDays).length,
//       total_orders: orders.length,
//       total_value: orders.reduce((sum, order) => sum + (order.total_amount || 0), 0),
//       peak_day: Object.values(deliveryDays).sort((a: any, b: any) => b.total_orders - a.total_orders)[0],
//     }
//   });
// }));

// // POST /api/v1/orders - Create new order
// router.post('/', asyncHandler(async (req: any, res: any) => {
//   const input = OrderCreateSchema.parse(req.body);
//   const { ctx } = req;
  
//   ctx.logger.info('Creating order for customer:', input.customer_id);
  
//   // Generate hash for idempotency if key provided
//   let idempotencyKeyId: string | null = null;
//   if (input.idempotency_key) {
//     const keyHash = Buffer.from(`order_create_${input.idempotency_key}_${ctx.user.id}`).toString('base64');
    
//     const { data: idempotencyData, error: idempotencyError } = await ctx.supabase
//       .rpc('check_idempotency_key', {
//         p_key_hash: keyHash,
//         p_operation_type: 'order_create',
//         p_request_data: input
//       });
      
//     if (idempotencyError) {
//       ctx.logger.error('Idempotency check error:', idempotencyError);
//       return res.status(500).json({ error: 'Failed to check idempotency' });
//     }
    
//     const idempotencyResult = idempotencyData[0];
//     if (idempotencyResult.key_exists) {
//       if (idempotencyResult.is_processing) {
//         return res.status(409).json({ error: 'Order creation already in progress with this key' });
//       } else {
//         return res.json(idempotencyResult.response_data);
//       }
//     }
    
//     idempotencyKeyId = idempotencyResult.key_id;
//   }
  
//   try {
//     // Verify customer belongs to user's tenant and get account status
//     const { data: customer, error: customerError } = await ctx.supabase
//       .from('customers')
//       .select('id, name, account_status, credit_terms_days')
//       .eq('id', input.customer_id)
//       .single();

//     if (customerError || !customer) {
//       return res.status(404).json({ error: 'Customer not found' });
//     }
    
//     if (customer.account_status === 'credit_hold') {
//       return res.status(400).json({ error: 'Cannot create order for customer on credit hold' });
//     }
    
//     if (customer.account_status === 'closed') {
//       return res.status(400).json({ error: 'Cannot create order for closed customer account' });
//     }

//     // Verify source warehouse exists
//     const { data: warehouse, error: warehouseError } = await ctx.supabase
//       .from('warehouses')
//       .select('id, name, is_mobile')
//       .eq('id', input.source_warehouse_id)
//       .single();

//     if (warehouseError || !warehouse) {
//       return res.status(404).json({ error: 'Source warehouse not found' });
//     }

//     // Validate delivery address if provided
//     if (input.delivery_address_id) {
//       const { data: address, error: addressError } = await ctx.supabase
//         .from('addresses')
//         .select('id, customer_id, latitude, longitude')
//         .eq('id', input.delivery_address_id)
//         .eq('customer_id', input.customer_id)
//         .single();
        
//       if (addressError || !address) {
//         return res.status(404).json({ error: 'Delivery address not found or does not belong to customer' });
//       }
//     }

//     // Initialize pricing service
//     const pricingService = new PricingService(ctx.supabase, ctx.logger);
    
//     // Validate order lines and pricing
//     const validatedOrderLines: any[] = [];
//     const validationErrors: string[] = [];
//     const validationWarnings: string[] = [];
//     let totalAmount = 0;
    
//     for (let i = 0; i < input.order_lines.length; i++) {
//       const line = input.order_lines[i];
      
//       // Verify product exists and is active
//       const { data: product, error: productError } = await ctx.supabase
//         .from('products')
//         .select('id, sku, name, status, capacity_kg, tare_weight_kg')
//         .eq('id', line.product_id)
//         .single();
        
//       if (productError || !product) {
//         validationErrors.push(`Product not found for line ${i + 1}`);
//         continue;
//       }
      
//       if (product.status !== 'active') {
//         validationErrors.push(`Product ${product.sku} is not active`);
//         continue;
//       }
      
//       // Validate pricing if enabled
//       let finalUnitPrice = line.unit_price || 0;
      
//       if (input.validate_pricing) {
//         const currentPricing = await pricingService.getProductPrice(
//           line.product_id,
//           input.customer_id
//         );
        
//         if (!currentPricing) {
//           validationErrors.push(`No pricing found for product ${product.sku}`);
//           continue;
//         }
        
//         if (!line.unit_price) {
//           finalUnitPrice = currentPricing.finalPrice;
//         } else {
//           const priceTolerance = 0.01;
//           if (Math.abs(line.unit_price - currentPricing.finalPrice) > priceTolerance) {
//             if (line.expected_price && Math.abs(line.expected_price - currentPricing.finalPrice) <= priceTolerance) {
//               validationErrors.push(
//                 `Price for ${product.sku} has changed. Expected: ${line.expected_price}, Current: ${currentPricing.finalPrice}`
//               );
//             } else {
//               validationErrors.push(
//                 `Invalid price for ${product.sku}. Provided: ${line.unit_price}, Current: ${currentPricing.finalPrice}`
//               );
//             }
//             continue;
//           }
//         }
//       }
      
//       // Check inventory availability if not skipped
//       if (!input.skip_inventory_check) {
//         const { data: inventory, error: inventoryError } = await ctx.supabase
//           .from('inventory_balance')
//           .select('qty_full, qty_reserved')
//           .eq('product_id', line.product_id)
//           .eq('warehouse_id', input.source_warehouse_id)
//           .single();
          
//         if (inventoryError || !inventory) {
//           validationWarnings.push(`No inventory found for product ${product.sku} in selected warehouse`);
//         } else {
//           const availableStock = inventory.qty_full - inventory.qty_reserved;
//           if (line.quantity > availableStock) {
//             validationErrors.push(
//               `Insufficient stock for ${product.sku} in selected warehouse. Requested: ${line.quantity}, Available: ${availableStock}`
//             );
//             continue;
//           }
          
//           if (line.quantity > availableStock * 0.8) {
//             validationWarnings.push(
//               `Large quantity requested for ${product.sku} (${line.quantity}/${availableStock} available in selected warehouse)`
//             );
//           }
//         }
//       }
      
//       const subtotal = finalUnitPrice * line.quantity;
//       totalAmount += subtotal;
      
//       validatedOrderLines.push({
//         product_id: line.product_id,
//         quantity: line.quantity,
//         unit_price: finalUnitPrice,
//         subtotal: subtotal,
//         product_sku: product.sku,
//         product_name: product.name,
//       });
//     }
    
//     // Check for validation errors
//     if (validationErrors.length > 0) {
//       const errorMessage = `Order validation failed: ${validationErrors.join('; ')}`;
      
//       if (idempotencyKeyId) {
//         await ctx.supabase.rpc('complete_idempotency_key', {
//           p_key_id: idempotencyKeyId,
//           p_response_data: { error: errorMessage },
//           p_status: 'failed'
//         });
//       }
      
//       return res.status(400).json({ error: errorMessage });
//     }
    
//     // Validate minimum order amount if configured
//     const minimumOrderAmount = 100;
//     if (totalAmount < minimumOrderAmount) {
//       return res.status(400).json({ 
//         error: `Order total (${totalAmount}) is below minimum order amount (${minimumOrderAmount})` 
//       });
//     }

//     // Create order
//     const orderData = {
//       customer_id: input.customer_id,
//       delivery_address_id: input.delivery_address_id,
//       source_warehouse_id: input.source_warehouse_id,
//       scheduled_date: input.scheduled_date,
//       notes: input.notes,
//       status: 'draft' as const,
//       order_date: input.order_date || new Date().toISOString().split('T')[0],
//       total_amount: totalAmount,
//       created_by_user_id: ctx.user.id,
//       order_type: input.order_type,
//       service_type: input.service_type,
//       exchange_empty_qty: input.exchange_empty_qty,
//       requires_pickup: input.requires_pickup,
//     };

//     const { data: order, error: orderError } = await ctx.supabase
//       .from('orders')
//       .insert(orderData)
//       .select()
//       .single();

//     if (orderError) {
//       ctx.logger.error('Order creation error:', orderError);
//       return res.status(500).json({ error: orderError.message });
//     }

//     // Create order lines
//     const orderLinesData = validatedOrderLines.map(line => ({
//       order_id: order.id,
//       product_id: line.product_id,
//       quantity: line.quantity,
//       unit_price: line.unit_price,
//       subtotal: line.subtotal,
//       qty_tagged: 0,
//       qty_untagged: line.quantity,
//     }));

//     const { error: linesError } = await ctx.supabase
//       .from('order_lines')
//       .insert(orderLinesData);

//     if (linesError) {
//       ctx.logger.error('Order lines creation error:', linesError);
//       return res.status(500).json({ error: linesError.message });
//     }

//     // Calculate and update order total
//     await calculateOrderTotal(ctx, order.id);

//     // Get complete order with relations
//     const completeOrder = await getOrderById(ctx, order.id);
    
//     // Complete idempotency if used
//     if (idempotencyKeyId) {
//       await ctx.supabase.rpc('complete_idempotency_key', {
//         p_key_id: idempotencyKeyId,
//         p_response_data: completeOrder,
//         p_status: 'completed'
//       });
//     }

//     ctx.logger.info('Order created successfully:', {
//       order_id: order.id,
//       customer_id: input.customer_id,
//       total_amount: totalAmount,
//       line_count: validatedOrderLines.length
//     });

//     res.status(201).json({
//       ...completeOrder,
//       validation_warnings: validationWarnings
//     });
    
//   } catch (error) {
//     if (idempotencyKeyId) {
//       await ctx.supabase.rpc('complete_idempotency_key', {
//         p_key_id: idempotencyKeyId,
//         p_response_data: { error: formatErrorMessage(error) },
//         p_status: 'failed'
//       });
//     }
//     throw error;
//   }
// }));

// // PUT /api/v1/orders/:id/status - Update order status
// router.put('/:id/status', asyncHandler(async (req: any, res: any) => {
//   const orderId = req.params.id;
//   const input = OrderStatusUpdateSchema.parse(req.body);
//   const { ctx } = req;
  
//   if (!z.string().uuid().safeParse(orderId).success) {
//     return res.status(400).json({ error: 'Invalid order ID format' });
//   }
  
//   ctx.logger.info('Changing order status:', { orderId, ...input });

//   // Get current order
//   const { data: currentOrder, error: orderError } = await ctx.supabase
//     .from('orders')
//     .select(`
//       *,
//       order_lines(product_id, quantity)
//     `)
//     .eq('id', orderId)
//     .single();

//   if (orderError || !currentOrder) {
//     return res.status(404).json({ error: 'Order not found' });
//   }

//   // Handle inventory updates based on status change
//   if (input.new_status === 'confirmed' && currentOrder.status === 'draft') {
//     if (currentOrder.order_lines) {
//       for (const line of currentOrder.order_lines) {
//         const { data: inventory, error: inventoryError } = await ctx.supabase
//           .from('inventory_balance')
//           .select('warehouse_id, qty_full, qty_reserved')
//           .eq('product_id', line.product_id)
//           .gt('qty_full', 0)
//           .order('qty_full', { ascending: false })
//           .limit(1)
//           .single();

//         if (inventoryError || !inventory) {
//           return res.status(400).json({ 
//             error: `No available inventory for product ${line.product_id}` 
//           });
//         }

//         const availableStock = inventory.qty_full - inventory.qty_reserved;
//         if (availableStock < line.quantity) {
//           return res.status(400).json({ 
//             error: `Insufficient stock for product ${line.product_id}. Available: ${availableStock}, Requested: ${line.quantity}` 
//           });
//         }

//         const { error: reserveError } = await ctx.supabase.rpc('reserve_stock', {
//           p_product_id: line.product_id,
//           p_quantity: line.quantity,
//           p_warehouse_id: inventory.warehouse_id
//         });

//         if (reserveError) {
//           return res.status(500).json({ 
//             error: `Failed to reserve stock for product ${line.product_id}: ${reserveError.message}` 
//           });
//         }
//       }
//     }
//   } else if (input.new_status === 'en_route' && 
//              ['confirmed', 'scheduled'].includes(currentOrder.status)) {
//     if (currentOrder.order_lines) {
//       for (const line of currentOrder.order_lines) {
//         const { error: fulfillError } = await ctx.supabase.rpc('fulfill_order_line', {
//           p_product_id: line.product_id,
//           p_quantity: line.quantity
//         });

//         if (fulfillError) {
//           ctx.logger.error('Failed to fulfill order line:', {
//             error: formatErrorMessage(fulfillError),
//             product_id: line.product_id,
//             quantity: line.quantity,
//             order_id: orderId
//           });
//         }
//       }
//     }
//   } else if (input.new_status === 'cancelled' && ['confirmed', 'scheduled'].includes(currentOrder.status)) {
//     if (currentOrder.order_lines) {
//       for (const line of currentOrder.order_lines) {
//         const { error: releaseError } = await ctx.supabase.rpc('release_reserved_stock', {
//           p_product_id: line.product_id,
//           p_quantity: line.quantity
//         });

//         if (releaseError) {
//           ctx.logger.error('Failed to release reserved stock:', {
//             error: formatErrorMessage(releaseError),
//             product_id: line.product_id,
//             quantity: line.quantity,
//             order_id: orderId
//           });
//         }
//       }
//     }
//   }

//   // Update order status
//   const updateData: any = {
//     status: input.new_status,
//     updated_at: new Date().toISOString(),
//   };

//   if (input.scheduled_date) {
//     updateData.scheduled_date = input.scheduled_date;
//   }

//   const { data: updatedOrder, error: updateError } = await ctx.supabase
//     .from('orders')
//     .update(updateData)
//     .eq('id', orderId)
//     .select()
//     .single();

//   if (updateError) {
//     ctx.logger.error('Order status update error:', updateError);
//     return res.status(500).json({ error: updateError.message });
//   }

//   res.json(updatedOrder);
// }));

// // PUT /api/v1/orders/:id/tax - Update order tax
// router.put('/:id/tax', asyncHandler(async (req: any, res: any) => {
//   const orderId = req.params.id;
//   const { tax_percent } = OrderTaxUpdateSchema.parse(req.body);
//   const { ctx } = req;
  
//   if (!z.string().uuid().safeParse(orderId).success) {
//     return res.status(400).json({ error: 'Invalid order ID format' });
//   }
  
//   const result = await updateOrderTax(ctx, orderId, tax_percent);
//   res.json(result);
// }));

// // POST /api/v1/orders/:id/calculate-total - Calculate order total
// router.post('/:id/calculate-total', asyncHandler(async (req: any, res: any) => {
//   const orderId = req.params.id;
//   const { ctx } = req;
  
//   if (!z.string().uuid().safeParse(orderId).success) {
//     return res.status(400).json({ error: 'Invalid order ID format' });
//   }
  
//   const result = await calculateOrderTotal(ctx, orderId);
//   res.json(result);
// }));

// // GET /api/v1/orders/workflow - Get order workflow steps
// router.get('/workflow', asyncHandler(async (req: any, res: any) => {
//   const { ctx } = req;
  
//   ctx.logger.info('Fetching order workflow');
  
//   const workflow = getOrderWorkflow();
//   res.json({ workflow });
// }));

// // POST /api/v1/orders/workflow/validate-transition - Validate status transition
// router.post('/workflow/validate-transition', asyncHandler(async (req: any, res: any) => {
//   const input = StatusTransitionSchema.parse(req.body);
//   const { ctx } = req;
  
//   ctx.logger.info('Validating status transition:', input);
  
//   const result = validateTransition(input.current_status, input.new_status);
//   res.json(result);
// }));

// // POST /api/v1/orders/workflow/calculate-totals - Calculate order totals with tax
// router.post('/workflow/calculate-totals', asyncHandler(async (req: any, res: any) => {
//   const input = CalculateTotalsSchema.parse(req.body);
//   const { ctx } = req;
  
//   ctx.logger.info('Calculating order totals:', input);
  
//   const validatedLines = input.lines.map(line => ({
//     quantity: line.quantity!,
//     unit_price: line.unit_price!,
//     subtotal: line.subtotal,
//   }));
  
//   const result = calculateOrderTotalWithTax(validatedLines, input.tax_percent || 0);
//   res.json(result);
// }));

// // POST /api/v1/orders/workflow/validate-for-confirmation - Validate order for confirmation
// router.post('/workflow/validate-for-confirmation', asyncHandler(async (req: any, res: any) => {
//   const { order } = req.body;
//   const { ctx } = req;
  
//   ctx.logger.info('Validating order for confirmation:', order.id);
  
//   const result = validateOrderForConfirmation(order);
//   res.json(result);
// }));

// // POST /api/v1/orders/workflow/validate-for-scheduling - Validate order for scheduling
// router.post('/workflow/validate-for-scheduling', asyncHandler(async (req: any, res: any) => {
//   const { order } = req.body;
//   const { ctx } = req;
  
//   ctx.logger.info('Validating order for scheduling:', order.id);
  
//   const result = validateOrderForScheduling(order);
//   res.json(result);
// }));

// // POST /api/v1/orders/workflow/validate-delivery-window - Validate order delivery window
// router.post('/workflow/validate-delivery-window', asyncHandler(async (req: any, res: any) => {
//   const { order } = req.body;
//   const { ctx } = req;
  
//   ctx.logger.info('Validating order delivery window:', order.id);
  
//   const result = validateOrderDeliveryWindow(order);
//   res.json(result);
// }));

// // GET /api/v1/orders/:id/workflow-info - Get workflow information for a specific order
// router.get('/:id/workflow-info', asyncHandler(async (req: any, res: any) => {
//   const orderId = req.params.id;
//   const { ctx } = req;
  
//   if (!z.string().uuid().safeParse(orderId).success) {
//     return res.status(400).json({ error: 'Invalid order ID format' });
//   }
  
//   ctx.logger.info('Getting workflow info for order:', orderId);
  
//   const { data: order, error } = await ctx.supabase
//     .from('orders')
//     .select('id, status')
//     .eq('id', orderId)
//     .single();

//   if (error) {
//     if (error.code === 'PGRST116') {
//       return res.status(404).json({ error: 'Order not found' });
//     }
//     return res.status(500).json({ error: error.message });
//   }

//   const currentStatus = order.status as OrderStatus;
//   const currentStep = getOrderStatusInfo(currentStatus);
//   const nextPossibleStatuses = getNextPossibleStatuses(currentStatus);
  
//   res.json({
//     currentStatus,
//     currentStep,
//     nextPossibleStatuses,
//     nextSteps: nextPossibleStatuses.map(status => getOrderStatusInfo(status)),
//     isEditable: isOrderEditable(currentStatus),
//     isCancellable: isOrderCancellable(currentStatus),
//     formattedOrderId: formatOrderId(order.id),
//     statusColor: getStatusColor(currentStatus),
//   });
// }));

// // POST /api/v1/orders/workflow/format-order-id - Format order ID for display
// router.post('/workflow/format-order-id', asyncHandler(async (req: any, res: any) => {
//   const { order_id } = z.object({ order_id: z.string().uuid() }).parse(req.body);
  
//   res.json({
//     formatted_id: formatOrderId(order_id),
//   });
// }));

// // POST /api/v1/orders/workflow/format-currency - Format currency amount
// router.post('/workflow/format-currency', asyncHandler(async (req: any, res: any) => {
//   const { amount } = z.object({ amount: z.number() }).parse(req.body);
  
//   res.json({
//     formatted_amount: formatCurrency(amount),
//   });
// }));

// // POST /api/v1/orders/workflow/format-date - Format date for display
// router.post('/workflow/format-date', asyncHandler(async (req: any, res: any) => {
//   const { date } = z.object({ date: z.string().datetime() }).parse(req.body);
  
//   res.json({
//     formatted_date: formatDate(date),
//   });
// }));

// // POST /api/v1/orders/validate-pricing - Validate order pricing before creation
// router.post('/validate-pricing', asyncHandler(async (req: any, res: any) => {
//   const input = OrderPricingValidationSchema.parse(req.body);
//   const { ctx } = req;
  
//   ctx.logger.info('Validating order pricing for customer:', input.customer_id);
  
//   const { data: customer, error: customerError } = await ctx.supabase
//     .from('customers')
//     .select('id, name, account_status')
//     .eq('id', input.customer_id)
//     .single();

//   if (customerError || !customer) {
//     return res.status(404).json({ error: 'Customer not found' });
//   }
  
//   const pricingService = new PricingService(ctx.supabase, ctx.logger);
//   const results: any[] = [];
//   const errors: string[] = [];
//   const warnings: string[] = [];
//   let totalAmount = 0;
  
//   for (let i = 0; i < input.order_lines.length; i++) {
//     const line = input.order_lines[i];
    
//     try {
//       const { data: product, error: productError } = await ctx.supabase
//         .from('products')
//         .select('id, sku, name, status')
//         .eq('id', line.product_id)
//         .single();
        
//       if (productError || !product) {
//         errors.push(`Product not found for line ${i + 1}`);
//         results.push({
//           product_id: line.product_id,
//           quantity: line.quantity,
//           is_valid: false,
//           error: 'Product not found'
//         });
//         continue;
//       }
      
//       if (product.status !== 'active') {
//         errors.push(`Product ${product.sku} is not active`);
//         results.push({
//           product_id: line.product_id,
//           product_sku: product.sku,
//           quantity: line.quantity,
//           is_valid: false,
//           error: 'Product is not active'
//         });
//         continue;
//       }
      
//       const currentPricing = await pricingService.getProductPrice(
//         line.product_id,
//         input.customer_id
//       );
      
//       if (!currentPricing) {
//         errors.push(`No pricing found for product ${product.sku}`);
//         results.push({
//           product_id: line.product_id,
//           product_sku: product.sku,
//           quantity: line.quantity,
//           is_valid: false,
//           error: 'No pricing found'
//         });
//         continue;
//       }
      
//       let isValid = true;
//       let lineErrors: string[] = [];
//       let lineWarnings: string[] = [];
      
//       if (line.expected_price) {
//         const priceTolerance = 0.01;
//         if (Math.abs(line.expected_price - currentPricing.finalPrice) > priceTolerance) {
//           isValid = false;
//           lineErrors.push(`Price mismatch: expected ${line.expected_price}, current ${currentPricing.finalPrice}`);
//         }
//       }
      
//       if (line.price_list_id && currentPricing.priceListId !== line.price_list_id) {
//         isValid = false;
//         lineErrors.push('Price list mismatch');
//       }
      
//       const { data: inventory } = await ctx.supabase
//         .from('inventory_balance')
//         .select('qty_full, qty_reserved')
//         .eq('product_id', line.product_id)
//         .single();
        
//       let availableStock = 0;
//       if (inventory) {
//         availableStock = inventory.qty_full - inventory.qty_reserved;
//         if (line.quantity > availableStock) {
//           isValid = false;
//           lineErrors.push(`Insufficient stock: requested ${line.quantity}, available ${availableStock}`);
//         } else if (line.quantity > availableStock * 0.8) {
//           lineWarnings.push('Large quantity request relative to available stock');
//         }
//       } else {
//         lineWarnings.push('No inventory information found');
//       }
      
//       const subtotal = currentPricing.finalPrice * line.quantity;
//       if (isValid) {
//         totalAmount += subtotal;
//       }
      
//       results.push({
//         product_id: line.product_id,
//         product_sku: product.sku,
//         product_name: product.name,
//         quantity: line.quantity,
//         current_price: currentPricing.finalPrice,
//         price_list_id: currentPricing.priceListId,
//         price_list_name: currentPricing.priceListName,
//         subtotal: subtotal,
//         available_stock: availableStock,
//         is_valid: isValid,
//         errors: lineErrors,
//         warnings: lineWarnings
//       });
      
//       if (lineErrors.length > 0) {
//         errors.push(...lineErrors.map(err => `${product.sku}: ${err}`));
//       }
//       if (lineWarnings.length > 0) {
//         warnings.push(...lineWarnings.map(warn => `${product.sku}: ${warn}`));
//       }
      
//     } catch (error) {
//       ctx.logger.error(`Error validating line ${i + 1}:`, error);
//       errors.push(`Error validating line ${i + 1}: ${formatErrorMessage(error)}`);
//       results.push({
//         product_id: line.product_id,
//         quantity: line.quantity,
//         is_valid: false,
//         error: 'Validation error'
//       });
//     }
//   }
  
//   const isOrderValid = errors.length === 0;
  
//   res.json({
//     is_valid: isOrderValid,
//     customer: {
//       id: customer.id,
//       name: customer.name,
//       account_status: customer.account_status
//     },
//     line_validations: results,
//     total_amount: totalAmount,
//     summary: {
//       total_lines: input.order_lines.length,
//       valid_lines: results.filter(r => r.is_valid).length,
//       invalid_lines: results.filter(r => !r.is_valid).length,
//       total_errors: errors.length,
//       total_warnings: warnings.length
//     },
//     errors,
//     warnings
//   });
// }));

// // POST /api/v1/orders/validate-truck-capacity - Validate truck capacity for order assignment
// router.post('/validate-truck-capacity', asyncHandler(async (req: any, res: any) => {
//   const input = TruckCapacityValidationSchema.parse(req.body);
//   const { ctx } = req;
  
//   ctx.logger.info('Validating truck capacity:', input);
  
//   const { data: truck, error: truckError } = await ctx.supabase
//     .from('trucks')
//     .select('id, name, capacity_kg, capacity_volume_m3')
//     .eq('id', input.truck_id)
//     .single();
    
//   if (truckError || !truck) {
//     return res.status(404).json({ error: 'Truck not found' });
//   }
  
//   const { data: capacityValidation, error: validationError } = await ctx.supabase
//     .rpc('validate_truck_capacity', {
//       p_truck_id: input.truck_id,
//       p_order_ids: input.order_ids
//     });
    
//   if (validationError) {
//     ctx.logger.error('Truck capacity validation error:', validationError);
//     return res.status(500).json({ error: 'Failed to validate truck capacity' });
//   }
  
//   const result = capacityValidation[0];
  
//   res.json({
//     truck: {
//       id: truck.id,
//       name: truck.name,
//       capacity_kg: truck.capacity_kg,
//       capacity_volume_m3: truck.capacity_volume_m3
//     },
//     validation: result,
//     recommendation: result.is_valid ? 
//       'Truck capacity is sufficient for the assigned orders' : 
//       'Truck capacity exceeded - consider reassigning some orders'
//   });
// }));

// // POST /api/v1/orders/:id/allocate-to-truck - Allocate order to truck
// router.post('/:id/allocate-to-truck', asyncHandler(async (req: any, res: any) => {
//   const orderId = req.params.id;
//   const input = TruckAllocationSchema.parse(req.body);
//   const { ctx } = req;
  
//   if (!z.string().uuid().safeParse(orderId).success) {
//     return res.status(400).json({ error: 'Invalid order ID format' });
//   }
  
//   ctx.logger.info('Allocating order to truck:', { orderId, ...input });
  
//   const { OrderAllocationService } = await import('../lib/order-allocation');
//   const allocationService = new OrderAllocationService(ctx.supabase, ctx.logger);
  
//   const allocationRequest = {
//     order_id: orderId,
//     truck_id: input.truck_id,
//     allocation_date: input.allocation_date,
//     force_allocation: input.force_allocation
//   };
//   const result = await allocationService.allocateOrder(allocationRequest, ctx.user.id);
  
//   res.json(result);
// }));

// // GET /api/v1/orders/:id/allocation-suggestions - Get truck allocation suggestions for order
// router.get('/:id/allocation-suggestions', asyncHandler(async (req: any, res: any) => {
//   const orderId = req.params.id;
//   const { allocation_date } = z.object({ allocation_date: z.string() }).parse(req.query);
//   const { ctx } = req;
  
//   if (!z.string().uuid().safeParse(orderId).success) {
//     return res.status(400).json({ error: 'Invalid order ID format' });
//   }
  
//   ctx.logger.info('Getting allocation suggestions for order:', orderId);
  
//   const { OrderAllocationService } = await import('../lib/order-allocation');
//   const allocationService = new OrderAllocationService(ctx.supabase, ctx.logger);
  
//   const suggestions = await allocationService.findBestTrucks(orderId, allocation_date);
//   const orderWeight = await allocationService.calculateOrderWeight(orderId);
  
//   res.json({
//     order_id: orderId,
//     order_weight_kg: orderWeight,
//     suggestions,
//   });
// }));

// // GET /api/v1/orders/:id/calculate-weight - Calculate order weight
// router.get('/:id/calculate-weight', asyncHandler(async (req: any, res: any) => {
//   const orderId = req.params.id;
//   const { ctx } = req;
  
//   if (!z.string().uuid().safeParse(orderId).success) {
//     return res.status(400).json({ error: 'Invalid order ID format' });
//   }
  
//   ctx.logger.info('Calculating order weight:', orderId);
  
//   const { OrderAllocationService } = await import('../lib/order-allocation');
//   const allocationService = new OrderAllocationService(ctx.supabase, ctx.logger);
  
//   const weight = await allocationService.calculateOrderWeight(orderId);
  
//   res.json({
//     order_id: orderId,
//     total_weight_kg: weight,
//   });
// }));

// // DELETE /api/v1/orders/allocations/:id - Remove truck allocation
// router.delete('/allocations/:id', asyncHandler(async (req: any, res: any) => {
//   const allocationId = req.params.id;
//   const { ctx } = req;
  
//   if (!z.string().uuid().safeParse(allocationId).success) {
//     return res.status(400).json({ error: 'Invalid allocation ID format' });
//   }
  
//   ctx.logger.info('Removing truck allocation:', allocationId);
  
//   const { OrderAllocationService } = await import('../lib/order-allocation');
//   const allocationService = new OrderAllocationService(ctx.supabase, ctx.logger);
  
//   await allocationService.removeAllocation(allocationId);
  
//   res.json({ success: true });
// }));

// // GET /api/v1/orders/schedule/:date - Get daily order schedule
// router.get('/schedule/:date', asyncHandler(async (req: any, res: any) => {
//   const date = req.params.date;
//   const { ctx } = req;
  
//   ctx.logger.info('Getting daily order schedule for:', date);
  
//   const { OrderAllocationService } = await import('../lib/order-allocation');
//   const allocationService = new OrderAllocationService(ctx.supabase, ctx.logger);
  
//   const schedule = await allocationService.getDailySchedule(date);
  
//   res.json({
//     date: date,
//     trucks: schedule,
//     summary: {
//       total_trucks: schedule.length,
//       active_trucks: schedule.filter(s => s.total_orders > 0).length,
//       total_orders: schedule.reduce((sum, s) => sum + s.total_orders, 0),
//       avg_utilization: schedule.length > 0 
//         ? schedule.reduce((sum, s) => sum + s.capacity_info.utilization_percentage, 0) / schedule.length 
//         : 0,
//     },
//   });
// }));

// // POST /api/v1/orders/:id/process-refill - Process refill order with stock movements
// router.post('/:id/process-refill', asyncHandler(async (req: any, res: any) => {
//   const orderId = req.params.id;
//   const { warehouse_id } = z.object({ warehouse_id: z.string().uuid().optional() }).parse(req.body);
//   const { ctx } = req;
  
//   if (!z.string().uuid().safeParse(orderId).success) {
//     return res.status(400).json({ error: 'Invalid order ID format' });
//   }
  
//   ctx.logger.info('Processing refill order:', orderId);
  
//   const { data: order, error: orderError } = await ctx.supabase
//     .from('orders')
//     .select('id, order_type, status')
//     .eq('id', orderId)
//     .single();

//   if (orderError || !order) {
//     return res.status(404).json({ error: 'Order not found' });
//   }

//   if (order.order_type !== 'refill' && order.order_type !== 'exchange') {
//     return res.status(400).json({ error: 'Order must be of type refill or exchange' });
//   }

//   if (order.status !== 'delivered') {
//     return res.status(400).json({ error: 'Order must be delivered before processing refill movements' });
//   }

//   const { data, error } = await ctx.supabase.rpc('process_refill_order', {
//     p_order_id: orderId
//   });

//   if (error) {
//     ctx.logger.error('Error processing refill order:', error);
//     return res.status(500).json({ error: 'Failed to process refill order stock movements' });
//   }

//   res.json({ 
//     success: true,
//     order_id: orderId,
//     message: 'Refill order processed successfully'
//   });
// }));

// // Global error handler
// router.use((error: any, req: any, res: any, next: any) => {
//   console.error('API Error:', error);
  
//   if (error.name === 'ZodError') {
//     return res.status(400).json({ 
//       error: 'Validation error', 
//       details: error.errors 
//     });
//   }
  
//   if (error.code === 'PGRST116') {
//     return res.status(404).json({ error: 'Resource not found' });
//   }
  
//   if (error.message) {
//     return res.status(500).json({ error: error.message });
//   }
  
//   res.status(500).json({ error: 'Internal server error' });
// });

// // Helper functions (same as in tRPC version)
// async function calculateOrderTotal(ctx: any, orderId: string) {
//   ctx.logger.info('Calculating order total for:', orderId);

//   const { data: lines, error: linesError } = await ctx.supabase
//     .from('order_lines')
//     .select('quantity, unit_price, subtotal')
//     .eq('order_id', orderId);

//   if (linesError) {
//     throw new Error(linesError.message);
//   }

//   const { data: order, error: orderError } = await ctx.supabase
//     .from('orders')
//     .select('tax_amount, tax_percent')
//     .eq('id', orderId)
//     .single();

//   if (orderError) {
//     throw new Error(orderError.message);
//   }

//   if (lines) {
//     const subtotal = lines.reduce((sum, line) => {
//       const lineSubtotal = line.subtotal || (line.quantity * line.unit_price);
//       return sum + lineSubtotal;
//     }, 0);
    
//     const taxAmount = order?.tax_amount || 0;
//     const grandTotal = subtotal + taxAmount;
    
//     const { error: updateError } = await ctx.supabase
//       .from('orders')
//       .update({ 
//         total_amount: grandTotal,
//         updated_at: new Date().toISOString(),
//       })
//       .eq('id', orderId);

//     if (updateError) {
//       throw new Error(updateError.message);
//     }

//     return {
//       subtotal,
//       tax_amount: taxAmount,
//       total_amount: grandTotal,
//       breakdown: lines.map(line => ({
//         quantity: line.quantity,
//         unit_price: line.unit_price,
//         subtotal: line.subtotal || (line.quantity * line.unit_price)
//       }))
//     };
//   }

//   throw new Error('No order lines found');
// }

// async function updateOrderTax(ctx: any, orderId: string, taxPercent: number) {
//   ctx.logger.info('Updating order tax:', { orderId, taxPercent });

//   const { data: lines, error: linesError } = await ctx.supabase
//     .from('order_lines')
//     .select('quantity, unit_price, subtotal')
//     .eq('order_id', orderId);

//   if (linesError) {
//     throw new Error(linesError.message);
//   }

//   if (lines) {
//     const subtotal = lines.reduce((sum, line) => {
//       const lineSubtotal = line.subtotal || (line.quantity * line.unit_price);
//       return sum + lineSubtotal;
//     }, 0);
    
//     const taxAmount = subtotal * (taxPercent / 100);
//     const grandTotal = subtotal + taxAmount;
    
//     const { error: updateError } = await ctx.supabase
//       .from('orders')
//       .update({ 
//         tax_percent: taxPercent,
//         tax_amount: taxAmount,
//         total_amount: grandTotal,
//         updated_at: new Date().toISOString(),
//       })
//       .eq('id', orderId);

//     if (updateError) {
//       throw new Error(updateError.message);
//     }

//     return {
//       subtotal,
//       tax_percent: taxPercent,
//       tax_amount: taxAmount,
//       total_amount: grandTotal
//     };
//   }

//   throw new Error('No order lines found');
// }

// async function getOrderById(ctx: any, orderId: string) {
//   const { data, error } = await ctx.supabase
//     .from('orders')
//     .select(`
//       *,
//       customer:customers(id, name, email, phone, account_status, credit_terms_days),
//       delivery_address:addresses(id, line1, line2, city, state, postal_code, country, instructions),
//       order_lines(
//         id,
//         product_id,
//         quantity,
//         unit_price,
//         subtotal,
//         product:products(id, sku, name, unit_of_measure)
//       )
//     `)
//     .eq('id', orderId)
//     .single();

//   if (error) {
//     throw new Error(error.message);
//   }

//   return data;
// }

// function calculateDeliveryWindow(order: any): string {
//   if (!order.scheduled_date) return 'Not scheduled';
  
//   const scheduledDate = new Date(order.scheduled_date);
//   const today = new Date();
//   const diffDays = Math.ceil((scheduledDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  
//   if (diffDays < 0) return 'Overdue';
//   if (diffDays === 0) return 'Today';
//   if (diffDays === 1) return 'Tomorrow';
//   if (diffDays <= 7) return `${diffDays} days`;
//   if (diffDays <= 30) return `${Math.ceil(diffDays / 7)} weeks`;
//   return `${Math.ceil(diffDays / 30)} months`;
// }

// function calculateOrderRisk(order: any): 'low' | 'medium' | 'high' {
//   let riskScore = 0;
  
//   if ((order.total_amount || 0) > 5000) riskScore += 2;
//   else if ((order.total_amount || 0) > 1000) riskScore += 1;
  
//   if (order.customer?.account_status === 'credit_hold') riskScore += 3;
//   else if (order.customer?.account_status === 'closed') riskScore += 2;
  
//   if (order.scheduled_date && new Date(order.scheduled_date) < new Date()) riskScore += 2;
  
//   if ((order.order_lines?.length || 0) > 5) riskScore += 1;
  
//   if (riskScore >= 4) return 'high';
//   if (riskScore >= 2) return 'medium';
//   return 'low';
// }

// async function generateOrderAnalytics(orders: any[]): Promise<any> {
//   const analytics = {
//     total_orders: orders.length,
//     total_value: orders.reduce((sum, order) => sum + (order.total_amount || 0), 0),
//     average_order_value: 0,
//     status_breakdown: {} as Record<string, number>,
//     high_value_orders: orders.filter(order => order.is_high_value).length,
//     overdue_orders: orders.filter(order => order.estimated_delivery_window === 'Overdue').length,
//     risk_breakdown: {
//       low: orders.filter(order => order.risk_level === 'low').length,
//       medium: orders.filter(order => order.risk_level === 'medium').length,
//       high: orders.filter(order => order.risk_level === 'high').length,
//     }
//   };
  
//   analytics.average_order_value = analytics.total_orders > 0 ? analytics.total_value / analytics.total_orders : 0;
  
//   orders.forEach(order => {
//     analytics.status_breakdown[order.status] = (analytics.status_breakdown[order.status] || 0) + 1;
//   });
  
//   return analytics;
// }

// function calculateUrgencyScore(order: any): number {
//   let score = 5;
  
//   const daysOverdue = Math.floor((new Date().getTime() - new Date(order.scheduled_date).getTime()) / (1000 * 60 * 60 * 24));
//   score += Math.min(daysOverdue, 5);
  
//   if ((order.total_amount || 0) > 5000) score += 3;
//   else if ((order.total_amount || 0) > 1000) score += 1;
  
//   if (order.customer?.account_status === 'credit_hold') score += 2;
  
//   const priorityScores = { low: 0, normal: 0, high: 2, urgent: 4 };
//   score += priorityScores[order.priority as keyof typeof priorityScores] || 0;
  
//   return Math.min(score, 10);
// }

// function calculateOrderWeight(order: any): number {
//   if (!order.order_lines) return 0;
  
//   return order.order_lines.reduce((total: number, line: any) => {
//     const productWeight = line.product?.weight || 0;
//     return total + (productWeight * line.quantity);
//   }, 0);
// }

// function calculateOrderVolume(order: any): number {
//   if (!order.order_lines) return 0;
  
//   return order.order_lines.reduce((total: number, line: any) => {
//     const productVolume = line.product?.volume || 0;
//     return total + (productVolume * line.quantity);
//   }, 0);
// }

// function calculateServiceTime(order: any): number {
//   let serviceTime = 15;
//   serviceTime += (order.order_lines?.length || 0) * 5;
//   if (order.delivery_address?.instructions) serviceTime += 10;
  
//   const orderWeight = calculateOrderWeight(order);
//   if (orderWeight > 100) serviceTime += 15;
//   else if (orderWeight > 50) serviceTime += 10;
  
//   return serviceTime;
// }

// function calculateRouteTime(orders: any[]): number {
//   if (orders.length === 0) return 0;
  
//   const travelTime = Math.max(0, orders.length - 1) * 20;
//   const serviceTime = orders.reduce((total, order) => total + calculateServiceTime(order), 0);
  
//   return travelTime + serviceTime;
// }

// function calculateTruckRequirements(totalWeight: number, totalVolume: number): any {
//   const truckTypes = [
//     { name: 'Small Van', max_weight: 1000, max_volume: 10, cost_per_hour: 50 },
//     { name: 'Medium Truck', max_weight: 3000, max_volume: 25, cost_per_hour: 75 },
//     { name: 'Large Truck', max_weight: 8000, max_volume: 50, cost_per_hour: 100 },
//   ];
  
//   const requiredTruck = truckTypes.find(truck => 
//     truck.max_weight >= totalWeight && truck.max_volume >= totalVolume
//   ) || truckTypes[truckTypes.length - 1];
  
//   return {
//     recommended_truck: requiredTruck.name,
//     utilization: {
//       weight_percent: Math.min(100, (totalWeight / requiredTruck.max_weight) * 100),
//       volume_percent: Math.min(100, (totalVolume / requiredTruck.max_volume) * 100),
//     },
//     multiple_trucks_needed: totalWeight > requiredTruck.max_weight || totalVolume > requiredTruck.max_volume,
//   };
// }

// function calculateOrderPaymentSummary(order: any): any {
//   const orderTotal = order.total_amount || 0;
//   const payments = order.payments || [];
  
//   const completedPayments = payments.filter((p: any) => p.payment_status === 'completed');
//   const pendingPayments = payments.filter((p: any) => p.payment_status === 'pending');
//   const failedPayments = payments.filter((p: any) => p.payment_status === 'failed');
  
//   const totalPaid = completedPayments.reduce((sum: number, payment: any) => sum + (payment.amount || 0), 0);
//   const totalPending = pendingPayments.reduce((sum: number, payment: any) => sum + (payment.amount || 0), 0);
//   const totalFailed = failedPayments.reduce((sum: number, payment: any) => sum + (payment.amount || 0), 0);
  
//   const balance = orderTotal - totalPaid;
  
//   let status = 'pending';
//   if (balance <= 0) {
//     status = 'paid';
//   } else if (totalPaid > 0) {
//     status = 'partial';
//   } else if (order.payment_due_date && new Date(order.payment_due_date) < new Date()) {
//     status = 'overdue';
//   }
  
//   const paymentMethods = completedPayments.reduce((acc: any, payment: any) => {
//     const method = payment.payment_method || 'unknown';
//     acc[method] = (acc[method] || 0) + (payment.amount || 0);
//     return acc;
//   }, {});
  
//   return {
//     order_total: orderTotal,
//     total_paid: totalPaid,
//     total_pending: totalPending,
//     total_failed: totalFailed,
//     balance: balance,
//     status: status,
//     payment_count: payments.length,
//     completed_payment_count: completedPayments.length,
//     last_payment_date: completedPayments.length > 0 
//       ? completedPayments.sort((a: any, b: any) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime())[0].payment_date
//       : null,
//     payment_methods: paymentMethods,
//     is_overdue: status === 'overdue',
//     days_overdue: order.payment_due_date && new Date(order.payment_due_date) < new Date()
//       ? Math.floor((new Date().getTime() - new Date(order.payment_due_date).getTime()) / (1000 * 60 * 60 * 24))
//       : 0,
//   };
// }

// export default router;