-- Test script to verify transfer functions work correctly after the fix
-- This script tests the transfer_stock function and validates inventory updates

BEGIN;

-- Clean up any existing test data
DELETE FROM stock_movements WHERE reason LIKE '%TEST%';
DELETE FROM inventory_balance WHERE warehouse_id IN (
    SELECT id FROM warehouses WHERE name LIKE '%TEST%'
);
DELETE FROM warehouses WHERE name LIKE '%TEST%';
DELETE FROM products WHERE sku LIKE '%TEST%';

-- Create test warehouses
INSERT INTO warehouses (id, name, location, is_active) VALUES
    ('11111111-1111-1111-1111-111111111111', 'TEST_WAREHOUSE_A', 'Test Location A', true),
    ('22222222-2222-2222-2222-222222222222', 'TEST_WAREHOUSE_B', 'Test Location B', true);

-- Create test product
INSERT INTO products (id, sku, name, capacity_kg, tare_weight_kg, variant_type, status, unit_of_measure, requires_tag, is_variant) VALUES
    ('33333333-3333-3333-3333-333333333333', 'TEST_CYLINDER', 'Test Cylinder 6kg', 6, 10, 'cylinder', 'active', 'cylinder', false, false);

-- Create initial inventory in warehouse A
INSERT INTO inventory_balance (warehouse_id, product_id, qty_full, qty_empty, qty_reserved) VALUES
    ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 100, 50, 10);

-- Show initial state
SELECT 
    'INITIAL STATE' as test_phase,
    w.name as warehouse_name,
    p.sku as product_sku,
    ib.qty_full,
    ib.qty_empty,
    ib.qty_reserved
FROM inventory_balance ib
JOIN warehouses w ON ib.warehouse_id = w.id
JOIN products p ON ib.product_id = p.id
WHERE w.name LIKE '%TEST%'
ORDER BY w.name;

-- Test 1: Valid transfer from warehouse A to warehouse B
SELECT 'TEST 1: Valid transfer (20 full cylinders)' as test_name;

SELECT transfer_stock(
    '11111111-1111-1111-1111-111111111111'::uuid,  -- from warehouse A
    '22222222-2222-2222-2222-222222222222'::uuid,  -- to warehouse B
    '33333333-3333-3333-3333-333333333333'::uuid,  -- product
    20,  -- qty_full
    0    -- qty_empty
) as transfer_result;

-- Show state after transfer
SELECT 
    'AFTER TRANSFER' as test_phase,
    w.name as warehouse_name,
    p.sku as product_sku,
    ib.qty_full,
    ib.qty_empty,
    ib.qty_reserved
FROM inventory_balance ib
JOIN warehouses w ON ib.warehouse_id = w.id
JOIN products p ON ib.product_id = p.id
WHERE w.name LIKE '%TEST%'
ORDER BY w.name;

-- Test 2: Check stock movements were logged
SELECT 
    'STOCK MOVEMENTS' as test_phase,
    sm.movement_type,
    sm.qty_full_change,
    sm.qty_empty_change,
    sm.reason
FROM stock_movements sm
JOIN inventory_balance ib ON sm.inventory_id = ib.id
JOIN warehouses w ON ib.warehouse_id = w.id
WHERE w.name LIKE '%TEST%'
ORDER BY sm.created_at;

-- Test 3: Attempt invalid transfer (too much stock)
SELECT 'TEST 3: Invalid transfer (excessive quantity)' as test_name;

SELECT transfer_stock(
    '11111111-1111-1111-1111-111111111111'::uuid,  -- from warehouse A
    '22222222-2222-2222-2222-222222222222'::uuid,  -- to warehouse B
    '33333333-3333-3333-3333-333333333333'::uuid,  -- product
    200,  -- qty_full (more than available)
    0     -- qty_empty
) as invalid_transfer_result;

-- Test 4: Validation function
SELECT 'TEST 4: Validation function' as test_name;

SELECT validate_transfer_request(
    '11111111-1111-1111-1111-111111111111'::uuid,  -- from warehouse A
    '22222222-2222-2222-2222-222222222222'::uuid,  -- to warehouse B
    '33333333-3333-3333-3333-333333333333'::uuid,  -- product
    30,  -- qty_full
    0    -- qty_empty
) as validation_result;

-- Clean up test data
DELETE FROM stock_movements WHERE reason LIKE '%TEST%';
DELETE FROM inventory_balance WHERE warehouse_id IN (
    SELECT id FROM warehouses WHERE name LIKE '%TEST%'
);
DELETE FROM warehouses WHERE name LIKE '%TEST%';
DELETE FROM products WHERE sku LIKE '%TEST%';

COMMIT;