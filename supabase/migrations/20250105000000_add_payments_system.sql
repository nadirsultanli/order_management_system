-- Payment System Infrastructure
-- This migration adds comprehensive payment tracking capabilities to the OMS
-- including payments table, order table enhancements, and RLS policies

BEGIN;

-- =============================================================================
-- PAYMENTS TABLE
-- =============================================================================

-- Create payments table for recording all payment transactions
CREATE TABLE IF NOT EXISTS payments (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    payment_id text NOT NULL, -- Human-readable payment ID (e.g., PAY-2025-001)
    order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    amount decimal(10,2) NOT NULL CHECK (amount > 0),
    payment_method text NOT NULL CHECK (payment_method IN ('Cash', 'Mpesa', 'Card')),
    payment_status text NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded')),
    transaction_id text, -- External transaction ID (e.g., Mpesa transaction ID)
    payment_date timestamp with time zone,
    reference_number text, -- Additional reference like receipt number
    notes text,
    metadata jsonb DEFAULT '{}', -- Additional payment metadata
    
    -- Audit fields
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by uuid,
    updated_by uuid,
    
    -- Constraints
    CONSTRAINT unique_payment_id_per_tenant UNIQUE (payment_id, tenant_id),
    CONSTRAINT valid_payment_date CHECK (payment_date IS NULL OR payment_date <= now() + interval '1 day')
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_payments_tenant_id ON payments (tenant_id);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments (order_id);
CREATE INDEX IF NOT EXISTS idx_payments_payment_date ON payments (payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_payments_payment_method ON payments (payment_method);
CREATE INDEX IF NOT EXISTS idx_payments_payment_status ON payments (payment_status);
CREATE INDEX IF NOT EXISTS idx_payments_transaction_id ON payments (transaction_id) WHERE transaction_id IS NOT NULL;

-- =============================================================================
-- ORDERS TABLE ENHANCEMENTS
-- =============================================================================

-- Add payment-related columns to orders table
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS payment_date timestamp with time zone,
ADD COLUMN IF NOT EXISTS invoice_date timestamp with time zone,
ADD COLUMN IF NOT EXISTS payment_terms_days integer DEFAULT 30,
ADD COLUMN IF NOT EXISTS payment_due_date timestamp with time zone,
ADD COLUMN IF NOT EXISTS payment_status_cache text DEFAULT 'pending' CHECK (payment_status_cache IN ('pending', 'partial', 'paid', 'overdue'));

-- Add indexes for new order payment fields
CREATE INDEX IF NOT EXISTS idx_orders_payment_date ON orders (payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_orders_invoice_date ON orders (invoice_date DESC);
CREATE INDEX IF NOT EXISTS idx_orders_payment_due_date ON orders (payment_due_date);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status_cache ON orders (payment_status_cache);

-- Create trigger to update payment_due_date when invoice_date is set
CREATE OR REPLACE FUNCTION update_payment_due_date()
RETURNS TRIGGER AS $$
BEGIN
    -- Update payment due date when invoice date is set
    IF NEW.invoice_date IS NOT NULL AND (OLD.invoice_date IS NULL OR NEW.invoice_date != OLD.invoice_date) THEN
        NEW.payment_due_date := NEW.invoice_date + (COALESCE(NEW.payment_terms_days, 30) || ' days')::interval;
    END IF;
    
    NEW.updated_at := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_payment_due_date
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION update_payment_due_date();

-- =============================================================================
-- PAYMENT HELPER FUNCTIONS
-- =============================================================================

-- Function to calculate order balance (total - payments)
CREATE OR REPLACE FUNCTION calculate_order_balance(p_order_id uuid)
RETURNS decimal(10,2) AS $$
DECLARE
    order_total decimal(10,2);
    total_payments decimal(10,2);
    balance decimal(10,2);
BEGIN
    -- Get order total
    SELECT COALESCE(total_amount, 0) INTO order_total
    FROM orders
    WHERE id = p_order_id;
    
    -- Get total completed payments
    SELECT COALESCE(SUM(amount), 0) INTO total_payments
    FROM payments
    WHERE order_id = p_order_id 
      AND payment_status = 'completed';
    
    balance := order_total - total_payments;
    
    RETURN balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get order payment status
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
    SELECT 
        COALESCE(total_amount, 0),
        payment_due_date
    INTO order_total, due_date
    FROM orders
    WHERE id = p_order_id;
    
    -- Get total completed payments
    SELECT COALESCE(SUM(amount), 0) INTO total_payments
    FROM payments
    WHERE order_id = p_order_id 
      AND payment_status = 'completed';
    
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

-- Function to update order payment status cache
CREATE OR REPLACE FUNCTION update_order_payment_status_cache(p_order_id uuid)
RETURNS void AS $$
DECLARE
    new_status text;
BEGIN
    new_status := get_order_payment_status(p_order_id);
    
    UPDATE orders 
    SET payment_status_cache = new_status,
        updated_at = now()
    WHERE id = p_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to generate payment ID
CREATE OR REPLACE FUNCTION generate_payment_id(p_tenant_id uuid)
RETURNS text AS $$
DECLARE
    current_year text;
    sequence_num integer;
    payment_id text;
BEGIN
    current_year := EXTRACT(YEAR FROM now())::text;
    
    -- Get next sequence number for this tenant and year
    SELECT COALESCE(MAX(
        CASE 
            WHEN payment_id ~ ('^PAY-' || current_year || '-[0-9]+$') 
            THEN (regexp_replace(payment_id, '^PAY-' || current_year || '-([0-9]+)$', '\1'))::integer
            ELSE 0
        END
    ), 0) + 1 INTO sequence_num
    FROM payments
    WHERE tenant_id = p_tenant_id
      AND payment_id LIKE 'PAY-' || current_year || '-%';
    
    payment_id := 'PAY-' || current_year || '-' || LPAD(sequence_num::text, 3, '0');
    
    RETURN payment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- PAYMENT TRIGGERS
-- =============================================================================

-- Trigger to auto-generate payment_id and update order cache
CREATE OR REPLACE FUNCTION handle_payment_changes()
RETURNS TRIGGER AS $$
BEGIN
    -- Generate payment_id for new payments
    IF TG_OP = 'INSERT' THEN
        IF NEW.payment_id IS NULL OR NEW.payment_id = '' THEN
            NEW.payment_id := generate_payment_id(NEW.tenant_id);
        END IF;
        NEW.created_at := now();
        NEW.updated_at := now();
        
        -- Update order payment status cache
        PERFORM update_order_payment_status_cache(NEW.order_id);
        
        RETURN NEW;
    END IF;
    
    -- Update order payment status cache on payment updates
    IF TG_OP = 'UPDATE' THEN
        NEW.updated_at := now();
        
        -- Update order payment status cache if payment status or amount changed
        IF OLD.payment_status != NEW.payment_status OR OLD.amount != NEW.amount THEN
            PERFORM update_order_payment_status_cache(NEW.order_id);
        END IF;
        
        RETURN NEW;
    END IF;
    
    -- Update order payment status cache on payment deletion
    IF TG_OP = 'DELETE' THEN
        PERFORM update_order_payment_status_cache(OLD.order_id);
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_handle_payment_changes
    BEFORE INSERT OR UPDATE OR DELETE ON payments
    FOR EACH ROW
    EXECUTE FUNCTION handle_payment_changes();

-- =============================================================================
-- PAYMENT VALIDATION FUNCTIONS
-- =============================================================================

-- Function to validate payment against order
CREATE OR REPLACE FUNCTION validate_payment_for_order(
    p_order_id uuid,
    p_amount decimal(10,2),
    p_tenant_id uuid
)
RETURNS jsonb AS $$
DECLARE
    order_record record;
    balance decimal(10,2);
    validation_result jsonb;
BEGIN
    -- Get order details
    SELECT 
        id,
        total_amount,
        status,
        tenant_id
    INTO order_record
    FROM orders
    WHERE id = p_order_id;
    
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
    
    -- Check tenant access
    IF order_record.tenant_id != p_tenant_id THEN
        validation_result := jsonb_set(
            validation_result,
            '{errors}',
            validation_result->'errors' || jsonb_build_array('Access denied')
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

-- =============================================================================
-- ROW LEVEL SECURITY POLICIES
-- =============================================================================

-- Enable RLS on payments table
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access payments within their tenant
CREATE POLICY "tenant_isolation_payments" ON payments
    FOR ALL USING (
        auth.jwt() ->> 'tenant_id' = tenant_id::text
        OR auth.role() = 'service_role'
    );

-- =============================================================================
-- GRANT PERMISSIONS
-- =============================================================================

-- Grant execute permissions on payment functions
GRANT EXECUTE ON FUNCTION calculate_order_balance(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_order_payment_status(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION update_order_payment_status_cache(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION generate_payment_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION validate_payment_for_order(uuid, decimal, uuid) TO authenticated;

-- =============================================================================
-- INITIAL DATA UPDATES
-- =============================================================================

-- Update existing orders to set payment_status_cache
UPDATE orders 
SET payment_status_cache = 'pending',
    updated_at = now()
WHERE payment_status_cache IS NULL;

-- Update payment due dates for invoiced orders
UPDATE orders 
SET payment_due_date = invoice_date + (COALESCE(payment_terms_days, 30) || ' days')::interval,
    updated_at = now()
WHERE invoice_date IS NOT NULL 
  AND payment_due_date IS NULL;

COMMIT;

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================

/*
-- Test payment functions
SELECT calculate_order_balance('order-uuid-here');
SELECT get_order_payment_status('order-uuid-here');
SELECT generate_payment_id('tenant-uuid-here');

-- Test payment validation
SELECT validate_payment_for_order('order-uuid-here', 100.00, 'tenant-uuid-here');

-- Verify indexes were created
SELECT indexname FROM pg_indexes WHERE tablename = 'payments';
SELECT indexname FROM pg_indexes WHERE tablename = 'orders' AND indexname LIKE '%payment%';
*/