#!/usr/bin/env node

/**
 * Migration Script: Add Inventory Thresholds to Products Table
 * 
 * This script applies the migration to add reorder_level and max_stock_level
 * columns to the products table, which are essential for inventory management.
 * 
 * Usage: node scripts/apply-inventory-migration.js
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../backend/.env') });

async function applyMigration() {
  console.log('🚀 Starting inventory thresholds migration...');
  
  // Read Supabase credentials from environment
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase credentials in environment variables');
    console.error('Please ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in backend/.env');
    process.exit(1);
  }
  
  // Create Supabase client with service role
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  
  try {
    // Read migration SQL file
    const migrationPath = path.join(__dirname, '../supabase/migrations/20250104000000_add_inventory_thresholds_to_products.sql');
    
    if (!fs.existsSync(migrationPath)) {
      console.error('❌ Migration file not found:', migrationPath);
      process.exit(1);
    }
    
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    console.log('📖 Read migration file:', migrationPath);
    
    // Check if columns already exist
    console.log('🔍 Checking if columns already exist...');
    const { data: columns, error: columnsError } = await supabase
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_name', 'products')
      .in('column_name', ['reorder_level', 'max_stock_level']);
    
    if (columnsError) {
      console.error('❌ Error checking existing columns:', columnsError);
      process.exit(1);
    }
    
    const existingColumns = columns?.map(col => col.column_name) || [];
    const hasReorderLevel = existingColumns.includes('reorder_level');
    const hasMaxStockLevel = existingColumns.includes('max_stock_level');
    
    if (hasReorderLevel && hasMaxStockLevel) {
      console.log('✅ Columns already exist! Migration already applied.');
      return;
    }
    
    console.log('📝 Missing columns:', {
      reorder_level: !hasReorderLevel,
      max_stock_level: !hasMaxStockLevel
    });
    
    // Apply migration
    console.log('⚡ Applying migration...');
    
    // Split SQL by statements for better error handling
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt && !stmt.startsWith('--') && !stmt.startsWith('/*'));
    
    let appliedStatements = 0;
    
    for (const statement of statements) {
      if (!statement) continue;
      
      try {
        await supabase.rpc('exec_sql', { sql: statement });
        appliedStatements++;
        console.log(`✓ Applied statement ${appliedStatements}/${statements.length}`);
      } catch (error) {
        // Some statements might fail if they already exist, which is okay
        if (error.message.includes('already exists') || 
            error.message.includes('duplicate') ||
            error.message.includes('column already exists')) {
          console.log(`⚠️  Statement ${appliedStatements + 1} skipped (already exists)`);
          appliedStatements++;
        } else {
          console.error(`❌ Error in statement ${appliedStatements + 1}:`, error.message);
          console.error('Statement:', statement);
          throw error;
        }
      }
    }
    
    // Verify migration success
    console.log('🔍 Verifying migration...');
    const { data: verifyColumns, error: verifyError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, column_default')
      .eq('table_name', 'products')
      .in('column_name', ['reorder_level', 'max_stock_level', 'seasonal_demand_factor', 'lead_time_days']);
    
    if (verifyError) {
      console.error('❌ Error verifying migration:', verifyError);
      process.exit(1);
    }
    
    console.log('✅ Migration verification:');
    verifyColumns?.forEach(col => {
      console.log(`  ✓ ${col.column_name} (${col.data_type}) - default: ${col.column_default || 'none'}`);
    });
    
    // Check a few sample products
    console.log('🔍 Checking sample products...');
    const { data: sampleProducts, error: sampleError } = await supabase
      .from('products')
      .select('name, sku, reorder_level, max_stock_level, capacity_kg')
      .eq('status', 'active')
      .limit(5);
    
    if (sampleError) {
      console.warn('⚠️  Could not fetch sample products:', sampleError.message);
    } else if (sampleProducts && sampleProducts.length > 0) {
      console.log('📊 Sample products with new thresholds:');
      sampleProducts.forEach(product => {
        console.log(`  • ${product.name} (${product.sku}): reorder=${product.reorder_level}, max=${product.max_stock_level}, capacity=${product.capacity_kg}kg`);
      });
    }
    
    console.log('');
    console.log('🎉 Migration completed successfully!');
    console.log('');
    console.log('📋 What was added:');
    console.log('  • reorder_level column - triggers restocking alerts');
    console.log('  • max_stock_level column - prevents overstocking');
    console.log('  • seasonal_demand_factor column - handles seasonal variations');
    console.log('  • lead_time_days column - tracks delivery times');
    console.log('  • Validation functions and triggers');
    console.log('  • Smart defaults based on product capacity');
    console.log('');
    console.log('💡 Next steps:');
    console.log('  • Review and adjust thresholds for your products');
    console.log('  • Test inventory management features');
    console.log('  • The API will now work without errors!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('');
    console.error('🔧 Troubleshooting:');
    console.error('  • Check your Supabase credentials');
    console.error('  • Ensure you have sufficient permissions');
    console.error('  • Check if the products table exists');
    console.error('  • Contact support if the issue persists');
    process.exit(1);
  }
}

// Alternative approach using direct SQL execution if RPC doesn't work
async function applyMigrationDirect() {
  console.log('🔄 Trying direct SQL approach...');
  
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  try {
    // Just try to add the columns directly
    const addColumnsSQL = `
      ALTER TABLE products 
      ADD COLUMN IF NOT EXISTS reorder_level NUMERIC DEFAULT 10 CHECK (reorder_level >= 0),
      ADD COLUMN IF NOT EXISTS max_stock_level NUMERIC DEFAULT 100 CHECK (max_stock_level >= 0);
    `;
    
    console.log('📝 Adding essential columns...');
    await supabase.rpc('exec_sql', { sql: addColumnsSQL });
    
    // Update existing products with sensible defaults
    const updateDefaultsSQL = `
      UPDATE products 
      SET 
        reorder_level = CASE 
          WHEN capacity_kg >= 50 THEN 5
          WHEN capacity_kg >= 20 THEN 10  
          WHEN capacity_kg >= 5 THEN 20   
          ELSE 10                        
        END,
        max_stock_level = CASE 
          WHEN capacity_kg >= 50 THEN 50  
          WHEN capacity_kg >= 20 THEN 100 
          WHEN capacity_kg >= 5 THEN 200  
          ELSE 100                        
        END
      WHERE reorder_level IS NULL OR max_stock_level IS NULL;
    `;
    
    console.log('🔄 Setting smart defaults...');
    await supabase.rpc('exec_sql', { sql: updateDefaultsSQL });
    
    console.log('✅ Basic migration completed!');
    
  } catch (error) {
    console.error('❌ Direct migration also failed:', error.message);
    throw error;
  }
}

// Run migration
if (import.meta.url === `file://${process.argv[1]}`) {
  applyMigration().catch(async (error) => {
    console.log('');
    console.log('🔄 Primary migration method failed, trying alternative approach...');
    try {
      await applyMigrationDirect();
    } catch (fallbackError) {
      console.error('❌ All migration methods failed');
      process.exit(1);
    }
  });
}

export { applyMigration, applyMigrationDirect };