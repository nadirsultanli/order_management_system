-- Migration: Implement complete cylinder workflow with empty return credits
-- Description: Adds support for automatic empty return credits and time-based cancellation

-- Create empty return credits table
CREATE TABLE IF NOT EXISTS empty_return_credits (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    product_id uuid NOT NULL REFERENCES products(id),
    
    -- Credit details
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    capacity_l NUMERIC(6,2) NOT NULL CHECK (capacity_l > 0),
    unit_credit_amount NUMERIC(10,2) NOT NULL,
    total_credit_amount NUMERIC(10,2) NOT NULL,
    currency_code CHAR(3) NOT NULL DEFAULT 'KES',
    
    -- Return tracking
    expected_return_date DATE NOT NULL,
    actual_return_date DATE,
    return_deadline DATE NOT NULL, -- After this date, credit is cancelled
    
    -- Status
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'returned', 'cancelled', 'expired')),
    cancelled_reason TEXT,
    
    -- Reference to deposit transaction if returned
    deposit_transaction_id uuid REFERENCES deposit_transactions(id),
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_by uuid,
    updated_by uuid
);

-- Add indexes for performance
CREATE INDEX idx_empty_return_credits_order ON empty_return_credits(order_id);
CREATE INDEX idx_empty_return_credits_customer ON empty_return_credits(customer_id);
CREATE INDEX idx_empty_return_credits_status ON empty_return_credits(status);
CREATE INDEX idx_empty_return_credits_return_deadline ON empty_return_credits(return_deadline) WHERE status = 'pending';
CREATE INDEX idx_empty_return_credits_expected_return ON empty_return_credits(expected_return_date) WHERE status = 'pending';

-- Add comments
COMMENT ON TABLE empty_return_credits IS 'Tracks empty cylinder return credits for exchange/refill orders';
COMMENT ON COLUMN empty_return_credits.expected_return_date IS 'Date when customer is expected to return empty cylinders';
COMMENT ON COLUMN empty_return_credits.return_deadline IS 'Final date after which credit is cancelled if not returned';
COMMENT ON COLUMN empty_return_credits.status IS 'pending: awaiting return, returned: cylinders returned, cancelled: manually cancelled, expired: deadline passed';

-- Add order flow type to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_flow_type VARCHAR(20) 
    CHECK (order_flow_type IN ('outright', 'exchange', 'refill'));
COMMENT ON COLUMN orders.order_flow_type IS 'Order flow type: outright (no return expected), exchange/refill (empty return expected)';

-- Add deposit inclusion flag to order_lines
ALTER TABLE order_lines ADD COLUMN IF NOT EXISTS includes_deposit BOOLEAN DEFAULT false;
COMMENT ON COLUMN order_lines.includes_deposit IS 'Whether this line item includes cylinder deposit charge';

-- Function to automatically create empty return credits
CREATE OR REPLACE FUNCTION create_empty_return_credits()
RETURNS TRIGGER AS $$
DECLARE
    v_order_line RECORD;
    v_deposit_rate NUMERIC;
    v_expected_return_date DATE;
    v_return_deadline DATE;
BEGIN
    -- Only process exchange/refill orders based on order_flow_type
    IF NEW.order_flow_type NOT IN ('exchange', 'refill') THEN
        RETURN NEW;
    END IF;
    
    -- Set return dates (7 days expected, 30 days deadline)
    v_expected_return_date := COALESCE(NEW.delivery_date, NEW.scheduled_date, CURRENT_DATE) + INTERVAL '7 days';
    v_return_deadline := COALESCE(NEW.delivery_date, NEW.scheduled_date, CURRENT_DATE) + INTERVAL '30 days';
    
    -- Process each order line
    FOR v_order_line IN 
        SELECT ol.*, p.capacity_l, p.name as product_name
        FROM order_lines ol
        JOIN products p ON ol.product_id = p.id
        WHERE ol.order_id = NEW.id
          AND p.capacity_l IS NOT NULL
          AND p.capacity_l > 0
    LOOP
        -- Get deposit rate for this capacity
        SELECT deposit_amount INTO v_deposit_rate
        FROM cylinder_deposit_rates
        WHERE capacity_l = v_order_line.capacity_l
          AND currency_code = 'KES'
          AND is_active = true
          AND effective_date <= CURRENT_DATE
          AND (end_date IS NULL OR end_date >= CURRENT_DATE)
        ORDER BY effective_date DESC
        LIMIT 1;
        
        IF v_deposit_rate IS NOT NULL AND v_deposit_rate > 0 THEN
            -- Create empty return credit
            INSERT INTO empty_return_credits (
                order_id,
                customer_id,
                product_id,
                quantity,
                capacity_l,
                unit_credit_amount,
                total_credit_amount,
                expected_return_date,
                return_deadline,
                created_by
            ) VALUES (
                NEW.id,
                NEW.customer_id,
                v_order_line.product_id,
                v_order_line.quantity,
                v_order_line.capacity_l,
                v_deposit_rate,
                v_deposit_rate * v_order_line.quantity,
                v_expected_return_date,
                v_return_deadline,
                NEW.created_by
            );
        END IF;
    END LOOP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic empty return credit creation
DROP TRIGGER IF EXISTS trg_create_empty_return_credits ON orders;
CREATE TRIGGER trg_create_empty_return_credits
    AFTER INSERT ON orders
    FOR EACH ROW
    EXECUTE FUNCTION create_empty_return_credits();

-- Function to cancel expired empty return credits
CREATE OR REPLACE FUNCTION cancel_expired_empty_return_credits()
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER := 0;
BEGIN
    UPDATE empty_return_credits
    SET 
        status = 'expired',
        cancelled_reason = 'Return deadline passed',
        updated_at = now()
    WHERE status = 'pending'
      AND return_deadline < CURRENT_DATE;
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Add RLS policies
ALTER TABLE empty_return_credits ENABLE ROW LEVEL SECURITY;

-- Update existing data if needed (default delivery orders to outright)
UPDATE orders 
SET order_flow_type = 'outright'
WHERE order_type = 'delivery' 
  AND order_flow_type IS NULL;

-- Update existing exchange/refill orders
UPDATE orders 
SET order_flow_type = order_type
WHERE order_type IN ('exchange', 'refill')
  AND order_flow_type IS NULL;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON empty_return_credits TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated; 