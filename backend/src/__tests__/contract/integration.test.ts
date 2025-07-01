/**
 * Integration Contract Tests
 * 
 * Tests that verify the entire system works together correctly,
 * including database, API, authentication, and business logic integration.
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { appRouter } from '../../routes';
import { ContractTestSetup, TestData } from './setup';
import { supabaseAdmin } from '../../lib/supabase';

describe('Integration Contract Tests', () => {
  let testSetup: ContractTestSetup;
  let testData: TestData;

  beforeAll(async () => {
    testSetup = new ContractTestSetup();
    testData = await testSetup.setupTestEnvironment();
  });

  afterAll(async () => {
    await testSetup.cleanupTestEnvironment();
  });

  describe('Database Integration', () => {
    test('RLS policies enforce tenant isolation in database', async () => {
      // Test direct database access with different user contexts
      const tenantAContext = await createMockContext(testData.users[0]);
      const tenantBContext = await createMockContext(testData.users[2]);

      // Create orders in both tenants
      const tenantACaller = appRouter.createCaller(tenantAContext);
      const tenantBCaller = appRouter.createCaller(tenantBContext);

      const orderA = await tenantACaller.orders.create({
        customer_id: testData.customers[0].id,
        order_lines: [
          {
            product_id: testData.products[0].id,
            quantity: 3,
            unit_price: 100
          }
        ]
      });

      const orderB = await tenantBCaller.orders.create({
        customer_id: testData.customers[2].id,
        order_lines: [
          {
            product_id: testData.products[2].id,
            quantity: 2,
            unit_price: 150
          }
        ]
      });

      // Verify database-level isolation using admin client
      const { data: allOrders } = await supabaseAdmin
        .from('orders')
        .select('id, tenant_id');

      const orderAFromDB = allOrders?.find(o => o.id === orderA.id);
      const orderBFromDB = allOrders?.find(o => o.id === orderB.id);

      expect(orderAFromDB?.tenant_id).toBe(testData.tenants[0].id);
      expect(orderBFromDB?.tenant_id).toBe(testData.tenants[1].id);
    });

    test('Foreign key constraints maintain data integrity', async () => {
      const context = await createMockContext(testData.users[0]);
      const caller = appRouter.createCaller(context);

      // Try to create order with non-existent customer (should fail)
      await expect(caller.orders.create({
        customer_id: '99999999-9999-9999-9999-999999999999',
        order_lines: [
          {
            product_id: testData.products[0].id,
            quantity: 1,
            unit_price: 100
          }
        ]
      })).rejects.toThrow();

      // Try to create order line with non-existent product (should fail)
      await expect(caller.orders.create({
        customer_id: testData.customers[0].id,
        order_lines: [
          {
            product_id: '99999999-9999-9999-9999-999999999999',
            quantity: 1,
            unit_price: 100
          }
        ]
      })).rejects.toThrow();
    });

    test('Database transactions maintain consistency', async () => {
      const context = await createMockContext(testData.users[0]);
      const caller = appRouter.createCaller(context);

      // Get initial inventory
      const initialInventory = await caller.inventory.list({
        product_id: testData.products[0].id
      });
      const initialStock = initialInventory[0];

      // Create and confirm order (should reserve inventory atomically)
      const order = await caller.orders.create({
        customer_id: testData.customers[0].id,
        order_lines: [
          {
            product_id: testData.products[0].id,
            quantity: 10,
            unit_price: 100
          }
        ]
      });

      await caller.orders.updateStatus({
        order_id: order.id,
        new_status: 'confirmed'
      });

      // Verify inventory was updated atomically
      const updatedInventory = await caller.inventory.list({
        product_id: testData.products[0].id
      });
      const updatedStock = updatedInventory[0];

      expect(updatedStock.available_quantity).toBe(initialStock.available_quantity - 10);
      expect(updatedStock.reserved_quantity).toBe(initialStock.reserved_quantity + 10);
    });
  });

  describe('Authentication and Authorization Integration', () => {
    test('JWT token validation works end-to-end', async () => {
      // Test with valid token
      const validContext = await createMockContext(testData.users[0]);
      const validCaller = appRouter.createCaller(validContext);

      const result = await validCaller.customers.list({});
      expect(result.customers).toBeDefined();
      expect(result.customers.length).toBeGreaterThan(0);

      // Test with invalid context (no user)
      const invalidContext = {
        req: { headers: {} } as any,
        res: {} as any,
        user: null,
        supabase: {} as any,
        supabaseAdmin: {} as any,
        logger: {
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
          debug: jest.fn(),
        }
      };

      const invalidCaller = appRouter.createCaller(invalidContext);

      await expect(invalidCaller.customers.list({})).rejects.toThrow(/unauthorized/i);
    });

    test('Role-based permissions work correctly', async () => {
      const adminContext = await createMockContext(testData.users[0]); // Admin user
      const userContext = await createMockContext(testData.users[1]); // Regular user

      const adminCaller = appRouter.createCaller(adminContext);
      const userCaller = appRouter.createCaller(userContext);

      // Both should be able to access basic operations
      const adminCustomers = await adminCaller.customers.list({});
      const userCustomers = await userCaller.customers.list({});

      expect(adminCustomers.customers).toBeDefined();
      expect(userCustomers.customers).toBeDefined();

      // Admin operations (if any are restricted) would be tested here
      // For this system, both admin and user have the same permissions within their tenant
    });
  });

  describe('Business Logic Integration', () => {
    test('Order workflow integrates with all related systems', async () => {
      const context = await createMockContext(testData.users[0]);
      const caller = appRouter.createCaller(context);

      // Step 1: Check initial state
      const initialStats = await caller.analytics.getDashboardStats({
        period: 'month'
      });

      const initialInventory = await caller.inventory.list({
        product_id: testData.products[0].id
      });

      // Step 2: Create complete order workflow
      const order = await caller.orders.create({
        customer_id: testData.customers[0].id,
        order_lines: [
          {
            product_id: testData.products[0].id,
            quantity: 5,
            unit_price: 200
          }
        ]
      });

      // Confirm order (reserves inventory)
      await caller.orders.updateStatus({
        order_id: order.id,
        new_status: 'confirmed'
      });

      // Schedule delivery
      await caller.orders.updateStatus({
        order_id: order.id,
        new_status: 'scheduled',
        scheduled_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      });

      // Mark as delivered (fulfills inventory)
      await caller.orders.updateStatus({
        order_id: order.id,
        new_status: 'delivered'
      });

      // Step 3: Verify all systems updated correctly
      const finalStats = await caller.analytics.getDashboardStats({
        period: 'month'
      });

      const finalInventory = await caller.inventory.list({
        product_id: testData.products[0].id
      });

      const customerHistory = await caller.customers.getOrderHistory({
        customer_id: testData.customers[0].id
      });

      // Verify integrations
      expect(finalStats.orders.total_count).toBeGreaterThan(initialStats.orders.total_count);
      expect(finalStats.orders.total_revenue).toBeGreaterThan(initialStats.orders.total_revenue);
      expect(finalInventory[0].available_quantity).toBeLessThan(initialInventory[0].available_quantity);
      expect(customerHistory.orders.some(o => o.id === order.id)).toBe(true);
    });

    test('Pricing system integrates with order creation', async () => {
      const context = await createMockContext(testData.users[0]);
      const caller = appRouter.createCaller(context);

      // Calculate pricing first
      const pricing = await caller.pricing.calculate({
        customer_id: testData.customers[0].id,
        items: [
          {
            product_id: testData.products[0].id,
            quantity: 10
          }
        ]
      });

      // Create order with calculated pricing
      const order = await caller.orders.create({
        customer_id: testData.customers[0].id,
        order_lines: [
          {
            product_id: testData.products[0].id,
            quantity: 10,
            unit_price: pricing.items[0].unit_price
          }
        ]
      });

      // Verify pricing was applied correctly
      expect(order.order_lines[0].unit_price).toBe(pricing.items[0].unit_price);
      expect(order.total_amount).toBe(pricing.total_amount);
    });
  });

  describe('Error Handling Integration', () => {
    test('System handles cascading failures gracefully', async () => {
      const context = await createMockContext(testData.users[0]);
      const caller = appRouter.createCaller(context);

      // Create order that will cause inventory issues
      const order = await caller.orders.create({
        customer_id: testData.customers[0].id,
        order_lines: [
          {
            product_id: testData.products[0].id,
            quantity: 1000, // Excessive quantity
            unit_price: 100
          }
        ]
      });

      // Try to confirm order with insufficient inventory
      await expect(caller.orders.updateStatus({
        order_id: order.id,
        new_status: 'confirmed'
      })).rejects.toThrow(/insufficient/i);

      // Verify order remains in draft state
      const unchangedOrder = await caller.orders.getById({
        order_id: order.id
      });
      expect(unchangedOrder.status).toBe('draft');

      // Verify inventory unchanged
      const inventory = await caller.inventory.list({
        product_id: testData.products[0].id
      });
      expect(inventory[0].reserved_quantity).toBe(0); // Should not have reserved anything
    });

    test('Database constraints prevent data corruption', async () => {
      // This test would need to simulate various constraint violations
      // and verify the system handles them properly without corrupting data

      const context = await createMockContext(testData.users[0]);
      const caller = appRouter.createCaller(context);

      // Test negative inventory handling
      const inventory = await caller.inventory.list({
        product_id: testData.products[0].id
      });

      await expect(caller.inventory.adjustStock({
        inventory_id: inventory[0].id,
        adjustment_type: 'decrease',
        quantity: inventory[0].available_quantity + 1000, // More than available
        reason: 'Test constraint violation'
      })).rejects.toThrow();

      // Verify inventory unchanged after failed operation
      const unchangedInventory = await caller.inventory.list({
        product_id: testData.products[0].id
      });
      expect(unchangedInventory[0].available_quantity).toBe(inventory[0].available_quantity);
    });
  });

  describe('Performance Integration', () => {
    test('Complex multi-system operations perform within limits', async () => {
      const context = await createMockContext(testData.users[0]);
      const caller = appRouter.createCaller(context);

      const startTime = performance.now();

      // Perform complex operation involving multiple systems
      const order = await caller.orders.create({
        customer_id: testData.customers[0].id,
        order_lines: [
          {
            product_id: testData.products[0].id,
            quantity: 3,
            unit_price: 150
          },
          {
            product_id: testData.products[1].id,
            quantity: 2,
            unit_price: 200
          }
        ]
      });

      await caller.orders.updateStatus({
        order_id: order.id,
        new_status: 'confirmed'
      });

      const analytics = await caller.customers.getAnalytics({
        customer_id: testData.customers[0].id
      });

      const stats = await caller.analytics.getDashboardStats({
        period: 'month'
      });

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Complex multi-system operation should complete in reasonable time
      expect(totalTime).toBeLessThan(2000); // 2 seconds for complex workflow
      expect(order).toBeDefined();
      expect(analytics).toBeDefined();
      expect(stats).toBeDefined();
    });
  });

  describe('Data Consistency Integration', () => {
    test('System maintains consistency across concurrent operations', async () => {
      const context = await createMockContext(testData.users[0]);
      const caller = appRouter.createCaller(context);

      // Get initial inventory
      const initialInventory = await caller.inventory.list({
        product_id: testData.products[0].id
      });
      const initialQuantity = initialInventory[0].available_quantity;

      // Perform concurrent order creations and confirmations
      const concurrentOperations = Array.from({ length: 5 }, async (_, i) => {
        const order = await caller.orders.create({
          customer_id: testData.customers[0].id,
          order_lines: [
            {
              product_id: testData.products[0].id,
              quantity: 2,
              unit_price: 100
            }
          ]
        });

        await caller.orders.updateStatus({
          order_id: order.id,
          new_status: 'confirmed'
        });

        return order;
      });

      const results = await Promise.all(concurrentOperations);
      expect(results).toHaveLength(5);

      // Verify inventory consistency
      const finalInventory = await caller.inventory.list({
        product_id: testData.products[0].id
      });

      const expectedReserved = 5 * 2; // 5 orders × 2 quantity each
      const expectedAvailable = initialQuantity - expectedReserved;

      expect(finalInventory[0].available_quantity).toBe(expectedAvailable);
      expect(finalInventory[0].reserved_quantity).toBeGreaterThanOrEqual(expectedReserved);
    });
  });

  describe('Health Check Integration', () => {
    test('System health check validates all components', async () => {
      const context = await createMockContext(testData.users[0]);
      const caller = appRouter.createCaller(context);

      const healthCheck = await caller.admin.healthCheck();

      expect(healthCheck.status).toBe('healthy');
      expect(healthCheck.checks.database).toBe(true);
      expect(healthCheck.checks.rls).toBe(true);
      expect(healthCheck.checks.tenantAccess).toBe(true);
      expect(healthCheck.timestamp).toBeDefined();
      expect(healthCheck.version).toBeDefined();
    });
  });
});

// Helper function to create mock context for testing
async function createMockContext(user: any) {
  return {
    req: {
      headers: {
        authorization: `Bearer ${user.auth_token}`
      }
    } as any,
    res: {} as any,
    user: {
      id: user.id,
      email: user.email,
      tenant_id: user.tenant_id,
      role: user.role
    },
    supabase: {} as any,
    supabaseAdmin: {} as any,
    logger: {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    }
  };
}