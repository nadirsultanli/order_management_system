import { customersRouter } from '../routes/customers';
import { TRPCError } from '@trpc/server';

// Mock axios for geocoding tests
jest.mock('axios');
const mockAxios = require('axios');

// Valid UUIDs for testing
const VALID_CUSTOMER_ID = '550e8400-e29b-41d4-a716-446655440000';

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

describe('Customers Router - Core Functionality', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
        customer_id: VALID_CUSTOMER_ID,
        address_id: 'address-id'
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

  describe('validate', () => {
    it('should validate customer data successfully when no duplicates exist', async () => {
      // Mock no existing customers found
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' } // No rows found
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
      const mockExistingCustomer = { id: VALID_CUSTOMER_ID };
      
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn()
          .mockResolvedValueOnce({
            data: mockExistingCustomer, // Email exists
            error: null
          })
          .mockResolvedValueOnce({
            data: null,
            error: { code: 'PGRST116' } // External ID doesn't exist
          })
          .mockResolvedValueOnce({
            data: null,
            error: { code: 'PGRST116' } // Tax ID doesn't exist
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

    it('should handle geocoding failure when no results found', async () => {
      mockAxios.get.mockResolvedValue({ data: [] });

      const caller = customersRouter.createCaller(mockContext);

      await expect(caller.geocodeAddress({
        line1: 'Invalid Address',
        city: 'Nowhere',
        country: 'XX'
      })).rejects.toThrow('Could not geocode the provided address');
    });

    it('should handle network errors during geocoding', async () => {
      mockAxios.get.mockRejectedValue(new Error('Network error'));

      const caller = customersRouter.createCaller(mockContext);

      await expect(caller.geocodeAddress({
        line1: '123 Main St',
        city: 'New York',
        country: 'US'
      })).rejects.toThrow('Could not geocode the provided address');
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

  describe('geocoding integration', () => {
    it('should geocode address when coordinates not provided during creation', async () => {
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
        data: [{ customer_id: VALID_CUSTOMER_ID }],
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

    it('should continue without coordinates if geocoding fails', async () => {
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

      mockAxios.get.mockRejectedValue(new Error('Geocoding failed'));
      
      mockContext.supabase.rpc = jest.fn().mockResolvedValue({
        data: [{ customer_id: VALID_CUSTOMER_ID }],
        error: null
      });

      const caller = customersRouter.createCaller(mockContext);
      await caller.create(mockCustomerData);

      expect(mockContext.supabase.rpc).toHaveBeenCalledWith(
        'create_customer_with_address',
        expect.objectContaining({
          p_latitude: undefined,
          p_longitude: undefined
        })
      );
    });
  });
});