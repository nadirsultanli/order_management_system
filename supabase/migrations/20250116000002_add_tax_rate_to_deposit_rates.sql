-- Add Tax Rate to Cylinder Deposit Rates
-- This migration adds tax_rate column to cylinder_deposit_rates table
-- and updates the pricing system to use tax rates from deposit rates based on capacity

BEGIN;

-- =============================================================================
-- CYLINDER DEPOSIT RATES ENHANCEMENTS
-- =============================================================================

-- Add tax_rate column to cylinder_deposit_rates table
ALTER TABLE cylinder_deposit_rates 
ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5,4) DEFAULT 0.16 CHECK (tax_rate >= 0 AND tax_rate <= 1);

-- Add comment
COMMENT ON COLUMN cylinder_deposit_rates.tax_rate IS 'Tax rate as decimal (e.g., 0.16 for 16%) for this cylinder capacity';

-- Update existing records to have default tax rate of 16%
UPDATE cylinder_deposit_rates 
SET tax_rate = 0.16 
WHERE tax_rate IS NULL;

-- Create index for tax rate queries
CREATE INDEX IF NOT EXISTS idx_cylinder_deposit_tax_rate ON cylinder_deposit_rates (tax_rate);

-- =============================================================================
-- UPDATE EXISTING DEPOSIT RATES WITH TAX RATES
-- =============================================================================

-- Update common cylinder sizes with appropriate tax rates
UPDATE cylinder_deposit_rates 
SET tax_rate = 0.16 
WHERE capacity_l IN (6, 13, 25, 50) 
AND tax_rate IS NULL;

-- =============================================================================
-- CREATE FUNCTION TO GET TAX RATE BY CAPACITY
-- =============================================================================

-- Function to get current tax rate for a cylinder capacity
CREATE OR REPLACE FUNCTION get_current_tax_rate(
    p_capacity_l NUMERIC,
    p_currency_code CHAR(3) DEFAULT 'KES',
    p_as_of_date DATE DEFAULT CURRENT_DATE
)
RETURNS NUMERIC AS $$
DECLARE
    v_tax_rate NUMERIC;
BEGIN
    -- Get the most recent tax rate for the given capacity
    SELECT tax_rate INTO v_tax_rate
    FROM cylinder_deposit_rates
    WHERE capacity_l = p_capacity_l
      AND currency_code = p_currency_code
      AND is_active = true
      AND effective_date <= p_as_of_date
      AND (end_date IS NULL OR end_date >= p_as_of_date)
    ORDER BY effective_date DESC
    LIMIT 1;

    -- Return the tax rate, or default to 16% if not found
    RETURN COALESCE(v_tax_rate, 0.16);
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_current_tax_rate(NUMERIC, CHAR, DATE) TO authenticated;

-- =============================================================================
-- UPDATE PRICING CALCULATION TO USE DEPOSIT RATE TAX
-- =============================================================================

-- Create a function to calculate tax based on deposit rates
CREATE OR REPLACE FUNCTION calculate_tax_from_deposit_rate(
    p_capacity_l NUMERIC,
    p_amount NUMERIC,
    p_currency_code CHAR(3) DEFAULT 'KES',
    p_as_of_date DATE DEFAULT CURRENT_DATE
)
RETURNS NUMERIC AS $$
DECLARE
    v_tax_rate NUMERIC;
BEGIN
    -- Get tax rate from deposit rates
    v_tax_rate := get_current_tax_rate(p_capacity_l, p_currency_code, p_as_of_date);
    
    -- Calculate and return tax amount
    RETURN p_amount * v_tax_rate;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION calculate_tax_from_deposit_rate(NUMERIC, NUMERIC, CHAR, DATE) TO authenticated;

COMMIT; 