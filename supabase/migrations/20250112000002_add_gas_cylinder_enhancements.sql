-- Gas Cylinder Management Enhancements
-- This migration adds weight-based pricing support, cylinder deposit management,
-- and enhanced inventory condition tracking for comprehensive gas cylinder operations

BEGIN;

-- =============================================================================
-- ENUMS AND TYPES
-- =============================================================================

-- Create pricing method enum for different pricing strategies
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pricing_method_type') THEN
        CREATE TYPE pricing_method_type AS ENUM (
            'per_unit',      -- Traditional per-unit pricing
            'per_kg',        -- Weight-based pricing for gas content
            'flat_rate',     -- Fixed rate regardless of quantity
            'tiered'         -- Volume-based tiered pricing
        );
    END IF;
END $$;

-- =============================================================================
-- PRODUCTS TABLE ENHANCEMENTS - Weight-based Pricing Support
-- =============================================================================

-- Add weight-related fields to products table for gas cylinder specifications
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS gross_weight_kg NUMERIC(8,3) CHECK (gross_weight_kg > 0),
ADD COLUMN IF NOT EXISTS net_gas_weight_kg NUMERIC(8,3) GENERATED ALWAYS AS (
    CASE 
        WHEN gross_weight_kg IS NOT NULL AND tare_weight_kg IS NOT NULL 
        THEN gross_weight_kg - tare_weight_kg 
        ELSE NULL 
    END
) STORED;

-- Add indexes for weight-based queries
CREATE INDEX IF NOT EXISTS idx_products_gross_weight ON products (gross_weight_kg) WHERE gross_weight_kg IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_net_gas_weight ON products (net_gas_weight_kg) WHERE net_gas_weight_kg IS NOT NULL;

-- Add column comments for clarity
COMMENT ON COLUMN products.gross_weight_kg IS 'Total weight of filled gas cylinder including gas and cylinder weight';
COMMENT ON COLUMN products.net_gas_weight_kg IS 'Computed gas content weight (gross_weight_kg - tare_weight_kg)';

-- =============================================================================
-- PRICE LIST ENHANCEMENTS - Pricing Method Support
-- =============================================================================

-- Add pricing method to price_list table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'price_list' AND column_name = 'pricing_method'
    ) THEN
        ALTER TABLE price_list 
        ADD COLUMN pricing_method pricing_method_type DEFAULT 'per_unit';
    END IF;
END $$;

-- Add index for pricing method queries
CREATE INDEX IF NOT EXISTS idx_price_list_pricing_method ON price_list (pricing_method);

-- Add column comment
COMMENT ON COLUMN price_list.pricing_method IS 'Pricing strategy: per_unit, per_kg (weight-based), flat_rate, or tiered';

-- =============================================================================
-- CYLINDER DEPOSIT RATES TABLE
-- =============================================================================

-- Create cylinder deposit rates lookup table for managing deposit amounts
CREATE TABLE IF NOT EXISTS cylinder_deposit_rates (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    capacity_l NUMERIC(6,2) NOT NULL CHECK (capacity_l > 0), -- Cylinder capacity in liters
    deposit_amount NUMERIC(10,2) NOT NULL CHECK (deposit_amount >= 0), -- Deposit amount
    currency_code CHAR(3) NOT NULL DEFAULT 'KES', -- ISO currency code
    effective_date DATE NOT NULL DEFAULT CURRENT_DATE, -- When this rate becomes effective
    end_date DATE, -- When this rate expires (NULL for current rates)
    is_active BOOLEAN NOT NULL DEFAULT true,
    notes TEXT, -- Additional notes about this deposit rate
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_by uuid,
    updated_by uuid,
    
    -- Constraints
    CONSTRAINT valid_date_range CHECK (end_date IS NULL OR end_date >= effective_date),
    CONSTRAINT unique_active_capacity_currency UNIQUE (capacity_l, currency_code, effective_date)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_cylinder_deposit_capacity ON cylinder_deposit_rates (capacity_l);
CREATE INDEX IF NOT EXISTS idx_cylinder_deposit_effective_date ON cylinder_deposit_rates (effective_date DESC);
CREATE INDEX IF NOT EXISTS idx_cylinder_deposit_active ON cylinder_deposit_rates (is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_cylinder_deposit_currency ON cylinder_deposit_rates (currency_code);

-- Add table comment
COMMENT ON TABLE cylinder_deposit_rates IS 'Lookup table for cylinder deposit amounts by capacity and effective date';
COMMENT ON COLUMN cylinder_deposit_rates.capacity_l IS 'Cylinder capacity in liters (e.g., 13, 50)';
COMMENT ON COLUMN cylinder_deposit_rates.deposit_amount IS 'Deposit amount required for this cylinder size';
COMMENT ON COLUMN cylinder_deposit_rates.effective_date IS 'Date when this deposit rate becomes effective';
COMMENT ON COLUMN cylinder_deposit_rates.end_date IS 'Date when this deposit rate expires (NULL for current rates)';

-- =============================================================================
-- INVENTORY BALANCE ENHANCEMENTS - Enhanced Condition Tracking
-- =============================================================================

-- Add condition-specific quantity columns to inventory_balance table
ALTER TABLE inventory_balance 
ADD COLUMN IF NOT EXISTS qty_damaged INTEGER NOT NULL DEFAULT 0 CHECK (qty_damaged >= 0),
ADD COLUMN IF NOT EXISTS qty_quarantine INTEGER NOT NULL DEFAULT 0 CHECK (qty_quarantine >= 0),
ADD COLUMN IF NOT EXISTS qty_under_maintenance INTEGER NOT NULL DEFAULT 0 CHECK (qty_under_maintenance >= 0);

-- Add indexes for condition-based inventory queries
CREATE INDEX IF NOT EXISTS idx_inventory_balance_damaged ON inventory_balance (qty_damaged) WHERE qty_damaged > 0;
CREATE INDEX IF NOT EXISTS idx_inventory_balance_quarantine ON inventory_balance (qty_quarantine) WHERE qty_quarantine > 0;
CREATE INDEX IF NOT EXISTS idx_inventory_balance_maintenance ON inventory_balance (qty_under_maintenance) WHERE qty_under_maintenance > 0;

-- Add column comments
COMMENT ON COLUMN inventory_balance.qty_damaged IS 'Quantity of cylinders with damage requiring repair or disposal';
COMMENT ON COLUMN inventory_balance.qty_quarantine IS 'Quantity of cylinders quarantined for quality control or investigation';
COMMENT ON COLUMN inventory_balance.qty_under_maintenance IS 'Quantity of cylinders currently undergoing maintenance or inspection';

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Function to get current deposit rate for a cylinder capacity
CREATE OR REPLACE FUNCTION get_current_deposit_rate(
    p_capacity_l NUMERIC,
    p_currency_code CHAR(3) DEFAULT 'KES',
    p_as_of_date DATE DEFAULT CURRENT_DATE
)
RETURNS NUMERIC AS $$
DECLARE
    deposit_rate NUMERIC(10,2);
BEGIN
    SELECT deposit_amount INTO deposit_rate
    FROM cylinder_deposit_rates
    WHERE capacity_l = p_capacity_l 
      AND currency_code = p_currency_code
      AND effective_date <= p_as_of_date
      AND (end_date IS NULL OR end_date >= p_as_of_date)
      AND is_active = true
    ORDER BY effective_date DESC
    LIMIT 1;
    
    RETURN COALESCE(deposit_rate, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate total available inventory (excluding problematic stock)
CREATE OR REPLACE FUNCTION get_available_inventory(
    p_warehouse_id uuid,
    p_product_id uuid
)
RETURNS INTEGER AS $$
DECLARE
    available_qty INTEGER;
BEGIN
    SELECT 
        GREATEST(0, 
            qty_full + qty_empty - qty_reserved - qty_damaged - qty_quarantine - qty_under_maintenance
        ) INTO available_qty
    FROM inventory_balance
    WHERE warehouse_id = p_warehouse_id 
      AND product_id = p_product_id;
    
    RETURN COALESCE(available_qty, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get inventory condition summary
CREATE OR REPLACE FUNCTION get_inventory_condition_summary(
    p_warehouse_id uuid DEFAULT NULL,
    p_product_id uuid DEFAULT NULL
)
RETURNS TABLE (
    warehouse_id uuid,
    product_id uuid,
    total_qty INTEGER,
    available_qty INTEGER,
    problematic_qty INTEGER,
    qty_full INTEGER,
    qty_empty INTEGER,
    qty_reserved INTEGER,
    qty_damaged INTEGER,
    qty_quarantine INTEGER,
    qty_under_maintenance INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ib.warehouse_id,
        ib.product_id,
        (ib.qty_full + ib.qty_empty) as total_qty,
        GREATEST(0, ib.qty_full + ib.qty_empty - ib.qty_reserved - ib.qty_damaged - ib.qty_quarantine - ib.qty_under_maintenance) as available_qty,
        (ib.qty_damaged + ib.qty_quarantine + ib.qty_under_maintenance) as problematic_qty,
        ib.qty_full,
        ib.qty_empty,
        ib.qty_reserved,
        ib.qty_damaged,
        ib.qty_quarantine,
        ib.qty_under_maintenance
    FROM inventory_balance ib
    WHERE (p_warehouse_id IS NULL OR ib.warehouse_id = p_warehouse_id)
      AND (p_product_id IS NULL OR ib.product_id = p_product_id)
    ORDER BY ib.warehouse_id, ib.product_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Update trigger for inventory_balance to maintain data consistency
CREATE OR REPLACE FUNCTION validate_inventory_quantities()
RETURNS TRIGGER AS $$
BEGIN
    -- Ensure no negative quantities
    IF NEW.qty_full < 0 OR NEW.qty_empty < 0 OR NEW.qty_reserved < 0 OR 
       NEW.qty_damaged < 0 OR NEW.qty_quarantine < 0 OR NEW.qty_under_maintenance < 0 THEN
        RAISE EXCEPTION 'Inventory quantities cannot be negative';
    END IF;
    
    -- Ensure reserved quantity doesn't exceed available stock
    IF NEW.qty_reserved > (NEW.qty_full + NEW.qty_empty - NEW.qty_damaged - NEW.qty_quarantine - NEW.qty_under_maintenance) THEN
        RAISE EXCEPTION 'Reserved quantity cannot exceed available stock (excluding damaged, quarantine, and maintenance)';
    END IF;
    
    NEW.updated_at := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_validate_inventory_quantities
    BEFORE UPDATE ON inventory_balance
    FOR EACH ROW
    EXECUTE FUNCTION validate_inventory_quantities();

-- Update trigger for cylinder_deposit_rates
CREATE OR REPLACE FUNCTION update_cylinder_deposit_rates_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_cylinder_deposit_rates_timestamp
    BEFORE UPDATE ON cylinder_deposit_rates
    FOR EACH ROW
    EXECUTE FUNCTION update_cylinder_deposit_rates_timestamp();

-- =============================================================================
-- INITIAL DATA - Common Cylinder Sizes and Deposit Rates
-- =============================================================================

-- Insert common cylinder deposit rates for Kenya market
INSERT INTO cylinder_deposit_rates (capacity_l, deposit_amount, currency_code, effective_date, notes) VALUES
(13, 3500.00, 'KES', CURRENT_DATE, '13kg gas cylinder deposit - standard residential size'),
(50, 8500.00, 'KES', CURRENT_DATE, '50kg gas cylinder deposit - commercial/industrial size'),
(6, 2500.00, 'KES', CURRENT_DATE, '6kg gas cylinder deposit - small residential size'),
(25, 5500.00, 'KES', CURRENT_DATE, '25kg gas cylinder deposit - medium commercial size')
ON CONFLICT (capacity_l, currency_code, effective_date) DO NOTHING;

-- =============================================================================
-- GRANT PERMISSIONS
-- =============================================================================

-- Grant execute permissions on helper functions
GRANT EXECUTE ON FUNCTION get_current_deposit_rate(NUMERIC, CHAR, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION get_available_inventory(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_inventory_condition_summary(uuid, uuid) TO authenticated;

COMMIT;

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================

-- Verify products table enhancements
SELECT 
    'Products table weight fields verification:' as status,
    COUNT(*) as total_products,
    COUNT(gross_weight_kg) as products_with_gross_weight,
    COUNT(net_gas_weight_kg) as products_with_net_weight,
    COUNT(tare_weight_kg) as products_with_tare_weight
FROM products;

-- Verify cylinder deposit rates
SELECT 
    'Cylinder deposit rates verification:' as status,
    COUNT(*) as total_rates,
    COUNT(DISTINCT capacity_l) as unique_capacities,
    MIN(deposit_amount) as min_deposit,
    MAX(deposit_amount) as max_deposit
FROM cylinder_deposit_rates
WHERE is_active = true;

-- Verify inventory balance enhancements
SELECT 
    'Inventory balance condition fields verification:' as status,
    COUNT(*) as total_inventory_records,
    SUM(qty_damaged) as total_damaged,
    SUM(qty_quarantine) as total_quarantine,
    SUM(qty_under_maintenance) as total_under_maintenance
FROM inventory_balance;

-- Test helper functions
SELECT 
    'Helper functions test:' as status,
    get_current_deposit_rate(13, 'KES') as deposit_13kg,
    get_current_deposit_rate(50, 'KES') as deposit_50kg;

-- Verify indexes were created
SELECT 
    'Index verification:' as status,
    COUNT(*) as new_indexes_created
FROM pg_indexes 
WHERE tablename IN ('products', 'cylinder_deposit_rates', 'inventory_balance', 'price_list')
  AND indexname LIKE '%gross_weight%' 
   OR indexname LIKE '%net_gas_weight%'
   OR indexname LIKE '%deposit%'
   OR indexname LIKE '%damaged%'
   OR indexname LIKE '%quarantine%'
   OR indexname LIKE '%maintenance%'
   OR indexname LIKE '%pricing_method%';