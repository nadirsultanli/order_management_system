import { z } from 'zod';
import { router, protectedProcedure } from '../lib/trpc';
import { requireAuth } from '../lib/auth';
import { TRPCError } from '@trpc/server';
import axios from 'axios';

// Zod schemas for input validation
const CustomerFiltersSchema = z.object({
  search: z.string().optional(),
  account_status: z.enum(['active', 'credit_hold', 'closed']).optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(1000).default(50),
});

const CreateCustomerSchema = z.object({
  external_id: z.string().optional(),
  name: z.string().min(1, 'Name is required'),
  tax_id: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  account_status: z.enum(['active', 'credit_hold', 'closed']).default('active'),
  credit_terms_days: z.number().int().min(0).default(30),
  address: z.object({
    label: z.string().optional(),
    line1: z.string().min(1, 'Address line 1 is required'),
    line2: z.string().optional(),
    city: z.string().min(1, 'City is required'),
    state: z.string().optional(),
    postal_code: z.string().optional(),
    country: z.string().min(2, 'Country is required'),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    delivery_window_start: z.string().optional(),
    delivery_window_end: z.string().optional(),
    instructions: z.string().optional(),
  }),
});

const UpdateCustomerSchema = z.object({
  id: z.string().uuid(),
  external_id: z.string().optional(),
  name: z.string().min(1).optional(),
  tax_id: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  account_status: z.enum(['active', 'credit_hold', 'closed']).optional(),
  credit_terms_days: z.number().int().min(0).optional(),
  address: z.object({
    label: z.string().optional(),
    line1: z.string().min(1).optional(),
    line2: z.string().optional(),
    city: z.string().min(1).optional(),
    state: z.string().optional(),
    postal_code: z.string().optional(),
    country: z.string().min(2).optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    delivery_window_start: z.string().optional(),
    delivery_window_end: z.string().optional(),
    instructions: z.string().optional(),
  }).optional(),
});

const AddressSchema = z.object({
  customer_id: z.string().uuid(),
  label: z.string().optional(),
  line1: z.string().min(1, 'Address line 1 is required'),
  line2: z.string().optional(),
  city: z.string().min(1, 'City is required'),
  state: z.string().optional(),
  postal_code: z.string().optional(),
  country: z.string().min(2, 'Country is required'),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  delivery_window_start: z.string().optional(),
  delivery_window_end: z.string().optional(),
  is_primary: z.boolean().default(false),
  instructions: z.string().optional(),
});

export const customersRouter = router({
  // GET /customers - List customers with filtering and pagination
  list: protectedProcedure
    .input(CustomerFiltersSchema)
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Fetching customers with filters:', input);
      
      // Build base query for customers with primary addresses
      let queryWithAddress = ctx.supabase
        .from('customers')
        .select(`
          *,
          primary_address:addresses!inner(
            id,
            line1,
            line2,
            city,
            state,
            postal_code,
            country,
            label,
            latitude,
            longitude,
            delivery_window_start,
            delivery_window_end,
            is_primary,
            instructions,
            created_at
          )
        `, { count: 'exact' })
        
        .eq('addresses.is_primary', true)
        .order('created_at', { ascending: false });

      // Apply search filter
      if (input.search) {
        queryWithAddress = queryWithAddress.or(
          `name.ilike.%${input.search}%,email.ilike.%${input.search}%,tax_id.ilike.%${input.search}%`
        );
      }

      // Apply status filter
      if (input.account_status) {
        queryWithAddress = queryWithAddress.eq('account_status', input.account_status);
      }

      // Apply pagination
      const from = (input.page - 1) * input.limit;
      const to = from + input.limit - 1;
      queryWithAddress = queryWithAddress.range(from, to);

      const { data: customersWithAddress, error: errorWithAddress, count: countWithAddress } = await queryWithAddress;

      if (errorWithAddress) {
        ctx.logger.error('Supabase customers error (with address):', errorWithAddress);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: errorWithAddress.message
        });
      }

      // Get customers without primary addresses
      let queryWithoutAddress = ctx.supabase
        .from('customers')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

      // Exclude customers that already have primary addresses
      if (customersWithAddress && customersWithAddress.length > 0) {
        const customerIdsWithAddress = customersWithAddress.map(c => c.id).filter(id => id);
        if (customerIdsWithAddress.length > 0) {
          queryWithoutAddress = queryWithoutAddress.not('id', 'in', `(${customerIdsWithAddress.join(',')})`);
        }
      }

      // Apply same filters to customers without addresses
      if (input.search) {
        queryWithoutAddress = queryWithoutAddress.or(
          `name.ilike.%${input.search}%,email.ilike.%${input.search}%,tax_id.ilike.%${input.search}%`
        );
      }

      if (input.account_status) {
        queryWithoutAddress = queryWithoutAddress.eq('account_status', input.account_status);
      }

      const { data: customersWithoutAddress, error: errorWithoutAddress, count: countWithoutAddress } = await queryWithoutAddress;

      if (errorWithoutAddress) {
        ctx.logger.warn('Supabase customers error (without address):', errorWithoutAddress);
        // Don't throw error here, just log it and continue
      }

      // Combine results
      const allCustomers = [
        ...(customersWithAddress || []),
        ...(customersWithoutAddress || []).map(c => ({ ...c, primary_address: null }))
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      const totalCount = (countWithAddress || 0) + (countWithoutAddress || 0);

      return {
        customers: allCustomers,
        totalCount,
        totalPages: Math.ceil(totalCount / input.limit),
        currentPage: input.page,
      };
    }),

  // GET /customers/{id} - Get single customer by ID
  getById: protectedProcedure
    .input(z.object({
      customer_id: z.string().uuid(),
    }))
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Fetching customer:', input.customer_id);
      
      // First, try to get customer with primary address
      const { data, error } = await ctx.supabase
        .from('customers')
        .select(`
          *,
          primary_address:addresses!left(
            id,
            line1,
            line2,
            city,
            state,
            postal_code,
            country,
            label,
            latitude,
            longitude,
            delivery_window_start,
            delivery_window_end,
            is_primary,
            instructions,
            created_at
          )
        `)
        .eq('id', input.customer_id)
        .eq('addresses.is_primary', true)
        .maybeSingle();

      if (error) {
        ctx.logger.error('Customer fetch error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message
        });
      }

      // If customer found with primary address, return it
      if (data) {
        return data;
      }

      // If no customer found with primary address, try without address constraint
      const { data: customerOnly, error: customerOnlyError } = await ctx.supabase
        .from('customers')
        .select('*')
        .eq('id', input.customer_id)
        .single();

      if (customerOnlyError) {
        if (customerOnlyError.code === 'PGRST116') {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Customer not found'
          });
        }
        ctx.logger.error('Customer-only fetch error:', customerOnlyError);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: customerOnlyError.message
        });
      }

      // Return customer without primary address
      return { ...customerOnly, primary_address: null };
    }),

  // POST /customers - Create new customer with address
  create: protectedProcedure
    .input(CreateCustomerSchema)
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Creating customer with address:', input);
      
      const { address, ...customerFields } = input;
      
      // Use provided latitude/longitude if available, otherwise geocode
      let latitude = address.latitude;
      let longitude = address.longitude;
      
      if (!latitude || !longitude) {
        try {
          const geocodeResult = await geocodeAddress({
            line1: address.line1,
            line2: address.line2,
            city: address.city,
            state: address.state,
            postal_code: address.postal_code,
            country: address.country,
          });
          if (geocodeResult) {
            latitude = geocodeResult.latitude;
            longitude = geocodeResult.longitude;
          }
        } catch (err) {
          ctx.logger.warn('Geocoding failed, proceeding without coordinates:', err);
        }
      }
      
      // Call the RPC for atomic customer + address creation
      const { data, error } = await ctx.supabase.rpc('create_customer_with_address', {
        p_name: customerFields.name,
        p_external_id: customerFields.external_id,
        p_tax_id: customerFields.tax_id,
        p_phone: customerFields.phone,
        p_email: customerFields.email,
        p_account_status: customerFields.account_status,
        p_credit_terms_days: customerFields.credit_terms_days,
        p_label: address.label,
        p_line1: address.line1,
        p_line2: address.line2,
        p_city: address.city,
        p_state: address.state,
        p_postal_code: address.postal_code,
        p_country: address.country,
        p_latitude: latitude,
        p_longitude: longitude,
        p_delivery_window_start: address.delivery_window_start,
        p_delivery_window_end: address.delivery_window_end,
        p_is_primary: true,
        p_instructions: address.instructions,
        p_created_by: user.id,
      });
      
      if (error) {
        ctx.logger.error('Create customer+address RPC error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message
        });
      }
      
      ctx.logger.info('Customer and address created successfully:', data?.[0]);
      return data?.[0];
    }),

  // PUT /customers/{id} - Update customer
  update: protectedProcedure
    .input(UpdateCustomerSchema)
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Updating customer:', input.id);
      
      const { id, address, ...updateData } = input;
      
      // Update customer fields
      const { data: customerData, error: customerError } = await ctx.supabase
        .from('customers')
        .update({ 
          ...updateData, 
          updated_at: new Date().toISOString(),
          updated_by: user.id,
        })
        .eq('id', id)
        .select()
        .single();

      if (customerError) {
        if (customerError.code === 'PGRST116') {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Customer not found'
          });
        }
        ctx.logger.error('Update customer error:', customerError);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: customerError.message
        });
      }

      // Update address if provided
      if (address) {
        ctx.logger.info('Updating customer address');
        
        // Get the primary address ID for this customer
        const { data: addressData, error: addressFetchError } = await ctx.supabase
          .from('addresses')
          .select('id')
          .eq('customer_id', id)
          .eq('is_primary', true)
          .single();

        if (addressFetchError) {
          ctx.logger.error('Error fetching primary address:', addressFetchError);
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Primary address not found for customer'
          });
        }

        // Update the address with the new data
        const { error: addressUpdateError } = await ctx.supabase
          .from('addresses')
          .update({
            ...address,
            updated_at: new Date().toISOString(),
            updated_by: user.id,
          })
          .eq('id', addressData.id)
          ;

        if (addressUpdateError) {
          ctx.logger.error('Update address error:', addressUpdateError);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: addressUpdateError.message
          });
        }
      }

      ctx.logger.info('Customer updated successfully:', customerData);
      return customerData;
    }),

  // DELETE /customers/{id} - Delete customer
  delete: protectedProcedure
    .input(z.object({
      customer_id: z.string().uuid(),
    }))
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Deleting customer:', input.customer_id);
      
      const { error } = await ctx.supabase
        .from('customers')
        .delete()
        .eq('id', input.customer_id);

      if (error) {
        ctx.logger.error('Delete customer error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message
        });
      }

      ctx.logger.info('Customer deleted successfully:', input.customer_id);
      return { success: true };
    }),

  // GET /customers/{id}/orders - Get customer order history
  getOrderHistory: protectedProcedure
    .input(z.object({
      customer_id: z.string().uuid(),
      limit: z.number().min(1).max(1000).default(50),
      offset: z.number().min(0).default(0),
      status: z.enum(['draft', 'confirmed', 'scheduled', 'en_route', 'delivered', 'invoiced', 'cancelled']).optional(),
    }))
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Fetching customer order history:', input);
      
      const { data: customer, error: customerError } = await ctx.supabase
        .from('customers')
        .select('id')
        .eq('id', input.customer_id)
        .single();

      if (customerError || !customer) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Customer not found'
        });
      }
      
      let query = ctx.supabase
        .from('orders')
        .select(`
          *,
          customer:customers(id, name, email, phone),
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
        .eq('customer_id', input.customer_id)
        .order('created_at', { ascending: false });

      // Apply status filter
      if (input.status) {
        query = query.eq('status', input.status);
      }

      // Apply pagination
      query = query.range(input.offset, input.offset + input.limit - 1);

      const { data, error, count } = await query;

      if (error) {
        ctx.logger.error('Customer order history error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message
        });
      }

      return {
        orders: data || [],
        totalCount: count || 0,
        hasMore: (count || 0) > input.offset + input.limit,
      };
    }),

  // GET /customers/{id}/analytics - Get customer analytics
  getAnalytics: protectedProcedure
    .input(z.object({
      customer_id: z.string().uuid(),
      period: z.enum(['month', 'quarter', 'year']).default('year'),
    }))
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Fetching customer analytics:', input);
      
      const { data: customer, error: customerError } = await ctx.supabase
        .from('customers')
        .select('id, name, created_at')
        .eq('id', input.customer_id)
        .single();

      if (customerError || !customer) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Customer not found'
        });
      }
      
      const periodDays = {
        month: 30,
        quarter: 90,
        year: 365,
      }[input.period];
      
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - periodDays);
      
      // Get order statistics
      const { data: orderStats, error: orderStatsError } = await ctx.supabase
        .from('orders')
        .select('status, total_amount, order_date')
        .eq('customer_id', input.customer_id)
        .gte('order_date', startDate.toISOString());

      if (orderStatsError) {
        ctx.logger.error('Customer order stats error:', orderStatsError);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: orderStatsError.message
        });
      }

      const totalOrders = orderStats?.length || 0;
      const totalRevenue = orderStats?.reduce((sum, order) => sum + (order.total_amount || 0), 0) || 0;
      const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
      
      const statusCounts = orderStats?.reduce((acc, order) => {
        acc[order.status] = (acc[order.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      // Get recent orders
      const { data: recentOrders, error: recentOrdersError } = await ctx.supabase
        .from('orders')
        .select('id, status, total_amount, order_date')
        .eq('customer_id', input.customer_id)
        .order('order_date', { ascending: false })
        .limit(5);

      if (recentOrdersError) {
        ctx.logger.error('Customer recent orders error:', recentOrdersError);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: recentOrdersError.message
        });
      }

      return {
        customer: {
          id: customer.id,
          name: customer.name,
          created_at: customer.created_at,
        },
        period: input.period,
        analytics: {
          totalOrders,
          totalRevenue,
          avgOrderValue,
          statusCounts,
        },
        recentOrders: recentOrders || [],
      };
    }),

  // POST /customers/validate - Validate customer data
  validate: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      external_id: z.string().optional(),
      tax_id: z.string().optional(),
      exclude_id: z.string().uuid().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Validating customer data:', input);
      
      const errors: string[] = [];
      const warnings: string[] = [];
      
      // Check for duplicate email
      if (input.email) {
        let emailQuery = ctx.supabase
          .from('customers')
          .select('id, name')
          .eq('email', input.email);
        
        if (input.exclude_id) {
          emailQuery = emailQuery.neq('id', input.exclude_id);
        }
        
        const { data: existingByEmail } = await emailQuery.single();
        
        if (existingByEmail) {
          errors.push(`A customer with email "${input.email}" already exists: ${existingByEmail.name}`);
        }
      }
      
      // Check for duplicate external_id
      if (input.external_id) {
        let externalIdQuery = ctx.supabase
          .from('customers')
          .select('id, name')
          .eq('external_id', input.external_id);
        
        if (input.exclude_id) {
          externalIdQuery = externalIdQuery.neq('id', input.exclude_id);
        }
        
        const { data: existingByExternalId } = await externalIdQuery.single();
        
        if (existingByExternalId) {
          errors.push(`A customer with external ID "${input.external_id}" already exists: ${existingByExternalId.name}`);
        }
      }
      
      // Check for duplicate tax_id
      if (input.tax_id) {
        let taxIdQuery = ctx.supabase
          .from('customers')
          .select('id, name')
          .eq('tax_id', input.tax_id);
        
        if (input.exclude_id) {
          taxIdQuery = taxIdQuery.neq('id', input.exclude_id);
        }
        
        const { data: existingByTaxId } = await taxIdQuery.single();
        
        if (existingByTaxId) {
          warnings.push(`A customer with tax ID "${input.tax_id}" already exists: ${existingByTaxId.name}`);
        }
      }
      
      return {
        valid: errors.length === 0,
        errors,
        warnings,
      };
    }),

  // POST /customers/validate-credit-terms - Validate credit terms business rules
  validateCreditTerms: protectedProcedure
    .input(z.object({
      credit_terms_days: z.number(),
      account_status: z.enum(['active', 'credit_hold', 'closed']),
      customer_id: z.string().uuid().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      const errors: string[] = [];
      const warnings: string[] = [];

      // Business rule: Credit terms validation
      if (input.credit_terms_days < 0) {
        errors.push('Credit terms cannot be negative');
      }
      
      if (input.credit_terms_days > 365) {
        errors.push('Credit terms cannot exceed 365 days');
      }

      // Business rule: Credit terms vs account status consistency
      if (input.account_status === 'credit_hold' && input.credit_terms_days > 0) {
        warnings.push('Customer is on credit hold but has credit terms - orders may be blocked');
      }

      if (input.account_status === 'closed' && input.credit_terms_days > 0) {
        warnings.push('Customer account is closed but has credit terms - no new orders allowed');
      }

      // Business rule: Extended credit terms warning
      if (input.credit_terms_days > 90) {
        warnings.push('Extended credit terms (>90 days) may require management approval');
      }

      // Business rule: Check customer payment history if updating existing customer
      if (input.customer_id) {
        const { data: overdueOrders } = await ctx.supabase
          .from('orders')
          .select('id, total_amount, order_date')
          .eq('customer_id', input.customer_id)
          .eq('status', 'invoiced')
          .lt('order_date', new Date(Date.now() - input.credit_terms_days * 24 * 60 * 60 * 1000).toISOString());

        if (overdueOrders && overdueOrders.length > 0) {
          const overdueAmount = overdueOrders.reduce((sum, order) => sum + (order.total_amount || 0), 0);
          warnings.push(`Customer has ${overdueOrders.length} overdue orders totaling ${overdueAmount.toFixed(2)}`);
        }
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
      };
    }),

  // Address management endpoints
  
  // GET /customers/{id}/addresses - Get all addresses for a customer
  getAddresses: protectedProcedure
    .input(z.object({
      customer_id: z.string().uuid(),
    }))
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Fetching addresses for customer:', input.customer_id);
      
      const { data: customer, error: customerError } = await ctx.supabase
        .from('customers')
        .select('id')
        .eq('id', input.customer_id)
        .single();

      if (customerError || !customer) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Customer not found'
        });
      }
      
      const { data, error } = await ctx.supabase
        .from('addresses')
        .select('*')
        .eq('customer_id', input.customer_id)
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: true });

      if (error) {
        ctx.logger.error('Fetch addresses error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message
        });
      }

      return data || [];
    }),

  // POST /customers/{id}/addresses - Create new address
  createAddress: protectedProcedure
    .input(AddressSchema)
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Creating address:', input);
      
      const { data: customer, error: customerError } = await ctx.supabase
        .from('customers')
        .select('id')
        .eq('id', input.customer_id)
        .single();

      if (customerError || !customer) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Customer not found'
        });
      }
      
      // If setting as primary, first unset other primary addresses for this customer
      if (input.is_primary) {
        await ctx.supabase
          .from('addresses')
          .update({ is_primary: false })
          .eq('customer_id', input.customer_id)
          .eq('is_primary', true);
      }

      // Geocode if coordinates not provided
      let latitude = input.latitude;
      let longitude = input.longitude;
      
      if (!latitude || !longitude) {
        try {
          if (input.line1 && input.city && input.country) {
            const geocodeResult = await geocodeAddress({
              line1: input.line1,
              line2: input.line2,
              city: input.city,
              state: input.state,
              postal_code: input.postal_code,
              country: input.country
            });
            if (geocodeResult) {
              latitude = geocodeResult.latitude;
              longitude = geocodeResult.longitude;
            }
          }
        } catch (err) {
          ctx.logger.warn('Geocoding failed for new address:', err);
        }
      }

      const { data, error } = await ctx.supabase
        .from('addresses')
        .insert([{
          ...input,
          latitude,
          longitude,
          created_by: user.id,
        }])
        .select()
        .single();

      if (error) {
        ctx.logger.error('Create address error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message
        });
      }

      ctx.logger.info('Address created successfully:', data);
      return data;
    }),

  // PUT /addresses/{id} - Update address
  updateAddress: protectedProcedure
    .input(z.object({
      address_id: z.string().uuid(),
      customer_id: z.string().uuid(),
      label: z.string().optional(),
      line1: z.string().min(1).optional(),
      line2: z.string().optional(),
      city: z.string().min(1).optional(),
      state: z.string().optional(),
      postal_code: z.string().optional(),
      country: z.string().min(2).optional(),
      latitude: z.number().optional(),
      longitude: z.number().optional(),
      delivery_window_start: z.string().optional(),
      delivery_window_end: z.string().optional(),
      is_primary: z.boolean().optional(),
      instructions: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Updating address:', input.address_id);
      
      const { address_id, customer_id, ...updateData } = input;
      
      const { data: address, error: addressError } = await ctx.supabase
        .from('addresses')
        .select('customer_id')
        .eq('id', address_id)
        .single();

      if (addressError || !address) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Address not found'
        });
      }
      
      // If setting as primary, first unset other primary addresses for this customer
      if (updateData.is_primary && customer_id) {
        await ctx.supabase
          .from('addresses')
          .update({ is_primary: false })
          .eq('customer_id', customer_id)
          .eq('is_primary', true)
          .neq('id', address_id);
      }

      const { data, error } = await ctx.supabase
        .from('addresses')
        .update({
          ...updateData,
          updated_at: new Date().toISOString(),
          updated_by: user.id,
        })
        .eq('id', address_id)
        .select()
        .single();

      if (error) {
        ctx.logger.error('Update address error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message
        });
      }

      ctx.logger.info('Address updated successfully:', data);
      return data;
    }),

  // DELETE /addresses/{id} - Delete address
  deleteAddress: protectedProcedure
    .input(z.object({
      address_id: z.string().uuid(),
    }))
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Deleting address:', input.address_id);
      
      const { error } = await ctx.supabase
        .from('addresses')
        .delete()
        .eq('id', input.address_id);

      if (error) {
        ctx.logger.error('Delete address error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message
        });
      }

      ctx.logger.info('Address deleted successfully:', input.address_id);
      return { success: true };
    }),

  // POST /addresses/{id}/set-primary - Set address as primary
  setPrimaryAddress: protectedProcedure
    .input(z.object({
      address_id: z.string().uuid(),
      customer_id: z.string().uuid(),
    }))
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Setting primary address:', input);
      
      const { data: address, error: addressError } = await ctx.supabase
        .from('addresses')
        .select('id, customer_id')
        .eq('id', input.address_id)
        .eq('customer_id', input.customer_id)
        .single();

      if (addressError || !address) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Address not found'
        });
      }
      
      // First unset all primary addresses for this customer
      await ctx.supabase
        .from('addresses')
        .update({ is_primary: false })
        .eq('customer_id', input.customer_id)
        .eq('is_primary', true);

      // Then set this address as primary
      const { data, error } = await ctx.supabase
        .from('addresses')
        .update({ 
          is_primary: true,
          updated_at: new Date().toISOString(),
          updated_by: user.id,
        })
        .eq('id', input.address_id)
        .select()
        .single();

      if (error) {
        ctx.logger.error('Set primary address error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message
        });
      }

      ctx.logger.info('Primary address set successfully:', data);
      return data;
    }),

  // POST /addresses/geocode - Geocode address
  geocodeAddress: protectedProcedure
    .input(z.object({
      line1: z.string().min(1),
      line2: z.string().optional(),
      city: z.string().min(1),
      state: z.string().optional(),
      country: z.string().min(2),
      postal_code: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Geocoding address:', input);
      
      try {
        if (!input.line1 || !input.city || !input.country) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Address must include line1, city, and country'
          });
        }
        
        const result = await geocodeAddress({
          line1: input.line1,
          line2: input.line2,
          city: input.city,
          state: input.state,
          postal_code: input.postal_code,
          country: input.country
        });
        
        if (!result) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Could not geocode the provided address'
          });
        }
        
        ctx.logger.info('Address geocoded successfully:', result);
        return result;
      } catch (error) {
        // If it's already a TRPCError, re-throw it
        if (error instanceof TRPCError) {
          throw error;
        }
        
        ctx.logger.error('Geocoding error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to geocode address'
        });
      }
    }),

  // POST /addresses/validate - Validate address
  validateAddress: protectedProcedure
    .input(z.object({
      line1: z.string().min(1),
      line2: z.string().optional(),
      city: z.string().min(1),
      state: z.string().optional(),
      country: z.string().min(2),
      postal_code: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Validating address:', input);
      
      const errors: string[] = [];
      const warnings: string[] = [];
      
      // Basic validation
      if (!input.line1.trim()) {
        errors.push('Address line 1 is required');
      }
      
      if (!input.city.trim()) {
        errors.push('City is required');
      }
      
      if (!input.country.trim() || input.country.length < 2) {
        errors.push('Valid country is required');
      }
      
      // Try to geocode to validate address exists
      let geocodeResult = null;
      try {
        if (input.line1 && input.city && input.country) {
          geocodeResult = await geocodeAddress({
            line1: input.line1,
            line2: input.line2,
            city: input.city,
            state: input.state,
            postal_code: input.postal_code,
            country: input.country
          });
        }
        if (!geocodeResult) {
          warnings.push('Address could not be verified through geocoding');
        }
      } catch (error) {
        warnings.push('Address geocoding failed - address may not be valid');
      }
      
      return {
        valid: errors.length === 0,
        errors,
        warnings,
        geocode_result: geocodeResult,
      };
    }),

  // POST /addresses/validate-delivery-window - Validate delivery window business rules
  validateDeliveryWindow: protectedProcedure
    .input(z.object({
      delivery_window_start: z.string().optional(),
      delivery_window_end: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      const errors: string[] = [];
      const warnings: string[] = [];

      // Business rule: Both start and end must be provided together
      if ((input.delivery_window_start && !input.delivery_window_end) || 
          (!input.delivery_window_start && input.delivery_window_end)) {
        errors.push('Both delivery window start and end times must be provided');
        return { valid: false, errors, warnings };
      }

      if (input.delivery_window_start && input.delivery_window_end) {
        // Business rule: Validate time format (HH:MM)
        const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
        
        if (!timeRegex.test(input.delivery_window_start)) {
          errors.push('Delivery window start time must be in HH:MM format');
        }
        
        if (!timeRegex.test(input.delivery_window_end)) {
          errors.push('Delivery window end time must be in HH:MM format');
        }

        if (errors.length === 0) {
          // Business rule: End time must be after start time
          const startTime = new Date(`1970-01-01T${input.delivery_window_start}:00`);
          const endTime = new Date(`1970-01-01T${input.delivery_window_end}:00`);
          
          if (endTime <= startTime) {
            errors.push('Delivery window end time must be after start time');
          }

          // Business rule: Minimum delivery window
          const diffMinutes = (endTime.getTime() - startTime.getTime()) / (1000 * 60);
          if (diffMinutes < 60) {
            warnings.push('Delivery window is less than 1 hour - may be difficult to schedule');
          }

          // Business rule: Maximum delivery window
          if (diffMinutes > 12 * 60) {
            warnings.push('Delivery window exceeds 12 hours - consider splitting into multiple windows');
          }

          // Business rule: Business hours validation
          const startHour = startTime.getHours();
          const endHour = endTime.getHours();
          
          if (startHour < 6 || endHour > 22) {
            warnings.push('Delivery window outside typical business hours (6:00-22:00) may incur additional charges');
          }

          // Business rule: Weekend/holiday considerations
          // This would need additional business logic for holiday checking
          if (startHour < 8 || endHour > 18) {
            warnings.push('Early morning or evening deliveries may have limited availability');
          }
        }
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
      };
    }),
});

// Helper function for geocoding addresses using OpenStreetMap Nominatim (free)
async function geocodeAddress(address: {
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postal_code?: string;
  country: string;
}): Promise<{ latitude: number; longitude: number; formatted_address?: string } | null> {
  try {
    const addressString = [
      address.line1,
      address.line2,
      address.city,
      address.state,
      address.postal_code,
      address.country,
    ].filter(Boolean).join(', ');

    const response = await axios.get(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addressString)}&limit=1`,
      {
        headers: {
          'User-Agent': 'OrderManagementSystem/1.0',
        },
        timeout: 5000,
      }
    );

    const data = response.data;
    
    if (data && data.length > 0) {
      return {
        latitude: parseFloat(data[0].lat),
        longitude: parseFloat(data[0].lon),
        formatted_address: data[0].display_name,
      };
    }
    
    return null;
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}