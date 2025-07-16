const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugCapacityMatching() {
  console.log('🔍 Debugging Capacity Matching Issue\n');

  try {
    // 1. Check cylinder_deposit_rates table structure
    console.log('1. Checking cylinder_deposit_rates table structure...');
    const { data: sampleRate, error: sampleError } = await supabase
      .from('cylinder_deposit_rates')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (sampleError) {
      console.error('   ❌ Error checking table structure:', sampleError);
      return;
    }

    if (sampleRate) {
      console.log('   ✅ Table structure - sample record:');
      Object.keys(sampleRate).forEach(key => {
        console.log(`      - ${key}: ${typeof sampleRate[key]} (${sampleRate[key]})`);
      });
    }

    // 2. Check all deposit rates
    console.log('\n2. Checking all cylinder_deposit_rates...');
    const { data: allRates, error: allError } = await supabase
      .from('cylinder_deposit_rates')
      .select('*')
      .eq('currency_code', 'KES')
      .eq('is_active', true)
      .order('capacity_l');

    if (allError) {
      console.error('   ❌ Error fetching deposit rates:', allError);
      return;
    }

    console.log('   ✅ All deposit rates:');
    allRates.forEach(rate => {
      console.log(`      - capacity_l: ${rate.capacity_l}L, deposit: ${rate.deposit_amount} KES, tax: ${rate.tax_rate}`);
    });

    // 3. Check products with their weights
    console.log('\n3. Checking products with weights...');
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
      .not('gross_weight_kg', 'is', null)
      .not('tare_weight_kg', 'is', null)
      .limit(5);

    if (productError) {
      console.error('   ❌ Error fetching products:', productError);
      return;
    }

    console.log('   ✅ Products with weights:');
    products.forEach(product => {
      const netWeight = product.gross_weight_kg - product.tare_weight_kg;
      console.log(`      - ${product.name} (${product.sku}):`);
      console.log(`        Gross: ${product.gross_weight_kg}kg, Tare: ${product.tare_weight_kg}kg`);
      console.log(`        Net Weight: ${netWeight}kg, Capacity: ${product.capacity_kg}kg`);
    });

    // 4. Test different matching strategies
    console.log('\n4. Testing different matching strategies...');
    
    if (products.length > 0) {
      const testProduct = products[0];
      const netWeight = testProduct.gross_weight_kg - testProduct.tare_weight_kg;
      
      console.log(`   Testing with: ${testProduct.name}`);
      console.log(`   Net Weight: ${netWeight}kg, Capacity: ${testProduct.capacity_kg}kg`);
      
      // Strategy 1: Match net weight directly with capacity_l
      console.log('\n   Strategy 1: Match net weight (${netWeight}kg) with capacity_l');
      const { data: match1 } = await supabase
        .from('cylinder_deposit_rates')
        .select('*')
        .eq('capacity_l', netWeight)
        .eq('currency_code', 'KES')
        .eq('is_active', true)
        .maybeSingle();
      
      if (match1) {
        console.log(`   ✅ Found match: ${match1.capacity_l}L = ${match1.deposit_amount} KES`);
      } else {
        console.log(`   ❌ No match found for ${netWeight}kg`);
      }
      
      // Strategy 2: Match capacity_kg with capacity_l
      console.log(`\n   Strategy 2: Match capacity_kg (${testProduct.capacity_kg}kg) with capacity_l`);
      const { data: match2 } = await supabase
        .from('cylinder_deposit_rates')
        .select('*')
        .eq('capacity_l', testProduct.capacity_kg)
        .eq('currency_code', 'KES')
        .eq('is_active', true)
        .maybeSingle();
      
      if (match2) {
        console.log(`   ✅ Found match: ${match2.capacity_l}L = ${match2.deposit_amount} KES`);
      } else {
        console.log(`   ❌ No match found for ${testProduct.capacity_kg}kg`);
      }
      
      // Strategy 3: Try to find closest match
      console.log(`\n   Strategy 3: Find closest match for ${netWeight}kg`);
      const { data: allMatches } = await supabase
        .from('cylinder_deposit_rates')
        .select('*')
        .eq('currency_code', 'KES')
        .eq('is_active', true)
        .order('capacity_l');
      
      if (allMatches) {
        let closest = null;
        let minDiff = Infinity;
        
        allMatches.forEach(rate => {
          const diff = Math.abs(rate.capacity_l - netWeight);
          if (diff < minDiff) {
            minDiff = diff;
            closest = rate;
          }
        });
        
        if (closest) {
          console.log(`   ✅ Closest match: ${closest.capacity_l}L (diff: ${minDiff}) = ${closest.deposit_amount} KES`);
        }
      }
    }

    // 5. Check if there's a conversion factor needed
    console.log('\n5. Checking for conversion factors...');
    console.log('   Looking at the data:');
    console.log('   - cylinder_deposit_rates.capacity_l is in LITERS (L)');
    console.log('   - parent_products weights are in KILOGRAMS (kg)');
    console.log('   - For propane: 1kg ≈ 1.96L (density ~0.51 kg/L)');
    console.log('   - For butane: 1kg ≈ 1.72L (density ~0.58 kg/L)');
    
    // Test conversion
    if (products.length > 0) {
      const testProduct = products[0];
      const netWeight = testProduct.gross_weight_kg - testProduct.tare_weight_kg;
      
      // Convert kg to liters (approximate for propane)
      const netWeightInLiters = netWeight * 1.96; // Propane conversion
      
      console.log(`\n   Conversion test for ${testProduct.name}:`);
      console.log(`   Net Weight: ${netWeight}kg`);
      console.log(`   Converted to liters: ${netWeightInLiters.toFixed(1)}L`);
      
      // Try to match with converted value
      const { data: convertedMatch } = await supabase
        .from('cylinder_deposit_rates')
        .select('*')
        .eq('capacity_l', Math.round(netWeightInLiters))
        .eq('currency_code', 'KES')
        .eq('is_active', true)
        .maybeSingle();
      
      if (convertedMatch) {
        console.log(`   ✅ Found match with conversion: ${convertedMatch.capacity_l}L = ${convertedMatch.deposit_amount} KES`);
      } else {
        console.log(`   ❌ No match found with conversion`);
      }
    }

    console.log('\n🎯 Conclusion:');
    console.log('   The issue is that cylinder_deposit_rates.capacity_l is in LITERS');
    console.log('   But we are trying to match with KILOGRAMS from the products');
    console.log('   We need to either:');
    console.log('   1. Convert kg to liters before matching');
    console.log('   2. Use capacity_kg instead of net weight for deposit matching');
    console.log('   3. Add a kg column to cylinder_deposit_rates table');

  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
}

debugCapacityMatching(); 