-- Update create_customer_with_address RPC function to handle created_by parameter
-- This fixes customer creation to properly set the created_by field

BEGIN;

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS create_customer_with_address(
    text, text, text, text, text, text, integer,
    text, text, text, text, text, text, text,
    numeric, numeric, text, text, boolean, text, uuid
);

-- Create or replace the function with all necessary parameters
CREATE OR REPLACE FUNCTION create_customer_with_address(
    p_name text,
    p_external_id text DEFAULT NULL,
    p_tax_id text DEFAULT NULL,
    p_phone text DEFAULT NULL,
    p_email text DEFAULT NULL,
    p_account_status text DEFAULT 'active',
    p_credit_terms_days integer DEFAULT 30,
    p_label text DEFAULT NULL,
    p_line1 text,
    p_line2 text DEFAULT NULL,
    p_city text,
    p_state text DEFAULT NULL,
    p_postal_code text DEFAULT NULL,
    p_country text,
    p_latitude numeric DEFAULT NULL,
    p_longitude numeric DEFAULT NULL,
    p_delivery_window_start text DEFAULT NULL,
    p_delivery_window_end text DEFAULT NULL,
    p_is_primary boolean DEFAULT true,
    p_instructions text DEFAULT NULL,
    p_created_by uuid DEFAULT NULL
)
RETURNS TABLE(
    customer_id uuid,
    customer_name text,
    customer_external_id text,
    customer_email text,
    customer_phone text,
    customer_account_status text,
    customer_credit_terms_days integer,
    customer_created_at timestamp with time zone,
    customer_created_by uuid,
    address_id uuid,
    address_line1 text,
    address_line2 text,
    address_city text,
    address_state text,
    address_postal_code text,
    address_country text,
    address_is_primary boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_customer_id uuid;
    new_address_id uuid;
    customer_record record;
    address_record record;
BEGIN
    -- Insert customer record
    INSERT INTO customers (
        name,
        external_id,
        tax_id,
        phone,
        email,
        account_status,
        credit_terms_days,
        created_by,
        created_at,
        updated_at
    ) VALUES (
        p_name,
        p_external_id,
        p_tax_id,
        p_phone,
        p_email,
        p_account_status::text,
        p_credit_terms_days,
        p_created_by,
        now(),
        now()
    )
    RETURNING id INTO new_customer_id;

    -- Insert address record
    INSERT INTO addresses (
        customer_id,
        label,
        line1,
        line2,
        city,
        state,
        postal_code,
        country,
        latitude,
        longitude,
        delivery_window_start,
        delivery_window_end,
        is_primary,
        instructions,
        created_by,
        created_at,
        updated_at
    ) VALUES (
        new_customer_id,
        p_label,
        p_line1,
        p_line2,
        p_city,
        p_state,
        p_postal_code,
        p_country,
        p_latitude,
        p_longitude,
        p_delivery_window_start,
        p_delivery_window_end,
        p_is_primary,
        p_instructions,
        p_created_by,
        now(),
        now()
    )
    RETURNING id INTO new_address_id;

    -- Return both customer and address data
    SELECT 
        c.id,
        c.name,
        c.external_id,
        c.email,
        c.phone,
        c.account_status,
        c.credit_terms_days,
        c.created_at,
        c.created_by,
        a.id,
        a.line1,
        a.line2,
        a.city,
        a.state,
        a.postal_code,
        a.country,
        a.is_primary
    INTO customer_record
    FROM customers c
    JOIN addresses a ON a.customer_id = c.id
    WHERE c.id = new_customer_id AND a.id = new_address_id;

    RETURN QUERY
    SELECT 
        new_customer_id,
        customer_record.name,
        customer_record.external_id,
        customer_record.email,
        customer_record.phone,
        customer_record.account_status,
        customer_record.credit_terms_days,
        customer_record.created_at,
        customer_record.created_by,
        new_address_id,
        customer_record.line1,
        customer_record.line2,
        customer_record.city,
        customer_record.state,
        customer_record.postal_code,
        customer_record.country,
        customer_record.is_primary;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_customer_with_address(
    text, text, text, text, text, text, integer,
    text, text, text, text, text, text, text,
    numeric, numeric, text, text, boolean, text, uuid
) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION create_customer_with_address IS 'Creates a customer and their primary address atomically';

COMMIT;