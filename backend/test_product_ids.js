const { createClient } = require('@supabase/supabase-js');

// Configuration
const supabaseUrl = 'https://trcjinrdjgizqhjkdgvc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL3RyY3JqaW5yZGpnaXpxaGpkZ3ZjLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiI4MzUzMjQ2Yi1iMGI4LTQ1MDgtOGIwNi1iZDlkM2RjMTgzODEiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzUyNjMwODUwLCJpYXQiOjE3NTI2MjcyNTAsImVtYWlsIjoibmFkaXJAY2lyY2wudGVhbSIsInBob25lIjoiIiwiYXBwX21ldGFkYXRhIjp7InByb3ZpZGVyIjoiZW1haWwiLCJwcm92aWRlcnMiOlsiZW1haWwiXX0sInVzZXJfbWV0YWRhdGEiOnsiZW1haWxfdmVyaWZpZWQiOnRydWV9LCJyb2xlIjoiYXV0aGVudGljYXRlZCIsImFhbCI6ImFhbDEiLCJhbXIiOlt7Im1ldGhvZCI6InBhc3N3b3JkIiwidGltZXN0YW1wIjoxNzUyNjI3MjUwfV0sInNlc3Npb25faWQiOiI4MDI5ZjI5Yy0yYmRkLTQzNTMtODQzNS1lNThhZGM3MjM4ZjkiLCJpc19hbm9ueW1vdXMiOmZhbHNlfQ.FcFH9j4E1M_H-GmWvh-4JLpU48Sv-TV6gL6o51rrsL0';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false
  }
});

async function testProductIds() {
  console.log('🔍 Testing Product IDs and Foreign Key Constraints...\n');

  try {
    // Test 1: Check what products exist in the database
    console.log('1️⃣ Checking existing products...');
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, sku, name, status')
      .eq('status', 'active')
      .limit(10);

    if (productsError) {
      console.error('❌ Error fetching products:', productsError);
      return;
    }

    console.log('✅ Found products:');
    products.forEach(product => {
      console.log(`   - ID: ${product.id}, SKU: ${product.sku}, Name: ${product.name}`);
    });

    if (products.length === 0) {
      console.log('⚠️  No active products found in database!');
      return;
    }

    // Test 2: Check what the getOptions endpoint returns
    console.log('\n2️⃣ Testing getOptions endpoint...');
    const { data: options, error: optionsError } = await supabase
      .from('products')
      .select('id, sku, name, sku_variant, is_variant')
      .eq('status', 'active');

    if (optionsError) {
      console.error('❌ Error fetching options:', optionsError);
      return;
    }

    console.log('✅ getOptions returns:');
    options.slice(0, 5).forEach(option => {
      console.log(`   - ID: ${option.id}, SKU: ${option.sku}, Name: ${option.name}`);
    });

    // Test 3: Check if there are any price lists
    console.log('\n3️⃣ Checking price lists...');
    const { data: priceLists, error: priceListsError } = await supabase
      .from('price_list')
      .select('id, name, pricing_method')
      .limit(5);

    if (priceListsError) {
      console.error('❌ Error fetching price lists:', priceListsError);
      return;
    }

    console.log('✅ Found price lists:');
    priceLists.forEach(priceList => {
      console.log(`   - ID: ${priceList.id}, Name: ${priceList.name}, Method: ${priceList.pricing_method}`);
    });

    if (priceLists.length === 0) {
      console.log('⚠️  No price lists found!');
      return;
    }

    // Test 4: Try to create a price list item with a valid product ID
    console.log('\n4️⃣ Testing price list item creation...');
    const testProduct = products[0];
    const testPriceList = priceLists[0];

    console.log(`   Using product: ${testProduct.name} (${testProduct.id})`);
    console.log(`   Using price list: ${testPriceList.name} (${testPriceList.id})`);

    const { data: createdItem, error: createError } = await supabase
      .from('price_list_item')
      .insert({
        price_list_id: testPriceList.id,
        product_id: testProduct.id,
        unit_price: testPriceList.pricing_method === 'per_unit' ? 100.00 : null,
        price_per_kg: testPriceList.pricing_method === 'per_kg' ? 50.00 : null,
        pricing_method: testPriceList.pricing_method,
        min_qty: 1,
        surcharge_pct: 0
      })
      .select()
      .single();

    if (createError) {
      console.error('❌ Error creating price list item:', createError);
      
      // Check if it's a foreign key constraint error
      if (createError.message.includes('foreign key constraint')) {
        console.log('\n🔍 Foreign key constraint error details:');
        console.log('   - This means the product_id or price_list_id does not exist');
        console.log('   - Product ID being used:', testProduct.id);
        console.log('   - Price List ID being used:', testPriceList.id);
        
        // Verify the IDs exist
        const { data: verifyProduct } = await supabase
          .from('products')
          .select('id')
          .eq('id', testProduct.id)
          .single();
          
        const { data: verifyPriceList } = await supabase
          .from('price_list')
          .select('id')
          .eq('id', testPriceList.id)
          .single();
          
        console.log('   - Product exists:', !!verifyProduct);
        console.log('   - Price list exists:', !!verifyPriceList);
      }
    } else {
      console.log('✅ Successfully created price list item:', createdItem.id);
      
      // Clean up - delete the test item
      await supabase
        .from('price_list_item')
        .delete()
        .eq('id', createdItem.id);
      console.log('   - Test item cleaned up');
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testProductIds(); 