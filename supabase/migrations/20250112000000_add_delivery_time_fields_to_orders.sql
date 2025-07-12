-- Add delivery time window and instructions fields to orders table
-- This migration adds support for delivery scheduling and special instructions

BEGIN;

-- Add delivery time window columns
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS delivery_time_window_start TIME,
ADD COLUMN IF NOT EXISTS delivery_time_window_end TIME,
ADD COLUMN IF NOT EXISTS delivery_instructions TEXT;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_orders_delivery_date ON orders(delivery_date);
CREATE INDEX IF NOT EXISTS idx_orders_delivery_time_start ON orders(delivery_time_window_start);

-- Add comments to explain the columns
COMMENT ON COLUMN orders.delivery_time_window_start IS 'Start time for delivery window (e.g., 09:00)';
COMMENT ON COLUMN orders.delivery_time_window_end IS 'End time for delivery window (e.g., 17:00)';
COMMENT ON COLUMN orders.delivery_instructions IS 'Special delivery instructions or notes';

COMMIT;

-- Verification query
SELECT 
    'Orders table delivery fields verification:' as status,
    COUNT(*) as total_orders,
    COUNT(delivery_date) as orders_with_delivery_date,
    COUNT(delivery_time_window_start) as orders_with_time_window,
    COUNT(delivery_instructions) as orders_with_instructions
FROM orders;