-- Enable Row Level Security (RLS) for Multi-Tenant Support
-- This migration implements comprehensive RLS policies for all tables
-- ensuring strict tenant isolation and proper access controls

BEGIN;

-- Enable RLS on all core tables
ALTER TABLE IF EXISTS customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS order_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS products ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS transfer_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS price_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS price_list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS trucks ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- CUSTOMERS TABLE RLS POLICIES
-- =============================================================================

-- Policy: Users can only access customers within their tenant
CREATE POLICY "tenant_isolation_customers" ON customers
    FOR ALL USING (
        auth.jwt() ->> 'tenant_id' = tenant_id::text
        OR auth.role() = 'service_role'
    );

-- =============================================================================
-- ORDERS TABLE RLS POLICIES
-- =============================================================================

-- Policy: Users can only access orders within their tenant
CREATE POLICY "tenant_isolation_orders" ON orders
    FOR ALL USING (
        auth.jwt() ->> 'tenant_id' = tenant_id::text
        OR auth.role() = 'service_role'
    );

-- =============================================================================
-- ORDER_LINES TABLE RLS POLICIES
-- =============================================================================

-- Policy: Users can only access order lines for orders within their tenant
CREATE POLICY "tenant_isolation_order_lines" ON order_lines
    FOR ALL USING (
        auth.jwt() ->> 'tenant_id' = tenant_id::text
        OR auth.role() = 'service_role'
    );

-- =============================================================================
-- PRODUCTS TABLE RLS POLICIES
-- =============================================================================

-- Policy: Users can only access products within their tenant
CREATE POLICY "tenant_isolation_products" ON products
    FOR ALL USING (
        auth.jwt() ->> 'tenant_id' = tenant_id::text
        OR auth.role() = 'service_role'
    );

-- =============================================================================
-- INVENTORY TABLE RLS POLICIES
-- =============================================================================

-- Policy: Users can only access inventory within their tenant
CREATE POLICY "tenant_isolation_inventory" ON inventory
    FOR ALL USING (
        auth.jwt() ->> 'tenant_id' = tenant_id::text
        OR auth.role() = 'service_role'
    );

-- =============================================================================
-- WAREHOUSES TABLE RLS POLICIES
-- =============================================================================

-- Policy: Users can only access warehouses within their tenant
CREATE POLICY "tenant_isolation_warehouses" ON warehouses
    FOR ALL USING (
        auth.jwt() ->> 'tenant_id' = tenant_id::text
        OR auth.role() = 'service_role'
    );

-- =============================================================================
-- TRANSFERS TABLE RLS POLICIES
-- =============================================================================

-- Policy: Users can only access transfers within their tenant
CREATE POLICY "tenant_isolation_transfers" ON transfers
    FOR ALL USING (
        auth.jwt() ->> 'tenant_id' = tenant_id::text
        OR auth.role() = 'service_role'
    );

-- =============================================================================
-- TRANSFER_ITEMS TABLE RLS POLICIES
-- =============================================================================

-- Policy: Users can only access transfer items for transfers within their tenant
CREATE POLICY "tenant_isolation_transfer_items" ON transfer_items
    FOR ALL USING (
        auth.jwt() ->> 'tenant_id' = tenant_id::text
        OR auth.role() = 'service_role'
    );

-- =============================================================================
-- PRICE_LISTS TABLE RLS POLICIES
-- =============================================================================

-- Policy: Users can only access price lists within their tenant
CREATE POLICY "tenant_isolation_price_lists" ON price_lists
    FOR ALL USING (
        auth.jwt() ->> 'tenant_id' = tenant_id::text
        OR auth.role() = 'service_role'
    );

-- =============================================================================
-- PRICE_LIST_ITEMS TABLE RLS POLICIES
-- =============================================================================

-- Policy: Users can only access price list items for price lists within their tenant
CREATE POLICY "tenant_isolation_price_list_items" ON price_list_items
    FOR ALL USING (
        auth.jwt() ->> 'tenant_id' = tenant_id::text
        OR auth.role() = 'service_role'
    );

-- =============================================================================
-- ADDRESSES TABLE RLS POLICIES
-- =============================================================================

-- Policy: Users can only access addresses within their tenant
CREATE POLICY "tenant_isolation_addresses" ON addresses
    FOR ALL USING (
        auth.jwt() ->> 'tenant_id' = tenant_id::text
        OR auth.role() = 'service_role'
    );

-- =============================================================================
-- TRUCKS TABLE RLS POLICIES
-- =============================================================================

-- Policy: Users can only access trucks within their tenant
CREATE POLICY "tenant_isolation_trucks" ON trucks
    FOR ALL USING (
        auth.jwt() ->> 'tenant_id' = tenant_id::text
        OR auth.role() = 'service_role'
    );

-- =============================================================================
-- ROLE-BASED ACCESS CONTROL POLICIES
-- =============================================================================

-- Function to check if user has admin role
CREATE OR REPLACE FUNCTION auth.user_has_role(required_role text)
RETURNS boolean AS $$
BEGIN
    RETURN auth.jwt() ->> 'role' = required_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user belongs to tenant
CREATE OR REPLACE FUNCTION auth.user_belongs_to_tenant(target_tenant_id uuid)
RETURNS boolean AS $$
BEGIN
    RETURN (auth.jwt() ->> 'tenant_id')::uuid = target_tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get current user's tenant_id
CREATE OR REPLACE FUNCTION auth.current_tenant_id()
RETURNS uuid AS $$
BEGIN
    RETURN (auth.jwt() ->> 'tenant_id')::uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- AUDIT AND LOGGING POLICIES
-- =============================================================================

-- Create audit log table for tracking RLS policy violations
CREATE TABLE IF NOT EXISTS rls_audit_log (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    table_name text NOT NULL,
    operation text NOT NULL,
    user_id uuid,
    tenant_id uuid,
    attempted_access jsonb,
    blocked_at timestamp with time zone DEFAULT now(),
    ip_address inet,
    user_agent text
);

-- Function to log RLS violations (for monitoring)
CREATE OR REPLACE FUNCTION log_rls_violation(
    table_name text,
    operation text,
    attempted_data jsonb DEFAULT NULL
)
RETURNS void AS $$
BEGIN
    INSERT INTO rls_audit_log (
        table_name,
        operation,
        user_id,
        tenant_id,
        attempted_access,
        ip_address,
        user_agent
    ) VALUES (
        table_name,
        operation,
        (auth.jwt() ->> 'sub')::uuid,
        (auth.jwt() ->> 'tenant_id')::uuid,
        attempted_data,
        inet_client_addr(),
        current_setting('request.header.user-agent', true)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- COMPOSITE INDEXES FOR RLS PERFORMANCE
-- =============================================================================

-- Create composite indexes to optimize RLS policy performance
-- These indexes ensure tenant_id filtering is fast

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_tenant_id 
    ON customers (tenant_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_tenant_id_status 
    ON orders (tenant_id, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_tenant_id_created_at 
    ON orders (tenant_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_lines_tenant_id 
    ON order_lines (tenant_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_tenant_id_active 
    ON products (tenant_id, is_active) WHERE is_active = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_tenant_id_warehouse 
    ON inventory (tenant_id, warehouse_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_warehouses_tenant_id_active 
    ON warehouses (tenant_id, is_active) WHERE is_active = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transfers_tenant_id_status 
    ON transfers (tenant_id, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transfer_items_tenant_id 
    ON transfer_items (tenant_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_price_lists_tenant_id_active 
    ON price_lists (tenant_id, is_active) WHERE is_active = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_price_list_items_tenant_id 
    ON price_list_items (tenant_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_addresses_tenant_id 
    ON addresses (tenant_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trucks_tenant_id_active 
    ON trucks (tenant_id, is_active) WHERE is_active = true;

-- =============================================================================
-- DATABASE FUNCTIONS FOR TENANT VALIDATION
-- =============================================================================

-- Function to validate tenant access for backend operations
CREATE OR REPLACE FUNCTION validate_tenant_access(
    target_tenant_id uuid,
    required_role text DEFAULT 'user'
)
RETURNS boolean AS $$
DECLARE
    user_tenant_id uuid;
    user_role text;
BEGIN
    -- Get user information from JWT
    user_tenant_id := (auth.jwt() ->> 'tenant_id')::uuid;
    user_role := auth.jwt() ->> 'role';
    
    -- Service role bypasses all checks
    IF auth.role() = 'service_role' THEN
        RETURN true;
    END IF;
    
    -- Check if user belongs to the target tenant
    IF user_tenant_id != target_tenant_id THEN
        PERFORM log_rls_violation('tenant_validation', 'cross_tenant_access');
        RETURN false;
    END IF;
    
    -- Check role requirement
    IF required_role = 'admin' AND user_role != 'admin' THEN
        PERFORM log_rls_violation('tenant_validation', 'insufficient_role');
        RETURN false;
    END IF;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- STORED PROCEDURES FOR INVENTORY OPERATIONS WITH RLS
-- =============================================================================

-- Update inventory reservation RPC with tenant validation
CREATE OR REPLACE FUNCTION reserve_stock(
    p_product_id uuid,
    p_quantity numeric,
    p_tenant_id uuid
)
RETURNS void AS $$
BEGIN
    -- Validate tenant access
    IF NOT validate_tenant_access(p_tenant_id) THEN
        RAISE EXCEPTION 'Access denied: tenant isolation violation';
    END IF;

    UPDATE inventory 
    SET reserved_quantity = reserved_quantity + p_quantity,
        updated_at = now()
    WHERE product_id = p_product_id 
      AND tenant_id = p_tenant_id
      AND available_quantity >= p_quantity;
      
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Insufficient stock or product not found';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update order fulfillment RPC with tenant validation
CREATE OR REPLACE FUNCTION fulfill_order_line(
    p_product_id uuid,
    p_quantity numeric,
    p_tenant_id uuid
)
RETURNS void AS $$
BEGIN
    -- Validate tenant access
    IF NOT validate_tenant_access(p_tenant_id) THEN
        RAISE EXCEPTION 'Access denied: tenant isolation violation';
    END IF;

    UPDATE inventory 
    SET available_quantity = available_quantity - p_quantity,
        reserved_quantity = reserved_quantity - p_quantity,
        updated_at = now()
    WHERE product_id = p_product_id 
      AND tenant_id = p_tenant_id
      AND reserved_quantity >= p_quantity;
      
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Insufficient reserved stock or product not found';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Release reserved stock RPC with tenant validation
CREATE OR REPLACE FUNCTION release_reserved_stock(
    p_product_id uuid,
    p_quantity numeric,
    p_tenant_id uuid
)
RETURNS void AS $$
BEGIN
    -- Validate tenant access
    IF NOT validate_tenant_access(p_tenant_id) THEN
        RAISE EXCEPTION 'Access denied: tenant isolation violation';
    END IF;

    UPDATE inventory 
    SET reserved_quantity = reserved_quantity - p_quantity,
        updated_at = now()
    WHERE product_id = p_product_id 
      AND tenant_id = p_tenant_id
      AND reserved_quantity >= p_quantity;
      
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Insufficient reserved stock to release';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- GRANT APPROPRIATE PERMISSIONS
-- =============================================================================

-- Grant usage on functions to authenticated users
GRANT EXECUTE ON FUNCTION auth.user_has_role(text) TO authenticated;
GRANT EXECUTE ON FUNCTION auth.user_belongs_to_tenant(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION auth.current_tenant_id() TO authenticated;
GRANT EXECUTE ON FUNCTION validate_tenant_access(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION reserve_stock(uuid, numeric, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION fulfill_order_line(uuid, numeric, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION release_reserved_stock(uuid, numeric, uuid) TO authenticated;

-- Grant access to audit log for service role only
GRANT ALL ON rls_audit_log TO service_role;

COMMIT;

-- =============================================================================
-- VERIFICATION QUERIES (Run these to test RLS policies)
-- =============================================================================

/*
-- Test tenant isolation (these should return no results for different tenants)

-- Test 1: Try to access data from wrong tenant
SELECT * FROM customers WHERE tenant_id != auth.current_tenant_id();

-- Test 2: Verify RLS is working
SELECT COUNT(*) FROM customers; -- Should only show current tenant's customers

-- Test 3: Test admin functions
SELECT validate_tenant_access('00000000-0000-0000-0000-000000000000'::uuid);

-- Test 4: Check audit log
SELECT * FROM rls_audit_log ORDER BY blocked_at DESC LIMIT 10;
*/