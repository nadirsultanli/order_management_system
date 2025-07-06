-- Test script to verify truck capacity fix after implementing inventory-based calculations
-- This script tests the complete transfer workflow and capacity calculations

\echo '========================================'
\echo 'TRUCK CAPACITY FIX VERIFICATION TEST'
\echo '========================================'

-- Test 1: Check current truck inventory and capacity state
\echo ''
\echo 'TEST 1: Current Truck Inventory State'
\echo '======================================'

-- Get trucks with their basic info
SELECT 
    'Current Trucks' as section,
    t.id,
    t.fleet_number,
    t.license_plate,
    t.capacity_cylinders,
    (t.capacity_cylinders * 27) as calculated_capacity_kg,
    t.active
FROM truck t
WHERE t.active = true
ORDER BY t.fleet_number
LIMIT 5;

-- Check current truck inventory
SELECT 
    'Current Truck Inventory' as section,
    ti.truck_id,
    t.fleet_number,
    ti.product_id,
    p.name as product_name,
    ti.qty_full,
    ti.qty_empty,
    -- Calculate weight using the same logic as the backend fix
    CASE 
        WHEN p.capacity_kg IS NOT NULL AND p.tare_weight_kg IS NOT NULL THEN
            (ti.qty_full * (p.capacity_kg + p.tare_weight_kg)) + (ti.qty_empty * p.tare_weight_kg)
        ELSE
            (ti.qty_full * 27) + (ti.qty_empty * 14)
    END as calculated_weight_kg,
    ti.updated_at
FROM truck_inventory ti
JOIN truck t ON ti.truck_id = t.id
LEFT JOIN products p ON ti.product_id = p.id
WHERE t.active = true
ORDER BY t.fleet_number, p.name;

-- Test 2: Perform a test transfer to truck if possible
\echo ''
\echo 'TEST 2: Test Transfer to Truck'
\echo '============================'

DO $$
DECLARE
    test_warehouse_id UUID;
    test_truck_id UUID;
    test_product_id UUID;
    test_qty NUMERIC := 1;
    transfer_result JSONB;
    validation_result JSONB;
    truck_info RECORD;
    initial_inventory RECORD;
    final_inventory RECORD;
BEGIN
    -- Get test data
    SELECT id INTO test_warehouse_id 
    FROM warehouses 
    WHERE name ILIKE '%main%' OR name ILIKE '%central%' OR name ILIKE '%warehouse%' 
    LIMIT 1;
    
    SELECT id INTO test_truck_id 
    FROM truck 
    WHERE active = true 
    LIMIT 1;
    
    SELECT ib.product_id INTO test_product_id 
    FROM inventory_balance ib
    WHERE ib.warehouse_id = test_warehouse_id 
      AND ib.qty_full >= test_qty 
    LIMIT 1;
    
    IF test_warehouse_id IS NOT NULL AND test_truck_id IS NOT NULL AND test_product_id IS NOT NULL THEN
        -- Get truck info
        SELECT * INTO truck_info FROM truck WHERE id = test_truck_id;
        
        RAISE NOTICE 'Testing transfer: Warehouse % -> Truck % (%), Product %, Qty %', 
                     test_warehouse_id, test_truck_id, truck_info.fleet_number, test_product_id, test_qty;
        
        -- Get initial truck inventory state
        SELECT 
            COALESCE(qty_full, 0) as qty_full,
            COALESCE(qty_empty, 0) as qty_empty
        INTO initial_inventory
        FROM truck_inventory 
        WHERE truck_id = test_truck_id AND product_id = test_product_id;
        
        IF NOT FOUND THEN
            initial_inventory.qty_full := 0;
            initial_inventory.qty_empty := 0;
        END IF;
        
        RAISE NOTICE 'Initial truck inventory: Full=%, Empty=%', 
                     initial_inventory.qty_full, initial_inventory.qty_empty;
        
        -- Perform the transfer
        BEGIN
            SELECT transfer_stock_to_truck(
                test_warehouse_id,
                test_truck_id,
                test_product_id,
                test_qty,
                0
            ) INTO transfer_result;
            
            RAISE NOTICE 'Transfer completed successfully!';
            RAISE NOTICE 'Transfer result: %', transfer_result;
            
            -- Get final truck inventory state
            SELECT 
                qty_full,
                qty_empty
            INTO final_inventory
            FROM truck_inventory 
            WHERE truck_id = test_truck_id AND product_id = test_product_id;
            
            RAISE NOTICE 'Final truck inventory: Full=%, Empty=%', 
                         final_inventory.qty_full, final_inventory.qty_empty;
            
            -- Verify the transfer worked
            IF final_inventory.qty_full = initial_inventory.qty_full + test_qty THEN
                RAISE NOTICE '✓ TRANSFER VERIFICATION PASSED: Inventory updated correctly';
            ELSE
                RAISE NOTICE '✗ TRANSFER VERIFICATION FAILED: Expected %, got %', 
                             initial_inventory.qty_full + test_qty, final_inventory.qty_full;
            END IF;
            
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '✗ Transfer failed: %', SQLERRM;
        END;
        
    ELSE
        RAISE NOTICE 'Skipping transfer test - missing test data:';
        RAISE NOTICE 'Warehouse: %, Truck: %, Product: %', test_warehouse_id, test_truck_id, test_product_id;
    END IF;
END $$;

-- Test 3: Verify capacity calculation includes inventory
\echo ''
\echo 'TEST 3: Capacity Calculation Verification'
\echo '========================================'

-- Create a function to test the capacity calculation logic
CREATE OR REPLACE FUNCTION test_truck_capacity_calculation(p_truck_id UUID)
RETURNS TABLE(
    truck_id UUID,
    fleet_number TEXT,
    capacity_cylinders INTEGER,
    total_capacity_kg NUMERIC,
    inventory_cylinders NUMERIC,
    inventory_weight_kg NUMERIC,
    allocation_weight_kg NUMERIC,
    calculated_utilization NUMERIC
) AS $$
DECLARE
    truck_rec RECORD;
    total_inventory_weight NUMERIC := 0;
    total_allocation_weight NUMERIC := 0;
    today_date TEXT := CURRENT_DATE::TEXT;
BEGIN
    -- Get truck details
    SELECT * INTO truck_rec FROM truck WHERE id = p_truck_id;
    
    -- Calculate inventory weight using the same logic as backend
    SELECT 
        COALESCE(SUM(
            CASE 
                WHEN p.capacity_kg IS NOT NULL AND p.tare_weight_kg IS NOT NULL THEN
                    (ti.qty_full * (p.capacity_kg + p.tare_weight_kg)) + (ti.qty_empty * p.tare_weight_kg)
                ELSE
                    (ti.qty_full * 27) + (ti.qty_empty * 14)
            END
        ), 0),
        COALESCE(SUM(ti.qty_full + ti.qty_empty), 0)
    INTO total_inventory_weight, inventory_cylinders
    FROM truck_inventory ti
    LEFT JOIN products p ON ti.product_id = p.id
    WHERE ti.truck_id = p_truck_id;
    
    -- Calculate allocation weight for today
    SELECT COALESCE(SUM(ta.estimated_weight_kg), 0)
    INTO total_allocation_weight
    FROM truck_allocations ta
    WHERE ta.truck_id = p_truck_id 
      AND ta.allocation_date = today_date
      AND ta.status != 'cancelled';
    
    -- Return the calculated values
    RETURN QUERY SELECT
        p_truck_id,
        truck_rec.fleet_number,
        truck_rec.capacity_cylinders,
        (truck_rec.capacity_cylinders * 27)::NUMERIC as total_capacity_kg,
        inventory_cylinders,
        total_inventory_weight,
        total_allocation_weight,
        CASE 
            WHEN truck_rec.capacity_cylinders > 0 THEN
                (GREATEST(total_inventory_weight, total_allocation_weight) / (truck_rec.capacity_cylinders * 27) * 100)
            ELSE 0
        END as calculated_utilization;
END;
$$ LANGUAGE plpgsql;

-- Test capacity calculation for active trucks
SELECT 
    'Capacity Calculation Test' as section,
    *
FROM test_truck_capacity_calculation(t.id)
FROM truck t 
WHERE t.active = true
ORDER BY fleet_number
LIMIT 5;

-- Test 4: Check recent transfers to trucks
\echo ''
\echo 'TEST 4: Recent Transfers to Trucks Analysis'
\echo '========================================'

-- Check completed transfers to trucks
SELECT 
    'Recent Transfers to Trucks' as section,
    t.id as transfer_id,
    t.transfer_reference,
    t.status,
    sw.name as source_warehouse,
    CASE 
        WHEN EXISTS (SELECT 1 FROM truck WHERE id = t.destination_warehouse_id) THEN 
            (SELECT fleet_number FROM truck WHERE id = t.destination_warehouse_id)
        ELSE 'NOT A TRUCK'
    END as destination_truck,
    t.total_quantity,
    t.total_weight_kg,
    t.completed_date,
    -- Check if truck inventory was updated
    CASE 
        WHEN EXISTS (SELECT 1 FROM truck WHERE id = t.destination_warehouse_id) THEN
            COALESCE((
                SELECT SUM(qty_full + qty_empty) 
                FROM truck_inventory 
                WHERE truck_id = t.destination_warehouse_id
            ), 0)
        ELSE NULL
    END as current_truck_inventory_total
FROM transfers t
LEFT JOIN warehouses sw ON t.source_warehouse_id = sw.id
WHERE t.status = 'completed'
  AND EXISTS (SELECT 1 FROM truck WHERE id = t.destination_warehouse_id)
ORDER BY t.completed_date DESC
LIMIT 10;

-- Test 5: Verify stock movements for truck transfers
\echo ''
\echo 'TEST 5: Stock Movement Audit Trail'
\echo '================================'

SELECT 
    'Stock Movements for Truck Transfers' as section,
    sm.id,
    sm.movement_type,
    sm.qty_full_change,
    sm.qty_empty_change,
    sm.reason,
    sm.reference_type,
    sm.created_at
FROM stock_movements sm
WHERE sm.reference_type IN ('transfer', 'truck_transfer')
  AND sm.reason LIKE '%truck%'
ORDER BY sm.created_at DESC
LIMIT 10;

-- Cleanup test function
DROP FUNCTION IF EXISTS test_truck_capacity_calculation(UUID);

\echo ''
\echo '========================================'
\echo 'TEST COMPLETED'
\echo 'Review the results above to verify:'
\echo '1. Truck inventory is properly tracked'
\echo '2. Transfers to trucks update inventory'
\echo '3. Capacity calculations include inventory'
\echo '4. Stock movements are logged correctly'
\echo '========================================'