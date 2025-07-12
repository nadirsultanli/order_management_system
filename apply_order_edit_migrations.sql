-- Apply order edit migrations
-- Run this in your Supabase SQL editor

-- Migration 1: Add delivery time fields
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

-- Migration 2: Ensure order_type support
BEGIN;

-- Add order_type column if it doesn't exist
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS order_type VARCHAR(20) DEFAULT 'delivery';

-- Update constraint to include both delivery and visit types
ALTER TABLE orders 
DROP CONSTRAINT IF EXISTS orders_order_type_check;

ALTER TABLE orders 
ADD CONSTRAINT orders_order_type_check 
CHECK (order_type IN ('delivery', 'visit', 'refill', 'exchange', 'pickup'));

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_orders_order_type ON orders(order_type);

-- Add comment to explain the column
COMMENT ON COLUMN orders.order_type IS 'Type of order: delivery (pre-selected products), visit (products determined on-site), refill, exchange, or pickup';

-- Set default order_type for existing orders without one
UPDATE orders 
SET order_type = 'delivery' 
WHERE order_type IS NULL OR order_type = '';

COMMIT;

-- Verification queries
SELECT 
    'Orders table delivery fields verification:' as status,
    COUNT(*) as total_orders,
    COUNT(delivery_date) as orders_with_delivery_date,
    COUNT(delivery_time_window_start) as orders_with_time_window,
    COUNT(delivery_instructions) as orders_with_instructions
FROM orders;

SELECT 
    'Order type verification:' as status,
    order_type,
    COUNT(*) as count
FROM orders 
GROUP BY order_type
ORDER BY order_type;