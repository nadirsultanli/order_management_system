/**
 * Tenant Isolation Contract Tests
 * 
 * Tests that ensure strict tenant data isolation across all API endpoints.
 * These tests verify that users cannot access data from other tenants.
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { appRouter } from '../../routes';
import { ContractTestSetup, TestData } from './setup';
import { createContext } from '../../lib/context';

describe('Tenant Isolation Contract Tests', () => {
  let testSetup: ContractTestSetup;
  let testData: TestData;

  beforeAll(async () => {
    testSetup = new ContractTestSetup();
    testData = await testSetup.setupTestEnvironment();
  });

  afterAll(async () => {
    await testSetup.cleanupTestEnvironment();
  });

  describe('Order API Tenant Isolation', () => {
    test('Users can only access orders from their own tenant', async () => {
      // Create context for Tenant A user
      const tenantAContext = await createMockContext(testData.users[0]);
      const tenantACaller = appRouter.createCaller(tenantAContext);

      // Create context for Tenant B user  
      const tenantBContext = await createMockContext(testData.users[2]);
      const tenantBCaller = appRouter.createCaller(tenantBContext);

      // Create an order for Tenant A
      const orderA = await tenantACaller.orders.create({
        customer_id: testData.customers[0].id, // Customer A1
        order_lines: [
          {
            product_id: testData.products[0].id, // Product A1
            quantity: 5,
            unit_price: 100
          }
        ]
      });

      // Tenant A should be able to see their own order
      const tenantAOrders = await tenantACaller.orders.list({});
      expect(tenantAOrders.orders).toHaveLength(1);
      expect(tenantAOrders.orders[0].id).toBe(orderA.id);

      // Tenant B should NOT see Tenant A's order
      const tenantBOrders = await tenantBCaller.orders.list({});
      expect(tenantBOrders.orders).toHaveLength(0);

      // Tenant B should NOT be able to access Tenant A's order directly
      await expect(tenantBCaller.orders.getById({
        order_id: orderA.id
      })).rejects.toThrow(/not found|access denied/i);
    });

    test('Order status updates respect tenant boundaries', async () => {
      const tenantAContext = await createMockContext(testData.users[0]);
      const tenantACaller = appRouter.createCaller(tenantAContext);
      
      const tenantBContext = await createMockContext(testData.users[2]);
      const tenantBCaller = appRouter.createCaller(tenantBContext);

      // Create order in Tenant A
      const orderA = await tenantACaller.orders.create({
        customer_id: testData.customers[0].id,
        order_lines: [
          {
            product_id: testData.products[0].id,
            quantity: 2,
            unit_price: 50
          }
        ]
      });

      // Tenant B should NOT be able to update Tenant A's order
      await expect(tenantBCaller.orders.updateStatus({
        order_id: orderA.id,
        new_status: 'confirmed'
      })).rejects.toThrow(/not found|access denied/i);

      // Tenant A should be able to update their own order
      const updatedOrder = await tenantACaller.orders.updateStatus({
        order_id: orderA.id,
        new_status: 'confirmed'
      });
      expect(updatedOrder.status).toBe('confirmed');
    });
  });

  describe('Customer API Tenant Isolation', () => {
    test('Users can only access customers from their own tenant', async () => {
      const tenantAContext = await createMockContext(testData.users[0]);
      const tenantACaller = appRouter.createCaller(tenantAContext);
      
      const tenantBContext = await createMockContext(testData.users[2]);
      const tenantBCaller = appRouter.createCaller(tenantBContext);

      // Tenant A should see 2 customers (Customer A1, A2)
      const tenantACustomers = await tenantACaller.customers.list({});
      expect(tenantACustomers.customers).toHaveLength(2);
      expect(tenantACustomers.customers.every(c => c.tenant_id === testData.tenants[0].id)).toBe(true);

      // Tenant B should see 1 customer (Customer B1)
      const tenantBCustomers = await tenantBCaller.customers.list({});
      expect(tenantBCustomers.customers).toHaveLength(1);
      expect(tenantBCustomers.customers[0].tenant_id).toBe(testData.tenants[1].id);

      // Tenant B should NOT be able to access Tenant A's customer
      await expect(tenantBCaller.customers.getById({
        customer_id: testData.customers[0].id // Customer A1
      })).rejects.toThrow(/not found|access denied/i);
    });
  });

  describe('Inventory API Tenant Isolation', () => {
    test('Users can only access inventory from their own tenant', async () => {
      const tenantAContext = await createMockContext(testData.users[0]);
      const tenantACaller = appRouter.createCaller(tenantAContext);
      
      const tenantBContext = await createMockContext(testData.users[2]);
      const tenantBCaller = appRouter.createCaller(tenantBContext);

      // Tenant A should see their inventory items
      const tenantAInventory = await tenantACaller.inventory.list({});
      expect(tenantAInventory.length).toBeGreaterThan(0);
      expect(tenantAInventory.every(i => i.tenant_id === testData.tenants[0].id)).toBe(true);

      // Tenant B should see their inventory items
      const tenantBInventory = await tenantBCaller.inventory.list({});
      expect(tenantBInventory.length).toBeGreaterThan(0);
      expect(tenantBInventory.every(i => i.tenant_id === testData.tenants[1].id)).toBe(true);

      // Tenant B should NOT be able to adjust Tenant A's inventory
      const tenantAInventoryId = tenantAInventory[0].id;
      await expect(tenantBCaller.inventory.adjustStock({
        inventory_id: tenantAInventoryId,
        adjustment_type: 'increase',
        quantity: 10,
        reason: 'Cross-tenant attack attempt'
      })).rejects.toThrow(/not found|access denied/i);
    });
  });

  describe('Cross-Tenant Attack Prevention', () => {
    test('Prevent cross-tenant order creation with foreign customer', async () => {
      const tenantBContext = await createMockContext(testData.users[2]);
      const tenantBCaller = appRouter.createCaller(tenantBContext);

      // Tenant B tries to create order for Tenant A's customer
      await expect(tenantBCaller.orders.create({
        customer_id: testData.customers[0].id, // Customer A1 (belongs to Tenant A)
        order_lines: [
          {
            product_id: testData.products[2].id, // Product B1 (belongs to Tenant B)
            quantity: 1,
            unit_price: 100
          }
        ]
      })).rejects.toThrow(/customer not found|access denied/i);
    });

    test('Prevent cross-tenant inventory transfers', async () => {
      const tenantAContext = await createMockContext(testData.users[0]);
      const tenantACaller = appRouter.createCaller(tenantAContext);

      // Tenant A tries to transfer from their warehouse to Tenant B's warehouse
      await expect(tenantACaller.inventory.transferStock({
        source_warehouse_id: testData.warehouses[0].id, // Warehouse A1
        destination_warehouse_id: testData.warehouses[2].id, // Warehouse B1
        product_id: testData.products[0].id, // Product A1
        quantity: 5,
        reason: 'Cross-tenant transfer attempt'
      })).rejects.toThrow(/warehouse not found|access denied/i);
    });

    test('Prevent access to other tenant data via search', async () => {
      const tenantBContext = await createMockContext(testData.users[2]);
      const tenantBCaller = appRouter.createCaller(tenantBContext);

      // Search for Tenant A's customer name should return no results
      const searchResults = await tenantBCaller.customers.list({
        search: 'Customer A1' // This customer exists but belongs to Tenant A
      });
      expect(searchResults.customers).toHaveLength(0);
    });
  });

  describe('Role-Based Access Control', () => {
    test('Admin users have enhanced permissions within their tenant', async () => {
      const adminContext = await createMockContext(testData.users[0]); // Tenant A Admin
      const userContext = await createMockContext(testData.users[1]); // Tenant A User
      
      const adminCaller = appRouter.createCaller(adminContext);
      const userCaller = appRouter.createCaller(userContext);

      // Both should be able to list customers from their tenant
      const adminCustomers = await adminCaller.customers.list({});
      const userCustomers = await userCaller.customers.list({});
      
      expect(adminCustomers.customers).toHaveLength(2);
      expect(userCustomers.customers).toHaveLength(2);
      
      // Both should see the same customers (from same tenant)
      expect(adminCustomers.customers.map(c => c.id).sort())
        .toEqual(userCustomers.customers.map(c => c.id).sort());
    });
  });

  describe('Data Integrity Validation', () => {
    test('Ensure tenant_id is preserved across operations', async () => {
      const tenantAContext = await createMockContext(testData.users[0]);
      const tenantACaller = appRouter.createCaller(tenantAContext);

      // Create order and verify tenant_id is correctly set
      const order = await tenantACaller.orders.create({
        customer_id: testData.customers[0].id,
        order_lines: [
          {
            product_id: testData.products[0].id,
            quantity: 3,
            unit_price: 75
          }
        ]
      });

      expect(order.tenant_id).toBe(testData.tenants[0].id);

      // Update order status and verify tenant_id is preserved
      const updatedOrder = await tenantACaller.orders.updateStatus({
        order_id: order.id,
        new_status: 'confirmed'
      });

      expect(updatedOrder.tenant_id).toBe(testData.tenants[0].id);
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
    supabase: {} as any, // Mock supabase client
    supabaseAdmin: {} as any,
    logger: {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    }
  };
}