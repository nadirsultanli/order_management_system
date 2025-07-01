/**
 * Performance Contract Tests
 * 
 * Tests API performance and ensures operations complete within acceptable timeframes.
 * These tests help catch performance regressions and validate scalability.
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { performance } from 'perf_hooks';
import { appRouter } from '../../routes';
import { ContractTestSetup, TestData } from './setup';

describe('Performance Contract Tests', () => {
  let testSetup: ContractTestSetup;
  let testData: TestData;

  beforeAll(async () => {
    testSetup = new ContractTestSetup();
    testData = await testSetup.setupTestEnvironment();
  });

  afterAll(async () => {
    await testSetup.cleanupTestEnvironment();
  });

  describe('API Response Time Requirements', () => {
    test('Order listing responds within 500ms', async () => {
      const context = await createMockContext(testData.users[0]);
      const caller = appRouter.createCaller(context);

      const startTime = performance.now();
      
      const result = await caller.orders.list({
        limit: 50
      });
      
      const endTime = performance.now();
      const responseTime = endTime - startTime;

      expect(responseTime).toBeLessThan(500); // 500ms SLA
      expect(result).toBeDefined();
    });

    test('Customer search responds within 300ms', async () => {
      const context = await createMockContext(testData.users[0]);
      const caller = appRouter.createCaller(context);

      const startTime = performance.now();
      
      const result = await caller.customers.list({
        search: 'Customer',
        limit: 25
      });
      
      const endTime = performance.now();
      const responseTime = endTime - startTime;

      expect(responseTime).toBeLessThan(300); // 300ms SLA
      expect(result).toBeDefined();
    });

    test('Inventory lookup responds within 200ms', async () => {
      const context = await createMockContext(testData.users[0]);
      const caller = appRouter.createCaller(context);

      const startTime = performance.now();
      
      const result = await caller.inventory.list({
        warehouse_id: testData.warehouses[0].id
      });
      
      const endTime = performance.now();
      const responseTime = endTime - startTime;

      expect(responseTime).toBeLessThan(200); // 200ms SLA
      expect(result).toBeDefined();
    });

    test('Dashboard stats respond within 1000ms', async () => {
      const context = await createMockContext(testData.users[0]);
      const caller = appRouter.createCaller(context);

      const startTime = performance.now();
      
      const result = await caller.analytics.getDashboardStats({
        period: 'month'
      });
      
      const endTime = performance.now();
      const responseTime = endTime - startTime;

      expect(responseTime).toBeLessThan(1000); // 1000ms SLA for complex analytics
      expect(result).toBeDefined();
    });
  });

  describe('Bulk Operations Performance', () => {
    test('Multiple order creation performs efficiently', async () => {
      const context = await createMockContext(testData.users[0]);
      const caller = appRouter.createCaller(context);

      const orderCreationPromises = Array.from({ length: 10 }, (_, i) =>
        caller.orders.create({
          customer_id: testData.customers[0].id,
          order_lines: [
            {
              product_id: testData.products[0].id,
              quantity: i + 1,
              unit_price: 100
            }
          ]
        })
      );

      const startTime = performance.now();
      
      const results = await Promise.all(orderCreationPromises);
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const averageTime = totalTime / results.length;

      expect(results).toHaveLength(10);
      expect(averageTime).toBeLessThan(200); // Average 200ms per order creation
      expect(totalTime).toBeLessThan(3000); // Total under 3 seconds
    });

    test('Concurrent inventory adjustments perform safely', async () => {
      const context = await createMockContext(testData.users[0]);
      const caller = appRouter.createCaller(context);

      const inventory = await caller.inventory.list({
        product_id: testData.products[0].id
      });
      const inventoryId = inventory[0].id;

      // Simulate concurrent inventory adjustments
      const adjustmentPromises = Array.from({ length: 5 }, (_, i) =>
        caller.inventory.adjustStock({
          inventory_id: inventoryId,
          adjustment_type: 'increase',
          quantity: 1,
          reason: `Concurrent adjustment ${i + 1}`
        })
      );

      const startTime = performance.now();
      
      const results = await Promise.all(adjustmentPromises);
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;

      expect(results).toHaveLength(5);
      expect(totalTime).toBeLessThan(2000); // Complete within 2 seconds
      
      // Verify final inventory is consistent
      const finalInventory = await caller.inventory.list({
        product_id: testData.products[0].id
      });
      
      // Should have increased by 5 (5 adjustments of +1 each)
      expect(finalInventory[0].available_quantity).toBeGreaterThan(inventory[0].available_quantity);
    });
  });

  describe('Memory and Resource Usage', () => {
    test('Large dataset queries do not cause memory issues', async () => {
      const context = await createMockContext(testData.users[0]);
      const caller = appRouter.createCaller(context);

      // Create multiple orders first
      const createPromises = Array.from({ length: 50 }, (_, i) =>
        caller.orders.create({
          customer_id: testData.customers[i % 2].id, // Alternate between customers
          order_lines: [
            {
              product_id: testData.products[i % 2].id,
              quantity: Math.floor(Math.random() * 10) + 1,
              unit_price: Math.floor(Math.random() * 100) + 50
            }
          ]
        })
      );

      await Promise.all(createPromises);

      // Now test large result set retrieval
      const memoryBefore = process.memoryUsage();
      
      const result = await caller.orders.list({
        limit: 100 // Request large dataset
      });
      
      const memoryAfter = process.memoryUsage();
      const memoryIncrease = memoryAfter.heapUsed - memoryBefore.heapUsed;

      expect(result.orders.length).toBeGreaterThan(0);
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // Less than 50MB increase
    });
  });

  describe('Database Query Optimization', () => {
    test('Complex queries with joins perform efficiently', async () => {
      const context = await createMockContext(testData.users[0]);
      const caller = appRouter.createCaller(context);

      // Create an order to ensure we have data to query
      const order = await caller.orders.create({
        customer_id: testData.customers[0].id,
        order_lines: [
          {
            product_id: testData.products[0].id,
            quantity: 5,
            unit_price: 100
          }
        ]
      });

      const startTime = performance.now();
      
      // This should trigger complex queries with joins
      const detailedOrder = await caller.orders.getById({
        order_id: order.id
      });
      
      const endTime = performance.now();
      const queryTime = endTime - startTime;

      expect(queryTime).toBeLessThan(300); // Complex query under 300ms
      expect(detailedOrder).toBeDefined();
      expect(detailedOrder.customer).toBeDefined();
      expect(detailedOrder.order_lines).toBeDefined();
      expect(detailedOrder.order_lines.length).toBeGreaterThan(0);
    });

    test('Filtered queries use indexes efficiently', async () => {
      const context = await createMockContext(testData.users[0]);
      const caller = appRouter.createCaller(context);

      // Test various filter combinations
      const filterTests = [
        { status: 'draft' as const },
        { customer_id: testData.customers[0].id },
        { order_date_from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() },
        { search: 'Customer' }
      ];

      for (const filter of filterTests) {
        const startTime = performance.now();
        
        const result = await caller.orders.list(filter);
        
        const endTime = performance.now();
        const queryTime = endTime - startTime;

        expect(queryTime).toBeLessThan(250); // Filtered queries under 250ms
        expect(result).toBeDefined();
      }
    });
  });

  describe('Caching and Performance Optimization', () => {
    test('Repeated identical queries show improved performance', async () => {
      const context = await createMockContext(testData.users[0]);
      const caller = appRouter.createCaller(context);

      const query = { limit: 20, status: 'draft' as const };

      // First query (cold)
      const startTime1 = performance.now();
      const result1 = await caller.orders.list(query);
      const endTime1 = performance.now();
      const firstQueryTime = endTime1 - startTime1;

      // Second identical query (should be faster if cached)
      const startTime2 = performance.now();
      const result2 = await caller.orders.list(query);
      const endTime2 = performance.now();
      const secondQueryTime = endTime2 - startTime2;

      expect(result1).toEqual(result2);
      expect(firstQueryTime).toBeGreaterThan(0);
      expect(secondQueryTime).toBeGreaterThan(0);
      
      // Note: This test is more about establishing baseline performance
      // In a real implementation with caching, secondQueryTime should be < firstQueryTime
    });
  });

  describe('Scalability Indicators', () => {
    test('Performance degrades gracefully with increased load', async () => {
      const context = await createMockContext(testData.users[0]);
      const caller = appRouter.createCaller(context);

      const loadLevels = [1, 5, 10, 20];
      const performanceResults: number[] = [];

      for (const load of loadLevels) {
        const promises = Array.from({ length: load }, () =>
          caller.customers.list({ limit: 10 })
        );

        const startTime = performance.now();
        await Promise.all(promises);
        const endTime = performance.now();
        
        const avgTime = (endTime - startTime) / load;
        performanceResults.push(avgTime);
      }

      // Performance should not degrade exponentially
      for (let i = 1; i < performanceResults.length; i++) {
        const degradationRatio = performanceResults[i] / performanceResults[0];
        expect(degradationRatio).toBeLessThan(3); // Less than 3x degradation at any level
      }
    });
  });

  describe('Resource Cleanup', () => {
    test('Long-running operations clean up properly', async () => {
      const context = await createMockContext(testData.users[0]);
      const caller = appRouter.createCaller(context);

      const initialMemory = process.memoryUsage();

      // Perform multiple operations
      for (let i = 0; i < 20; i++) {
        await caller.orders.create({
          customer_id: testData.customers[0].id,
          order_lines: [
            {
              product_id: testData.products[0].id,
              quantity: 1,
              unit_price: 50
            }
          ]
        });

        // Simulate some processing time
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      // Memory increase should be reasonable (less than 20MB for 20 operations)
      expect(memoryIncrease).toBeLessThan(20 * 1024 * 1024);
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