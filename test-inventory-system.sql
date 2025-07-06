-- Test script to verify inventory system is working correctly
-- Run this after applying all migrations to ensure tenant_id issues are resolved

BEGIN;

-- Test 1: Check that inventory_balance table exists and has correct structure
SELECT 
    'TEST 1: Table structure verification' as test_name,
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'inventory_balance')::text as inventory_balance_exists,
    NOT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'inventory' AND table_schema = 'public')::text as old_inventory_table_removed;

-- Test 2: Check that no tenant_id columns remain in core tables
SELECT 
    'TEST 2: Tenant ID cleanup verification' as test_name,
    COUNT(*)::text as remaining_tenant_id_columns,
    string_agg(table_name || '.' || column_name, ', ') as tables_with_tenant_id
FROM information_schema.columns 
WHERE column_name = 'tenant_id' 
    AND table_schema = 'public';

-- Test 3: Check that RLS policies are disabled
SELECT 
    'TEST 3: RLS policies verification' as test_name,
    COUNT(*)::text as total_rls_policies,
    string_agg(tablename || '.' || policyname, ', ') as policies_found
FROM pg_policies 
WHERE schemaname = 'public';

-- Test 4: Check that products table has inventory threshold columns
SELECT 
    'TEST 4: Product thresholds verification' as test_name,
    COUNT(*)::text as total_products,
    COUNT(CASE WHEN reorder_level IS NOT NULL THEN 1 END)::text as products_with_reorder_level,
    COUNT(CASE WHEN max_stock_level IS NOT NULL THEN 1 END)::text as products_with_max_stock_level
FROM products;

-- Test 5: Try to create an inventory balance record (this should work without tenant_id errors)
DO $$
DECLARE
    test_warehouse_id uuid;
    test_product_id uuid;
    test_inventory_id uuid;
BEGIN
    -- Get or create a test warehouse
    SELECT id INTO test_warehouse_id FROM warehouses LIMIT 1;
    
    IF test_warehouse_id IS NULL THEN
        INSERT INTO warehouses (name, location, is_active) 
        VALUES ('Test Warehouse', 'Test Location', true) 
        RETURNING id INTO test_warehouse_id;
    END IF;
    
    -- Get or create a test product
    SELECT id INTO test_product_id FROM products WHERE status = 'active' LIMIT 1;
    
    IF test_product_id IS NULL THEN
        INSERT INTO products (name, sku, unit_of_measure, status, capacity_kg, variant_type) 
        VALUES ('Test Product', 'TEST-001', 'piece', 'active', 20, 'refillable') 
        RETURNING id INTO test_product_id;
    END IF;
    
    -- Try to create inventory balance record
    INSERT INTO inventory_balance (warehouse_id, product_id, qty_full, qty_empty, qty_reserved)
    VALUES (test_warehouse_id, test_product_id, 10, 5, 0)
    ON CONFLICT (warehouse_id, product_id) 
    DO UPDATE SET qty_full = 10, qty_empty = 5, qty_reserved = 0
    RETURNING id INTO test_inventory_id;
    
    RAISE NOTICE 'TEST 5: Inventory creation test - SUCCESS. Created inventory record with ID: %', test_inventory_id;
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'TEST 5: Inventory creation test - FAILED. Error: %', SQLERRM;
END $$;

-- Test 6: Test inventory queries (simulate what the API would do)
SELECT 
    'TEST 6: Inventory query verification' as test_name,
    COUNT(*)::text as total_inventory_records,
    SUM(qty_full)::text as total_full_stock,
    SUM(qty_empty)::text as total_empty_stock,
    SUM(qty_reserved)::text as total_reserved_stock
FROM inventory_balance;

-- Test 7: Test product inventory thresholds query
SELECT 
    'TEST 7: Product thresholds query' as test_name,
    p.name as product_name,
    p.reorder_level,
    p.max_stock_level,
    p.seasonal_demand_factor,
    p.lead_time_days,
    COALESCE(SUM(ib.qty_full), 0) as total_stock
FROM products p
LEFT JOIN inventory_balance ib ON p.id = ib.product_id
WHERE p.status = 'active'
GROUP BY p.id, p.name, p.reorder_level, p.max_stock_level, p.seasonal_demand_factor, p.lead_time_days
LIMIT 3;

-- Test 8: Check that essential indexes exist
SELECT 
    'TEST 8: Index verification' as test_name,
    EXISTS(SELECT 1 FROM pg_indexes WHERE indexname = 'idx_inventory_balance_warehouse_product')::text as warehouse_product_index,
    EXISTS(SELECT 1 FROM pg_indexes WHERE indexname = 'idx_inventory_balance_low_stock')::text as low_stock_index,
    EXISTS(SELECT 1 FROM pg_indexes WHERE indexname = 'idx_products_reorder_level')::text as reorder_level_index;

-- Test 9: Test stock movement table
SELECT 
    'TEST 9: Stock movements table' as test_name,
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'stock_movements')::text as stock_movements_exists,
    COUNT(*)::text as total_stock_movements
FROM stock_movements;

-- Test 10: Test permissions
SELECT 
    'TEST 10: Table permissions' as test_name,
    has_table_privilege('authenticated', 'inventory_balance', 'SELECT')::text as can_select_inventory,
    has_table_privilege('authenticated', 'inventory_balance', 'INSERT')::text as can_insert_inventory,
    has_table_privilege('authenticated', 'products', 'SELECT')::text as can_select_products,
    has_table_privilege('authenticated', 'warehouses', 'SELECT')::text as can_select_warehouses;

ROLLBACK; -- Don't commit the test data

-- Summary report
SELECT 
    'SUMMARY: Inventory System Health Check' as summary,
    'All tests completed. Review the results above.' as status,
    'If any tests show failures, the corresponding issues need to be addressed.' as next_steps;