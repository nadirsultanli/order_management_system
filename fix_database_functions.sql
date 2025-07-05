-- ========================================
-- FIX DATABASE FUNCTIONS - REMOVE TENANT REFERENCES
-- ========================================
-- This script removes all tenant_id references from database functions
-- Run this in your Supabase SQL Editor IMMEDIATELY

BEGIN;

-- Drop all tenant-related functions that still reference tenant_id
DROP FUNCTION IF EXISTS calculate_order_balance(uuid);
DROP FUNCTION IF EXISTS get_order_payment_status(uuid);
DROP FUNCTION IF EXISTS validate_payment_for_order(uuid, decimal, uuid);
DROP FUNCTION IF EXISTS generate_payment_id(uuid);
DROP FUNCTION IF EXISTS reserve_stock(uuid, numeric, uuid);
DROP FUNCTION IF EXISTS fulfill_order_line(uuid, numeric, uuid);
DROP FUNCTION IF EXISTS release_reserved_stock(uuid, numeric, uuid);

-- Recreate calculate_order_balance without tenant_id
CREATE OR REPLACE FUNCTION calculate_order_balance(p_order_id uuid)
RETURNS decimal(10,2) AS $$
DECLARE
    order_total decimal(10,2);
    total_payments decimal(10,2);
    balance decimal(10,2);
BEGIN
    -- Get order total
    SELECT COALESCE(total_amount, 0) INTO order_total
    FROM orders WHERE id = p_order_id;
    
    -- Get total completed payments
    SELECT COALESCE(SUM(amount), 0) INTO total_payments
    FROM payments WHERE order_id = p_order_id AND payment_status = 'completed';
    
    balance := order_total - total_payments;
    RETURN balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate get_order_payment_status without tenant_id
CREATE OR REPLACE FUNCTION get_order_payment_status(p_order_id uuid)
RETURNS text AS $$
DECLARE
    order_total decimal(10,2);
    total_payments decimal(10,2);
    balance decimal(10,2);
    due_date timestamp with time zone;
    payment_status text;
BEGIN
    -- Get order details
    SELECT COALESCE(total_amount, 0), payment_due_date
    INTO order_total, due_date
    FROM orders WHERE id = p_order_id;
    
    -- Get total completed payments
    SELECT COALESCE(SUM(amount), 0) INTO total_payments
    FROM payments WHERE order_id = p_order_id AND payment_status = 'completed';
    
    balance := order_total - total_payments;
    
    -- Determine payment status
    IF balance <= 0 THEN
        payment_status := 'paid';
    ELSIF total_payments > 0 THEN
        payment_status := 'partial';
    ELSIF due_date IS NOT NULL AND due_date < now() THEN
        payment_status := 'overdue';
    ELSE
        payment_status := 'pending';
    END IF;
    
    RETURN payment_status;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate validate_payment_for_order without tenant_id
CREATE OR REPLACE FUNCTION validate_payment_for_order(
    p_order_id uuid,
    p_amount decimal(10,2)
)
RETURNS jsonb AS $$
DECLARE
    order_record record;
    balance decimal(10,2);
    validation_result jsonb;
BEGIN
    -- Get order details
    SELECT id, total_amount, status
    INTO order_record
    FROM orders WHERE id = p_order_id;
    
    -- Initialize validation result
    validation_result := jsonb_build_object(
        'valid', false,
        'errors', jsonb_build_array()
    );
    
    -- Check if order exists
    IF order_record.id IS NULL THEN
        validation_result := jsonb_set(
            validation_result,
            '{errors}',
            validation_result->'errors' || jsonb_build_array('Order not found')
        );
        RETURN validation_result;
    END IF;
    
    -- Check order status
    IF order_record.status NOT IN ('delivered', 'invoiced') THEN
        validation_result := jsonb_set(
            validation_result,
            '{errors}',
            validation_result->'errors' || jsonb_build_array('Order must be delivered or invoiced to accept payments')
        );
        RETURN validation_result;
    END IF;
    
    -- Check payment amount
    IF p_amount <= 0 THEN
        validation_result := jsonb_set(
            validation_result,
            '{errors}',
            validation_result->'errors' || jsonb_build_array('Payment amount must be positive')
        );
        RETURN validation_result;
    END IF;
    
    -- Check if payment would exceed order balance
    balance := calculate_order_balance(p_order_id);
    IF p_amount > balance THEN
        validation_result := jsonb_set(
            validation_result,
            '{errors}',
            validation_result->'errors' || jsonb_build_array(
                'Payment amount (' || p_amount || ') exceeds order balance (' || balance || ')'
            )
        );
        RETURN validation_result;
    END IF;
    
    -- All validations passed
    validation_result := jsonb_set(validation_result, '{valid}', 'true'::jsonb);
    validation_result := jsonb_set(validation_result, '{order_balance}', to_jsonb(balance));
    validation_result := jsonb_set(validation_result, '{order_total}', to_jsonb(order_record.total_amount));
    
    RETURN validation_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate generate_payment_id without tenant_id
CREATE OR REPLACE FUNCTION generate_payment_id()
RETURNS text AS $$
DECLARE
    current_year text;
    sequence_num integer;
    payment_id text;
BEGIN
    current_year := EXTRACT(YEAR FROM now())::text;
    
    -- Get next sequence number for this year
    SELECT COALESCE(MAX(
        CASE 
            WHEN payment_id ~ ('^PAY-' || current_year || '-[0-9]+$') 
            THEN (regexp_replace(payment_id, '^PAY-' || current_year || '-([0-9]+)$', '\1'))::integer
            ELSE 0
        END
    ), 0) + 1 INTO sequence_num
    FROM payments
    WHERE payment_id LIKE 'PAY-' || current_year || '-%';
    
    payment_id := 'PAY-' || current_year || '-' || LPAD(sequence_num::text, 3, '0');
    
    RETURN payment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate reserve_stock without tenant_id
CREATE OR REPLACE FUNCTION reserve_stock(
    p_product_id uuid,
    p_quantity numeric
)
RETURNS void AS $$
BEGIN
    UPDATE inventory 
    SET reserved_quantity = reserved_quantity + p_quantity,
        updated_at = now()
    WHERE product_id = p_product_id 
      AND available_quantity >= p_quantity;
      
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Insufficient stock or product not found';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate fulfill_order_line without tenant_id
CREATE OR REPLACE FUNCTION fulfill_order_line(
    p_product_id uuid,
    p_quantity numeric
)
RETURNS void AS $$
BEGIN
    UPDATE inventory 
    SET available_quantity = available_quantity - p_quantity,
        reserved_quantity = reserved_quantity - p_quantity,
        updated_at = now()
    WHERE product_id = p_product_id 
      AND reserved_quantity >= p_quantity;
      
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Insufficient reserved stock or product not found';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate release_reserved_stock without tenant_id
CREATE OR REPLACE FUNCTION release_reserved_stock(
    p_product_id uuid,
    p_quantity numeric
)
RETURNS void AS $$
BEGIN
    UPDATE inventory 
    SET reserved_quantity = reserved_quantity - p_quantity,
        updated_at = now()
    WHERE product_id = p_product_id 
      AND reserved_quantity >= p_quantity;
      
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Insufficient reserved stock to release';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION calculate_order_balance(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_order_payment_status(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION validate_payment_for_order(uuid, decimal) TO authenticated;
GRANT EXECUTE ON FUNCTION generate_payment_id() TO authenticated;
GRANT EXECUTE ON FUNCTION reserve_stock(uuid, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION fulfill_order_line(uuid, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION release_reserved_stock(uuid, numeric) TO authenticated;

COMMIT;

-- Verification queries
SELECT 'Database functions fixed successfully' as status;
SELECT proname, pronargs FROM pg_proc WHERE proname IN ('calculate_order_balance', 'get_order_payment_status', 'validate_payment_for_order', 'generate_payment_id', 'reserve_stock', 'fulfill_order_line', 'release_reserved_stock');