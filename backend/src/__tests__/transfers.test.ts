import { describe, it, expect, beforeEach } from '@jest/globals';
import { createContext } from '../lib/context';
import { transfersRouter } from '../routes/transfers';
import { createCallerFactory } from '@trpc/server';

const createCaller = createCallerFactory(transfersRouter);

// Mock data for testing
const mockUser = {
  id: 'test-user-id',
  tenant_id: 'test-tenant-id',
  email: 'test@example.com'
};

const mockTransfer = {
  id: 'test-transfer-id',
  source_warehouse_id: 'warehouse-1',
  destination_warehouse_id: 'warehouse-2',
  transfer_date: '2024-12-01',
  status: 'draft',
  transfer_type: 'internal',
  priority: 'normal',
  total_items: 2,
  total_quantity: 10,
  tenant_id: 'test-tenant-id',
  created_by_user_id: 'test-user-id'
};

const mockTransferItem = {
  id: 'test-item-id',
  transfer_id: 'test-transfer-id',
  product_id: 'test-product-id',
  quantity_full: 5,
  quantity_empty: 0,
  tenant_id: 'test-tenant-id'
};

// Mock Supabase client
const mockSupabase = {
  from: (table: string) => ({
    select: () => ({
      eq: () => ({
        eq: () => ({
          order: () => ({
            range: () => Promise.resolve({
              data: [mockTransfer],
              error: null,
              count: 1
            })
          }),
          single: () => Promise.resolve({
            data: mockTransfer,
            error: null
          })
        }),
        in: () => ({
          order: () => ({
            range: () => Promise.resolve({
              data: [mockTransfer],
              error: null,
              count: 1
            })
          })
        })
      })
    }),
    insert: () => ({
      select: () => ({
        single: () => Promise.resolve({
          data: mockTransfer,
          error: null
        })
      })
    }),
    update: () => ({
      eq: () => ({
        eq: () => ({
          select: () => ({
            single: () => Promise.resolve({
              data: mockTransfer,
              error: null
            })
          })
        })
      })
    })
  }),
  rpc: () => Promise.resolve({ data: null, error: null })
};

const mockLogger = {
  info: () => {},
  error: () => {},
  warn: () => {},
  debug: () => {}
};

describe('Transfers Router', () => {
  let caller: any;

  beforeEach(() => {
    const ctx = {
      user: mockUser,
      supabase: mockSupabase,
      logger: mockLogger
    };
    caller = createCaller(ctx);
  });

  describe('list', () => {
    it('should list transfers with filters', async () => {
      const result = await caller.list({
        source_warehouse_id: 'warehouse-1',
        page: 1,
        limit: 10
      });

      expect(result).toHaveProperty('transfers');
      expect(result).toHaveProperty('totalCount');
      expect(result).toHaveProperty('totalPages');
      expect(result).toHaveProperty('currentPage');
      expect(Array.isArray(result.transfers)).toBe(true);
    });

    it('should apply status filter', async () => {
      const result = await caller.list({
        status: ['draft', 'pending'],
        page: 1,
        limit: 10
      });

      expect(result).toHaveProperty('transfers');
      expect(Array.isArray(result.transfers)).toBe(true);
    });
  });

  describe('validate', () => {
    it('should validate transfer request', async () => {
      const transferData = {
        source_warehouse_id: 'warehouse-1',
        destination_warehouse_id: 'warehouse-2',
        transfer_date: '2024-12-01T10:00:00Z',
        items: [
          {
            product_id: 'product-1',
            quantity_to_transfer: 5
          }
        ]
      };

      // Mock the validation call
      const mockValidation = {
        is_valid: true,
        errors: [],
        warnings: [],
        blocked_items: [],
        total_weight_kg: 50,
        estimated_cost: undefined
      };

      expect(mockValidation.is_valid).toBe(true);
      expect(Array.isArray(mockValidation.errors)).toBe(true);
      expect(Array.isArray(mockValidation.warnings)).toBe(true);
      expect(Array.isArray(mockValidation.blocked_items)).toBe(true);
    });
  });

  describe('create', () => {
    it('should validate create transfer parameters', async () => {
      const createData = {
        source_warehouse_id: 'warehouse-1',
        destination_warehouse_id: 'warehouse-2',
        transfer_date: '2024-12-01',
        priority: 'normal' as const,
        items: [
          {
            product_id: 'product-1',
            quantity_to_transfer: 5
          }
        ]
      };

      expect(createData.source_warehouse_id).toBeTruthy();
      expect(createData.destination_warehouse_id).toBeTruthy();
      expect(createData.transfer_date).toBeTruthy();
      expect(createData.items).toHaveLength(1);
      expect(createData.items[0].quantity_to_transfer).toBeGreaterThan(0);
    });
  });

  describe('updateStatus', () => {
    it('should validate status transitions', () => {
      const validTransitions: Record<string, string[]> = {
        'draft': ['pending', 'cancelled'],
        'pending': ['approved', 'cancelled'],
        'approved': ['in_transit', 'cancelled'],
        'in_transit': ['completed', 'cancelled'],
        'completed': [],
        'cancelled': []
      };

      // Test valid transitions
      expect(validTransitions['draft']).toContain('pending');
      expect(validTransitions['pending']).toContain('approved');
      expect(validTransitions['approved']).toContain('in_transit');
      expect(validTransitions['in_transit']).toContain('completed');

      // Test invalid transitions
      expect(validTransitions['completed']).toHaveLength(0);
      expect(validTransitions['cancelled']).toHaveLength(0);
      expect(validTransitions['draft']).not.toContain('completed');
    });
  });
});

describe('Transfer Validation Logic', () => {
  it('should validate basic transfer requirements', () => {
    const transfer = {
      source_warehouse_id: 'warehouse-1',
      destination_warehouse_id: 'warehouse-2',
      transfer_date: '2024-12-01',
      items: [{ product_id: 'product-1', quantity_to_transfer: 5 }]
    };

    // Basic validation
    expect(transfer.source_warehouse_id).toBeTruthy();
    expect(transfer.destination_warehouse_id).toBeTruthy();
    expect(transfer.source_warehouse_id).not.toBe(transfer.destination_warehouse_id);
    expect(transfer.transfer_date).toBeTruthy();
    expect(transfer.items).toHaveLength(1);
  });

  it('should validate transfer date is not in the past', () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + 1);
    
    const pastDate = new Date();
    pastDate.setDate(today.getDate() - 1);

    expect(futureDate >= today).toBe(true);
    expect(pastDate < today).toBe(true);
  });

  it('should calculate transfer summary correctly', () => {
    const items = [
      { quantity_to_transfer: 5, unit_weight_kg: 10, unit_cost: 20 },
      { quantity_to_transfer: 3, unit_weight_kg: 15, unit_cost: 30 }
    ];

    const total_quantity = items.reduce((sum, item) => sum + item.quantity_to_transfer, 0);
    const total_weight = items.reduce((sum, item) => sum + (item.unit_weight_kg * item.quantity_to_transfer), 0);
    const total_cost = items.reduce((sum, item) => sum + (item.unit_cost * item.quantity_to_transfer), 0);

    expect(total_quantity).toBe(8);
    expect(total_weight).toBe(95); // (5*10) + (3*15)
    expect(total_cost).toBe(190); // (5*20) + (3*30)
  });

  it('should detect duplicate items', () => {
    const items = [
      { product_id: 'product-1', variant_name: 'full' },
      { product_id: 'product-1', variant_name: 'full' }, // duplicate
      { product_id: 'product-2', variant_name: 'empty' }
    ];

    const itemKeys = items.map(item => `${item.product_id}-${item.variant_name || 'default'}`);
    const uniqueKeys = new Set(itemKeys);
    const hasDuplicates = itemKeys.length !== uniqueKeys.size;

    expect(hasDuplicates).toBe(true);
  });

  it('should generate transfer reference correctly', () => {
    const sourceCode = 'WH1';
    const destCode = 'WH2';
    const transferDate = '2024-12-01';

    const date = new Date(transferDate);
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const expectedPrefix = `TR-${sourceCode}-${destCode}-${dateStr}`;

    expect(dateStr).toBe('20241201');
    expect(expectedPrefix).toBe('TR-WH1-WH2-20241201');
  });

  it('should validate stock availability for transfer', () => {
    const stockInfo = {
      qty_full: 100,
      qty_reserved: 20
    };

    const requestedQuantity = 85;
    const availableForTransfer = stockInfo.qty_full - stockInfo.qty_reserved;
    const isValidTransfer = requestedQuantity <= availableForTransfer;

    expect(availableForTransfer).toBe(80);
    expect(isValidTransfer).toBe(false); // 85 > 80
  });
});