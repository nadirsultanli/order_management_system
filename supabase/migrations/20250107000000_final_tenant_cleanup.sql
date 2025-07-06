-- Final cleanup for tenant_id references and inventory system
-- This migration ensures all remaining tenant_id references are removed
-- and the inventory system functions correctly

BEGIN;

-- First, let's check and drop any remaining RLS policies that might reference tenant_id
DO $$
DECLARE
    pol RECORD;
    tbl TEXT;
    table_names TEXT[] := ARRAY['customers', 'orders', 'order_lines', 'products', 'inventory', 'inventory_balance', 'warehouses', 'transfers', 'transfer_items', 'price_lists', 'price_list_items', 'addresses', 'truck', 'truck_inventory', 'truck_routes', 'truck_allocations', 'truck_maintenance'];
BEGIN
    FOREACH tbl IN ARRAY table_names
    LOOP
        -- Check if table exists
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = tbl AND table_schema = 'public') THEN
            -- Drop all policies for this table
            FOR pol IN 
                SELECT policyname 
                FROM pg_policies 
                WHERE tablename = tbl AND schemaname = 'public'
            LOOP
                EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, tbl);
            END LOOP;
            
            -- Disable RLS on the table
            EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', tbl);
        END IF;
    END LOOP;
END $$;

-- Drop any remaining tenant-related functions
DROP FUNCTION IF EXISTS auth.user_belongs_to_tenant(uuid);
DROP FUNCTION IF EXISTS auth.current_tenant_id();
DROP FUNCTION IF EXISTS validate_tenant_access(uuid, text);
DROP FUNCTION IF EXISTS reserve_stock(uuid, numeric, uuid);
DROP FUNCTION IF EXISTS fulfill_order_line(uuid, numeric, uuid);
DROP FUNCTION IF EXISTS release_reserved_stock(uuid, numeric, uuid);
DROP FUNCTION IF EXISTS auth.user_has_role(text);
DROP FUNCTION IF EXISTS log_rls_violation(text, text, jsonb);
DROP FUNCTION IF EXISTS check_rls_status(text[]);

-- Drop audit log table if it exists
DROP TABLE IF EXISTS rls_audit_log;

-- Fix the manual migration index that references tenant_id
DROP INDEX IF EXISTS idx_products_stock_thresholds;

-- Create the corrected index without tenant_id
CREATE INDEX IF NOT EXISTS idx_products_stock_thresholds 
    ON products (reorder_level, max_stock_level) WHERE reorder_level IS NOT NULL;

-- Ensure inventory_balance table exists with correct structure
DO $$
BEGIN
    -- If inventory table exists but inventory_balance doesn't, rename it
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inventory' AND table_schema = 'public')
       AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inventory_balance' AND table_schema = 'public') THEN
        ALTER TABLE inventory RENAME TO inventory_balance;
    END IF;
    
    -- If neither exists, create inventory_balance
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inventory_balance' AND table_schema = 'public') THEN
        CREATE TABLE inventory_balance (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
            product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
            qty_full NUMERIC NOT NULL DEFAULT 0 CHECK (qty_full >= 0),
            qty_empty NUMERIC NOT NULL DEFAULT 0 CHECK (qty_empty >= 0),
            qty_reserved NUMERIC NOT NULL DEFAULT 0 CHECK (qty_reserved >= 0 AND qty_reserved <= qty_full),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            
            -- Ensure unique inventory record per warehouse/product combination
            CONSTRAINT unique_warehouse_product UNIQUE (warehouse_id, product_id)
        );
    END IF;
END $$;

-- Ensure all necessary columns exist in products table
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS reorder_level NUMERIC DEFAULT 10 CHECK (reorder_level >= 0),
ADD COLUMN IF NOT EXISTS max_stock_level NUMERIC DEFAULT 100 CHECK (max_stock_level >= 0 AND max_stock_level >= reorder_level),
ADD COLUMN IF NOT EXISTS seasonal_demand_factor NUMERIC DEFAULT 1.0 CHECK (seasonal_demand_factor > 0),
ADD COLUMN IF NOT EXISTS lead_time_days INTEGER DEFAULT 7 CHECK (lead_time_days >= 0);

-- Set smart defaults for products that don't have thresholds
UPDATE products 
SET 
    reorder_level = CASE 
        WHEN capacity_kg IS NOT NULL AND capacity_kg >= 50 THEN 5    -- Large cylinders: lower reorder threshold
        WHEN capacity_kg IS NOT NULL AND capacity_kg >= 20 THEN 10   -- Medium cylinders: standard threshold
        WHEN capacity_kg IS NOT NULL AND capacity_kg >= 5 THEN 20    -- Small cylinders: higher threshold
        ELSE 10                                                      -- Default for other products
    END,
    max_stock_level = CASE 
        WHEN capacity_kg IS NOT NULL AND capacity_kg >= 50 THEN 50   -- Large cylinders: lower max stock
        WHEN capacity_kg IS NOT NULL AND capacity_kg >= 20 THEN 100  -- Medium cylinders: standard max stock
        WHEN capacity_kg IS NOT NULL AND capacity_kg >= 5 THEN 200   -- Small cylinders: higher max stock
        ELSE 100                                                     -- Default for other products
    END,
    seasonal_demand_factor = 1.0,
    lead_time_days = CASE 
        WHEN variant_type = 'refillable' THEN 3                     -- Refillable products are faster to restock
        WHEN variant_type = 'disposable' THEN 14                    -- Disposable products may take longer
        ELSE 7                                                       -- Standard lead time
    END
WHERE reorder_level IS NULL OR max_stock_level IS NULL OR seasonal_demand_factor IS NULL OR lead_time_days IS NULL;

-- Ensure RLS is disabled on all tables
ALTER TABLE IF EXISTS customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS order_lines DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS products DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS inventory_balance DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS warehouses DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS transfers DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS transfer_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS price_lists DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS price_list_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS addresses DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS truck DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS truck_inventory DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS truck_routes DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS truck_allocations DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS truck_maintenance DISABLE ROW LEVEL SECURITY;

-- Create necessary indexes for inventory_balance if they don't exist
CREATE INDEX IF NOT EXISTS idx_inventory_balance_warehouse_product ON inventory_balance(warehouse_id, product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_balance_low_stock ON inventory_balance(qty_full) WHERE qty_full < 10;
CREATE INDEX IF NOT EXISTS idx_inventory_balance_updated_at ON inventory_balance(updated_at DESC);

-- Create indexes for products performance
CREATE INDEX IF NOT EXISTS idx_products_reorder_level ON products (reorder_level) WHERE reorder_level IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_active_status ON products (status) WHERE status = 'active';

-- Create or update timestamp trigger for inventory_balance
CREATE OR REPLACE FUNCTION update_inventory_balance_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_inventory_balance_timestamp ON inventory_balance;
CREATE TRIGGER update_inventory_balance_timestamp
    BEFORE UPDATE ON inventory_balance
    FOR EACH ROW
    EXECUTE FUNCTION update_inventory_balance_timestamp();

-- Create stock movement tracking table if it doesn't exist
CREATE TABLE IF NOT EXISTS stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inventory_id UUID NOT NULL REFERENCES inventory_balance(id) ON DELETE CASCADE,
    movement_type TEXT NOT NULL CHECK (movement_type IN ('adjustment', 'transfer_in', 'transfer_out', 'order_reserve', 'order_fulfill', 'order_cancel')),
    qty_full_change NUMERIC NOT NULL,
    qty_empty_change NUMERIC NOT NULL,
    reason TEXT,
    reference_id UUID, -- Can reference order_id, transfer_id, etc.
    reference_type TEXT, -- 'order', 'transfer', 'adjustment', etc.
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- Create indexes for stock movements
CREATE INDEX IF NOT EXISTS idx_stock_movements_inventory_id ON stock_movements(inventory_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at ON stock_movements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_reference ON stock_movements(reference_type, reference_id);

-- Disable RLS on stock_movements
ALTER TABLE stock_movements DISABLE ROW LEVEL SECURITY;

-- Grant appropriate permissions
GRANT ALL ON inventory_balance TO authenticated;
GRANT ALL ON stock_movements TO authenticated;
GRANT ALL ON products TO authenticated;
GRANT ALL ON warehouses TO authenticated;
GRANT ALL ON customers TO authenticated;
GRANT ALL ON orders TO authenticated;
GRANT ALL ON order_lines TO authenticated;

-- Add helpful comments
COMMENT ON TABLE inventory_balance IS 'Tracks current inventory levels for each product at each warehouse';
COMMENT ON COLUMN inventory_balance.qty_full IS 'Number of full cylinders/units in stock';
COMMENT ON COLUMN inventory_balance.qty_empty IS 'Number of empty cylinders awaiting refill';
COMMENT ON COLUMN inventory_balance.qty_reserved IS 'Number of full cylinders reserved for pending orders';

COMMENT ON TABLE stock_movements IS 'Audit trail of all inventory movements and adjustments';
COMMENT ON COLUMN stock_movements.movement_type IS 'Type of inventory movement';
COMMENT ON COLUMN stock_movements.reference_id IS 'ID of the related record (order, transfer, etc.)';
COMMENT ON COLUMN stock_movements.reference_type IS 'Type of the related record';

COMMENT ON COLUMN products.reorder_level IS 'Minimum stock level that triggers restocking alerts and transfers';
COMMENT ON COLUMN products.max_stock_level IS 'Maximum recommended stock level to prevent overstocking';
COMMENT ON COLUMN products.seasonal_demand_factor IS 'Multiplier for seasonal demand variations (1.0 = normal, >1.0 = peak season)';
COMMENT ON COLUMN products.lead_time_days IS 'Expected days from order to delivery for this product';

COMMIT;

-- Verification queries
SELECT 
    'Tables verification:' as status,
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'inventory_balance')::text as inventory_balance_exists,
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'stock_movements')::text as stock_movements_exists,
    NOT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'inventory')::text as old_inventory_removed;

SELECT 
    'RLS verification:' as status,
    COUNT(*)::text as total_rls_policies
FROM pg_policies 
WHERE schemaname = 'public';

SELECT 
    'Products thresholds verification:' as status,
    COUNT(*)::text as total_products,
    COUNT(CASE WHEN reorder_level IS NOT NULL THEN 1 END)::text as products_with_reorder_level,
    COUNT(CASE WHEN max_stock_level IS NOT NULL THEN 1 END)::text as products_with_max_stock_level
FROM products;