import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createClient } from '@supabase/supabase-js';

// Test configuration
const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:54321';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'your-anon-key';

describe('Transfer Atomicity and Validation', () => {
  let supabase: any;
  let testWarehouse1: any;
  let testWarehouse2: any;
  let testTruck: any;
  let testProduct: any;
  let initialInventory: any;

  beforeEach(async () => {
    supabase = createClient(supabaseUrl, supabaseKey);

    // Create test warehouses
    const { data: warehouse1 } = await supabase
      .from('warehouses')
      .insert([{ name: 'Test Warehouse 1', address: 'Test Address 1' }])
      .select()
      .single();
    testWarehouse1 = warehouse1;

    const { data: warehouse2 } = await supabase
      .from('warehouses')
      .insert([{ name: 'Test Warehouse 2', address: 'Test Address 2' }])
      .select()
      .single();
    testWarehouse2 = warehouse2;

    // Create test truck
    const { data: truck } = await supabase
      .from('truck')
      .insert([{
        fleet_number: 'TEST-001',
        license_plate: 'TEST-001',
        capacity_cylinders: 100,
        driver_name: 'Test Driver',
        active: true
      }])
      .select()
      .single();
    testTruck = truck;

    // Create test product
    const { data: product } = await supabase
      .from('products')
      .insert([{
        sku: 'TEST-CYLINDER-001',
        name: 'Test Cylinder 6kg',
        capacity_kg: 6,
        tare_weight_kg: 10,
        variant_type: 'cylinder',
        status: 'active',
        unit_of_measure: 'cylinder',
        requires_tag: false,
        is_variant: false
      }])
      .select()
      .single();
    testProduct = product;

    // Create initial inventory in warehouse 1
    const { data: inventory } = await supabase
      .from('inventory_balance')
      .insert([{
        warehouse_id: testWarehouse1.id,
        product_id: testProduct.id,
        qty_full: 100,
        qty_empty: 50,
        qty_reserved: 10
      }])
      .select()
      .single();
    initialInventory = inventory;
  });

  afterEach(async () => {
    // Clean up test data
    if (initialInventory) {
      await supabase.from('inventory_balance').delete().eq('id', initialInventory.id);
    }
    if (testProduct) {
      await supabase.from('products').delete().eq('id', testProduct.id);
    }
    if (testTruck) {
      await supabase.from('truck').delete().eq('id', testTruck.id);
    }
    if (testWarehouse1) {
      await supabase.from('warehouses').delete().eq('id', testWarehouse1.id);
    }
    if (testWarehouse2) {
      await supabase.from('warehouses').delete().eq('id', testWarehouse2.id);
    }
  });

  describe('Warehouse-to-Warehouse Transfers', () => {
    it('should atomically transfer inventory between warehouses', async () => {
      const transferQty = 20;

      // Execute transfer
      const { data: result, error } = await supabase.rpc('transfer_stock', {
        p_from_warehouse_id: testWarehouse1.id,
        p_to_warehouse_id: testWarehouse2.id,
        p_product_id: testProduct.id,
        p_qty_full: transferQty,
        p_qty_empty: 0
      });

      expect(error).toBeNull();
      expect(result).toBeTruthy();
      expect(result.success).toBe(true);
      expect(result.qty_full_transferred).toBe(transferQty);

      // Verify source warehouse inventory decreased
      const { data: sourceInventory } = await supabase
        .from('inventory_balance')
        .select('*')
        .eq('warehouse_id', testWarehouse1.id)
        .eq('product_id', testProduct.id)
        .single();

      expect(sourceInventory.qty_full).toBe(100 - transferQty);
      expect(sourceInventory.qty_empty).toBe(50);
      expect(sourceInventory.qty_reserved).toBe(10);

      // Verify destination warehouse inventory increased
      const { data: destInventory } = await supabase
        .from('inventory_balance')
        .select('*')
        .eq('warehouse_id', testWarehouse2.id)
        .eq('product_id', testProduct.id)
        .single();

      expect(destInventory.qty_full).toBe(transferQty);
      expect(destInventory.qty_empty).toBe(0);
      expect(destInventory.qty_reserved).toBe(0);

      // Verify stock movements were logged
      const { data: movements, count } = await supabase
        .from('stock_movements')
        .select('*', { count: 'exact' })
        .in('inventory_id', [sourceInventory.id, destInventory.id])
        .eq('reference_type', 'transfer');

      expect(count).toBe(2); // One movement for source (out), one for destination (in)
    });

    it('should prevent transfers that would result in negative inventory', async () => {
      const transferQty = 150; // More than available (100)

      const { data: result, error } = await supabase.rpc('transfer_stock', {
        p_from_warehouse_id: testWarehouse1.id,
        p_to_warehouse_id: testWarehouse2.id,
        p_product_id: testProduct.id,
        p_qty_full: transferQty,
        p_qty_empty: 0
      });

      expect(error).toBeTruthy();
      expect(error.message).toContain('Insufficient full stock');

      // Verify source inventory unchanged
      const { data: sourceInventory } = await supabase
        .from('inventory_balance')
        .select('*')
        .eq('warehouse_id', testWarehouse1.id)
        .eq('product_id', testProduct.id)
        .single();

      expect(sourceInventory.qty_full).toBe(100);
      expect(sourceInventory.qty_empty).toBe(50);
    });

    it('should prevent transfers that would leave insufficient stock for reservations', async () => {
      const transferQty = 95; // Would leave 5, but need 10 for reservations

      const { data: result, error } = await supabase.rpc('transfer_stock', {
        p_from_warehouse_id: testWarehouse1.id,
        p_to_warehouse_id: testWarehouse2.id,
        p_product_id: testProduct.id,
        p_qty_full: transferQty,
        p_qty_empty: 0
      });

      expect(error).toBeTruthy();
      expect(error.message).toContain('insufficient stock for reservations');

      // Verify source inventory unchanged
      const { data: sourceInventory } = await supabase
        .from('inventory_balance')
        .select('*')
        .eq('warehouse_id', testWarehouse1.id)
        .eq('product_id', testProduct.id)
        .single();

      expect(sourceInventory.qty_full).toBe(100);
      expect(sourceInventory.qty_reserved).toBe(10);
    });

    it('should validate transfer inputs', async () => {
      // Test negative quantities
      const { error: negativeError } = await supabase.rpc('transfer_stock', {
        p_from_warehouse_id: testWarehouse1.id,
        p_to_warehouse_id: testWarehouse2.id,
        p_product_id: testProduct.id,
        p_qty_full: -5,
        p_qty_empty: 0
      });

      expect(negativeError).toBeTruthy();
      expect(negativeError.message).toContain('cannot be negative');

      // Test same warehouse transfer
      const { error: sameWarehouseError } = await supabase.rpc('transfer_stock', {
        p_from_warehouse_id: testWarehouse1.id,
        p_to_warehouse_id: testWarehouse1.id,
        p_product_id: testProduct.id,
        p_qty_full: 10,
        p_qty_empty: 0
      });

      expect(sameWarehouseError).toBeTruthy();
      expect(sameWarehouseError.message).toContain('must be different');

      // Test zero quantities
      const { error: zeroError } = await supabase.rpc('transfer_stock', {
        p_from_warehouse_id: testWarehouse1.id,
        p_to_warehouse_id: testWarehouse2.id,
        p_product_id: testProduct.id,
        p_qty_full: 0,
        p_qty_empty: 0
      });

      expect(zeroError).toBeTruthy();
      expect(zeroError.message).toContain('cannot both be zero');
    });
  });

  describe('Warehouse-to-Truck Transfers', () => {
    it('should atomically transfer inventory from warehouse to truck', async () => {
      const transferQty = 15;

      // Execute transfer to truck
      const { data: result, error } = await supabase.rpc('transfer_stock_to_truck', {
        p_from_warehouse_id: testWarehouse1.id,
        p_to_truck_id: testTruck.id,
        p_product_id: testProduct.id,
        p_qty_full: transferQty,
        p_qty_empty: 0
      });

      expect(error).toBeNull();
      expect(result).toBeTruthy();
      expect(result.success).toBe(true);
      expect(result.qty_full_transferred).toBe(transferQty);

      // Verify source warehouse inventory decreased
      const { data: sourceInventory } = await supabase
        .from('inventory_balance')
        .select('*')
        .eq('warehouse_id', testWarehouse1.id)
        .eq('product_id', testProduct.id)
        .single();

      expect(sourceInventory.qty_full).toBe(100 - transferQty);

      // Verify truck inventory increased
      const { data: truckInventory } = await supabase
        .from('truck_inventory')
        .select('*')
        .eq('truck_id', testTruck.id)
        .eq('product_id', testProduct.id)
        .single();

      expect(truckInventory.qty_full).toBe(transferQty);
      expect(truckInventory.qty_empty).toBe(0);
    });

    it('should prevent transfers to inactive trucks', async () => {
      // Deactivate truck
      await supabase
        .from('truck')
        .update({ active: false })
        .eq('id', testTruck.id);

      const { data: result, error } = await supabase.rpc('transfer_stock_to_truck', {
        p_from_warehouse_id: testWarehouse1.id,
        p_to_truck_id: testTruck.id,
        p_product_id: testProduct.id,
        p_qty_full: 10,
        p_qty_empty: 0
      });

      expect(error).toBeTruthy();
      expect(error.message).toContain('not found or inactive');

      // Reactivate for cleanup
      await supabase
        .from('truck')
        .update({ active: true })
        .eq('id', testTruck.id);
    });
  });

  describe('Transfer Validation Function', () => {
    it('should validate transfer requests without executing them', async () => {
      // Valid transfer
      const { data: validResult, error: validError } = await supabase.rpc('validate_transfer_request', {
        p_from_warehouse_id: testWarehouse1.id,
        p_to_warehouse_id: testWarehouse2.id,
        p_product_id: testProduct.id,
        p_qty_full: 20,
        p_qty_empty: 0
      });

      expect(validError).toBeNull();
      expect(validResult.is_valid).toBe(true);
      expect(validResult.errors.length).toBe(0);
      expect(validResult.source_stock).toBeTruthy();
      expect(validResult.source_stock.qty_full).toBe(100);

      // Invalid transfer (too much)
      const { data: invalidResult, error: invalidError } = await supabase.rpc('validate_transfer_request', {
        p_from_warehouse_id: testWarehouse1.id,
        p_to_warehouse_id: testWarehouse2.id,
        p_product_id: testProduct.id,
        p_qty_full: 150,
        p_qty_empty: 0
      });

      expect(invalidError).toBeNull();
      expect(invalidResult.is_valid).toBe(false);
      expect(invalidResult.errors.length).toBeGreaterThan(0);
      expect(invalidResult.errors[0]).toContain('Insufficient');

      // Verify inventory unchanged after validation
      const { data: inventory } = await supabase
        .from('inventory_balance')
        .select('*')
        .eq('warehouse_id', testWarehouse1.id)
        .eq('product_id', testProduct.id)
        .single();

      expect(inventory.qty_full).toBe(100);
    });
  });

  describe('Atomicity Under Concurrent Operations', () => {
    it('should handle concurrent transfer attempts safely', async () => {
      const transferQty = 60; // Each transfer would be valid alone, but together would exceed available

      // Start two concurrent transfers
      const transfer1Promise = supabase.rpc('transfer_stock', {
        p_from_warehouse_id: testWarehouse1.id,
        p_to_warehouse_id: testWarehouse2.id,
        p_product_id: testProduct.id,
        p_qty_full: transferQty,
        p_qty_empty: 0
      });

      const transfer2Promise = supabase.rpc('transfer_stock', {
        p_from_warehouse_id: testWarehouse1.id,
        p_to_warehouse_id: testWarehouse2.id,
        p_product_id: testProduct.id,
        p_qty_full: transferQty,
        p_qty_empty: 0
      });

      const [result1, result2] = await Promise.allSettled([transfer1Promise, transfer2Promise]);

      // One should succeed, one should fail
      const successCount = [result1, result2].filter(r => r.status === 'fulfilled' && !r.value.error).length;
      const failureCount = [result1, result2].filter(r => r.status === 'rejected' || r.value.error).length;

      expect(successCount).toBe(1);
      expect(failureCount).toBe(1);

      // Verify final inventory state is consistent
      const { data: finalInventory } = await supabase
        .from('inventory_balance')
        .select('*')
        .eq('warehouse_id', testWarehouse1.id)
        .eq('product_id', testProduct.id)
        .single();

      // Should have exactly 40 left (100 - 60)
      expect(finalInventory.qty_full).toBe(40);
    });
  });
});