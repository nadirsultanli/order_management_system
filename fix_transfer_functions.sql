-- =====================================================
-- FIX TRANSFER SYSTEM FUNCTIONS
-- =====================================================
-- This script implements PROMPT 2 exactly as specified
-- Creates/fixes all transfer functions with comprehensive error handling

-- =====================================================
-- STEP 1: CHECK EXISTING TRANSFER FUNCTIONS
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '     TRANSFER FUNCTIONS DIAGNOSTIC     ';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    
    RAISE NOTICE '⚙️  CHECKING EXISTING TRANSFER FUNCTIONS:';
    
    -- Check transfer_stock_to_truck
    IF EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'transfer_stock_to_truck' AND routine_schema = 'public') THEN
        RAISE NOTICE '  ✅ transfer_stock_to_truck exists';
    ELSE
        RAISE NOTICE '  ❌ transfer_stock_to_truck MISSING';
    END IF;
    
    -- Check transfer_stock_from_truck
    IF EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'transfer_stock_from_truck' AND routine_schema = 'public') THEN
        RAISE NOTICE '  ✅ transfer_stock_from_truck exists';
    ELSE
        RAISE NOTICE '  ❌ transfer_stock_from_truck MISSING';
    END IF;
    
    -- Check transfer_stock
    IF EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'transfer_stock' AND routine_schema = 'public') THEN
        RAISE NOTICE '  ✅ transfer_stock exists';
    ELSE
        RAISE NOTICE '  ❌ transfer_stock MISSING';
    END IF;
    
    RAISE NOTICE '';
END $$;

-- =====================================================
-- STEP 2: CREATE STOCK_MOVEMENTS TABLE IF MISSING
-- =====================================================

CREATE TABLE IF NOT EXISTS stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inventory_id UUID,
    truck_inventory_id UUID,
    movement_type TEXT NOT NULL CHECK (movement_type IN ('adjustment', 'transfer_in', 'transfer_out', 'truck_load', 'truck_unload', 'order_reserve', 'order_fulfill', 'order_cancel')),
    qty_full_change NUMERIC NOT NULL,
    qty_empty_change NUMERIC NOT NULL,
    reason TEXT,
    reference_id UUID,
    reference_type TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID
);

-- =====================================================
-- STEP 3: DROP EXISTING FUNCTIONS AND RECREATE
-- =====================================================

-- Drop existing functions
DROP FUNCTION IF EXISTS transfer_stock_to_truck(UUID, UUID, UUID, NUMERIC, NUMERIC);
DROP FUNCTION IF EXISTS transfer_stock_from_truck(UUID, UUID, UUID, NUMERIC, NUMERIC);
DROP FUNCTION IF EXISTS transfer_stock(UUID, UUID, UUID, NUMERIC, NUMERIC);

-- =====================================================
-- STEP 4: CREATE transfer_stock_to_truck FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION transfer_stock_to_truck(
    p_from_warehouse_id UUID,
    p_to_truck_id UUID,
    p_product_id UUID,
    p_qty_full NUMERIC,
    p_qty_empty NUMERIC
) RETURNS JSON AS $$
DECLARE
    warehouse_record RECORD;
    truck_record RECORD;
    product_record RECORD;
    result JSON;
    movement_id UUID;
BEGIN
    -- Detailed logging for debugging
    RAISE NOTICE 'Starting transfer_stock_to_truck:';
    RAISE NOTICE '  From warehouse: %', p_from_warehouse_id;
    RAISE NOTICE '  To truck: %', p_to_truck_id;
    RAISE NOTICE '  Product: %', p_product_id;
    RAISE NOTICE '  Qty full: %, Qty empty: %', p_qty_full, p_qty_empty;
    
    -- Input validation
    IF p_qty_full < 0 THEN
        RAISE EXCEPTION 'Full quantity cannot be negative (received: %)', p_qty_full;
    END IF;
    
    IF p_qty_empty < 0 THEN
        RAISE EXCEPTION 'Empty quantity cannot be negative (received: %)', p_qty_empty;
    END IF;
    
    IF p_qty_full = 0 AND p_qty_empty = 0 THEN
        RAISE EXCEPTION 'Transfer quantities cannot both be zero';
    END IF;
    
    -- Validate warehouse exists
    SELECT * INTO warehouse_record 
    FROM warehouses 
    WHERE id = p_from_warehouse_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Source warehouse not found (ID: %)', p_from_warehouse_id;
    END IF;
    
    RAISE NOTICE '  ✅ Warehouse validated: %', warehouse_record.name;
    
    -- Validate truck exists and is active
    SELECT * INTO truck_record 
    FROM truck 
    WHERE id = p_to_truck_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Destination truck not found (ID: %)', p_to_truck_id;
    END IF;
    
    IF NOT truck_record.active THEN
        RAISE EXCEPTION 'Destination truck is not active (Fleet: %)', truck_record.fleet_number;
    END IF;
    
    RAISE NOTICE '  ✅ Truck validated: %', truck_record.fleet_number;
    
    -- Validate product exists
    SELECT * INTO product_record 
    FROM products 
    WHERE id = p_product_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Product not found (ID: %)', p_product_id;
    END IF;
    
    RAISE NOTICE '  ✅ Product validated: %', product_record.name;
    
    -- Get and lock source inventory
    SELECT * INTO warehouse_record 
    FROM inventory_balance 
    WHERE warehouse_id = p_from_warehouse_id AND product_id = p_product_id 
    FOR UPDATE;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Product not available in warehouse inventory (Product: %, Warehouse: %)', product_record.name, warehouse_record.name;
    END IF;
    
    RAISE NOTICE '  ✅ Warehouse inventory locked. Available - Full: %, Empty: %', warehouse_record.qty_full, warehouse_record.qty_empty;
    
    -- Check sufficient stock
    IF warehouse_record.qty_full < p_qty_full THEN
        RAISE EXCEPTION 'Insufficient full stock in warehouse. Available: %, Requested: % (Product: %)', 
                       warehouse_record.qty_full, p_qty_full, product_record.name;
    END IF;
    
    IF warehouse_record.qty_empty < p_qty_empty THEN
        RAISE EXCEPTION 'Insufficient empty stock in warehouse. Available: %, Requested: % (Product: %)', 
                       warehouse_record.qty_empty, p_qty_empty, product_record.name;
    END IF;
    
    -- Check truck capacity (basic validation - 27kg per full cylinder)
    DECLARE
        current_truck_load NUMERIC;
        transfer_weight NUMERIC;
        truck_capacity_kg NUMERIC;
    BEGIN
        SELECT COALESCE(SUM((qty_full * 27) + (qty_empty * 14)), 0) INTO current_truck_load
        FROM truck_inventory ti
        JOIN products p ON ti.product_id = p.id
        WHERE ti.truck_id = p_to_truck_id;
        
        transfer_weight := (p_qty_full * 27) + (p_qty_empty * 14);
        truck_capacity_kg := truck_record.capacity_cylinders * 27;
        
        RAISE NOTICE '  📊 Capacity check - Current: %kg, Transfer: %kg, Capacity: %kg', 
                    current_truck_load, transfer_weight, truck_capacity_kg;
        
        IF (current_truck_load + transfer_weight) > truck_capacity_kg THEN
            RAISE EXCEPTION 'Transfer would exceed truck capacity. Current: %kg, Transfer: %kg, Capacity: %kg', 
                           current_truck_load, transfer_weight, truck_capacity_kg;
        END IF;
    END;
    
    -- Update warehouse inventory (decrease)
    UPDATE inventory_balance 
    SET 
        qty_full = qty_full - p_qty_full,
        qty_empty = qty_empty - p_qty_empty,
        updated_at = NOW()
    WHERE warehouse_id = p_from_warehouse_id AND product_id = p_product_id;
    
    RAISE NOTICE '  ✅ Warehouse inventory decreased';
    
    -- Update or insert truck inventory (increase)
    INSERT INTO truck_inventory (truck_id, product_id, qty_full, qty_empty, updated_at)
    VALUES (p_to_truck_id, p_product_id, p_qty_full, p_qty_empty, NOW())
    ON CONFLICT (truck_id, product_id) 
    DO UPDATE SET 
        qty_full = truck_inventory.qty_full + p_qty_full,
        qty_empty = truck_inventory.qty_empty + p_qty_empty,
        updated_at = NOW();
    
    RAISE NOTICE '  ✅ Truck inventory increased';
    
    -- Create audit record
    INSERT INTO stock_movements (
        inventory_id, 
        movement_type, 
        qty_full_change, 
        qty_empty_change, 
        reason, 
        reference_type,
        created_at
    ) VALUES (
        warehouse_record.id, 
        'truck_load', 
        -p_qty_full, 
        -p_qty_empty, 
        format('Transfer to truck %s', truck_record.fleet_number),
        'transfer',
        NOW()
    ) RETURNING id INTO movement_id;
    
    RAISE NOTICE '  ✅ Audit record created: %', movement_id;
    
    -- Build success result
    result := json_build_object(
        'success', true,
        'message', format('Successfully transferred %s full + %s empty cylinders of %s from warehouse to truck %s', 
                         p_qty_full, p_qty_empty, product_record.name, truck_record.fleet_number),
        'transfer_details', json_build_object(
            'from_warehouse_id', p_from_warehouse_id,
            'from_warehouse_name', warehouse_record.name,
            'to_truck_id', p_to_truck_id,
            'to_truck_fleet_number', truck_record.fleet_number,
            'product_id', p_product_id,
            'product_name', product_record.name,
            'qty_full_transferred', p_qty_full,
            'qty_empty_transferred', p_qty_empty,
            'total_cylinders', p_qty_full + p_qty_empty,
            'movement_id', movement_id,
            'timestamp', NOW()
        )
    );
    
    RAISE NOTICE '  🎉 Transfer completed successfully';
    
    RETURN result;
    
EXCEPTION WHEN OTHERS THEN
    -- Detailed error logging
    RAISE NOTICE '  ❌ Transfer failed: %', SQLERRM;
    RAISE EXCEPTION 'Transfer to truck failed: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- STEP 5: CREATE transfer_stock_from_truck FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION transfer_stock_from_truck(
    p_from_truck_id UUID,
    p_to_warehouse_id UUID,
    p_product_id UUID,
    p_qty_full NUMERIC,
    p_qty_empty NUMERIC
) RETURNS JSON AS $$
DECLARE
    truck_record RECORD;
    warehouse_record RECORD;
    product_record RECORD;
    truck_inventory_record RECORD;
    result JSON;
    movement_id UUID;
BEGIN
    -- Detailed logging
    RAISE NOTICE 'Starting transfer_stock_from_truck:';
    RAISE NOTICE '  From truck: %', p_from_truck_id;
    RAISE NOTICE '  To warehouse: %', p_to_warehouse_id;
    RAISE NOTICE '  Product: %', p_product_id;
    RAISE NOTICE '  Qty full: %, Qty empty: %', p_qty_full, p_qty_empty;
    
    -- Input validation
    IF p_qty_full < 0 OR p_qty_empty < 0 THEN
        RAISE EXCEPTION 'Transfer quantities cannot be negative. Full: %, Empty: %', p_qty_full, p_qty_empty;
    END IF;
    
    IF p_qty_full = 0 AND p_qty_empty = 0 THEN
        RAISE EXCEPTION 'Transfer quantities cannot both be zero';
    END IF;
    
    -- Validate truck exists and is active
    SELECT * INTO truck_record 
    FROM truck 
    WHERE id = p_from_truck_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Source truck not found (ID: %)', p_from_truck_id;
    END IF;
    
    RAISE NOTICE '  ✅ Truck validated: %', truck_record.fleet_number;
    
    -- Validate warehouse exists
    SELECT * INTO warehouse_record 
    FROM warehouses 
    WHERE id = p_to_warehouse_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Destination warehouse not found (ID: %)', p_to_warehouse_id;
    END IF;
    
    RAISE NOTICE '  ✅ Warehouse validated: %', warehouse_record.name;
    
    -- Validate product exists
    SELECT * INTO product_record 
    FROM products 
    WHERE id = p_product_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Product not found (ID: %)', p_product_id;
    END IF;
    
    RAISE NOTICE '  ✅ Product validated: %', product_record.name;
    
    -- Get and lock truck inventory
    SELECT * INTO truck_inventory_record 
    FROM truck_inventory 
    WHERE truck_id = p_from_truck_id AND product_id = p_product_id 
    FOR UPDATE;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Product not available in truck inventory (Product: %, Truck: %)', 
                       product_record.name, truck_record.fleet_number;
    END IF;
    
    RAISE NOTICE '  ✅ Truck inventory locked. Available - Full: %, Empty: %', 
                truck_inventory_record.qty_full, truck_inventory_record.qty_empty;
    
    -- Check sufficient stock
    IF truck_inventory_record.qty_full < p_qty_full THEN
        RAISE EXCEPTION 'Insufficient full stock in truck. Available: %, Requested: % (Product: %)', 
                       truck_inventory_record.qty_full, p_qty_full, product_record.name;
    END IF;
    
    IF truck_inventory_record.qty_empty < p_qty_empty THEN
        RAISE EXCEPTION 'Insufficient empty stock in truck. Available: %, Requested: % (Product: %)', 
                       truck_inventory_record.qty_empty, p_qty_empty, product_record.name;
    END IF;
    
    -- Update truck inventory (decrease)
    UPDATE truck_inventory 
    SET 
        qty_full = qty_full - p_qty_full,
        qty_empty = qty_empty - p_qty_empty,
        updated_at = NOW()
    WHERE truck_id = p_from_truck_id AND product_id = p_product_id;
    
    RAISE NOTICE '  ✅ Truck inventory decreased';
    
    -- Update or insert warehouse inventory (increase)
    INSERT INTO inventory_balance (warehouse_id, product_id, qty_full, qty_empty, qty_reserved, updated_at, created_at)
    VALUES (p_to_warehouse_id, p_product_id, p_qty_full, p_qty_empty, 0, NOW(), NOW())
    ON CONFLICT (warehouse_id, product_id) 
    DO UPDATE SET 
        qty_full = inventory_balance.qty_full + p_qty_full,
        qty_empty = inventory_balance.qty_empty + p_qty_empty,
        updated_at = NOW();
    
    RAISE NOTICE '  ✅ Warehouse inventory increased';
    
    -- Create audit record
    INSERT INTO stock_movements (
        truck_inventory_id, 
        movement_type, 
        qty_full_change, 
        qty_empty_change, 
        reason, 
        reference_type,
        created_at
    ) VALUES (
        truck_inventory_record.id, 
        'truck_unload', 
        -p_qty_full, 
        -p_qty_empty, 
        format('Transfer from truck %s to warehouse %s', truck_record.fleet_number, warehouse_record.name),
        'transfer',
        NOW()
    ) RETURNING id INTO movement_id;
    
    RAISE NOTICE '  ✅ Audit record created: %', movement_id;
    
    -- Build success result
    result := json_build_object(
        'success', true,
        'message', format('Successfully transferred %s full + %s empty cylinders of %s from truck %s to warehouse', 
                         p_qty_full, p_qty_empty, product_record.name, truck_record.fleet_number),
        'transfer_details', json_build_object(
            'from_truck_id', p_from_truck_id,
            'from_truck_fleet_number', truck_record.fleet_number,
            'to_warehouse_id', p_to_warehouse_id,
            'to_warehouse_name', warehouse_record.name,
            'product_id', p_product_id,
            'product_name', product_record.name,
            'qty_full_transferred', p_qty_full,
            'qty_empty_transferred', p_qty_empty,
            'total_cylinders', p_qty_full + p_qty_empty,
            'movement_id', movement_id,
            'timestamp', NOW()
        )
    );
    
    RAISE NOTICE '  🎉 Transfer completed successfully';
    
    RETURN result;
    
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '  ❌ Transfer failed: %', SQLERRM;
    RAISE EXCEPTION 'Transfer from truck failed: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- STEP 6: CREATE transfer_stock FUNCTION (WAREHOUSE TO WAREHOUSE)
-- =====================================================

CREATE OR REPLACE FUNCTION transfer_stock(
    p_from_warehouse_id UUID,
    p_to_warehouse_id UUID,
    p_product_id UUID,
    p_qty_full NUMERIC,
    p_qty_empty NUMERIC
) RETURNS JSON AS $$
DECLARE
    from_warehouse_record RECORD;
    to_warehouse_record RECORD;
    product_record RECORD;
    source_inventory_record RECORD;
    result JSON;
    movement_id UUID;
BEGIN
    -- Detailed logging
    RAISE NOTICE 'Starting transfer_stock:';
    RAISE NOTICE '  From warehouse: %', p_from_warehouse_id;
    RAISE NOTICE '  To warehouse: %', p_to_warehouse_id;
    RAISE NOTICE '  Product: %', p_product_id;
    RAISE NOTICE '  Qty full: %, Qty empty: %', p_qty_full, p_qty_empty;
    
    -- Input validation
    IF p_qty_full < 0 OR p_qty_empty < 0 THEN
        RAISE EXCEPTION 'Transfer quantities cannot be negative. Full: %, Empty: %', p_qty_full, p_qty_empty;
    END IF;
    
    IF p_qty_full = 0 AND p_qty_empty = 0 THEN
        RAISE EXCEPTION 'Transfer quantities cannot both be zero';
    END IF;
    
    IF p_from_warehouse_id = p_to_warehouse_id THEN
        RAISE EXCEPTION 'Source and destination warehouses cannot be the same';
    END IF;
    
    -- Validate source warehouse
    SELECT * INTO from_warehouse_record 
    FROM warehouses 
    WHERE id = p_from_warehouse_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Source warehouse not found (ID: %)', p_from_warehouse_id;
    END IF;
    
    RAISE NOTICE '  ✅ Source warehouse validated: %', from_warehouse_record.name;
    
    -- Validate destination warehouse
    SELECT * INTO to_warehouse_record 
    FROM warehouses 
    WHERE id = p_to_warehouse_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Destination warehouse not found (ID: %)', p_to_warehouse_id;
    END IF;
    
    RAISE NOTICE '  ✅ Destination warehouse validated: %', to_warehouse_record.name;
    
    -- Validate product
    SELECT * INTO product_record 
    FROM products 
    WHERE id = p_product_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Product not found (ID: %)', p_product_id;
    END IF;
    
    RAISE NOTICE '  ✅ Product validated: %', product_record.name;
    
    -- Get and lock source inventory
    SELECT * INTO source_inventory_record 
    FROM inventory_balance 
    WHERE warehouse_id = p_from_warehouse_id AND product_id = p_product_id 
    FOR UPDATE;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Product not available in source warehouse inventory (Product: %, Warehouse: %)', 
                       product_record.name, from_warehouse_record.name;
    END IF;
    
    RAISE NOTICE '  ✅ Source inventory locked. Available - Full: %, Empty: %', 
                source_inventory_record.qty_full, source_inventory_record.qty_empty;
    
    -- Check sufficient stock
    IF source_inventory_record.qty_full < p_qty_full THEN
        RAISE EXCEPTION 'Insufficient full stock in source warehouse. Available: %, Requested: % (Product: %)', 
                       source_inventory_record.qty_full, p_qty_full, product_record.name;
    END IF;
    
    IF source_inventory_record.qty_empty < p_qty_empty THEN
        RAISE EXCEPTION 'Insufficient empty stock in source warehouse. Available: %, Requested: % (Product: %)', 
                       source_inventory_record.qty_empty, p_qty_empty, product_record.name;
    END IF;
    
    -- Update source warehouse inventory (decrease)
    UPDATE inventory_balance 
    SET 
        qty_full = qty_full - p_qty_full,
        qty_empty = qty_empty - p_qty_empty,
        updated_at = NOW()
    WHERE warehouse_id = p_from_warehouse_id AND product_id = p_product_id;
    
    RAISE NOTICE '  ✅ Source warehouse inventory decreased';
    
    -- Update or insert destination warehouse inventory (increase)
    INSERT INTO inventory_balance (warehouse_id, product_id, qty_full, qty_empty, qty_reserved, updated_at, created_at)
    VALUES (p_to_warehouse_id, p_product_id, p_qty_full, p_qty_empty, 0, NOW(), NOW())
    ON CONFLICT (warehouse_id, product_id) 
    DO UPDATE SET 
        qty_full = inventory_balance.qty_full + p_qty_full,
        qty_empty = inventory_balance.qty_empty + p_qty_empty,
        updated_at = NOW();
    
    RAISE NOTICE '  ✅ Destination warehouse inventory increased';
    
    -- Create audit record for source
    INSERT INTO stock_movements (
        inventory_id, 
        movement_type, 
        qty_full_change, 
        qty_empty_change, 
        reason, 
        reference_type,
        created_at
    ) VALUES (
        source_inventory_record.id, 
        'transfer_out', 
        -p_qty_full, 
        -p_qty_empty, 
        format('Transfer from %s to %s', from_warehouse_record.name, to_warehouse_record.name),
        'transfer',
        NOW()
    ) RETURNING id INTO movement_id;
    
    RAISE NOTICE '  ✅ Audit record created: %', movement_id;
    
    -- Build success result
    result := json_build_object(
        'success', true,
        'message', format('Successfully transferred %s full + %s empty cylinders of %s from %s to %s', 
                         p_qty_full, p_qty_empty, product_record.name, 
                         from_warehouse_record.name, to_warehouse_record.name),
        'transfer_details', json_build_object(
            'from_warehouse_id', p_from_warehouse_id,
            'from_warehouse_name', from_warehouse_record.name,
            'to_warehouse_id', p_to_warehouse_id,
            'to_warehouse_name', to_warehouse_record.name,
            'product_id', p_product_id,
            'product_name', product_record.name,
            'qty_full_transferred', p_qty_full,
            'qty_empty_transferred', p_qty_empty,
            'total_cylinders', p_qty_full + p_qty_empty,
            'movement_id', movement_id,
            'timestamp', NOW()
        )
    );
    
    RAISE NOTICE '  🎉 Transfer completed successfully';
    
    RETURN result;
    
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '  ❌ Transfer failed: %', SQLERRM;
    RAISE EXCEPTION 'Warehouse transfer failed: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- STEP 7: GRANT PERMISSIONS
-- =====================================================

GRANT EXECUTE ON FUNCTION transfer_stock_to_truck(UUID, UUID, UUID, NUMERIC, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION transfer_stock_from_truck(UUID, UUID, UUID, NUMERIC, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION transfer_stock(UUID, UUID, UUID, NUMERIC, NUMERIC) TO authenticated;

-- =====================================================
-- STEP 8: TEST QUERIES TO VERIFY FUNCTIONS WORK
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '      TRANSFER FUNCTIONS VERIFICATION  ';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    
    -- Verify all functions exist
    IF EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'transfer_stock_to_truck' AND routine_schema = 'public') THEN
        RAISE NOTICE '✅ transfer_stock_to_truck function created successfully';
    ELSE
        RAISE NOTICE '❌ transfer_stock_to_truck function FAILED to create';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'transfer_stock_from_truck' AND routine_schema = 'public') THEN
        RAISE NOTICE '✅ transfer_stock_from_truck function created successfully';
    ELSE
        RAISE NOTICE '❌ transfer_stock_from_truck function FAILED to create';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'transfer_stock' AND routine_schema = 'public') THEN
        RAISE NOTICE '✅ transfer_stock function created successfully';
    ELSE
        RAISE NOTICE '❌ transfer_stock function FAILED to create';
    END IF;
    
    -- Test function signatures
    RAISE NOTICE '';
    RAISE NOTICE '📋 FUNCTION SIGNATURES:';
    FOR rec IN 
        SELECT routine_name, 
               array_to_string(array_agg(parameter_mode || ' ' || parameter_name || ' ' || udt_name ORDER BY ordinal_position), ', ') as parameters
        FROM information_schema.parameters 
        WHERE specific_schema = 'public' 
          AND routine_name IN ('transfer_stock_to_truck', 'transfer_stock_from_truck', 'transfer_stock')
        GROUP BY routine_name
        ORDER BY routine_name
    LOOP
        RAISE NOTICE '  %(%)', rec.routine_name, rec.parameters;
    END LOOP;
    
    RAISE NOTICE '';
    RAISE NOTICE '🎉 TRANSFER FUNCTIONS SETUP COMPLETED! 🎉';
    RAISE NOTICE '';
    RAISE NOTICE 'Functions now available:';
    RAISE NOTICE '✅ transfer_stock_to_truck(warehouse_id, truck_id, product_id, qty_full, qty_empty)';
    RAISE NOTICE '✅ transfer_stock_from_truck(truck_id, warehouse_id, product_id, qty_full, qty_empty)';
    RAISE NOTICE '✅ transfer_stock(from_warehouse_id, to_warehouse_id, product_id, qty_full, qty_empty)';
    RAISE NOTICE '';
    RAISE NOTICE 'Features included:';
    RAISE NOTICE '✅ Comprehensive input validation';
    RAISE NOTICE '✅ Detailed error messages (no more [object Object])';
    RAISE NOTICE '✅ Atomic transactions with rollback';
    RAISE NOTICE '✅ Capacity validation for trucks';
    RAISE NOTICE '✅ Audit trail in stock_movements table';
    RAISE NOTICE '✅ Detailed logging for debugging';
    RAISE NOTICE '';
END $$;