-- Fix Pricing System - Add missing columns and update structure
-- This migration fixes the pricing system to support both unit-based and weight-based pricing

BEGIN;

-- =============================================================================
-- PRICE_LIST_ITEM TABLE ENHANCEMENTS
-- =============================================================================

-- Add missing columns to price_list_item table
ALTER TABLE price_list_item 
ADD COLUMN IF NOT EXISTS price_per_kg NUMERIC(10,2) CHECK (price_per_kg >= 0),
ADD COLUMN IF NOT EXISTS pricing_method TEXT DEFAULT 'per_unit' CHECK (pricing_method IN ('per_unit', 'per_kg', 'flat_rate', 'tiered'));

-- Add helpful comments
COMMENT ON COLUMN price_list_item.price_per_kg IS 'Price per kilogram for weight-based pricing';
COMMENT ON COLUMN price_list_item.pricing_method IS 'Pricing method: per_unit, per_kg, flat_rate, or tiered';

-- Update existing records to have proper pricing method
UPDATE price_list_item 
SET pricing_method = 'per_unit' 
WHERE pricing_method IS NULL;

-- =============================================================================
-- PRICE_LIST TABLE ENHANCEMENTS
-- =============================================================================

-- Ensure price_list table has pricing_method column
ALTER TABLE price_list 
ADD COLUMN IF NOT EXISTS pricing_method TEXT DEFAULT 'per_unit' CHECK (pricing_method IN ('per_unit', 'per_kg', 'flat_rate', 'tiered'));

-- Add comment
COMMENT ON COLUMN price_list.pricing_method IS 'Default pricing method for this price list';

-- Update existing price lists to have proper pricing method
UPDATE price_list 
SET pricing_method = 'per_unit' 
WHERE pricing_method IS NULL;

-- =============================================================================
-- CREATE INDEXES FOR PERFORMANCE
-- =============================================================================

-- Create indexes for efficient pricing queries
CREATE INDEX IF NOT EXISTS idx_price_list_item_pricing_method ON price_list_item (pricing_method);
CREATE INDEX IF NOT EXISTS idx_price_list_item_price_per_kg ON price_list_item (price_per_kg) WHERE price_per_kg IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_price_list_pricing_method ON price_list (pricing_method);

-- =============================================================================
-- ADD CONSTRAINT TO ENSURE AT LEAST ONE PRICE IS PROVIDED
-- =============================================================================

-- Add constraint to ensure at least one price field is provided
ALTER TABLE price_list_item 
ADD CONSTRAINT price_list_item_price_check 
CHECK (
  (pricing_method = 'per_unit' AND unit_price IS NOT NULL AND unit_price > 0) OR
  (pricing_method = 'per_kg' AND price_per_kg IS NOT NULL AND price_per_kg > 0) OR
  (pricing_method IN ('flat_rate', 'tiered'))
);

-- =============================================================================
-- UPDATE EXISTING DATA
-- =============================================================================

-- Set default values for any null prices
UPDATE price_list_item 
SET unit_price = 0 
WHERE unit_price IS NULL;

UPDATE price_list_item 
SET price_per_kg = 0 
WHERE price_per_kg IS NULL;

UPDATE price_list_item 
SET min_qty = 1 
WHERE min_qty IS NULL;

UPDATE price_list_item 
SET surcharge_pct = 0 
WHERE surcharge_pct IS NULL;

COMMIT; 