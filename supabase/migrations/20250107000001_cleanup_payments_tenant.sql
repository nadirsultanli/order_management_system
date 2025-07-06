-- Cleanup tenant_id references from payments table and related indexes
-- This migration removes any remaining tenant_id references from the payments system

BEGIN;

-- Remove tenant_id from payments table if it exists
ALTER TABLE IF EXISTS payments DROP COLUMN IF EXISTS tenant_id;

-- Drop tenant-related indexes from payments table
DROP INDEX IF EXISTS idx_payments_tenant_id;

-- Recreate the unique constraint without tenant_id if payments table exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payments' AND table_schema = 'public') THEN
        -- Drop old constraint
        ALTER TABLE payments DROP CONSTRAINT IF EXISTS unique_payment_id_per_tenant;
        
        -- Create new constraint without tenant_id
        ALTER TABLE payments ADD CONSTRAINT unique_payment_id UNIQUE (payment_id);
    END IF;
END $$;

-- Disable RLS on payments table
ALTER TABLE IF EXISTS payments DISABLE ROW LEVEL SECURITY;

-- Drop any remaining RLS policies on payments table
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'payments' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON payments', pol.policyname);
    END LOOP;
END $$;

-- Grant permissions on payments table
GRANT ALL ON payments TO authenticated;

-- Verify no tenant_id columns remain in the database
SELECT 
    'Tenant cleanup verification:' as status,
    COUNT(*)::text as remaining_tenant_id_columns
FROM information_schema.columns 
WHERE column_name = 'tenant_id' 
    AND table_schema = 'public';

COMMIT;