-- Add Foreign Key Constraints to Inventory and Truck Tables
-- This script ensures proper foreign key relationships are established
-- after verifying that the referenced tables exist

BEGIN;

-- =============================================================================
-- STEP 1: VERIFY EXISTENCE OF REFERENCED TABLES
-- =============================================================================

-- Check if required tables exist
DO $$
BEGIN
    -- Verify warehouses table exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables 
                  WHERE table_name = 'warehouses' AND table_schema = 'public') THEN
        RAISE EXCEPTION 'Required table "warehouses" does not exist. Please create it first.';
    END IF;

    -- Verify products table exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables 
                  WHERE table_name = 'products' AND table_schema = 'public') THEN
        RAISE EXCEPTION 'Required table "products" does not exist. Please create it first.';
    END IF;

    -- Verify truck table exists (checking for both 'truck' and 'trucks' table names)
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables 
                  WHERE table_name IN ('truck', 'trucks') AND table_schema = 'public') THEN
        RAISE EXCEPTION 'Required table "truck" or "trucks" does not exist. Please create it first.';
    END IF;

    -- Verify inventory_balance table exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables 
                  WHERE table_name = 'inventory_balance' AND table_schema = 'public') THEN
        RAISE EXCEPTION 'Required table "inventory_balance" does not exist. Please create it first.';
    END IF;

    -- Verify truck_inventory table exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables 
                  WHERE table_name = 'truck_inventory' AND table_schema = 'public') THEN
        RAISE EXCEPTION 'Required table "truck_inventory" does not exist. Please create it first.';
    END IF;

    RAISE NOTICE 'All required tables exist. Proceeding with foreign key constraint creation.';
END $$;

-- =============================================================================
-- STEP 2: CHECK CURRENT FOREIGN KEY CONSTRAINTS
-- =============================================================================

-- Display current foreign key constraints for inventory_balance
SELECT 
    'Current inventory_balance foreign keys:' as info,
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name = 'inventory_balance'
    AND tc.table_schema = 'public';

-- Display current foreign key constraints for truck_inventory
SELECT 
    'Current truck_inventory foreign keys:' as info,
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name = 'truck_inventory'
    AND tc.table_schema = 'public';

-- =============================================================================
-- STEP 3: ADD FOREIGN KEY CONSTRAINTS TO INVENTORY_BALANCE TABLE
-- =============================================================================

-- Add foreign key constraint for warehouse_id in inventory_balance
DO $$
BEGIN
    -- Check if constraint already exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'inventory_balance' 
        AND constraint_name = 'fk_inventory_balance_warehouse_id'
        AND constraint_type = 'FOREIGN KEY'
    ) THEN
        -- Add the constraint
        ALTER TABLE inventory_balance 
        ADD CONSTRAINT fk_inventory_balance_warehouse_id 
        FOREIGN KEY (warehouse_id) 
        REFERENCES warehouses(id) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE;
        
        RAISE NOTICE 'Added foreign key constraint: fk_inventory_balance_warehouse_id';
    ELSE
        RAISE NOTICE 'Foreign key constraint fk_inventory_balance_warehouse_id already exists';
    END IF;
END $$;

-- Add foreign key constraint for product_id in inventory_balance
DO $$
BEGIN
    -- Check if constraint already exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'inventory_balance' 
        AND constraint_name = 'fk_inventory_balance_product_id'
        AND constraint_type = 'FOREIGN KEY'
    ) THEN
        -- Add the constraint
        ALTER TABLE inventory_balance 
        ADD CONSTRAINT fk_inventory_balance_product_id 
        FOREIGN KEY (product_id) 
        REFERENCES products(id) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE;
        
        RAISE NOTICE 'Added foreign key constraint: fk_inventory_balance_product_id';
    ELSE
        RAISE NOTICE 'Foreign key constraint fk_inventory_balance_product_id already exists';
    END IF;
END $$;

-- =============================================================================
-- STEP 4: ADD FOREIGN KEY CONSTRAINTS TO TRUCK_INVENTORY TABLE
-- =============================================================================

-- Determine the correct truck table name and add foreign key constraint
DO $$
DECLARE
    truck_table_name TEXT;
BEGIN
    -- Check which truck table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables 
               WHERE table_name = 'truck' AND table_schema = 'public') THEN
        truck_table_name := 'truck';
    ELSIF EXISTS (SELECT 1 FROM information_schema.tables 
                  WHERE table_name = 'trucks' AND table_schema = 'public') THEN
        truck_table_name := 'trucks';
    ELSE
        RAISE EXCEPTION 'Neither "truck" nor "trucks" table exists';
    END IF;

    -- Add foreign key constraint for truck_id in truck_inventory
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'truck_inventory' 
        AND constraint_name = 'fk_truck_inventory_truck_id'
        AND constraint_type = 'FOREIGN KEY'
    ) THEN
        -- Add the constraint
        EXECUTE format('ALTER TABLE truck_inventory 
                       ADD CONSTRAINT fk_truck_inventory_truck_id 
                       FOREIGN KEY (truck_id) 
                       REFERENCES %I(id) 
                       ON DELETE CASCADE 
                       ON UPDATE CASCADE', truck_table_name);
        
        RAISE NOTICE 'Added foreign key constraint: fk_truck_inventory_truck_id referencing %', truck_table_name;
    ELSE
        RAISE NOTICE 'Foreign key constraint fk_truck_inventory_truck_id already exists';
    END IF;
END $$;

-- Add foreign key constraint for product_id in truck_inventory
DO $$
BEGIN
    -- Check if constraint already exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'truck_inventory' 
        AND constraint_name = 'fk_truck_inventory_product_id'
        AND constraint_type = 'FOREIGN KEY'
    ) THEN
        -- Add the constraint
        ALTER TABLE truck_inventory 
        ADD CONSTRAINT fk_truck_inventory_product_id 
        FOREIGN KEY (product_id) 
        REFERENCES products(id) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE;
        
        RAISE NOTICE 'Added foreign key constraint: fk_truck_inventory_product_id';
    ELSE
        RAISE NOTICE 'Foreign key constraint fk_truck_inventory_product_id already exists';
    END IF;
END $$;

-- =============================================================================
-- STEP 5: ADD SUPPORTING INDEXES FOR FOREIGN KEY PERFORMANCE
-- =============================================================================

-- Create indexes on foreign key columns for better performance
-- These indexes help with JOIN operations and foreign key constraint enforcement

-- Indexes for inventory_balance table
CREATE INDEX IF NOT EXISTS idx_inventory_balance_warehouse_id_fk 
    ON inventory_balance(warehouse_id);

CREATE INDEX IF NOT EXISTS idx_inventory_balance_product_id_fk 
    ON inventory_balance(product_id);

-- Indexes for truck_inventory table
CREATE INDEX IF NOT EXISTS idx_truck_inventory_truck_id_fk 
    ON truck_inventory(truck_id);

CREATE INDEX IF NOT EXISTS idx_truck_inventory_product_id_fk 
    ON truck_inventory(product_id);

-- =============================================================================
-- STEP 6: VERIFY DATA INTEGRITY
-- =============================================================================

-- Check for any orphaned records in inventory_balance
SELECT 
    'Orphaned records check - inventory_balance:' as check_type,
    COUNT(*) as orphaned_warehouse_refs
FROM inventory_balance ib
LEFT JOIN warehouses w ON ib.warehouse_id = w.id
WHERE w.id IS NULL;

SELECT 
    'Orphaned records check - inventory_balance:' as check_type,
    COUNT(*) as orphaned_product_refs
FROM inventory_balance ib
LEFT JOIN products p ON ib.product_id = p.id
WHERE p.id IS NULL;

-- Check for any orphaned records in truck_inventory
DO $$
DECLARE
    truck_table_name TEXT;
    orphaned_count INTEGER;
BEGIN
    -- Determine truck table name
    IF EXISTS (SELECT 1 FROM information_schema.tables 
               WHERE table_name = 'truck' AND table_schema = 'public') THEN
        truck_table_name := 'truck';
    ELSE
        truck_table_name := 'trucks';
    END IF;

    -- Check for orphaned truck references
    EXECUTE format('SELECT COUNT(*) FROM truck_inventory ti
                   LEFT JOIN %I t ON ti.truck_id = t.id
                   WHERE t.id IS NULL', truck_table_name) INTO orphaned_count;
    
    RAISE NOTICE 'Orphaned truck references in truck_inventory: %', orphaned_count;
END $$;

SELECT 
    'Orphaned records check - truck_inventory:' as check_type,
    COUNT(*) as orphaned_product_refs
FROM truck_inventory ti
LEFT JOIN products p ON ti.product_id = p.id
WHERE p.id IS NULL;

-- =============================================================================
-- STEP 7: FINAL VERIFICATION - LIST ALL FOREIGN KEY CONSTRAINTS
-- =============================================================================

-- Display all foreign key constraints that were added
SELECT 
    'Final verification - All foreign key constraints:' as info,
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
-- STEP 8: CREATE HELPFUL VIEWS FOR INVENTORY MANAGEMENT
-- =============================================================================

-- Create a view that shows inventory with warehouse and product details
CREATE OR REPLACE VIEW inventory_summary AS
SELECT 
    ib.id,
    w.name as warehouse_name,
    w.code as warehouse_code,
    p.name as product_name,
    p.sku as product_sku,
    p.variant_type,
    p.capacity_kg,
    ib.qty_full,
    ib.qty_empty,
    ib.qty_reserved,
    (ib.qty_full - ib.qty_reserved) as available_qty,
    ib.updated_at,
    ib.created_at
FROM inventory_balance ib
JOIN warehouses w ON ib.warehouse_id = w.id
JOIN products p ON ib.product_id = p.id;

-- Create a view that shows truck inventory with truck and product details
CREATE OR REPLACE VIEW truck_inventory_summary AS
SELECT 
    ti.id,
    t.fleet_number,
    t.license_plate,
    t.driver_name,
    p.name as product_name,
    p.sku as product_sku,
    p.variant_type,
    p.capacity_kg,
    ti.qty_full,
    ti.qty_empty,
    ti.updated_at
FROM truck_inventory ti
JOIN (
    SELECT id, fleet_number, license_plate, driver_name
    FROM truck
    WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'truck')
    UNION ALL
    SELECT id, fleet_number, license_plate, driver_name
    FROM trucks
    WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'trucks')
) t ON ti.truck_id = t.id
JOIN products p ON ti.product_id = p.id;

-- Grant permissions on views
GRANT SELECT ON inventory_summary TO authenticated;
GRANT SELECT ON truck_inventory_summary TO authenticated;

-- Add helpful comments
COMMENT ON VIEW inventory_summary IS 'Comprehensive view of inventory with warehouse and product details';
COMMENT ON VIEW truck_inventory_summary IS 'Comprehensive view of truck inventory with truck and product details';

COMMIT;

-- =============================================================================
-- SUCCESS MESSAGE
-- =============================================================================

SELECT 
    'Foreign key constraints setup completed successfully!' as status,
    'All required foreign key relationships have been established.' as message,
    'Data integrity is now enforced between inventory_balance/truck_inventory and their referenced tables.' as details;