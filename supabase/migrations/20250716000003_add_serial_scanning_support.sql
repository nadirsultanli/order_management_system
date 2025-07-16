-- =============================================================================
-- ADD SERIAL NUMBER SCANNING SUPPORT TO STOCK MOVEMENTS
-- =============================================================================

-- First, update stock_movements table to include better tracking for warehouse operations
DO $$
BEGIN
    -- Add product_id directly to stock_movements for easier querying
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'stock_movements' 
        AND column_name = 'product_id'
    ) THEN
        ALTER TABLE stock_movements 
        ADD COLUMN product_id UUID REFERENCES products(id) ON DELETE CASCADE;
    END IF;

    -- Add warehouse_id directly to stock_movements  
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'stock_movements' 
        AND column_name = 'warehouse_id'
    ) THEN
        ALTER TABLE stock_movements 
        ADD COLUMN warehouse_id UUID REFERENCES warehouses(id) ON DELETE CASCADE;
    END IF;

    -- Add reserved quantity change tracking
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'stock_movements' 
        AND column_name = 'qty_reserved_change'
    ) THEN
        ALTER TABLE stock_movements 
        ADD COLUMN qty_reserved_change NUMERIC DEFAULT 0;
    END IF;

    -- Add notes field for additional context
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'stock_movements' 
        AND column_name = 'notes'
    ) THEN
        ALTER TABLE stock_movements 
        ADD COLUMN notes TEXT;
    END IF;

    -- Add scanned serial count for verification
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'stock_movements' 
        AND column_name = 'scanned_serial_count'
    ) THEN
        ALTER TABLE stock_movements 
        ADD COLUMN scanned_serial_count INTEGER DEFAULT 0;
    END IF;

    -- Add scanning mode flag
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'stock_movements' 
        AND column_name = 'requires_serial_scan'
    ) THEN
        ALTER TABLE stock_movements 
        ADD COLUMN requires_serial_scan BOOLEAN DEFAULT false;
    END IF;

    -- Add scanning completion flag
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'stock_movements' 
        AND column_name = 'serial_scan_completed'
    ) THEN
        ALTER TABLE stock_movements 
        ADD COLUMN serial_scan_completed BOOLEAN DEFAULT false;
    END IF;
END $$;

-- Create table for linking stock movements to specific cylinder assets
CREATE TABLE IF NOT EXISTS stock_movement_serials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stock_movement_id UUID NOT NULL REFERENCES stock_movements(id) ON DELETE CASCADE,
    cylinder_asset_id UUID NOT NULL REFERENCES cylinder_assets(id) ON DELETE CASCADE,
    serial_number VARCHAR(50) NOT NULL, -- Denormalized for faster lookup
    action VARCHAR(20) NOT NULL CHECK (action IN ('scanned_in', 'scanned_out', 'counted')),
    scanned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    scanned_by_user_id UUID,
    scan_location VARCHAR(100), -- e.g., "Dock 3", "Truck 4", "Warehouse A"
    scan_device_id VARCHAR(100), -- Device identifier for tracking scanner used
    
    -- Condition tracking at time of scan
    condition_at_scan VARCHAR(20) CHECK (condition_at_scan IN ('full', 'empty', 'damaged', 'quarantine', 'under_maintenance')),
    damage_notes TEXT, -- If damaged, record details
    
    -- Audit trail
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure unique serial per movement
    UNIQUE(stock_movement_id, cylinder_asset_id)
);

-- Create indexes for serial scanning performance
CREATE INDEX IF NOT EXISTS idx_stock_movement_serials_movement_id ON stock_movement_serials (stock_movement_id);
CREATE INDEX IF NOT EXISTS idx_stock_movement_serials_cylinder_asset_id ON stock_movement_serials (cylinder_asset_id);
CREATE INDEX IF NOT EXISTS idx_stock_movement_serials_serial_number ON stock_movement_serials (serial_number);
CREATE INDEX IF NOT EXISTS idx_stock_movement_serials_scanned_at ON stock_movement_serials (scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movement_serials_scan_device ON stock_movement_serials (scan_device_id) WHERE scan_device_id IS NOT NULL;

-- Update stock_movements indexes to include new fields
CREATE INDEX IF NOT EXISTS idx_stock_movements_product_warehouse ON stock_movements (product_id, warehouse_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_requires_scan ON stock_movements (requires_serial_scan) WHERE requires_serial_scan = true;
CREATE INDEX IF NOT EXISTS idx_stock_movements_scan_completed ON stock_movements (serial_scan_completed, requires_serial_scan) WHERE requires_serial_scan = true;

-- Function to start a stock movement with serial scanning
CREATE OR REPLACE FUNCTION create_stock_movement_with_scanning(
    p_product_id UUID,
    p_warehouse_id UUID,
    p_movement_type TEXT,
    p_qty_full_change NUMERIC DEFAULT 0,
    p_qty_empty_change NUMERIC DEFAULT 0,
    p_qty_reserved_change NUMERIC DEFAULT 0,
    p_reference_type TEXT DEFAULT NULL,
    p_reference_id UUID DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_requires_serial_scan BOOLEAN DEFAULT false,
    p_created_by_user_id UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    movement_id UUID;
    inventory_id UUID;
BEGIN
    -- Get or create inventory balance record
    SELECT id INTO inventory_id
    FROM inventory_balance 
    WHERE product_id = p_product_id AND warehouse_id = p_warehouse_id;
    
    IF inventory_id IS NULL THEN
        INSERT INTO inventory_balance (product_id, warehouse_id, qty_full, qty_empty, qty_reserved)
        VALUES (p_product_id, p_warehouse_id, 0, 0, 0)
        RETURNING id INTO inventory_id;
    END IF;
    
    -- Create stock movement record
    INSERT INTO stock_movements (
        inventory_id,
        product_id,
        warehouse_id,
        movement_type,
        qty_full_change,
        qty_empty_change,
        qty_reserved_change,
        reference_type,
        reference_id,
        notes,
        requires_serial_scan,
        serial_scan_completed,
        scanned_serial_count,
        created_by
    ) VALUES (
        inventory_id,
        p_product_id,
        p_warehouse_id,
        p_movement_type,
        p_qty_full_change,
        p_qty_empty_change,
        p_qty_reserved_change,
        p_reference_type,
        p_reference_id,
        p_notes,
        p_requires_serial_scan,
        NOT p_requires_serial_scan, -- If no scanning required, mark as completed
        0,
        p_created_by_user_id
    ) RETURNING id INTO movement_id;
    
    -- If no serial scanning required, update inventory immediately
    IF NOT p_requires_serial_scan THEN
        UPDATE inventory_balance 
        SET 
            qty_full = qty_full + p_qty_full_change,
            qty_empty = qty_empty + p_qty_empty_change,
            qty_reserved = qty_reserved + p_qty_reserved_change,
            updated_at = NOW()
        WHERE id = inventory_id;
    END IF;
    
    RETURN movement_id;
END;
$$ LANGUAGE plpgsql;

-- Function to scan a serial number for a stock movement
CREATE OR REPLACE FUNCTION scan_serial_for_movement(
    p_stock_movement_id UUID,
    p_serial_number VARCHAR(50),
    p_action VARCHAR(20),
    p_condition_at_scan VARCHAR(20) DEFAULT 'full',
    p_scan_location VARCHAR(100) DEFAULT NULL,
    p_scan_device_id VARCHAR(100) DEFAULT NULL,
    p_damage_notes TEXT DEFAULT NULL,
    p_scanned_by_user_id UUID DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    cylinder_asset_record RECORD;
    movement_record RECORD;
    existing_scan UUID;
BEGIN
    -- Get stock movement details
    SELECT * INTO movement_record
    FROM stock_movements 
    WHERE id = p_stock_movement_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Stock movement not found: %', p_stock_movement_id;
    END IF;
    
    -- Find cylinder asset by serial number
    SELECT * INTO cylinder_asset_record
    FROM cylinder_assets 
    WHERE serial_number = p_serial_number AND is_active = true;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Cylinder asset not found for serial number: %', p_serial_number;
    END IF;
    
    -- Check if this serial is already scanned for this movement
    SELECT id INTO existing_scan
    FROM stock_movement_serials 
    WHERE stock_movement_id = p_stock_movement_id 
      AND cylinder_asset_id = cylinder_asset_record.id;
    
    IF existing_scan IS NOT NULL THEN
        RAISE EXCEPTION 'Serial number % already scanned for this movement', p_serial_number;
    END IF;
    
    -- Validate that this cylinder matches the product in the movement
    IF cylinder_asset_record.product_id != movement_record.product_id THEN
        RAISE EXCEPTION 'Cylinder serial % does not match movement product', p_serial_number;
    END IF;
    
    -- Record the scan
    INSERT INTO stock_movement_serials (
        stock_movement_id,
        cylinder_asset_id,
        serial_number,
        action,
        condition_at_scan,
        scan_location,
        scan_device_id,
        damage_notes,
        scanned_by_user_id
    ) VALUES (
        p_stock_movement_id,
        cylinder_asset_record.id,
        p_serial_number,
        p_action,
        p_condition_at_scan,
        p_scan_location,
        p_scan_device_id,
        p_damage_notes,
        p_scanned_by_user_id
    );
    
    -- Update scanned count
    UPDATE stock_movements 
    SET scanned_serial_count = scanned_serial_count + 1
    WHERE id = p_stock_movement_id;
    
    -- Update cylinder asset location and condition
    UPDATE cylinder_assets 
    SET 
        current_condition = p_condition_at_scan,
        current_location_type = 'warehouse',
        current_location_id = movement_record.warehouse_id,
        warehouse_id = movement_record.warehouse_id,
        updated_at = NOW(),
        updated_by = p_scanned_by_user_id
    WHERE id = cylinder_asset_record.id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to complete serial scanning for a movement
CREATE OR REPLACE FUNCTION complete_serial_scanning(
    p_stock_movement_id UUID,
    p_completed_by_user_id UUID DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    movement_record RECORD;
    expected_qty INTEGER;
    scanned_qty INTEGER;
BEGIN
    -- Get movement details
    SELECT * INTO movement_record
    FROM stock_movements 
    WHERE id = p_stock_movement_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Stock movement not found: %', p_stock_movement_id;
    END IF;
    
    IF NOT movement_record.requires_serial_scan THEN
        RAISE EXCEPTION 'This movement does not require serial scanning';
    END IF;
    
    IF movement_record.serial_scan_completed THEN
        RAISE EXCEPTION 'Serial scanning already completed for this movement';
    END IF;
    
    -- Calculate expected quantity based on movement type
    expected_qty := ABS(movement_record.qty_full_change) + ABS(movement_record.qty_empty_change);
    scanned_qty := movement_record.scanned_serial_count;
    
    -- Validate that all expected serials have been scanned
    IF scanned_qty != expected_qty THEN
        RAISE EXCEPTION 'Serial scan count mismatch. Expected: %, Scanned: %', expected_qty, scanned_qty;
    END IF;
    
    -- Mark scanning as completed
    UPDATE stock_movements 
    SET 
        serial_scan_completed = true,
        notes = COALESCE(notes, '') || ' | Serial scanning completed with ' || scanned_qty || ' cylinders'
    WHERE id = p_stock_movement_id;
    
    -- Now apply the inventory changes
    UPDATE inventory_balance 
    SET 
        qty_full = qty_full + movement_record.qty_full_change,
        qty_empty = qty_empty + movement_record.qty_empty_change,
        qty_reserved = qty_reserved + movement_record.qty_reserved_change,
        updated_at = NOW()
    WHERE id = movement_record.inventory_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to get pending serial scans for a movement
CREATE OR REPLACE FUNCTION get_pending_serial_scans(p_stock_movement_id UUID)
RETURNS TABLE (
    movement_id UUID,
    movement_type TEXT,
    product_name TEXT,
    product_sku TEXT,
    warehouse_name TEXT,
    expected_quantity INTEGER,
    scanned_count INTEGER,
    remaining_count INTEGER,
    requires_scanning BOOLEAN,
    scan_completed BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sm.id,
        sm.movement_type,
        p.name,
        p.sku,
        w.name,
        (ABS(sm.qty_full_change) + ABS(sm.qty_empty_change))::INTEGER,
        sm.scanned_serial_count,
        (ABS(sm.qty_full_change) + ABS(sm.qty_empty_change) - sm.scanned_serial_count)::INTEGER,
        sm.requires_serial_scan,
        sm.serial_scan_completed
    FROM stock_movements sm
    LEFT JOIN products p ON sm.product_id = p.id
    LEFT JOIN warehouses w ON sm.warehouse_id = w.id
    WHERE sm.id = p_stock_movement_id;
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON TABLE stock_movement_serials IS 'Links stock movements to specific cylinder assets via serial number scanning';
COMMENT ON COLUMN stock_movement_serials.action IS 'Type of scan action: scanned_in, scanned_out, counted';
COMMENT ON COLUMN stock_movement_serials.condition_at_scan IS 'Condition of cylinder when scanned';
COMMENT ON COLUMN stock_movement_serials.scan_location IS 'Physical location where scan occurred';
COMMENT ON COLUMN stock_movement_serials.scan_device_id IS 'Identifier of scanning device used';

COMMENT ON FUNCTION create_stock_movement_with_scanning IS 'Creates a stock movement with optional serial scanning requirement';
COMMENT ON FUNCTION scan_serial_for_movement IS 'Records a scanned serial number for a stock movement';
COMMENT ON FUNCTION complete_serial_scanning IS 'Completes serial scanning and applies inventory changes';
COMMENT ON FUNCTION get_pending_serial_scans IS 'Gets information about pending serial scans for a movement';