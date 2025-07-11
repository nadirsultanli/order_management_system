import { z } from 'zod';
import { router, protectedProcedure } from '../lib/trpc';
import { requireAuth } from '../lib/auth';
import { TRPCError } from '@trpc/server';
import axios from 'axios';
import {
  CustomerStatsOutputSchema,
  CustomerListOutputSchema,
  CustomerDetailsOutputSchema,
  CustomerCreateOutputSchema,
  CustomerUpdateOutputSchema,
  ValidationOutputSchema,
  CustomerOrderHistoryOutputSchema,
  CustomerAnalyticsOutputSchema,
  AddressListOutputSchema,
  GeocodeOutputSchema,
  AddressValidationOutputSchema,
  SuccessOutputSchema,
  AddressOutputSchema,
} from '../schemas/output/customers-output';
import {
  CustomerFiltersSchema,
  CreateCustomerSchema,
  UpdateCustomerSchema,
  CustomerIdOptionalSchema,
  DeleteCustomerSchema,
  CustomerOrderHistorySchema,
  CustomerAnalyticsSchema,
  CustomerValidationSchema,
  CreditTermsValidationSchema,
  CustomerIdSchema,
  AddressSchema,
  UpdateAddressSchema,
  AddressIdSchema,
  SetPrimaryAddressSchema,
  GeocodeAddressSchema,
  AddressValidationSchema,
  DeliveryWindowValidationSchema,
  EmptyInputSchema,
} from '../schemas/input/customers-input';

export const customersRouter = router({
  // GET /customers - List customers with filtering and pagination (OpenAPI disabled - needs output schema)
  list: protectedProcedure
  .meta({
    openapi: {
      method: 'GET',
      path: '/customers',
      tags: ['customers'],
      summary: 'List customers',
      protect: true,
    }
  })
  .input(CustomerFiltersSchema)
  .output(CustomerListOutputSchema)
  .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      // Provide default values if input is undefined
      const filters = input || {} as { page?: number; limit?: number; search?: string; account_status?: 'active' | 'credit_hold' | 'closed' };
      const page = filters.page || 1;
      const limit = filters.limit || 50;
      const search = filters.search;
      const account_status = filters.account_status;
      
      ctx.logger.info('Fetching customers with filters:', filters);
      
      // First, get total count of all customers (with and without addresses) that match filters
      let countQuery = ctx.supabase
        .from('customers')
        .select('id', { count: 'exact', head: true });

      // Apply search filter to count query
      if (search) {
        countQuery = countQuery.or(
          `name.ilike.%${search}%,email.ilike.%${search}%,tax_id.ilike.%${search}%`
        );
      }

      // Apply status filter to count query
      if (account_status) {
        countQuery = countQuery.eq('account_status', account_status);
      }

      const { count: totalCount, error: countError } = await countQuery;

      if (countError) {
        ctx.logger.error('Error getting customer count:', countError);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: countError.message
        });
      }

      // Now get all customers (with and without addresses) and apply pagination to the combined result
      // Strategy: Get customers with addresses first, then customers without addresses, combine and sort, then paginate

      // Get customers WITH primary addresses
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
        `)
        .eq('addresses.is_primary', true)
        .order('created_at', { ascending: false });

      // Apply search filter
      if (search) {
        queryWithAddress = queryWithAddress.or(
          `name.ilike.%${search}%,email.ilike.%${search}%,tax_id.ilike.%${search}%`
        );
      }

      // Apply status filter
      if (account_status) {
        queryWithAddress = queryWithAddress.eq('account_status', account_status);
      }

      const { data: customersWithAddress, error: errorWithAddress } = await queryWithAddress;

      if (errorWithAddress) {
        ctx.logger.error('Supabase customers error (with address):', errorWithAddress);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: errorWithAddress.message
        });
      }

      // Get customers WITHOUT primary addresses
      let queryWithoutAddress = ctx.supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false });

      // Exclude customers that already have primary addresses
      if (customersWithAddress && customersWithAddress.length > 0) {
        const customerIdsWithAddress = customersWithAddress.map(c => c.id).filter(id => id);
        if (customerIdsWithAddress.length > 0) {
          queryWithoutAddress = queryWithoutAddress.not('id', 'in', `(${customerIdsWithAddress.join(',')})`);
        }
      }

      // Apply same filters to customers without addresses
      if (search) {
        queryWithoutAddress = queryWithoutAddress.or(
          `name.ilike.%${search}%,email.ilike.%${search}%,tax_id.ilike.%${search}%`
        );
      }

      if (account_status) {
        queryWithoutAddress = queryWithoutAddress.eq('account_status', account_status);
      }

      const { data: customersWithoutAddress, error: errorWithoutAddress } = await queryWithoutAddress;

      if (errorWithoutAddress) {
        ctx.logger.warn('Supabase customers error (without address):', errorWithoutAddress);
        // Don't throw error here, just log it and continue
      }

      // Combine and sort all customers
      const allCustomers = [
        ...(customersWithAddress || []).map(c => ({
          ...c,
          // Transform array to single object since Supabase returns joined data as array
          primary_address: Array.isArray(c.primary_address) && c.primary_address.length > 0 
            ? c.primary_address[0] 
            : null
        })),
        ...(customersWithoutAddress || []).map(c => ({ ...c, primary_address: null }))
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      // Apply pagination to the combined and sorted result
      const from = (page - 1) * limit;
      const to = from + limit;
      const paginatedCustomers = allCustomers.slice(from, to);

      const totalPages = Math.ceil((totalCount || 0) / limit);

      // Validate pagination request
      if (page > totalPages && totalPages > 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Requested page ${page} exceeds total pages ${totalPages}`
        });
      }

      return {
        customers: paginatedCustomers,
        totalCount: totalCount || 0,
        totalPages,
        currentPage: page,
      };
    }),

  // GET /customers/{id} - Get single customer by ID
  getById: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/customers/{customer_id}',
        tags: ['customers'],
        summary: 'Get customer by ID',
        description: 'Get a single customer by their ID',
        protect: true,
      }
    })
    .input(CustomerIdOptionalSchema)
    .output(CustomerDetailsOutputSchema)
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      // For testing purposes, if no input provided, return an error message
      if (!input || !input.customer_id) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'customer_id is required. Please provide a valid UUID in the format: {"customer_id": "uuid-here"}'
        });
      }
      
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
        // Transform array to single object since Supabase returns joined data as array
        return {
          ...data,
          primary_address: Array.isArray(data.primary_address) && data.primary_address.length > 0
            ? data.primary_address[0]
            : null
        };
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
    .meta({
      openapi: {
        method: 'POST',
        path: '/customers',
        tags: ['customers'],
        summary: 'Create customer',
        protect: true,
      }
    })
    .input(CreateCustomerSchema)
    .output(CustomerCreateOutputSchema)
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
      
      // Create customer and address in a transaction
      // First create the customer
      const { data: customerData, error: customerError } = await ctx.supabase
        .from('customers')
        .insert([{
          name: customerFields.name,
          external_id: customerFields.external_id,
          tax_id: customerFields.tax_id,
          phone: customerFields.phone,
          email: customerFields.email,
          account_status: customerFields.account_status,
          credit_terms_days: customerFields.credit_terms_days,
        }])
        .select()
        .single();

      if (customerError) {
        ctx.logger.error('Create customer error:', customerError);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: customerError.message
        });
      }

      // Then create the address
      const { data: addressData, error: addressError } = await ctx.supabase
        .from('addresses')
        .insert([{
          customer_id: customerData.id,
          line1: address.line1,
          line2: address.line2,
          city: address.city,
          state: address.state,
          postal_code: address.postal_code,
          country: address.country,
          latitude: latitude,
          longitude: longitude,
          delivery_window_start: address.delivery_window_start,
          delivery_window_end: address.delivery_window_end,
          is_primary: true,
          instructions: address.instructions,
        }])
        .select()
        .single();

      if (addressError) {
        // If address creation fails, we should delete the customer to maintain consistency
        await ctx.supabase
          .from('customers')
          .delete()
          .eq('id', customerData.id);
          
        ctx.logger.error('Create address error:', addressError);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: addressError.message
        });
      }

      ctx.logger.info('Customer and address created successfully:', { customer: customerData, address: addressData });
      
      // Return the customer data in the format expected by the frontend
      return {
        ...customerData,
        primary_address: addressData
      };
    }),

  // PUT /customers/{id} - Update customer
  update: protectedProcedure
    .meta({
      openapi: {
        method: 'PUT',
        path: '/customers/{id}',
        tags: ['customers'],
        summary: 'Update customer',
        protect: true,
      }
    })
    .input(UpdateCustomerSchema)
    .output(CustomerUpdateOutputSchema)
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Updating customer:', input.id);
      
      const { id, address, ...updateData } = input;
      
      // Filter out undefined values from customer update data
      const customerUpdateFields = Object.fromEntries(
        Object.entries(updateData).filter(([_, value]) => value !== undefined)
      );
      
      // Update customer fields (only if there are fields to update)
      let customerData;
      if (Object.keys(customerUpdateFields).length > 0) {
        const { data, error: customerError } = await ctx.supabase
          .from('customers')
          .update(customerUpdateFields)
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
        customerData = data;
      } else {
        // If no customer fields to update, just fetch current data
        const { data, error } = await ctx.supabase
          .from('customers')
          .select()
          .eq('id', id)
          .single();
        
        if (error) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Customer not found'
          });
        }
        customerData = data;
      }

      // Update address if provided (PARTIAL UPDATE with filtering)
      if (address && Object.keys(address).length > 0) {
        ctx.logger.info('Updating customer address (partial):', address);
        
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

        // Filter out undefined/null values from address object
        const addressUpdateFields = Object.fromEntries(
          Object.entries(address).filter(([_, value]) => 
            value !== undefined && value !== null && value !== ''
          )
        );

        // Only update if there are actual fields to update
        if (Object.keys(addressUpdateFields).length > 0) {
          const { error: addressUpdateError } = await ctx.supabase
            .from('addresses')
            .update(addressUpdateFields) // Use filtered fields instead of spreading
            .eq('id', addressData.id);

          if (addressUpdateError) {
            ctx.logger.error('Update address error:', addressUpdateError);
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: addressUpdateError.message
            });
          }

          ctx.logger.info('Address updated successfully with fields:', addressUpdateFields);
        } else {
          ctx.logger.info('No valid address fields to update');
        }
      }

      ctx.logger.info('Customer updated successfully:', customerData);
      return customerData;
    }),

  // DELETE /customers/{id} - Delete customer
  delete: protectedProcedure
    .meta({
      openapi: {
        method: 'DELETE',
        path: '/customers/{customer_id}',
        tags: ['customers'],
        summary: 'Delete customer',
        protect: true,
      }
    })
    .input(DeleteCustomerSchema)
    .output(SuccessOutputSchema)
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
    .meta({
      openapi: {
        method: 'GET',
        path: '/customers/{customer_id}/orders',
        tags: ['customers', 'orders'],
        summary: 'Get customer order history',
        protect: true,
      }
    })
    .input(CustomerOrderHistorySchema)
    .output(CustomerOrderHistoryOutputSchema)
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      // For testing purposes, if no input provided, return an error message
      if (!input || !input.customer_id) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'customer_id is required. Please provide input in the format: {"customer_id": "uuid-here", "limit": 50, "offset": 0}'
        });
      }
      
      // Provide defaults for optional fields
      const limit = input.limit || 50;
      const offset = input.offset || 0;
      
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
      query = query.range(offset, offset + limit - 1);

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
        hasMore: (count || 0) > offset + limit,
      };
    }),

  // GET /customers/{id}/analytics - Get customer analytics
  getAnalytics: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/customers/{customer_id}/analytics',
        tags: ['customers', 'analytics'],
        summary: 'Get customer analytics',
        protect: true,
      }
    })
    .input(CustomerAnalyticsSchema)
    .output(CustomerAnalyticsOutputSchema)
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      // For testing purposes, if no input provided, return an error message
      if (!input || !input.customer_id) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'customer_id is required. Please provide input in the format: {"customer_id": "uuid-here", "period": "year"}'
        });
      }
      
      // Provide default for optional fields
      const period = input.period || 'year';
      
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
      }[period];
      
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
        period: period,
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
    .meta({
      openapi: {
        method: 'POST',
        path: '/customers/validate',
        tags: ['customers', 'validation'],
        summary: 'Validate customer data',
        protect: true,
      }
    })
    .input(CustomerValidationSchema)
    .output(ValidationOutputSchema)
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
    .meta({
      openapi: {
        method: 'POST',
        path: '/customers/validate-credit-terms',
        tags: ['customers', 'validation'],
        summary: 'Validate credit terms',
        protect: true,
      }
    })
    .input(CreditTermsValidationSchema)
    .output(ValidationOutputSchema)
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
    .meta({
      openapi: {
        method: 'GET',
        path: '/customers/{customer_id}/addresses',
        tags: ['customers', 'addresses'],
        summary: 'Get customer addresses',
        protect: true,
      }
    })
    .input(CustomerIdSchema)
    .output(AddressListOutputSchema)
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
    .meta({
      openapi: {
        method: 'POST',
        path: '/customers/{customer_id}/addresses',
        tags: ['customers', 'addresses'],
        summary: 'Create customer address',
        description: 'Add a new address for a customer',
        protect: true,
      }
    })
    .input(AddressSchema)
    .output(AddressOutputSchema)
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
  .meta({
    openapi: {
      method: 'PUT',
      path: '/addresses/{address_id}',
      tags: ['addresses'],
      summary: 'Update address',
      description: 'Update an existing address',
      protect: true,
    }
  })
  .input(UpdateAddressSchema)
  .output(AddressOutputSchema)
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
    .meta({
      openapi: {
        method: 'DELETE',
        path: '/addresses/{address_id}',
        tags: ['addresses'],
        summary: 'Delete address',
        description: 'Delete an address',
        protect: true,
      }
    })
    .input(z.object({
      address_id: z.string().uuid(),
    }))
    .output(SuccessOutputSchema)
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
    .meta({
      openapi: {
        method: 'POST',
        path: '/addresses/{address_id}/set-primary',
        tags: ['addresses'],
        summary: 'Set primary address',
        description: 'Set an address as the primary address for a customer',
        protect: true,
      }
    })
    .input(SetPrimaryAddressSchema)
    .output(AddressOutputSchema)
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
    .meta({
      openapi: {
        method: 'POST',
        path: '/addresses/geocode',
        tags: ['addresses', 'geocoding'],
        summary: 'Geocode address',
        description: 'Get latitude and longitude coordinates for an address',
        protect: true,
      }
    })
    .input(GeocodeAddressSchema)
    .output(GeocodeOutputSchema)
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
    .meta({
      openapi: {
        method: 'POST',
        path: '/addresses/validate',
        tags: ['addresses', 'validation'],
        summary: 'Validate address',
        description: 'Validate address format and existence through geocoding',
        protect: true,
      }
    })
    .input(AddressValidationSchema)
    .output(AddressValidationOutputSchema)
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
    .meta({
      openapi: {
        method: 'POST',
        path: '/addresses/validate-delivery-window',
        tags: ['addresses', 'validation'],
        summary: 'Validate delivery window',
        description: 'Validate delivery window times against business rules',
        protect: true,
      }
    })
    .input(DeliveryWindowValidationSchema)
    .output(ValidationOutputSchema)
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