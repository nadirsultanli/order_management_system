-- ========================================
-- FIXED INVENTORY THRESHOLDS MIGRATION
-- ========================================
-- This SQL adds missing inventory management columns to the products table.
-- Run this in your Supabase SQL Editor to fix the "column does not exist" error.
-- UPDATED: Removed tenant_id references for single tenant mode

-- Step 1: Add the missing columns
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS reorder_level NUMERIC DEFAULT 10 CHECK (reorder_level >= 0),
ADD COLUMN IF NOT EXISTS max_stock_level NUMERIC DEFAULT 100 CHECK (max_stock_level >= 0 AND max_stock_level >= reorder_level),
ADD COLUMN IF NOT EXISTS seasonal_demand_factor NUMERIC DEFAULT 1.0 CHECK (seasonal_demand_factor > 0),
ADD COLUMN IF NOT EXISTS lead_time_days INTEGER DEFAULT 7 CHECK (lead_time_days >= 0);

-- Step 2: Add helpful comments
COMMENT ON COLUMN products.reorder_level IS 'Minimum stock level that triggers restocking alerts and transfers';
COMMENT ON COLUMN products.max_stock_level IS 'Maximum recommended stock level to prevent overstocking';
COMMENT ON COLUMN products.seasonal_demand_factor IS 'Multiplier for seasonal demand variations (1.0 = normal, >1.0 = peak season)';
COMMENT ON COLUMN products.lead_time_days IS 'Expected days from order to delivery for this product';

-- Step 3: Set smart defaults based on product capacity
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

-- Step 4: Create indexes for better performance (FIXED: removed tenant_id references)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_reorder_level 
    ON products (reorder_level) WHERE reorder_level IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_stock_thresholds 
    ON products (reorder_level, max_stock_level) WHERE reorder_level IS NOT NULL;

-- Step 5: Verify the migration worked
SELECT 
    'Migration verification:' as status,
    count(*) as total_products,
    count(CASE WHEN reorder_level IS NOT NULL THEN 1 END) as products_with_reorder_level,
    count(CASE WHEN max_stock_level IS NOT NULL THEN 1 END) as products_with_max_stock_level
FROM products;

-- Step 6: Show sample products with new thresholds
SELECT 
    name,
    sku,
    capacity_kg,
    variant_type,
    reorder_level,
    max_stock_level,
    lead_time_days
FROM products 
WHERE status = 'active' 
LIMIT 5;

-- Step 7: Check for any products that might need threshold adjustments
SELECT 
    'Products needing attention:' as notice,
    name,
    sku,
    reorder_level,
    max_stock_level,
    CASE 
        WHEN reorder_level > max_stock_level THEN 'ERROR: Reorder level > Max stock level'
        WHEN reorder_level = 0 THEN 'WARNING: Zero reorder level'
        WHEN max_stock_level < 10 THEN 'WARNING: Very low max stock level'
        ELSE 'OK'
    END as threshold_status
FROM products 
WHERE status = 'active'
  AND (reorder_level > max_stock_level OR reorder_level = 0 OR max_stock_level < 10)
ORDER BY 
    CASE 
        WHEN reorder_level > max_stock_level THEN 1
        WHEN reorder_level = 0 THEN 2
        WHEN max_stock_level < 10 THEN 3
        ELSE 4
    END;

-- Migration Complete!
-- The API should now work without "column does not exist" errors.
-- All tenant_id references have been removed for single tenant mode.