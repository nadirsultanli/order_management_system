const { createClient } = require('@supabase/supabase-js');

// Configuration
const supabaseUrl = 'https://trcjinrdjgizqhjkdgvc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL3RyY3JqaW5yZGpnaXpxaGpkZ3ZjLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiI4MzUzMjQ2Yi1iMGI4LTQ1MDgtOGIwNi1iZDlkM2RjMTgzODEiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzUyNjMwODUwLCJpYXQiOjE3NTI2MjcyNTAsImVtYWlsIjoibmFkaXJAY2lyY2wudGVhbSIsInBob25lIjoiIiwiYXBwX21ldGFkYXRhIjp7InByb3ZpZGVyIjoiZW1haWwiLCJwcm92aWRlcnMiOlsiZW1haWwiXX0sInVzZXJfbWV0YWRhdGEiOnsiZW1haWxfdmVyaWZpZWQiOnRydWV9LCJyb2xlIjoiYXV0aGVudGljYXRlZCIsImFhbCI6ImFhbDEiLCJhbXIiOlt7Im1ldGhvZCI6InBhc3N3b3JkIiwidGltZXN0YW1wIjoxNzUyNjI3MjUwfV0sInNlc3Npb25faWQiOiI4MDI5ZjI5Yy0yYmRkLTQzNTMtODQzNS1lNThhZGM3MjM4ZjkiLCJpc19hbm9ueW1vdXMiOmZhbHNlfQ.FcFH9j4E1M_H-GmWvh-4JLpU48Sv-TV6gL6o51rrsL0';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false
  }
});

async function debugProductIssue() {
  console.log('🔍 Debugging Product Foreign Key Issue...\n');

  try {
    // Test 1: Check if there are any products at all
    console.log('1️⃣ Checking if products exist...');
    const { data: allProducts, error: allProductsError } = await supabase
      .from('products')
      .select('id, sku, name, status')
      .limit(5);

    if (allProductsError) {
      console.error('❌ Error fetching all products:', allProductsError);
      return;
    }

    console.log(`✅ Found ${allProducts.length} products total:`);
    allProducts.forEach(product => {
      console.log(`   - ID: ${product.id}, SKU: ${product.sku}, Name: ${product.name}, Status: ${product.status}`);
    });

    if (allProducts.length === 0) {
      console.log('⚠️  No products found in database! This is the problem.');
      return;
    }

    // Test 2: Check active products specifically
    console.log('\n2️⃣ Checking active products...');
    const { data: activeProducts, error: activeProductsError } = await supabase
      .from('products')
      .select('id, sku, name, status')
      .eq('status', 'active')
      .limit(5);

    if (activeProductsError) {
      console.error('❌ Error fetching active products:', activeProductsError);
      return;
    }

    console.log(`✅ Found ${activeProducts.length} active products:`);
    activeProducts.forEach(product => {
      console.log(`   - ID: ${product.id}, SKU: ${product.sku}, Name: ${product.name}`);
    });

    if (activeProducts.length === 0) {
      console.log('⚠️  No active products found! This is the problem.');
      return;
    }

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

    console.log(`✅ Found ${priceLists.length} price lists:`);
    priceLists.forEach(priceList => {
      console.log(`   - ID: ${priceList.id}, Name: ${priceList.name}, Method: ${priceList.pricing_method}`);
    });

    if (priceLists.length === 0) {
      console.log('⚠️  No price lists found!');
      return;
    }

    // Test 4: Check the price_list_item table structure
    console.log('\n4️⃣ Checking price_list_item table structure...');
    const { data: tableInfo, error: tableError } = await supabase
      .rpc('get_table_info', { table_name: 'price_list_item' });

    if (tableError) {
      console.log('   - Could not get table info via RPC, checking manually...');
      
      // Try to get a sample record to see the structure
      const { data: sampleItem, error: sampleError } = await supabase
        .from('price_list_item')
        .select('*')
        .limit(1);

      if (sampleError) {
        console.log('   - No existing price list items found (this is normal)');
      } else {
        console.log('   - Sample price list item structure:', Object.keys(sampleItem[0] || {}));
      }
    } else {
      console.log('   - Table structure:', tableInfo);
    }

    // Test 5: Try to create a price list item with the first available product and price list
    console.log('\n5️⃣ Testing price list item creation...');
    const testProduct = activeProducts[0];
    const testPriceList = priceLists[0];

    console.log(`   Using product: ${testProduct.name} (${testProduct.id})`);
    console.log(`   Using price list: ${testPriceList.name} (${testPriceList.id})`);

    const insertData = {
      price_list_id: testPriceList.id,
      product_id: testProduct.id,
      unit_price: testPriceList.pricing_method === 'per_unit' ? 100.00 : null,
      price_per_kg: testPriceList.pricing_method === 'per_kg' ? 50.00 : null,
      pricing_method: testPriceList.pricing_method,
      min_qty: 1,
      surcharge_pct: 0
    };

    console.log('   Inserting data:', insertData);

    const { data: createdItem, error: createError } = await supabase
      .from('price_list_item')
      .insert(insertData)
      .select()
      .single();

    if (createError) {
      console.error('❌ Error creating price list item:', createError);
      
      if (createError.message.includes('foreign key constraint')) {
        console.log('\n🔍 Foreign key constraint error analysis:');
        console.log('   - This means either:');
        console.log('     a) The product_id does not exist in the products table');
        console.log('     b) The price_list_id does not exist in the price_list table');
        
        // Verify both IDs exist
        const { data: verifyProduct } = await supabase
          .from('products')
          .select('id, sku, name')
          .eq('id', testProduct.id)
          .single();
          
        const { data: verifyPriceList } = await supabase
          .from('price_list')
          .select('id, name')
          .eq('id', testPriceList.id)
          .single();
          
        console.log('   - Product verification:');
        console.log(`     * Product ID ${testProduct.id} exists: ${!!verifyProduct}`);
        if (verifyProduct) {
          console.log(`     * Product details: ${verifyProduct.sku} - ${verifyProduct.name}`);
        }
        
        console.log('   - Price list verification:');
        console.log(`     * Price list ID ${testPriceList.id} exists: ${!!verifyPriceList}`);
        if (verifyPriceList) {
          console.log(`     * Price list details: ${verifyPriceList.name}`);
        }
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
    console.error('❌ Debug failed:', error);
  }
}

debugProductIssue(); 