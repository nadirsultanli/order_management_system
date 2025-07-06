-- Quick database state check to identify remaining tenant_id issues
-- Run this in Supabase SQL Editor to see current state

-- Check 1: List all tables in public schema
SELECT 
    'Current tables in public schema:' as check_name,
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;

-- Check 2: Find any remaining tenant_id columns
SELECT 
    'Remaining tenant_id columns:' as check_name,
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE column_name = 'tenant_id' 
    AND table_schema = 'public';

-- Check 3: Check RLS status on all tables
SELECT 
    'RLS status:' as check_name,
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;

-- Check 4: List all RLS policies
SELECT 
    'Active RLS policies:' as check_name,
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Check 5: Check inventory-related tables specifically
SELECT 
    'Inventory table check:' as check_name,
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'inventory_balance')::text as inventory_balance_exists,
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'inventory')::text as old_inventory_exists,
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'stock_movements')::text as stock_movements_exists;

-- Check 6: List tenant-related functions
SELECT 
    'Tenant-related functions:' as check_name,
    routine_name,
    routine_type,
    routine_definition
FROM information_schema.routines 
WHERE routine_schema = 'public'
    AND (routine_name LIKE '%tenant%' OR routine_definition LIKE '%tenant_id%')
ORDER BY routine_name;

-- Check 7: Sample products table structure
SELECT 
    'Products table columns:' as check_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'products' 
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check 8: Sample inventory_balance table structure (if exists)
SELECT 
    'Inventory balance table columns:' as check_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'inventory_balance' 
    AND table_schema = 'public'
ORDER BY ordinal_position;