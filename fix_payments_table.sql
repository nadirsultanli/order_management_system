-- ========================================
-- FIX PAYMENTS TABLE - REMOVE TENANT REFERENCES
-- ========================================
-- This script fixes the payments table schema issues
-- Run this in your Supabase SQL Editor IMMEDIATELY

BEGIN;

-- Ensure payments table doesn't have tenant_id column
ALTER TABLE payments DROP COLUMN IF EXISTS tenant_id CASCADE;

-- Remove tenant-related constraints and indexes
DROP INDEX IF EXISTS idx_payments_tenant_id;
DROP CONSTRAINT IF EXISTS unique_payment_id_per_tenant ON payments;

-- Add new unique constraint without tenant (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'unique_payment_id' 
        AND conrelid = 'payments'::regclass
    ) THEN
        ALTER TABLE payments ADD CONSTRAINT unique_payment_id UNIQUE (payment_id);
    END IF;
END
$$;

-- Update the payment trigger to use the new function signature
DROP TRIGGER IF EXISTS trigger_handle_payment_changes ON payments;

-- Recreate the payment trigger function without tenant_id
CREATE OR REPLACE FUNCTION handle_payment_changes()
RETURNS TRIGGER AS $$
BEGIN
    -- Generate payment_id for new payments
    IF TG_OP = 'INSERT' THEN
        IF NEW.payment_id IS NULL OR NEW.payment_id = '' THEN
            NEW.payment_id := generate_payment_id();
        END IF;
        NEW.created_at := COALESCE(NEW.created_at, now());
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

-- Recreate the trigger
CREATE TRIGGER trigger_handle_payment_changes
    BEFORE INSERT OR UPDATE OR DELETE ON payments
    FOR EACH ROW
    EXECUTE FUNCTION handle_payment_changes();

-- Update the update_order_payment_status_cache function to not use tenant_id
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

-- Grant permissions
GRANT EXECUTE ON FUNCTION update_order_payment_status_cache(uuid) TO authenticated;

-- Fix any existing payments that might have NULL payment_id
UPDATE payments 
SET payment_id = generate_payment_id(),
    updated_at = now()
WHERE payment_id IS NULL OR payment_id = '';

COMMIT;

-- Verification queries
SELECT 'Payments table fixed successfully' as status;
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'payments' AND column_name = 'tenant_id';

-- Should return no rows if tenant_id was successfully removed
SELECT 'tenant_id column removed: ' || 
       CASE WHEN NOT EXISTS (
           SELECT 1 FROM information_schema.columns 
           WHERE table_name = 'payments' AND column_name = 'tenant_id'
       ) THEN 'SUCCESS' ELSE 'FAILED' END as result;