-- Production Tenant Cleanup Script
-- This script removes ALL tenant_id references from the inventory system
-- and ensures the database is properly configured for single-tenant operation
-- 
-- ⚠️  IMPORTANT: This script should be run directly on the production database
-- ⚠️  Make sure to backup your database before running this script
-- ⚠️  Test this script on a staging environment first if possible

BEGIN;

-- =============================================================================
-- STEP 1: DROP ALL RLS POLICIES AND DISABLE RLS
-- =============================================================================

-- Drop all RLS policies on all tables
DO $$
DECLARE
    pol RECORD;
    table_names TEXT[] := ARRAY[
        'customers', 'orders', 'order_lines', 'products', 'inventory', 'inventory_balance', 
        'warehouses', 'transfers', 'transfer_items', 'price_lists', 'price_list_items', 
        'addresses', 'truck', 'truck_inventory', 'truck_routes', 'truck_allocations', 
        'truck_maintenance', 'stock_movements', 'rls_audit_log'
    ];
    tbl TEXT;
BEGIN
    FOREACH tbl IN ARRAY table_names
    LOOP
        -- Check if table exists
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = tbl AND table_schema = 'public') THEN
            -- Drop all policies for this table
            FOR pol IN 
                SELECT policyname 
                FROM pg_policies 
                WHERE tablename = tbl AND schemaname = 'public'
            LOOP
                EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, tbl);
                RAISE NOTICE 'Dropped policy % on table %', pol.policyname, tbl;
            END LOOP;
            
            -- Disable RLS on the table
            EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', tbl);
            RAISE NOTICE 'Disabled RLS on table %', tbl;
        END IF;
    END LOOP;
END $$;

-- =============================================================================
-- STEP 2: DROP ALL TENANT-RELATED FUNCTIONS
-- =============================================================================

-- Drop all functions that reference tenant_id
DROP FUNCTION IF EXISTS auth.user_belongs_to_tenant(uuid) CASCADE;
DROP FUNCTION IF EXISTS auth.current_tenant_id() CASCADE;
DROP FUNCTION IF EXISTS validate_tenant_access(uuid, text) CASCADE;
DROP FUNCTION IF EXISTS reserve_stock(uuid, numeric, uuid) CASCADE;
DROP FUNCTION IF EXISTS fulfill_order_line(uuid, numeric, uuid) CASCADE;
DROP FUNCTION IF EXISTS release_reserved_stock(uuid, numeric, uuid) CASCADE;
DROP FUNCTION IF EXISTS auth.user_has_role(text) CASCADE;
DROP FUNCTION IF EXISTS log_rls_violation(text, text, jsonb) CASCADE;
DROP FUNCTION IF EXISTS check_rls_status(text[]) CASCADE;

-- Drop audit log table
DROP TABLE IF EXISTS rls_audit_log CASCADE;

RAISE NOTICE 'Dropped all tenant-related functions and audit table';

-- =============================================================================
-- STEP 3: REMOVE ALL TENANT_ID COLUMNS FROM TABLES
-- =============================================================================

-- Remove tenant_id columns from all tables
DO $$
DECLARE
    table_names TEXT[] := ARRAY[
        'customers', 'orders', 'order_lines', 'products', 'inventory', 'inventory_balance',
        'warehouses', 'transfers', 'transfer_items', 'price_lists', 'price_list_items',
        'addresses', 'truck', 'truck_inventory', 'truck_routes', 'truck_allocations',
        'truck_maintenance', 'stock_movements'
    ];
    tbl TEXT;
BEGIN
    FOREACH tbl IN ARRAY table_names
    LOOP
        -- Check if table exists and has tenant_id column
        IF EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = tbl AND column_name = 'tenant_id' AND table_schema = 'public') THEN
            EXECUTE format('ALTER TABLE %I DROP COLUMN tenant_id', tbl);
            RAISE NOTICE 'Dropped tenant_id column from table %', tbl;
        END IF;
    END LOOP;
END $$;

-- =============================================================================
-- STEP 4: DROP ALL TENANT-RELATED INDEXES
-- =============================================================================

-- Drop all indexes that reference tenant_id
DROP INDEX IF EXISTS idx_customers_tenant_id;
DROP INDEX IF EXISTS idx_orders_tenant_id_status;
DROP INDEX IF EXISTS idx_orders_tenant_id_created_at;
DROP INDEX IF EXISTS idx_order_lines_tenant_id;
DROP INDEX IF EXISTS idx_products_tenant_id_active;
DROP INDEX IF EXISTS idx_inventory_tenant_id_warehouse;
DROP INDEX IF EXISTS idx_warehouses_tenant_id_active;
DROP INDEX IF EXISTS idx_transfers_tenant_id_status;
DROP INDEX IF EXISTS idx_transfer_items_tenant_id;
DROP INDEX IF EXISTS idx_price_lists_tenant_id_active;
DROP INDEX IF EXISTS idx_price_list_items_tenant_id;
DROP INDEX IF EXISTS idx_addresses_tenant_id;
DROP INDEX IF EXISTS idx_trucks_tenant_id_active;

-- Drop the problematic index from manual migration
DROP INDEX IF EXISTS idx_products_stock_thresholds;

RAISE NOTICE 'Dropped all tenant-related indexes';

-- =============================================================================
-- STEP 5: FIX INVENTORY TABLE NAMING AND STRUCTURE
-- =============================================================================

-- Handle inventory table naming (rename 'inventory' to 'inventory_balance' if needed)
DO $$
BEGIN
    -- If 'inventory' table exists but 'inventory_balance' doesn't, rename it
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inventory' AND table_schema = 'public')
       AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inventory_balance' AND table_schema = 'public') THEN
        
        -- Rename the table
        ALTER TABLE inventory RENAME TO inventory_balance;
        RAISE NOTICE 'Renamed inventory table to inventory_balance';
        
        -- Update foreign key constraint names if they exist
        BEGIN
            ALTER TABLE inventory_balance 
                RENAME CONSTRAINT inventory_warehouse_id_fkey TO inventory_balance_warehouse_id_fkey;
        EXCEPTION WHEN OTHERS THEN
            -- Constraint might not exist or have different name
            NULL;
        END;
        
        BEGIN
            ALTER TABLE inventory_balance 
                RENAME CONSTRAINT inventory_product_id_fkey TO inventory_balance_product_id_fkey;
        EXCEPTION WHEN OTHERS THEN
            -- Constraint might not exist or have different name
            NULL;
        END;
    END IF;
    
    -- If neither table exists, create inventory_balance
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inventory_balance' AND table_schema = 'public') THEN
        CREATE TABLE inventory_balance (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            warehouse_id UUID NOT NULL,
            product_id UUID NOT NULL,
            qty_full NUMERIC NOT NULL DEFAULT 0 CHECK (qty_full >= 0),
            qty_empty NUMERIC NOT NULL DEFAULT 0 CHECK (qty_empty >= 0),
            qty_reserved NUMERIC NOT NULL DEFAULT 0 CHECK (qty_reserved >= 0 AND qty_reserved <= qty_full),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            
            -- Ensure unique inventory record per warehouse/product combination
            CONSTRAINT unique_warehouse_product UNIQUE (warehouse_id, product_id)
        );
        
        -- Add foreign key constraints if the referenced tables exist
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'warehouses' AND table_schema = 'public') THEN
            ALTER TABLE inventory_balance 
                ADD CONSTRAINT inventory_balance_warehouse_id_fkey 
                FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE CASCADE;
        END IF;
        
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products' AND table_schema = 'public') THEN
            ALTER TABLE inventory_balance 
                ADD CONSTRAINT inventory_balance_product_id_fkey 
                FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
        END IF;
        
        RAISE NOTICE 'Created inventory_balance table';
    END IF;
END $$;

-- =============================================================================
-- STEP 6: ENSURE PRODUCTS TABLE HAS INVENTORY THRESHOLD COLUMNS
-- =============================================================================

-- Add inventory threshold columns to products table
DO $$
BEGIN
    -- Add columns if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'products' AND column_name = 'reorder_level' AND table_schema = 'public') THEN
        ALTER TABLE products ADD COLUMN reorder_level NUMERIC DEFAULT 10 CHECK (reorder_level >= 0);
        RAISE NOTICE 'Added reorder_level column to products table';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'products' AND column_name = 'max_stock_level' AND table_schema = 'public') THEN
        ALTER TABLE products ADD COLUMN max_stock_level NUMERIC DEFAULT 100 CHECK (max_stock_level >= 0);
        RAISE NOTICE 'Added max_stock_level column to products table';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'products' AND column_name = 'seasonal_demand_factor' AND table_schema = 'public') THEN
        ALTER TABLE products ADD COLUMN seasonal_demand_factor NUMERIC DEFAULT 1.0 CHECK (seasonal_demand_factor > 0);
        RAISE NOTICE 'Added seasonal_demand_factor column to products table';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'products' AND column_name = 'lead_time_days' AND table_schema = 'public') THEN
        ALTER TABLE products ADD COLUMN lead_time_days INTEGER DEFAULT 7 CHECK (lead_time_days >= 0);
        RAISE NOTICE 'Added lead_time_days column to products table';
    END IF;
    
    -- Add check constraint for max_stock_level >= reorder_level
    BEGIN
        ALTER TABLE products 
            ADD CONSTRAINT products_max_stock_level_check 
            CHECK (max_stock_level >= reorder_level);
    EXCEPTION WHEN OTHERS THEN
        -- Constraint might already exist
        NULL;
    END;
END $$;

-- Set smart defaults for products that don't have thresholds
UPDATE products 
SET 
    reorder_level = CASE 
        WHEN capacity_kg IS NOT NULL AND capacity_kg >= 50 THEN 5    -- Large cylinders: lower reorder threshold
        WHEN capacity_kg IS NOT NULL AND capacity_kg >= 20 THEN 10   -- Medium cylinders: standard threshold
        WHEN capacity_kg IS NOT NULL AND capacity_kg >= 5 THEN 20    -- Small cylinders: higher threshold
        ELSE 10                                                      -- Default for other products
    END,
    max_stock_level = CASE 
        WHEN capacity_kg IS NOT NULL AND capacity_kg >= 50 THEN 50   -- Large cylinders: lower max stock
        WHEN capacity_kg IS NOT NULL AND capacity_kg >= 20 THEN 100  -- Medium cylinders: standard max stock
        WHEN capacity_kg IS NOT NULL AND capacity_kg >= 5 THEN 200   -- Small cylinders: higher max stock
        ELSE 100                                                     -- Default for other products
    END,
    seasonal_demand_factor = COALESCE(seasonal_demand_factor, 1.0),
    lead_time_days = COALESCE(lead_time_days, 
        CASE 
            WHEN variant_type = 'refillable' THEN 3                     -- Refillable products are faster to restock
            WHEN variant_type = 'disposable' THEN 14                    -- Disposable products may take longer
            ELSE 7                                                       -- Standard lead time
        END
    )
WHERE reorder_level IS NULL OR max_stock_level IS NULL OR seasonal_demand_factor IS NULL OR lead_time_days IS NULL;

-- =============================================================================
-- STEP 7: CREATE STOCK MOVEMENTS TABLE
-- =============================================================================

-- Create stock movement tracking table if it doesn't exist
CREATE TABLE IF NOT EXISTS stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inventory_id UUID NOT NULL,
    movement_type TEXT NOT NULL CHECK (movement_type IN ('adjustment', 'transfer_in', 'transfer_out', 'order_reserve', 'order_fulfill', 'order_cancel')),
    qty_full_change NUMERIC NOT NULL,
    qty_empty_change NUMERIC NOT NULL,
    reason TEXT,
    reference_id UUID, -- Can reference order_id, transfer_id, etc.
    reference_type TEXT, -- 'order', 'transfer', 'adjustment', etc.
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID -- References auth.users(id) but without FK to avoid issues
);

-- Add foreign key to inventory_balance if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inventory_balance' AND table_schema = 'public') 
       AND NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                       WHERE constraint_name = 'stock_movements_inventory_id_fkey' AND table_name = 'stock_movements') THEN
        ALTER TABLE stock_movements 
            ADD CONSTRAINT stock_movements_inventory_id_fkey 
            FOREIGN KEY (inventory_id) REFERENCES inventory_balance(id) ON DELETE CASCADE;
        RAISE NOTICE 'Added foreign key constraint to stock_movements table';
    END IF;
END $$;

-- =============================================================================
-- STEP 8: CREATE ESSENTIAL INDEXES
-- =============================================================================

-- Create indexes for inventory_balance
CREATE INDEX IF NOT EXISTS idx_inventory_balance_warehouse_product 
    ON inventory_balance(warehouse_id, product_id);

CREATE INDEX IF NOT EXISTS idx_inventory_balance_low_stock 
    ON inventory_balance(qty_full) WHERE qty_full < 10;

CREATE INDEX IF NOT EXISTS idx_inventory_balance_updated_at 
    ON inventory_balance(updated_at DESC);

-- Create indexes for products performance
CREATE INDEX IF NOT EXISTS idx_products_reorder_level 
    ON products (reorder_level) WHERE reorder_level IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_active_status 
    ON products (status) WHERE status = 'active';

-- Create the corrected index without tenant_id
CREATE INDEX IF NOT EXISTS idx_products_stock_thresholds_corrected 
    ON products (reorder_level, max_stock_level) WHERE reorder_level IS NOT NULL;

-- Create indexes for stock movements
CREATE INDEX IF NOT EXISTS idx_stock_movements_inventory_id 
    ON stock_movements(inventory_id);

CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at 
    ON stock_movements(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_stock_movements_reference 
    ON stock_movements(reference_type, reference_id);

-- =============================================================================
-- STEP 9: CREATE/UPDATE TIMESTAMP TRIGGERS
-- =============================================================================

-- Create or update timestamp trigger for inventory_balance
CREATE OR REPLACE FUNCTION update_inventory_balance_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_inventory_balance_timestamp ON inventory_balance;
CREATE TRIGGER update_inventory_balance_timestamp
    BEFORE UPDATE ON inventory_balance
    FOR EACH ROW
    EXECUTE FUNCTION update_inventory_balance_timestamp();

-- =============================================================================
-- STEP 10: ENSURE PROPER PERMISSIONS
-- =============================================================================

-- Grant appropriate permissions to authenticated users
DO $$
BEGIN
    -- Grant permissions on core tables
    GRANT ALL ON inventory_balance TO authenticated;
    GRANT ALL ON stock_movements TO authenticated;
    GRANT ALL ON products TO authenticated;
    
    -- Grant permissions on other tables if they exist
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'warehouses' AND table_schema = 'public') THEN
        GRANT ALL ON warehouses TO authenticated;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'customers' AND table_schema = 'public') THEN
        GRANT ALL ON customers TO authenticated;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'orders' AND table_schema = 'public') THEN
        GRANT ALL ON orders TO authenticated;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'order_lines' AND table_schema = 'public') THEN
        GRANT ALL ON order_lines TO authenticated;
    END IF;
    
    RAISE NOTICE 'Granted permissions to authenticated users';
END $$;

-- =============================================================================
-- STEP 11: ADD HELPFUL COMMENTS
-- =============================================================================

-- Add comments to tables and columns
COMMENT ON TABLE inventory_balance IS 'Tracks current inventory levels for each product at each warehouse';
COMMENT ON COLUMN inventory_balance.qty_full IS 'Number of full cylinders/units in stock';
COMMENT ON COLUMN inventory_balance.qty_empty IS 'Number of empty cylinders awaiting refill';
COMMENT ON COLUMN inventory_balance.qty_reserved IS 'Number of full cylinders reserved for pending orders';

COMMENT ON TABLE stock_movements IS 'Audit trail of all inventory movements and adjustments';
COMMENT ON COLUMN stock_movements.movement_type IS 'Type of inventory movement';
COMMENT ON COLUMN stock_movements.reference_id IS 'ID of the related record (order, transfer, etc.)';
COMMENT ON COLUMN stock_movements.reference_type IS 'Type of the related record';

COMMENT ON COLUMN products.reorder_level IS 'Minimum stock level that triggers restocking alerts and transfers';
COMMENT ON COLUMN products.max_stock_level IS 'Maximum recommended stock level to prevent overstocking';
COMMENT ON COLUMN products.seasonal_demand_factor IS 'Multiplier for seasonal demand variations (1.0 = normal, >1.0 = peak season)';
COMMENT ON COLUMN products.lead_time_days IS 'Expected days from order to delivery for this product';

-- =============================================================================
-- STEP 12: FINAL VALIDATION AND CLEANUP
-- =============================================================================

-- Remove any old inventory table if inventory_balance exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inventory_balance' AND table_schema = 'public') 
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inventory' AND table_schema = 'public') THEN
        DROP TABLE inventory CASCADE;
        RAISE NOTICE 'Dropped old inventory table after confirming inventory_balance exists';
    END IF;
END $$;

COMMIT;

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================

-- Check that no tenant_id columns remain
SELECT 
    'VERIFICATION: Tenant ID cleanup' as check_name,
    COUNT(*)::text as remaining_tenant_id_columns,
    CASE 
        WHEN COUNT(*) = 0 THEN '✓ SUCCESS: No tenant_id columns remain'
        ELSE '✗ ERROR: ' || COUNT(*) || ' tenant_id columns still exist'
    END as status
FROM information_schema.columns 
WHERE column_name = 'tenant_id' AND table_schema = 'public';

-- Check that RLS policies are disabled
SELECT 
    'VERIFICATION: RLS policies' as check_name,
    COUNT(*)::text as total_rls_policies,
    CASE 
        WHEN COUNT(*) = 0 THEN '✓ SUCCESS: No RLS policies remain'
        ELSE '✗ WARNING: ' || COUNT(*) || ' RLS policies still exist'
    END as status
FROM pg_policies 
WHERE schemaname = 'public';

-- Check that inventory_balance table exists with correct structure
SELECT 
    'VERIFICATION: Inventory table' as check_name,
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'inventory_balance')::text as inventory_balance_exists,
    CASE 
        WHEN EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'inventory_balance') THEN '✓ SUCCESS: inventory_balance table exists'
        ELSE '✗ ERROR: inventory_balance table does not exist'
    END as status;

-- Check that products table has inventory threshold columns
SELECT 
    'VERIFICATION: Product thresholds' as check_name,
    (SELECT COUNT(*) FROM information_schema.columns 
     WHERE table_name = 'products' AND column_name IN ('reorder_level', 'max_stock_level', 'seasonal_demand_factor', 'lead_time_days'))::text as threshold_columns,
    CASE 
        WHEN (SELECT COUNT(*) FROM information_schema.columns 
              WHERE table_name = 'products' AND column_name IN ('reorder_level', 'max_stock_level', 'seasonal_demand_factor', 'lead_time_days')) = 4 
        THEN '✓ SUCCESS: All product threshold columns exist'
        ELSE '✗ ERROR: Missing product threshold columns'
    END as status;

-- Check that stock_movements table exists
SELECT 
    'VERIFICATION: Stock movements' as check_name,
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'stock_movements')::text as stock_movements_exists,
    CASE 
        WHEN EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'stock_movements') THEN '✓ SUCCESS: stock_movements table exists'
        ELSE '✗ ERROR: stock_movements table does not exist'
    END as status;

-- Check essential indexes
SELECT 
    'VERIFICATION: Essential indexes' as check_name,
    COUNT(*)::text as essential_indexes_count,
    CASE 
        WHEN COUNT(*) >= 3 THEN '✓ SUCCESS: Essential indexes exist'
        ELSE '✗ WARNING: Some essential indexes may be missing'
    END as status
FROM pg_indexes 
WHERE indexname IN ('idx_inventory_balance_warehouse_product', 'idx_inventory_balance_low_stock', 'idx_products_reorder_level');

-- Final summary
SELECT 
    'FINAL SUMMARY' as summary,
    'Production tenant cleanup completed successfully' as message,
    'The inventory system should now work without tenant_id errors' as next_steps;

-- Test inventory creation (this should work without tenant_id errors)
DO $$
DECLARE
    test_result TEXT;
BEGIN
    -- Try to query inventory_balance table
    PERFORM COUNT(*) FROM inventory_balance;
    test_result := '✓ SUCCESS: Can query inventory_balance table';
    
    RAISE NOTICE '%', test_result;
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE '✗ ERROR: Cannot query inventory_balance table: %', SQLERRM;
END $$;

RAISE NOTICE 'Production tenant cleanup script completed. Please review the verification results above.';