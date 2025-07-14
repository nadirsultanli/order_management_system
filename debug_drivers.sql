-- Debug script to check driver setup
-- Run this to understand the current state of drivers and truck_routes

-- 1. Check admin_users table structure
SELECT 
    'admin_users table structure:' as info,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'admin_users' 
ORDER BY ordinal_position;

-- 2. Check truck_routes table structure (driver_id column)
SELECT 
    'truck_routes driver_id column:' as info,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'truck_routes' 
AND column_name = 'driver_id';

-- 3. Check if foreign key constraint exists
SELECT 
    'Foreign key constraints on truck_routes:' as info,
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name = 'truck_routes'
    AND kcu.column_name = 'driver_id';

-- 4. Check existing drivers in admin_users
SELECT 
    'Drivers in admin_users:' as info,
    id,
    name,
    email,
    role,
    active,
    auth_user_id
FROM admin_users 
WHERE role = 'driver'
ORDER BY name;

-- 5. Check existing trips and their driver assignments
SELECT 
    'Existing trips:' as info,
    id,
    truck_id,
    driver_id,
    route_date,
    route_status,
    created_at
FROM truck_routes
ORDER BY created_at DESC
LIMIT 5;

-- 6. Verify if any driver IDs in truck_routes match admin_users.id
SELECT 
    'Driver ID matches:' as info,
    tr.id as trip_id,
    tr.driver_id,
    au.id as admin_user_id,
    au.name as driver_name,
    au.role
FROM truck_routes tr
LEFT JOIN admin_users au ON tr.driver_id = au.id
WHERE tr.driver_id IS NOT NULL
ORDER BY tr.created_at DESC;