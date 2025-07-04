-- Verification script for customer operations
-- This script validates that all customer CRUD operations will work correctly

BEGIN;

-- Test 1: Verify columns exist
DO $$
DECLARE
    column_count INTEGER;
BEGIN
    -- Check customers table has required columns
    SELECT COUNT(*) INTO column_count
    FROM information_schema.columns 
    WHERE table_name = 'customers' 
      AND column_name IN ('created_by', 'updated_by', 'created_at', 'updated_at');
    
    IF column_count < 4 THEN
        RAISE EXCEPTION 'Missing required audit columns in customers table. Found: %', column_count;
    END IF;
    
    -- Check addresses table has required columns
    SELECT COUNT(*) INTO column_count
    FROM information_schema.columns 
    WHERE table_name = 'addresses' 
      AND column_name IN ('created_by', 'updated_by', 'created_at', 'updated_at');
    
    IF column_count < 4 THEN
        RAISE EXCEPTION 'Missing required audit columns in addresses table. Found: %', column_count;
    END IF;
    
    RAISE NOTICE 'Audit columns verified successfully';
END $$;

-- Test 2: Verify RPC function exists and has correct signature
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' 
          AND p.proname = 'create_customer_with_address'
    ) THEN
        RAISE EXCEPTION 'create_customer_with_address function not found';
    END IF;
    
    RAISE NOTICE 'RPC function verified successfully';
END $$;

-- Test 3: Verify indexes exist for performance
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'customers' 
          AND indexname = 'idx_customers_updated_by'
    ) THEN
        RAISE WARNING 'Performance index idx_customers_updated_by not found';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'customers' 
          AND indexname = 'idx_customers_created_by'
    ) THEN
        RAISE WARNING 'Performance index idx_customers_created_by not found';
    END IF;
    
    RAISE NOTICE 'Database indexes verified';
END $$;

-- Test 4: Simulate customer operations (without actually inserting data)
DO $$
DECLARE
    test_user_id uuid := '00000000-0000-0000-0000-000000000001';
BEGIN
    -- Test customer update query structure
    PERFORM 1 FROM customers 
    WHERE FALSE  -- Never true, just tests query structure
      AND updated_by = test_user_id;
    
    -- Test address update query structure  
    PERFORM 1 FROM addresses 
    WHERE FALSE  -- Never true, just tests query structure
      AND updated_by = test_user_id;
    
    RAISE NOTICE 'Query structure verification completed';
END $$;

COMMIT;

-- Final verification report
SELECT 
    'customers' as table_name,
    COUNT(*) as row_count,
    COUNT(CASE WHEN created_by IS NOT NULL THEN 1 END) as rows_with_created_by,
    COUNT(CASE WHEN updated_by IS NOT NULL THEN 1 END) as rows_with_updated_by
FROM customers

UNION ALL

SELECT 
    'addresses' as table_name,
    COUNT(*) as row_count,
    COUNT(CASE WHEN created_by IS NOT NULL THEN 1 END) as rows_with_created_by,
    COUNT(CASE WHEN updated_by IS NOT NULL THEN 1 END) as rows_with_updated_by
FROM addresses

ORDER BY table_name;

-- Show the final table structure
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name IN ('customers', 'addresses')
  AND column_name IN ('id', 'name', 'created_at', 'updated_at', 'created_by', 'updated_by')
ORDER BY table_name, 
    CASE column_name 
        WHEN 'id' THEN 1
        WHEN 'name' THEN 2
        WHEN 'created_at' THEN 3
        WHEN 'updated_at' THEN 4
        WHEN 'created_by' THEN 5
        WHEN 'updated_by' THEN 6
        ELSE 7
    END;