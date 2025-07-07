-- Add source warehouse support to orders table
-- This migration adds the source_warehouse_id column to track which warehouse fulfills each order

BEGIN;

-- Add source_warehouse_id column to orders table
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS source_warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_orders_source_warehouse_id ON orders(source_warehouse_id);

-- Add comment to explain the column
COMMENT ON COLUMN orders.source_warehouse_id IS 'The warehouse that will fulfill this order';

-- Update existing orders to use the first available warehouse as default
-- This ensures backward compatibility for existing orders
UPDATE orders 
SET source_warehouse_id = (
    SELECT id 
    FROM warehouses 
    WHERE active = true 
    ORDER BY created_at 
    LIMIT 1
)
WHERE source_warehouse_id IS NULL;

COMMIT;

-- Verification query
SELECT 
    'Orders table verification:' as status,
    COUNT(*) as total_orders,
    COUNT(source_warehouse_id) as orders_with_warehouse,
    COUNT(DISTINCT source_warehouse_id) as unique_warehouses_used
FROM orders; 