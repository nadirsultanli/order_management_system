# Immediate Actions Required

## 🚨 CRITICAL - Do These First (Today)

### 1. Apply Database Migrations (30 minutes)

```bash
# First, apply the manual migration for missing product columns
psql $DATABASE_URL < manual-migration.sql

# Then apply the new migration to restore inventory functions
psql $DATABASE_URL < supabase/migrations/20250106000000_restore_inventory_functions.sql
```

### 2. Fix Backend Code (1 hour)

```bash
# Install glob package for the fix script
cd scripts
npm install glob

# Run the automated fix script
node fix-tenant-references.js

# Rebuild backend
cd ../backend
npm install
npm run build
```

### 3. Manual Code Fixes (30 minutes)

After running the script, manually check and fix:

1. **backend/src/lib/auth.ts** - The `requireTenantAccess` function should just call `requireAuth`
2. **backend/src/routes/orders.ts** - Verify RPC calls were fixed properly
3. **backend/src/routes/payments.ts** - Remove tenant_id from payment RPC calls

### 4. Test Critical Workflows (1 hour)

Test these endpoints in order:

1. **Authentication**
   - POST /auth/login
   - GET /auth/me

2. **Customer Creation**
   - POST /customers/create (with address)
   - GET /customers/list

3. **Order Workflow**
   - POST /orders/create (create draft order)
   - POST /orders/{id}/status (change to 'confirmed' - should reserve stock)
   - POST /orders/{id}/status (change to 'delivered' - should deduct stock)

4. **Inventory Check**
   - GET /inventory/list
   - Check that stock levels changed correctly

## 📋 Issues That Will Be Fixed

1. ✅ "column tenant_id does not exist" errors
2. ✅ Missing inventory management functions
3. ✅ Order workflow broken (can't reserve/fulfill stock)
4. ✅ Products table missing inventory threshold columns
5. ✅ RPC function calls failing

## ⚠️ Known Issues After Fix

These will still need attention but won't block basic operations:

1. **Performance** - Missing indexes on some tables
2. **Audit Trail** - Stock movements will start tracking from now
3. **Authorization** - Currently using service role (needs proper RLS later)
4. **Error Messages** - Some may still reference tenant concepts

## 🔍 How to Verify Success

1. **Database Functions Exist**
   ```sql
   SELECT routine_name FROM information_schema.routines 
   WHERE routine_schema = 'public' 
   AND routine_name IN ('reserve_stock', 'fulfill_order_line', 'release_reserved_stock');
   ```

2. **No Tenant Errors in Logs**
   - Backend should start without errors
   - API calls shouldn't mention "tenant_id"

3. **Order Creation Works**
   - Can create order
   - Status changes work
   - Inventory updates correctly

## 📞 If Something Goes Wrong

1. **Database Migration Fails**
   - Check if tables/columns already exist
   - Run migrations one statement at a time

2. **Backend Won't Compile**
   - Check for syntax errors from the fix script
   - Manually fix any broken imports

3. **Orders Still Failing**
   - Check browser console for exact error
   - Verify functions exist in database
   - Check that inventory table has data

## Next Phase (Tomorrow)

Once critical issues are fixed:

1. Comprehensive testing of all endpoints
2. Add proper error handling
3. Implement basic monitoring
4. Update API documentation
5. Plan for proper authorization system