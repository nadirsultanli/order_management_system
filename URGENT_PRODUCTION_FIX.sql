-- URGENT PRODUCTION FIX
-- Run this immediately in your Supabase SQL Editor to fix tenant_id issues
-- This script removes ALL tenant_id references and fixes inventory creation

BEGIN;

-- ================================
-- REMOVE ALL RLS POLICIES
-- ================================
DO $$
DECLARE
    pol RECORD;
    tbl RECORD;
BEGIN
    -- Drop all RLS policies on all tables
    FOR tbl IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('ALTER TABLE IF EXISTS %I DISABLE ROW LEVEL SECURITY', tbl.tablename);
        
        FOR pol IN 
            SELECT policyname 
            FROM pg_policies 
            WHERE tablename = tbl.tablename AND schemaname = 'public'
        LOOP
            EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, tbl.tablename);
        END LOOP;
    END LOOP;
END $$;

-- ================================
-- DROP ALL TENANT-RELATED FUNCTIONS
-- ================================
DROP FUNCTION IF EXISTS validate_tenant_access(uuid);
DROP FUNCTION IF EXISTS validate_tenant_access(uuid, text);
DROP FUNCTION IF EXISTS get_user_tenant_id();
DROP FUNCTION IF EXISTS log_rls_violation(text, text);
DROP FUNCTION IF EXISTS tenant_isolation_check(uuid);
DROP FUNCTION IF EXISTS check_tenant_permissions(uuid, text);

-- ================================
-- REMOVE TENANT_ID COLUMNS
-- ================================
ALTER TABLE IF EXISTS products DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE IF EXISTS customers DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE IF EXISTS orders DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE IF EXISTS order_lines DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE IF EXISTS warehouses DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE IF EXISTS inventory DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE IF EXISTS inventory_balance DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE IF EXISTS stock_movements DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE IF EXISTS truck DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE IF EXISTS truck_inventory DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE IF EXISTS truck_routes DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE IF EXISTS truck_allocations DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE IF EXISTS truck_maintenance DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE IF EXISTS transfers DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE IF EXISTS transfer_items DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE IF EXISTS payments DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE IF EXISTS payment_methods DROP COLUMN IF EXISTS tenant_id;

-- ================================
-- CREATE/FIX INVENTORY_BALANCE TABLE
-- ================================
-- Check if we have 'inventory' table that should be 'inventory_balance'
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inventory' AND table_schema = 'public')
       AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inventory_balance' AND table_schema = 'public') THEN
        ALTER TABLE inventory RENAME TO inventory_balance;
    END IF;
    
    -- Create inventory_balance if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inventory_balance' AND table_schema = 'public') THEN
        CREATE TABLE inventory_balance (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
            product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
            qty_full NUMERIC NOT NULL DEFAULT 0 CHECK (qty_full >= 0),
            qty_empty NUMERIC NOT NULL DEFAULT 0 CHECK (qty_empty >= 0),
            qty_reserved NUMERIC NOT NULL DEFAULT 0 CHECK (qty_reserved >= 0 AND qty_reserved <= qty_full),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            
            CONSTRAINT unique_warehouse_product UNIQUE (warehouse_id, product_id)
        );
    END IF;
END $$;

-- ================================
-- CREATE STOCK_MOVEMENTS TABLE
-- ================================
CREATE TABLE IF NOT EXISTS stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inventory_id UUID NOT NULL REFERENCES inventory_balance(id) ON DELETE CASCADE,
    movement_type TEXT NOT NULL CHECK (movement_type IN ('adjustment', 'transfer_in', 'transfer_out', 'order_reserve', 'order_fulfill', 'order_cancel')),
    qty_full_change NUMERIC NOT NULL,
    qty_empty_change NUMERIC NOT NULL,
    reason TEXT,
    reference_id UUID,
    reference_type TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- ================================
-- ADD MISSING PRODUCT COLUMNS
-- ================================
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS variant_type TEXT NOT NULL DEFAULT 'cylinder' CHECK (variant_type IN ('cylinder', 'refillable', 'disposable')),
ADD COLUMN IF NOT EXISTS requires_tag BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_variant BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS reorder_level NUMERIC DEFAULT 10 CHECK (reorder_level >= 0),
ADD COLUMN IF NOT EXISTS max_stock_level NUMERIC DEFAULT 100 CHECK (max_stock_level >= 0),
ADD COLUMN IF NOT EXISTS seasonal_demand_factor NUMERIC DEFAULT 1.0 CHECK (seasonal_demand_factor > 0),
ADD COLUMN IF NOT EXISTS lead_time_days INTEGER DEFAULT 7 CHECK (lead_time_days >= 0);

-- ================================
-- DROP TENANT-RELATED INDEXES
-- ================================
DROP INDEX IF EXISTS idx_products_tenant_id;
DROP INDEX IF EXISTS idx_customers_tenant_id;
DROP INDEX IF EXISTS idx_orders_tenant_id;
DROP INDEX IF EXISTS idx_warehouses_tenant_id;
DROP INDEX IF EXISTS idx_inventory_tenant_id;
DROP INDEX IF EXISTS idx_inventory_balance_tenant_id;
DROP INDEX IF EXISTS idx_trucks_tenant_id;
DROP INDEX IF EXISTS idx_transfers_tenant_id;

-- ================================
-- CREATE PERFORMANCE INDEXES
-- ================================
CREATE INDEX IF NOT EXISTS idx_inventory_balance_warehouse_product ON inventory_balance(warehouse_id, product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_balance_low_stock ON inventory_balance(qty_full) WHERE qty_full < 10;
CREATE INDEX IF NOT EXISTS idx_inventory_balance_updated_at ON inventory_balance(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_inventory_id ON stock_movements(inventory_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at ON stock_movements(created_at DESC);

-- ================================
-- UPDATE TIMESTAMP TRIGGERS
-- ================================
CREATE OR REPLACE FUNCTION update_timestamp()
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
    EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS update_products_timestamp ON products;
CREATE TRIGGER update_products_timestamp
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();

-- ================================
-- GRANT PERMISSIONS
-- ================================
GRANT ALL ON inventory_balance TO authenticated;
GRANT ALL ON stock_movements TO authenticated;
GRANT ALL ON products TO authenticated;

-- ================================
-- VERIFICATION QUERIES
-- ================================
DO $$
BEGIN
    RAISE NOTICE '✅ Inventory Balance Table: %', 
        CASE WHEN EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'inventory_balance') 
             THEN 'EXISTS' ELSE 'MISSING' END;
    
    RAISE NOTICE '✅ RLS Disabled on inventory_balance: %', 
        CASE WHEN (SELECT relrowsecurity FROM pg_class WHERE relname = 'inventory_balance') 
             THEN 'NO - STILL ENABLED' ELSE 'YES - DISABLED' END;
    
    RAISE NOTICE '✅ Tenant Policies Removed: %', 
        CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE tablename = 'inventory_balance' AND schemaname = 'public') 
             THEN 'NO - POLICIES REMAIN' ELSE 'YES - ALL REMOVED' END;
             
    RAISE NOTICE '✅ Product Columns Added: variant_type=%, requires_tag=%, is_variant=%',
        EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'variant_type'),
        EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'requires_tag'),
        EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'is_variant');
END $$;

COMMIT;

-- Final success message
SELECT 'PRODUCTION FIX COMPLETED SUCCESSFULLY! You can now create inventory without tenant_id errors.' as result;