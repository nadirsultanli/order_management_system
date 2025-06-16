-- Add notes column to orders table
ALTER TABLE orders
ADD COLUMN notes TEXT;

-- Add comment to the column
COMMENT ON COLUMN orders.notes IS 'Additional notes or instructions for the order';

-- Create RLS policies if they don't exist
DO $$ 
BEGIN
    -- Create read policy if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'orders' 
        AND policyname = 'Enable read access for authenticated users'
    ) THEN
        CREATE POLICY "Enable read access for authenticated users" ON orders
            FOR SELECT
            TO authenticated
            USING (true);
    END IF;

    -- Create insert policy if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'orders' 
        AND policyname = 'Enable insert access for authenticated users'
    ) THEN
        CREATE POLICY "Enable insert access for authenticated users" ON orders
            FOR INSERT
            TO authenticated
            WITH CHECK (true);
    END IF;

    -- Create update policy if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'orders' 
        AND policyname = 'Enable update access for authenticated users'
    ) THEN
        CREATE POLICY "Enable update access for authenticated users" ON orders
            FOR UPDATE
            TO authenticated
            USING (true)
            WITH CHECK (true);
    END IF;
END $$; 