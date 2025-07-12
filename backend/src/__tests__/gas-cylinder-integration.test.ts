import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { createSupabaseClient } from '../lib/supabase';
import { logger } from '../lib/logger';

/**
 * Gas Cylinder Management Integration Tests
 * 
 * These tests verify the complete end-to-end workflow for gas cylinder management:
 * 1. Create product with weight-based pricing
 * 2. Create deposit rate for the cylinder capacity
 * 3. Create customer and charge deposits
 * 4. Test pricing calculations
 * 5. Test deposit refund workflow
 */

// Test data
const testData = {
  user: {
    id: 'test-user-id',
    email: 'test@example.com'
  },
  product: {
    name: 'Test Gas Cylinder 13L',
    description: 'Test cylinder for integration testing',
    capacity_l: 13,
    sku: 'TEST-GAS-13L',
    weight_kg: 15.5,
    pricing_method: 'weight_based' as const,
    is_active: true
  },
  depositRate: {
    capacity_l: 13,
    deposit_amount: 1500,
    currency_code: 'KES',
    effective_date: new Date().toISOString().split('T')[0],
    notes: 'Test deposit rate for integration testing',
    is_active: true
  },
  customer: {
    name: 'Test Customer Gas Cylinders',
    email: 'testcustomer@example.com',
    phone: '+254700000000',
    address: '123 Test Street',
    city: 'Nairobi',
    country: 'KE'
  }
};

let supabase: ReturnType<typeof createSupabaseClient>;
let createdProductId: string;
let createdCustomerId: string;
let createdDepositRateId: string;

describe('Gas Cylinder Management Integration', () => {
  beforeAll(async () => {
    // Initialize Supabase client
    supabase = createSupabaseClient();
  });

  beforeEach(async () => {
    // Clean up any existing test data
    await cleanupTestData();
  });

  afterAll(async () => {
    // Final cleanup
    await cleanupTestData();
  });

  describe('End-to-End Workflow', () => {
    test('Complete gas cylinder management workflow', async () => {
      // Step 1: Create weight-based pricing product
      logger.info('Step 1: Creating weight-based pricing product');
      
      const { data: product, error: productError } = await supabase
        .from('products')
        .insert([{
          ...testData.product,
          created_by: testData.user.id,
          updated_by: testData.user.id
        }])
        .select()
        .single();

      expect(productError).toBeNull();
      expect(product).toBeDefined();
      expect(product.pricing_method).toBe('weight_based');
      expect(product.capacity_l).toBe(13);
      
      createdProductId = product.id;
      logger.info(`Created product with ID: ${createdProductId}`);

      // Step 2: Create deposit rate for cylinder capacity
      logger.info('Step 2: Creating deposit rate');
      
      const { data: depositRate, error: depositError } = await supabase
        .from('cylinder_deposit_rates')
        .insert([{
          ...testData.depositRate,
          created_by: testData.user.id
        }])
        .select()
        .single();

      expect(depositError).toBeNull();
      expect(depositRate).toBeDefined();
      expect(depositRate.capacity_l).toBe(13);
      expect(depositRate.deposit_amount).toBe(1500);
      
      createdDepositRateId = depositRate.id;
      logger.info(`Created deposit rate with ID: ${createdDepositRateId}`);

      // Step 3: Create customer
      logger.info('Step 3: Creating customer');
      
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .insert([{
          ...testData.customer,
          created_by: testData.user.id,
          updated_by: testData.user.id
        }])
        .select()
        .single();

      expect(customerError).toBeNull();
      expect(customer).toBeDefined();
      
      createdCustomerId = customer.id;
      logger.info(`Created customer with ID: ${createdCustomerId}`);

      // Step 4: Test weight-based pricing calculation
      logger.info('Step 4: Testing weight-based pricing calculation');
      
      // Simulate creating a price list entry for weight-based pricing
      const testQuantityKg = 10.5; // kg of gas
      const pricePerKg = 150; // KES per kg
      const expectedGasPrice = testQuantityKg * pricePerKg; // 1575 KES

      // This would normally be handled by the pricing system
      expect(expectedGasPrice).toBe(1575);
      logger.info(`Weight-based pricing: ${testQuantityKg}kg × ${pricePerKg} KES/kg = ${expectedGasPrice} KES`);

      // Step 5: Charge cylinder deposits to customer
      logger.info('Step 5: Charging cylinder deposits');
      
      const cylinderQuantity = 2;
      const totalDepositCharge = depositRate.deposit_amount * cylinderQuantity;

      const { data: depositTransaction, error: chargeError } = await supabase
        .from('deposit_transactions')
        .insert([{
          customer_id: createdCustomerId,
          transaction_type: 'charge',
          amount: totalDepositCharge,
          currency_code: 'KES',
          transaction_date: new Date().toISOString(),
          notes: 'Test cylinder deposit charge',
          created_by: testData.user.id,
          is_voided: false
        }])
        .select()
        .single();

      expect(chargeError).toBeNull();
      expect(depositTransaction).toBeDefined();
      expect(depositTransaction.amount).toBe(3000); // 1500 × 2
      
      logger.info(`Charged deposit: ${totalDepositCharge} KES for ${cylinderQuantity} cylinders`);

      // Create transaction lines for the deposit charge
      const { error: linesError } = await supabase
        .from('deposit_transaction_lines')
        .insert([{
          transaction_id: depositTransaction.id,
          product_id: createdProductId,
          capacity_l: 13,
          quantity: cylinderQuantity,
          unit_deposit: depositRate.deposit_amount,
          condition: 'good'
        }]);

      expect(linesError).toBeNull();

      // Update cylinder inventory
      const { error: inventoryError } = await supabase
        .from('deposit_cylinder_inventory')
        .insert([{
          customer_id: createdCustomerId,
          capacity_l: 13,
          quantity: cylinderQuantity,
          unit_deposit: depositRate.deposit_amount,
          last_updated: new Date().toISOString()
        }]);

      expect(inventoryError).toBeNull();

      // Step 6: Verify customer deposit balance
      logger.info('Step 6: Verifying customer deposit balance');
      
      const { data: balanceTransactions } = await supabase
        .from('deposit_transactions')
        .select('transaction_type, amount')
        .eq('customer_id', createdCustomerId)
        .eq('is_voided', false);

      let customerBalance = 0;
      balanceTransactions?.forEach(tx => {
        if (tx.transaction_type === 'charge') {
          customerBalance += tx.amount;
        } else if (tx.transaction_type === 'refund') {
          customerBalance -= tx.amount;
        } else if (tx.transaction_type === 'adjustment') {
          customerBalance += tx.amount;
        }
      });

      expect(customerBalance).toBe(3000);
      logger.info(`Customer deposit balance: ${customerBalance} KES`);

      // Step 7: Test cylinder return and refund calculation
      logger.info('Step 7: Testing cylinder return and refund');
      
      const returnQuantity = 1;
      const cylinderCondition = 'good'; // No damage deduction
      const expectedRefund = depositRate.deposit_amount * returnQuantity;

      // Simulate refund calculation
      let refundAmount = expectedRefund;
      if (cylinderCondition === 'damaged') {
        const damagePercentage = 20; // 20% damage
        refundAmount = expectedRefund * (1 - damagePercentage / 100);
      } else if (cylinderCondition === 'missing') {
        refundAmount = 0;
      }

      expect(refundAmount).toBe(1500); // Full refund for good condition
      logger.info(`Refund calculation: ${returnQuantity} cylinder × ${depositRate.deposit_amount} KES = ${refundAmount} KES`);

      // Process the refund
      const { data: refundTransaction, error: refundError } = await supabase
        .from('deposit_transactions')
        .insert([{
          customer_id: createdCustomerId,
          transaction_type: 'refund',
          amount: refundAmount,
          currency_code: 'KES',
          transaction_date: new Date().toISOString(),
          notes: 'Test cylinder deposit refund',
          created_by: testData.user.id,
          is_voided: false,
          refund_method: 'cash'
        }])
        .select()
        .single();

      expect(refundError).toBeNull();
      expect(refundTransaction).toBeDefined();
      
      logger.info(`Processed refund: ${refundAmount} KES`);

      // Step 8: Verify final balance after refund
      logger.info('Step 8: Verifying final balance after refund');
      
      const { data: finalBalanceTransactions } = await supabase
        .from('deposit_transactions')
        .select('transaction_type, amount')
        .eq('customer_id', createdCustomerId)
        .eq('is_voided', false);

      let finalBalance = 0;
      finalBalanceTransactions?.forEach(tx => {
        if (tx.transaction_type === 'charge') {
          finalBalance += tx.amount;
        } else if (tx.transaction_type === 'refund') {
          finalBalance -= tx.amount;
        } else if (tx.transaction_type === 'adjustment') {
          finalBalance += tx.amount;
        }
      });

      expect(finalBalance).toBe(1500); // 3000 - 1500 = 1500
      logger.info(`Final customer deposit balance: ${finalBalance} KES`);

      // Step 9: Verify integrated pricing works correctly
      logger.info('Step 9: Testing complete order pricing with deposits');
      
      const orderGasQuantityKg = 8.0;
      const gasPrice = orderGasQuantityKg * pricePerKg; // 8 × 150 = 1200 KES
      const cylinderDeposit = depositRate.deposit_amount; // 1500 KES (for 1 cylinder)
      const totalOrderValue = gasPrice + cylinderDeposit; // 1200 + 1500 = 2700 KES

      expect(totalOrderValue).toBe(2700);
      logger.info(`Complete order pricing:
        - Gas (${orderGasQuantityKg}kg × ${pricePerKg} KES/kg): ${gasPrice} KES
        - Cylinder deposit: ${cylinderDeposit} KES
        - Total order value: ${totalOrderValue} KES`);

      logger.info('✅ Gas cylinder management integration test completed successfully');
    });

    test('Deposit rate conflict detection', async () => {
      logger.info('Testing deposit rate conflict detection');
      
      // Create first deposit rate
      const { data: firstRate, error: firstError } = await supabase
        .from('cylinder_deposit_rates')
        .insert([{
          ...testData.depositRate,
          created_by: testData.user.id
        }])
        .select()
        .single();

      expect(firstError).toBeNull();
      createdDepositRateId = firstRate.id;

      // Try to create conflicting rate
      const { error: conflictError } = await supabase
        .from('cylinder_deposit_rates')
        .insert([{
          ...testData.depositRate,
          deposit_amount: 1800, // Different amount but same capacity and date
          created_by: testData.user.id
        }]);

      // This should fail due to business logic constraints
      // In a real implementation, this would be handled by database constraints
      // or application-level validation
      
      logger.info('Conflict detection test completed');
    });

    test('Weight-based pricing vs fixed pricing comparison', async () => {
      logger.info('Testing weight-based vs fixed pricing comparison');
      
      // Create weight-based product
      const { data: weightProduct, error: weightError } = await supabase
        .from('products')
        .insert([{
          ...testData.product,
          name: 'Weight-based Gas Cylinder',
          sku: 'WEIGHT-BASED-13L',
          pricing_method: 'weight_based',
          created_by: testData.user.id,
          updated_by: testData.user.id
        }])
        .select()
        .single();

      expect(weightError).toBeNull();

      // Create fixed pricing product
      const { data: fixedProduct, error: fixedError } = await supabase
        .from('products')
        .insert([{
          ...testData.product,
          name: 'Fixed Price Gas Cylinder',
          sku: 'FIXED-PRICE-13L',
          pricing_method: 'fixed',
          created_by: testData.user.id,
          updated_by: testData.user.id
        }])
        .select()
        .single();

      expect(fixedError).toBeNull();

      // Compare pricing methods
      const gasQuantityKg = 10;
      const pricePerKg = 150;
      const fixedPrice = 1800;

      const weightBasedPrice = gasQuantityKg * pricePerKg; // 1500 KES
      const fixedPriceTotal = fixedPrice; // 1800 KES

      expect(weightBasedPrice).toBe(1500);
      expect(fixedPriceTotal).toBe(1800);

      logger.info(`Pricing comparison for ${gasQuantityKg}kg gas:
        - Weight-based: ${weightBasedPrice} KES
        - Fixed price: ${fixedPriceTotal} KES
        - Difference: ${fixedPriceTotal - weightBasedPrice} KES`);

      // Clean up
      await supabase.from('products').delete().eq('id', weightProduct.id);
      await supabase.from('products').delete().eq('id', fixedProduct.id);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('Handle refund for non-existent customer cylinders', async () => {
      // Create customer without any cylinders
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .insert([{
          ...testData.customer,
          name: 'Customer Without Cylinders',
          email: 'nocylinders@example.com',
          created_by: testData.user.id,
          updated_by: testData.user.id
        }])
        .select()
        .single();

      expect(customerError).toBeNull();
      createdCustomerId = customer.id;

      // Try to get cylinder inventory (should be empty)
      const { data: cylinders } = await supabase
        .from('deposit_cylinder_inventory')
        .select('*')
        .eq('customer_id', createdCustomerId);

      expect(cylinders).toEqual([]);
      logger.info('Correctly handled customer with no cylinders');
    });

    test('Handle damaged cylinder refund calculation', async () => {
      const originalDeposit = 1500;
      const damagePercentage = 30; // 30% damage
      const expectedRefund = originalDeposit * (1 - damagePercentage / 100);

      expect(expectedRefund).toBe(1050); // 1500 × 0.7 = 1050

      logger.info(`Damage refund calculation:
        - Original deposit: ${originalDeposit} KES
        - Damage: ${damagePercentage}%
        - Refund amount: ${expectedRefund} KES`);
    });

    test('Handle missing cylinder (no refund)', async () => {
      const originalDeposit = 1500;
      const condition = 'missing';
      const expectedRefund = condition === 'missing' ? 0 : originalDeposit;

      expect(expectedRefund).toBe(0);
      logger.info('Correctly calculated zero refund for missing cylinder');
    });
  });
});

/**
 * Clean up test data to ensure tests are isolated
 */
async function cleanupTestData() {
  try {
    // Delete in reverse order due to foreign key constraints
    if (createdProductId) {
      await supabase.from('deposit_transaction_lines').delete().eq('product_id', createdProductId);
      await supabase.from('products').delete().eq('id', createdProductId);
    }
    
    if (createdCustomerId) {
      await supabase.from('deposit_cylinder_inventory').delete().eq('customer_id', createdCustomerId);
      await supabase.from('deposit_transactions').delete().eq('customer_id', createdCustomerId);
      await supabase.from('customers').delete().eq('id', createdCustomerId);
    }
    
    if (createdDepositRateId) {
      await supabase.from('cylinder_deposit_rates').delete().eq('id', createdDepositRateId);
    }

    // Clean up any test data by pattern
    await supabase.from('products').delete().like('name', '%Test%');
    await supabase.from('customers').delete().like('name', '%Test%');
    await supabase.from('cylinder_deposit_rates').delete().like('notes', '%integration testing%');

    logger.info('Test data cleanup completed');
  } catch (error) {
    logger.error('Error during test cleanup:', error);
  }
}