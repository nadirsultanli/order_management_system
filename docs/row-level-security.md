# Row Level Security (RLS) Implementation

This document describes the comprehensive Row Level Security implementation for the Order Management System, ensuring strict multi-tenant data isolation.

## Overview

Row Level Security (RLS) is a PostgreSQL feature that allows database administrators to define policies to control access to individual rows in database tables. Our implementation ensures that:

1. **Tenant Isolation**: Users can only access data belonging to their tenant
2. **Role-Based Access**: Different user roles have appropriate permissions
3. **Audit Trail**: All access violations are logged for monitoring
4. **Performance**: Optimized indexes support efficient RLS filtering

## Implementation Details

### 1. RLS Policies

All core tables have RLS enabled with policies that enforce tenant isolation:

```sql
-- Example policy for customers table
CREATE POLICY "tenant_isolation_customers" ON customers
    FOR ALL USING (
        auth.jwt() ->> 'tenant_id' = tenant_id::text
        OR auth.role() = 'service_role'
    );
```

**Protected Tables:**
- `customers` - Customer data
- `orders` - Order information  
- `order_lines` - Order line items
- `products` - Product catalog
- `inventory` - Inventory levels
- `warehouses` - Warehouse information
- `transfers` - Transfer operations
- `transfer_items` - Transfer line items
- `price_lists` - Pricing information
- `price_list_items` - Price list entries
- `addresses` - Address data
- `trucks` - Vehicle information

### 2. JWT Token Structure

The authentication system expects JWT tokens with the following claims:

```json
{
  "sub": "user-uuid",
  "tenant_id": "tenant-uuid", 
  "role": "user|admin",
  "email": "user@example.com"
}
```

### 3. Database Functions

#### Tenant Validation
```sql
validate_tenant_access(target_tenant_id uuid, required_role text)
```
Validates user access to specific tenant data with role checking.

#### Inventory Operations  
```sql
reserve_stock(p_product_id uuid, p_quantity numeric, p_tenant_id uuid)
fulfill_order_line(p_product_id uuid, p_quantity numeric, p_tenant_id uuid)
release_reserved_stock(p_product_id uuid, p_quantity numeric, p_tenant_id uuid)
```
Inventory management functions with built-in tenant validation.

#### Utility Functions
```sql
auth.user_has_role(required_role text)
auth.user_belongs_to_tenant(target_tenant_id uuid) 
auth.current_tenant_id()
```

### 4. Performance Optimization

Composite indexes ensure RLS policies perform efficiently:

```sql
-- Examples
CREATE INDEX idx_customers_tenant_id ON customers (tenant_id);
CREATE INDEX idx_orders_tenant_id_status ON orders (tenant_id, status);
CREATE INDEX idx_inventory_tenant_id_warehouse ON inventory (tenant_id, warehouse_id);
```

### 5. Audit Logging

The `rls_audit_log` table tracks access violations:

```sql
CREATE TABLE rls_audit_log (
    id uuid PRIMARY KEY,
    table_name text,
    operation text,
    user_id uuid,
    tenant_id uuid,
    attempted_access jsonb,
    blocked_at timestamp,
    ip_address inet,
    user_agent text
);
```

## Backend Integration

### 1. Context Setup

The tRPC context automatically extracts tenant information from JWT tokens:

```typescript
export const createContext = async ({ req }: CreateExpressContextOptions) => {
  const token = req.headers.authorization?.slice(7);
  let user: AuthenticatedUser | null = null;
  
  if (token) {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as any;
    user = {
      id: payload.sub,
      email: payload.email,
      tenant_id: payload.tenant_id,
      role: payload.role
    };
  }
  
  return { user, supabase: createUserSupabaseClient(token) };
};
```

### 2. Tenant Access Validation

All protected procedures validate tenant access:

```typescript
const user = requireTenantAccess(ctx);

// All queries automatically include tenant filtering via RLS
const { data, error } = await ctx.supabase
  .from('orders')
  .select('*')
  .eq('customer_id', customerId); // RLS automatically adds tenant_id filter
```

### 3. RLS Testing Utilities

The backend includes utilities to test and monitor RLS:

```typescript
import { testRLSPolicies, getRLSViolations, validateRLSStatus } from '../lib/rls-utils';

// Test RLS policies
const results = await testRLSPolicies(supabase, tenantId);

// Get violation reports  
const violations = await getRLSViolations(supabaseAdmin);

// Validate RLS is enabled
const status = await validateRLSStatus(supabaseAdmin);
```

## API Endpoints

### Admin Endpoints

The backend provides admin endpoints for RLS monitoring:

- `admin.testRLSPolicies` - Test RLS policies for current tenant
- `admin.getRLSViolations` - Get audit log of violations (admin only)
- `admin.validateRLSStatus` - Check RLS is enabled on all tables
- `admin.getTenantStats` - Get statistics per tenant
- `admin.healthCheck` - System health including RLS validation

## Security Features

### 1. Automatic Tenant Filtering

RLS policies automatically filter all queries by tenant_id, preventing:
- Cross-tenant data access
- Data leakage between tenants  
- Accidental data exposure

### 2. Service Role Bypass

The service role can bypass RLS for:
- Administrative operations
- System maintenance
- Cross-tenant reporting (when authorized)

### 3. Role-Based Access Control

Different user roles have different capabilities:
- **user**: Standard tenant-scoped access
- **admin**: Enhanced permissions within tenant
- **service_role**: System-level access

### 4. Violation Monitoring

All RLS violations are logged with:
- User identification
- Attempted operation
- IP address and user agent
- Timestamp and context

## Deployment Checklist

### 1. Database Migration

Run the RLS migration:
```bash
supabase db push
```

### 2. Verify RLS Status

Check all tables have RLS enabled:
```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND rowsecurity = false;
```

### 3. Test Tenant Isolation

Use the admin endpoints to verify isolation:
```typescript
const results = await trpc.admin.testRLSPolicies.query();
console.log('RLS Test Results:', results);
```

### 4. Monitor Violations

Set up monitoring for the audit log:
```typescript
const violations = await trpc.admin.getRLSViolations.query({
  since: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
});
```

## Best Practices

### 1. Always Use Authenticated Clients

Never use the service role key in frontend code:
```typescript
// ✅ Good - user-scoped client
const client = createUserSupabaseClient(userToken);

// ❌ Bad - service role in frontend  
const client = createClient(url, serviceRoleKey);
```

### 2. Validate Tenant Context

Always validate tenant access in business logic:
```typescript
const user = requireTenantAccess(ctx);
// RLS provides defense in depth, but explicit validation is good practice
```

### 3. Monitor Performance

RLS adds WHERE clauses to queries. Monitor query performance:
```sql
EXPLAIN ANALYZE SELECT * FROM orders WHERE customer_id = $1;
```

### 4. Regular Auditing

Regularly review RLS violations:
```typescript
// Daily audit check
const violations = await getRLSViolations(supabaseAdmin, yesterday);
if (violations.violations.length > 0) {
  // Alert security team
}
```

## Troubleshooting

### Common Issues

1. **No Data Returned**: Check JWT token contains correct tenant_id
2. **Performance Issues**: Ensure tenant_id indexes exist
3. **Access Denied**: Verify user role and tenant membership

### Debug Queries

```sql
-- Check current user context
SELECT auth.jwt();

-- Test tenant validation
SELECT validate_tenant_access('tenant-uuid'::uuid);

-- Check RLS policies
SELECT * FROM pg_policies WHERE tablename = 'customers';
```

### Testing Without RLS

For development/testing only:
```sql
-- Temporarily disable RLS (DEVELOPMENT ONLY)
ALTER TABLE customers DISABLE ROW LEVEL SECURITY;

-- Re-enable when done
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
```

## Conclusion

This RLS implementation provides enterprise-grade multi-tenant security with:
- Automatic tenant isolation
- Comprehensive audit trails
- Performance optimization
- Easy monitoring and testing
- Defense-in-depth security

The system is now ready for production use with confidence that tenant data remains strictly isolated.