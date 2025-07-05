-- ========================================
-- RESTORE CRITICAL INVENTORY FUNCTIONS
-- ========================================
-- This migration restores the inventory management functions that were
-- accidentally dropped during multi-tenancy removal. These functions
-- are critical for order workflow and inventory management.

BEGIN;

-- ========================================
-- 1. CREATE INVENTORY_BALANCE VIEW
-- ========================================
-- Create view if it doesn't exist for easier inventory queries
CREATE OR REPLACE VIEW inventory_balance AS
SELECT 
    i.id,
    i.warehouse_id,
    i.product_id,
    i.qty_full,
    i.qty_empty,
    i.qty_reserved,
    i.created_at,
    i.updated_at,
    (i.qty_full - i.qty_reserved) as qty_available
FROM inventory i;

-- ========================================
-- 2. STOCK MOVEMENTS TABLE
-- ========================================
-- Create table for audit trail of all inventory movements
CREATE TABLE IF NOT EXISTS stock_movements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    movement_type text NOT NULL CHECK (movement_type IN (
        'manual_adjustment', 'order_reserved', 'order_fulfilled', 
        'order_cancelled', 'transfer_out', 'transfer_in', 
        'damaged', 'returned', 'refill'
    )),
    inventory_id uuid REFERENCES inventory(id),
    product_id uuid NOT NULL REFERENCES products(id),
    warehouse_id uuid NOT NULL REFERENCES warehouses(id),
    reference_type text, -- 'order', 'transfer', 'adjustment'
    reference_id uuid, -- order_id, transfer_id, etc
    qty_full_change numeric NOT NULL DEFAULT 0,
    qty_empty_change numeric NOT NULL DEFAULT 0,
    qty_reserved_change numeric NOT NULL DEFAULT 0,
    old_qty_full numeric,
    new_qty_full numeric,
    old_qty_empty numeric,
    new_qty_empty numeric,
    old_qty_reserved numeric,
    new_qty_reserved numeric,
    notes text,
    created_by uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now()
);

-- Create indexes for stock movements
CREATE INDEX IF NOT EXISTS idx_stock_movements_inventory_id ON stock_movements(inventory_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product_id ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_warehouse_id ON stock_movements(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at ON stock_movements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_reference ON stock_movements(reference_type, reference_id);

-- ========================================
-- 3. RESERVE STOCK FUNCTION
-- ========================================
-- Reserve stock when an order is confirmed
CREATE OR REPLACE FUNCTION reserve_stock(
    p_product_id uuid,
    p_quantity numeric,
    p_order_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_inventory_record RECORD;
    v_reserved boolean := false;
BEGIN
    -- Find inventory with sufficient stock (prioritize by warehouse with most stock)
    FOR v_inventory_record IN
        SELECT id, warehouse_id, qty_full, qty_reserved
        FROM inventory
        WHERE product_id = p_product_id
        AND qty_full - qty_reserved >= p_quantity
        ORDER BY qty_full - qty_reserved DESC
        LIMIT 1
    LOOP
        -- Update inventory to reserve stock
        UPDATE inventory
        SET 
            qty_reserved = qty_reserved + p_quantity,
            updated_at = now()
        WHERE id = v_inventory_record.id
        AND qty_full - qty_reserved >= p_quantity; -- Double-check in case of race condition
        
        IF FOUND THEN
            -- Log the stock movement
            INSERT INTO stock_movements (
                movement_type, inventory_id, product_id, warehouse_id,
                reference_type, reference_id, qty_reserved_change,
                old_qty_reserved, new_qty_reserved, notes
            ) VALUES (
                'order_reserved', v_inventory_record.id, p_product_id, 
                v_inventory_record.warehouse_id, 'order', p_order_id, 
                p_quantity, v_inventory_record.qty_reserved, 
                v_inventory_record.qty_reserved + p_quantity,
                'Stock reserved for order'
            );
            
            v_reserved := true;
            EXIT; -- Exit loop after successful reservation
        END IF;
    END LOOP;
    
    IF NOT v_reserved THEN
        RAISE EXCEPTION 'Insufficient stock available for product %', p_product_id;
    END IF;
    
    RETURN v_reserved;
END;
$$;

-- ========================================
-- 4. FULFILL ORDER LINE FUNCTION
-- ========================================
-- Deduct stock and release reservation when order is delivered
CREATE OR REPLACE FUNCTION fulfill_order_line(
    p_product_id uuid,
    p_quantity numeric,
    p_order_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_inventory_record RECORD;
    v_fulfilled boolean := false;
BEGIN
    -- Find inventory with reserved stock for this product
    FOR v_inventory_record IN
        SELECT id, warehouse_id, qty_full, qty_empty, qty_reserved
        FROM inventory
        WHERE product_id = p_product_id
        AND qty_reserved >= p_quantity
        ORDER BY qty_reserved DESC
        LIMIT 1
    LOOP
        -- Update inventory: decrease full cylinders and reserved count
        UPDATE inventory
        SET 
            qty_full = qty_full - p_quantity,
            qty_reserved = qty_reserved - p_quantity,
            updated_at = now()
        WHERE id = v_inventory_record.id
        AND qty_reserved >= p_quantity; -- Double-check
        
        IF FOUND THEN
            -- Log the stock movement
            INSERT INTO stock_movements (
                movement_type, inventory_id, product_id, warehouse_id,
                reference_type, reference_id, 
                qty_full_change, qty_reserved_change,
                old_qty_full, new_qty_full,
                old_qty_reserved, new_qty_reserved,
                notes
            ) VALUES (
                'order_fulfilled', v_inventory_record.id, p_product_id, 
                v_inventory_record.warehouse_id, 'order', p_order_id, 
                -p_quantity, -p_quantity,
                v_inventory_record.qty_full, v_inventory_record.qty_full - p_quantity,
                v_inventory_record.qty_reserved, v_inventory_record.qty_reserved - p_quantity,
                'Stock delivered to customer'
            );
            
            v_fulfilled := true;
            EXIT;
        END IF;
    END LOOP;
    
    IF NOT v_fulfilled THEN
        RAISE EXCEPTION 'No reserved stock found for product %', p_product_id;
    END IF;
    
    RETURN v_fulfilled;
END;
$$;

-- ========================================
-- 5. RELEASE RESERVED STOCK FUNCTION
-- ========================================
-- Release reserved stock when order is cancelled
CREATE OR REPLACE FUNCTION release_reserved_stock(
    p_product_id uuid,
    p_quantity numeric,
    p_order_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_inventory_record RECORD;
    v_released boolean := false;
BEGIN
    -- Find inventory with reserved stock
    FOR v_inventory_record IN
        SELECT id, warehouse_id, qty_reserved
        FROM inventory
        WHERE product_id = p_product_id
        AND qty_reserved >= p_quantity
        ORDER BY qty_reserved DESC
        LIMIT 1
    LOOP
        -- Update inventory to release reserved stock
        UPDATE inventory
        SET 
            qty_reserved = qty_reserved - p_quantity,
            updated_at = now()
        WHERE id = v_inventory_record.id
        AND qty_reserved >= p_quantity;
        
        IF FOUND THEN
            -- Log the stock movement
            INSERT INTO stock_movements (
                movement_type, inventory_id, product_id, warehouse_id,
                reference_type, reference_id, qty_reserved_change,
                old_qty_reserved, new_qty_reserved, notes
            ) VALUES (
                'order_cancelled', v_inventory_record.id, p_product_id, 
                v_inventory_record.warehouse_id, 'order', p_order_id, 
                -p_quantity, v_inventory_record.qty_reserved, 
                v_inventory_record.qty_reserved - p_quantity,
                'Reserved stock released due to order cancellation'
            );
            
            v_released := true;
            EXIT;
        END IF;
    END LOOP;
    
    IF NOT v_released THEN
        RAISE WARNING 'No reserved stock found to release for product %', p_product_id;
        RETURN true; -- Don't fail if no reserved stock found
    END IF;
    
    RETURN v_released;
END;
$$;

-- ========================================
-- 6. TRANSFER STOCK FUNCTION
-- ========================================
-- Transfer stock between warehouses
CREATE OR REPLACE FUNCTION transfer_stock(
    p_from_warehouse_id uuid,
    p_to_warehouse_id uuid,
    p_product_id uuid,
    p_qty_full numeric,
    p_qty_empty numeric
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_source_inventory RECORD;
    v_dest_inventory RECORD;
BEGIN
    -- Validate warehouses are different
    IF p_from_warehouse_id = p_to_warehouse_id THEN
        RAISE EXCEPTION 'Source and destination warehouses must be different';
    END IF;
    
    -- Get source inventory
    SELECT * INTO v_source_inventory
    FROM inventory
    WHERE warehouse_id = p_from_warehouse_id
    AND product_id = p_product_id
    FOR UPDATE;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Source inventory not found';
    END IF;
    
    -- Validate sufficient stock
    IF v_source_inventory.qty_full < p_qty_full THEN
        RAISE EXCEPTION 'Insufficient full cylinders in source warehouse';
    END IF;
    
    IF v_source_inventory.qty_empty < p_qty_empty THEN
        RAISE EXCEPTION 'Insufficient empty cylinders in source warehouse';
    END IF;
    
    -- Check if transfer would leave less than reserved
    IF v_source_inventory.qty_full - p_qty_full < v_source_inventory.qty_reserved THEN
        RAISE EXCEPTION 'Transfer would leave insufficient stock for reservations';
    END IF;
    
    -- Update source inventory
    UPDATE inventory
    SET 
        qty_full = qty_full - p_qty_full,
        qty_empty = qty_empty - p_qty_empty,
        updated_at = now()
    WHERE id = v_source_inventory.id;
    
    -- Log source movement
    INSERT INTO stock_movements (
        movement_type, inventory_id, product_id, warehouse_id,
        qty_full_change, qty_empty_change,
        old_qty_full, new_qty_full,
        old_qty_empty, new_qty_empty,
        notes
    ) VALUES (
        'transfer_out', v_source_inventory.id, p_product_id, p_from_warehouse_id,
        -p_qty_full, -p_qty_empty,
        v_source_inventory.qty_full, v_source_inventory.qty_full - p_qty_full,
        v_source_inventory.qty_empty, v_source_inventory.qty_empty - p_qty_empty,
        'Stock transferred to warehouse ' || p_to_warehouse_id
    );
    
    -- Get or create destination inventory
    SELECT * INTO v_dest_inventory
    FROM inventory
    WHERE warehouse_id = p_to_warehouse_id
    AND product_id = p_product_id
    FOR UPDATE;
    
    IF FOUND THEN
        -- Update existing inventory
        UPDATE inventory
        SET 
            qty_full = qty_full + p_qty_full,
            qty_empty = qty_empty + p_qty_empty,
            updated_at = now()
        WHERE id = v_dest_inventory.id;
        
        -- Log destination movement
        INSERT INTO stock_movements (
            movement_type, inventory_id, product_id, warehouse_id,
            qty_full_change, qty_empty_change,
            old_qty_full, new_qty_full,
            old_qty_empty, new_qty_empty,
            notes
        ) VALUES (
            'transfer_in', v_dest_inventory.id, p_product_id, p_to_warehouse_id,
            p_qty_full, p_qty_empty,
            v_dest_inventory.qty_full, v_dest_inventory.qty_full + p_qty_full,
            v_dest_inventory.qty_empty, v_dest_inventory.qty_empty + p_qty_empty,
            'Stock transferred from warehouse ' || p_from_warehouse_id
        );
    ELSE
        -- Create new inventory record
        INSERT INTO inventory (
            warehouse_id, product_id, qty_full, qty_empty, qty_reserved
        ) VALUES (
            p_to_warehouse_id, p_product_id, p_qty_full, p_qty_empty, 0
        ) RETURNING * INTO v_dest_inventory;
        
        -- Log destination movement
        INSERT INTO stock_movements (
            movement_type, inventory_id, product_id, warehouse_id,
            qty_full_change, qty_empty_change,
            new_qty_full, new_qty_empty,
            notes
        ) VALUES (
            'transfer_in', v_dest_inventory.id, p_product_id, p_to_warehouse_id,
            p_qty_full, p_qty_empty,
            p_qty_full, p_qty_empty,
            'Initial stock from warehouse ' || p_from_warehouse_id
        );
    END IF;
    
    RETURN true;
END;
$$;

-- ========================================
-- 7. IDEMPOTENCY KEY MANAGEMENT
-- ========================================
-- Create table for idempotency keys
CREATE TABLE IF NOT EXISTS idempotency_keys (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    key_hash text NOT NULL,
    operation_type text NOT NULL,
    request_data jsonb,
    response_data jsonb,
    status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
    created_at timestamptz DEFAULT now(),
    completed_at timestamptz,
    UNIQUE(key_hash)
);

-- Create index on key_hash for fast lookups
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_hash ON idempotency_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_created_at ON idempotency_keys(created_at);

-- Function to check idempotency key
CREATE OR REPLACE FUNCTION check_idempotency_key(
    p_key_hash text,
    p_operation_type text,
    p_request_data jsonb
)
RETURNS TABLE(
    key_exists boolean,
    is_processing boolean,
    response_data jsonb,
    key_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_key_id uuid;
    v_status text;
    v_response jsonb;
BEGIN
    -- Check if key exists
    SELECT id, status, ik.response_data 
    INTO v_key_id, v_status, v_response
    FROM idempotency_keys ik
    WHERE key_hash = p_key_hash;
    
    IF FOUND THEN
        RETURN QUERY SELECT 
            true,
            v_status = 'processing',
            v_response,
            v_key_id;
    ELSE
        -- Create new key
        INSERT INTO idempotency_keys (key_hash, operation_type, request_data)
        VALUES (p_key_hash, p_operation_type, p_request_data)
        RETURNING id INTO v_key_id;
        
        RETURN QUERY SELECT 
            false,
            false,
            NULL::jsonb,
            v_key_id;
    END IF;
END;
$$;

-- Function to complete idempotency key
CREATE OR REPLACE FUNCTION complete_idempotency_key(
    p_key_id uuid,
    p_response_data jsonb,
    p_status text DEFAULT 'completed'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE idempotency_keys
    SET 
        response_data = p_response_data,
        status = p_status,
        completed_at = now()
    WHERE id = p_key_id;
END;
$$;

-- ========================================
-- 8. GRANT PERMISSIONS
-- ========================================
-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION reserve_stock(uuid, numeric, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION fulfill_order_line(uuid, numeric, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION release_reserved_stock(uuid, numeric, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION transfer_stock(uuid, uuid, uuid, numeric, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION check_idempotency_key(text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION complete_idempotency_key(uuid, jsonb, text) TO authenticated;

-- Grant access to tables
GRANT ALL ON stock_movements TO authenticated;
GRANT ALL ON idempotency_keys TO authenticated;
GRANT ALL ON inventory_balance TO authenticated;

-- ========================================
-- 9. CLEANUP OLD REFERENCES
-- ========================================
-- Remove any remaining tenant-specific functions that might conflict
DROP FUNCTION IF EXISTS auth.user_belongs_to_tenant(uuid);
DROP FUNCTION IF EXISTS auth.current_tenant_id();
DROP FUNCTION IF EXISTS validate_tenant_access(uuid, text);

COMMIT;

-- ========================================
-- VERIFICATION QUERIES
-- ========================================
-- Run these to verify the migration worked:

-- Check functions exist
SELECT 
    routine_name,
    routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN (
    'reserve_stock', 'fulfill_order_line', 
    'release_reserved_stock', 'transfer_stock',
    'check_idempotency_key', 'complete_idempotency_key'
);

-- Check tables exist
SELECT 
    table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('stock_movements', 'idempotency_keys');

-- Check view exists
SELECT 
    table_name
FROM information_schema.views
WHERE table_schema = 'public'
AND table_name = 'inventory_balance';