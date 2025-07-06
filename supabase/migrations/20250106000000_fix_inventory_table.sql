-- Fix inventory table issues
-- This migration ensures the inventory table exists with the correct name and structure

BEGIN;

-- First, check if we have an 'inventory' table that should be 'inventory_balance'
DO $$
BEGIN
    -- If 'inventory' table exists but 'inventory_balance' doesn't, rename it
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inventory' AND table_schema = 'public')
       AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inventory_balance' AND table_schema = 'public') THEN
        ALTER TABLE inventory RENAME TO inventory_balance;
        
        -- Update foreign key constraints
        ALTER TABLE inventory_balance 
            RENAME CONSTRAINT inventory_warehouse_id_fkey TO inventory_balance_warehouse_id_fkey;
        ALTER TABLE inventory_balance 
            RENAME CONSTRAINT inventory_product_id_fkey TO inventory_balance_product_id_fkey;
            
        -- Update any indexes
        IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_inventory_warehouse_product') THEN
            ALTER INDEX idx_inventory_warehouse_product RENAME TO idx_inventory_balance_warehouse_product;
        END IF;
        
        IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_inventory_low_stock') THEN
            ALTER INDEX idx_inventory_low_stock RENAME TO idx_inventory_balance_low_stock;
        END IF;
    END IF;
    
    -- If neither table exists, create inventory_balance
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
        
        -- Create indexes for performance
        CREATE INDEX idx_inventory_balance_warehouse_product ON inventory_balance(warehouse_id, product_id);
        CREATE INDEX idx_inventory_balance_low_stock ON inventory_balance(qty_full) WHERE qty_full < 10;
        CREATE INDEX idx_inventory_balance_updated_at ON inventory_balance(updated_at DESC);
    END IF;
END $$;

-- Ensure RLS is disabled on inventory_balance (single tenant system)
ALTER TABLE inventory_balance DISABLE ROW LEVEL SECURITY;

-- Drop any existing RLS policies on inventory_balance
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'inventory_balance' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON inventory_balance', pol.policyname);
    END LOOP;
END $$;

-- Update or create the trigger function for inventory_balance timestamps
CREATE OR REPLACE FUNCTION update_inventory_balance_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create or replace the trigger
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

-- Grant permissions
GRANT ALL ON inventory_balance TO authenticated;
GRANT ALL ON stock_movements TO authenticated;

-- Add helpful comments
COMMENT ON TABLE inventory_balance IS 'Tracks current inventory levels for each product at each warehouse';
COMMENT ON COLUMN inventory_balance.qty_full IS 'Number of full cylinders/units in stock';
COMMENT ON COLUMN inventory_balance.qty_empty IS 'Number of empty cylinders awaiting refill';
COMMENT ON COLUMN inventory_balance.qty_reserved IS 'Number of full cylinders reserved for pending orders';

COMMENT ON TABLE stock_movements IS 'Audit trail of all inventory movements and adjustments';
COMMENT ON COLUMN stock_movements.movement_type IS 'Type of inventory movement';
COMMENT ON COLUMN stock_movements.reference_id IS 'ID of the related record (order, transfer, etc.)';
COMMENT ON COLUMN stock_movements.reference_type IS 'Type of the related record';

COMMIT;

-- Verification queries
SELECT 
    'Table exists: ' || EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'inventory_balance')::text as inventory_balance_exists,
    'RLS enabled: ' || (SELECT relrowsecurity FROM pg_class WHERE relname = 'inventory_balance')::text as rls_status,
    'Policy count: ' || COUNT(*)::text as policy_count
FROM pg_policies 
WHERE tablename = 'inventory_balance' AND schemaname = 'public';