-- Add price_per_kg column to price_list_item table
ALTER TABLE price_list_item 
ADD COLUMN IF NOT EXISTS price_per_kg NUMERIC(10,2) CHECK (price_per_kg >= 0);

-- Add comment for clarity
COMMENT ON COLUMN price_list_item.price_per_kg IS 'Price per kilogram of gas content (used when pricing_method is per_kg)';

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_price_list_item_price_per_kg ON price_list_item (price_per_kg) WHERE price_per_kg IS NOT NULL; 