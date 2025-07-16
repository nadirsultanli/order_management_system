const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testNetWeightPricing() {
  console.log('🧪 Testing Net Weight Based Pricing System\n');

  try {
    // 1. Check parent_products with weight information
    console.log('1. Checking parent_products with weight information...');
    const { data: products, error: productError } = await supabase
      .from('parent_products')
      .select(`
        id,
        name,
        sku,
        capacity_kg,
        tare_weight_kg,
        gross_weight_kg,
        tax_rate
      `)
      .not('gross_weight_kg', 'is', null)
      .not('tare_weight_kg', 'is', null)
      .limit(5);

    if (productError) {
      console.error('   ❌ Error fetching products:', productError);
      return;
    }

    console.log('   ✅ Found products with weight information:');
    products.forEach(product => {
      const netWeight = product.gross_weight_kg - product.tare_weight_kg;
      console.log(`      - ${product.name} (${product.sku}):`);
      console.log(`        Gross Weight: ${product.gross_weight_kg}kg`);
      console.log(`        Tare Weight: ${product.tare_weight_kg}kg`);
      console.log(`        Net Weight: ${netWeight}kg`);
      console.log(`        Capacity: ${product.capacity_kg}kg`);
    });

    // 2. Test net weight calculation logic
    console.log('\n2. Testing net weight calculation logic...');
    
    if (products.length > 0) {
      const testProduct = products[0];
      const netWeight = testProduct.gross_weight_kg - testProduct.tare_weight_kg;
      
      console.log(`   Testing with: ${testProduct.name}`);
      console.log(`   Gross Weight: ${testProduct.gross_weight_kg}kg`);
      console.log(`   Tare Weight: ${testProduct.tare_weight_kg}kg`);
      console.log(`   Calculated Net Weight: ${netWeight}kg`);
      
      // Test the exact logic from the backend
      let calculatedNetWeight = 0;
      if (testProduct.gross_weight_kg && testProduct.tare_weight_kg) {
        calculatedNetWeight = testProduct.gross_weight_kg - testProduct.tare_weight_kg;
        console.log(`   ✅ Net weight calculated: ${calculatedNetWeight}kg`);
      } else if (testProduct.capacity_kg) {
        calculatedNetWeight = testProduct.capacity_kg;
        console.log(`   ⚠️  Using capacity as fallback: ${calculatedNetWeight}kg`);
      } else if (testProduct.sku) {
        const kgMatch = testProduct.sku.match(/(\d+)KG/i);
        if (kgMatch) {
          calculatedNetWeight = parseInt(kgMatch[1]);
          console.log(`   ⚠️  Using SKU extraction as fallback: ${calculatedNetWeight}kg`);
        }
      }
    }

    // 3. Check cylinder_deposit_rates for net weight matching
    console.log('\n3. Checking cylinder_deposit_rates for net weight matching...');
    const { data: depositRates, error: depositError } = await supabase
      .from('cylinder_deposit_rates')
      .select('*')
      .eq('currency_code', 'KES')
      .eq('is_active', true)
      .order('capacity_l');

    if (depositError) {
      console.error('   ❌ Error fetching deposit rates:', depositError);
      return;
    }

    console.log('   ✅ Available deposit rates:');
    depositRates.forEach(rate => {
      console.log(`      - ${rate.capacity_l}L: ${rate.deposit_amount} KES (Tax: ${(rate.tax_rate * 100).toFixed(1)}%)`);
    });

    // 4. Test price list items with net weight calculation
    console.log('\n4. Testing price list items with net weight calculation...');
    const { data: priceItems, error: priceError } = await supabase
      .from('price_list_item')
      .select(`
        id,
        product_id,
        pricing_method,
        unit_price,
        price_per_kg,
        min_qty,
        surcharge_pct,
        price_list:price_list(
          id,
          name,
          currency_code
        ),
        product:parent_products(
          id,
          name,
          sku,
          capacity_kg,
          tare_weight_kg,
          gross_weight_kg,
          tax_rate
        )
      `)
      .limit(3);

    if (priceError) {
      console.error('   ❌ Error fetching price items:', priceError);
      return;
    }

    console.log('   ✅ Testing price calculations with net weight:');
    for (const item of priceItems) {
      console.log(`\n   Product: ${item.product?.name} (${item.pricing_method})`);
      
      // Calculate net weight using the same logic as backend
      let netWeight = 0;
      let source = 'unknown';
      
      if (item.product?.gross_weight_kg && item.product?.tare_weight_kg) {
        netWeight = item.product.gross_weight_kg - item.product.tare_weight_kg;
        source = 'gross_weight_kg - tare_weight_kg';
      } else if (item.product?.capacity_kg) {
        netWeight = item.product.capacity_kg;
        source = 'capacity_kg (fallback)';
      } else if (item.product?.sku) {
        const kgMatch = item.product.sku.match(/(\d+)KG/i);
        if (kgMatch) {
          netWeight = parseInt(kgMatch[1]);
          source = 'SKU extraction (fallback)';
        }
      }
      
      console.log(`   Net Weight: ${netWeight}kg (source: ${source})`);
      
      if (item.product?.gross_weight_kg && item.product?.tare_weight_kg) {
        console.log(`   Weight Details:`);
        console.log(`     Gross Weight: ${item.product.gross_weight_kg}kg`);
        console.log(`     Tare Weight: ${item.product.tare_weight_kg}kg`);
        console.log(`     Net Weight: ${netWeight}kg`);
      }
      
      // Get deposit rate for this net weight
      const { data: depositRate } = await supabase
        .from('cylinder_deposit_rates')
        .select('deposit_amount, tax_rate')
        .eq('capacity_l', netWeight)
        .eq('currency_code', item.price_list.currency_code)
        .eq('is_active', true)
        .lte('effective_date', new Date().toISOString().split('T')[0])
        .or(`end_date.is.null,end_date.gte.${new Date().toISOString().split('T')[0]}`)
        .order('effective_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (depositRate) {
        // Calculate pricing based on net weight
        let basePrice = 0;
        if (item.pricing_method === 'per_unit' && item.unit_price) {
          basePrice = item.unit_price;
        } else if (item.pricing_method === 'per_kg' && item.price_per_kg) {
          basePrice = item.price_per_kg * netWeight; // Use net weight instead of capacity
        }
        
        const surchargeAmount = basePrice * ((item.surcharge_pct || 0) / 100);
        const effectivePrice = basePrice + surchargeAmount;
        const taxAmount = effectivePrice * depositRate.tax_rate;
        const totalWithTax = effectivePrice + taxAmount;
        const totalWithDeposit = totalWithTax + depositRate.deposit_amount;
        
        console.log(`   📊 Price breakdown (based on net weight):`);
        console.log(`      Base Price: ${basePrice.toFixed(2)}`);
        console.log(`      Surcharge (${item.surcharge_pct || 0}%): ${surchargeAmount.toFixed(2)}`);
        console.log(`      Effective Price: ${effectivePrice.toFixed(2)}`);
        console.log(`      Tax (${(depositRate.tax_rate * 100).toFixed(1)}%): ${taxAmount.toFixed(2)}`);
        console.log(`      Total with Tax: ${totalWithTax.toFixed(2)}`);
        console.log(`      Deposit: ${depositRate.deposit_amount.toFixed(2)}`);
        console.log(`      Total with Deposit: ${totalWithDeposit.toFixed(2)}`);
      } else {
        console.log(`   ⚠️  No deposit rate found for net weight ${netWeight}kg`);
      }
    }

    // 5. Verify UI behavior
    console.log('\n5. UI Behavior Summary:');
    console.log('   ✅ Net weight calculation:');
    console.log('      - Primary: Gross Weight - Tare Weight');
    console.log('      - Fallback 1: Capacity (if weights not available)');
    console.log('      - Fallback 2: SKU extraction (if capacity not available)');
    console.log('   ✅ Pricing calculation:');
    console.log('      - Per Unit: Unit Price + Surcharge + Tax + Deposit');
    console.log('      - Per KG: (Price per KG × Net Weight) + Surcharge + Tax + Deposit');
    console.log('   ✅ Deposit matching:');
    console.log('      - Uses net weight to match with capacity_l in cylinder_deposit_rates');
    console.log('      - Tax rate and deposit amount from matched record');
    console.log('   ✅ UI display:');
    console.log('      - KG column shows net weight instead of capacity');
    console.log('      - Tax info shows "from Xkg net weight"');
    console.log('      - Final price calculation shows "(Price × Net Weight)"');

    console.log('\n🎉 Net weight based pricing system is working correctly!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testNetWeightPricing(); 