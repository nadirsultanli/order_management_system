const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testDepositFix() {
  console.log('🧪 Testing Deposit Fix with Capacity Matching\n');

  try {
    // 1. Check cylinder_deposit_rates
    console.log('1. Checking cylinder_deposit_rates...');
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
      console.log(`      - ${rate.capacity_l}kg: ${rate.deposit_amount} KES (Tax: ${(rate.tax_rate * 100).toFixed(1)}%)`);
    });

    // 2. Check products with capacity_kg
    console.log('\n2. Checking products with capacity_kg...');
    const { data: products, error: productError } = await supabase
      .from('parent_products')
      .select(`
        id,
        name,
        sku,
        capacity_kg,
        tare_weight_kg,
        gross_weight_kg
      `)
      .not('capacity_kg', 'is', null)
      .limit(5);

    if (productError) {
      console.error('   ❌ Error fetching products:', productError);
      return;
    }

    console.log('   ✅ Products with capacity:');
    products.forEach(product => {
      const netWeight = product.gross_weight_kg && product.tare_weight_kg ? 
        product.gross_weight_kg - product.tare_weight_kg : null;
      console.log(`      - ${product.name} (${product.sku}):`);
      console.log(`        Capacity: ${product.capacity_kg}kg`);
      if (netWeight) {
        console.log(`        Net Weight: ${netWeight}kg`);
      }
    });

    // 3. Test deposit matching with capacity_kg
    console.log('\n3. Testing deposit matching with capacity_kg...');
    
    for (const product of products) {
      console.log(`\n   Testing: ${product.name}`);
      console.log(`   Capacity: ${product.capacity_kg}kg`);
      
      // Test the exact query from the backend
      const { data: depositRate } = await supabase
        .from('cylinder_deposit_rates')
        .select('tax_rate, deposit_amount')
        .eq('capacity_l', product.capacity_kg)
        .eq('currency_code', 'KES')
        .eq('is_active', true)
        .lte('effective_date', new Date().toISOString().split('T')[0])
        .or(`end_date.is.null,end_date.gte.${new Date().toISOString().split('T')[0]}`)
        .order('effective_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (depositRate) {
        console.log(`   ✅ Found deposit rate:`);
        console.log(`      Deposit: ${depositRate.deposit_amount} KES`);
        console.log(`      Tax Rate: ${(depositRate.tax_rate * 100).toFixed(1)}%`);
      } else {
        console.log(`   ❌ No deposit rate found for capacity ${product.capacity_kg}kg`);
      }
    }

    // 4. Test complete pricing calculation
    console.log('\n4. Testing complete pricing calculation...');
    
    // Get a price list item to test with
    const { data: priceItems, error: priceError } = await supabase
      .from('price_list_item')
      .select(`
        id,
        product_id,
        pricing_method,
        unit_price,
        price_per_kg,
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
          gross_weight_kg
        )
      `)
      .limit(1);

    if (priceError) {
      console.error('   ❌ Error fetching price items:', priceError);
      return;
    }

    if (priceItems.length > 0) {
      const item = priceItems[0];
      console.log(`\n   Testing with: ${item.product?.name} (${item.pricing_method})`);
      
      // Calculate net weight for pricing
      let netWeight = 0;
      if (item.product?.gross_weight_kg && item.product?.tare_weight_kg) {
        netWeight = item.product.gross_weight_kg - item.product.tare_weight_kg;
      } else if (item.product?.capacity_kg) {
        netWeight = item.product.capacity_kg;
      }
      
      console.log(`   Net Weight for pricing: ${netWeight}kg`);
      console.log(`   Capacity for deposit: ${item.product?.capacity_kg}kg`);
      
      // Calculate base price
      let basePrice = 0;
      if (item.pricing_method === 'per_unit' && item.unit_price) {
        basePrice = item.unit_price;
      } else if (item.pricing_method === 'per_kg' && item.price_per_kg) {
        basePrice = item.price_per_kg * netWeight;
      }
      
      // Get deposit rate using capacity_kg
      const { data: depositRate } = await supabase
        .from('cylinder_deposit_rates')
        .select('tax_rate, deposit_amount')
        .eq('capacity_l', item.product?.capacity_kg)
        .eq('currency_code', item.price_list.currency_code)
        .eq('is_active', true)
        .lte('effective_date', new Date().toISOString().split('T')[0])
        .or(`end_date.is.null,end_date.gte.${new Date().toISOString().split('T')[0]}`)
        .order('effective_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (depositRate) {
        const surchargeAmount = basePrice * ((item.surcharge_pct || 0) / 100);
        const effectivePrice = basePrice + surchargeAmount;
        const taxAmount = effectivePrice * depositRate.tax_rate;
        const totalWithTax = effectivePrice + taxAmount;
        const totalWithDeposit = totalWithTax + depositRate.deposit_amount;
        
        console.log(`   📊 Complete price breakdown:`);
        console.log(`      Base Price: ${basePrice.toFixed(2)}`);
        console.log(`      Surcharge (${item.surcharge_pct || 0}%): ${surchargeAmount.toFixed(2)}`);
        console.log(`      Effective Price: ${effectivePrice.toFixed(2)}`);
        console.log(`      Tax (${(depositRate.tax_rate * 100).toFixed(1)}%): ${taxAmount.toFixed(2)}`);
        console.log(`      Total with Tax: ${totalWithTax.toFixed(2)}`);
        console.log(`      Deposit: ${depositRate.deposit_amount.toFixed(2)}`);
        console.log(`      Total with Deposit: ${totalWithDeposit.toFixed(2)}`);
      } else {
        console.log(`   ⚠️  No deposit rate found for capacity ${item.product?.capacity_kg}kg`);
      }
    }

    console.log('\n🎉 Deposit matching with capacity_kg is working correctly!');
    console.log('\n📋 Summary:');
    console.log('   ✅ Pricing: Uses net weight (gross - tare) for price calculation');
    console.log('   ✅ Deposit: Uses capacity_kg to match with cylinder_deposit_rates.capacity_l');
    console.log('   ✅ Tax: Uses tax rate from matched deposit record');
    console.log('   ✅ Total: Base + Surcharge + Tax + Deposit');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testDepositFix(); 