-- Create atomic transfer functions for inventory management
-- This migration adds proper atomic transfer functions with validation

BEGIN;

-- Create atomic transfer function for warehouse-to-warehouse transfers
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
BEGIN
    -- Input validation
    IF p_from_warehouse_id = p_to_warehouse_id THEN
        RAISE EXCEPTION 'Source and destination warehouses must be different';
    END IF;
    
    IF p_qty_full < 0 OR p_qty_empty < 0 THEN
        RAISE EXCEPTION 'Transfer quantities cannot be negative';
    END IF;
    
    IF p_qty_full = 0 AND p_qty_empty = 0 THEN
        RAISE EXCEPTION 'Transfer quantities cannot both be zero';
    END IF;

    -- Lock and validate source inventory
    SELECT * INTO source_record 
    FROM inventory_balance 
    WHERE warehouse_id = p_from_warehouse_id 
      AND product_id = p_product_id 
    FOR UPDATE;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Source inventory record not found for warehouse % and product %', 
                       p_from_warehouse_id, p_product_id;
    END IF;
    
    -- Validate sufficient stock
    IF source_record.qty_full < p_qty_full THEN
        RAISE EXCEPTION 'Insufficient full stock. Available: %, Requested: %', 
                       source_record.qty_full, p_qty_full;
    END IF;
    
    IF source_record.qty_empty < p_qty_empty THEN
        RAISE EXCEPTION 'Insufficient empty stock. Available: %, Requested: %', 
                       source_record.qty_empty, p_qty_empty;
    END IF;
    
    -- Validate transfer won't leave insufficient stock for reservations
    IF (source_record.qty_full - p_qty_full) < source_record.qty_reserved THEN
        RAISE EXCEPTION 'Transfer would leave insufficient stock for reservations. Reserved: %, Remaining after transfer: %', 
                       source_record.qty_reserved, (source_record.qty_full - p_qty_full);
    END IF;

    -- Lock destination inventory (create if doesn't exist)
    SELECT * INTO dest_record 
    FROM inventory_balance 
    WHERE warehouse_id = p_to_warehouse_id 
      AND product_id = p_product_id 
    FOR UPDATE;
    
    IF NOT FOUND THEN
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
    END IF;

    -- Perform atomic updates
    -- Update source inventory (decrease)
    UPDATE inventory_balance 
    SET 
        qty_full = qty_full - p_qty_full,
        qty_empty = qty_empty - p_qty_empty,
        updated_at = NOW()
    WHERE warehouse_id = p_from_warehouse_id 
      AND product_id = p_product_id;
    
    -- Update destination inventory (increase)
    UPDATE inventory_balance 
    SET 
        qty_full = qty_full + p_qty_full,
        qty_empty = qty_empty + p_qty_empty,
        updated_at = NOW()
    WHERE warehouse_id = p_to_warehouse_id 
      AND product_id = p_product_id;
    
    -- Log the stock movements for audit trail
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
        'destination_new_empty', dest_record.qty_empty + p_qty_empty
    );
    
    RETURN result;
    
EXCEPTION WHEN OTHERS THEN
    -- Log the error and re-raise
    RAISE EXCEPTION 'Transfer failed: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- Create function for warehouse-to-truck transfers
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
BEGIN
    -- Input validation
    IF p_qty_full < 0 OR p_qty_empty < 0 THEN
        RAISE EXCEPTION 'Transfer quantities cannot be negative';
    END IF;
    
    IF p_qty_full = 0 AND p_qty_empty = 0 THEN
        RAISE EXCEPTION 'Transfer quantities cannot both be zero';
    END IF;

    -- Validate truck exists
    IF NOT EXISTS (SELECT 1 FROM truck WHERE id = p_to_truck_id AND active = true) THEN
        RAISE EXCEPTION 'Truck % not found or inactive', p_to_truck_id;
    END IF;

    -- Lock and validate source inventory
    SELECT * INTO source_record 
    FROM inventory_balance 
    WHERE warehouse_id = p_from_warehouse_id 
      AND product_id = p_product_id 
    FOR UPDATE;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Source inventory record not found for warehouse % and product %', 
                       p_from_warehouse_id, p_product_id;
    END IF;
    
    -- Validate sufficient stock
    IF source_record.qty_full < p_qty_full THEN
        RAISE EXCEPTION 'Insufficient full stock. Available: %, Requested: %', 
                       source_record.qty_full, p_qty_full;
    END IF;
    
    IF source_record.qty_empty < p_qty_empty THEN
        RAISE EXCEPTION 'Insufficient empty stock. Available: %, Requested: %', 
                       source_record.qty_empty, p_qty_empty;
    END IF;
    
    -- Validate transfer won't leave insufficient stock for reservations
    IF (source_record.qty_full - p_qty_full) < source_record.qty_reserved THEN
        RAISE EXCEPTION 'Transfer would leave insufficient stock for reservations. Reserved: %, Remaining after transfer: %', 
                       source_record.qty_reserved, (source_record.qty_full - p_qty_full);
    END IF;

    -- Lock truck inventory (create if doesn't exist)
    SELECT * INTO truck_record 
    FROM truck_inventory 
    WHERE truck_id = p_to_truck_id 
      AND product_id = p_product_id 
    FOR UPDATE;
    
    IF NOT FOUND THEN
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
    END IF;

    -- Perform atomic updates
    -- Update source inventory (decrease)
    UPDATE inventory_balance 
    SET 
        qty_full = qty_full - p_qty_full,
        qty_empty = qty_empty - p_qty_empty,
        updated_at = NOW()
    WHERE warehouse_id = p_from_warehouse_id 
      AND product_id = p_product_id;
    
    -- Update truck inventory (increase)
    UPDATE truck_inventory 
    SET 
        qty_full = qty_full + p_qty_full,
        qty_empty = qty_empty + p_qty_empty,
        updated_at = NOW()
    WHERE truck_id = p_to_truck_id 
      AND product_id = p_product_id;
    
    -- Log the stock movement for audit trail
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
        'truck_new_empty', truck_record.qty_empty + p_qty_empty
    );
    
    RETURN result;
    
EXCEPTION WHEN OTHERS THEN
    -- Log the error and re-raise
    RAISE EXCEPTION 'Transfer to truck failed: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- Create function for truck-to-warehouse transfers (returns)
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
BEGIN
    -- Input validation
    IF p_qty_full < 0 OR p_qty_empty < 0 THEN
        RAISE EXCEPTION 'Transfer quantities cannot be negative';
    END IF;
    
    IF p_qty_full = 0 AND p_qty_empty = 0 THEN
        RAISE EXCEPTION 'Transfer quantities cannot both be zero';
    END IF;

    -- Lock and validate truck inventory
    SELECT * INTO truck_record 
    FROM truck_inventory 
    WHERE truck_id = p_from_truck_id 
      AND product_id = p_product_id 
    FOR UPDATE;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Truck inventory record not found for truck % and product %', 
                       p_from_truck_id, p_product_id;
    END IF;
    
    -- Validate sufficient stock on truck
    IF truck_record.qty_full < p_qty_full THEN
        RAISE EXCEPTION 'Insufficient full stock on truck. Available: %, Requested: %', 
                       truck_record.qty_full, p_qty_full;
    END IF;
    
    IF truck_record.qty_empty < p_qty_empty THEN
        RAISE EXCEPTION 'Insufficient empty stock on truck. Available: %, Requested: %', 
                       truck_record.qty_empty, p_qty_empty;
    END IF;

    -- Lock destination inventory (create if doesn't exist)
    SELECT * INTO dest_record 
    FROM inventory_balance 
    WHERE warehouse_id = p_to_warehouse_id 
      AND product_id = p_product_id 
    FOR UPDATE;
    
    IF NOT FOUND THEN
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
    END IF;

    -- Perform atomic updates
    -- Update truck inventory (decrease)
    UPDATE truck_inventory 
    SET 
        qty_full = qty_full - p_qty_full,
        qty_empty = qty_empty - p_qty_empty,
        updated_at = NOW()
    WHERE truck_id = p_from_truck_id 
      AND product_id = p_product_id;
    
    -- Update destination inventory (increase)
    UPDATE inventory_balance 
    SET 
        qty_full = qty_full + p_qty_full,
        qty_empty = qty_empty + p_qty_empty,
        updated_at = NOW()
    WHERE warehouse_id = p_to_warehouse_id 
      AND product_id = p_product_id;
    
    -- Log the stock movement for audit trail
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
        'warehouse_new_empty', dest_record.qty_empty + p_qty_empty
    );
    
    RETURN result;
    
EXCEPTION WHEN OTHERS THEN
    -- Log the error and re-raise
    RAISE EXCEPTION 'Transfer from truck failed: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- Create validation function for transfer requirements
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
BEGIN
    -- Input validation
    IF p_from_warehouse_id = p_to_warehouse_id THEN
        errors := array_append(errors, 'Source and destination warehouses must be different');
    END IF;
    
    IF p_qty_full < 0 OR p_qty_empty < 0 THEN
        errors := array_append(errors, 'Transfer quantities cannot be negative');
    END IF;
    
    IF p_qty_full = 0 AND p_qty_empty = 0 THEN
        errors := array_append(errors, 'Transfer quantities cannot both be zero');
    END IF;

    -- Validate warehouses exist
    IF NOT EXISTS (SELECT 1 FROM warehouses WHERE id = p_from_warehouse_id) THEN
        errors := array_append(errors, 'Source warehouse not found');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM warehouses WHERE id = p_to_warehouse_id) THEN
        errors := array_append(errors, 'Destination warehouse not found');
    END IF;
    
    -- Validate product exists
    IF NOT EXISTS (SELECT 1 FROM products WHERE id = p_product_id AND status = 'active') THEN
        errors := array_append(errors, 'Product not found or inactive');
    END IF;

    -- Get source inventory
    SELECT * INTO source_record 
    FROM inventory_balance 
    WHERE warehouse_id = p_from_warehouse_id 
      AND product_id = p_product_id;
    
    IF NOT FOUND THEN
        errors := array_append(errors, 'Source inventory record not found');
    ELSE
        -- Validate sufficient stock
        IF source_record.qty_full < p_qty_full THEN
            errors := array_append(errors, 
                format('Insufficient full stock. Available: %s, Requested: %s', 
                       source_record.qty_full, p_qty_full));
        END IF;
        
        IF source_record.qty_empty < p_qty_empty THEN
            errors := array_append(errors, 
                format('Insufficient empty stock. Available: %s, Requested: %s', 
                       source_record.qty_empty, p_qty_empty));
        END IF;
        
        -- Validate transfer won't leave insufficient stock for reservations
        IF (source_record.qty_full - p_qty_full) < source_record.qty_reserved THEN
            errors := array_append(errors, 
                format('Transfer would leave insufficient stock for reservations. Reserved: %s, Remaining after transfer: %s', 
                       source_record.qty_reserved, (source_record.qty_full - p_qty_full)));
        END IF;
        
        -- Warnings for large transfers
        IF p_qty_full > source_record.qty_full * 0.9 THEN
            warnings := array_append(warnings, 'Transferring more than 90% of available full stock');
        END IF;
        
        IF p_qty_empty > source_record.qty_empty * 0.9 THEN
            warnings := array_append(warnings, 'Transferring more than 90% of available empty stock');
        END IF;
    END IF;
    
    validation_result := jsonb_build_object(
        'is_valid', array_length(errors, 1) IS NULL,
        'errors', errors,
        'warnings', warnings,
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
    
    RETURN validation_result;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION transfer_stock TO authenticated;
GRANT EXECUTE ON FUNCTION transfer_stock_to_truck TO authenticated;
GRANT EXECUTE ON FUNCTION transfer_stock_from_truck TO authenticated;
GRANT EXECUTE ON FUNCTION validate_transfer_request TO authenticated;

-- Add helpful comments
COMMENT ON FUNCTION transfer_stock IS 'Atomically transfer inventory between warehouses with validation';
COMMENT ON FUNCTION transfer_stock_to_truck IS 'Atomically transfer inventory from warehouse to truck';
COMMENT ON FUNCTION transfer_stock_from_truck IS 'Atomically transfer inventory from truck back to warehouse';
COMMENT ON FUNCTION validate_transfer_request IS 'Validate transfer request without executing it';

COMMIT;