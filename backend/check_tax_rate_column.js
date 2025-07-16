const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTaxRateColumn() {
  console.log('🔍 Checking tax_rate column in cylinder_deposit_rates\n');

  try {
    // 1. Check if tax_rate column exists
    console.log('1. Checking if tax_rate column exists...');
    const { data: columns, error: columnError } = await supabase
      .rpc('get_table_columns', { table_name: 'cylinder_deposit_rates' });

    if (columnError) {
      console.log('   ⚠️  Could not check columns directly, trying sample data...');
    } else {
      console.log('   ✅ Table columns:');
      columns.forEach(col => {
        console.log(`      - ${col.column_name}: ${col.data_type}`);
      });
    }

    // 2. Check all records with tax_rate
    console.log('\n2. Checking all records with tax_rate...');
    const { data: allRates, error: allError } = await supabase
      .from('cylinder_deposit_rates')
      .select('*')
      .eq('currency_code', 'KES')
      .eq('is_active', true);

    if (allError) {
      console.error('   ❌ Error fetching deposit rates:', allError);
      return;
    }

    console.log('   ✅ All deposit rates:');
    allRates.forEach(rate => {
      console.log(`      - ${rate.capacity_l}kg: ${rate.deposit_amount} KES`);
      console.log(`        tax_rate: ${rate.tax_rate} (type: ${typeof rate.tax_rate})`);
      console.log(`        notes: ${rate.notes}`);
    });

    // 3. Test specific matching for 12kg
    console.log('\n3. Testing specific matching for 12kg...');
    const { data: match12kg } = await supabase
      .from('cylinder_deposit_rates')
      .select('*')
      .eq('capacity_l', 12)
      .eq('currency_code', 'KES')
      .eq('is_active', true)
      .maybeSingle();

    if (match12kg) {
      console.log(`   ✅ Found 12kg deposit rate:`);
      console.log(`      Deposit: ${match12kg.deposit_amount} KES`);
      console.log(`      Tax Rate: ${match12kg.tax_rate} (${typeof match12kg.tax_rate})`);
      console.log(`      Notes: ${match12kg.notes}`);
    } else {
      console.log(`   ❌ No 12kg deposit rate found`);
    }

    // 4. Check if tax_rate is null or missing
    console.log('\n4. Checking for null/missing tax_rate values...');
    const { data: nullTaxRates } = await supabase
      .from('cylinder_deposit_rates')
      .select('capacity_l, tax_rate')
      .eq('currency_code', 'KES')
      .eq('is_active', true)
      .is('tax_rate', null);

    if (nullTaxRates && nullTaxRates.length > 0) {
      console.log(`   ⚠️  Found ${nullTaxRates.length} records with null tax_rate:`);
      nullTaxRates.forEach(rate => {
        console.log(`      - ${rate.capacity_l}kg: tax_rate is null`);
      });
    } else {
      console.log(`   ✅ No null tax_rate values found`);
    }

    // 5. Test the exact query from the backend
    console.log('\n5. Testing exact backend query for 12kg...');
    const { data: exactMatch } = await supabase
      .from('cylinder_deposit_rates')
      .select('tax_rate, deposit_amount')
      .eq('capacity_l', 12)
      .eq('currency_code', 'KES')
      .eq('is_active', true)
      .lte('effective_date', new Date().toISOString().split('T')[0])
      .or(`end_date.is.null,end_date.gte.${new Date().toISOString().split('T')[0]}`)
      .order('effective_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (exactMatch) {
      console.log(`   ✅ Exact match found:`);
      console.log(`      Deposit: ${exactMatch.deposit_amount} KES`);
      console.log(`      Tax Rate: ${exactMatch.tax_rate} (${typeof exactMatch.tax_rate})`);
      
      if (exactMatch.tax_rate !== null && exactMatch.tax_rate !== undefined) {
        console.log(`      Tax Rate %: ${(exactMatch.tax_rate * 100).toFixed(1)}%`);
      } else {
        console.log(`      Tax Rate %: NULL/UNDEFINED`);
      }
    } else {
      console.log(`   ❌ No exact match found for 12kg`);
    }

  } catch (error) {
    console.error('❌ Check failed:', error);
  }
}

checkTaxRateColumn(); 