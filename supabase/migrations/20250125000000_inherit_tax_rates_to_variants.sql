-- Migration to inherit tax rates from parent products to variants
-- This ensures all existing variants have proper tax information

BEGIN;

-- =============================================================================
-- UPDATE VARIANTS TO INHERIT TAX RATES FROM PARENT PRODUCTS
-- =============================================================================

-- Update variants to inherit tax_rate and tax_category from parent products
UPDATE products 
SET 
  tax_rate = parent_products.tax_rate,
  tax_category = parent_products.tax_category,
  updated_at = NOW()
FROM parent_products
WHERE products.parent_products_id = parent_products.id
  AND products.is_variant = true
  AND (products.tax_rate IS NULL OR products.tax_category IS NULL);

-- Log the count of updated variants
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % variants with tax information from parent products', updated_count;
END
$$;

-- =============================================================================
-- UPDATE VARIANT CREATION TO INHERIT TAX INFORMATION
-- =============================================================================

-- Create or replace trigger function to automatically inherit tax information
-- when creating new variants
CREATE OR REPLACE FUNCTION inherit_tax_from_parent()
RETURNS TRIGGER AS $$
BEGIN
  -- Only apply to variants
  IF NEW.is_variant = true AND NEW.parent_products_id IS NOT NULL THEN
    -- If tax_rate or tax_category is null, inherit from parent
    IF NEW.tax_rate IS NULL OR NEW.tax_category IS NULL THEN
      SELECT 
        COALESCE(NEW.tax_rate, p.tax_rate) as inherited_tax_rate,
        COALESCE(NEW.tax_category, p.tax_category) as inherited_tax_category
      INTO NEW.tax_rate, NEW.tax_category
      FROM parent_products p
      WHERE p.id = NEW.parent_products_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to inherit tax information on insert
DROP TRIGGER IF EXISTS inherit_tax_on_variant_insert ON products;
CREATE TRIGGER inherit_tax_on_variant_insert
  BEFORE INSERT ON products
  FOR EACH ROW
  EXECUTE FUNCTION inherit_tax_from_parent();

-- Create trigger to inherit tax information on update
DROP TRIGGER IF EXISTS inherit_tax_on_variant_update ON products;
CREATE TRIGGER inherit_tax_on_variant_update
  BEFORE UPDATE ON products
  FOR EACH ROW
  WHEN (OLD.parent_products_id IS DISTINCT FROM NEW.parent_products_id)
  EXECUTE FUNCTION inherit_tax_from_parent();

-- =============================================================================
-- VERIFY THE UPDATES
-- =============================================================================

-- Create a view to easily check tax inheritance
CREATE OR REPLACE VIEW variant_tax_inheritance AS
SELECT 
  v.id as variant_id,
  v.sku as variant_sku,
  v.name as variant_name,
  v.tax_rate as variant_tax_rate,
  v.tax_category as variant_tax_category,
  p.id as parent_id,
  p.sku as parent_sku,
  p.name as parent_name,
  p.tax_rate as parent_tax_rate,
  p.tax_category as parent_tax_category,
  CASE 
    WHEN v.tax_rate IS NOT NULL AND v.tax_category IS NOT NULL THEN 'Has Own Tax Info'
    WHEN p.tax_rate IS NOT NULL AND p.tax_category IS NOT NULL THEN 'Needs Inheritance'
    ELSE 'No Tax Info Available'
  END as tax_status
FROM products v
LEFT JOIN parent_products p ON v.parent_products_id = p.id
WHERE v.is_variant = true
ORDER BY v.sku;

-- Grant permissions
GRANT SELECT ON variant_tax_inheritance TO authenticated;

COMMIT; 