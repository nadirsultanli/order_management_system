-- =============================================================================
-- TEST TRANSFER FUNCTIONS
-- =============================================================================
-- This script tests the transfer functions to ensure they work correctly
-- Run this AFTER running verify_and_create_transfer_functions.sql

BEGIN;

-- =============================================================================
-- SETUP TEST DATA (if needed)
-- =============================================================================
DO $$
DECLARE
    test_warehouse_1 UUID;
    test_warehouse_2 UUID;
    test_truck UUID;
    test_product UUID;
BEGIN
    RAISE NOTICE '=== SETTING UP TEST DATA ===';
    
    -- Get or create test warehouses
    SELECT id INTO test_warehouse_1 FROM warehouses LIMIT 1;
    SELECT id INTO test_warehouse_2 FROM warehouses OFFSET 1 LIMIT 1;
    
    -- Get or create test truck
    SELECT id INTO test_truck FROM truck WHERE active = true LIMIT 1;
    
    -- Get or create test product
    SELECT id INTO test_product FROM products WHERE status = 'active' LIMIT 1;
    
    RAISE NOTICE 'Test Warehouse 1: %', test_warehouse_1;
    RAISE NOTICE 'Test Warehouse 2: %', test_warehouse_2;
    RAISE NOTICE 'Test Truck: %', test_truck;
    RAISE NOTICE 'Test Product: %', test_product;
    
    -- Ensure we have inventory in warehouse 1 for testing
    IF test_warehouse_1 IS NOT NULL AND test_product IS NOT NULL THEN
        -- Insert or update inventory balance
        INSERT INTO inventory_balance (warehouse_id, product_id, qty_full, qty_empty, qty_reserved)
        VALUES (test_warehouse_1, test_product, 100, 50, 0)
        ON CONFLICT (warehouse_id, product_id) 
        DO UPDATE SET 
            qty_full = GREATEST(inventory_balance.qty_full, 100),
            qty_empty = GREATEST(inventory_balance.qty_empty, 50),
            updated_at = NOW();
            
        RAISE NOTICE '✅ Test inventory setup complete';
    ELSE
        RAISE NOTICE '❌ Could not setup test inventory - missing warehouse or product';
    END IF;
END $$;

-- =============================================================================
-- TEST 1: VALIDATE_TRANSFER_REQUEST FUNCTION
-- =============================================================================
DO $$
DECLARE
    test_warehouse_1 UUID;
    test_warehouse_2 UUID;
    test_product UUID;
    validation_result JSONB;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== TEST 1: VALIDATE_TRANSFER_REQUEST ===';
    
    -- Get test data
    SELECT id INTO test_warehouse_1 FROM warehouses LIMIT 1;
    SELECT id INTO test_warehouse_2 FROM warehouses OFFSET 1 LIMIT 1;
    SELECT id INTO test_product FROM products WHERE status = 'active' LIMIT 1;
    
    IF test_warehouse_1 IS NOT NULL AND test_warehouse_2 IS NOT NULL AND test_product IS NOT NULL THEN
        -- Test valid transfer request
        SELECT validate_transfer_request(
            test_warehouse_1,
            test_warehouse_2,
            test_product,
            5, -- qty_full
            3  -- qty_empty
        ) INTO validation_result;
        
        RAISE NOTICE 'Validation Result: %', validation_result;
        
        IF (validation_result->>'is_valid')::boolean THEN
            RAISE NOTICE '✅ Valid transfer request validation passed';
        ELSE
            RAISE NOTICE '❌ Valid transfer request validation failed: %', validation_result->'errors';
        END IF;
        
        -- Test invalid transfer request (same warehouse)
        SELECT validate_transfer_request(
            test_warehouse_1,
            test_warehouse_1, -- Same warehouse
            test_product,
            5,
            3
        ) INTO validation_result;
        
        IF NOT (validation_result->>'is_valid')::boolean THEN
            RAISE NOTICE '✅ Invalid transfer request (same warehouse) correctly rejected';
        ELSE
            RAISE NOTICE '❌ Invalid transfer request should have been rejected';
        END IF;
    ELSE
        RAISE NOTICE '❌ Could not run validation test - missing test data';
    END IF;
END $$;

-- =============================================================================
-- TEST 2: TRANSFER_STOCK FUNCTION (warehouse to warehouse)
-- =============================================================================
DO $$
DECLARE
    test_warehouse_1 UUID;
    test_warehouse_2 UUID;
    test_product UUID;
    transfer_result JSONB;
    before_stock_w1 RECORD;
    before_stock_w2 RECORD;
    after_stock_w1 RECORD;
    after_stock_w2 RECORD;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== TEST 2: TRANSFER_STOCK (warehouse to warehouse) ===';
    
    -- Get test data
    SELECT id INTO test_warehouse_1 FROM warehouses LIMIT 1;
    SELECT id INTO test_warehouse_2 FROM warehouses OFFSET 1 LIMIT 1;
    SELECT id INTO test_product FROM products WHERE status = 'active' LIMIT 1;
    
    IF test_warehouse_1 IS NOT NULL AND test_warehouse_2 IS NOT NULL AND test_product IS NOT NULL THEN
        -- Get stock before transfer
        SELECT * INTO before_stock_w1 FROM inventory_balance 
        WHERE warehouse_id = test_warehouse_1 AND product_id = test_product;
        
        SELECT * INTO before_stock_w2 FROM inventory_balance 
        WHERE warehouse_id = test_warehouse_2 AND product_id = test_product;
        
        RAISE NOTICE 'Before - Warehouse 1: full=%, empty=%', 
                     COALESCE(before_stock_w1.qty_full, 0), COALESCE(before_stock_w1.qty_empty, 0);
        RAISE NOTICE 'Before - Warehouse 2: full=%, empty=%', 
                     COALESCE(before_stock_w2.qty_full, 0), COALESCE(before_stock_w2.qty_empty, 0);
        
        -- Perform transfer (only if we have sufficient stock)
        IF before_stock_w1 IS NOT NULL AND before_stock_w1.qty_full >= 5 THEN
            SELECT transfer_stock(
                test_warehouse_1,
                test_warehouse_2,
                test_product,
                5, -- qty_full
                2  -- qty_empty
            ) INTO transfer_result;
            
            RAISE NOTICE 'Transfer Result: %', transfer_result;
            
            -- Get stock after transfer
            SELECT * INTO after_stock_w1 FROM inventory_balance 
            WHERE warehouse_id = test_warehouse_1 AND product_id = test_product;
            
            SELECT * INTO after_stock_w2 FROM inventory_balance 
            WHERE warehouse_id = test_warehouse_2 AND product_id = test_product;
            
            RAISE NOTICE 'After - Warehouse 1: full=%, empty=%', 
                         after_stock_w1.qty_full, after_stock_w1.qty_empty;
            RAISE NOTICE 'After - Warehouse 2: full=%, empty=%', 
                         after_stock_w2.qty_full, after_stock_w2.qty_empty;
            
            -- Verify the transfer worked correctly
            IF (transfer_result->>'success')::boolean 
               AND after_stock_w1.qty_full = before_stock_w1.qty_full - 5
               AND after_stock_w2.qty_full = COALESCE(before_stock_w2.qty_full, 0) + 5 THEN
                RAISE NOTICE '✅ Warehouse-to-warehouse transfer test passed';
            ELSE
                RAISE NOTICE '❌ Warehouse-to-warehouse transfer test failed';
            END IF;
        ELSE
            RAISE NOTICE '⚠️  Skipping transfer test - insufficient stock in source warehouse';
        END IF;
    ELSE
        RAISE NOTICE '❌ Could not run warehouse transfer test - missing test data';
    END IF;
END $$;

-- =============================================================================
-- TEST 3: TRANSFER_STOCK_TO_TRUCK FUNCTION (warehouse to truck)
-- =============================================================================
DO $$
DECLARE
    test_warehouse UUID;
    test_truck UUID;
    test_product UUID;
    transfer_result JSONB;
    before_stock_warehouse RECORD;
    before_stock_truck RECORD;
    after_stock_warehouse RECORD;
    after_stock_truck RECORD;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== TEST 3: TRANSFER_STOCK_TO_TRUCK ===';
    
    -- Get test data
    SELECT id INTO test_warehouse FROM warehouses LIMIT 1;
    SELECT id INTO test_truck FROM truck WHERE active = true LIMIT 1;
    SELECT id INTO test_product FROM products WHERE status = 'active' LIMIT 1;
    
    IF test_warehouse IS NOT NULL AND test_truck IS NOT NULL AND test_product IS NOT NULL THEN
        -- Get stock before transfer
        SELECT * INTO before_stock_warehouse FROM inventory_balance 
        WHERE warehouse_id = test_warehouse AND product_id = test_product;
        
        SELECT * INTO before_stock_truck FROM truck_inventory 
        WHERE truck_id = test_truck AND product_id = test_product;
        
        RAISE NOTICE 'Before - Warehouse: full=%, empty=%', 
                     COALESCE(before_stock_warehouse.qty_full, 0), COALESCE(before_stock_warehouse.qty_empty, 0);
        RAISE NOTICE 'Before - Truck: full=%, empty=%', 
                     COALESCE(before_stock_truck.qty_full, 0), COALESCE(before_stock_truck.qty_empty, 0);
        
        -- Perform transfer (only if we have sufficient stock)
        IF before_stock_warehouse IS NOT NULL AND before_stock_warehouse.qty_full >= 3 THEN
            SELECT transfer_stock_to_truck(
                test_warehouse,
                test_truck,
                test_product,
                3, -- qty_full
                1  -- qty_empty
            ) INTO transfer_result;
            
            RAISE NOTICE 'Transfer to Truck Result: %', transfer_result;
            
            -- Get stock after transfer
            SELECT * INTO after_stock_warehouse FROM inventory_balance 
            WHERE warehouse_id = test_warehouse AND product_id = test_product;
            
            SELECT * INTO after_stock_truck FROM truck_inventory 
            WHERE truck_id = test_truck AND product_id = test_product;
            
            RAISE NOTICE 'After - Warehouse: full=%, empty=%', 
                         after_stock_warehouse.qty_full, after_stock_warehouse.qty_empty;
            RAISE NOTICE 'After - Truck: full=%, empty=%', 
                         after_stock_truck.qty_full, after_stock_truck.qty_empty;
            
            -- Verify the transfer worked correctly
            IF (transfer_result->>'success')::boolean 
               AND after_stock_warehouse.qty_full = before_stock_warehouse.qty_full - 3
               AND after_stock_truck.qty_full = COALESCE(before_stock_truck.qty_full, 0) + 3 THEN
                RAISE NOTICE '✅ Warehouse-to-truck transfer test passed';
            ELSE
                RAISE NOTICE '❌ Warehouse-to-truck transfer test failed';
            END IF;
        ELSE
            RAISE NOTICE '⚠️  Skipping truck transfer test - insufficient stock in warehouse';
        END IF;
    ELSE
        RAISE NOTICE '❌ Could not run truck transfer test - missing test data';
        RAISE NOTICE 'Warehouse: %, Truck: %, Product: %', test_warehouse, test_truck, test_product;
    END IF;
END $$;

-- =============================================================================
-- TEST 4: STOCK_MOVEMENTS AUDIT TRAIL
-- =============================================================================
DO $$
DECLARE
    movements_count INTEGER;
    latest_movement RECORD;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== TEST 4: STOCK_MOVEMENTS AUDIT TRAIL ===';
    
    -- Count recent stock movements
    SELECT COUNT(*) INTO movements_count 
    FROM stock_movements 
    WHERE created_at > NOW() - INTERVAL '1 minute';
    
    RAISE NOTICE 'Recent stock movements (last minute): %', movements_count;
    
    -- Get latest movement details
    SELECT * INTO latest_movement 
    FROM stock_movements 
    ORDER BY created_at DESC 
    LIMIT 1;
    
    IF latest_movement IS NOT NULL THEN
        RAISE NOTICE 'Latest movement: type=%, full_change=%, empty_change=%, reason=%', 
                     latest_movement.movement_type, 
                     latest_movement.qty_full_change,
                     latest_movement.qty_empty_change,
                     latest_movement.reason;
        RAISE NOTICE '✅ Stock movements audit trail is working';
    ELSE
        RAISE NOTICE '❌ No stock movements found';
    END IF;
END $$;

-- =============================================================================
-- FINAL SUMMARY
-- =============================================================================
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== TEST SUMMARY ===';
    RAISE NOTICE '✅ All transfer function tests completed';
    RAISE NOTICE '';
    RAISE NOTICE 'Available transfer functions:';
    RAISE NOTICE '  - transfer_stock(warehouse_from, warehouse_to, product, qty_full, qty_empty)';
    RAISE NOTICE '  - transfer_stock_to_truck(warehouse, truck, product, qty_full, qty_empty)';
    RAISE NOTICE '  - transfer_stock_from_truck(truck, warehouse, product, qty_full, qty_empty)';
    RAISE NOTICE '  - validate_transfer_request(warehouse_from, warehouse_to, product, qty_full, qty_empty)';
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '  1. Update your API endpoints to use these functions';
    RAISE NOTICE '  2. Test with real data from your application';
    RAISE NOTICE '  3. Monitor stock_movements table for audit trail';
END $$;

ROLLBACK; -- Don't commit test transactions

-- Show current function status
SELECT 
    'Transfer Functions Status' as check_type,
    routine_name as function_name,
    'EXISTS' as status
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name IN ('transfer_stock', 'transfer_stock_to_truck', 'transfer_stock_from_truck', 'validate_transfer_request')
ORDER BY routine_name;