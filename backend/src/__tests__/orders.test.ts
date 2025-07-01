import { ordersRouter } from '../routes/orders';
import { createContext } from '../lib/context';

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

describe('Orders Router', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateTotal', () => {
    it('should calculate order total correctly', async () => {
      const mockOrderLines = [
        { quantity: 2, unit_price: 10.50, subtotal: 21.00 },
        { quantity: 1, unit_price: 15.75, subtotal: 15.75 }
      ];

      const mockOrder = {
        tax_amount: 3.68,
        tax_percent: 10
      };

      mockContext.supabase.from = jest.fn()
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({
                data: mockOrderLines,
                error: null
              })
            })
          })
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: mockOrder,
                  error: null
                })
              })
            })
          })
        })
        .mockReturnValueOnce({
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({
                error: null
              })
            })
          })
        });

      const caller = ordersRouter.createCaller(mockContext);
      
      const result = await caller.calculateTotal({
        order_id: 'test-order-id'
      });

      expect(result).toEqual({
        subtotal: 36.75,
        tax_amount: 3.68,
        total_amount: 40.43,
        breakdown: [
          { quantity: 2, unit_price: 10.50, subtotal: 21.00 },
          { quantity: 1, unit_price: 15.75, subtotal: 15.75 }
        ]
      });

      expect(mockContext.logger.info).toHaveBeenCalledWith(
        'Calculating order total for:',
        'test-order-id'
      );
    });

    it('should throw error when order not found', async () => {
      mockContext.supabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Order not found' }
            })
          })
        })
      });

      const caller = ordersRouter.createCaller(mockContext);
      
      await expect(caller.calculateTotal({
        order_id: 'non-existent-order'
      })).rejects.toThrow('Order not found');
    });
  });

  describe('updateStatus', () => {
    it('should update order status with inventory side effects', async () => {
      const mockCurrentOrder = {
        id: 'test-order-id',
        status: 'draft',
        order_lines: [
          { product_id: 'product-1', quantity: 2 },
          { product_id: 'product-2', quantity: 1 }
        ]
      };

      const mockUpdatedOrder = {
        ...mockCurrentOrder,
        status: 'confirmed',
        updated_at: new Date().toISOString()
      };

      // Mock getting current order
      mockContext.supabase.from = jest.fn()
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: mockCurrentOrder,
                  error: null
                })
              })
            })
          })
        })
        // Mock updating order
        .mockReturnValueOnce({
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                select: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: mockUpdatedOrder,
                    error: null
                  })
                })
              })
            })
          })
        });

      // Mock inventory reservation RPC calls
      mockContext.supabase.rpc = jest.fn().mockResolvedValue({ error: null });

      const caller = ordersRouter.createCaller(mockContext);
      
      const result = await caller.updateStatus({
        order_id: 'test-order-id',
        new_status: 'confirmed'
      });

      expect(result).toEqual(mockUpdatedOrder);

      // Verify inventory reservations were called
      expect(mockContext.supabase.rpc).toHaveBeenCalledWith('reserve_stock', {
        p_product_id: 'product-1',
        p_quantity: 2,
        p_tenant_id: 'test-tenant-id'
      });

      expect(mockContext.supabase.rpc).toHaveBeenCalledWith('reserve_stock', {
        p_product_id: 'product-2',
        p_quantity: 1,
        p_tenant_id: 'test-tenant-id'
      });

      expect(mockContext.logger.info).toHaveBeenCalledWith(
        'Changing order status:',
        expect.objectContaining({
          order_id: 'test-order-id',
          new_status: 'confirmed'
        })
      );
    });
  });

  describe('list', () => {
    it('should list orders with proper tenant filtering', async () => {
      const mockOrders = [
        { id: 'order-1', customer_id: 'customer-1', status: 'draft' },
        { id: 'order-2', customer_id: 'customer-2', status: 'confirmed' }
      ];

      mockContext.supabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              range: jest.fn().mockResolvedValue({
                data: mockOrders,
                error: null,
                count: 2
              })
            })
          })
        })
      });

      const caller = ordersRouter.createCaller(mockContext);
      
      const result = await caller.list({
        page: 1,
        limit: 50
      });

      expect(result).toEqual({
        orders: mockOrders,
        totalCount: 2,
        totalPages: 1,
        currentPage: 1
      });

      // Verify tenant filtering is applied
      expect(mockContext.supabase.from).toHaveBeenCalledWith('orders');
      expect(mockContext.logger.info).toHaveBeenCalledWith(
        'Fetching orders with filters:',
        expect.objectContaining({ page: 1, limit: 50 })
      );
    });
  });
});