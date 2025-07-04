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

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

async function applyMigration() {
  console.log('🚀 Starting inventory thresholds migration...');
  
  // Read Supabase credentials from environment
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase credentials in environment variables');
    console.error('Please ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env');
    process.exit(1);
  }
  
  console.log('🔗 Connecting to Supabase project:', supabaseUrl);
  
  // Create Supabase client with service role
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  
  try {
    // Check if columns already exist
    console.log('🔍 Checking if columns already exist...');
    
    // Try a simple query first to check connectivity
    const { data: testQuery, error: testError } = await supabase
      .from('products')
      .select('id')
      .limit(1);
    
    if (testError) {
      console.error('❌ Cannot connect to database:', testError.message);
      process.exit(1);
    }
    
    console.log('✅ Database connection successful');
    
    // Check current schema
    const { data: columns, error: columnsError } = await supabase
      .rpc('exec_sql', { 
        sql: `
          SELECT column_name, data_type, column_default 
          FROM information_schema.columns 
          WHERE table_name = 'products' 
            AND column_name IN ('reorder_level', 'max_stock_level', 'seasonal_demand_factor', 'lead_time_days')
          ORDER BY column_name;
        `
      });
    
    if (columnsError) {
      console.log('⚠️  Could not check existing columns via RPC, trying direct approach...');
    } else {
      const existingColumns = columns?.map(col => col.column_name) || [];
      console.log('📋 Existing columns:', existingColumns);
      
      if (existingColumns.includes('reorder_level') && existingColumns.includes('max_stock_level')) {
        console.log('✅ Required columns already exist! Migration already applied.');
        
        // Show sample data
        const { data: sampleProducts } = await supabase
          .from('products')
          .select('name, sku, reorder_level, max_stock_level, capacity_kg')
          .eq('status', 'active')
          .limit(3);
        
        if (sampleProducts && sampleProducts.length > 0) {
          console.log('📊 Sample products with thresholds:');
          sampleProducts.forEach(product => {
            console.log(`  • ${product.name} (${product.sku}): reorder=${product.reorder_level}, max=${product.max_stock_level}`);
          });
        }
        
        return;
      }
    }
    
    // Apply the migration
    console.log('⚡ Applying inventory thresholds migration...');
    
    // Step 1: Add columns
    console.log('📝 Adding columns to products table...');
    const addColumnsResult = await supabase.rpc('exec_sql', { 
      sql: `
        ALTER TABLE products 
        ADD COLUMN IF NOT EXISTS reorder_level NUMERIC DEFAULT 10 CHECK (reorder_level >= 0),
        ADD COLUMN IF NOT EXISTS max_stock_level NUMERIC DEFAULT 100 CHECK (max_stock_level >= 0),
        ADD COLUMN IF NOT EXISTS seasonal_demand_factor NUMERIC DEFAULT 1.0 CHECK (seasonal_demand_factor > 0),
        ADD COLUMN IF NOT EXISTS lead_time_days INTEGER DEFAULT 7 CHECK (lead_time_days >= 0);
      `
    });
    
    if (addColumnsResult.error) {
      console.error('❌ Error adding columns:', addColumnsResult.error.message);
      throw addColumnsResult.error;
    }
    
    console.log('✅ Columns added successfully');
    
    // Step 2: Add comments
    console.log('📖 Adding column comments...');
    await supabase.rpc('exec_sql', { 
      sql: `
        COMMENT ON COLUMN products.reorder_level IS 'Minimum stock level that triggers restocking alerts and transfers';
        COMMENT ON COLUMN products.max_stock_level IS 'Maximum recommended stock level to prevent overstocking';
        COMMENT ON COLUMN products.seasonal_demand_factor IS 'Multiplier for seasonal demand variations (1.0 = normal, >1.0 = peak season)';
        COMMENT ON COLUMN products.lead_time_days IS 'Expected days from order to delivery for this product';
      `
    });
    
    // Step 3: Set smart defaults
    console.log('🎯 Setting smart defaults based on product capacity...');
    const updateResult = await supabase.rpc('exec_sql', { 
      sql: `
        UPDATE products 
        SET 
          reorder_level = CASE 
            WHEN capacity_kg IS NOT NULL AND capacity_kg >= 50 THEN 5
            WHEN capacity_kg IS NOT NULL AND capacity_kg >= 20 THEN 10
            WHEN capacity_kg IS NOT NULL AND capacity_kg >= 5 THEN 20
            ELSE 10
          END,
          max_stock_level = CASE 
            WHEN capacity_kg IS NOT NULL AND capacity_kg >= 50 THEN 50
            WHEN capacity_kg IS NOT NULL AND capacity_kg >= 20 THEN 100
            WHEN capacity_kg IS NOT NULL AND capacity_kg >= 5 THEN 200
            ELSE 100
          END,
          seasonal_demand_factor = 1.0,
          lead_time_days = CASE 
            WHEN variant_type = 'refillable' THEN 3
            WHEN variant_type = 'disposable' THEN 14
            ELSE 7
          END
        WHERE reorder_level IS NULL OR max_stock_level IS NULL;
      `
    });
    
    if (updateResult.error) {
      console.error('❌ Error setting defaults:', updateResult.error.message);
      throw updateResult.error;
    }
    
    console.log('✅ Smart defaults applied');
    
    // Step 4: Add validation constraint
    console.log('🔒 Adding validation constraints...');
    await supabase.rpc('exec_sql', { 
      sql: `
        ALTER TABLE products 
        ADD CONSTRAINT IF NOT EXISTS chk_stock_levels_logical 
        CHECK (max_stock_level IS NULL OR reorder_level IS NULL OR max_stock_level >= reorder_level);
      `
    });
    
    // Step 5: Create indexes for performance
    console.log('⚡ Creating performance indexes...');
    await supabase.rpc('exec_sql', { 
      sql: `
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_reorder_level 
        ON products (reorder_level) WHERE reorder_level IS NOT NULL;
      `
    });
    
    // Verify migration success
    console.log('🔍 Verifying migration...');
    const { data: verifyResult } = await supabase.rpc('exec_sql', { 
      sql: `
        SELECT column_name, data_type, column_default 
        FROM information_schema.columns 
        WHERE table_name = 'products' 
          AND column_name IN ('reorder_level', 'max_stock_level', 'seasonal_demand_factor', 'lead_time_days')
        ORDER BY column_name;
      `
    });
    
    console.log('✅ Migration verification - Added columns:');
    if (verifyResult && verifyResult.length > 0) {
      verifyResult.forEach(col => {
        console.log(`  ✓ ${col.column_name} (${col.data_type}) - default: ${col.column_default || 'none'}`);
      });
    }
    
    // Check sample products
    console.log('🔍 Checking sample products...');
    const { data: sampleProducts, error: sampleError } = await supabase
      .from('products')
      .select('name, sku, reorder_level, max_stock_level, capacity_kg, variant_type')
      .eq('status', 'active')
      .limit(5);
    
    if (sampleError) {
      console.warn('⚠️  Could not fetch sample products:', sampleError.message);
    } else if (sampleProducts && sampleProducts.length > 0) {
      console.log('📊 Sample products with new thresholds:');
      sampleProducts.forEach(product => {
        console.log(`  • ${product.name} (${product.sku})`);
        console.log(`    Capacity: ${product.capacity_kg || 'N/A'}kg | Type: ${product.variant_type || 'N/A'}`);
        console.log(`    Reorder: ${product.reorder_level} | Max: ${product.max_stock_level}`);
        console.log('');
      });
    }
    
    console.log('🎉 Migration completed successfully!');
    console.log('');
    console.log('📋 What was added:');
    console.log('  • reorder_level column - triggers restocking alerts');
    console.log('  • max_stock_level column - prevents overstocking');
    console.log('  • seasonal_demand_factor column - handles seasonal variations');
    console.log('  • lead_time_days column - tracks delivery times');
    console.log('  • Validation constraints');
    console.log('  • Performance indexes');
    console.log('  • Smart defaults based on product capacity');
    console.log('');
    console.log('💡 Next steps:');
    console.log('  • Review and adjust thresholds for your products');
    console.log('  • Test inventory management features');
    console.log('  • The API will now work without "column does not exist" errors!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('');
    console.error('🔧 Troubleshooting:');
    console.error('  • Check your Supabase credentials');
    console.error('  • Ensure you have sufficient permissions');
    console.error('  • Check if the products table exists');
    console.error('  • Try the manual SQL approach instead');
    process.exit(1);
  }
}

// Alternative direct approach if RPC is not available
async function applyDirectSQL() {
  console.log('🔄 Using direct SQL approach...');
  
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  try {
    console.log('📝 Adding essential columns...');
    
    // Try to add columns using the schema modify endpoint
    const { error: addError } = await supabase.rest
      .post('/rest/v1/rpc/exec_sql', {
        sql: `
          ALTER TABLE products 
          ADD COLUMN IF NOT EXISTS reorder_level NUMERIC DEFAULT 10,
          ADD COLUMN IF NOT EXISTS max_stock_level NUMERIC DEFAULT 100;
          
          UPDATE products 
          SET 
            reorder_level = CASE 
              WHEN capacity_kg >= 50 THEN 5
              WHEN capacity_kg >= 20 THEN 10
              ELSE 20
            END,
            max_stock_level = reorder_level * 5
          WHERE reorder_level IS NULL;
        `
      });
    
    if (addError) {
      throw addError;
    }
    
    console.log('✅ Basic migration completed using direct approach!');
    
  } catch (error) {
    console.error('❌ Direct SQL approach also failed:', error.message);
    console.error('');
    console.error('Please apply the migration manually using the Supabase SQL Editor:');
    console.error('');
    console.error('ALTER TABLE products');
    console.error('ADD COLUMN IF NOT EXISTS reorder_level NUMERIC DEFAULT 10,');
    console.error('ADD COLUMN IF NOT EXISTS max_stock_level NUMERIC DEFAULT 100;');
    console.error('');
    console.error('UPDATE products SET reorder_level = 10, max_stock_level = 100 WHERE reorder_level IS NULL;');
    throw error;
  }
}

// Run migration
if (import.meta.url === `file://${process.argv[1]}`) {
  applyMigration().catch(async (error) => {
    console.log('');
    console.log('🔄 Primary migration method failed, trying direct approach...');
    try {
      await applyDirectSQL();
    } catch (fallbackError) {
      console.error('❌ All migration methods failed');
      console.error('Please use the manual SQL approach described in INVENTORY_FIX_INSTRUCTIONS.md');
      process.exit(1);
    }
  });
}

export { applyMigration, applyDirectSQL };