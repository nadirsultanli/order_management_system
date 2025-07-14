-- Debug script to check for drivers in the database
-- Run this in your Supabase SQL editor to verify drivers exist

-- Check if admin_users table exists and what columns it has
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'admin_users' 
ORDER BY ordinal_position;

-- Check all users and their roles
SELECT id, name, email, role, active, created_at
FROM admin_users 
ORDER BY created_at DESC;

-- Check specifically for drivers
SELECT id, name, email, role, active, created_at
FROM admin_users 
WHERE role = 'driver'
ORDER BY created_at DESC;

-- Check specifically for active drivers (what the frontend is requesting)
SELECT id, name, email, role, active, created_at
FROM admin_users 
WHERE role = 'driver' AND active = true
ORDER BY created_at DESC;

-- Count by role
SELECT role, COUNT(*) as count 
FROM admin_users 
GROUP BY role 
ORDER BY count DESC;