-- =============================================================================
-- COMPREHENSIVE TRANSFER VERIFICATION SYSTEM
-- =============================================================================
-- This script provides a complete verification system for transfer functions
-- It tests all aspects of the transfer workflow from validation to execution

BEGIN;

-- =============================================================================
-- UTILITY FUNCTIONS FOR TESTING
-- =============================================================================

-- Function to create test data safely
CREATE OR REPLACE FUNCTION create_test_data()
RETURNS TABLE (
    warehouse_1 UUID,
    warehouse_2 UUID,
    truck_1 UUID,
    product_1 UUID,
    product_2 UUID
) AS $$
DECLARE
    w1 UUID;
    w2 UUID;
    t1 UUID;
    p1 UUID;
    p2 UUID;
BEGIN
    -- Get existing warehouses or create test ones
    SELECT id INTO w1 FROM warehouses WHERE name LIKE '%Test%' OR name LIKE '%Main%' LIMIT 1;
    IF w1 IS NULL THEN
        SELECT id INTO w1 FROM warehouses LIMIT 1;
    END IF;
    
    SELECT id INTO w2 FROM warehouses WHERE id != w1 LIMIT 1;
    
    -- Get existing truck or create test one
    SELECT id INTO t1 FROM truck WHERE active = true LIMIT 1;
    
    -- Get existing products or create test ones
    SELECT id INTO p1 FROM products WHERE status = 'active' LIMIT 1;
    SELECT id INTO p2 FROM products WHERE status = 'active' AND id != p1 LIMIT 1;
    
    RETURN QUERY SELECT w1, w2, t1, p1, p2;
END;
$$ LANGUAGE plpgsql;

-- Function to setup test inventory
CREATE OR REPLACE FUNCTION setup_test_inventory(
    warehouse_id UUID,
    product_id UUID,
    qty_full INTEGER DEFAULT 100,
    qty_empty INTEGER DEFAULT 50
) RETURNS VOID AS $$
BEGIN
    INSERT INTO inventory_balance (warehouse_id, product_id, qty_full, qty_empty, qty_reserved)
    VALUES (warehouse_id, product_id, qty_full, qty_empty, 0)
    ON CONFLICT (warehouse_id, product_id) 
    DO UPDATE SET 
        qty_full = GREATEST(inventory_balance.qty_full, qty_full),
        qty_empty = GREATEST(inventory_balance.qty_empty, qty_empty),
        qty_reserved = 0,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to get current stock levels
CREATE OR REPLACE FUNCTION get_stock_levels(
    warehouse_id UUID,
    product_id UUID
) RETURNS TABLE (
    qty_full INTEGER,
    qty_empty INTEGER,
    qty_reserved INTEGER
) AS $$
BEGIN
    RETURN QUERY 
    SELECT 
        COALESCE(ib.qty_full, 0) as qty_full,
        COALESCE(ib.qty_empty, 0) as qty_empty,
        COALESCE(ib.qty_reserved, 0) as qty_reserved
    FROM inventory_balance ib
    WHERE ib.warehouse_id = get_stock_levels.warehouse_id 
    AND ib.product_id = get_stock_levels.product_id;
END;
$$ LANGUAGE plpgsql;

-- Function to verify transfer atomicity
CREATE OR REPLACE FUNCTION verify_transfer_atomicity(
    from_warehouse UUID,
    to_warehouse UUID,
    product_id UUID,
    expected_qty_full INTEGER,
    expected_qty_empty INTEGER
) RETURNS JSONB AS $$
DECLARE
    source_stock RECORD;
    dest_stock RECORD;
    result JSONB;
BEGIN
    -- Get source stock
    SELECT * INTO source_stock FROM get_stock_levels(from_warehouse, product_id);
    
    -- Get destination stock
    SELECT * INTO dest_stock FROM get_stock_levels(to_warehouse, product_id);
    
    -- Build result
    result := jsonb_build_object(
        'source_stock', jsonb_build_object(
            'qty_full', source_stock.qty_full,
            'qty_empty', source_stock.qty_empty,
            'qty_reserved', source_stock.qty_reserved
        ),
        'destination_stock', jsonb_build_object(
            'qty_full', dest_stock.qty_full,
            'qty_empty', dest_stock.qty_empty,
            'qty_reserved', dest_stock.qty_reserved
        ),
        'verification', jsonb_build_object(
            'expected_transfer_full', expected_qty_full,
            'expected_transfer_empty', expected_qty_empty,
            'atomicity_check', 'pending'
        )
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- COMPREHENSIVE TEST SUITE
-- =============================================================================

DO $$
DECLARE
    test_data RECORD;
    test_result JSONB;
    validation_result JSONB;
    transfer_result JSONB;
    before_state JSONB;
    after_state JSONB;
    test_counter INTEGER := 0;
    passed_tests INTEGER := 0;
    failed_tests INTEGER := 0;
    error_msg TEXT;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=======================================================================';
    RAISE NOTICE '         COMPREHENSIVE TRANSFER VERIFICATION SYSTEM';
    RAISE NOTICE '=======================================================================';
    RAISE NOTICE '';
    
    -- Get test data
    SELECT * INTO test_data FROM create_test_data();
    
    IF test_data.warehouse_1 IS NULL OR test_data.warehouse_2 IS NULL OR test_data.product_1 IS NULL THEN
        RAISE NOTICE '❌ CRITICAL: Cannot proceed - insufficient test data';
        RAISE NOTICE 'Warehouse 1: %', test_data.warehouse_1;
        RAISE NOTICE 'Warehouse 2: %', test_data.warehouse_2;
        RAISE NOTICE 'Product 1: %', test_data.product_1;
        RETURN;
    END IF;
    
    RAISE NOTICE '🔧 Test Environment Setup:';
    RAISE NOTICE '   Warehouse 1: %', test_data.warehouse_1;
    RAISE NOTICE '   Warehouse 2: %', test_data.warehouse_2;
    RAISE NOTICE '   Truck 1: %', test_data.truck_1;
    RAISE NOTICE '   Product 1: %', test_data.product_1;
    RAISE NOTICE '   Product 2: %', test_data.product_2;
    
    -- Setup test inventory
    PERFORM setup_test_inventory(test_data.warehouse_1, test_data.product_1, 100, 50);
    IF test_data.product_2 IS NOT NULL THEN
        PERFORM setup_test_inventory(test_data.warehouse_1, test_data.product_2, 75, 25);
    END IF;
    
    RAISE NOTICE '✅ Test inventory setup complete';
    RAISE NOTICE '';
    
    -- =============================================================================
    -- TEST 1: BASIC VALIDATION FUNCTION
    -- =============================================================================
    test_counter := test_counter + 1;
    RAISE NOTICE '🧪 TEST %: Basic Validation Function', test_counter;
    
    BEGIN
        SELECT validate_transfer_request(
            test_data.warehouse_1,
            test_data.warehouse_2,
            test_data.product_1,
            10, 5
        ) INTO validation_result;
        
        IF (validation_result->>'is_valid')::boolean THEN
            RAISE NOTICE '✅ Basic validation passed';
            passed_tests := passed_tests + 1;
        ELSE
            RAISE NOTICE '❌ Basic validation failed: %', validation_result->'errors';
            failed_tests := failed_tests + 1;
        END IF;
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '❌ Basic validation threw error: %', SQLERRM;
            failed_tests := failed_tests + 1;
    END;
    
    -- =============================================================================
    -- TEST 2: VALIDATION WITH INSUFFICIENT STOCK
    -- =============================================================================
    test_counter := test_counter + 1;
    RAISE NOTICE '';
    RAISE NOTICE '🧪 TEST %: Validation with Insufficient Stock', test_counter;
    
    BEGIN
        SELECT validate_transfer_request(
            test_data.warehouse_1,
            test_data.warehouse_2,
            test_data.product_1,
            200, 100 -- More than available
        ) INTO validation_result;
        
        IF NOT (validation_result->>'is_valid')::boolean THEN
            RAISE NOTICE '✅ Insufficient stock validation correctly rejected';
            passed_tests := passed_tests + 1;
        ELSE
            RAISE NOTICE '❌ Insufficient stock validation should have failed';
            failed_tests := failed_tests + 1;
        END IF;
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '❌ Insufficient stock validation threw error: %', SQLERRM;
            failed_tests := failed_tests + 1;
    END;
    
    -- =============================================================================
    -- TEST 3: VALIDATION WITH SAME WAREHOUSE
    -- =============================================================================
    test_counter := test_counter + 1;
    RAISE NOTICE '';
    RAISE NOTICE '🧪 TEST %: Validation with Same Warehouse', test_counter;
    
    BEGIN
        SELECT validate_transfer_request(
            test_data.warehouse_1,
            test_data.warehouse_1, -- Same warehouse
            test_data.product_1,
            10, 5
        ) INTO validation_result;
        
        IF NOT (validation_result->>'is_valid')::boolean THEN
            RAISE NOTICE '✅ Same warehouse validation correctly rejected';
            passed_tests := passed_tests + 1;
        ELSE
            RAISE NOTICE '❌ Same warehouse validation should have failed';
            failed_tests := failed_tests + 1;
        END IF;
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '❌ Same warehouse validation threw error: %', SQLERRM;
            failed_tests := failed_tests + 1;
    END;
    
    -- =============================================================================
    -- TEST 4: WAREHOUSE-TO-WAREHOUSE TRANSFER ATOMICITY
    -- =============================================================================
    test_counter := test_counter + 1;
    RAISE NOTICE '';
    RAISE NOTICE '🧪 TEST %: Warehouse-to-Warehouse Transfer Atomicity', test_counter;
    
    BEGIN
        -- Record state before transfer
        SELECT verify_transfer_atomicity(
            test_data.warehouse_1,
            test_data.warehouse_2,
            test_data.product_1,
            15, 10
        ) INTO before_state;
        
        -- Perform transfer
        SELECT transfer_stock(
            test_data.warehouse_1,
            test_data.warehouse_2,
            test_data.product_1,
            15, 10
        ) INTO transfer_result;
        
        -- Record state after transfer
        SELECT verify_transfer_atomicity(
            test_data.warehouse_1,
            test_data.warehouse_2,
            test_data.product_1,
            15, 10
        ) INTO after_state;
        
        -- Verify atomicity
        IF (transfer_result->>'success')::boolean THEN
            DECLARE
                source_before INTEGER := (before_state->'source_stock'->>'qty_full')::INTEGER;
                source_after INTEGER := (after_state->'source_stock'->>'qty_full')::INTEGER;
                dest_before INTEGER := COALESCE((before_state->'destination_stock'->>'qty_full')::INTEGER, 0);
                dest_after INTEGER := (after_state->'destination_stock'->>'qty_full')::INTEGER;
            BEGIN
                IF source_after = source_before - 15 AND dest_after = dest_before + 15 THEN
                    RAISE NOTICE '✅ Warehouse-to-warehouse transfer atomicity verified';
                    RAISE NOTICE '   Source: % → % (-15)', source_before, source_after;
                    RAISE NOTICE '   Destination: % → % (+15)', dest_before, dest_after;
                    passed_tests := passed_tests + 1;
                ELSE
                    RAISE NOTICE '❌ Transfer atomicity failed';
                    RAISE NOTICE '   Source: % → % (expected -%)', source_before, source_after, 15;
                    RAISE NOTICE '   Destination: % → % (expected +%)', dest_before, dest_after, 15;
                    failed_tests := failed_tests + 1;
                END IF;
            END;
        ELSE
            RAISE NOTICE '❌ Transfer execution failed: %', transfer_result->'error';
            failed_tests := failed_tests + 1;
        END IF;
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '❌ Warehouse transfer atomicity test threw error: %', SQLERRM;
            failed_tests := failed_tests + 1;
    END;
    
    -- =============================================================================
    -- TEST 5: TRUCK TRANSFER FUNCTIONALITY
    -- =============================================================================
    IF test_data.truck_1 IS NOT NULL THEN
        test_counter := test_counter + 1;
        RAISE NOTICE '';
        RAISE NOTICE '🧪 TEST %: Truck Transfer Functionality', test_counter;
        
        BEGIN
            -- Record state before transfer
            SELECT verify_transfer_atomicity(
                test_data.warehouse_1,
                test_data.truck_1,
                test_data.product_1,
                8, 4
            ) INTO before_state;
            
            -- Perform truck transfer
            SELECT transfer_stock_to_truck(
                test_data.warehouse_1,
                test_data.truck_1,
                test_data.product_1,
                8, 4
            ) INTO transfer_result;
            
            IF (transfer_result->>'success')::boolean THEN
                RAISE NOTICE '✅ Truck transfer executed successfully';
                passed_tests := passed_tests + 1;
            ELSE
                RAISE NOTICE '❌ Truck transfer failed: %', transfer_result->'error';
                failed_tests := failed_tests + 1;
            END IF;
        EXCEPTION
            WHEN OTHERS THEN
                RAISE NOTICE '❌ Truck transfer test threw error: %', SQLERRM;
                failed_tests := failed_tests + 1;
        END;
    ELSE
        RAISE NOTICE '⚠️  Skipping truck transfer test - no truck available';
    END IF;
    
    -- =============================================================================
    -- TEST 6: MULTI-PRODUCT TRANSFER SIMULATION
    -- =============================================================================
    IF test_data.product_2 IS NOT NULL THEN
        test_counter := test_counter + 1;
        RAISE NOTICE '';
        RAISE NOTICE '🧪 TEST %: Multi-Product Transfer Simulation', test_counter;
        
        BEGIN
            -- Transfer product 1
            SELECT transfer_stock(
                test_data.warehouse_1,
                test_data.warehouse_2,
                test_data.product_1,
                5, 3
            ) INTO transfer_result;
            
            -- Transfer product 2
            SELECT transfer_stock(
                test_data.warehouse_1,
                test_data.warehouse_2,
                test_data.product_2,
                10, 2
            ) INTO transfer_result;
            
            RAISE NOTICE '✅ Multi-product transfer simulation completed';
            passed_tests := passed_tests + 1;
        EXCEPTION
            WHEN OTHERS THEN
                RAISE NOTICE '❌ Multi-product transfer simulation threw error: %', SQLERRM;
                failed_tests := failed_tests + 1;
        END;
    ELSE
        RAISE NOTICE '⚠️  Skipping multi-product test - only one product available';
    END IF;
    
    -- =============================================================================
    -- TEST 7: STOCK MOVEMENTS AUDIT TRAIL
    -- =============================================================================
    test_counter := test_counter + 1;
    RAISE NOTICE '';
    RAISE NOTICE '🧪 TEST %: Stock Movements Audit Trail', test_counter;
    
    BEGIN
        DECLARE
            movements_count INTEGER;
            recent_movements RECORD;
        BEGIN
            -- Count recent movements
            SELECT COUNT(*) INTO movements_count
            FROM stock_movements
            WHERE created_at > NOW() - INTERVAL '5 minutes'
            AND movement_type IN ('transfer_out', 'transfer_in');
            
            IF movements_count > 0 THEN
                RAISE NOTICE '✅ Audit trail working - % recent transfer movements', movements_count;
                
                -- Show sample recent movements
                FOR recent_movements IN 
                    SELECT movement_type, qty_full_change, qty_empty_change, reason
                    FROM stock_movements 
                    WHERE created_at > NOW() - INTERVAL '5 minutes'
                    AND movement_type IN ('transfer_out', 'transfer_in')
                    ORDER BY created_at DESC
                    LIMIT 3
                LOOP
                    RAISE NOTICE '   - %: full=%, empty=%, reason=%', 
                        recent_movements.movement_type, 
                        recent_movements.qty_full_change,
                        recent_movements.qty_empty_change,
                        recent_movements.reason;
                END LOOP;
                
                passed_tests := passed_tests + 1;
            ELSE
                RAISE NOTICE '❌ No recent transfer movements found in audit trail';
                failed_tests := failed_tests + 1;
            END IF;
        END;
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '❌ Audit trail test threw error: %', SQLERRM;
            failed_tests := failed_tests + 1;
    END;
    
    -- =============================================================================
    -- TEST 8: ERROR HANDLING AND ROLLBACK
    -- =============================================================================
    test_counter := test_counter + 1;
    RAISE NOTICE '';
    RAISE NOTICE '🧪 TEST %: Error Handling and Rollback', test_counter;
    
    BEGIN
        -- Attempt invalid transfer (non-existent product)
        SELECT transfer_stock(
            test_data.warehouse_1,
            test_data.warehouse_2,
            '00000000-0000-0000-0000-000000000000'::UUID, -- Invalid product ID
            10, 5
        ) INTO transfer_result;
        
        IF NOT (transfer_result->>'success')::boolean THEN
            RAISE NOTICE '✅ Invalid transfer correctly rejected with error: %', transfer_result->'error';
            passed_tests := passed_tests + 1;
        ELSE
            RAISE NOTICE '❌ Invalid transfer should have been rejected';
            failed_tests := failed_tests + 1;
        END IF;
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '✅ Error handling working - caught exception: %', SQLERRM;
            passed_tests := passed_tests + 1;
    END;
    
    -- =============================================================================
    -- FINAL SUMMARY AND RECOMMENDATIONS
    -- =============================================================================
    RAISE NOTICE '';
    RAISE NOTICE '=======================================================================';
    RAISE NOTICE '                        TEST SUMMARY';
    RAISE NOTICE '=======================================================================';
    RAISE NOTICE '📊 Total Tests: %', test_counter;
    RAISE NOTICE '✅ Passed: %', passed_tests;
    RAISE NOTICE '❌ Failed: %', failed_tests;
    RAISE NOTICE '📈 Success Rate: %%%', ROUND((passed_tests::DECIMAL / test_counter::DECIMAL) * 100, 1);
    RAISE NOTICE '';
    
    IF failed_tests = 0 THEN
        RAISE NOTICE '🎉 ALL TESTS PASSED! Transfer system is functioning correctly.';
    ELSE
        RAISE NOTICE '⚠️  Some tests failed. Please review the issues above.';
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '=======================================================================';
    RAISE NOTICE '                      RECOMMENDATIONS';
    RAISE NOTICE '=======================================================================';
    RAISE NOTICE '1. 🔍 Monitor stock_movements table for complete audit trail';
    RAISE NOTICE '2. 🔒 Ensure all transfers use the database functions for atomicity';
    RAISE NOTICE '3. 🧪 Run this test suite after any database changes';
    RAISE NOTICE '4. 📊 Implement application-level monitoring for these functions';
    RAISE NOTICE '5. 🚨 Set up alerts for transfer failures in production';
    RAISE NOTICE '';
    
    -- Show current inventory levels for reference
    RAISE NOTICE '=======================================================================';
    RAISE NOTICE '                    CURRENT INVENTORY LEVELS';
    RAISE NOTICE '=======================================================================';
    
    FOR test_result IN 
        SELECT 
            w.name as warehouse_name,
            p.name as product_name,
            ib.qty_full,
            ib.qty_empty,
            ib.qty_reserved
        FROM inventory_balance ib
        JOIN warehouses w ON w.id = ib.warehouse_id
        JOIN products p ON p.id = ib.product_id
        WHERE ib.warehouse_id IN (test_data.warehouse_1, test_data.warehouse_2)
        AND ib.product_id IN (test_data.product_1, test_data.product_2)
        ORDER BY w.name, p.name
    LOOP
        RAISE NOTICE '🏢 %: % - Full: %, Empty: %, Reserved: %', 
            test_result.warehouse_name,
            test_result.product_name,
            test_result.qty_full,
            test_result.qty_empty,
            test_result.qty_reserved;
    END LOOP;
    
END $$;

-- Clean up test functions
DROP FUNCTION IF EXISTS create_test_data();
DROP FUNCTION IF EXISTS setup_test_inventory(UUID, UUID, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS get_stock_levels(UUID, UUID);
DROP FUNCTION IF EXISTS verify_transfer_atomicity(UUID, UUID, UUID, INTEGER, INTEGER);

ROLLBACK; -- Don't commit test data

-- =============================================================================
-- VERIFICATION QUERIES FOR ONGOING MONITORING
-- =============================================================================

-- Query to check transfer function availability
SELECT 
    '🔧 Transfer Function Status' as check_category,
    routine_name as function_name,
    '✅ Available' as status,
    routine_definition IS NOT NULL as has_definition
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('transfer_stock', 'transfer_stock_to_truck', 'transfer_stock_from_truck', 'validate_transfer_request')
ORDER BY routine_name;

-- Query to check recent transfer activity
SELECT 
    '📊 Recent Transfer Activity' as check_category,
    COUNT(*) as transfer_movements,
    MIN(created_at) as earliest_movement,
    MAX(created_at) as latest_movement
FROM stock_movements 
WHERE movement_type IN ('transfer_out', 'transfer_in')
AND created_at > NOW() - INTERVAL '24 hours';

-- Query to check transfer data integrity
SELECT 
    '🔍 Transfer Data Integrity' as check_category,
    COUNT(*) as active_transfers,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_transfers,
    COUNT(CASE WHEN status = 'in_transit' THEN 1 END) as in_transit_transfers
FROM transfers 
WHERE created_at > NOW() - INTERVAL '7 days';