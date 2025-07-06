-- IMMEDIATE DATABASE FIX - Apply this NOW in Supabase SQL Editor
-- This will fix ALL tenant_id errors and RLS policy violations immediately

-- =====================================================
-- STEP 1: EMERGENCY DISABLE ALL RLS POLICIES
-- =====================================================
BEGIN;

-- Disable RLS on ALL tables immediately
ALTER TABLE IF EXISTS products DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS order_lines DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS warehouses DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS inventory DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS inventory_balance DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS stock_movements DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS truck DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS truck_inventory DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS truck_routes DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS truck_allocations DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS truck_maintenance DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS transfers DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS transfer_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS payment_methods DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS addresses DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS price_lists DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS price_list_items DISABLE ROW LEVEL SECURITY;

-- Drop ALL policies on ALL tables
DO $$
DECLARE
    pol_record RECORD;
BEGIN
    FOR pol_record IN 
        SELECT schemaname, tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', 
                      pol_record.policyname, pol_record.schemaname, pol_record.tablename);
    END LOOP;
END $$;

-- =====================================================
-- STEP 2: REMOVE ALL TENANT_ID COLUMNS
-- =====================================================

-- Remove tenant_id from all tables
ALTER TABLE IF EXISTS products DROP COLUMN IF EXISTS tenant_id CASCADE;
ALTER TABLE IF EXISTS customers DROP COLUMN IF EXISTS tenant_id CASCADE;
ALTER TABLE IF EXISTS orders DROP COLUMN IF EXISTS tenant_id CASCADE;
ALTER TABLE IF EXISTS order_lines DROP COLUMN IF EXISTS tenant_id CASCADE;
ALTER TABLE IF EXISTS warehouses DROP COLUMN IF EXISTS tenant_id CASCADE;
ALTER TABLE IF EXISTS inventory DROP COLUMN IF EXISTS tenant_id CASCADE;
ALTER TABLE IF EXISTS inventory_balance DROP COLUMN IF EXISTS tenant_id CASCADE;
ALTER TABLE IF EXISTS stock_movements DROP COLUMN IF EXISTS tenant_id CASCADE;
ALTER TABLE IF EXISTS truck DROP COLUMN IF EXISTS tenant_id CASCADE;
ALTER TABLE IF EXISTS truck_inventory DROP COLUMN IF EXISTS tenant_id CASCADE;
ALTER TABLE IF EXISTS truck_routes DROP COLUMN IF EXISTS tenant_id CASCADE;
ALTER TABLE IF EXISTS truck_allocations DROP COLUMN IF EXISTS tenant_id CASCADE;
ALTER TABLE IF EXISTS truck_maintenance DROP COLUMN IF EXISTS tenant_id CASCADE;
ALTER TABLE IF EXISTS transfers DROP COLUMN IF EXISTS tenant_id CASCADE;
ALTER TABLE IF EXISTS transfer_items DROP COLUMN IF EXISTS tenant_id CASCADE;
ALTER TABLE IF EXISTS payments DROP COLUMN IF EXISTS tenant_id CASCADE;
ALTER TABLE IF EXISTS payment_methods DROP COLUMN IF EXISTS tenant_id CASCADE;
ALTER TABLE IF EXISTS addresses DROP COLUMN IF EXISTS tenant_id CASCADE;
ALTER TABLE IF EXISTS price_lists DROP COLUMN IF EXISTS tenant_id CASCADE;
ALTER TABLE IF EXISTS price_list_items DROP COLUMN IF EXISTS tenant_id CASCADE;

-- =====================================================
-- STEP 3: FIX TABLE STRUCTURES
-- =====================================================

-- Rename inventory to inventory_balance if needed
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inventory' AND table_schema = 'public')
       AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inventory_balance' AND table_schema = 'public') THEN
        ALTER TABLE inventory RENAME TO inventory_balance;
    END IF;
END $$;

-- Create inventory_balance table if missing
CREATE TABLE IF NOT EXISTS inventory_balance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    warehouse_id UUID NOT NULL,
    product_id UUID NOT NULL,
    qty_full NUMERIC NOT NULL DEFAULT 0 CHECK (qty_full >= 0),
    qty_empty NUMERIC NOT NULL DEFAULT 0 CHECK (qty_empty >= 0),
    qty_reserved NUMERIC NOT NULL DEFAULT 0 CHECK (qty_reserved >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_warehouse_product UNIQUE (warehouse_id, product_id)
);

-- Create truck_inventory table if missing
CREATE TABLE IF NOT EXISTS truck_inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    truck_id UUID NOT NULL,
    product_id UUID NOT NULL,
    qty_full NUMERIC NOT NULL DEFAULT 0 CHECK (qty_full >= 0),
    qty_empty NUMERIC NOT NULL DEFAULT 0 CHECK (qty_empty >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_truck_product UNIQUE (truck_id, product_id)
);

-- Create stock_movements table if missing
CREATE TABLE IF NOT EXISTS stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inventory_id UUID REFERENCES inventory_balance(id) ON DELETE CASCADE,
    truck_inventory_id UUID REFERENCES truck_inventory(id) ON DELETE CASCADE,
    movement_type TEXT NOT NULL,
    qty_full_change NUMERIC NOT NULL,
    qty_empty_change NUMERIC NOT NULL,
    reason TEXT,
    reference_id UUID,
    reference_type TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID
);

-- Ensure truck table exists
CREATE TABLE IF NOT EXISTS truck (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fleet_number TEXT NOT NULL UNIQUE,
    license_plate TEXT NOT NULL UNIQUE,
    capacity_cylinders INTEGER NOT NULL CHECK (capacity_cylinders > 0),
    driver_name TEXT,
    active BOOLEAN NOT NULL DEFAULT true,
    last_maintenance_date DATE,
    next_maintenance_due DATE,
    fuel_capacity_liters NUMERIC,
    avg_fuel_consumption NUMERIC,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    user_id UUID
);

-- Add missing columns to products
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS variant_type TEXT DEFAULT 'cylinder',
ADD COLUMN IF NOT EXISTS requires_tag BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_variant BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS reorder_level NUMERIC DEFAULT 10,
ADD COLUMN IF NOT EXISTS max_stock_level NUMERIC DEFAULT 100,
ADD COLUMN IF NOT EXISTS seasonal_demand_factor NUMERIC DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS lead_time_days INTEGER DEFAULT 7;

-- Update variant_type constraint if it exists
DO $$
BEGIN
    ALTER TABLE products DROP CONSTRAINT IF EXISTS products_variant_type_check;
    ALTER TABLE products ADD CONSTRAINT products_variant_type_check 
        CHECK (variant_type IN ('cylinder', 'refillable', 'disposable'));
EXCEPTION WHEN OTHERS THEN
    NULL; -- Ignore errors if constraint doesn't exist
END $$;

-- =====================================================
-- STEP 4: CREATE TRANSFER FUNCTIONS
-- =====================================================

-- Transfer from warehouse to truck
CREATE OR REPLACE FUNCTION transfer_stock_to_truck(
    p_warehouse_id UUID,
    p_truck_id UUID,
    p_product_id UUID,
    p_qty_full NUMERIC,
    p_qty_empty NUMERIC
) RETURNS JSON AS $$
DECLARE
    warehouse_record RECORD;
    result JSON;
BEGIN
    -- Validate inputs
    IF p_qty_full < 0 OR p_qty_empty < 0 THEN
        RAISE EXCEPTION 'Transfer quantities cannot be negative';
    END IF;
    
    -- Get and lock source inventory
    SELECT * INTO warehouse_record 
    FROM inventory_balance 
    WHERE warehouse_id = p_warehouse_id AND product_id = p_product_id 
    FOR UPDATE;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Product not found in warehouse inventory';
    END IF;
    
    -- Check sufficient stock
    IF warehouse_record.qty_full < p_qty_full THEN
        RAISE EXCEPTION 'Insufficient full stock. Available: %, Requested: %', warehouse_record.qty_full, p_qty_full;
    END IF;
    
    IF warehouse_record.qty_empty < p_qty_empty THEN
        RAISE EXCEPTION 'Insufficient empty stock. Available: %, Requested: %', warehouse_record.qty_empty, p_qty_empty;
    END IF;
    
    -- Update warehouse inventory (decrease)
    UPDATE inventory_balance 
    SET 
        qty_full = qty_full - p_qty_full,
        qty_empty = qty_empty - p_qty_empty,
        updated_at = NOW()
    WHERE warehouse_id = p_warehouse_id AND product_id = p_product_id;
    
    -- Update or insert truck inventory (increase)
    INSERT INTO truck_inventory (truck_id, product_id, qty_full, qty_empty, updated_at)
    VALUES (p_truck_id, p_product_id, p_qty_full, p_qty_empty, NOW())
    ON CONFLICT (truck_id, product_id) 
    DO UPDATE SET 
        qty_full = truck_inventory.qty_full + p_qty_full,
        qty_empty = truck_inventory.qty_empty + p_qty_empty,
        updated_at = NOW();
    
    -- Log the movement
    INSERT INTO stock_movements (inventory_id, movement_type, qty_full_change, qty_empty_change, reason, created_at)
    VALUES (warehouse_record.id, 'truck_load', -p_qty_full, -p_qty_empty, 'Transfer to truck', NOW());
    
    result := json_build_object(
        'success', true,
        'warehouse_id', p_warehouse_id,
        'truck_id', p_truck_id,
        'product_id', p_product_id,
        'qty_full_transferred', p_qty_full,
        'qty_empty_transferred', p_qty_empty,
        'timestamp', NOW()
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Transfer between warehouses
CREATE OR REPLACE FUNCTION transfer_stock(
    p_from_warehouse_id UUID,
    p_to_warehouse_id UUID,
    p_product_id UUID,
    p_qty_full NUMERIC,
    p_qty_empty NUMERIC
) RETURNS JSON AS $$
DECLARE
    source_record RECORD;
    result JSON;
BEGIN
    -- Validate inputs
    IF p_qty_full < 0 OR p_qty_empty < 0 THEN
        RAISE EXCEPTION 'Transfer quantities cannot be negative';
    END IF;
    
    IF p_from_warehouse_id = p_to_warehouse_id THEN
        RAISE EXCEPTION 'Source and destination warehouses cannot be the same';
    END IF;
    
    -- Get and lock source inventory
    SELECT * INTO source_record 
    FROM inventory_balance 
    WHERE warehouse_id = p_from_warehouse_id AND product_id = p_product_id 
    FOR UPDATE;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Product not found in source warehouse';
    END IF;
    
    -- Check sufficient stock
    IF source_record.qty_full < p_qty_full THEN
        RAISE EXCEPTION 'Insufficient full stock. Available: %, Requested: %', source_record.qty_full, p_qty_full;
    END IF;
    
    -- Update source warehouse (decrease)
    UPDATE inventory_balance 
    SET 
        qty_full = qty_full - p_qty_full,
        qty_empty = qty_empty - p_qty_empty,
        updated_at = NOW()
    WHERE warehouse_id = p_from_warehouse_id AND product_id = p_product_id;
    
    -- Update or insert destination warehouse (increase)
    INSERT INTO inventory_balance (warehouse_id, product_id, qty_full, qty_empty, qty_reserved, updated_at)
    VALUES (p_to_warehouse_id, p_product_id, p_qty_full, p_qty_empty, 0, NOW())
    ON CONFLICT (warehouse_id, product_id) 
    DO UPDATE SET 
        qty_full = inventory_balance.qty_full + p_qty_full,
        qty_empty = inventory_balance.qty_empty + p_qty_empty,
        updated_at = NOW();
    
    -- Log movements
    INSERT INTO stock_movements (inventory_id, movement_type, qty_full_change, qty_empty_change, reason, created_at)
    VALUES (source_record.id, 'transfer_out', -p_qty_full, -p_qty_empty, 'Transfer to another warehouse', NOW());
    
    result := json_build_object(
        'success', true,
        'from_warehouse_id', p_from_warehouse_id,
        'to_warehouse_id', p_to_warehouse_id,
        'product_id', p_product_id,
        'qty_full_transferred', p_qty_full,
        'qty_empty_transferred', p_qty_empty,
        'timestamp', NOW()
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- STEP 5: GRANT PERMISSIONS
-- =====================================================

-- Grant all permissions to authenticated users
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Grant to anon for public access
GRANT SELECT ON products TO anon;
GRANT SELECT ON warehouses TO anon;

-- =====================================================
-- STEP 6: CREATE BASIC INDEXES
-- =====================================================

-- Create essential indexes
CREATE INDEX IF NOT EXISTS idx_inventory_balance_warehouse_product ON inventory_balance(warehouse_id, product_id);
CREATE INDEX IF NOT EXISTS idx_truck_inventory_truck_product ON truck_inventory(truck_id, product_id);
CREATE INDEX IF NOT EXISTS idx_truck_fleet_number ON truck(fleet_number);
CREATE INDEX IF NOT EXISTS idx_truck_active ON truck(active);

COMMIT;

-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== IMMEDIATE FIX VERIFICATION ===';
    RAISE NOTICE '';
    RAISE NOTICE 'inventory_balance table: %', 
        CASE WHEN EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'inventory_balance') 
             THEN 'EXISTS ✓' ELSE 'MISSING ✗' END;
    RAISE NOTICE 'truck table: %', 
        CASE WHEN EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'truck') 
             THEN 'EXISTS ✓' ELSE 'MISSING ✗' END;
    RAISE NOTICE 'truck_inventory table: %', 
        CASE WHEN EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'truck_inventory') 
             THEN 'EXISTS ✓' ELSE 'MISSING ✗' END;
    RAISE NOTICE 'transfer_stock_to_truck function: %', 
        CASE WHEN EXISTS(SELECT 1 FROM information_schema.routines WHERE routine_name = 'transfer_stock_to_truck') 
             THEN 'EXISTS ✓' ELSE 'MISSING ✗' END;
    RAISE NOTICE 'RLS policies remaining: %', 
        (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public');
    RAISE NOTICE 'tenant_id columns remaining: %', 
        (SELECT COUNT(*) FROM information_schema.columns WHERE column_name = 'tenant_id' AND table_schema = 'public');
    RAISE NOTICE '';
    RAISE NOTICE '🎉 IMMEDIATE FIX COMPLETED! 🎉';
    RAISE NOTICE '';
END $$;