const { appRouter } = require('./src/index');
const { createContext } = require('./src/lib/context');

const PRODUCT_ID = '4f122983-af2d-4452-ad61-1d49acb816fc'; // 13kg Propane FULL-XCH

// Mock user for testing
const mockUser = {
  id: '8353246b-b0b8-4508-8b06-bd9d3dc18381',
  email: 'nadir@circleteam.com',
  role: 'authenticated'
};

async function testPricingSystem() {
  console.log('🧪 Testing Complete Pricing System with tRPC Direct Calls');
  console.log('Product ID:', PRODUCT_ID);
  console.log('=' .repeat(80));

  try {
    // Create context with mock user
    const ctx = await createContext({
      headers: {
        authorization: `Bearer mock-token`
      }
    });

    // Override the user in context for testing
    ctx.user = mockUser;

    // Test 1: Get Product Details
    console.log('\n📋 1. Getting Product Details...');
    const productDetails = await appRouter.createCaller(ctx).products.getById({ id: PRODUCT_ID });
    console.log('✅ Product Details:', {
      id: productDetails.id,
      name: productDetails.name,
      sku: productDetails.sku,
      capacity_kg: productDetails.capacity_kg,
      tare_weight_kg: productDetails.tare_weight_kg,
      gross_weight_kg: productDetails.gross_weight_kg,
      net_gas_weight_kg: productDetails.net_gas_weight_kg,
      sku_variant: productDetails.sku_variant,
      variant: productDetails.variant,
      tax_rate: productDetails.tax_rate,
      tax_category: productDetails.tax_category
    });

    // Test 2: Get Deposit Rate for 13L capacity
    console.log('\n💰 2. Getting Deposit Rate for 13L capacity...');
    const depositRate = await appRouter.createCaller(ctx).pricing.getDepositRate({ 
      capacity_l: 13,
      currency_code: 'KES',
      as_of_date: new Date().toISOString().split('T')[0]
    });
    console.log('✅ Deposit Rate:', {
      capacity_l: depositRate.capacity_l,
      deposit_amount: depositRate.deposit_amount,
      currency_code: depositRate.currency_code,
      as_of_date: depositRate.as_of_date
    });

    // Test 3: Weight-based Pricing Calculation
    console.log('\n⚖️ 3. Weight-based Pricing Calculation...');
    const weightBasedPricing = await appRouter.createCaller(ctx).pricing.calculateWeightBased({
      product_id: PRODUCT_ID,
      quantity: 1,
      customer_id: undefined,
      pricing_date: new Date().toISOString().split('T')[0]
    });
    console.log('✅ Weight-based Pricing:', {
      net_gas_weight_kg: weightBasedPricing.net_gas_weight_kg,
      gas_price_per_kg: weightBasedPricing.gas_price_per_kg,
      gas_charge: weightBasedPricing.gas_charge,
      deposit_amount: weightBasedPricing.deposit_amount,
      subtotal: weightBasedPricing.subtotal,
      tax_amount: weightBasedPricing.tax_amount,
      total_price: weightBasedPricing.total_price,
      pricing_method: weightBasedPricing.pricing_method
    });

    // Test 4: Calculate Total with Deposits (Outright)
    console.log('\n🛒 4. Calculate Total with Deposits (Outright)...');
    const outrightPricing = await appRouter.createCaller(ctx).pricing.calculateTotalWithDeposits({
      items: [{
        product_id: PRODUCT_ID,
        quantity: 1,
        pricing_method: 'per_kg',
        include_deposits: true
      }],
      customer_id: undefined,
      pricing_date: new Date().toISOString().split('T')[0],
      tax_rate: productDetails.tax_rate || 16
    });
    console.log('✅ Outright Pricing:', {
      total_gas_charges: outrightPricing.total_gas_charges,
      total_deposits: outrightPricing.total_deposits,
      total_subtotal: outrightPricing.total_subtotal,
      total_tax: outrightPricing.total_tax,
      grand_total: outrightPricing.grand_total
    });

    // Test 5: Calculate Total with Deposits (Refill - no deposits)
    console.log('\n🔄 5. Calculate Total with Deposits (Refill - no deposits)...');
    const refillPricing = await appRouter.createCaller(ctx).pricing.calculateTotalWithDeposits({
      items: [{
        product_id: PRODUCT_ID,
        quantity: 1,
        pricing_method: 'per_kg',
        include_deposits: false
      }],
      customer_id: undefined,
      pricing_date: new Date().toISOString().split('T')[0],
      tax_rate: productDetails.tax_rate || 16
    });
    console.log('✅ Refill Pricing:', {
      total_gas_charges: refillPricing.total_gas_charges,
      total_deposits: refillPricing.total_deposits,
      total_subtotal: refillPricing.total_subtotal,
      total_tax: refillPricing.total_tax,
      grand_total: refillPricing.grand_total
    });

    // Test 6: Get Product Price
    console.log('\n💵 6. Get Product Price...');
    const productPrice = await appRouter.createCaller(ctx).pricing.getProductPrice({
      productId: PRODUCT_ID,
      customerId: undefined,
      date: new Date().toISOString().split('T')[0]
    });
    console.log('✅ Product Price:', {
      unit_price: productPrice?.unit_price,
      final_price: productPrice?.final_price,
      price_list_name: productPrice?.price_list_name,
      tax_rate: productPrice?.tax_rate,
      tax_category: productPrice?.tax_category
    });

    // Test 7: Example Pricing (NEW ENDPOINT)
    console.log('\n🎯 7. Example Pricing (All Scenarios)...');
    const examplePricing = await appRouter.createCaller(ctx).pricing.calculateExamplePricing({
      product_id: PRODUCT_ID,
      quantity: 1,
      customer_id: undefined,
      pricing_date: new Date().toISOString().split('T')[0]
    });
    console.log('✅ Example Pricing Results:');
    console.log('   Product:', {
      name: examplePricing.product.name,
      capacity_kg: examplePricing.product.capacity_kg,
      capacity_l: examplePricing.product.capacity_l,
      net_gas_weight_kg: examplePricing.product.net_gas_weight_kg
    });
    console.log('   Deposit Rate:', {
      capacity_l: examplePricing.deposit_rate.capacity_l,
      deposit_amount: examplePricing.deposit_rate.deposit_amount,
      currency: examplePricing.deposit_rate.currency
    });
    console.log('   Scenarios:');
    console.log('     - Outright:', {
      gas_charges: examplePricing.scenarios.outright.gasCharges,
      deposit_amount: examplePricing.scenarios.outright.depositAmount,
      grand_total: examplePricing.scenarios.outright.grandTotal
    });
    console.log('     - Refill:', {
      gas_charges: examplePricing.scenarios.refill.gasCharges,
      deposit_amount: examplePricing.scenarios.refill.depositAmount,
      grand_total: examplePricing.scenarios.refill.grandTotal
    });
    console.log('     - Exchange:', {
      gas_charges: examplePricing.scenarios.exchange.gasCharges,
      deposit_amount: examplePricing.scenarios.exchange.depositAmount,
      grand_total: examplePricing.scenarios.exchange.grandTotal
    });
    console.log('     - Pickup:', {
      gas_charges: examplePricing.scenarios.pickup.gasCharges,
      deposit_amount: examplePricing.scenarios.pickup.depositAmount,
      grand_total: examplePricing.scenarios.pickup.grandTotal
    });
    console.log('     - Weight-based:', {
      gas_charge: examplePricing.scenarios.weight_based?.gasCharge,
      deposit_amount: examplePricing.scenarios.weight_based?.depositAmount,
      total_price: examplePricing.scenarios.weight_based?.totalPrice
    });

    // Test 8: Get Price List Items for Product
    console.log('\n📋 8. Get Price List Items for Product...');
    const priceListItems = await appRouter.createCaller(ctx).pricing.getProductPriceListItems({
      productId: PRODUCT_ID,
      page: 1,
      limit: 10
    });
    console.log('✅ Price List Items:', {
      total_count: priceListItems.totalCount,
      items: priceListItems.items.map(item => ({
        price_list_name: item.price_list?.name,
        unit_price: item.unit_price,
        pricing_method: item.price_list?.pricing_method,
        surcharge_pct: item.surcharge_pct
      }))
    });

    // Test 9: Get Pricing Stats
    console.log('\n📊 9. Get Pricing Statistics...');
    const pricingStats = await appRouter.createCaller(ctx).pricing.getStats();
    console.log('✅ Pricing Stats:', {
      total_price_lists: pricingStats.total_price_lists,
      active_price_lists: pricingStats.active_price_lists,
      products_without_pricing: pricingStats.products_without_pricing
    });

    console.log('\n🎉 All tests completed successfully!');
    console.log('=' .repeat(80));

  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      data: error.data
    });
  }
}

// Run the tests
testPricingSystem(); 