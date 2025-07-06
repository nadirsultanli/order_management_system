-- Fix trucks table issues
-- This migration ensures the trucks table exists with the correct structure and no tenant issues

BEGIN;

-- Create trucks table if it doesn't exist
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
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure RLS is disabled on truck table (single tenant system)
ALTER TABLE truck DISABLE ROW LEVEL SECURITY;

-- Drop any existing RLS policies on truck
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'truck' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON truck', pol.policyname);
    END LOOP;
END $$;

-- Create or update the trigger function for truck timestamps
CREATE OR REPLACE FUNCTION update_truck_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create or replace the trigger
DROP TRIGGER IF EXISTS update_truck_timestamp ON truck;
CREATE TRIGGER update_truck_timestamp
    BEFORE UPDATE ON truck
    FOR EACH ROW
    EXECUTE FUNCTION update_truck_timestamp();

-- Create supporting tables if they don't exist

-- Truck inventory table
CREATE TABLE IF NOT EXISTS truck_inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    truck_id UUID NOT NULL REFERENCES truck(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    qty_full NUMERIC NOT NULL DEFAULT 0 CHECK (qty_full >= 0),
    qty_empty NUMERIC NOT NULL DEFAULT 0 CHECK (qty_empty >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Ensure unique inventory record per truck/product combination
    CONSTRAINT unique_truck_product UNIQUE (truck_id, product_id)
);

-- Truck routes table
CREATE TABLE IF NOT EXISTS truck_routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    truck_id UUID NOT NULL REFERENCES truck(id) ON DELETE CASCADE,
    route_date DATE NOT NULL,
    planned_start_time TIME,
    planned_end_time TIME,
    actual_start_time TIME,
    actual_end_time TIME,
    route_status TEXT NOT NULL DEFAULT 'planned' CHECK (route_status IN ('planned', 'in_progress', 'completed', 'cancelled')),
    total_distance_km NUMERIC,
    estimated_duration_hours NUMERIC,
    actual_duration_hours NUMERIC,
    fuel_used_liters NUMERIC,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Ensure unique route per truck per day
    CONSTRAINT unique_truck_route_date UNIQUE (truck_id, route_date)
);

-- Truck allocations table
CREATE TABLE IF NOT EXISTS truck_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    truck_id UUID NOT NULL REFERENCES truck(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    allocation_date DATE NOT NULL,
    estimated_weight_kg NUMERIC NOT NULL CHECK (estimated_weight_kg > 0),
    stop_sequence INTEGER,
    status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'loaded', 'delivered', 'cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Truck maintenance table
CREATE TABLE IF NOT EXISTS truck_maintenance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    truck_id UUID NOT NULL REFERENCES truck(id) ON DELETE CASCADE,
    maintenance_type TEXT NOT NULL CHECK (maintenance_type IN ('routine', 'repair', 'inspection', 'emergency')),
    scheduled_date DATE NOT NULL,
    completed_date DATE,
    description TEXT NOT NULL,
    cost NUMERIC,
    mechanic TEXT,
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Disable RLS on all truck-related tables
ALTER TABLE truck_inventory DISABLE ROW LEVEL SECURITY;
ALTER TABLE truck_routes DISABLE ROW LEVEL SECURITY;
ALTER TABLE truck_allocations DISABLE ROW LEVEL SECURITY;
ALTER TABLE truck_maintenance DISABLE ROW LEVEL SECURITY;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_truck_fleet_number ON truck(fleet_number);
CREATE INDEX IF NOT EXISTS idx_truck_license_plate ON truck(license_plate);
CREATE INDEX IF NOT EXISTS idx_truck_active ON truck(active);
CREATE INDEX IF NOT EXISTS idx_truck_next_maintenance ON truck(next_maintenance_due) WHERE next_maintenance_due IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_truck_inventory_truck_id ON truck_inventory(truck_id);
CREATE INDEX IF NOT EXISTS idx_truck_inventory_product_id ON truck_inventory(product_id);

CREATE INDEX IF NOT EXISTS idx_truck_routes_truck_date ON truck_routes(truck_id, route_date);
CREATE INDEX IF NOT EXISTS idx_truck_routes_date ON truck_routes(route_date);

CREATE INDEX IF NOT EXISTS idx_truck_allocations_truck_date ON truck_allocations(truck_id, allocation_date);
CREATE INDEX IF NOT EXISTS idx_truck_allocations_order_id ON truck_allocations(order_id);

CREATE INDEX IF NOT EXISTS idx_truck_maintenance_truck_id ON truck_maintenance(truck_id);
CREATE INDEX IF NOT EXISTS idx_truck_maintenance_scheduled_date ON truck_maintenance(scheduled_date);

-- Grant permissions
GRANT ALL ON truck TO authenticated;
GRANT ALL ON truck_inventory TO authenticated;
GRANT ALL ON truck_routes TO authenticated;
GRANT ALL ON truck_allocations TO authenticated;
GRANT ALL ON truck_maintenance TO authenticated;

-- Add helpful comments
COMMENT ON TABLE truck IS 'Fleet management - tracks all delivery trucks';
COMMENT ON COLUMN truck.fleet_number IS 'Unique fleet identifier for the truck';
COMMENT ON COLUMN truck.license_plate IS 'Vehicle license plate number';
COMMENT ON COLUMN truck.capacity_cylinders IS 'Maximum number of cylinders the truck can carry';
COMMENT ON COLUMN truck.active IS 'Whether the truck is currently in active service';

COMMENT ON TABLE truck_inventory IS 'Current inventory loaded on each truck';
COMMENT ON TABLE truck_routes IS 'Daily route planning and tracking';
COMMENT ON TABLE truck_allocations IS 'Order assignments to specific trucks';
COMMENT ON TABLE truck_maintenance IS 'Maintenance scheduling and tracking';

COMMIT;

-- Verification queries
SELECT 
    'Truck table exists: ' || EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'truck')::text as truck_exists,
    'RLS enabled: ' || (SELECT relrowsecurity FROM pg_class WHERE relname = 'truck')::text as truck_rls_status,
    'Policy count: ' || COUNT(*)::text as truck_policy_count
FROM pg_policies 
WHERE tablename = 'truck' AND schemaname = 'public';