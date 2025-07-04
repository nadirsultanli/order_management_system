-- Add audit columns (created_by, updated_by) to addresses table for consistency
-- This ensures all tables have proper audit trail capabilities

BEGIN;

-- Add audit columns to addresses table if they don't exist
ALTER TABLE addresses 
ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id);

-- Add comments for documentation
COMMENT ON COLUMN addresses.created_by IS 'User who created this address record';
COMMENT ON COLUMN addresses.updated_by IS 'User who last updated this address record';

-- Create indexes for better performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_addresses_created_by 
    ON addresses (created_by) WHERE created_by IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_addresses_updated_by 
    ON addresses (updated_by) WHERE updated_by IS NOT NULL;

COMMIT;

-- Verification query
SELECT 
    table_name,
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name IN ('customers', 'addresses') 
  AND column_name IN ('created_by', 'updated_by')
ORDER BY table_name, column_name;