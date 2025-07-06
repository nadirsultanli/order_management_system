-- =====================================================
-- FINAL TENANT REMOVAL - COMPREHENSIVE CLEANUP
-- =====================================================
-- This script implements PROMPT 1 exactly as specified
-- Run this in Supabase SQL Editor to completely eliminate tenant_id issues

-- =====================================================
-- STEP 1: COMPREHENSIVE DIAGNOSTIC
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '       TENANT_ID DIAGNOSTIC REPORT     ';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    
    -- Check all table columns for tenant_id
    RAISE NOTICE '📋 TENANT_ID COLUMNS FOUND:';
    PERFORM 1 FROM information_schema.columns 
    WHERE column_name = 'tenant_id' AND table_schema = 'public';
    
    IF FOUND THEN
        FOR rec IN 
            SELECT table_name, column_name 
            FROM information_schema.columns 
            WHERE column_name = 'tenant_id' AND table_schema = 'public'
            ORDER BY table_name
        LOOP
            RAISE NOTICE '  ❌ %.%', rec.table_name, rec.column_name;
        END LOOP;
    ELSE
        RAISE NOTICE '  ✅ No tenant_id columns found';
    END IF;
    
    -- Check all RLS policies
    RAISE NOTICE '';
    RAISE NOTICE '🔒 RLS POLICIES FOUND:';
    PERFORM 1 FROM pg_policies WHERE schemaname = 'public';
    
    IF FOUND THEN
        FOR rec IN 
            SELECT tablename, policyname 
            FROM pg_policies 
            WHERE schemaname = 'public'
            ORDER BY tablename, policyname
        LOOP
            RAISE NOTICE '  ❌ %.%', rec.tablename, rec.policyname;
        END LOOP;
    ELSE
        RAISE NOTICE '  ✅ No RLS policies found';
    END IF;
    
    -- Check functions that might reference tenant_id
    RAISE NOTICE '';
    RAISE NOTICE '⚙️  FUNCTIONS REFERENCING TENANT_ID:';
    PERFORM 1 FROM information_schema.routines 
    WHERE routine_definition ILIKE '%tenant_id%' AND routine_schema = 'public';
    
    IF FOUND THEN
        FOR rec IN 
            SELECT routine_name 
            FROM information_schema.routines 
            WHERE routine_definition ILIKE '%tenant_id%' AND routine_schema = 'public'
            ORDER BY routine_name
        LOOP
            RAISE NOTICE '  ❌ Function: %', rec.routine_name;
        END LOOP;
    ELSE
        RAISE NOTICE '  ✅ No functions with tenant_id found';
    END IF;
    
    -- Check indexes that reference tenant_id
    RAISE NOTICE '';
    RAISE NOTICE '📊 INDEXES REFERENCING TENANT_ID:';
    PERFORM 1 FROM pg_indexes 
    WHERE indexdef ILIKE '%tenant_id%' AND schemaname = 'public';
    
    IF FOUND THEN
        FOR rec IN 
            SELECT indexname, tablename 
            FROM pg_indexes 
            WHERE indexdef ILIKE '%tenant_id%' AND schemaname = 'public'
            ORDER BY tablename, indexname
        LOOP
            RAISE NOTICE '  ❌ Index: % on table %', rec.indexname, rec.tablename;
        END LOOP;
    ELSE
        RAISE NOTICE '  ✅ No indexes with tenant_id found';
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;

-- =====================================================
-- STEP 2: DROP ALL RLS POLICIES AND DISABLE RLS
-- =====================================================

BEGIN;

-- Drop ALL RLS policies on ALL tables
DO $$
DECLARE
    pol_record RECORD;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🔥 DROPPING ALL RLS POLICIES...';
    
    FOR pol_record IN 
        SELECT schemaname, tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'public'
    LOOP
        BEGIN
            EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', 
                          pol_record.policyname, pol_record.schemaname, pol_record.tablename);
            RAISE NOTICE '  ✅ Dropped policy % on %', pol_record.policyname, pol_record.tablename;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '  ⚠️  Failed to drop policy % on %: %', pol_record.policyname, pol_record.tablename, SQLERRM;
        END;
    END LOOP;
END $$;

-- Disable RLS on ALL tables
DO $$
DECLARE
    table_record RECORD;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🔓 DISABLING RLS ON ALL TABLES...';
    
    FOR table_record IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public'
    LOOP
        BEGIN
            EXECUTE format('ALTER TABLE IF EXISTS %I DISABLE ROW LEVEL SECURITY', table_record.tablename);
            RAISE NOTICE '  ✅ Disabled RLS on %', table_record.tablename;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '  ⚠️  Failed to disable RLS on %: %', table_record.tablename, SQLERRM;
        END;
    END LOOP;
END $$;

-- =====================================================
-- STEP 3: REMOVE TENANT_ID COLUMNS FROM ALL TABLES
-- =====================================================

DO $$
DECLARE
    tenant_col_record RECORD;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🗑️  REMOVING ALL TENANT_ID COLUMNS...';
    
    FOR tenant_col_record IN 
        SELECT table_name 
        FROM information_schema.columns 
        WHERE column_name = 'tenant_id' AND table_schema = 'public'
    LOOP
        BEGIN
            EXECUTE format('ALTER TABLE %I DROP COLUMN IF EXISTS tenant_id CASCADE', tenant_col_record.table_name);
            RAISE NOTICE '  ✅ Removed tenant_id from %', tenant_col_record.table_name;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '  ⚠️  Failed to remove tenant_id from %: %', tenant_col_record.table_name, SQLERRM;
        END;
    END LOOP;
END $$;

-- =====================================================
-- STEP 4: DROP FUNCTIONS THAT REFERENCE TENANT_ID
-- =====================================================

DO $$
DECLARE
    func_record RECORD;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '⚙️  DROPPING FUNCTIONS WITH TENANT_ID REFERENCES...';
    
    FOR func_record IN 
        SELECT routine_name 
        FROM information_schema.routines 
        WHERE routine_definition ILIKE '%tenant_id%' AND routine_schema = 'public'
    LOOP
        BEGIN
            EXECUTE format('DROP FUNCTION IF EXISTS %I CASCADE', func_record.routine_name);
            RAISE NOTICE '  ✅ Dropped function %', func_record.routine_name;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '  ⚠️  Failed to drop function %: %', func_record.routine_name, SQLERRM;
        END;
    END LOOP;
END $$;

-- =====================================================
-- STEP 5: DROP INDEXES THAT REFERENCE TENANT_ID
-- =====================================================

DO $$
DECLARE
    index_record RECORD;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '📊 DROPPING INDEXES WITH TENANT_ID REFERENCES...';
    
    FOR index_record IN 
        SELECT indexname 
        FROM pg_indexes 
        WHERE indexdef ILIKE '%tenant_id%' AND schemaname = 'public'
    LOOP
        BEGIN
            EXECUTE format('DROP INDEX IF EXISTS %I CASCADE', index_record.indexname);
            RAISE NOTICE '  ✅ Dropped index %', index_record.indexname;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '  ⚠️  Failed to drop index %: %', index_record.indexname, SQLERRM;
        END;
    END LOOP;
END $$;

-- =====================================================
-- STEP 6: ENSURE INVENTORY_BALANCE TABLE EXISTS WITH CORRECT STRUCTURE
-- =====================================================

-- Handle inventory table naming
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🏗️  SETTING UP INVENTORY_BALANCE TABLE...';
    
    -- If inventory table exists but inventory_balance doesn't, rename it
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inventory' AND table_schema = 'public')
       AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inventory_balance' AND table_schema = 'public') THEN
        ALTER TABLE inventory RENAME TO inventory_balance;
        RAISE NOTICE '  ✅ Renamed inventory table to inventory_balance';
    END IF;
    
    -- Create inventory_balance table if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inventory_balance' AND table_schema = 'public') THEN
        CREATE TABLE inventory_balance (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            warehouse_id UUID NOT NULL,
            product_id UUID NOT NULL,
            qty_full NUMERIC NOT NULL DEFAULT 0 CHECK (qty_full >= 0),
            qty_empty NUMERIC NOT NULL DEFAULT 0 CHECK (qty_empty >= 0),
            qty_reserved NUMERIC NOT NULL DEFAULT 0 CHECK (qty_reserved >= 0 AND qty_reserved <= qty_full),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT unique_warehouse_product UNIQUE (warehouse_id, product_id)
        );
        RAISE NOTICE '  ✅ Created inventory_balance table';
    ELSE
        RAISE NOTICE '  ✅ inventory_balance table already exists';
    END IF;
END $$;

-- Ensure truck_inventory table exists
CREATE TABLE IF NOT EXISTS truck_inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    truck_id UUID NOT NULL,
    product_id UUID NOT NULL,
    qty_full NUMERIC NOT NULL DEFAULT 0 CHECK (qty_full >= 0),
    qty_empty NUMERIC NOT NULL DEFAULT 0 CHECK (qty_empty >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add unique constraint if it doesn't exist
DO $$
BEGIN
    BEGIN
        ALTER TABLE truck_inventory ADD CONSTRAINT truck_inventory_truck_product_unique UNIQUE (truck_id, product_id);
        RAISE NOTICE '  ✅ Added unique constraint to truck_inventory';
    EXCEPTION WHEN duplicate_table THEN
        RAISE NOTICE '  ✅ Unique constraint already exists on truck_inventory';
    END;
END $$;

-- Ensure truck table exists
CREATE TABLE IF NOT EXISTS truck (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fleet_number TEXT NOT NULL,
    license_plate TEXT NOT NULL,
    capacity_cylinders INTEGER NOT NULL DEFAULT 60 CHECK (capacity_cylinders > 0),
    driver_name TEXT,
    active BOOLEAN NOT NULL DEFAULT true,
    last_maintenance_date DATE,
    next_maintenance_due DATE,
    fuel_capacity_liters NUMERIC,
    avg_fuel_consumption NUMERIC,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    user_id UUID
);

-- Add unique constraints if they don't exist
DO $$
BEGIN
    BEGIN
        ALTER TABLE truck ADD CONSTRAINT truck_fleet_number_unique UNIQUE (fleet_number);
        RAISE NOTICE '  ✅ Added fleet_number unique constraint to truck';
    EXCEPTION WHEN duplicate_table THEN
        RAISE NOTICE '  ✅ Fleet_number unique constraint already exists on truck';
    END;
    
    BEGIN
        ALTER TABLE truck ADD CONSTRAINT truck_license_plate_unique UNIQUE (license_plate);
        RAISE NOTICE '  ✅ Added license_plate unique constraint to truck';
    EXCEPTION WHEN duplicate_table THEN
        RAISE NOTICE '  ✅ License_plate unique constraint already exists on truck';
    END;
END $$;

-- =====================================================
-- STEP 7: GRANT ALL PERMISSIONS TO AUTHENTICATED USERS
-- =====================================================

RAISE NOTICE '';
RAISE NOTICE '🔐 GRANTING PERMISSIONS...';

-- Grant all permissions to authenticated users
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Grant basic permissions to anon
GRANT SELECT ON products TO anon;
GRANT SELECT ON warehouses TO anon;
GRANT SELECT ON truck TO anon;

RAISE NOTICE '  ✅ Granted all permissions to authenticated users';
RAISE NOTICE '  ✅ Granted basic permissions to anon users';

COMMIT;

-- =====================================================
-- STEP 8: FINAL VERIFICATION
-- =====================================================

DO $$
DECLARE
    tenant_count INTEGER;
    policy_count INTEGER;
    func_count INTEGER;
    index_count INTEGER;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '       FINAL VERIFICATION REPORT       ';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    
    -- Check tenant_id columns
    SELECT COUNT(*) INTO tenant_count 
    FROM information_schema.columns 
    WHERE column_name = 'tenant_id' AND table_schema = 'public';
    
    RAISE NOTICE '📋 TENANT_ID CLEANUP VERIFICATION:';
    RAISE NOTICE '  tenant_id columns remaining: %', tenant_count;
    
    IF tenant_count = 0 THEN
        RAISE NOTICE '  ✅ SUCCESS: No tenant_id columns found';
    ELSE
        RAISE NOTICE '  ❌ FAILED: % tenant_id columns still exist', tenant_count;
    END IF;
    
    -- Check RLS policies
    SELECT COUNT(*) INTO policy_count 
    FROM pg_policies 
    WHERE schemaname = 'public';
    
    RAISE NOTICE '';
    RAISE NOTICE '🔒 RLS POLICY VERIFICATION:';
    RAISE NOTICE '  RLS policies remaining: %', policy_count;
    
    IF policy_count = 0 THEN
        RAISE NOTICE '  ✅ SUCCESS: No RLS policies found';
    ELSE
        RAISE NOTICE '  ❌ FAILED: % RLS policies still exist', policy_count;
    END IF;
    
    -- Check functions
    SELECT COUNT(*) INTO func_count 
    FROM information_schema.routines 
    WHERE routine_definition ILIKE '%tenant_id%' AND routine_schema = 'public';
    
    RAISE NOTICE '';
    RAISE NOTICE '⚙️  FUNCTION VERIFICATION:';
    RAISE NOTICE '  Functions with tenant_id: %', func_count;
    
    IF func_count = 0 THEN
        RAISE NOTICE '  ✅ SUCCESS: No functions with tenant_id found';
    ELSE
        RAISE NOTICE '  ❌ WARNING: % functions still reference tenant_id', func_count;
    END IF;
    
    -- Check indexes
    SELECT COUNT(*) INTO index_count 
    FROM pg_indexes 
    WHERE indexdef ILIKE '%tenant_id%' AND schemaname = 'public';
    
    RAISE NOTICE '';
    RAISE NOTICE '📊 INDEX VERIFICATION:';
    RAISE NOTICE '  Indexes with tenant_id: %', index_count;
    
    IF index_count = 0 THEN
        RAISE NOTICE '  ✅ SUCCESS: No indexes with tenant_id found';
    ELSE
        RAISE NOTICE '  ❌ WARNING: % indexes still reference tenant_id', index_count;
    END IF;
    
    -- Check table structures
    RAISE NOTICE '';
    RAISE NOTICE '🏗️  TABLE STRUCTURE VERIFICATION:';
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inventory_balance' AND table_schema = 'public') THEN
        RAISE NOTICE '  ✅ inventory_balance table exists';
    ELSE
        RAISE NOTICE '  ❌ inventory_balance table MISSING';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'truck_inventory' AND table_schema = 'public') THEN
        RAISE NOTICE '  ✅ truck_inventory table exists';
    ELSE
        RAISE NOTICE '  ❌ truck_inventory table MISSING';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'truck' AND table_schema = 'public') THEN
        RAISE NOTICE '  ✅ truck table exists';
    ELSE
        RAISE NOTICE '  ❌ truck table MISSING';
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    
    IF tenant_count = 0 AND policy_count = 0 THEN
        RAISE NOTICE '🎉 TENANT REMOVAL COMPLETED SUCCESSFULLY! 🎉';
        RAISE NOTICE '';
        RAISE NOTICE 'You can now:';
        RAISE NOTICE '✅ Create inventory without tenant_id errors';
        RAISE NOTICE '✅ Create trucks without RLS violations';
        RAISE NOTICE '✅ Perform all operations without tenant restrictions';
    ELSE
        RAISE NOTICE '⚠️  TENANT REMOVAL PARTIALLY COMPLETED';
        RAISE NOTICE 'Please review the diagnostic information above';
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;