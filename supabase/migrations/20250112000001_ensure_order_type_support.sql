-- Ensure order_type column exists and supports delivery and visit types
-- This migration ensures proper order type support for the editing functionality

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

-- Verification query
SELECT 
    'Order type verification:' as status,
    order_type,
    COUNT(*) as count
FROM orders 
GROUP BY order_type
ORDER BY order_type;