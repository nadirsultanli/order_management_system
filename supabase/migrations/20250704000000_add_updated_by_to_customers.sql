-- Add missing updated_by column to customers table
-- This fixes the "Could not find the 'updated_by' column of 'customers' in the schema cache" error

BEGIN;

-- Add updated_by column to customers table if it doesn't exist
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id);

-- Add created_by column if it doesn't exist for consistency
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);

-- Add comments for documentation
COMMENT ON COLUMN customers.updated_by IS 'User who last updated this customer record';
COMMENT ON COLUMN customers.created_by IS 'User who created this customer record';

-- Create index for better performance on updated_by queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_updated_by 
    ON customers (updated_by) WHERE updated_by IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_created_by 
    ON customers (created_by) WHERE created_by IS NOT NULL;

-- Set default created_by for existing records (optional - can be NULL)
-- UPDATE customers SET created_by = (SELECT id FROM auth.users LIMIT 1) WHERE created_by IS NULL;

COMMIT;

-- Verification query
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'customers' 
  AND column_name IN ('updated_by', 'created_by')
ORDER BY column_name;