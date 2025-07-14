-- Fix driver_id foreign key constraint and RLS issues
-- This migration adds proper foreign key constraint for driver_id to admin_users.id

BEGIN;

-- First ensure RLS is disabled on truck_routes table
ALTER TABLE truck_routes DISABLE ROW LEVEL SECURITY;

-- Drop any existing RLS policies on truck_routes
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'truck_routes' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON truck_routes', pol.policyname);
    END LOOP;
END $$;

-- Add proper foreign key constraint for driver_id to admin_users.id
-- First check if the constraint already exists
DO $$
BEGIN
    -- Check if foreign key constraint exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'fk_truck_routes_driver' 
        AND conrelid = 'truck_routes'::regclass
    ) THEN
        -- Add the foreign key constraint
        ALTER TABLE truck_routes 
        ADD CONSTRAINT fk_truck_routes_driver 
        FOREIGN KEY (driver_id) REFERENCES admin_users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Ensure permissions are granted
GRANT ALL ON truck_routes TO authenticated;

-- Add helpful comment
COMMENT ON COLUMN truck_routes.driver_id IS 'Foreign key to admin_users.id for driver assignment';

-- Verification
SELECT 
    'Truck routes driver FK fix verification:' as status,
    'Table exists: ' || EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'truck_routes')::text as table_exists,
    'RLS enabled: ' || (SELECT relrowsecurity FROM pg_class WHERE relname = 'truck_routes')::text as rls_status,
    'Policy count: ' || COUNT(*)::text as policy_count,
    'FK constraint exists: ' || EXISTS(
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'fk_truck_routes_driver' 
        AND conrelid = 'truck_routes'::regclass
    )::text as fk_exists
FROM pg_policies 
WHERE tablename = 'truck_routes' AND schemaname = 'public';

COMMIT;