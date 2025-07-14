-- Fix truck_routes RLS issues
-- This migration ensures truck_routes table has RLS disabled and no conflicting policies

BEGIN;

-- Disable RLS on truck_routes table
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

-- Ensure permissions are granted
GRANT ALL ON truck_routes TO authenticated;

-- Verification
SELECT 
    'Truck routes RLS status:' as status,
    'Table exists: ' || EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'truck_routes')::text as table_exists,
    'RLS enabled: ' || (SELECT relrowsecurity FROM pg_class WHERE relname = 'truck_routes')::text as rls_status,
    'Policy count: ' || COUNT(*)::text as policy_count
FROM pg_policies 
WHERE tablename = 'truck_routes' AND schemaname = 'public';

COMMIT;