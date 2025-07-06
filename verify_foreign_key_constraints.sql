-- Verify Foreign Key Constraints Status
-- This script checks the current state of foreign key constraints
-- for inventory_balance and truck_inventory tables

-- =============================================================================
-- STEP 1: CHECK TABLE EXISTENCE
-- =============================================================================

SELECT 
    'Table existence check:' as check_type,
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'warehouses' AND table_schema = 'public')::text as warehouses_exists,
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'products' AND table_schema = 'public')::text as products_exists,
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'inventory_balance' AND table_schema = 'public')::text as inventory_balance_exists,
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'truck_inventory' AND table_schema = 'public')::text as truck_inventory_exists,
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'truck' AND table_schema = 'public')::text as truck_exists,
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'trucks' AND table_schema = 'public')::text as trucks_exists;

-- =============================================================================
-- STEP 2: CHECK CURRENT FOREIGN KEY CONSTRAINTS
-- =============================================================================

-- All foreign key constraints in the database
SELECT 
    'Current foreign key constraints:' as info,
    tc.table_name,
    tc.constraint_name,
    kcu.column_name,
    ccu.table_name AS references_table,
    ccu.column_name AS references_column,
    rc.delete_rule,
    rc.update_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
JOIN information_schema.referential_constraints AS rc
    ON tc.constraint_name = rc.constraint_name
    AND tc.table_schema = rc.constraint_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name IN ('inventory_balance', 'truck_inventory')
    AND tc.table_schema = 'public'
ORDER BY tc.table_name, tc.constraint_name;

-- =============================================================================
-- STEP 3: CHECK SPECIFIC CONSTRAINTS WE NEED
-- =============================================================================

-- Check if inventory_balance has proper foreign key constraints
SELECT 
    'inventory_balance foreign key status:' as check_type,
    EXISTS(
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'inventory_balance' 
        AND constraint_name LIKE '%warehouse%'
        AND constraint_type = 'FOREIGN KEY'
    )::text as has_warehouse_fk,
    EXISTS(
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'inventory_balance' 
        AND constraint_name LIKE '%product%'
        AND constraint_type = 'FOREIGN KEY'
    )::text as has_product_fk;

-- Check if truck_inventory has proper foreign key constraints
SELECT 
    'truck_inventory foreign key status:' as check_type,
    EXISTS(
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'truck_inventory' 
        AND constraint_name LIKE '%truck%'
        AND constraint_type = 'FOREIGN KEY'
    )::text as has_truck_fk,
    EXISTS(
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'truck_inventory' 
        AND constraint_name LIKE '%product%'
        AND constraint_type = 'FOREIGN KEY'
    )::text as has_product_fk;

-- =============================================================================
-- STEP 4: CHECK FOR ORPHANED RECORDS (DATA INTEGRITY ISSUES)
-- =============================================================================

-- Check for orphaned records in inventory_balance (only if tables exist)
DO $$
BEGIN
    -- Check if required tables exist
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inventory_balance' AND table_schema = 'public')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'warehouses' AND table_schema = 'public')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products' AND table_schema = 'public') THEN
        
        -- Check for orphaned warehouse references
        PERFORM 1 FROM inventory_balance ib
        LEFT JOIN warehouses w ON ib.warehouse_id = w.id
        WHERE w.id IS NULL;
        
        IF FOUND THEN
            RAISE NOTICE 'WARNING: inventory_balance has orphaned warehouse references';
        ELSE
            RAISE NOTICE 'OK: inventory_balance has no orphaned warehouse references';
        END IF;
        
        -- Check for orphaned product references
        PERFORM 1 FROM inventory_balance ib
        LEFT JOIN products p ON ib.product_id = p.id
        WHERE p.id IS NULL;
        
        IF FOUND THEN
            RAISE NOTICE 'WARNING: inventory_balance has orphaned product references';
        ELSE
            RAISE NOTICE 'OK: inventory_balance has no orphaned product references';
        END IF;
    END IF;
END $$;

-- Check for orphaned records in truck_inventory (only if tables exist)
DO $$
DECLARE
    truck_table_name TEXT;
    orphaned_count INTEGER;
BEGIN
    -- Check if required tables exist
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'truck_inventory' AND table_schema = 'public')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products' AND table_schema = 'public') THEN
        
        -- Determine truck table name
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'truck' AND table_schema = 'public') THEN
            truck_table_name := 'truck';
        ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'trucks' AND table_schema = 'public') THEN
            truck_table_name := 'trucks';
        ELSE
            RAISE NOTICE 'WARNING: Neither truck nor trucks table exists';
            RETURN;
        END IF;
        
        -- Check for orphaned truck references
        EXECUTE format('SELECT COUNT(*) FROM truck_inventory ti
                       LEFT JOIN %I t ON ti.truck_id = t.id
                       WHERE t.id IS NULL', truck_table_name) INTO orphaned_count;
        
        IF orphaned_count > 0 THEN
            RAISE NOTICE 'WARNING: truck_inventory has % orphaned truck references', orphaned_count;
        ELSE
            RAISE NOTICE 'OK: truck_inventory has no orphaned truck references';
        END IF;
        
        -- Check for orphaned product references
        PERFORM 1 FROM truck_inventory ti
        LEFT JOIN products p ON ti.product_id = p.id
        WHERE p.id IS NULL;
        
        IF FOUND THEN
            RAISE NOTICE 'WARNING: truck_inventory has orphaned product references';
        ELSE
            RAISE NOTICE 'OK: truck_inventory has no orphaned product references';
        END IF;
    END IF;
END $$;

-- =============================================================================
-- STEP 5: CHECK COLUMN DEFINITIONS
-- =============================================================================

-- Check inventory_balance column structure
SELECT 
    'inventory_balance columns:' as table_info,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'inventory_balance' 
    AND table_schema = 'public'
    AND column_name IN ('id', 'warehouse_id', 'product_id', 'qty_full', 'qty_empty', 'qty_reserved')
ORDER BY ordinal_position;

-- Check truck_inventory column structure
SELECT 
    'truck_inventory columns:' as table_info,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'truck_inventory' 
    AND table_schema = 'public'
    AND column_name IN ('id', 'truck_id', 'product_id', 'qty_full', 'qty_empty')
ORDER BY ordinal_position;

-- =============================================================================
-- STEP 6: CHECK INDEXES ON FOREIGN KEY COLUMNS
-- =============================================================================

-- Check indexes on inventory_balance foreign key columns
SELECT 
    'inventory_balance indexes:' as info,
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'inventory_balance' 
    AND schemaname = 'public'
    AND (indexdef LIKE '%warehouse_id%' OR indexdef LIKE '%product_id%')
ORDER BY indexname;

-- Check indexes on truck_inventory foreign key columns
SELECT 
    'truck_inventory indexes:' as info,
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'truck_inventory' 
    AND schemaname = 'public'
    AND (indexdef LIKE '%truck_id%' OR indexdef LIKE '%product_id%')
ORDER BY indexname;

-- =============================================================================
-- STEP 7: SUMMARY CHECK
-- =============================================================================

-- Final summary of foreign key constraint status
SELECT 
    'Foreign Key Constraints Summary:' as summary,
    (SELECT COUNT(*) FROM information_schema.table_constraints 
     WHERE table_name = 'inventory_balance' 
     AND constraint_type = 'FOREIGN KEY')::text as inventory_balance_fk_count,
    (SELECT COUNT(*) FROM information_schema.table_constraints 
     WHERE table_name = 'truck_inventory' 
     AND constraint_type = 'FOREIGN KEY')::text as truck_inventory_fk_count,
    CASE 
        WHEN (SELECT COUNT(*) FROM information_schema.table_constraints 
              WHERE table_name = 'inventory_balance' 
              AND constraint_type = 'FOREIGN KEY') >= 2 
        AND (SELECT COUNT(*) FROM information_schema.table_constraints 
             WHERE table_name = 'truck_inventory' 
             AND constraint_type = 'FOREIGN KEY') >= 2 
        THEN 'READY - All required foreign key constraints appear to be in place'
        ELSE 'MISSING - Some foreign key constraints are missing'
    END as status;

-- =============================================================================
-- STEP 8: RECOMMENDATIONS
-- =============================================================================

-- Provide recommendations based on current state
DO $$
DECLARE
    inventory_fk_count INTEGER;
    truck_fk_count INTEGER;
BEGIN
    -- Count current foreign key constraints
    SELECT COUNT(*) INTO inventory_fk_count
    FROM information_schema.table_constraints 
    WHERE table_name = 'inventory_balance' 
    AND constraint_type = 'FOREIGN KEY';
    
    SELECT COUNT(*) INTO truck_fk_count
    FROM information_schema.table_constraints 
    WHERE table_name = 'truck_inventory' 
    AND constraint_type = 'FOREIGN KEY';
    
    RAISE NOTICE '';
    RAISE NOTICE '=== RECOMMENDATIONS ===';
    
    IF inventory_fk_count < 2 THEN
        RAISE NOTICE 'RECOMMENDATION: inventory_balance table needs foreign key constraints for warehouse_id and product_id';
    END IF;
    
    IF truck_fk_count < 2 THEN
        RAISE NOTICE 'RECOMMENDATION: truck_inventory table needs foreign key constraints for truck_id and product_id';
    END IF;
    
    IF inventory_fk_count >= 2 AND truck_fk_count >= 2 THEN
        RAISE NOTICE 'GOOD: All required foreign key constraints are in place';
    ELSE
        RAISE NOTICE 'ACTION: Run the add_foreign_key_constraints.sql script to add missing constraints';
    END IF;
END $$;