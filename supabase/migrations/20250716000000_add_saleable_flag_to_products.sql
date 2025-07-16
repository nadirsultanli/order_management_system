-- =============================================================================
-- ADD SALEABLE FLAG TO PRODUCTS TABLE
-- =============================================================================

-- Add saleable column to products table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' 
        AND column_name = 'saleable'
    ) THEN
        ALTER TABLE products 
        ADD COLUMN saleable BOOLEAN DEFAULT true NOT NULL;
    END IF;
END $$;

-- Create index for performance on saleable products
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'products' 
        AND indexname = 'idx_products_saleable_active'
    ) THEN
        CREATE INDEX idx_products_saleable_active ON products (saleable, status, created_at) 
        WHERE saleable = true AND status = 'active';
    END IF;
END $$;

-- Set EMPTY variants to non-saleable
DO $$
BEGIN
    UPDATE products 
    SET saleable = false 
    WHERE sku_variant = 'EMPTY' AND saleable = true;
END $$;

-- Add constraint to ensure EMPTY variants are not saleable
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints 
        WHERE constraint_name = 'check_empty_variants_not_saleable'
    ) THEN
        ALTER TABLE products 
        ADD CONSTRAINT check_empty_variants_not_saleable 
        CHECK (
            (sku_variant = 'EMPTY' AND saleable = false) OR 
            (sku_variant != 'EMPTY')
        );
    END IF;
END $$;

-- Add comments
COMMENT ON COLUMN products.saleable IS 
'Indicates whether this product variant can be sold. EMPTY variants must be false.';

COMMENT ON CONSTRAINT check_empty_variants_not_saleable ON products IS 
'Ensures EMPTY variants cannot be marked as saleable';