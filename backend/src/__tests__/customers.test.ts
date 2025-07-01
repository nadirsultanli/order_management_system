import { customersRouter } from '../routes/customers';
import { TRPCError } from '@trpc/server';

// Mock axios for geocoding tests
jest.mock('axios');
const mockAxios = require('axios');

// Valid UUIDs for testing
const VALID_CUSTOMER_ID = '550e8400-e29b-41d4-a716-446655440000';
const VALID_CUSTOMER_ID_2 = '550e8400-e29b-41d4-a716-446655440001';
const VALID_ADDRESS_ID = '550e8400-e29b-41d4-a716-446655440020';
const VALID_ORDER_ID = '550e8400-e29b-41d4-a716-446655440010';

// Mock the context for testing
const mockContext = {
  req: {} as any,
  res: {} as any,
  user: {
    id: 'test-user-id',
    email: 'test@example.com',
    tenant_id: 'test-tenant-id',
    role: 'user'
  },
  supabase: {
    from: jest.fn(),
    rpc: jest.fn()
  },
  supabaseAdmin: {} as any,
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }
};

describe('Customers Router', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('list', () => {
    it('should list customers with default pagination', async () => {
      const mockCustomersWithAddress = [
        {
          id: VALID_CUSTOMER_ID,
          name: 'Test Customer 1',
          email: 'test1@example.com',
          created_at: '2024-01-01T00:00:00Z',
          primary_address: {
            id: VALID_ADDRESS_ID,
            line1: '123 Main St',
            city: 'Test City',
            country: 'US',
            is_primary: true
          }
        }
      ];

      const mockCustomersWithoutAddress = [
        {
          id: VALID_CUSTOMER_ID_2,
          name: 'Test Customer 2',
          email: 'test2@example.com',
          created_at: '2024-01-02T00:00:00Z'
        }
      ];

      // Mock the query chain for customers with addresses
      const mockQueryWithAddress = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({
          data: mockCustomersWithAddress,
          error: null,
          count: 1
        })
      };

      // Mock the query chain for customers without addresses
      const mockQueryWithoutAddress = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        not: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        mockResolvedValue: jest.fn().mockResolvedValue({
          data: mockCustomersWithoutAddress,
          error: null,
          count: 1
        })
      };

      mockContext.supabase.from = jest.fn()
        .mockReturnValueOnce(mockQueryWithAddress)
        .mockReturnValueOnce(mockQueryWithoutAddress);

      const caller = customersRouter.createCaller(mockContext);
      const result = await caller.list({});

      expect(result.customers).toHaveLength(2);
      expect(result.totalCount).toBe(2);
      expect(result.totalPages).toBe(1);
      expect(result.currentPage).toBe(1);
      expect(result.customers[0].primary_address).toBeDefined();
      expect(result.customers[1].primary_address).toBeNull();
    });

    it('should apply search filter correctly', async () => {
      const mockQueryWithAddress = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({
          data: [],
          error: null,
          count: 0
        })
      };

      const mockQueryWithoutAddress = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        gte: jest.fn().mockResolvedValue({
          data: [],
          error: null,
          count: 0
        })
      };

      mockContext.supabase.from = jest.fn()
        .mockReturnValueOnce(mockQueryWithAddress)
        .mockReturnValueOnce(mockQueryWithoutAddress);

      const caller = customersRouter.createCaller(mockContext);
      await caller.list({ search: 'test search' });

      expect(mockQueryWithAddress.or).toHaveBeenCalledWith(
        'name.ilike.%test search%,email.ilike.%test search%,tax_id.ilike.%test search%'
      );
      expect(mockQueryWithoutAddress.or).toHaveBeenCalledWith(
        'name.ilike.%test search%,email.ilike.%test search%,tax_id.ilike.%test search%'
      );
    });

    it('should handle supabase errors', async () => {
      const mockQueryWithAddress = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
          count: 0
        })
      };

      mockContext.supabase.from = jest.fn().mockReturnValue(mockQueryWithAddress);

      const caller = customersRouter.createCaller(mockContext);

      await expect(caller.list({})).rejects.toThrow(TRPCError);
    });
  });

  describe('getById', () => {
    it('should return customer by ID', async () => {
      const mockCustomer = {
        id: 'customer-1',
        name: 'Test Customer',
        email: 'test@example.com',
        primary_address: {
          id: 'address-1',
          line1: '123 Main St',
          city: 'Test City',
          country: 'US'
        }
      };

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: mockCustomer,
          error: null
        })
      };

      mockContext.supabase.from = jest.fn().mockReturnValue(mockQuery);

      const caller = customersRouter.createCaller(mockContext);
      const result = await caller.getById({ customer_id: 'customer-1' });

      expect(result).toEqual(mockCustomer);
      expect(mockQuery.eq).toHaveBeenCalledWith('id', 'customer-1');
      expect(mockQuery.eq).toHaveBeenCalledWith('tenant_id', 'test-tenant-id');
    });

    it('should throw NOT_FOUND for non-existent customer', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116', message: 'No rows found' }
        })
      };

      mockContext.supabase.from = jest.fn().mockReturnValue(mockQuery);

      const caller = customersRouter.createCaller(mockContext);

      await expect(caller.getById({ customer_id: 'non-existent' }))
        .rejects.toThrow('Customer not found');
    });
  });

  describe('create', () => {
    it('should create customer with address successfully', async () => {
      const mockCustomerData = {
        name: 'New Customer',
        email: 'new@example.com',
        account_status: 'active' as const,
        credit_terms_days: 30,
        address: {
          line1: '123 New St',
          city: 'New City',
          country: 'US',
          latitude: 40.7128,
          longitude: -74.0060
        }
      };

      const mockRpcResult = {
        customer_id: 'new-customer-id',
        address_id: 'new-address-id'
      };

      mockContext.supabase.rpc = jest.fn().mockResolvedValue({
        data: [mockRpcResult],
        error: null
      });

      const caller = customersRouter.createCaller(mockContext);
      const result = await caller.create(mockCustomerData);

      expect(result).toEqual(mockRpcResult);
      expect(mockContext.supabase.rpc).toHaveBeenCalledWith(
        'create_customer_with_address',
        expect.objectContaining({
          p_tenant_id: 'test-tenant-id',
          p_name: 'New Customer',
          p_email: 'new@example.com',
          p_line1: '123 New St',
          p_latitude: 40.7128,
          p_longitude: -74.0060,
          p_created_by: 'test-user-id'
        })
      );
    });

    it('should geocode address when coordinates not provided', async () => {
      const mockCustomerData = {
        name: 'New Customer',
        email: 'new@example.com',
        account_status: 'active' as const,
        credit_terms_days: 30,
        address: {
          line1: '123 New St',
          city: 'New City',
          country: 'US'
        }
      };

      const mockGeocodingResponse = {
        data: [{
          lat: '40.7128',
          lon: '-74.0060',
          display_name: '123 New St, New City, US'
        }]
      };

      mockAxios.get.mockResolvedValue(mockGeocodingResponse);
      
      mockContext.supabase.rpc = jest.fn().mockResolvedValue({
        data: [{ customer_id: 'new-customer-id' }],
        error: null
      });

      const caller = customersRouter.createCaller(mockContext);
      await caller.create(mockCustomerData);

      expect(mockAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('nominatim.openstreetmap.org/search'),
        expect.objectContaining({
          headers: { 'User-Agent': 'OrderManagementSystem/1.0' }
        })
      );

      expect(mockContext.supabase.rpc).toHaveBeenCalledWith(
        'create_customer_with_address',
        expect.objectContaining({
          p_latitude: 40.7128,
          p_longitude: -74.0060
        })
      );
    });

    it('should handle RPC errors', async () => {
      const mockCustomerData = {
        name: 'New Customer',
        email: 'new@example.com',
        account_status: 'active' as const,
        credit_terms_days: 30,
        address: {
          line1: '123 New St',
          city: 'New City',
          country: 'US'
        }
      };

      mockContext.supabase.rpc = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'RPC error' }
      });

      const caller = customersRouter.createCaller(mockContext);

      await expect(caller.create(mockCustomerData)).rejects.toThrow(TRPCError);
    });
  });

  describe('update', () => {
    it('should update customer successfully', async () => {
      const mockUpdateData = {
        id: 'customer-1',
        name: 'Updated Customer',
        email: 'updated@example.com'
      };

      const mockUpdatedCustomer = {
        id: 'customer-1',
        name: 'Updated Customer',
        email: 'updated@example.com',
        updated_at: expect.any(String)
      };

      const mockQuery = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: mockUpdatedCustomer,
          error: null
        })
      };

      mockContext.supabase.from = jest.fn().mockReturnValue(mockQuery);

      const caller = customersRouter.createCaller(mockContext);
      const result = await caller.update(mockUpdateData);

      expect(result).toEqual(mockUpdatedCustomer);
      expect(mockQuery.eq).toHaveBeenCalledWith('id', 'customer-1');
      expect(mockQuery.eq).toHaveBeenCalledWith('tenant_id', 'test-tenant-id');
    });

    it('should update customer and address', async () => {
      const mockUpdateData = {
        id: 'customer-1',
        name: 'Updated Customer',
        address: {
          line1: 'Updated Street',
          city: 'Updated City',
          country: 'US'
        }
      };

      // Mock customer update
      const mockCustomerQuery = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: 'customer-1', name: 'Updated Customer' },
          error: null
        })
      };

      // Mock address fetch
      const mockAddressFetchQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: 'address-1' },
          error: null
        })
      };

      // Mock address update
      const mockAddressUpdateQuery = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        mockResolvedValue: jest.fn().mockResolvedValue({
          error: null
        })
      };

      mockContext.supabase.from = jest.fn()
        .mockReturnValueOnce(mockCustomerQuery)
        .mockReturnValueOnce(mockAddressFetchQuery)
        .mockReturnValueOnce(mockAddressUpdateQuery);

      const caller = customersRouter.createCaller(mockContext);
      const result = await caller.update(mockUpdateData);

      expect(result.id).toBe('customer-1');
      expect(mockCustomerQuery.update).toHaveBeenCalled();
    });

    it('should throw NOT_FOUND for non-existent customer', async () => {
      const mockQuery = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116', message: 'No rows found' }
        })
      };

      mockContext.supabase.from = jest.fn().mockReturnValue(mockQuery);

      const caller = customersRouter.createCaller(mockContext);

      await expect(caller.update({
        id: 'non-existent',
        name: 'Test'
      })).rejects.toThrow('Customer not found');
    });
  });

  describe('delete', () => {
    it('should delete customer successfully', async () => {
      const mockQuery = {
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        mockResolvedValue: jest.fn().mockResolvedValue({
          error: null
        })
      };

      mockContext.supabase.from = jest.fn().mockReturnValue(mockQuery);

      const caller = customersRouter.createCaller(mockContext);
      const result = await caller.delete({ customer_id: 'customer-1' });

      expect(result.success).toBe(true);
      expect(mockQuery.eq).toHaveBeenCalledWith('id', 'customer-1');
      expect(mockQuery.eq).toHaveBeenCalledWith('tenant_id', 'test-tenant-id');
    });

    it('should handle delete errors', async () => {
      const mockQuery = {
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        mockResolvedValue: jest.fn().mockResolvedValue({
          error: { message: 'Delete failed' }
        })
      };

      mockContext.supabase.from = jest.fn().mockReturnValue(mockQuery);

      const caller = customersRouter.createCaller(mockContext);

      await expect(caller.delete({ customer_id: 'customer-1' }))
        .rejects.toThrow(TRPCError);
    });
  });

  describe('getOrderHistory', () => {
    it('should return customer order history', async () => {
      const mockCustomer = { id: 'customer-1' };
      const mockOrders = [
        {
          id: 'order-1',
          customer_id: 'customer-1',
          total_amount: 100.00,
          status: 'delivered',
          created_at: '2024-01-01T00:00:00Z'
        }
      ];

      // Mock customer verification
      const mockCustomerQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: mockCustomer,
          error: null
        })
      };

      // Mock orders query
      const mockOrdersQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({
          data: mockOrders,
          error: null,
          count: 1
        })
      };

      mockContext.supabase.from = jest.fn()
        .mockReturnValueOnce(mockCustomerQuery)
        .mockReturnValueOnce(mockOrdersQuery);

      const caller = customersRouter.createCaller(mockContext);
      const result = await caller.getOrderHistory({
        customer_id: 'customer-1',
        limit: 10,
        offset: 0
      });

      expect(result.orders).toHaveLength(1);
      expect(result.totalCount).toBe(1);
      expect(result.hasMore).toBe(false);
    });

    it('should throw NOT_FOUND for non-existent customer', async () => {
      const mockCustomerQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Customer not found' }
        })
      };

      mockContext.supabase.from = jest.fn().mockReturnValue(mockCustomerQuery);

      const caller = customersRouter.createCaller(mockContext);

      await expect(caller.getOrderHistory({
        customer_id: 'non-existent',
        limit: 10,
        offset: 0
      })).rejects.toThrow('Customer not found');
    });
  });

  describe('getAnalytics', () => {
    it('should return customer analytics', async () => {
      const mockCustomer = {
        id: 'customer-1',
        name: 'Test Customer',
        created_at: '2024-01-01T00:00:00Z'
      };

      const mockOrderStats = [
        { status: 'delivered', total_amount: 100.00, order_date: '2024-01-15T00:00:00Z' },
        { status: 'delivered', total_amount: 150.00, order_date: '2024-01-20T00:00:00Z' }
      ];

      const mockRecentOrders = [
        { id: 'order-1', status: 'delivered', total_amount: 150.00, order_date: '2024-01-20T00:00:00Z' }
      ];

      // Mock customer verification
      const mockCustomerQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: mockCustomer,
          error: null
        })
      };

      // Mock order stats query
      const mockOrderStatsQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockResolvedValue({
          data: mockOrderStats,
          error: null
        })
      };

      // Mock recent orders query
      const mockRecentOrdersQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({
          data: mockRecentOrders,
          error: null
        })
      };

      mockContext.supabase.from = jest.fn()
        .mockReturnValueOnce(mockCustomerQuery)
        .mockReturnValueOnce(mockOrderStatsQuery)
        .mockReturnValueOnce(mockRecentOrdersQuery);

      const caller = customersRouter.createCaller(mockContext);
      const result = await caller.getAnalytics({
        customer_id: 'customer-1',
        period: 'month'
      });

      expect(result.customer.id).toBe('customer-1');
      expect(result.analytics.totalOrders).toBe(2);
      expect(result.analytics.totalRevenue).toBe(250.00);
      expect(result.analytics.avgOrderValue).toBe(125.00);
      expect(result.recentOrders).toHaveLength(1);
    });
  });

  describe('validate', () => {
    it('should validate customer data successfully', async () => {
      // Mock no existing customers
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: null
        })
      };

      mockContext.supabase.from = jest.fn().mockReturnValue(mockQuery);

      const caller = customersRouter.createCaller(mockContext);
      const result = await caller.validate({
        name: 'Test Customer',
        email: 'test@example.com'
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should detect duplicate email', async () => {
      const mockExistingCustomer = { id: 'existing-customer' };
      
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: mockExistingCustomer,
          error: null
        })
      };

      mockContext.supabase.from = jest.fn().mockReturnValue(mockQuery);

      const caller = customersRouter.createCaller(mockContext);
      const result = await caller.validate({
        name: 'Test Customer',
        email: 'existing@example.com'
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('A customer with this email already exists');
    });
  });

  describe('geocodeAddress', () => {
    it('should geocode address successfully', async () => {
      const mockGeocodingResponse = {
        data: [{
          lat: '40.7128',
          lon: '-74.0060',
          display_name: '123 Main St, New York, NY, USA'
        }]
      };

      mockAxios.get.mockResolvedValue(mockGeocodingResponse);

      const caller = customersRouter.createCaller(mockContext);
      const result = await caller.geocodeAddress({
        line1: '123 Main St',
        city: 'New York',
        country: 'US'
      });

      expect(result.latitude).toBe(40.7128);
      expect(result.longitude).toBe(-74.0060);
      expect(result.formatted_address).toBe('123 Main St, New York, NY, USA');
    });

    it('should handle geocoding failure', async () => {
      mockAxios.get.mockResolvedValue({ data: [] });

      const caller = customersRouter.createCaller(mockContext);

      await expect(caller.geocodeAddress({
        line1: 'Invalid Address',
        city: 'Nowhere',
        country: 'XX'
      })).rejects.toThrow('Could not geocode the provided address');
    });

    it('should handle network errors', async () => {
      mockAxios.get.mockRejectedValue(new Error('Network error'));

      const caller = customersRouter.createCaller(mockContext);

      await expect(caller.geocodeAddress({
        line1: '123 Main St',
        city: 'New York',
        country: 'US'
      })).rejects.toThrow('Failed to geocode address');
    });
  });

  describe('validateAddress', () => {
    it('should validate address successfully', async () => {
      const mockGeocodingResponse = {
        data: [{
          lat: '40.7128',
          lon: '-74.0060',
          display_name: '123 Main St, New York, NY, USA'
        }]
      };

      mockAxios.get.mockResolvedValue(mockGeocodingResponse);

      const caller = customersRouter.createCaller(mockContext);
      const result = await caller.validateAddress({
        line1: '123 Main St',
        city: 'New York',
        country: 'US'
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.geocode_result).toBeDefined();
    });

    it('should detect validation errors', async () => {
      const caller = customersRouter.createCaller(mockContext);
      const result = await caller.validateAddress({
        line1: '',
        city: '',
        country: 'X'
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Address line 1 is required');
      expect(result.errors).toContain('City is required');
      expect(result.errors).toContain('Valid country is required');
    });

    it('should add warnings for geocoding failures', async () => {
      mockAxios.get.mockResolvedValue({ data: [] });

      const caller = customersRouter.createCaller(mockContext);
      const result = await caller.validateAddress({
        line1: '123 Main St',
        city: 'New York',
        country: 'US'
      });

      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('Address could not be verified through geocoding');
    });
  });
});