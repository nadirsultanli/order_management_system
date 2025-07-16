-- =============================================================================
-- ADD PRICING METHOD TO PRICE LIST ITEMS
-- =============================================================================

-- Add pricing method column to price_list_item table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'price_list_item' AND column_name = 'pricing_method'
    ) THEN
        ALTER TABLE price_list_item 
        ADD COLUMN pricing_method pricing_method_type DEFAULT 'per_unit';
    END IF;
END $$;

-- Add index for pricing method queries on price_list_item
CREATE INDEX IF NOT EXISTS idx_price_list_item_pricing_method ON price_list_item (pricing_method);

-- Add column comment
COMMENT ON COLUMN price_list_item.pricing_method IS 'Pricing strategy for this item: per_unit, per_kg (weight-based), flat_rate, or tiered';

-- Update existing price list items to have the default pricing method
UPDATE price_list_item 
SET pricing_method = 'per_unit' 
WHERE pricing_method IS NULL;

-- Make the column NOT NULL after setting defaults
ALTER TABLE price_list_item 
ALTER COLUMN pricing_method SET NOT NULL;

-- Add constraint to ensure pricing_method is not null
ALTER TABLE price_list_item 
ADD CONSTRAINT price_list_item_pricing_method_not_null 
CHECK (pricing_method IS NOT NULL); 