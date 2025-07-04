-- Remove tenant_id columns from all tables since multi-tenancy is no longer used
-- This migration completes the removal of tenant concepts from the database

BEGIN;

-- Remove tenant_id columns if they exist
ALTER TABLE IF EXISTS customers DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE IF EXISTS orders DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE IF EXISTS order_lines DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE IF EXISTS products DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE IF EXISTS inventory DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE IF EXISTS warehouses DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE IF EXISTS transfers DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE IF EXISTS transfer_items DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE IF EXISTS price_lists DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE IF EXISTS price_list_items DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE IF EXISTS addresses DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE IF EXISTS truck DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE IF EXISTS truck_inventory DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE IF EXISTS truck_routes DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE IF EXISTS truck_allocations DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE IF EXISTS truck_maintenance DROP COLUMN IF EXISTS tenant_id;

-- Drop tenant-related indexes
DROP INDEX IF EXISTS idx_customers_tenant_id;
DROP INDEX IF EXISTS idx_orders_tenant_id_status;
DROP INDEX IF EXISTS idx_orders_tenant_id_created_at;
DROP INDEX IF EXISTS idx_order_lines_tenant_id;
DROP INDEX IF EXISTS idx_products_tenant_id_active;
DROP INDEX IF EXISTS idx_inventory_tenant_id_warehouse;
DROP INDEX IF EXISTS idx_warehouses_tenant_id_active;
DROP INDEX IF EXISTS idx_transfers_tenant_id_status;
DROP INDEX IF EXISTS idx_transfer_items_tenant_id;
DROP INDEX IF EXISTS idx_price_lists_tenant_id_active;
DROP INDEX IF EXISTS idx_price_list_items_tenant_id;
DROP INDEX IF EXISTS idx_addresses_tenant_id;
DROP INDEX IF EXISTS idx_trucks_tenant_id_active;

-- Drop tenant-related functions
DROP FUNCTION IF EXISTS auth.user_belongs_to_tenant(uuid);
DROP FUNCTION IF EXISTS auth.current_tenant_id();
DROP FUNCTION IF EXISTS validate_tenant_access(uuid, text);
DROP FUNCTION IF EXISTS reserve_stock(uuid, numeric, uuid);
DROP FUNCTION IF EXISTS fulfill_order_line(uuid, numeric, uuid);
DROP FUNCTION IF EXISTS release_reserved_stock(uuid, numeric, uuid);

-- Drop audit log table since it's tenant-specific
DROP TABLE IF EXISTS rls_audit_log;

COMMIT;