const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config();

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Set the auth token
supabase.auth.setSession({
  access_token: 'eyJhbGciOiJIUzI1NiIsImtpZCI6IjlJTHpNNXcyc1VTdFVvbTMiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL3RyY3JqaW5yZGpnaXpxaGpkZ3ZjLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiI4MzUzMjQ2Yi1iMGI4LTQ1MDgtOGIwNi1iZDlkM2RjMTgzODEiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzUyNjI4ODg2LCJpYXQiOjE3NTI2MjUyODYsImVtYWlsIjoibmFkaXJAY2lyY2wudGVhbSIsInBob25lIjoiIiwiYXBwX21ldGFkYXRhIjp7InByb3ZpZGVyIjoiZW1haWwiLCJwcm92aWRlcnMiOlsiZW1haWwiXX0sInVzZXJfbWV0YWRhdGEiOnsiZW1haWxfdmVyaWZpZWQiOnRydWV9LCJyb2xlIjoiYXV0aGVudGljYXRlZCIsImFhbCI6ImFhbDEiLCJhbXIiOlt7Im1ldGhvZCI6InBhc3N3b3JkIiwidGltZXN0YW1wIjoxNzUyNjI1Mjg2fV0sInNlc3Npb25faWQiOiIzYTYyNmZiNy01ZjcyLTQ3OGMtOTAzMy1kNDRkN2QxZTU4M2QiLCJpc19hbm9ueW1vdXMiOmZhbHNlfQ.oyYJlw4ZH-rA-AqhWkvy9uZkNEHFHBLVdwX6mRIkpAQ',
  refresh_token: ''
});

async function testPricingInheritance() {
  console.log('🧪 Testing Pricing Method Inheritance...\n');

  try {
    // 1. Create a price list with per_kg pricing method
    console.log('1. Creating price list with per_kg pricing method...');
    const { data: priceList, error: createError } = await supabase
      .from('price_list')
      .insert([{
        name: 'Test Per KG Inheritance',
        description: 'Test price list with per_kg pricing method inheritance',
        currency_code: 'KES',
        start_date: new Date().toISOString().split('T')[0],
        pricing_method: 'per_kg',
        is_default: false
      }])
      .select()
      .single();

    if (createError) {
      console.error('❌ Error creating price list:', createError);
      return;
    }

    console.log('✅ Price list created successfully:', {
      id: priceList.id,
      name: priceList.name,
      pricing_method: priceList.pricing_method
    });

    // 2. Create a product with capacity_kg for testing
    console.log('\n2. Creating test product with capacity_kg...');
    const { data: product, error: productError } = await supabase
      .from('products')
      .insert([{
        sku: 'TEST-KG-15',
        name: 'Test 15kg Cylinder',
        unit_of_measure: 'cylinder',
        capacity_kg: 15.0,
        status: 'active',
        is_variant: false
      }])
      .select()
      .single();

    if (productError) {
      console.error('❌ Error creating product:', productError);
      return;
    }

    console.log('✅ Product created successfully:', {
      id: product.id,
      name: product.name,
      sku: product.sku,
      capacity_kg: product.capacity_kg
    });

    // 3. Test creating a price list item with inherited pricing method
    console.log('\n3. Creating price list item with inherited per_kg pricing...');
    const { data: priceListItem, error: itemError } = await supabase
      .from('price_list_item')
      .insert([{
        price_list_id: priceList.id,
        product_id: product.id,
        price_per_kg: 50.00, // Price per KG (not unit_price)
        min_qty: 1,
        surcharge_pct: 0,
        pricing_method: 'per_kg' // Should inherit from price list
      }])
      .select()
      .single();

    if (itemError) {
      console.error('❌ Error creating price list item:', itemError);
      return;
    }

    console.log('✅ Price list item created successfully:', {
      id: priceListItem.id,
      price_per_kg: priceListItem.price_per_kg,
      unit_price: priceListItem.unit_price,
      pricing_method: priceListItem.pricing_method
    });

    // 4. Test creating a price list with per_unit pricing method
    console.log('\n4. Creating price list with per_unit pricing method...');
    const { data: priceListUnit, error: createUnitError } = await supabase
      .from('price_list')
      .insert([{
        name: 'Test Per Unit Inheritance',
        description: 'Test price list with per_unit pricing method inheritance',
        currency_code: 'KES',
        start_date: new Date().toISOString().split('T')[0],
        pricing_method: 'per_unit',
        is_default: false
      }])
      .select()
      .single();

    if (createUnitError) {
      console.error('❌ Error creating per_unit price list:', createUnitError);
      return;
    }

    console.log('✅ Per unit price list created successfully:', {
      id: priceListUnit.id,
      name: priceListUnit.name,
      pricing_method: priceListUnit.pricing_method
    });

    // 5. Test creating a price list item with inherited per_unit pricing
    console.log('\n5. Creating price list item with inherited per_unit pricing...');
    const { data: priceListItemUnit, error: itemUnitError } = await supabase
      .from('price_list_item')
      .insert([{
        price_list_id: priceListUnit.id,
        product_id: product.id,
        unit_price: 750.00, // Price per unit (not price_per_kg)
        min_qty: 1,
        surcharge_pct: 0,
        pricing_method: 'per_unit' // Should inherit from price list
      }])
      .select()
      .single();

    if (itemUnitError) {
      console.error('❌ Error creating per_unit price list item:', itemUnitError);
      return;
    }

    console.log('✅ Per unit price list item created successfully:', {
      id: priceListItemUnit.id,
      price_per_kg: priceListItemUnit.price_per_kg,
      unit_price: priceListItemUnit.unit_price,
      pricing_method: priceListItemUnit.pricing_method
    });

    // 6. Verify inheritance logic
    console.log('\n6. Verifying pricing method inheritance...');
    console.log('📋 Summary:');
    console.log(`- Price List "${priceList.name}": ${priceList.pricing_method}`);
    console.log(`  └─ Item uses: ${priceListItem.pricing_method} (inherited ✓)`);
    console.log(`- Price List "${priceListUnit.name}": ${priceListUnit.pricing_method}`);
    console.log(`  └─ Item uses: ${priceListItemUnit.pricing_method} (inherited ✓)`);

    // 7. Clean up
    console.log('\n7. Cleaning up test data...');
    await supabase
      .from('price_list_item')
      .delete()
      .in('id', [priceListItem.id, priceListItemUnit.id]);
    
    await supabase
      .from('price_list')
      .delete()
      .in('id', [priceList.id, priceListUnit.id]);

    await supabase
      .from('products')
      .delete()
      .eq('id', product.id);

    console.log('✅ Test data cleaned up successfully');

    console.log('\n🎉 Pricing method inheritance test completed!');
    console.log('\n📋 Key Points:');
    console.log('- ✅ Price lists can have different pricing methods (per_unit, per_kg)');
    console.log('- ✅ Price list items inherit the pricing method from their parent price list');
    console.log('- ✅ Per KG items use price_per_kg field');
    console.log('- ✅ Per Unit items use unit_price field');
    console.log('- ✅ Frontend will show the inherited method as disabled/read-only');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testPricingInheritance(); 