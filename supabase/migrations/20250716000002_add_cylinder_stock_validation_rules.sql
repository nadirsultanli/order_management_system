-- =============================================================================
-- ADD CYLINDER STOCK VALIDATION RULES
-- =============================================================================

-- Add validation rules for cylinder stock to prevent negative FULL stock 
-- but allow negative EMPTY stock (customer owes empties)

-- Add check constraint to prevent negative FULL cylinder stock
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints 
        WHERE constraint_name = 'check_full_cylinder_stock_not_negative'
    ) THEN
        ALTER TABLE inventory_balance 
        ADD CONSTRAINT check_full_cylinder_stock_not_negative 
        CHECK (qty_full >= 0);
    END IF;
END $$;

-- Add check constraint to ensure reserved stock doesn't exceed full stock
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints 
        WHERE constraint_name = 'check_reserved_not_exceed_full_stock'
    ) THEN
        ALTER TABLE inventory_balance 
        ADD CONSTRAINT check_reserved_not_exceed_full_stock 
        CHECK (qty_reserved <= qty_full);
    END IF;
END $$;

-- Add check constraint to ensure damaged, quarantine, and maintenance quantities are non-negative
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints 
        WHERE constraint_name = 'check_condition_quantities_not_negative'
    ) THEN
        ALTER TABLE inventory_balance 
        ADD CONSTRAINT check_condition_quantities_not_negative 
        CHECK (
            (qty_damaged IS NULL OR qty_damaged >= 0) AND
            (qty_quarantine IS NULL OR qty_quarantine >= 0) AND
            (qty_under_maintenance IS NULL OR qty_under_maintenance >= 0)
        );
    END IF;
END $$;

-- Create function to validate stock operations for cylinder products
CREATE OR REPLACE FUNCTION validate_cylinder_stock_operation()
RETURNS TRIGGER AS $$
DECLARE
    product_variant TEXT;
    available_full_stock INTEGER;
BEGIN
    -- Get product variant information
    SELECT p.sku_variant INTO product_variant
    FROM products p
    WHERE p.id = NEW.product_id;
    
    -- Only apply validation to cylinder products with variants
    IF product_variant IS NOT NULL THEN
        -- For FULL cylinders, ensure we never go negative on available stock
        IF product_variant IN ('FULL-OUT', 'FULL-XCH') THEN
            available_full_stock := NEW.qty_full - NEW.qty_reserved;
            
            IF available_full_stock < 0 THEN
                RAISE EXCEPTION 'Cannot have negative available stock for FULL cylinders. Product: %, Available: %, Reserved: %', 
                    product_variant, NEW.qty_full, NEW.qty_reserved;
            END IF;
        END IF;
        
        -- For EMPTY cylinders, allow negative stock (customer owes empties)
        -- No additional validation needed as negative empty stock is allowed
        
        -- Log stock operation for audit trail
        INSERT INTO stock_movements (
            product_id,
            warehouse_id,
            movement_type,
            qty_full_change,
            qty_empty_change,
            qty_reserved_change,
            reference_type,
            reference_id,
            notes,
            created_at
        ) VALUES (
            NEW.product_id,
            NEW.warehouse_id,
            CASE 
                WHEN TG_OP = 'INSERT' THEN 'initial_stock'
                WHEN TG_OP = 'UPDATE' THEN 'adjustment'
                ELSE 'unknown'
            END,
            CASE WHEN TG_OP = 'INSERT' THEN NEW.qty_full ELSE NEW.qty_full - COALESCE(OLD.qty_full, 0) END,
            CASE WHEN TG_OP = 'INSERT' THEN NEW.qty_empty ELSE NEW.qty_empty - COALESCE(OLD.qty_empty, 0) END,
            CASE WHEN TG_OP = 'INSERT' THEN NEW.qty_reserved ELSE NEW.qty_reserved - COALESCE(OLD.qty_reserved, 0) END,
            'inventory_balance',
            NEW.id,
            'Automatic stock movement from inventory balance trigger',
            NOW()
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to validate stock operations
DROP TRIGGER IF EXISTS trigger_validate_cylinder_stock_operation ON inventory_balance;
CREATE TRIGGER trigger_validate_cylinder_stock_operation
    BEFORE INSERT OR UPDATE ON inventory_balance
    FOR EACH ROW
    EXECUTE FUNCTION validate_cylinder_stock_operation();

-- Create function to check available stock before order allocation
CREATE OR REPLACE FUNCTION check_available_full_stock(
    p_product_id UUID,
    p_warehouse_id UUID,
    p_required_quantity INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
    available_stock INTEGER;
    product_variant TEXT;
BEGIN
    -- Get product variant
    SELECT sku_variant INTO product_variant
    FROM products
    WHERE id = p_product_id;
    
    -- Only check for FULL cylinder variants
    IF product_variant NOT IN ('FULL-OUT', 'FULL-XCH') THEN
        RETURN TRUE; -- No restriction for other variants
    END IF;
    
    -- Calculate available stock (full - reserved)
    SELECT COALESCE(qty_full - qty_reserved, 0) INTO available_stock
    FROM inventory_balance
    WHERE product_id = p_product_id 
      AND warehouse_id = p_warehouse_id;
    
    -- Return true if we have enough stock
    RETURN COALESCE(available_stock, 0) >= p_required_quantity;
END;
$$ LANGUAGE plpgsql;

-- Create function to reserve stock for orders
CREATE OR REPLACE FUNCTION reserve_cylinder_stock(
    p_product_id UUID,
    p_warehouse_id UUID,
    p_quantity INTEGER,
    p_order_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
    available_stock INTEGER;
    product_variant TEXT;
BEGIN
    -- Get product variant
    SELECT sku_variant INTO product_variant
    FROM products
    WHERE id = p_product_id;
    
    -- Only apply reservation logic to FULL cylinder variants
    IF product_variant NOT IN ('FULL-OUT', 'FULL-XCH') THEN
        RETURN TRUE; -- No reservation needed for other variants
    END IF;
    
    -- Check available stock first
    IF NOT check_available_full_stock(p_product_id, p_warehouse_id, p_quantity) THEN
        RAISE EXCEPTION 'Insufficient stock available for product % at warehouse %. Required: %, Available: %',
            p_product_id, p_warehouse_id, p_quantity, 
            (SELECT COALESCE(qty_full - qty_reserved, 0) FROM inventory_balance 
             WHERE product_id = p_product_id AND warehouse_id = p_warehouse_id);
    END IF;
    
    -- Reserve the stock
    UPDATE inventory_balance
    SET qty_reserved = qty_reserved + p_quantity,
        updated_at = NOW()
    WHERE product_id = p_product_id 
      AND warehouse_id = p_warehouse_id;
    
    -- Log the reservation
    INSERT INTO stock_movements (
        product_id,
        warehouse_id,
        movement_type,
        qty_reserved_change,
        reference_type,
        reference_id,
        notes,
        created_at
    ) VALUES (
        p_product_id,
        p_warehouse_id,
        'order_reserve',
        p_quantity,
        'order',
        p_order_id,
        'Stock reserved for order allocation',
        NOW()
    );
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Create function to release reserved stock
CREATE OR REPLACE FUNCTION release_cylinder_stock(
    p_product_id UUID,
    p_warehouse_id UUID,
    p_quantity INTEGER,
    p_order_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
    product_variant TEXT;
BEGIN
    -- Get product variant
    SELECT sku_variant INTO product_variant
    FROM products
    WHERE id = p_product_id;
    
    -- Only apply to FULL cylinder variants
    IF product_variant NOT IN ('FULL-OUT', 'FULL-XCH') THEN
        RETURN TRUE;
    END IF;
    
    -- Release the reserved stock
    UPDATE inventory_balance
    SET qty_reserved = GREATEST(0, qty_reserved - p_quantity),
        updated_at = NOW()
    WHERE product_id = p_product_id 
      AND warehouse_id = p_warehouse_id;
    
    -- Log the release
    INSERT INTO stock_movements (
        product_id,
        warehouse_id,
        movement_type,
        qty_reserved_change,
        reference_type,
        reference_id,
        notes,
        created_at
    ) VALUES (
        p_product_id,
        p_warehouse_id,
        'order_release',
        -p_quantity,
        'order',
        p_order_id,
        'Stock reservation released',
        NOW()
    );
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON CONSTRAINT check_full_cylinder_stock_not_negative ON inventory_balance IS 
'Prevents negative stock for FULL cylinders to maintain inventory integrity';

COMMENT ON CONSTRAINT check_reserved_not_exceed_full_stock ON inventory_balance IS 
'Ensures reserved stock never exceeds available full stock';

COMMENT ON CONSTRAINT check_condition_quantities_not_negative ON inventory_balance IS 
'Ensures damaged, quarantine, and maintenance quantities are non-negative';

COMMENT ON FUNCTION validate_cylinder_stock_operation() IS 
'Validates stock operations for cylinder products and creates audit trail';

COMMENT ON FUNCTION check_available_full_stock(UUID, UUID, INTEGER) IS 
'Checks if sufficient FULL cylinder stock is available before allocation';

COMMENT ON FUNCTION reserve_cylinder_stock(UUID, UUID, INTEGER, UUID) IS 
'Reserves FULL cylinder stock for order allocation with validation';

COMMENT ON FUNCTION release_cylinder_stock(UUID, UUID, INTEGER, UUID) IS 
'Releases reserved FULL cylinder stock when orders are cancelled or completed';