-- Test script to verify truck transfer and capacity calculation issues
-- This script tests the transfer to truck functionality and capacity calculations

-- First, let's check current state of trucks and inventory
SELECT 
    'Current Trucks' as test_section,
    t.id,
    t.fleet_number,
    t.license_plate,
    t.capacity_cylinders,
    t.active
FROM truck t
ORDER BY t.fleet_number
LIMIT 5;

-- Check truck inventory
SELECT 
    'Current Truck Inventory' as test_section,
    ti.truck_id,
    t.fleet_number,
    ti.product_id,
    p.name as product_name,
    ti.qty_full,
    ti.qty_empty,
    ti.updated_at
FROM truck_inventory ti
JOIN truck t ON ti.truck_id = t.id
LEFT JOIN products p ON ti.product_id = p.id
ORDER BY t.fleet_number, p.name
LIMIT 10;

-- Check warehouse inventory for potential transfers
SELECT 
    'Available Warehouse Stock' as test_section,
    ib.warehouse_id,
    w.name as warehouse_name,
    ib.product_id,
    p.name as product_name,
    ib.qty_full,
    ib.qty_empty,
    ib.qty_reserved
FROM inventory_balance ib
JOIN warehouses w ON ib.warehouse_id = w.id
LEFT JOIN products p ON ib.product_id = p.id
WHERE ib.qty_full > 0
ORDER BY w.name, p.name
LIMIT 10;

-- Check transfers that should have been completed to trucks
SELECT 
    'Recent Transfers to Trucks' as test_section,
    t.id as transfer_id,
    t.transfer_reference,
    t.status,
    t.source_warehouse_id,
    sw.name as source_warehouse,
    t.destination_warehouse_id,
    -- Check if destination is a truck
    CASE 
        WHEN EXISTS (SELECT 1 FROM truck WHERE id = t.destination_warehouse_id) THEN 'TRUCK'
        WHEN EXISTS (SELECT 1 FROM warehouses WHERE id = t.destination_warehouse_id) THEN 'WAREHOUSE'
        ELSE 'UNKNOWN'
    END as destination_type,
    COALESCE(dw.name, dt.fleet_number) as destination_name,
    t.total_quantity,
    t.completed_date
FROM transfers t
LEFT JOIN warehouses sw ON t.source_warehouse_id = sw.id
LEFT JOIN warehouses dw ON t.destination_warehouse_id = dw.id
LEFT JOIN truck dt ON t.destination_warehouse_id = dt.id
WHERE t.status = 'completed'
ORDER BY t.completed_date DESC
LIMIT 10;

-- Test truck capacity calculation for a specific truck
-- First, let's get a truck ID to test with
DO $$
DECLARE
    test_truck_id UUID;
    truck_capacity_info JSONB;
    current_inventory_total NUMERIC := 0;
    capacity_cylinders INTEGER;
    calculated_capacity_kg NUMERIC;
BEGIN
    -- Get first active truck
    SELECT id, capacity_cylinders INTO test_truck_id, capacity_cylinders
    FROM truck 
    WHERE active = true 
    LIMIT 1;
    
    IF test_truck_id IS NOT NULL THEN
        -- Calculate current inventory total
        SELECT COALESCE(SUM(qty_full + qty_empty), 0) INTO current_inventory_total
        FROM truck_inventory 
        WHERE truck_id = test_truck_id;
        
        -- Calculate capacity in kg (27kg per cylinder as per backend code)
        calculated_capacity_kg := capacity_cylinders * 27;
        
        RAISE NOTICE 'Truck Capacity Analysis:';
        RAISE NOTICE 'Truck ID: %', test_truck_id;
        RAISE NOTICE 'Capacity (cylinders): %', capacity_cylinders;
        RAISE NOTICE 'Calculated Capacity (kg): %', calculated_capacity_kg;
        RAISE NOTICE 'Current Inventory Total: % cylinders', current_inventory_total;
        RAISE NOTICE 'Utilization: %/%', current_inventory_total, capacity_cylinders;
        
        -- Check if there are any completed transfers to this truck
        RAISE NOTICE 'Completed transfers to this truck:';
        FOR truck_capacity_info IN 
            SELECT row_to_json(sub)::jsonb FROM (
                SELECT 
                    t.id,
                    t.transfer_reference,
                    t.total_quantity,
                    t.completed_date
                FROM transfers t
                WHERE t.destination_warehouse_id = test_truck_id
                  AND t.status = 'completed'
                ORDER BY t.completed_date DESC
                LIMIT 5
            ) sub
        LOOP
            RAISE NOTICE 'Transfer: %', truck_capacity_info;
        END LOOP;
    END IF;
END $$;

-- Test the transfer_stock_to_truck function with validation
DO $$
DECLARE
    test_warehouse_id UUID;
    test_truck_id UUID;
    test_product_id UUID;
    test_qty NUMERIC := 2;
    transfer_result JSONB;
    validation_result JSONB;
BEGIN
    -- Get test data
    SELECT id INTO test_warehouse_id FROM warehouses WHERE name ILIKE '%main%' OR name ILIKE '%central%' LIMIT 1;
    SELECT id INTO test_truck_id FROM truck WHERE active = true LIMIT 1;
    SELECT product_id INTO test_product_id 
    FROM inventory_balance 
    WHERE warehouse_id = test_warehouse_id AND qty_full >= test_qty 
    LIMIT 1;
    
    IF test_warehouse_id IS NOT NULL AND test_truck_id IS NOT NULL AND test_product_id IS NOT NULL THEN
        RAISE NOTICE 'Testing transfer_stock_to_truck function:';
        RAISE NOTICE 'Warehouse: %, Truck: %, Product: %, Qty: %', 
                     test_warehouse_id, test_truck_id, test_product_id, test_qty;
        
        -- First validate the transfer
        SELECT validate_transfer_request(
            test_warehouse_id,
            test_truck_id, -- This should work even though it's a truck ID, not warehouse ID
            test_product_id,
            test_qty,
            0
        ) INTO validation_result;
        
        RAISE NOTICE 'Validation result: %', validation_result;
        
        -- Only proceed if validation passes
        IF (validation_result->>'is_valid')::boolean THEN
            -- Get inventory before transfer
            RAISE NOTICE 'Inventory before transfer:';
            RAISE NOTICE 'Warehouse stock: %', (
                SELECT row_to_json(sub) FROM (
                    SELECT qty_full, qty_empty, qty_reserved 
                    FROM inventory_balance 
                    WHERE warehouse_id = test_warehouse_id AND product_id = test_product_id
                ) sub
            );
            
            RAISE NOTICE 'Truck stock: %', (
                SELECT COALESCE(row_to_json(sub), '{"qty_full":0,"qty_empty":0}'::json) FROM (
                    SELECT qty_full, qty_empty 
                    FROM truck_inventory 
                    WHERE truck_id = test_truck_id AND product_id = test_product_id
                ) sub
            );
            
            -- Perform the transfer
            SELECT transfer_stock_to_truck(
                test_warehouse_id,
                test_truck_id,
                test_product_id,
                test_qty,
                0
            ) INTO transfer_result;
            
            RAISE NOTICE 'Transfer result: %', transfer_result;
            
            -- Check inventory after transfer
            RAISE NOTICE 'Inventory after transfer:';
            RAISE NOTICE 'Warehouse stock: %', (
                SELECT row_to_json(sub) FROM (
                    SELECT qty_full, qty_empty, qty_reserved 
                    FROM inventory_balance 
                    WHERE warehouse_id = test_warehouse_id AND product_id = test_product_id
                ) sub
            );
            
            RAISE NOTICE 'Truck stock: %', (
                SELECT row_to_json(sub) FROM (
                    SELECT qty_full, qty_empty 
                    FROM truck_inventory 
                    WHERE truck_id = test_truck_id AND product_id = test_product_id
                ) sub
            );
        ELSE
            RAISE NOTICE 'Transfer validation failed, skipping test transfer';
        END IF;
    ELSE
        RAISE NOTICE 'Could not find test data for transfer test';
        RAISE NOTICE 'Warehouse: %, Truck: %, Product: %', test_warehouse_id, test_truck_id, test_product_id;
    END IF;
END $$;