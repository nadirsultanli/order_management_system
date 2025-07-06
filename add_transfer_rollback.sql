-- =============================================================================
-- ADD TRANSACTION ROLLBACK CAPABILITY FOR FAILED TRANSFERS
-- =============================================================================
-- This migration adds rollback capability and transaction safety for transfers

BEGIN;

-- Create a transfer transaction log table to track transfer attempts
CREATE TABLE IF NOT EXISTS transfer_transaction_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    transfer_id UUID,
    transaction_type VARCHAR(50) NOT NULL, -- 'start', 'item_complete', 'rollback', 'complete'
    product_id UUID,
    source_warehouse_id UUID,
    destination_warehouse_id UUID,
    destination_truck_id UUID,
    qty_full NUMERIC,
    qty_empty NUMERIC,
    success BOOLEAN,
    error_message TEXT,
    rollback_data JSONB, -- Store data needed for rollback
    created_at TIMESTAMP DEFAULT NOW(),
    created_by_user_id UUID
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_transfer_transaction_log_transfer_id ON transfer_transaction_log(transfer_id);
CREATE INDEX IF NOT EXISTS idx_transfer_transaction_log_created_at ON transfer_transaction_log(created_at);

-- Create enhanced transfer function with rollback capability
CREATE OR REPLACE FUNCTION transfer_stock_with_rollback(
    p_from_warehouse_id UUID,
    p_to_warehouse_id UUID,
    p_product_id UUID,
    p_qty_full NUMERIC,
    p_qty_empty NUMERIC,
    p_transfer_id UUID DEFAULT NULL,
    p_user_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    source_record RECORD;
    dest_record RECORD;
    result JSONB;
    execution_log TEXT := '';
    start_time TIMESTAMP := NOW();
    savepoint_name TEXT := 'transfer_' || p_product_id::text;
    rollback_data JSONB;
BEGIN
    execution_log := execution_log || format('TRANSFER_STOCK_WITH_ROLLBACK START: %s', start_time) || E'\n';
    
    -- Create savepoint for potential rollback
    EXECUTE format('SAVEPOINT %I', savepoint_name);
    execution_log := execution_log || format('Created savepoint: %s', savepoint_name) || E'\n';
    
    -- Log transaction start
    INSERT INTO transfer_transaction_log (
        transfer_id, transaction_type, product_id, 
        source_warehouse_id, destination_warehouse_id,
        qty_full, qty_empty, created_by_user_id
    ) VALUES (
        p_transfer_id, 'start', p_product_id,
        p_from_warehouse_id, p_to_warehouse_id,
        p_qty_full, p_qty_empty, p_user_id
    );
    
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

    -- Lock and validate source inventory
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
    
    -- Store rollback data before making changes
    rollback_data := jsonb_build_object(
        'source_original_full', source_record.qty_full,
        'source_original_empty', source_record.qty_empty,
        'source_warehouse_id', p_from_warehouse_id,
        'product_id', p_product_id
    );
    
    execution_log := execution_log || format('Source inventory: FULL=%s, EMPTY=%s, RESERVED=%s', 
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
    
    -- Add destination rollback data
    rollback_data := rollback_data || jsonb_build_object(
        'dest_original_full', dest_record.qty_full,
        'dest_original_empty', dest_record.qty_empty,
        'dest_warehouse_id', p_to_warehouse_id,
        'dest_existed_before', dest_record.id IS NOT NULL
    );

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
    
    -- Log successful completion
    INSERT INTO transfer_transaction_log (
        transfer_id, transaction_type, product_id, 
        source_warehouse_id, destination_warehouse_id,
        qty_full, qty_empty, success, rollback_data, created_by_user_id
    ) VALUES (
        p_transfer_id, 'item_complete', p_product_id,
        p_from_warehouse_id, p_to_warehouse_id,
        p_qty_full, p_qty_empty, true, rollback_data, p_user_id
    );
    
    -- Release savepoint
    EXECUTE format('RELEASE SAVEPOINT %I', savepoint_name);
    
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
        'execution_log', execution_log,
        'rollback_data', rollback_data
    );
    
    execution_log := execution_log || format('TRANSFER_STOCK_WITH_ROLLBACK SUCCESS: Completed in %s ms', 
        EXTRACT(EPOCH FROM (NOW() - start_time)) * 1000) || E'\n';
    
    RAISE NOTICE 'TRANSFER_STOCK_WITH_ROLLBACK SUCCESS: %', execution_log;
    
    RETURN result;
    
EXCEPTION WHEN OTHERS THEN
    execution_log := execution_log || format('TRANSFER_STOCK_WITH_ROLLBACK ERROR: %s', SQLERRM) || E'\n';
    
    -- Rollback to savepoint
    EXECUTE format('ROLLBACK TO SAVEPOINT %I', savepoint_name);
    execution_log := execution_log || format('Rolled back to savepoint: %s', savepoint_name) || E'\n';
    
    -- Log the rollback
    INSERT INTO transfer_transaction_log (
        transfer_id, transaction_type, product_id, 
        source_warehouse_id, destination_warehouse_id,
        qty_full, qty_empty, success, error_message, 
        rollback_data, created_by_user_id
    ) VALUES (
        p_transfer_id, 'rollback', p_product_id,
        p_from_warehouse_id, p_to_warehouse_id,
        p_qty_full, p_qty_empty, false, SQLERRM,
        rollback_data, p_user_id
    );
    
    RAISE NOTICE 'TRANSFER_STOCK_WITH_ROLLBACK ERROR: %', execution_log;
    
    -- Re-raise with detailed error
    RAISE EXCEPTION 'Transfer failed and rolled back: % | Execution Log: %', SQLERRM, execution_log;
END;
$$ LANGUAGE plpgsql;

-- Create rollback function to manually rollback a completed transfer
CREATE OR REPLACE FUNCTION rollback_transfer_item(
    p_transfer_id UUID,
    p_product_id UUID,
    p_user_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    transfer_log RECORD;
    rollback_data JSONB;
    result JSONB;
    execution_log TEXT := '';
BEGIN
    execution_log := execution_log || format('ROLLBACK_TRANSFER_ITEM START: transfer_id=%s, product_id=%s', 
        p_transfer_id, p_product_id) || E'\n';
    
    -- Find the completed transfer log entry
    SELECT * INTO transfer_log
    FROM transfer_transaction_log
    WHERE transfer_id = p_transfer_id 
      AND product_id = p_product_id 
      AND transaction_type = 'item_complete'
      AND success = true
    ORDER BY created_at DESC
    LIMIT 1;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'No completed transfer found for transfer_id % and product_id %', 
                       p_transfer_id, p_product_id;
    END IF;
    
    rollback_data := transfer_log.rollback_data;
    execution_log := execution_log || 'Found transfer log entry with rollback data' || E'\n';
    
    -- Restore source inventory
    UPDATE inventory_balance 
    SET 
        qty_full = (rollback_data->>'source_original_full')::NUMERIC,
        qty_empty = (rollback_data->>'source_original_empty')::NUMERIC,
        updated_at = NOW()
    WHERE warehouse_id = (rollback_data->>'source_warehouse_id')::UUID
      AND product_id = (rollback_data->>'product_id')::UUID;
    
    execution_log := execution_log || 'Source inventory restored' || E'\n';
    
    -- Restore destination inventory
    IF (rollback_data->>'dest_existed_before')::BOOLEAN THEN
        -- Restore original values
        UPDATE inventory_balance 
        SET 
            qty_full = (rollback_data->>'dest_original_full')::NUMERIC,
            qty_empty = (rollback_data->>'dest_original_empty')::NUMERIC,
            updated_at = NOW()
        WHERE warehouse_id = (rollback_data->>'dest_warehouse_id')::UUID
          AND product_id = (rollback_data->>'product_id')::UUID;
        
        execution_log := execution_log || 'Destination inventory restored to original values' || E'\n';
    ELSE
        -- Remove the inventory record that was created
        DELETE FROM inventory_balance 
        WHERE warehouse_id = (rollback_data->>'dest_warehouse_id')::UUID
          AND product_id = (rollback_data->>'product_id')::UUID;
        
        execution_log := execution_log || 'Destination inventory record removed (was created during transfer)' || E'\n';
    END IF;
    
    -- Log the rollback
    INSERT INTO transfer_transaction_log (
        transfer_id, transaction_type, product_id, 
        source_warehouse_id, destination_warehouse_id,
        qty_full, qty_empty, success, rollback_data, created_by_user_id
    ) VALUES (
        p_transfer_id, 'manual_rollback', p_product_id,
        (rollback_data->>'source_warehouse_id')::UUID,
        (rollback_data->>'dest_warehouse_id')::UUID,
        transfer_log.qty_full, transfer_log.qty_empty, 
        true, rollback_data, p_user_id
    );
    
    -- Create compensating stock movements
    INSERT INTO stock_movements (
        inventory_id,
        movement_type,
        qty_full_change,
        qty_empty_change,
        reason,
        reference_type
    ) 
    SELECT 
        ib.id,
        'rollback_adjustment',
        transfer_log.qty_full, -- Positive for source (adding back)
        transfer_log.qty_empty,
        'Rollback of transfer ' || p_transfer_id,
        'rollback'
    FROM inventory_balance ib
    WHERE ib.warehouse_id = (rollback_data->>'source_warehouse_id')::UUID
      AND ib.product_id = (rollback_data->>'product_id')::UUID;
    
    result := jsonb_build_object(
        'success', true,
        'transfer_id', p_transfer_id,
        'product_id', p_product_id,
        'rollback_data', rollback_data,
        'execution_log', execution_log
    );
    
    RAISE NOTICE 'ROLLBACK_TRANSFER_ITEM SUCCESS: %', execution_log;
    
    RETURN result;
    
EXCEPTION WHEN OTHERS THEN
    execution_log := execution_log || format('ROLLBACK_TRANSFER_ITEM ERROR: %s', SQLERRM) || E'\n';
    RAISE NOTICE 'ROLLBACK_TRANSFER_ITEM ERROR: %', execution_log;
    RAISE EXCEPTION 'Rollback failed: % | Execution Log: %', SQLERRM, execution_log;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON transfer_transaction_log TO authenticated;
GRANT EXECUTE ON FUNCTION transfer_stock_with_rollback TO authenticated;
GRANT EXECUTE ON FUNCTION rollback_transfer_item TO authenticated;

-- Add comments
COMMENT ON TABLE transfer_transaction_log IS 'Transaction log for tracking transfer operations and rollback data';
COMMENT ON FUNCTION transfer_stock_with_rollback IS 'Enhanced transfer function with automatic rollback capability on failure';
COMMENT ON FUNCTION rollback_transfer_item IS 'Manually rollback a completed transfer item using stored rollback data';

COMMIT;