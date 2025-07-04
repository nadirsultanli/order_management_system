-- Disable Row Level Security policies to fix UNAUTHORIZED errors
-- This migration disables RLS since the application no longer uses multi-tenancy

BEGIN;

-- Disable RLS on all core tables
ALTER TABLE IF EXISTS customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS order_lines DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS products DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS inventory DISABLE ROW LEVEL SECURITY;
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

-- Drop existing RLS policies
DROP POLICY IF EXISTS "tenant_isolation_customers" ON customers;
DROP POLICY IF EXISTS "tenant_isolation_orders" ON orders;
DROP POLICY IF EXISTS "tenant_isolation_order_lines" ON order_lines;
DROP POLICY IF EXISTS "tenant_isolation_products" ON products;
DROP POLICY IF EXISTS "tenant_isolation_inventory" ON inventory;
DROP POLICY IF EXISTS "tenant_isolation_warehouses" ON warehouses;
DROP POLICY IF EXISTS "tenant_isolation_transfers" ON transfers;
DROP POLICY IF EXISTS "tenant_isolation_transfer_items" ON transfer_items;
DROP POLICY IF EXISTS "tenant_isolation_price_lists" ON price_lists;
DROP POLICY IF EXISTS "tenant_isolation_price_list_items" ON price_list_items;
DROP POLICY IF EXISTS "tenant_isolation_addresses" ON addresses;
DROP POLICY IF EXISTS "tenant_isolation_trucks" ON truck;

-- Keep the functions in case they're needed later, but they won't be enforced
-- The tables will now rely on application-level access control through admin_users

COMMIT;