-- Add description column to parent_products table
-- This allows parent products to have descriptions like regular products

BEGIN;

-- Add description column to parent_products table
ALTER TABLE parent_products 
ADD COLUMN IF NOT EXISTS description TEXT;

-- Add helpful comment
COMMENT ON COLUMN parent_products.description IS 'Product description for parent products';

-- Update existing parent products with empty description if null
UPDATE parent_products 
SET description = '' 
WHERE description IS NULL;

COMMIT; 