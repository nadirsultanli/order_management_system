-- =============================================================================
-- COMPREHENSIVE TRANSFER SYSTEM FIX - ENHANCED LOGGING
-- =============================================================================
-- This migration adds comprehensive logging to transfer functions
-- to track exactly what happens during transfer execution

BEGIN;

-- Drop existing functions to recreate with logging
DROP FUNCTION IF EXISTS transfer_stock(UUID, UUID, UUID, NUMERIC, NUMERIC);
DROP FUNCTION IF EXISTS transfer_stock_to_truck(UUID, UUID, UUID, NUMERIC, NUMERIC);
DROP FUNCTION IF EXISTS transfer_stock_from_truck(UUID, UUID, UUID, NUMERIC, NUMERIC);
DROP FUNCTION IF EXISTS validate_transfer_request(UUID, UUID, UUID, NUMERIC, NUMERIC);

-- Create enhanced atomic transfer function for warehouse-to-warehouse transfers
CREATE OR REPLACE FUNCTION transfer_stock(
    p_from_warehouse_id UUID,
    p_to_warehouse_id UUID,
    p_product_id UUID,
    p_qty_full NUMERIC,
    p_qty_empty NUMERIC
) RETURNS JSONB AS $$
DECLARE
    source_record RECORD;
    dest_record RECORD;
    result JSONB;
    execution_log TEXT := '';
    start_time TIMESTAMP := NOW();
BEGIN
    execution_log := execution_log || format('TRANSFER_STOCK START: %s | FROM: %s | TO: %s | PRODUCT: %s | QTY_FULL: %s | QTY_EMPTY: %s', 
        start_time, p_from_warehouse_id, p_to_warehouse_id, p_product_id, p_qty_full, p_qty_empty) || E'\n';
    
    -- Input validation
    IF p_from_warehouse_id = p_to_warehouse_id THEN
        execution_log := execution_log || 'ERROR: Source and destination warehouses are the same' || E'\n';
        RAISE EXCEPTION 'Source and destination warehouses must be different';
    END IF;
    
    IF p_qty_full < 0 OR p_qty_empty < 0 THEN
        execution_log := execution_log || 'ERROR: Negative transfer quantities' || E'\n';
        RAISE EXCEPTION 'Transfer quantities cannot be negative';
    END IF;
    
    IF p_qty_full = 0 AND p_qty_empty = 0 THEN
        execution_log := execution_log || 'ERROR: Both quantities are zero' || E'\n';
        RAISE EXCEPTION 'Transfer quantities cannot both be zero';
    END IF;
    
    execution_log := execution_log || 'Input validation passed' || E'\n';

    -- Lock and validate source inventory
    execution_log := execution_log || 'Locking source inventory...' || E'\n';
    SELECT * INTO source_record 
    FROM inventory_balance 
    WHERE warehouse_id = p_from_warehouse_id 
      AND product_id = p_product_id 
    FOR UPDATE;
    
    IF NOT FOUND THEN
        execution_log := execution_log || 'ERROR: Source inventory record not found' || E'\n';
        RAISE EXCEPTION 'Source inventory record not found for warehouse % and product %', 
                       p_from_warehouse_id, p_product_id;
    END IF;
    
    execution_log := execution_log || format('Source inventory locked: FULL=%s, EMPTY=%s, RESERVED=%s', 
        source_record.qty_full, source_record.qty_empty, source_record.qty_reserved) || E'\n';
    
    -- Validate sufficient stock
    IF source_record.qty_full < p_qty_full THEN
        execution_log := execution_log || format('ERROR: Insufficient full stock. Available: %s, Requested: %s', 
            source_record.qty_full, p_qty_full) || E'\n';
        RAISE EXCEPTION 'Insufficient full stock. Available: %, Requested: %', 
                       source_record.qty_full, p_qty_full;
    END IF;
    
    IF source_record.qty_empty < p_qty_empty THEN
        execution_log := execution_log || format('ERROR: Insufficient empty stock. Available: %s, Requested: %s', 
            source_record.qty_empty, p_qty_empty) || E'\n';
        RAISE EXCEPTION 'Insufficient empty stock. Available: %, Requested: %', 
                       source_record.qty_empty, p_qty_empty;
    END IF;
    
    -- Validate transfer won't leave insufficient stock for reservations
    IF (source_record.qty_full - p_qty_full) < source_record.qty_reserved THEN
        execution_log := execution_log || format('ERROR: Transfer would leave insufficient stock for reservations. Reserved: %s, Remaining: %s', 
            source_record.qty_reserved, (source_record.qty_full - p_qty_full)) || E'\n';
        RAISE EXCEPTION 'Transfer would leave insufficient stock for reservations. Reserved: %, Remaining after transfer: %', 
                       source_record.qty_reserved, (source_record.qty_full - p_qty_full);
    END IF;
    
    execution_log := execution_log || 'Stock validation passed' || E'\n';

    -- Lock destination inventory (create if doesn't exist)
    execution_log := execution_log || 'Locking destination inventory...' || E'\n';
    SELECT * INTO dest_record 
    FROM inventory_balance 
    WHERE warehouse_id = p_to_warehouse_id 
      AND product_id = p_product_id 
    FOR UPDATE;
    
    IF NOT FOUND THEN
        execution_log := execution_log || 'Creating destination inventory record...' || E'\n';
        -- Create destination inventory record
        INSERT INTO inventory_balance (
            warehouse_id, 
            product_id, 
            qty_full, 
            qty_empty, 
            qty_reserved
        ) VALUES (
            p_to_warehouse_id, 
            p_product_id, 
            0, 
            0, 
            0
        );
        
        -- Get the newly created record
        SELECT * INTO dest_record 
        FROM inventory_balance 
        WHERE warehouse_id = p_to_warehouse_id 
          AND product_id = p_product_id;
        
        execution_log := execution_log || 'Destination inventory record created' || E'\n';
    ELSE
        execution_log := execution_log || format('Destination inventory found: FULL=%s, EMPTY=%s', 
            dest_record.qty_full, dest_record.qty_empty) || E'\n';
    END IF;

    -- Perform atomic updates
    execution_log := execution_log || 'Performing atomic inventory updates...' || E'\n';
    
    -- Update source inventory (decrease)
    UPDATE inventory_balance 
    SET 
        qty_full = qty_full - p_qty_full,
        qty_empty = qty_empty - p_qty_empty,
        updated_at = NOW()
    WHERE warehouse_id = p_from_warehouse_id 
      AND product_id = p_product_id;
    
    execution_log := execution_log || 'Source inventory updated (decreased)' || E'\n';
    
    -- Update destination inventory (increase)
    UPDATE inventory_balance 
    SET 
        qty_full = qty_full + p_qty_full,
        qty_empty = qty_empty + p_qty_empty,
        updated_at = NOW()
    WHERE warehouse_id = p_to_warehouse_id 
      AND product_id = p_product_id;
    
    execution_log := execution_log || 'Destination inventory updated (increased)' || E'\n';
    
    -- Log the stock movements for audit trail
    execution_log := execution_log || 'Creating audit trail entries...' || E'\n';
    INSERT INTO stock_movements (
        inventory_id,
        movement_type,
        qty_full_change,
        qty_empty_change,
        reason,
        reference_type
    ) VALUES 
    (
        source_record.id,
        'transfer_out',
        -p_qty_full,
        -p_qty_empty,
        'Transfer to warehouse ' || p_to_warehouse_id,
        'transfer'
    ),
    (
        dest_record.id,
        'transfer_in',
        p_qty_full,
        p_qty_empty,
        'Transfer from warehouse ' || p_from_warehouse_id,
        'transfer'
    );
    
    execution_log := execution_log || 'Audit trail entries created' || E'\n';
    
    -- Return success result
    result := jsonb_build_object(
        'success', true,
        'source_warehouse_id', p_from_warehouse_id,
        'destination_warehouse_id', p_to_warehouse_id,
        'product_id', p_product_id,
        'qty_full_transferred', p_qty_full,
        'qty_empty_transferred', p_qty_empty,
        'source_remaining_full', source_record.qty_full - p_qty_full,
        'source_remaining_empty', source_record.qty_empty - p_qty_empty,
        'destination_new_full', dest_record.qty_full + p_qty_full,
        'destination_new_empty', dest_record.qty_empty + p_qty_empty,
        'execution_time_ms', EXTRACT(EPOCH FROM (NOW() - start_time)) * 1000,
        'execution_log', execution_log
    );
    
    execution_log := execution_log || format('TRANSFER_STOCK SUCCESS: Completed in %s ms', 
        EXTRACT(EPOCH FROM (NOW() - start_time)) * 1000) || E'\n';
    
    -- Log successful completion
    RAISE NOTICE 'TRANSFER_STOCK SUCCESS: %', execution_log;
    
    RETURN result;
    
EXCEPTION WHEN OTHERS THEN
    execution_log := execution_log || format('TRANSFER_STOCK ERROR: %s', SQLERRM) || E'\n';
    execution_log := execution_log || format('Error occurred at: %s', NOW()) || E'\n';
    
    -- Log the error
    RAISE NOTICE 'TRANSFER_STOCK ERROR: %', execution_log;
    
    -- Re-raise with detailed error
    RAISE EXCEPTION 'Transfer failed: % | Execution Log: %', SQLERRM, execution_log;
END;
$$ LANGUAGE plpgsql;

-- Create enhanced function for warehouse-to-truck transfers
CREATE OR REPLACE FUNCTION transfer_stock_to_truck(
    p_from_warehouse_id UUID,
    p_to_truck_id UUID,
    p_product_id UUID,
    p_qty_full NUMERIC,
    p_qty_empty NUMERIC
) RETURNS JSONB AS $$
DECLARE
    source_record RECORD;
    truck_record RECORD;
    result JSONB;
    execution_log TEXT := '';
    start_time TIMESTAMP := NOW();
BEGIN
    execution_log := execution_log || format('TRANSFER_TO_TRUCK START: %s | FROM: %s | TO: %s | PRODUCT: %s | QTY_FULL: %s | QTY_EMPTY: %s', 
        start_time, p_from_warehouse_id, p_to_truck_id, p_product_id, p_qty_full, p_qty_empty) || E'\n';
    
    -- Input validation
    IF p_qty_full < 0 OR p_qty_empty < 0 THEN
        execution_log := execution_log || 'ERROR: Negative transfer quantities' || E'\n';
        RAISE EXCEPTION 'Transfer quantities cannot be negative';
    END IF;
    
    IF p_qty_full = 0 AND p_qty_empty = 0 THEN
        execution_log := execution_log || 'ERROR: Both quantities are zero' || E'\n';
        RAISE EXCEPTION 'Transfer quantities cannot both be zero';
    END IF;
    
    execution_log := execution_log || 'Input validation passed' || E'\n';

    -- Validate truck exists
    IF NOT EXISTS (SELECT 1 FROM truck WHERE id = p_to_truck_id AND active = true) THEN
        execution_log := execution_log || 'ERROR: Truck not found or inactive' || E'\n';
        RAISE EXCEPTION 'Truck % not found or inactive', p_to_truck_id;
    END IF;
    
    execution_log := execution_log || 'Truck validation passed' || E'\n';

    -- Lock and validate source inventory
    execution_log := execution_log || 'Locking source inventory...' || E'\n';
    SELECT * INTO source_record 
    FROM inventory_balance 
    WHERE warehouse_id = p_from_warehouse_id 
      AND product_id = p_product_id 
    FOR UPDATE;
    
    IF NOT FOUND THEN
        execution_log := execution_log || 'ERROR: Source inventory record not found' || E'\n';
        RAISE EXCEPTION 'Source inventory record not found for warehouse % and product %', 
                       p_from_warehouse_id, p_product_id;
    END IF;
    
    execution_log := execution_log || format('Source inventory locked: FULL=%s, EMPTY=%s, RESERVED=%s', 
        source_record.qty_full, source_record.qty_empty, source_record.qty_reserved) || E'\n';
    
    -- Validate sufficient stock
    IF source_record.qty_full < p_qty_full THEN
        execution_log := execution_log || format('ERROR: Insufficient full stock. Available: %s, Requested: %s', 
            source_record.qty_full, p_qty_full) || E'\n';
        RAISE EXCEPTION 'Insufficient full stock. Available: %, Requested: %', 
                       source_record.qty_full, p_qty_full;
    END IF;
    
    IF source_record.qty_empty < p_qty_empty THEN
        execution_log := execution_log || format('ERROR: Insufficient empty stock. Available: %s, Requested: %s', 
            source_record.qty_empty, p_qty_empty) || E'\n';
        RAISE EXCEPTION 'Insufficient empty stock. Available: %, Requested: %', 
                       source_record.qty_empty, p_qty_empty;
    END IF;
    
    -- Validate transfer won't leave insufficient stock for reservations
    IF (source_record.qty_full - p_qty_full) < source_record.qty_reserved THEN
        execution_log := execution_log || format('ERROR: Transfer would leave insufficient stock for reservations. Reserved: %s, Remaining: %s', 
            source_record.qty_reserved, (source_record.qty_full - p_qty_full)) || E'\n';
        RAISE EXCEPTION 'Transfer would leave insufficient stock for reservations. Reserved: %, Remaining after transfer: %', 
                       source_record.qty_reserved, (source_record.qty_full - p_qty_full);
    END IF;
    
    execution_log := execution_log || 'Stock validation passed' || E'\n';

    -- Lock truck inventory (create if doesn't exist)
    execution_log := execution_log || 'Locking truck inventory...' || E'\n';
    SELECT * INTO truck_record 
    FROM truck_inventory 
    WHERE truck_id = p_to_truck_id 
      AND product_id = p_product_id 
    FOR UPDATE;
    
    IF NOT FOUND THEN
        execution_log := execution_log || 'Creating truck inventory record...' || E'\n';
        -- Create truck inventory record
        INSERT INTO truck_inventory (
            truck_id, 
            product_id, 
            qty_full, 
            qty_empty
        ) VALUES (
            p_to_truck_id, 
            p_product_id, 
            0, 
            0
        );
        
        -- Get the newly created record
        SELECT * INTO truck_record 
        FROM truck_inventory 
        WHERE truck_id = p_to_truck_id 
          AND product_id = p_product_id;
        
        execution_log := execution_log || 'Truck inventory record created' || E'\n';
    ELSE
        execution_log := execution_log || format('Truck inventory found: FULL=%s, EMPTY=%s', 
            truck_record.qty_full, truck_record.qty_empty) || E'\n';
    END IF;

    -- Perform atomic updates
    execution_log := execution_log || 'Performing atomic inventory updates...' || E'\n';
    
    -- Update source inventory (decrease)
    UPDATE inventory_balance 
    SET 
        qty_full = qty_full - p_qty_full,
        qty_empty = qty_empty - p_qty_empty,
        updated_at = NOW()
    WHERE warehouse_id = p_from_warehouse_id 
      AND product_id = p_product_id;
    
    execution_log := execution_log || 'Source inventory updated (decreased)' || E'\n';
    
    -- Update truck inventory (increase)
    UPDATE truck_inventory 
    SET 
        qty_full = qty_full + p_qty_full,
        qty_empty = qty_empty + p_qty_empty,
        updated_at = NOW()
    WHERE truck_id = p_to_truck_id 
      AND product_id = p_product_id;
    
    execution_log := execution_log || 'Truck inventory updated (increased)' || E'\n';
    
    -- Log the stock movement for audit trail
    execution_log := execution_log || 'Creating audit trail entry...' || E'\n';
    INSERT INTO stock_movements (
        inventory_id,
        movement_type,
        qty_full_change,
        qty_empty_change,
        reason,
        reference_type
    ) VALUES (
        source_record.id,
        'transfer_out',
        -p_qty_full,
        -p_qty_empty,
        'Transfer to truck ' || p_to_truck_id,
        'truck_transfer'
    );
    
    execution_log := execution_log || 'Audit trail entry created' || E'\n';
    
    -- Return success result
    result := jsonb_build_object(
        'success', true,
        'source_warehouse_id', p_from_warehouse_id,
        'destination_truck_id', p_to_truck_id,
        'product_id', p_product_id,
        'qty_full_transferred', p_qty_full,
        'qty_empty_transferred', p_qty_empty,
        'source_remaining_full', source_record.qty_full - p_qty_full,
        'source_remaining_empty', source_record.qty_empty - p_qty_empty,
        'truck_new_full', truck_record.qty_full + p_qty_full,
        'truck_new_empty', truck_record.qty_empty + p_qty_empty,
        'execution_time_ms', EXTRACT(EPOCH FROM (NOW() - start_time)) * 1000,
        'execution_log', execution_log
    );
    
    execution_log := execution_log || format('TRANSFER_TO_TRUCK SUCCESS: Completed in %s ms', 
        EXTRACT(EPOCH FROM (NOW() - start_time)) * 1000) || E'\n';
    
    -- Log successful completion
    RAISE NOTICE 'TRANSFER_TO_TRUCK SUCCESS: %', execution_log;
    
    RETURN result;
    
EXCEPTION WHEN OTHERS THEN
    execution_log := execution_log || format('TRANSFER_TO_TRUCK ERROR: %s', SQLERRM) || E'\n';
    execution_log := execution_log || format('Error occurred at: %s', NOW()) || E'\n';
    
    -- Log the error
    RAISE NOTICE 'TRANSFER_TO_TRUCK ERROR: %', execution_log;
    
    -- Re-raise with detailed error
    RAISE EXCEPTION 'Transfer to truck failed: % | Execution Log: %', SQLERRM, execution_log;
END;
$$ LANGUAGE plpgsql;

-- Create enhanced function for truck-to-warehouse transfers
CREATE OR REPLACE FUNCTION transfer_stock_from_truck(
    p_from_truck_id UUID,
    p_to_warehouse_id UUID,
    p_product_id UUID,
    p_qty_full NUMERIC,
    p_qty_empty NUMERIC
) RETURNS JSONB AS $$
DECLARE
    truck_record RECORD;
    dest_record RECORD;
    result JSONB;
    execution_log TEXT := '';
    start_time TIMESTAMP := NOW();
BEGIN
    execution_log := execution_log || format('TRANSFER_FROM_TRUCK START: %s | FROM: %s | TO: %s | PRODUCT: %s | QTY_FULL: %s | QTY_EMPTY: %s', 
        start_time, p_from_truck_id, p_to_warehouse_id, p_product_id, p_qty_full, p_qty_empty) || E'\n';
    
    -- Input validation
    IF p_qty_full < 0 OR p_qty_empty < 0 THEN
        execution_log := execution_log || 'ERROR: Negative transfer quantities' || E'\n';
        RAISE EXCEPTION 'Transfer quantities cannot be negative';
    END IF;
    
    IF p_qty_full = 0 AND p_qty_empty = 0 THEN
        execution_log := execution_log || 'ERROR: Both quantities are zero' || E'\n';
        RAISE EXCEPTION 'Transfer quantities cannot both be zero';
    END IF;
    
    execution_log := execution_log || 'Input validation passed' || E'\n';

    -- Lock and validate truck inventory
    execution_log := execution_log || 'Locking truck inventory...' || E'\n';
    SELECT * INTO truck_record 
    FROM truck_inventory 
    WHERE truck_id = p_from_truck_id 
      AND product_id = p_product_id 
    FOR UPDATE;
    
    IF NOT FOUND THEN
        execution_log := execution_log || 'ERROR: Truck inventory record not found' || E'\n';
        RAISE EXCEPTION 'Truck inventory record not found for truck % and product %', 
                       p_from_truck_id, p_product_id;
    END IF;
    
    execution_log := execution_log || format('Truck inventory locked: FULL=%s, EMPTY=%s', 
        truck_record.qty_full, truck_record.qty_empty) || E'\n';
    
    -- Validate sufficient stock on truck
    IF truck_record.qty_full < p_qty_full THEN
        execution_log := execution_log || format('ERROR: Insufficient full stock on truck. Available: %s, Requested: %s', 
            truck_record.qty_full, p_qty_full) || E'\n';
        RAISE EXCEPTION 'Insufficient full stock on truck. Available: %, Requested: %', 
                       truck_record.qty_full, p_qty_full;
    END IF;
    
    IF truck_record.qty_empty < p_qty_empty THEN
        execution_log := execution_log || format('ERROR: Insufficient empty stock on truck. Available: %s, Requested: %s', 
            truck_record.qty_empty, p_qty_empty) || E'\n';
        RAISE EXCEPTION 'Insufficient empty stock on truck. Available: %, Requested: %', 
                       truck_record.qty_empty, p_qty_empty;
    END IF;
    
    execution_log := execution_log || 'Stock validation passed' || E'\n';

    -- Lock destination inventory (create if doesn't exist)
    execution_log := execution_log || 'Locking destination inventory...' || E'\n';
    SELECT * INTO dest_record 
    FROM inventory_balance 
    WHERE warehouse_id = p_to_warehouse_id 
      AND product_id = p_product_id 
    FOR UPDATE;
    
    IF NOT FOUND THEN
        execution_log := execution_log || 'Creating destination inventory record...' || E'\n';
        -- Create destination inventory record
        INSERT INTO inventory_balance (
            warehouse_id, 
            product_id, 
            qty_full, 
            qty_empty, 
            qty_reserved
        ) VALUES (
            p_to_warehouse_id, 
            p_product_id, 
            0, 
            0, 
            0
        );
        
        -- Get the newly created record
        SELECT * INTO dest_record 
        FROM inventory_balance 
        WHERE warehouse_id = p_to_warehouse_id 
          AND product_id = p_product_id;
        
        execution_log := execution_log || 'Destination inventory record created' || E'\n';
    ELSE
        execution_log := execution_log || format('Destination inventory found: FULL=%s, EMPTY=%s', 
            dest_record.qty_full, dest_record.qty_empty) || E'\n';
    END IF;

    -- Perform atomic updates
    execution_log := execution_log || 'Performing atomic inventory updates...' || E'\n';
    
    -- Update truck inventory (decrease)
    UPDATE truck_inventory 
    SET 
        qty_full = qty_full - p_qty_full,
        qty_empty = qty_empty - p_qty_empty,
        updated_at = NOW()
    WHERE truck_id = p_from_truck_id 
      AND product_id = p_product_id;
    
    execution_log := execution_log || 'Truck inventory updated (decreased)' || E'\n';
    
    -- Update destination inventory (increase)
    UPDATE inventory_balance 
    SET 
        qty_full = qty_full + p_qty_full,
        qty_empty = qty_empty + p_qty_empty,
        updated_at = NOW()
    WHERE warehouse_id = p_to_warehouse_id 
      AND product_id = p_product_id;
    
    execution_log := execution_log || 'Destination inventory updated (increased)' || E'\n';
    
    -- Log the stock movement for audit trail
    execution_log := execution_log || 'Creating audit trail entry...' || E'\n';
    INSERT INTO stock_movements (
        inventory_id,
        movement_type,
        qty_full_change,
        qty_empty_change,
        reason,
        reference_type
    ) VALUES (
        dest_record.id,
        'transfer_in',
        p_qty_full,
        p_qty_empty,
        'Transfer from truck ' || p_from_truck_id,
        'truck_transfer'
    );
    
    execution_log := execution_log || 'Audit trail entry created' || E'\n';
    
    -- Return success result
    result := jsonb_build_object(
        'success', true,
        'source_truck_id', p_from_truck_id,
        'destination_warehouse_id', p_to_warehouse_id,
        'product_id', p_product_id,
        'qty_full_transferred', p_qty_full,
        'qty_empty_transferred', p_qty_empty,
        'truck_remaining_full', truck_record.qty_full - p_qty_full,
        'truck_remaining_empty', truck_record.qty_empty - p_qty_empty,
        'warehouse_new_full', dest_record.qty_full + p_qty_full,
        'warehouse_new_empty', dest_record.qty_empty + p_qty_empty,
        'execution_time_ms', EXTRACT(EPOCH FROM (NOW() - start_time)) * 1000,
        'execution_log', execution_log
    );
    
    execution_log := execution_log || format('TRANSFER_FROM_TRUCK SUCCESS: Completed in %s ms', 
        EXTRACT(EPOCH FROM (NOW() - start_time)) * 1000) || E'\n';
    
    -- Log successful completion
    RAISE NOTICE 'TRANSFER_FROM_TRUCK SUCCESS: %', execution_log;
    
    RETURN result;
    
EXCEPTION WHEN OTHERS THEN
    execution_log := execution_log || format('TRANSFER_FROM_TRUCK ERROR: %s', SQLERRM) || E'\n';
    execution_log := execution_log || format('Error occurred at: %s', NOW()) || E'\n';
    
    -- Log the error
    RAISE NOTICE 'TRANSFER_FROM_TRUCK ERROR: %', execution_log;
    
    -- Re-raise with detailed error
    RAISE EXCEPTION 'Transfer from truck failed: % | Execution Log: %', SQLERRM, execution_log;
END;
$$ LANGUAGE plpgsql;

-- Create enhanced validation function
CREATE OR REPLACE FUNCTION validate_transfer_request(
    p_from_warehouse_id UUID,
    p_to_warehouse_id UUID,
    p_product_id UUID,
    p_qty_full NUMERIC,
    p_qty_empty NUMERIC
) RETURNS JSONB AS $$
DECLARE
    source_record RECORD;
    validation_result JSONB;
    errors TEXT[] := ARRAY[]::TEXT[];
    warnings TEXT[] := ARRAY[]::TEXT[];
    execution_log TEXT := '';
    start_time TIMESTAMP := NOW();
BEGIN
    execution_log := execution_log || format('VALIDATE_TRANSFER START: %s | FROM: %s | TO: %s | PRODUCT: %s | QTY_FULL: %s | QTY_EMPTY: %s', 
        start_time, p_from_warehouse_id, p_to_warehouse_id, p_product_id, p_qty_full, p_qty_empty) || E'\n';
    
    -- Input validation
    IF p_from_warehouse_id = p_to_warehouse_id THEN
        errors := array_append(errors, 'Source and destination warehouses must be different');
        execution_log := execution_log || 'ERROR: Same warehouse for source and destination' || E'\n';
    END IF;
    
    IF p_qty_full < 0 OR p_qty_empty < 0 THEN
        errors := array_append(errors, 'Transfer quantities cannot be negative');
        execution_log := execution_log || 'ERROR: Negative quantities' || E'\n';
    END IF;
    
    IF p_qty_full = 0 AND p_qty_empty = 0 THEN
        errors := array_append(errors, 'Transfer quantities cannot both be zero');
        execution_log := execution_log || 'ERROR: Both quantities are zero' || E'\n';
    END IF;
    
    execution_log := execution_log || 'Input validation completed' || E'\n';

    -- Validate warehouses exist
    IF NOT EXISTS (SELECT 1 FROM warehouses WHERE id = p_from_warehouse_id) THEN
        errors := array_append(errors, 'Source warehouse not found');
        execution_log := execution_log || 'ERROR: Source warehouse not found' || E'\n';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM warehouses WHERE id = p_to_warehouse_id) THEN
        errors := array_append(errors, 'Destination warehouse not found');
        execution_log := execution_log || 'ERROR: Destination warehouse not found' || E'\n';
    END IF;
    
    -- Validate product exists
    IF NOT EXISTS (SELECT 1 FROM products WHERE id = p_product_id AND status = 'active') THEN
        errors := array_append(errors, 'Product not found or inactive');
        execution_log := execution_log || 'ERROR: Product not found or inactive' || E'\n';
    END IF;
    
    execution_log := execution_log || 'Entity validation completed' || E'\n';

    -- Get source inventory
    SELECT * INTO source_record 
    FROM inventory_balance 
    WHERE warehouse_id = p_from_warehouse_id 
      AND product_id = p_product_id;
    
    IF NOT FOUND THEN
        errors := array_append(errors, 'Source inventory record not found');
        execution_log := execution_log || 'ERROR: Source inventory record not found' || E'\n';
    ELSE
        execution_log := execution_log || format('Source inventory found: FULL=%s, EMPTY=%s, RESERVED=%s', 
            source_record.qty_full, source_record.qty_empty, source_record.qty_reserved) || E'\n';
        
        -- Validate sufficient stock
        IF source_record.qty_full < p_qty_full THEN
            errors := array_append(errors, 
                format('Insufficient full stock. Available: %s, Requested: %s', 
                       source_record.qty_full, p_qty_full));
            execution_log := execution_log || 'ERROR: Insufficient full stock' || E'\n';
        END IF;
        
        IF source_record.qty_empty < p_qty_empty THEN
            errors := array_append(errors, 
                format('Insufficient empty stock. Available: %s, Requested: %s', 
                       source_record.qty_empty, p_qty_empty));
            execution_log := execution_log || 'ERROR: Insufficient empty stock' || E'\n';
        END IF;
        
        -- Validate transfer won't leave insufficient stock for reservations
        IF (source_record.qty_full - p_qty_full) < source_record.qty_reserved THEN
            errors := array_append(errors, 
                format('Transfer would leave insufficient stock for reservations. Reserved: %s, Remaining after transfer: %s', 
                       source_record.qty_reserved, (source_record.qty_full - p_qty_full)));
            execution_log := execution_log || 'ERROR: Insufficient stock for reservations' || E'\n';
        END IF;
        
        -- Warnings for large transfers
        IF p_qty_full > source_record.qty_full * 0.9 THEN
            warnings := array_append(warnings, 'Transferring more than 90% of available full stock');
            execution_log := execution_log || 'WARNING: Large full stock transfer' || E'\n';
        END IF;
        
        IF p_qty_empty > source_record.qty_empty * 0.9 THEN
            warnings := array_append(warnings, 'Transferring more than 90% of available empty stock');
            execution_log := execution_log || 'WARNING: Large empty stock transfer' || E'\n';
        END IF;
    END IF;
    
    execution_log := execution_log || format('VALIDATE_TRANSFER COMPLETED: %s errors, %s warnings in %s ms', 
        array_length(errors, 1), array_length(warnings, 1), 
        EXTRACT(EPOCH FROM (NOW() - start_time)) * 1000) || E'\n';
    
    validation_result := jsonb_build_object(
        'is_valid', array_length(errors, 1) IS NULL,
        'errors', errors,
        'warnings', warnings,
        'execution_time_ms', EXTRACT(EPOCH FROM (NOW() - start_time)) * 1000,
        'execution_log', execution_log,
        'source_stock', CASE 
            WHEN source_record IS NOT NULL THEN 
                jsonb_build_object(
                    'qty_full', source_record.qty_full,
                    'qty_empty', source_record.qty_empty,
                    'qty_reserved', source_record.qty_reserved,
                    'available_full', source_record.qty_full - source_record.qty_reserved,
                    'available_empty', source_record.qty_empty
                )
            ELSE NULL
        END
    );
    
    -- Log the validation result
    RAISE NOTICE 'VALIDATE_TRANSFER RESULT: %', validation_result;
    
    RETURN validation_result;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION transfer_stock TO authenticated;
GRANT EXECUTE ON FUNCTION transfer_stock_to_truck TO authenticated;
GRANT EXECUTE ON FUNCTION transfer_stock_from_truck TO authenticated;
GRANT EXECUTE ON FUNCTION validate_transfer_request TO authenticated;

-- Add helpful comments
COMMENT ON FUNCTION transfer_stock IS 'Atomically transfer inventory between warehouses with comprehensive logging';
COMMENT ON FUNCTION transfer_stock_to_truck IS 'Atomically transfer inventory from warehouse to truck with comprehensive logging';
COMMENT ON FUNCTION transfer_stock_from_truck IS 'Atomically transfer inventory from truck back to warehouse with comprehensive logging';
COMMENT ON FUNCTION validate_transfer_request IS 'Validate transfer request without executing it with comprehensive logging';

COMMIT;