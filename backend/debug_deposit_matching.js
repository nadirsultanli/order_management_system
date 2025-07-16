const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugDepositMatching() {
  console.log('🔍 Debugging Deposit Matching for PROPAN 12KG\n');

  try {
    // 1. Find the PROPAN 12KG product
    console.log('1. Finding PROPAN 12KG product...');
    const { data: products, error: productError } = await supabase
      .from('parent_products')
      .select(`
        id,
        name,
        sku,
        capacity_kg,
        tare_weight_kg,
        tax_rate
      `)
      .ilike('name', '%PROPAN%')
      .ilike('sku', '%12KG%');

    if (productError) {
      console.error('   ❌ Error fetching product:', productError);
      return;
    }

    console.log('   ✅ Found products:');
    products.forEach(product => {
      console.log(`      - ${product.name} (${product.sku}):`);
      console.log(`        capacity_kg: ${product.capacity_kg}`);
      console.log(`        tare_weight_kg: ${product.tare_weight_kg}`);
    });

    if (products.length === 0) {
      console.log('   ⚠️  No PROPAN 12KG product found');
      return;
    }

    const product = products[0];
    console.log(`\n2. Testing deposit matching for: ${product.name}`);

    // 2. Check what capacity we should use
    const capacity = product.tare_weight_kg || product.capacity_kg || 0;
    console.log(`   Capacity to match: ${capacity}kg`);
    console.log(`   Source: ${product.tare_weight_kg ? 'tare_weight_kg' : 'capacity_kg'}`);

    // 3. Check cylinder_deposit_rates for this capacity
    console.log(`\n3. Checking cylinder_deposit_rates for capacity_l = ${capacity}...`);
    const { data: depositRates, error: depositError } = await supabase
      .from('cylinder_deposit_rates')
      .select('*')
      .eq('capacity_l', capacity)
      .eq('currency_code', 'KES')
      .eq('is_active', true);

    if (depositError) {
      console.error('   ❌ Error fetching deposit rates:', depositError);
      return;
    }

    console.log(`   ✅ Found ${depositRates.length} deposit rates for capacity ${capacity}:`);
    depositRates.forEach(rate => {
      console.log(`      - ID: ${rate.id}, Amount: ${rate.deposit_amount} ${rate.currency_code}`);
      console.log(`        Effective: ${rate.effective_date}, End: ${rate.end_date || 'NULL'}`);
    });

    // 4. Check if any are currently active
    const today = new Date().toISOString().split('T')[0];
    console.log(`\n4. Checking active rates for today (${today})...`);
    
    const { data: activeRates, error: activeError } = await supabase
      .from('cylinder_deposit_rates')
      .select('*')
      .eq('capacity_l', capacity)
      .eq('currency_code', 'KES')
      .eq('is_active', true)
      .lte('effective_date', today)
      .or(`end_date.is.null,end_date.gte.${today}`)
      .order('effective_date', { ascending: false });

    if (activeError) {
      console.error('   ❌ Error fetching active rates:', activeError);
      return;
    }

    console.log(`   ✅ Found ${activeRates.length} active deposit rates:`);
    activeRates.forEach(rate => {
      console.log(`      - Amount: ${rate.deposit_amount} ${rate.currency_code}`);
      console.log(`        Effective: ${rate.effective_date}, End: ${rate.end_date || 'NULL'}`);
    });

    // 5. Check all deposit rates to see what's available
    console.log('\n5. All available deposit rates:');
    const { data: allRates, error: allError } = await supabase
      .from('cylinder_deposit_rates')
      .select('*')
      .eq('currency_code', 'KES')
      .eq('is_active', true)
      .order('capacity_l');

    if (allError) {
      console.error('   ❌ Error fetching all rates:', allError);
      return;
    }

    allRates.forEach(rate => {
      console.log(`      - ${rate.capacity_l}L: ${rate.deposit_amount} KES`);
    });

    // 6. Test the exact query from the pricing route
    console.log(`\n6. Testing exact pricing route query for capacity ${capacity}...`);
    const { data: exactMatch, error: exactError } = await supabase
      .from('cylinder_deposit_rates')
      .select('tax_rate, deposit_amount')
      .eq('capacity_l', capacity)
      .eq('currency_code', 'KES')
      .eq('is_active', true)
      .lte('effective_date', today)
      .or(`end_date.is.null,end_date.gte.${today}`)
      .order('effective_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (exactError) {
      console.error('   ❌ Error in exact query:', exactError);
      return;
    }

    if (exactMatch) {
      console.log(`   ✅ Exact match found:`);
      console.log(`      Deposit: ${exactMatch.deposit_amount} KES`);
      console.log(`      Tax Rate: ${(exactMatch.tax_rate * 100).toFixed(1)}%`);
    } else {
      console.log(`   ❌ No exact match found for capacity ${capacity}`);
      
      // Try with different capacity values
      console.log('\n7. Trying alternative capacity values...');
      const alternatives = [12, 13, 6, 25, 50];
      
      for (const altCapacity of alternatives) {
        const { data: altMatch } = await supabase
          .from('cylinder_deposit_rates')
          .select('tax_rate, deposit_amount')
          .eq('capacity_l', altCapacity)
          .eq('currency_code', 'KES')
          .eq('is_active', true)
          .lte('effective_date', today)
          .or(`end_date.is.null,end_date.gte.${today}`)
          .order('effective_date', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (altMatch) {
          console.log(`   ✅ Found match for capacity ${altCapacity}:`);
          console.log(`      Deposit: ${altMatch.deposit_amount} KES`);
          console.log(`      Tax Rate: ${(altMatch.tax_rate * 100).toFixed(1)}%`);
        }
      }
    }

  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
}

debugDepositMatching(); 