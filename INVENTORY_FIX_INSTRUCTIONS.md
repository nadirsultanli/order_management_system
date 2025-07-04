# Inventory Error Fix Instructions

## Problem
The application is failing with the error: `column products_1.reorder_level does not exist`

## Root Cause
The code expects `reorder_level` and `max_stock_level` columns in the `products` table, but these columns don't exist in the database schema. These columns are essential for inventory management functionality.

## Solution
Apply the database migration to add the missing columns.

## Quick Fix (Option 1: Using the Migration Script)

1. **Run the automated migration script:**
   ```bash
   cd /Users/nadir/Documents/GitHub/order_management_system
   node scripts/apply-inventory-migration.js
   ```

## Manual Fix (Option 2: Direct SQL)

If the script doesn't work, you can apply the migration manually:

1. **Connect to your Supabase project** at: https://trcrjinrdjgizqhjdgvc.supabase.co

2. **Go to SQL Editor** in the Supabase dashboard

3. **Execute this SQL:**
   ```sql
   -- Add inventory management columns to products table
   ALTER TABLE products 
   ADD COLUMN IF NOT EXISTS reorder_level NUMERIC DEFAULT 10 CHECK (reorder_level >= 0),
   ADD COLUMN IF NOT EXISTS max_stock_level NUMERIC DEFAULT 100 CHECK (max_stock_level >= 0),
   ADD COLUMN IF NOT EXISTS seasonal_demand_factor NUMERIC DEFAULT 1.0 CHECK (seasonal_demand_factor > 0),
   ADD COLUMN IF NOT EXISTS lead_time_days INTEGER DEFAULT 7 CHECK (lead_time_days >= 0);

   -- Set smart defaults based on product capacity
   UPDATE products 
   SET 
       reorder_level = CASE 
           WHEN capacity_kg >= 50 THEN 5    -- Large cylinders: lower reorder threshold
           WHEN capacity_kg >= 20 THEN 10   -- Medium cylinders: standard threshold
           WHEN capacity_kg >= 5 THEN 20    -- Small cylinders: higher threshold
           ELSE 10                          -- Default for other products
       END,
       max_stock_level = CASE 
           WHEN capacity_kg >= 50 THEN 50   -- Large cylinders: lower max stock
           WHEN capacity_kg >= 20 THEN 100  -- Medium cylinders: standard max stock
           WHEN capacity_kg >= 5 THEN 200   -- Small cylinders: higher max stock
           ELSE 100                         -- Default for other products
       END,
       seasonal_demand_factor = 1.0,
       lead_time_days = CASE 
           WHEN variant_type = 'refillable' THEN 3     -- Refillable products are faster to restock
           WHEN variant_type = 'disposable' THEN 14    -- Disposable products may take longer
           ELSE 7                                       -- Standard lead time
       END
   WHERE reorder_level IS NULL OR max_stock_level IS NULL;
   ```

## What These Columns Do

- **`reorder_level`**: The minimum stock level that triggers restocking alerts and transfers
- **`max_stock_level`**: The maximum recommended stock level to prevent overstocking
- **`seasonal_demand_factor`**: Multiplier for seasonal demand variations (1.0 = normal, >1.0 = peak season)
- **`lead_time_days`**: Expected days from order to delivery for this product

## Verification

After applying the migration, verify it worked:

1. **Check the columns exist:**
   ```sql
   SELECT column_name, data_type, column_default 
   FROM information_schema.columns 
   WHERE table_name = 'products' 
     AND column_name IN ('reorder_level', 'max_stock_level', 'seasonal_demand_factor', 'lead_time_days');
   ```

2. **Check sample data:**
   ```sql
   SELECT name, sku, capacity_kg, reorder_level, max_stock_level 
   FROM products 
   WHERE status = 'active' 
   LIMIT 5;
   ```

3. **Test the API** - The inventory endpoints should now work without errors.

## Code Changes Made

I've already updated the backend code to be more resilient:

1. **Fixed problematic queries** that were selecting non-existent columns
2. **Added fallback logic** for when columns don't exist yet
3. **Smart defaults** based on product capacity when columns are missing

The application will now:
- Use intelligent defaults when columns don't exist
- Work properly once the migration is applied
- Provide better inventory management features

## Importance for Business

These inventory threshold columns are crucial for:
- **Automated reordering** when stock runs low
- **Preventing stockouts** that could lose sales
- **Avoiding overstocking** that ties up capital
- **Seasonal planning** for demand fluctuations
- **Supply chain optimization** with lead time tracking

## Files Modified

1. `/supabase/migrations/20250104000000_add_inventory_thresholds_to_products.sql` - New migration
2. `/backend/src/routes/inventory.ts` - Fixed column references and added fallbacks
3. `/backend/src/routes/transfers.ts` - Fixed column references  
4. `/scripts/apply-inventory-migration.js` - Automated migration script

## Next Steps

After applying the migration:
1. Review and adjust the threshold values for your specific products
2. Test the inventory management features
3. Set up automated alerts for low stock levels
4. Configure seasonal factors for products with seasonal demand

The API should now work without the "column does not exist" error!