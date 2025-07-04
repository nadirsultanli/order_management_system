-- Add inventory threshold columns to products table
-- These columns are essential for inventory management and reorder logic

BEGIN;

-- Add inventory management columns to products table
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS reorder_level NUMERIC DEFAULT 10 CHECK (reorder_level >= 0),
ADD COLUMN IF NOT EXISTS max_stock_level NUMERIC DEFAULT 100 CHECK (max_stock_level >= 0 AND max_stock_level >= reorder_level),
ADD COLUMN IF NOT EXISTS seasonal_demand_factor NUMERIC DEFAULT 1.0 CHECK (seasonal_demand_factor > 0),
ADD COLUMN IF NOT EXISTS lead_time_days INTEGER DEFAULT 7 CHECK (lead_time_days >= 0);

-- Add helpful comments to explain the new columns
COMMENT ON COLUMN products.reorder_level IS 'Minimum stock level that triggers restocking alerts and transfers';
COMMENT ON COLUMN products.max_stock_level IS 'Maximum recommended stock level to prevent overstocking';
COMMENT ON COLUMN products.seasonal_demand_factor IS 'Multiplier for seasonal demand variations (1.0 = normal, >1.0 = peak season)';
COMMENT ON COLUMN products.lead_time_days IS 'Expected days from order to delivery for this product';

-- Create index for efficient inventory threshold queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_reorder_level 
    ON products (reorder_level) WHERE reorder_level IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_stock_thresholds 
    ON products (tenant_id, reorder_level, max_stock_level) WHERE reorder_level IS NOT NULL;

-- Update existing products with sensible defaults based on product type
UPDATE products 
SET 
    reorder_level = CASE 
        WHEN capacity_kg IS NOT NULL AND capacity_kg >= 50 THEN 5    -- Large cylinders: lower reorder threshold
        WHEN capacity_kg IS NOT NULL AND capacity_kg >= 20 THEN 10   -- Medium cylinders: standard threshold
        WHEN capacity_kg IS NOT NULL AND capacity_kg >= 5 THEN 20    -- Small cylinders: higher threshold
        ELSE 10                                                      -- Default for other products
    END,
    max_stock_level = CASE 
        WHEN capacity_kg IS NOT NULL AND capacity_kg >= 50 THEN 50   -- Large cylinders: lower max stock
        WHEN capacity_kg IS NOT NULL AND capacity_kg >= 20 THEN 100  -- Medium cylinders: standard max stock
        WHEN capacity_kg IS NOT NULL AND capacity_kg >= 5 THEN 200   -- Small cylinders: higher max stock
        ELSE 100                                                     -- Default for other products
    END,
    seasonal_demand_factor = 1.0,
    lead_time_days = CASE 
        WHEN variant_type = 'refillable' THEN 3                     -- Refillable products are faster to restock
        WHEN variant_type = 'disposable' THEN 14                    -- Disposable products may take longer
        ELSE 7                                                       -- Standard lead time
    END
WHERE reorder_level IS NULL OR max_stock_level IS NULL;

-- Add check constraint to ensure max_stock_level is greater than reorder_level
ALTER TABLE products 
ADD CONSTRAINT chk_stock_levels_logical 
CHECK (max_stock_level IS NULL OR reorder_level IS NULL OR max_stock_level >= reorder_level);

-- Create a function to validate stock level settings
CREATE OR REPLACE FUNCTION validate_product_stock_levels()
RETURNS TRIGGER AS $$
BEGIN
    -- Ensure reorder_level is reasonable
    IF NEW.reorder_level IS NOT NULL AND NEW.reorder_level < 0 THEN
        RAISE EXCEPTION 'Reorder level must be non-negative';
    END IF;
    
    -- Ensure max_stock_level is reasonable
    IF NEW.max_stock_level IS NOT NULL AND NEW.max_stock_level < 0 THEN
        RAISE EXCEPTION 'Max stock level must be non-negative';
    END IF;
    
    -- Ensure max_stock_level >= reorder_level
    IF NEW.reorder_level IS NOT NULL AND NEW.max_stock_level IS NOT NULL 
       AND NEW.max_stock_level < NEW.reorder_level THEN
        RAISE EXCEPTION 'Max stock level (%) must be greater than or equal to reorder level (%)', 
                       NEW.max_stock_level, NEW.reorder_level;
    END IF;
    
    -- Warn about unusual values (via notice, won't block the operation)
    IF NEW.reorder_level IS NOT NULL AND NEW.reorder_level > 1000 THEN
        RAISE NOTICE 'Unusually high reorder level (%) for product %', NEW.reorder_level, NEW.name;
    END IF;
    
    IF NEW.max_stock_level IS NOT NULL AND NEW.max_stock_level > 10000 THEN
        RAISE NOTICE 'Unusually high max stock level (%) for product %', NEW.max_stock_level, NEW.name;
    END IF;
    
    -- Auto-set max_stock_level if not provided but reorder_level is
    IF NEW.reorder_level IS NOT NULL AND NEW.max_stock_level IS NULL THEN
        NEW.max_stock_level := NEW.reorder_level * 5; -- Default to 5x reorder level
        RAISE NOTICE 'Auto-setting max stock level to % (5x reorder level) for product %', 
                     NEW.max_stock_level, NEW.name;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to validate stock levels on insert/update
DROP TRIGGER IF EXISTS trg_validate_product_stock_levels ON products;
CREATE TRIGGER trg_validate_product_stock_levels
    BEFORE INSERT OR UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION validate_product_stock_levels();

-- Update RLS policies to include the new columns (they inherit tenant isolation)
-- No additional RLS policies needed as products table already has tenant isolation

-- Grant appropriate permissions
GRANT EXECUTE ON FUNCTION validate_product_stock_levels() TO authenticated;

COMMIT;

-- =============================================================================
-- VERIFICATION AND SAMPLE QUERIES
-- =============================================================================

/*
-- Verify the migration worked correctly:

-- 1. Check that columns were added
SELECT column_name, data_type, column_default, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'products' 
  AND column_name IN ('reorder_level', 'max_stock_level', 'seasonal_demand_factor', 'lead_time_days')
ORDER BY column_name;

-- 2. Check that products have appropriate threshold values
SELECT 
    name,
    capacity_kg,
    variant_type,
    reorder_level,
    max_stock_level,
    lead_time_days
FROM products 
WHERE status = 'active'
LIMIT 10;

-- 3. Test the validation function
INSERT INTO products (
    tenant_id, sku, name, unit_of_measure, variant_type, status,
    reorder_level, max_stock_level
) VALUES (
    '00000000-0000-0000-0000-000000000001'::uuid,
    'TEST-VALIDATION',
    'Test Product',
    'cylinder',
    'refillable',
    'active',
    50,  -- reorder_level
    30   -- max_stock_level (this should fail - less than reorder_level)
);

-- 4. Find products that might need threshold adjustments
SELECT 
    name,
    sku,
    capacity_kg,
    reorder_level,
    max_stock_level,
    CASE 
        WHEN reorder_level > max_stock_level THEN 'INCONSISTENT: Reorder > Max'
        WHEN reorder_level = 0 THEN 'WARNING: Zero reorder level'
        WHEN max_stock_level < 10 THEN 'WARNING: Very low max stock'
        ELSE 'OK'
    END as threshold_status
FROM products 
WHERE status = 'active'
ORDER BY threshold_status DESC, name;

-- 5. Query products approaching reorder levels (example usage)
WITH inventory_summary AS (
    SELECT 
        product_id,
        SUM(qty_full - qty_reserved) as available_stock
    FROM inventory_balance 
    GROUP BY product_id
)
SELECT 
    p.name,
    p.sku,
    p.reorder_level,
    COALESCE(i.available_stock, 0) as current_stock,
    CASE 
        WHEN COALESCE(i.available_stock, 0) <= p.reorder_level THEN 'REORDER NEEDED'
        WHEN COALESCE(i.available_stock, 0) <= p.reorder_level * 1.5 THEN 'LOW STOCK WARNING'
        ELSE 'SUFFICIENT'
    END as stock_status
FROM products p
LEFT JOIN inventory_summary i ON p.id = i.product_id
WHERE p.status = 'active' 
  AND p.reorder_level IS NOT NULL
ORDER BY 
    CASE 
        WHEN COALESCE(i.available_stock, 0) <= p.reorder_level THEN 1
        WHEN COALESCE(i.available_stock, 0) <= p.reorder_level * 1.5 THEN 2
        ELSE 3
    END,
    p.name;
*/