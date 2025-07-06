-- =============================================================================
-- COMPREHENSIVE TRANSFER SYSTEM END-TO-END TEST
-- =============================================================================
-- This script tests the complete transfer flow to identify what's not working
-- Run this to verify that transfers actually update inventory correctly

BEGIN;

-- =============================================================================
-- SETUP: CREATE COMPREHENSIVE TEST DATA
-- =============================================================================
DO $$
DECLARE
    test_warehouse_1 UUID;
    test_warehouse_2 UUID;
    test_truck UUID;
    test_product_1 UUID;
    test_product_2 UUID;
    transfer_id UUID;
    before_w1_full INTEGER;
    before_w1_empty INTEGER;
    before_w2_full INTEGER;
    before_w2_empty INTEGER;
    after_w1_full INTEGER;
    after_w1_empty INTEGER;
    after_w2_full INTEGER;
    after_w2_empty INTEGER;
    before_truck_full INTEGER;
    before_truck_empty INTEGER;
    after_truck_full INTEGER;
    after_truck_empty INTEGER;
    validation_result JSONB;
    transfer_result JSONB;
    test_results TEXT := '';
    start_time TIMESTAMP := NOW();
BEGIN
    test_results := test_results || '=== COMPREHENSIVE TRANSFER SYSTEM TEST ===' || E'\n';
    test_results := test_results || 'Started at: ' || start_time || E'\n' || E'\n';
    
    -- =============================================================================
    -- STEP 1: SETUP TEST ENTITIES
    -- =============================================================================
    test_results := test_results || 'STEP 1: Setting up test entities...' || E'\n';
    
    -- Get or create test warehouses
    SELECT id INTO test_warehouse_1 FROM warehouses ORDER BY created_at DESC LIMIT 1;
    SELECT id INTO test_warehouse_2 FROM warehouses ORDER BY created_at DESC LIMIT 1 OFFSET 1;
    
    IF test_warehouse_1 IS NULL THEN
        INSERT INTO warehouses (name, address, city, country, phone, email, capacity_kg)
        VALUES ('Test Warehouse 1', '123 Test St', 'Test City', 'Test Country', '123-456-7890', 'test1@test.com', 10000)
        RETURNING id INTO test_warehouse_1;
        test_results := test_results || 'Created test warehouse 1: ' || test_warehouse_1 || E'\n';
    ELSE
        test_results := test_results || 'Using existing warehouse 1: ' || test_warehouse_1 || E'\n';
    END IF;
    
    IF test_warehouse_2 IS NULL THEN
        INSERT INTO warehouses (name, address, city, country, phone, email, capacity_kg)
        VALUES ('Test Warehouse 2', '456 Test Ave', 'Test City', 'Test Country', '123-456-7891', 'test2@test.com', 10000)
        RETURNING id INTO test_warehouse_2;
        test_results := test_results || 'Created test warehouse 2: ' || test_warehouse_2 || E'\n';
    ELSE
        test_results := test_results || 'Using existing warehouse 2: ' || test_warehouse_2 || E'\n';
    END IF;
    
    -- Get or create test truck
    SELECT id INTO test_truck FROM truck WHERE active = true ORDER BY created_at DESC LIMIT 1;
    
    IF test_truck IS NULL THEN
        INSERT INTO truck (registration, capacity_kg, driver_name, driver_phone, active)
        VALUES ('TEST-001', 5000, 'Test Driver', '123-456-7892', true)
        RETURNING id INTO test_truck;
        test_results := test_results || 'Created test truck: ' || test_truck || E'\n';
    ELSE
        test_results := test_results || 'Using existing truck: ' || test_truck || E'\n';
    END IF;
    
    -- Get or create test products
    SELECT id INTO test_product_1 FROM products WHERE status = 'active' ORDER BY created_at DESC LIMIT 1;
    SELECT id INTO test_product_2 FROM products WHERE status = 'active' ORDER BY created_at DESC LIMIT 1 OFFSET 1;
    
    IF test_product_1 IS NULL THEN
        INSERT INTO products (sku, name, description, unit_of_measure, capacity_kg, tare_weight_kg, status)
        VALUES ('TEST-001', 'Test Product 1', 'Test product for transfer testing', 'kg', 45.0, 5.0, 'active')
        RETURNING id INTO test_product_1;
        test_results := test_results || 'Created test product 1: ' || test_product_1 || E'\n';
    ELSE
        test_results := test_results || 'Using existing product 1: ' || test_product_1 || E'\n';
    END IF;
    
    IF test_product_2 IS NULL THEN
        INSERT INTO products (sku, name, description, unit_of_measure, capacity_kg, tare_weight_kg, status)
        VALUES ('TEST-002', 'Test Product 2', 'Test product for transfer testing', 'kg', 20.0, 2.0, 'active')
        RETURNING id INTO test_product_2;
        test_results := test_results || 'Created test product 2: ' || test_product_2 || E'\n';
    ELSE
        test_results := test_results || 'Using existing product 2: ' || test_product_2 || E'\n';
    END IF;
    
    -- =============================================================================
    -- STEP 2: SETUP INITIAL INVENTORY
    -- =============================================================================
    test_results := test_results || E'\nSTEP 2: Setting up initial inventory...' || E'\n';
    
    -- Ensure inventory records exist with sufficient stock for testing
    INSERT INTO inventory_balance (warehouse_id, product_id, qty_full, qty_empty, qty_reserved)
    VALUES 
        (test_warehouse_1, test_product_1, 100, 50, 0),
        (test_warehouse_1, test_product_2, 75, 25, 0),
        (test_warehouse_2, test_product_1, 10, 5, 0),
        (test_warehouse_2, test_product_2, 15, 10, 0)
    ON CONFLICT (warehouse_id, product_id) 
    DO UPDATE SET 
        qty_full = GREATEST(inventory_balance.qty_full, EXCLUDED.qty_full),
        qty_empty = GREATEST(inventory_balance.qty_empty, EXCLUDED.qty_empty),
        updated_at = NOW();
    
    test_results := test_results || 'Initial inventory setup completed' || E'\n';
    
    -- Record initial state
    SELECT qty_full, qty_empty INTO before_w1_full, before_w1_empty
    FROM inventory_balance 
    WHERE warehouse_id = test_warehouse_1 AND product_id = test_product_1;
    
    SELECT qty_full, qty_empty INTO before_w2_full, before_w2_empty
    FROM inventory_balance 
    WHERE warehouse_id = test_warehouse_2 AND product_id = test_product_1;
    
    test_results := test_results || format('Initial stock - W1: full=%s, empty=%s | W2: full=%s, empty=%s', 
        before_w1_full, before_w1_empty, before_w2_full, before_w2_empty) || E'\n';
    
    -- =============================================================================
    -- STEP 3: TEST VALIDATION FUNCTION
    -- =============================================================================
    test_results := test_results || E'\nSTEP 3: Testing transfer validation...' || E'\n';
    
    SELECT validate_transfer_request(
        test_warehouse_1,
        test_warehouse_2,
        test_product_1,
        10, -- qty_full
        5   -- qty_empty
    ) INTO validation_result;
    
    test_results := test_results || 'Validation result: ' || validation_result::text || E'\n';
    
    IF (validation_result->>'is_valid')::boolean THEN
        test_results := test_results || '✅ Validation passed' || E'\n';
    ELSE
        test_results := test_results || '❌ Validation failed: ' || (validation_result->'errors')::text || E'\n';
    END IF;
    
    -- =============================================================================
    -- STEP 4: TEST WAREHOUSE-TO-WAREHOUSE TRANSFER
    -- =============================================================================
    test_results := test_results || E'\nSTEP 4: Testing warehouse-to-warehouse transfer...' || E'\n';
    test_results := test_results || 'Executing transfer_stock function...' || E'\n';
    
    SELECT transfer_stock(
        test_warehouse_1,
        test_warehouse_2,
        test_product_1,
        10, -- qty_full
        5   -- qty_empty
    ) INTO transfer_result;
    
    test_results := test_results || 'Transfer result: ' || transfer_result::text || E'\n';
    
    -- Check if transfer was successful
    IF (transfer_result->>'success')::boolean THEN
        test_results := test_results || '✅ Transfer function reported success' || E'\n';
        
        -- Check actual inventory changes
        SELECT qty_full, qty_empty INTO after_w1_full, after_w1_empty
        FROM inventory_balance 
        WHERE warehouse_id = test_warehouse_1 AND product_id = test_product_1;
        
        SELECT qty_full, qty_empty INTO after_w2_full, after_w2_empty
        FROM inventory_balance 
        WHERE warehouse_id = test_warehouse_2 AND product_id = test_product_1;
        
        test_results := test_results || format('After transfer - W1: full=%s, empty=%s | W2: full=%s, empty=%s', 
            after_w1_full, after_w1_empty, after_w2_full, after_w2_empty) || E'\n';
        
        -- Verify the changes are correct
        IF after_w1_full = before_w1_full - 10 AND 
           after_w1_empty = before_w1_empty - 5 AND
           after_w2_full = before_w2_full + 10 AND
           after_w2_empty = before_w2_empty + 5 THEN
            test_results := test_results || '✅ Inventory changes verified correctly' || E'\n';
        ELSE
            test_results := test_results || '❌ Inventory changes are INCORRECT!' || E'\n';
            test_results := test_results || format('Expected - W1: full=%s, empty=%s | W2: full=%s, empty=%s', 
                before_w1_full - 10, before_w1_empty - 5, before_w2_full + 10, before_w2_empty + 5) || E'\n';
        END IF;
    ELSE
        test_results := test_results || '❌ Transfer function reported failure' || E'\n';
    END IF;
    
    -- =============================================================================
    -- STEP 5: TEST WAREHOUSE-TO-TRUCK TRANSFER
    -- =============================================================================
    test_results := test_results || E'\nSTEP 5: Testing warehouse-to-truck transfer...' || E'\n';
    
    -- Record before state for truck transfer
    SELECT qty_full, qty_empty INTO before_w1_full, before_w1_empty
    FROM inventory_balance 
    WHERE warehouse_id = test_warehouse_1 AND product_id = test_product_2;
    
    SELECT COALESCE(qty_full, 0), COALESCE(qty_empty, 0) INTO before_truck_full, before_truck_empty
    FROM truck_inventory 
    WHERE truck_id = test_truck AND product_id = test_product_2;
    
    test_results := test_results || format('Before truck transfer - W1: full=%s, empty=%s | Truck: full=%s, empty=%s', 
        before_w1_full, before_w1_empty, before_truck_full, before_truck_empty) || E'\n';
    
    SELECT transfer_stock_to_truck(
        test_warehouse_1,
        test_truck,
        test_product_2,
        8,  -- qty_full
        3   -- qty_empty
    ) INTO transfer_result;
    
    test_results := test_results || 'Truck transfer result: ' || transfer_result::text || E'\n';
    
    IF (transfer_result->>'success')::boolean THEN
        test_results := test_results || '✅ Truck transfer function reported success' || E'\n';
        
        -- Check actual inventory changes
        SELECT qty_full, qty_empty INTO after_w1_full, after_w1_empty
        FROM inventory_balance 
        WHERE warehouse_id = test_warehouse_1 AND product_id = test_product_2;
        
        SELECT qty_full, qty_empty INTO after_truck_full, after_truck_empty
        FROM truck_inventory 
        WHERE truck_id = test_truck AND product_id = test_product_2;
        
        test_results := test_results || format('After truck transfer - W1: full=%s, empty=%s | Truck: full=%s, empty=%s', 
            after_w1_full, after_w1_empty, after_truck_full, after_truck_empty) || E'\n';
        
        -- Verify the changes are correct
        IF after_w1_full = before_w1_full - 8 AND 
           after_w1_empty = before_w1_empty - 3 AND
           after_truck_full = before_truck_full + 8 AND
           after_truck_empty = before_truck_empty + 3 THEN
            test_results := test_results || '✅ Truck transfer inventory changes verified correctly' || E'\n';
        ELSE
            test_results := test_results || '❌ Truck transfer inventory changes are INCORRECT!' || E'\n';
        END IF;
    ELSE
        test_results := test_results || '❌ Truck transfer function reported failure' || E'\n';
    END IF;
    
    -- =============================================================================
    -- STEP 6: CHECK AUDIT TRAIL
    -- =============================================================================
    test_results := test_results || E'\nSTEP 6: Checking audit trail...' || E'\n';
    
    -- Check stock movements created in the last minute
    DECLARE
        movements_count INTEGER;
        latest_movement RECORD;
    BEGIN
        SELECT COUNT(*) INTO movements_count 
        FROM stock_movements 
        WHERE created_at > NOW() - INTERVAL '1 minute';
        
        test_results := test_results || format('Stock movements created in last minute: %s', movements_count) || E'\n';
        
        IF movements_count >= 3 THEN -- At least 3 movements (2 for warehouse transfer + 1 for truck transfer)
            test_results := test_results || '✅ Audit trail entries created' || E'\n';
            
            -- Get latest movement details
            SELECT * INTO latest_movement 
            FROM stock_movements 
            ORDER BY created_at DESC 
            LIMIT 1;
            
            test_results := test_results || format('Latest movement: type=%s, full_change=%s, empty_change=%s', 
                latest_movement.movement_type, latest_movement.qty_full_change, latest_movement.qty_empty_change) || E'\n';
        ELSE
            test_results := test_results || '❌ Expected audit trail entries not found' || E'\n';
        END IF;
    END;
    
    -- =============================================================================
    -- STEP 7: TEST ERROR HANDLING
    -- =============================================================================
    test_results := test_results || E'\nSTEP 7: Testing error handling...' || E'\n';
    
    -- Test insufficient stock error
    BEGIN
        SELECT transfer_stock(
            test_warehouse_1,
            test_warehouse_2,
            test_product_1,
            99999, -- Impossibly large amount
            0
        ) INTO transfer_result;
        
        test_results := test_results || '❌ Error handling failed - transfer should have been rejected' || E'\n';
    EXCEPTION WHEN OTHERS THEN
        test_results := test_results || '✅ Error handling working - insufficient stock properly rejected: ' || SQLERRM || E'\n';
    END;
    
    -- Test same warehouse error
    BEGIN
        SELECT transfer_stock(
            test_warehouse_1,
            test_warehouse_1, -- Same warehouse
            test_product_1,
            1,
            0
        ) INTO transfer_result;
        
        test_results := test_results || '❌ Error handling failed - same warehouse transfer should have been rejected' || E'\n';
    EXCEPTION WHEN OTHERS THEN
        test_results := test_results || '✅ Error handling working - same warehouse properly rejected: ' || SQLERRM || E'\n';
    END;
    
    -- =============================================================================
    -- FINAL SUMMARY
    -- =============================================================================
    test_results := test_results || E'\n=== TEST SUMMARY ===' || E'\n';
    test_results := test_results || format('Total execution time: %s ms', 
        EXTRACT(EPOCH FROM (NOW() - start_time)) * 1000) || E'\n';
    test_results := test_results || 'Test completed at: ' || NOW() || E'\n';
    
    -- Output all results
    RAISE NOTICE '%', test_results;
    
    -- Also try to insert into a log table if it exists
    BEGIN
        INSERT INTO test_logs (test_name, test_results, created_at)
        VALUES ('comprehensive_transfer_test', test_results, NOW());
    EXCEPTION WHEN undefined_table THEN
        -- Table doesn't exist, that's fine
        NULL;
    END;
    
END $$;

-- =============================================================================
-- FINAL STATUS CHECK
-- =============================================================================
SELECT 
    'Transfer Functions Status' as check_type,
    routine_name as function_name,
    'EXISTS' as status
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name IN ('transfer_stock', 'transfer_stock_to_truck', 'transfer_stock_from_truck', 'validate_transfer_request')
ORDER BY routine_name;

-- Show recent stock movements
SELECT 
    'Recent Stock Movements' as info,
    sm.created_at,
    sm.movement_type,
    sm.qty_full_change,
    sm.qty_empty_change,
    sm.reason,
    ib.warehouse_id,
    p.sku as product_sku
FROM stock_movements sm
JOIN inventory_balance ib ON sm.inventory_id = ib.id
JOIN products p ON ib.product_id = p.id
WHERE sm.created_at > NOW() - INTERVAL '5 minutes'
ORDER BY sm.created_at DESC
LIMIT 10;

-- Show current inventory balances for test products
SELECT 
    'Current Inventory' as info,
    w.name as warehouse_name,
    p.sku as product_sku,
    ib.qty_full,
    ib.qty_empty,
    ib.qty_reserved,
    ib.updated_at
FROM inventory_balance ib
JOIN warehouses w ON ib.warehouse_id = w.id
JOIN products p ON ib.product_id = p.id
WHERE p.sku LIKE 'TEST-%'
ORDER BY w.name, p.sku;

-- Show truck inventory for test products
SELECT 
    'Truck Inventory' as info,
    t.registration as truck_registration,
    p.sku as product_sku,
    ti.qty_full,
    ti.qty_empty,
    ti.updated_at
FROM truck_inventory ti
JOIN truck t ON ti.truck_id = t.id
JOIN products p ON ti.product_id = p.id
WHERE p.sku LIKE 'TEST-%'
ORDER BY t.registration, p.sku;

ROLLBACK; -- Don't commit test transactions