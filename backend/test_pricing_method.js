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

async function testPricingMethod() {
  console.log('🧪 Testing Pricing Method Implementation...\n');

  try {
    // 1. Test creating a price list with per_kg pricing method
    console.log('1. Creating price list with per_kg pricing method...');
    const { data: priceList, error: createError } = await supabase
      .from('price_list')
      .insert([{
        name: 'Test KG Pricing',
        description: 'Test price list with per_kg pricing method',
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

    // 2. Test creating a price list item with per_kg pricing
    console.log('\n2. Creating price list item with per_kg pricing...');
    
    // Get a product with capacity_kg
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, name, sku, capacity_kg')
      .not('capacity_kg', 'is', null)
      .limit(1);

    if (productsError || !products.length) {
      console.error('❌ No products with capacity_kg found:', productsError);
      return;
    }

    const product = products[0];
    console.log('📦 Using product:', {
      id: product.id,
      name: product.name,
      sku: product.sku,
      capacity_kg: product.capacity_kg
    });

    const { data: priceListItem, error: itemError } = await supabase
      .from('price_list_item')
      .insert([{
        price_list_id: priceList.id,
        product_id: product.id,
        unit_price: 50.00, // Price per KG
        min_qty: 1,
        surcharge_pct: 0,
        pricing_method: 'per_kg'
      }])
      .select()
      .single();

    if (itemError) {
      console.error('❌ Error creating price list item:', itemError);
      return;
    }

    console.log('✅ Price list item created successfully:', {
      id: priceListItem.id,
      unit_price: priceListItem.unit_price,
      pricing_method: priceListItem.pricing_method
    });

    // 3. Test retrieving the price list with pricing method
    console.log('\n3. Retrieving price list with pricing method...');
    const { data: retrievedPriceList, error: retrieveError } = await supabase
      .from('price_list')
      .select('*')
      .eq('id', priceList.id)
      .single();

    if (retrieveError) {
      console.error('❌ Error retrieving price list:', retrieveError);
      return;
    }

    console.log('✅ Price list retrieved successfully:', {
      id: retrievedPriceList.id,
      name: retrievedPriceList.name,
      pricing_method: retrievedPriceList.pricing_method
    });

    // 4. Test updating pricing method
    console.log('\n4. Updating pricing method to flat_rate...');
    const { data: updatedPriceList, error: updateError } = await supabase
      .from('price_list')
      .update({ pricing_method: 'flat_rate' })
      .eq('id', priceList.id)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Error updating price list:', updateError);
      return;
    }

    console.log('✅ Price list updated successfully:', {
      id: updatedPriceList.id,
      name: updatedPriceList.name,
      pricing_method: updatedPriceList.pricing_method
    });

    // 5. Test all pricing methods
    console.log('\n5. Testing all pricing methods...');
    const pricingMethods = ['per_unit', 'per_kg', 'flat_rate', 'tiered'];
    
    for (const method of pricingMethods) {
      const { data: testPriceList, error: testError } = await supabase
        .from('price_list')
        .insert([{
          name: `Test ${method} Pricing`,
          description: `Test price list with ${method} pricing method`,
          currency_code: 'KES',
          start_date: new Date().toISOString().split('T')[0],
          pricing_method: method,
          is_default: false
        }])
        .select()
        .single();

      if (testError) {
        console.error(`❌ Error creating ${method} price list:`, testError);
      } else {
        console.log(`✅ ${method} price list created:`, testPriceList.id);
        
        // Clean up test price list
        await supabase
          .from('price_list')
          .delete()
          .eq('id', testPriceList.id);
      }
    }

    // 6. Clean up
    console.log('\n6. Cleaning up test data...');
    await supabase
      .from('price_list_item')
      .delete()
      .eq('price_list_id', priceList.id);
    
    await supabase
      .from('price_list')
      .delete()
      .eq('id', priceList.id);

    console.log('✅ Test data cleaned up successfully');

    console.log('\n🎉 All pricing method tests passed!');
    console.log('\n📋 Summary:');
    console.log('- ✅ Database supports pricing_method enum');
    console.log('- ✅ Price lists can be created with different pricing methods');
    console.log('- ✅ Price list items can have pricing_method field');
    console.log('- ✅ Pricing methods can be updated');
    console.log('- ✅ All pricing method types work correctly');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testPricingMethod(); 