-- NUCLEAR SCRIPT: Complete removal of ALL tenant_id references
-- This script will aggressively remove all traces of tenant functionality

-- Step 1: Disable all triggers temporarily
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT nspname, relname, tgname
        FROM pg_trigger t
        JOIN pg_class c ON c.oid = t.tgrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
    LOOP
        EXECUTE format('ALTER TABLE %I.%I DISABLE TRIGGER %I', r.nspname, r.relname, r.tgname);
    END LOOP;
END $$;

-- Step 2: Drop ALL triggers that might reference tenant_id
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Drop all triggers with 'tenant' in their name
    FOR r IN
        SELECT nspname, relname, tgname
        FROM pg_trigger t
        JOIN pg_class c ON c.oid = t.tgrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' 
        AND (tgname ILIKE '%tenant%' OR tgname ILIKE '%multi%')
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I.%I CASCADE', r.tgname, r.nspname, r.relname);
    END LOOP;
    
    -- Drop ALL update triggers that might add tenant_id
    FOR r IN
        SELECT nspname, relname, tgname
        FROM pg_trigger t
        JOIN pg_class c ON c.oid = t.tgrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' 
        AND tgname LIKE '%update%'
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I.%I CASCADE', r.tgname, r.nspname, r.relname);
    END LOOP;
END $$;

-- Step 3: Drop ALL functions that might reference tenant_id
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Drop functions with tenant in their name
    FOR r IN
        SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) as args
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
        AND (p.proname ILIKE '%tenant%' OR p.proname ILIKE '%multi%')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS %I.%I(%s) CASCADE', r.nspname, r.proname, r.args);
    END LOOP;
    
    -- Drop functions that might contain tenant_id in their body
    FOR r IN
        SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) as args
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
        AND pg_get_functiondef(p.oid) ILIKE '%tenant_id%'
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS %I.%I(%s) CASCADE', r.nspname, r.proname, r.args);
    END LOOP;
END $$;

-- Step 4: Drop ALL RLS policies
DO $$
DECLARE
    r RECORD;
BEGIN
    -- First, disable RLS on all tables
    FOR r IN
        SELECT schemaname, tablename
        FROM pg_tables
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('ALTER TABLE %I.%I DISABLE ROW LEVEL SECURITY', r.schemaname, r.tablename);
    END LOOP;
    
    -- Then drop ALL policies
    FOR r IN
        SELECT schemaname, tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
    END LOOP;
END $$;

-- Step 5: Remove ALL column defaults that might reference tenant_id
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT 
            n.nspname as schema_name,
            c.relname as table_name,
            a.attname as column_name
        FROM pg_attribute a
        JOIN pg_class c ON c.oid = a.attrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
        AND a.atthasdef = true
        AND NOT a.attisdropped
    LOOP
        -- Remove default from any column that might use tenant_id
        EXECUTE format('ALTER TABLE %I.%I ALTER COLUMN %I DROP DEFAULT', 
                      r.schema_name, r.table_name, r.column_name);
    END LOOP;
END $$;

-- Step 6: Drop ALL views that might reference tenant_id
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT schemaname, viewname
        FROM pg_views
        WHERE schemaname = 'public'
        AND (definition ILIKE '%tenant_id%' OR viewname ILIKE '%tenant%')
    LOOP
        EXECUTE format('DROP VIEW IF EXISTS %I.%I CASCADE', r.schemaname, r.viewname);
    END LOOP;
END $$;

-- Step 7: Drop tenant_id column from ALL tables if it exists
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT 
            n.nspname as schema_name,
            c.relname as table_name
        FROM pg_attribute a
        JOIN pg_class c ON c.oid = a.attrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
        AND a.attname = 'tenant_id'
        AND NOT a.attisdropped
        AND c.relkind = 'r'
    LOOP
        EXECUTE format('ALTER TABLE %I.%I DROP COLUMN IF EXISTS tenant_id CASCADE', 
                      r.schema_name, r.table_name);
    END LOOP;
END $$;

-- Step 8: Drop ALL constraints that might reference tenant_id
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT 
            n.nspname as schema_name,
            c.relname as table_name,
            con.conname as constraint_name
        FROM pg_constraint con
        JOIN pg_class c ON c.oid = con.conrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
        AND (con.conname ILIKE '%tenant%' OR 
             pg_get_constraintdef(con.oid) ILIKE '%tenant_id%')
    LOOP
        EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT IF EXISTS %I CASCADE', 
                      r.schema_name, r.table_name, r.constraint_name);
    END LOOP;
END $$;

-- Step 9: Drop ALL indexes that might reference tenant_id
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT 
            n.nspname as schema_name,
            c.relname as table_name,
            i.relname as index_name
        FROM pg_index idx
        JOIN pg_class i ON i.oid = idx.indexrelid
        JOIN pg_class c ON c.oid = idx.indrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
        AND (i.relname ILIKE '%tenant%' OR 
             pg_get_indexdef(idx.indexrelid) ILIKE '%tenant_id%')
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I.%I CASCADE', r.schema_name, r.index_name);
    END LOOP;
END $$;

-- Step 10: Drop ALL stored procedures that might reference tenant_id
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT 
            n.nspname as schema_name,
            p.proname as proc_name,
            pg_get_function_identity_arguments(p.oid) as args
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname IN ('public', 'auth', 'extensions')
        AND (pg_get_functiondef(p.oid) ILIKE '%tenant_id%' OR
             p.proname ILIKE '%tenant%')
    LOOP
        BEGIN
            EXECUTE format('DROP FUNCTION IF EXISTS %I.%I(%s) CASCADE', 
                          r.schema_name, r.proc_name, r.args);
        EXCEPTION WHEN OTHERS THEN
            -- Skip system functions
            NULL;
        END;
    END LOOP;
END $$;

-- Step 11: Clean up any tenant-related types
DROP TYPE IF EXISTS tenant_isolation_level CASCADE;
DROP TYPE IF EXISTS tenant_status CASCADE;

-- Step 12: Drop any tenant-related schemas
DROP SCHEMA IF EXISTS tenant CASCADE;
DROP SCHEMA IF EXISTS tenants CASCADE;

-- Step 13: Remove any tenant-related extensions
-- (None standard, but just in case)

-- Step 14: Clear any tenant-related settings
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT name 
        FROM pg_settings 
        WHERE name LIKE '%tenant%'
    LOOP
        EXECUTE format('RESET %I', r.name);
    END LOOP;
END $$;

-- Step 15: Drop any materialized views with tenant references
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT schemaname, matviewname
        FROM pg_matviews
        WHERE schemaname = 'public'
        AND (definition ILIKE '%tenant_id%' OR matviewname ILIKE '%tenant%')
    LOOP
        EXECUTE format('DROP MATERIALIZED VIEW IF EXISTS %I.%I CASCADE', 
                      r.schemaname, r.matviewname);
    END LOOP;
END $$;

-- Step 16: Drop any foreign data wrappers or foreign tables with tenant references
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Foreign tables
    FOR r IN
        SELECT foreign_table_schema, foreign_table_name
        FROM information_schema.foreign_tables
        WHERE foreign_table_schema = 'public'
    LOOP
        EXECUTE format('DROP FOREIGN TABLE IF EXISTS %I.%I CASCADE', 
                      r.foreign_table_schema, r.foreign_table_name);
    END LOOP;
END $$;

-- Step 17: Clean up any event triggers
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT evtname
        FROM pg_event_trigger
        WHERE evtname ILIKE '%tenant%'
    LOOP
        EXECUTE format('DROP EVENT TRIGGER IF EXISTS %I CASCADE', r.evtname);
    END LOOP;
END $$;

-- Step 18: Re-enable remaining triggers
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT nspname, relname, tgname
        FROM pg_trigger t
        JOIN pg_class c ON c.oid = t.tgrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
        AND NOT t.tgisinternal
    LOOP
        BEGIN
            EXECUTE format('ALTER TABLE %I.%I ENABLE TRIGGER %I', 
                          r.nspname, r.relname, r.tgname);
        EXCEPTION WHEN OTHERS THEN
            -- Skip if trigger no longer exists
            NULL;
        END;
    END LOOP;
END $$;

-- Step 19: Final verification - list any remaining tenant_id references
DO $$
DECLARE
    tenant_refs_found BOOLEAN := FALSE;
    r RECORD;
BEGIN
    -- Check columns
    FOR r IN
        SELECT 
            n.nspname as schema_name,
            c.relname as table_name,
            a.attname as column_name
        FROM pg_attribute a
        JOIN pg_class c ON c.oid = a.attrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE a.attname = 'tenant_id'
        AND NOT a.attisdropped
    LOOP
        RAISE WARNING 'Found tenant_id column in %.%', r.schema_name, r.table_name;
        tenant_refs_found := TRUE;
    END LOOP;
    
    -- Check functions
    FOR r IN
        SELECT 
            n.nspname as schema_name,
            p.proname as function_name
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE pg_get_functiondef(p.oid) ILIKE '%tenant_id%'
    LOOP
        RAISE WARNING 'Found tenant_id reference in function %.%', r.schema_name, r.function_name;
        tenant_refs_found := TRUE;
    END LOOP;
    
    IF NOT tenant_refs_found THEN
        RAISE NOTICE 'SUCCESS: All tenant_id references have been removed!';
    END IF;
END $$;

-- Step 20: Vacuum analyze to clean up
VACUUM ANALYZE;