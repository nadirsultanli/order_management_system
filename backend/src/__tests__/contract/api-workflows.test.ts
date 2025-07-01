/**
 * API Workflow Contract Tests
 * 
 * Tests complete business workflows to ensure APIs work together correctly
 * and maintain business rule integrity.
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { appRouter } from '../../routes';
import { ContractTestSetup, TestData } from './setup';

describe('API Workflow Contract Tests', () => {
  let testSetup: ContractTestSetup;
  let testData: TestData;

  beforeAll(async () => {
    testSetup = new ContractTestSetup();
    testData = await testSetup.setupTestEnvironment();
  });

  afterAll(async () => {
    await testSetup.cleanupTestEnvironment();
  });

  describe('Complete Order Workflow', () => {
    test('End-to-end order lifecycle with inventory management', async () => {
      const context = await createMockContext(testData.users[0]);
      const caller = appRouter.createCaller(context);

      // Step 1: Check initial inventory
      const initialInventory = await caller.inventory.list({
        product_id: testData.products[0].id
      });
      expect(initialInventory).toHaveLength(1);
      const initialStock = initialInventory[0];
      expect(initialStock.available_quantity).toBe(100);
      expect(initialStock.reserved_quantity).toBe(0);

      // Step 2: Create order (should be in draft status)
      const order = await caller.orders.create({
        customer_id: testData.customers[0].id,
        order_lines: [
          {
            product_id: testData.products[0].id,
            quantity: 10,
            unit_price: 50
          }
        ]
      });
      
      expect(order.status).toBe('draft');
      expect(order.total_amount).toBe(500); // 10 * 50
      expect(order.customer_id).toBe(testData.customers[0].id);

      // Step 3: Confirm order (should reserve inventory)
      const confirmedOrder = await caller.orders.updateStatus({
        order_id: order.id,
        new_status: 'confirmed'
      });
      
      expect(confirmedOrder.status).toBe('confirmed');

      // Verify inventory was reserved
      const reservedInventory = await caller.inventory.list({
        product_id: testData.products[0].id
      });
      expect(reservedInventory[0].available_quantity).toBe(90); // 100 - 10
      expect(reservedInventory[0].reserved_quantity).toBe(10);

      // Step 4: Schedule delivery
      const scheduledOrder = await caller.orders.updateStatus({
        order_id: order.id,
        new_status: 'scheduled',
        scheduled_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // Tomorrow
      });
      
      expect(scheduledOrder.status).toBe('scheduled');
      expect(scheduledOrder.scheduled_date).toBeDefined();

      // Step 5: Mark as en route
      const enRouteOrder = await caller.orders.updateStatus({
        order_id: order.id,
        new_status: 'en_route'
      });
      
      expect(enRouteOrder.status).toBe('en_route');

      // Step 6: Mark as delivered (should fulfill inventory)
      const deliveredOrder = await caller.orders.updateStatus({
        order_id: order.id,
        new_status: 'delivered'
      });
      
      expect(deliveredOrder.status).toBe('delivered');

      // Verify inventory was fulfilled (available reduced, reserved cleared)
      const finalInventory = await caller.inventory.list({
        product_id: testData.products[0].id
      });
      expect(finalInventory[0].available_quantity).toBe(90); // 100 - 10 (fulfilled)
      expect(finalInventory[0].reserved_quantity).toBe(0); // Reservation cleared

      // Step 7: Generate invoice
      const invoicedOrder = await caller.orders.updateStatus({
        order_id: order.id,
        new_status: 'invoiced'
      });
      
      expect(invoicedOrder.status).toBe('invoiced');
    });

    test('Order cancellation releases reserved inventory', async () => {
      const context = await createMockContext(testData.users[0]);
      const caller = appRouter.createCaller(context);

      // Create and confirm order
      const order = await caller.orders.create({
        customer_id: testData.customers[0].id,
        order_lines: [
          {
            product_id: testData.products[1].id, // Use different product
            quantity: 5,
            unit_price: 100
          }
        ]
      });

      await caller.orders.updateStatus({
        order_id: order.id,
        new_status: 'confirmed'
      });

      // Verify inventory was reserved
      const reservedInventory = await caller.inventory.list({
        product_id: testData.products[1].id
      });
      expect(reservedInventory[0].reserved_quantity).toBe(15); // 10 (initial) + 5 (new)

      // Cancel the order
      const cancelledOrder = await caller.orders.updateStatus({
        order_id: order.id,
        new_status: 'cancelled',
        reason: 'Customer requested cancellation'
      });
      
      expect(cancelledOrder.status).toBe('cancelled');

      // Verify inventory reservation was released
      const finalInventory = await caller.inventory.list({
        product_id: testData.products[1].id
      });
      expect(finalInventory[0].reserved_quantity).toBe(10); // Back to initial 10
    });
  });

  describe('Inventory Transfer Workflow', () => {
    test('Complete inventory transfer between warehouses', async () => {
      const context = await createMockContext(testData.users[0]);
      const caller = appRouter.createCaller(context);

      // Step 1: Check initial inventory in both warehouses
      const sourceInventory = await caller.inventory.getByWarehouse({
        warehouse_id: testData.warehouses[0].id
      });
      const destInventory = await caller.inventory.getByWarehouse({
        warehouse_id: testData.warehouses[1].id
      });

      const sourceProductInventory = sourceInventory.find(
        i => i.product_id === testData.products[0].id
      );
      expect(sourceProductInventory?.available_quantity).toBe(90); // From previous test

      // Step 2: Validate transfer request
      const validation = await caller.transfers.validate({
        source_warehouse_id: testData.warehouses[0].id,
        destination_warehouse_id: testData.warehouses[1].id,
        items: [
          {
            product_id: testData.products[0].id,
            quantity: 20
          }
        ]
      });

      expect(validation.is_valid).toBe(true);
      expect(validation.blocked_items).toHaveLength(0);

      // Step 3: Execute transfer
      const transfer = await caller.transfers.create({
        source_warehouse_id: testData.warehouses[0].id,
        destination_warehouse_id: testData.warehouses[1].id,
        transfer_date: new Date().toISOString(),
        items: [
          {
            product_id: testData.products[0].id,
            quantity: 20
          }
        ]
      });

      expect(transfer.status).toBe('pending');

      // Step 4: Update transfer status to completed
      const completedTransfer = await caller.transfers.updateStatus({
        transfer_id: transfer.id,
        new_status: 'completed'
      });

      expect(completedTransfer.status).toBe('completed');

      // Step 5: Verify inventory was updated in both warehouses
      const updatedSourceInventory = await caller.inventory.getByWarehouse({
        warehouse_id: testData.warehouses[0].id
      });
      const updatedDestInventory = await caller.inventory.getByWarehouse({
        warehouse_id: testData.warehouses[1].id
      });

      const updatedSourceProduct = updatedSourceInventory.find(
        i => i.product_id === testData.products[0].id
      );
      const updatedDestProduct = updatedDestInventory.find(
        i => i.product_id === testData.products[0].id
      );

      expect(updatedSourceProduct?.available_quantity).toBe(70); // 90 - 20
      expect(updatedDestProduct?.available_quantity).toBe(20); // 0 + 20 (new)
    });
  });

  describe('Pricing Calculation Workflow', () => {
    test('Dynamic pricing with customer tiers and bulk discounts', async () => {
      const context = await createMockContext(testData.users[0]);
      const caller = appRouter.createCaller(context);

      // Calculate pricing for different quantities
      const smallOrderPricing = await caller.pricing.calculate({
        customer_id: testData.customers[0].id,
        items: [
          {
            product_id: testData.products[0].id,
            quantity: 5
          }
        ]
      });

      const bulkOrderPricing = await caller.pricing.calculate({
        customer_id: testData.customers[0].id,
        items: [
          {
            product_id: testData.products[0].id,
            quantity: 100 // Bulk quantity
          }
        ]
      });

      // Bulk pricing should have lower unit price
      const smallUnitPrice = smallOrderPricing.items[0].unit_price;
      const bulkUnitPrice = bulkOrderPricing.items[0].unit_price;
      
      expect(bulkUnitPrice).toBeLessThan(smallUnitPrice);
      expect(bulkOrderPricing.total_amount).toBeGreaterThan(smallOrderPricing.total_amount);
    });
  });

  describe('Customer Analytics Workflow', () => {
    test('Customer analytics calculation after multiple orders', async () => {
      const context = await createMockContext(testData.users[0]);
      const caller = appRouter.createCaller(context);

      // Create multiple orders for the same customer
      const order1 = await caller.orders.create({
        customer_id: testData.customers[0].id,
        order_lines: [
          {
            product_id: testData.products[0].id,
            quantity: 5,
            unit_price: 100
          }
        ]
      });

      const order2 = await caller.orders.create({
        customer_id: testData.customers[0].id,
        order_lines: [
          {
            product_id: testData.products[1].id,
            quantity: 3,
            unit_price: 150
          }
        ]
      });

      // Mark orders as delivered
      await caller.orders.updateStatus({
        order_id: order1.id,
        new_status: 'delivered'
      });

      await caller.orders.updateStatus({
        order_id: order2.id,
        new_status: 'delivered'
      });

      // Get customer analytics
      const analytics = await caller.customers.getAnalytics({
        customer_id: testData.customers[0].id,
        period: 'year'
      });

      expect(analytics.lifetime_value).toBeGreaterThan(900); // 500 + 450 + previous orders
      expect(analytics.order_frequency).toBeGreaterThan(0);
      expect(analytics.average_order_value).toBeGreaterThan(0);
    });
  });

  describe('Dashboard Statistics Integration', () => {
    test('Dashboard stats reflect all business operations', async () => {
      const context = await createMockContext(testData.users[0]);
      const caller = appRouter.createCaller(context);

      // Get dashboard stats for the month
      const stats = await caller.analytics.getDashboardStats({
        period: 'month'
      });

      // Should have orders data
      expect(stats.orders).toBeDefined();
      expect(stats.orders.total_count).toBeGreaterThan(0);
      expect(stats.orders.total_revenue).toBeGreaterThan(0);

      // Should have inventory data
      expect(stats.inventory).toBeDefined();
      expect(stats.inventory.total_products).toBeGreaterThan(0);

      // Should have customer data
      expect(stats.customers).toBeDefined();
      expect(stats.customers.total_count).toBeGreaterThan(0);
    });
  });

  describe('Error Handling and Recovery', () => {
    test('Order creation fails gracefully with invalid customer', async () => {
      const context = await createMockContext(testData.users[0]);
      const caller = appRouter.createCaller(context);

      await expect(caller.orders.create({
        customer_id: '99999999-9999-9999-9999-999999999999', // Non-existent customer
        order_lines: [
          {
            product_id: testData.products[0].id,
            quantity: 1,
            unit_price: 100
          }
        ]
      })).rejects.toThrow(/customer not found/i);
    });

    test('Inventory adjustment handles invalid quantities gracefully', async () => {
      const context = await createMockContext(testData.users[0]);
      const caller = appRouter.createCaller(context);

      const inventory = await caller.inventory.list({
        product_id: testData.products[0].id
      });

      // Try to decrease inventory below zero
      await expect(caller.inventory.adjustStock({
        inventory_id: inventory[0].id,
        adjustment_type: 'decrease',
        quantity: 1000, // More than available
        reason: 'Test invalid adjustment'
      })).rejects.toThrow(/insufficient/i);
    });
  });

  describe('Idempotency Testing', () => {
    test('Order status updates are idempotent', async () => {
      const context = await createMockContext(testData.users[0]);
      const caller = appRouter.createCaller(context);

      const order = await caller.orders.create({
        customer_id: testData.customers[0].id,
        order_lines: [
          {
            product_id: testData.products[0].id,
            quantity: 2,
            unit_price: 75
          }
        ]
      });

      // Confirm the order
      const confirmed1 = await caller.orders.updateStatus({
        order_id: order.id,
        new_status: 'confirmed'
      });

      // Try to confirm again - should not cause errors
      const confirmed2 = await caller.orders.updateStatus({
        order_id: order.id,
        new_status: 'confirmed'
      });

      expect(confirmed1.status).toBe('confirmed');
      expect(confirmed2.status).toBe('confirmed');
      expect(confirmed1.updated_at).toBe(confirmed2.updated_at); // Should be idempotent
    });

    test('Order total calculations are idempotent', async () => {
      const context = await createMockContext(testData.users[0]);
      const caller = appRouter.createCaller(context);

      const order = await caller.orders.create({
        customer_id: testData.customers[0].id,
        order_lines: [
          {
            product_id: testData.products[0].id,
            quantity: 4,
            unit_price: 125
          }
        ]
      });

      // Calculate total multiple times
      const calc1 = await caller.orders.calculateTotal({
        order_id: order.id
      });

      const calc2 = await caller.orders.calculateTotal({
        order_id: order.id
      });

      expect(calc1.total_amount).toBe(calc2.total_amount);
      expect(calc1.subtotal).toBe(calc2.subtotal);
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
    supabase: {} as any, // Mock supabase client - would need proper mocking in real tests
    supabaseAdmin: {} as any,
    logger: {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    }
  };
}