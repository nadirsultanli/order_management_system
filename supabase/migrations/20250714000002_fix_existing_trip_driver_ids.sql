-- Fix existing trip driver_id values to use admin_users.id instead of auth_user_id
-- This migration updates any existing trips that might have auth_user_id as driver_id

BEGIN;

-- First, check if there are any trips with driver_id that don't match admin_users.id
-- but might match admin_users.auth_user_id

-- Update trips where driver_id currently matches auth_user_id
UPDATE truck_routes 
SET driver_id = (
    SELECT au.id 
    FROM admin_users au 
    WHERE au.auth_user_id = truck_routes.driver_id 
    AND au.role = 'driver'
    AND au.active = true
    LIMIT 1
)
WHERE driver_id IS NOT NULL 
AND NOT EXISTS (
    SELECT 1 FROM admin_users 
    WHERE id = truck_routes.driver_id
)
AND EXISTS (
    SELECT 1 FROM admin_users 
    WHERE auth_user_id = truck_routes.driver_id 
    AND role = 'driver'
);

-- Clean up any driver_id values that don't match any admin_users record
UPDATE truck_routes 
SET driver_id = NULL
WHERE driver_id IS NOT NULL 
AND NOT EXISTS (
    SELECT 1 FROM admin_users 
    WHERE id = truck_routes.driver_id
);

-- Add comment for future reference
COMMENT ON COLUMN truck_routes.driver_id IS 'Foreign key to admin_users.id (not auth_user_id) for driver assignment';

-- Verification: Show any remaining orphaned driver_id values
SELECT 
    'Verification - orphaned driver_ids:' as status,
    COUNT(*) as orphaned_count
FROM truck_routes 
WHERE driver_id IS NOT NULL 
AND NOT EXISTS (
    SELECT 1 FROM admin_users 
    WHERE id = truck_routes.driver_id
);

-- Show current valid driver assignments
SELECT 
    'Current valid driver assignments:' as status,
    tr.id as trip_id,
    tr.driver_id,
    au.name as driver_name,
    au.role,
    au.active
FROM truck_routes tr
JOIN admin_users au ON tr.driver_id = au.id
WHERE tr.driver_id IS NOT NULL
ORDER BY tr.created_at DESC
LIMIT 10;

COMMIT;