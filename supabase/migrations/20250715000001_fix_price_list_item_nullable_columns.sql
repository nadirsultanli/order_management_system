-- =============================================================================
-- FIX PRICE LIST ITEM NULLABLE COLUMNS
-- =============================================================================

-- Make unit_price column nullable to support per_kg pricing
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'price_list_item' 
        AND column_name = 'unit_price' 
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE price_list_item 
        ALTER COLUMN unit_price DROP NOT NULL;
    END IF;
END $$;

-- Make price_per_kg column nullable to support per_unit pricing
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'price_list_item' 
        AND column_name = 'price_per_kg' 
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE price_list_item 
        ALTER COLUMN price_per_kg DROP NOT NULL;
    END IF;
END $$;

-- Add check constraint to ensure at least one price field is provided
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints 
        WHERE constraint_name = 'check_price_list_item_has_price'
    ) THEN
        ALTER TABLE price_list_item 
        ADD CONSTRAINT check_price_list_item_has_price 
        CHECK (
            (unit_price IS NOT NULL AND unit_price > 0) OR 
            (price_per_kg IS NOT NULL AND price_per_kg > 0)
        );
    END IF;
END $$;

-- Add comment explaining the constraint
COMMENT ON CONSTRAINT check_price_list_item_has_price ON price_list_item IS 
'Ensures that either unit_price or price_per_kg is provided and greater than 0';

-- Update column comments
COMMENT ON COLUMN price_list_item.unit_price IS 
'Unit price for per_unit pricing method (nullable for per_kg pricing)';

COMMENT ON COLUMN price_list_item.price_per_kg IS 
'Price per kg for per_kg pricing method (nullable for per_unit pricing)'; 