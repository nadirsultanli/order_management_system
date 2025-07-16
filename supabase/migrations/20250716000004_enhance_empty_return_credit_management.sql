-- =============================================================================
-- ENHANCE EMPTY RETURN CREDIT MANAGEMENT FOR COMPLETE ORDER FLOW
-- =============================================================================

-- Add enhanced status enum for empty return credits
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'credit_status_enum') THEN
        CREATE TYPE credit_status_enum AS ENUM (
            'pending',
            'partial_returned',
            'fully_returned',
            'expired',
            'cancelled',
            'grace_period'
        );
    END IF;
END $$;

-- Enhance empty_return_credits table with additional tracking fields
DO $$
BEGIN
    -- Add parent_line_id to link credits to specific order lines
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'empty_return_credits' 
        AND column_name = 'parent_line_id'
    ) THEN
        ALTER TABLE empty_return_credits 
        ADD COLUMN parent_line_id UUID REFERENCES order_lines(id) ON DELETE CASCADE;
    END IF;

    -- Add quantity tracking for partial returns
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'empty_return_credits' 
        AND column_name = 'quantity_returned'
    ) THEN
        ALTER TABLE empty_return_credits 
        ADD COLUMN quantity_returned INTEGER DEFAULT 0;
    END IF;

    -- Add calculated remaining quantity
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'empty_return_credits' 
        AND column_name = 'quantity_remaining'
    ) THEN
        ALTER TABLE empty_return_credits 
        ADD COLUMN quantity_remaining INTEGER GENERATED ALWAYS AS (quantity - quantity_returned) STORED;
    END IF;

    -- Add grace period tracking
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'empty_return_credits' 
        AND column_name = 'grace_period_days'
    ) THEN
        ALTER TABLE empty_return_credits 
        ADD COLUMN grace_period_days INTEGER DEFAULT 7;
    END IF;

    -- Add final expiration date
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'empty_return_credits' 
        AND column_name = 'final_expiration_date'
    ) THEN
        ALTER TABLE empty_return_credits 
        ADD COLUMN final_expiration_date DATE;
    END IF;

    -- Add trip tracking for delivery linkage
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'empty_return_credits' 
        AND column_name = 'trip_id'
    ) THEN
        ALTER TABLE empty_return_credits 
        ADD COLUMN trip_id UUID REFERENCES trips(id) ON DELETE SET NULL;
    END IF;

    -- Add notes for return processing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'empty_return_credits' 
        AND column_name = 'processing_notes'
    ) THEN
        ALTER TABLE empty_return_credits 
        ADD COLUMN processing_notes TEXT;
    END IF;

    -- Update status column to use new enum if it exists
    BEGIN
        ALTER TABLE empty_return_credits 
        ALTER COLUMN status TYPE credit_status_enum USING status::credit_status_enum;
    EXCEPTION WHEN others THEN
        -- Column might already be the correct type or have different constraints
        NULL;
    END;
END $$;

-- Add order enhancements for credit tracking
DO $$
BEGIN
    -- Add credit applied tracking to orders
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' 
        AND column_name = 'credit_applied'
    ) THEN
        ALTER TABLE orders 
        ADD COLUMN credit_applied NUMERIC(10,2) DEFAULT 0;
    END IF;

    -- Add available credits at time of order
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' 
        AND column_name = 'available_credits'
    ) THEN
        ALTER TABLE orders 
        ADD COLUMN available_credits NUMERIC(10,2) DEFAULT 0;
    END IF;

    -- Add auto-apply credits flag
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' 
        AND column_name = 'auto_apply_credits'
    ) THEN
        ALTER TABLE orders 
        ADD COLUMN auto_apply_credits BOOLEAN DEFAULT true;
    END IF;
END $$;

-- Create status history table for audit trail
CREATE TABLE IF NOT EXISTS empty_return_credit_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    credit_id UUID NOT NULL REFERENCES empty_return_credits(id) ON DELETE CASCADE,
    old_status credit_status_enum,
    new_status credit_status_enum NOT NULL,
    quantity_returned_change INTEGER DEFAULT 0,
    changed_by_user_id UUID,
    change_reason TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_empty_return_credits_parent_line ON empty_return_credits (parent_line_id);
CREATE INDEX IF NOT EXISTS idx_empty_return_credits_status_quantity ON empty_return_credits (status, quantity_remaining) WHERE quantity_remaining > 0;
CREATE INDEX IF NOT EXISTS idx_empty_return_credits_expiration ON empty_return_credits (final_expiration_date) WHERE status IN ('pending', 'partial_returned', 'grace_period');
CREATE INDEX IF NOT EXISTS idx_empty_return_credits_trip ON empty_return_credits (trip_id) WHERE trip_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_credit_status_history_credit_id ON empty_return_credit_status_history (credit_id, created_at DESC);

-- Enhanced function to process empty returns with partial support
CREATE OR REPLACE FUNCTION process_empty_return(
    p_credit_id UUID,
    p_quantity_returned INTEGER,
    p_processed_by_user_id UUID DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    credit_record RECORD;
    new_status credit_status_enum;
    old_status credit_status_enum;
BEGIN
    -- Get current credit record
    SELECT * INTO credit_record
    FROM empty_return_credits
    WHERE id = p_credit_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Empty return credit not found: %', p_credit_id;
    END IF;
    
    -- Validate quantity
    IF p_quantity_returned <= 0 THEN
        RAISE EXCEPTION 'Quantity returned must be greater than 0';
    END IF;
    
    IF credit_record.quantity_returned + p_quantity_returned > credit_record.quantity THEN
        RAISE EXCEPTION 'Total returned quantity cannot exceed original quantity';
    END IF;
    
    -- Store old status for audit
    old_status := credit_record.status;
    
    -- Determine new status
    IF credit_record.quantity_returned + p_quantity_returned = credit_record.quantity THEN
        new_status := 'fully_returned';
    ELSE
        new_status := 'partial_returned';
    END IF;
    
    -- Update credit record
    UPDATE empty_return_credits
    SET 
        quantity_returned = quantity_returned + p_quantity_returned,
        status = new_status,
        actual_return_date = CASE WHEN new_status = 'fully_returned' THEN CURRENT_DATE ELSE actual_return_date END,
        processing_notes = COALESCE(processing_notes, '') || 
            CASE WHEN processing_notes IS NOT NULL THEN E'\n' ELSE '' END ||
            'Processed ' || p_quantity_returned || ' units on ' || CURRENT_DATE || 
            CASE WHEN p_notes IS NOT NULL THEN ': ' || p_notes ELSE '' END,
        updated_at = NOW()
    WHERE id = p_credit_id;
    
    -- Create audit trail
    INSERT INTO empty_return_credit_status_history (
        credit_id,
        old_status,
        new_status,
        quantity_returned_change,
        changed_by_user_id,
        change_reason,
        notes
    ) VALUES (
        p_credit_id,
        old_status,
        new_status,
        p_quantity_returned,
        p_processed_by_user_id,
        'Return processed',
        p_notes
    );
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Enhanced function to handle credit expiration with grace periods
CREATE OR REPLACE FUNCTION expire_overdue_empty_return_credits()
RETURNS TABLE (
    expired_count INTEGER,
    grace_period_count INTEGER,
    deposit_charges_created NUMERIC
) AS $$
DECLARE
    total_expired INTEGER := 0;
    total_grace_period INTEGER := 0;
    total_deposit_charges NUMERIC := 0;
    credit_record RECORD;
BEGIN
    -- Handle credits entering grace period
    FOR credit_record IN 
        SELECT * FROM empty_return_credits 
        WHERE status = 'pending' 
          AND return_deadline < CURRENT_DATE
          AND (final_expiration_date IS NULL OR final_expiration_date > CURRENT_DATE)
    LOOP
        UPDATE empty_return_credits
        SET 
            status = 'grace_period',
            final_expiration_date = COALESCE(final_expiration_date, CURRENT_DATE + INTERVAL '1 day' * grace_period_days),
            updated_at = NOW()
        WHERE id = credit_record.id;
        
        total_grace_period := total_grace_period + 1;
        
        -- Create audit trail
        INSERT INTO empty_return_credit_status_history (
            credit_id, old_status, new_status, change_reason
        ) VALUES (
            credit_record.id, 'pending', 'grace_period', 'Automatic grace period entry'
        );
    END LOOP;
    
    -- Handle final expiration
    FOR credit_record IN 
        SELECT * FROM empty_return_credits 
        WHERE status IN ('pending', 'grace_period', 'partial_returned') 
          AND final_expiration_date < CURRENT_DATE
    LOOP
        UPDATE empty_return_credits
        SET 
            status = 'expired',
            updated_at = NOW()
        WHERE id = credit_record.id;
        
        total_expired := total_expired + 1;
        total_deposit_charges := total_deposit_charges + (credit_record.total_credit_amount * credit_record.quantity_remaining / credit_record.quantity);
        
        -- Create audit trail
        INSERT INTO empty_return_credit_status_history (
            credit_id, old_status, new_status, change_reason
        ) VALUES (
            credit_record.id, credit_record.status, 'expired', 'Automatic expiration after grace period'
        );
        
        -- TODO: Create deposit charge transaction
        -- This would integrate with your billing/accounting system
    END LOOP;
    
    RETURN QUERY SELECT total_expired, total_grace_period, total_deposit_charges;
END;
$$ LANGUAGE plpgsql;

-- Function to get customer credit summary
CREATE OR REPLACE FUNCTION get_customer_credit_summary(p_customer_id UUID)
RETURNS TABLE (
    total_pending_credits NUMERIC,
    total_available_credits NUMERIC,
    credits_expiring_soon INTEGER,
    credits_in_grace_period INTEGER,
    total_expired_credits NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(SUM(CASE WHEN status IN ('pending', 'partial_returned') THEN total_credit_amount * quantity_remaining / quantity ELSE 0 END), 0) as total_pending_credits,
        COALESCE(SUM(CASE WHEN status IN ('pending', 'partial_returned') AND return_deadline > CURRENT_DATE THEN total_credit_amount * quantity_remaining / quantity ELSE 0 END), 0) as total_available_credits,
        COUNT(CASE WHEN status IN ('pending', 'partial_returned') AND return_deadline BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days' THEN 1 END)::INTEGER as credits_expiring_soon,
        COUNT(CASE WHEN status = 'grace_period' THEN 1 END)::INTEGER as credits_in_grace_period,
        COALESCE(SUM(CASE WHEN status = 'expired' THEN total_credit_amount ELSE 0 END), 0) as total_expired_credits
    FROM empty_return_credits
    WHERE customer_id = p_customer_id;
END;
$$ LANGUAGE plpgsql;

-- Function to automatically apply credits to order total
CREATE OR REPLACE FUNCTION apply_credits_to_order(
    p_order_id UUID,
    p_max_credit_amount NUMERIC DEFAULT NULL
) RETURNS TABLE (
    credits_applied NUMERIC,
    remaining_order_total NUMERIC,
    credits_used_count INTEGER
) AS $$
DECLARE
    order_record RECORD;
    available_credit_amount NUMERIC := 0;
    credit_to_apply NUMERIC := 0;
    credits_count INTEGER := 0;
BEGIN
    -- Get order details
    SELECT * INTO order_record
    FROM orders
    WHERE id = p_order_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order not found: %', p_order_id;
    END IF;
    
    -- Calculate available credits for this customer
    SELECT total_available_credits INTO available_credit_amount
    FROM get_customer_credit_summary(order_record.customer_id);
    
    -- Determine credit amount to apply
    credit_to_apply := LEAST(
        available_credit_amount,
        COALESCE(p_max_credit_amount, available_credit_amount),
        order_record.total_amount
    );
    
    -- Update order with applied credits
    UPDATE orders
    SET 
        credit_applied = credit_to_apply,
        available_credits = available_credit_amount,
        total_amount = total_amount - credit_to_apply,
        updated_at = NOW()
    WHERE id = p_order_id;
    
    -- Count credits that would be used (for reporting)
    SELECT COUNT(*) INTO credits_count
    FROM empty_return_credits
    WHERE customer_id = order_record.customer_id
      AND status IN ('pending', 'partial_returned')
      AND return_deadline > CURRENT_DATE;
    
    RETURN QUERY SELECT 
        credit_to_apply,
        order_record.total_amount - credit_to_apply,
        credits_count;
END;
$$ LANGUAGE plpgsql;

-- Enhanced trigger function for creating empty return credits
CREATE OR REPLACE FUNCTION create_empty_return_credits()
RETURNS TRIGGER AS $$
DECLARE
    line_record RECORD;
    deposit_rate RECORD;
    empty_product_id UUID;
    base_sku TEXT;
    return_date DATE;
    deadline_date DATE;
BEGIN
    -- Only process exchange and refill orders
    IF NEW.order_flow_type NOT IN ('exchange', 'refill') THEN
        RETURN NEW;
    END IF;
    
    -- Calculate return dates
    return_date := NEW.created_at::DATE + INTERVAL '7 days';
    deadline_date := NEW.created_at::DATE + INTERVAL '30 days';
    
    -- Process each order line
    FOR line_record IN 
        SELECT ol.*, p.sku, p.sku_variant, p.capacity_kg
        FROM order_lines ol
        JOIN products p ON ol.product_id = p.id
        WHERE ol.order_id = NEW.id
          AND p.sku_variant IN ('FULL-XCH', 'FULL-OUT')
          AND p.capacity_kg IS NOT NULL
    LOOP
        -- Find corresponding empty variant
        base_sku := REGEXP_REPLACE(line_record.sku, '-FULL-(XCH|OUT)$', '');
        
        SELECT id INTO empty_product_id
        FROM products
        WHERE sku = base_sku || '-EMPTY'
          AND sku_variant = 'EMPTY';
        
        IF empty_product_id IS NULL THEN
            CONTINUE; -- Skip if no empty variant exists
        END IF;
        
        -- Get deposit rate
        SELECT * INTO deposit_rate
        FROM cylinder_deposit_rates
        WHERE capacity_l = (line_record.capacity_kg * 2.2)::INTEGER -- Approximate kg to L conversion
          AND CURRENT_DATE BETWEEN effective_date AND COALESCE(end_date, '2099-12-31')
        ORDER BY effective_date DESC
        LIMIT 1;
        
        IF deposit_rate IS NULL THEN
            CONTINUE; -- Skip if no deposit rate found
        END IF;
        
        -- Create empty return credit
        INSERT INTO empty_return_credits (
            order_id,
            parent_line_id,
            customer_id,
            product_id,
            quantity,
            capacity_l,
            unit_credit_amount,
            total_credit_amount,
            expected_return_date,
            return_deadline,
            final_expiration_date,
            status,
            grace_period_days,
            created_at
        ) VALUES (
            NEW.id,
            line_record.id,
            NEW.customer_id,
            empty_product_id,
            line_record.quantity,
            deposit_rate.capacity_l,
            deposit_rate.deposit_amount,
            deposit_rate.deposit_amount * line_record.quantity,
            return_date,
            deadline_date,
            deadline_date + INTERVAL '7 days', -- 7-day grace period
            'pending',
            7,
            NOW()
        );
    END LOOP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update the trigger
DROP TRIGGER IF EXISTS trg_create_empty_return_credits ON orders;
CREATE TRIGGER trg_create_empty_return_credits
    AFTER INSERT ON orders
    FOR EACH ROW
    EXECUTE FUNCTION create_empty_return_credits();

-- Create comprehensive view for credit management
CREATE OR REPLACE VIEW v_empty_return_credits_summary AS
SELECT 
    erc.*,
    o.order_number,
    o.order_date,
    c.name as customer_name,
    c.code as customer_code,
    p.name as product_name,
    p.sku as product_sku,
    ol.quantity as original_order_quantity,
    -- Calculated fields
    erc.quantity_remaining,
    CASE 
        WHEN erc.status = 'pending' AND erc.return_deadline < CURRENT_DATE THEN 'overdue'
        WHEN erc.status = 'pending' AND erc.return_deadline BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days' THEN 'expiring_soon'
        WHEN erc.status = 'grace_period' THEN 'in_grace_period'
        ELSE erc.status::TEXT
    END as display_status,
    erc.return_deadline - CURRENT_DATE as days_until_deadline,
    erc.final_expiration_date - CURRENT_DATE as days_until_final_expiration,
    erc.total_credit_amount * erc.quantity_remaining / erc.quantity as remaining_credit_amount
FROM empty_return_credits erc
LEFT JOIN orders o ON erc.order_id = o.id
LEFT JOIN customers c ON erc.customer_id = c.id
LEFT JOIN products p ON erc.product_id = p.id
LEFT JOIN order_lines ol ON erc.parent_line_id = ol.id;

-- Add helpful comments
COMMENT ON TABLE empty_return_credit_status_history IS 'Audit trail for all empty return credit status changes';
COMMENT ON FUNCTION process_empty_return IS 'Process partial or full empty cylinder returns with audit trail';
COMMENT ON FUNCTION expire_overdue_empty_return_credits IS 'Automatic expiration handling with grace periods';
COMMENT ON FUNCTION get_customer_credit_summary IS 'Get comprehensive credit summary for a customer';
COMMENT ON FUNCTION apply_credits_to_order IS 'Automatically apply available credits to order total';
COMMENT ON VIEW v_empty_return_credits_summary IS 'Comprehensive view of empty return credits with calculated fields';