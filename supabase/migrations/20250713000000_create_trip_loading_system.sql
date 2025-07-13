-- Trip Loading System Implementation
-- This migration creates the necessary tables and functions for Stage 2 of the Trip Lifecycle
-- Enables tracking of loading details, Required vs Loaded reporting, and short-loading warnings

BEGIN;

-- =============================================================================
-- ENUMS AND TYPES
-- =============================================================================

-- Extend truck route status enum to include loading statuses
DO $$
BEGIN
    -- Check if the enum type exists and add new values if needed
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'route_status_type') THEN
        -- Add new enum values if they don't exist
        IF NOT EXISTS (
            SELECT 1 FROM pg_enum 
            WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'route_status_type')
            AND enumlabel = 'loading'
        ) THEN
            ALTER TYPE route_status_type ADD VALUE 'loading';
        END IF;
        
        IF NOT EXISTS (
            SELECT 1 FROM pg_enum 
            WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'route_status_type')
            AND enumlabel = 'loaded'
        ) THEN
            ALTER TYPE route_status_type ADD VALUE 'loaded';
        END IF;
    ELSE
        -- Create the enum type if it doesn't exist
        CREATE TYPE route_status_type AS ENUM (
            'planned', 
            'loading', 
            'loaded', 
            'in_transit', 
            'delivering', 
            'unloading', 
            'completed', 
            'cancelled'
        );
    END IF;
END $$;

-- Create loading status enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'loading_status_type') THEN
        CREATE TYPE loading_status_type AS ENUM (
            'pending',        -- Not yet loaded
            'partial',        -- Partially loaded
            'complete',       -- Fully loaded as required
            'short_loaded',   -- Loaded less than required
            'over_loaded'     -- Loaded more than required
        );
    END IF;
END $$;

-- =============================================================================
-- TRIP LOADING DETAILS TABLE
-- =============================================================================

-- Create trip_loading_details table to track what gets loaded onto each trip
CREATE TABLE IF NOT EXISTS trip_loading_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID NOT NULL REFERENCES truck_routes(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    
    -- Required quantities (from order allocations)
    required_qty_full INTEGER NOT NULL DEFAULT 0 CHECK (required_qty_full >= 0),
    required_qty_empty INTEGER NOT NULL DEFAULT 0 CHECK (required_qty_empty >= 0),
    
    -- Actually loaded quantities
    loaded_qty_full INTEGER NOT NULL DEFAULT 0 CHECK (loaded_qty_full >= 0),
    loaded_qty_empty INTEGER NOT NULL DEFAULT 0 CHECK (loaded_qty_empty >= 0),
    
    -- Loading sequence and status
    loading_sequence INTEGER NOT NULL CHECK (loading_sequence > 0),
    loading_status loading_status_type NOT NULL DEFAULT 'pending',
    
    -- Variance tracking
    variance_qty_full INTEGER GENERATED ALWAYS AS (loaded_qty_full - required_qty_full) STORED,
    variance_qty_empty INTEGER GENERATED ALWAYS AS (loaded_qty_empty - required_qty_empty) STORED,
    
    -- Weight calculations
    estimated_weight_kg NUMERIC(8,3),
    actual_weight_kg NUMERIC(8,3),
    
    -- Timestamps
    loaded_at TIMESTAMPTZ,
    notes TEXT,
    
    -- Audit fields
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    loaded_by_user_id UUID,
    
    -- Constraints
    CONSTRAINT unique_trip_product_sequence UNIQUE (trip_id, product_id, loading_sequence),
    CONSTRAINT valid_quantities CHECK (
        (required_qty_full + required_qty_empty) > 0 OR 
        (loaded_qty_full + loaded_qty_empty) > 0
    )
);

-- =============================================================================
-- TRIP VARIANCE TRACKING TABLE
-- =============================================================================

-- Create trip_variance_tracking table for detailed variance analysis
CREATE TABLE IF NOT EXISTS trip_variance_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID NOT NULL REFERENCES truck_routes(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    
    -- Variance details
    variance_type TEXT NOT NULL CHECK (variance_type IN ('shortage', 'overage', 'substitution', 'damage')),
    variance_qty_full INTEGER NOT NULL DEFAULT 0,
    variance_qty_empty INTEGER NOT NULL DEFAULT 0,
    variance_reason TEXT,
    variance_value_impact NUMERIC(10,2), -- Financial impact of variance
    
    -- Resolution tracking
    resolution_action TEXT,
    resolved_at TIMESTAMPTZ,
    resolved_by_user_id UUID,
    
    -- Audit fields
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    reported_by_user_id UUID
);

-- =============================================================================
-- EXTEND TRUCK_ROUTES TABLE FOR LOADING TIMESTAMPS
-- =============================================================================

-- Add loading-specific timestamp columns to truck_routes if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'truck_routes' AND column_name = 'load_started_at'
    ) THEN
        ALTER TABLE truck_routes 
        ADD COLUMN load_started_at TIMESTAMPTZ,
        ADD COLUMN load_completed_at TIMESTAMPTZ,
        ADD COLUMN loading_notes TEXT,
        ADD COLUMN total_loaded_weight_kg NUMERIC(8,3),
        ADD COLUMN loading_variance_count INTEGER DEFAULT 0,
        ADD COLUMN short_loading_flag BOOLEAN DEFAULT false;
    END IF;
END $$;

-- Add warehouse_id and driver_id columns if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'truck_routes' AND column_name = 'warehouse_id'
    ) THEN
        ALTER TABLE truck_routes 
        ADD COLUMN warehouse_id UUID REFERENCES warehouses(id),
        ADD COLUMN driver_id UUID; -- References users table but no FK constraint due to admin users
    END IF;
END $$;

-- =============================================================================
-- EXTEND TRUCK_ALLOCATIONS TABLE FOR TRIP LINKING
-- =============================================================================

-- Add trip_id to truck_allocations if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'truck_allocations' AND column_name = 'trip_id'
    ) THEN
        ALTER TABLE truck_allocations 
        ADD COLUMN trip_id UUID REFERENCES truck_routes(id),
        ADD COLUMN stop_sequence INTEGER,
        ADD COLUMN allocated_by_user_id UUID,
        ADD COLUMN allocated_at TIMESTAMPTZ DEFAULT now(),
        ADD COLUMN notes TEXT;
    END IF;
END $$;

-- =============================================================================
-- CREATE INDEXES FOR PERFORMANCE
-- =============================================================================

-- Indexes for trip_loading_details
CREATE INDEX IF NOT EXISTS idx_trip_loading_details_trip_id ON trip_loading_details(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_loading_details_product_id ON trip_loading_details(product_id);
CREATE INDEX IF NOT EXISTS idx_trip_loading_details_sequence ON trip_loading_details(trip_id, loading_sequence);
CREATE INDEX IF NOT EXISTS idx_trip_loading_details_status ON trip_loading_details(loading_status);
CREATE INDEX IF NOT EXISTS idx_trip_loading_details_loaded_at ON trip_loading_details(loaded_at) WHERE loaded_at IS NOT NULL;

-- Indexes for trip_variance_tracking
CREATE INDEX IF NOT EXISTS idx_trip_variance_tracking_trip_id ON trip_variance_tracking(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_variance_tracking_product_id ON trip_variance_tracking(product_id);
CREATE INDEX IF NOT EXISTS idx_trip_variance_tracking_type ON trip_variance_tracking(variance_type);
CREATE INDEX IF NOT EXISTS idx_trip_variance_tracking_resolved ON trip_variance_tracking(resolved_at) WHERE resolved_at IS NOT NULL;

-- Indexes for truck_routes loading fields
CREATE INDEX IF NOT EXISTS idx_truck_routes_load_started ON truck_routes(load_started_at) WHERE load_started_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_truck_routes_load_completed ON truck_routes(load_completed_at) WHERE load_completed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_truck_routes_short_loading ON truck_routes(short_loading_flag) WHERE short_loading_flag = true;
CREATE INDEX IF NOT EXISTS idx_truck_routes_warehouse_id ON truck_routes(warehouse_id) WHERE warehouse_id IS NOT NULL;

-- =============================================================================
-- HELPER FUNCTIONS FOR LOADING CALCULATIONS
-- =============================================================================

-- Function to calculate required quantities for a trip based on allocated orders
CREATE OR REPLACE FUNCTION calculate_trip_required_quantities(p_trip_id UUID)
RETURNS TABLE (
    product_id UUID,
    required_qty_full BIGINT,
    required_qty_empty BIGINT,
    total_orders INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ol.product_id,
        SUM(ol.qty_full)::BIGINT as required_qty_full,
        SUM(ol.qty_empty)::BIGINT as required_qty_empty,
        COUNT(DISTINCT ta.order_id)::INTEGER as total_orders
    FROM truck_allocations ta
    JOIN order_lines ol ON ta.order_id = ol.order_id
    WHERE ta.trip_id = p_trip_id
      AND ta.status != 'cancelled'
    GROUP BY ol.product_id
    ORDER BY ol.product_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get loading summary for a trip
CREATE OR REPLACE FUNCTION get_trip_loading_summary(p_trip_id UUID)
RETURNS TABLE (
    trip_id UUID,
    total_products INTEGER,
    products_loaded INTEGER,
    products_pending INTEGER,
    products_short_loaded INTEGER,
    total_required_cylinders BIGINT,
    total_loaded_cylinders BIGINT,
    loading_percentage NUMERIC,
    variance_count INTEGER,
    has_short_loading BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p_trip_id as trip_id,
        COUNT(*)::INTEGER as total_products,
        COUNT(*) FILTER (WHERE tld.loading_status IN ('complete', 'over_loaded'))::INTEGER as products_loaded,
        COUNT(*) FILTER (WHERE tld.loading_status = 'pending')::INTEGER as products_pending,
        COUNT(*) FILTER (WHERE tld.loading_status = 'short_loaded')::INTEGER as products_short_loaded,
        SUM(tld.required_qty_full + tld.required_qty_empty)::BIGINT as total_required_cylinders,
        SUM(tld.loaded_qty_full + tld.loaded_qty_empty)::BIGINT as total_loaded_cylinders,
        CASE 
            WHEN SUM(tld.required_qty_full + tld.required_qty_empty) > 0 THEN
                ROUND(
                    (SUM(tld.loaded_qty_full + tld.loaded_qty_empty)::NUMERIC / 
                     SUM(tld.required_qty_full + tld.required_qty_empty)::NUMERIC) * 100, 
                    2
                )
            ELSE 0
        END as loading_percentage,
        COUNT(*) FILTER (WHERE ABS(tld.variance_qty_full) > 0 OR ABS(tld.variance_qty_empty) > 0)::INTEGER as variance_count,
        EXISTS(SELECT 1 FROM trip_loading_details WHERE trip_id = p_trip_id AND loading_status = 'short_loaded') as has_short_loading
    FROM trip_loading_details tld
    WHERE tld.trip_id = p_trip_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get variance summary for a trip
CREATE OR REPLACE FUNCTION get_trip_variance_summary(p_trip_id UUID)
RETURNS TABLE (
    trip_id UUID,
    total_variances INTEGER,
    shortage_count INTEGER,
    overage_count INTEGER,
    total_variance_value NUMERIC,
    unresolved_variances INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p_trip_id as trip_id,
        COUNT(*)::INTEGER as total_variances,
        COUNT(*) FILTER (WHERE tvt.variance_type = 'shortage')::INTEGER as shortage_count,
        COUNT(*) FILTER (WHERE tvt.variance_type = 'overage')::INTEGER as overage_count,
        COALESCE(SUM(tvt.variance_value_impact), 0) as total_variance_value,
        COUNT(*) FILTER (WHERE tvt.resolved_at IS NULL)::INTEGER as unresolved_variances
    FROM trip_variance_tracking tvt
    WHERE tvt.trip_id = p_trip_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to identify short-loading warnings for a trip
CREATE OR REPLACE FUNCTION get_trip_short_loading_warnings(p_trip_id UUID)
RETURNS TABLE (
    product_id UUID,
    product_name TEXT,
    product_sku TEXT,
    required_qty_full INTEGER,
    required_qty_empty INTEGER,
    loaded_qty_full INTEGER,
    loaded_qty_empty INTEGER,
    shortage_qty_full INTEGER,
    shortage_qty_empty INTEGER,
    shortage_percentage NUMERIC,
    impacted_orders INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        tld.product_id,
        p.name as product_name,
        p.sku as product_sku,
        tld.required_qty_full,
        tld.required_qty_empty,
        tld.loaded_qty_full,
        tld.loaded_qty_empty,
        (tld.required_qty_full - tld.loaded_qty_full) as shortage_qty_full,
        (tld.required_qty_empty - tld.loaded_qty_empty) as shortage_qty_empty,
        CASE 
            WHEN (tld.required_qty_full + tld.required_qty_empty) > 0 THEN
                ROUND(
                    (1 - (tld.loaded_qty_full + tld.loaded_qty_empty)::NUMERIC / 
                         (tld.required_qty_full + tld.required_qty_empty)::NUMERIC) * 100, 
                    2
                )
            ELSE 0
        END as shortage_percentage,
        (
            SELECT COUNT(DISTINCT ta.order_id)::INTEGER
            FROM truck_allocations ta
            JOIN order_lines ol ON ta.order_id = ol.order_id
            WHERE ta.trip_id = p_trip_id 
              AND ol.product_id = tld.product_id
              AND ta.status != 'cancelled'
        ) as impacted_orders
    FROM trip_loading_details tld
    JOIN products p ON tld.product_id = p.id
    WHERE tld.trip_id = p_trip_id
      AND (tld.loaded_qty_full < tld.required_qty_full OR tld.loaded_qty_empty < tld.required_qty_empty)
      AND tld.loading_status IN ('short_loaded', 'pending')
    ORDER BY shortage_percentage DESC, shortage_qty_full + shortage_qty_empty DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- STOCK MOVEMENT FUNCTIONS FOR LOADING
-- =============================================================================

-- Function to transfer stock from warehouse to truck for trip loading
CREATE OR REPLACE FUNCTION load_trip_stock(
    p_trip_id UUID,
    p_product_id UUID,
    p_qty_full INTEGER,
    p_qty_empty INTEGER,
    p_loading_sequence INTEGER DEFAULT 1,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_truck_id UUID;
    v_warehouse_id UUID;
    v_trip_status TEXT;
    v_transfer_result JSON;
    v_result JSON;
BEGIN
    -- Get trip details
    SELECT tr.truck_id, tr.warehouse_id, tr.route_status 
    INTO v_truck_id, v_warehouse_id, v_trip_status
    FROM truck_routes tr
    WHERE tr.id = p_trip_id;
    
    IF v_truck_id IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Trip not found'
        );
    END IF;
    
    IF v_warehouse_id IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Trip warehouse not specified'
        );
    END IF;
    
    IF v_trip_status NOT IN ('planned', 'loading') THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Trip is not in loading state'
        );
    END IF;
    
    -- Check if quantities are positive
    IF p_qty_full < 0 OR p_qty_empty < 0 THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Quantities cannot be negative'
        );
    END IF;
    
    IF p_qty_full = 0 AND p_qty_empty = 0 THEN
        RETURN json_build_object(
            'success', false,
            'error', 'At least one quantity must be greater than zero'
        );
    END IF;
    
    -- Transfer stock from warehouse to truck
    SELECT transfer_stock_to_truck(
        v_warehouse_id,
        v_truck_id,
        p_product_id,
        p_qty_full,
        p_qty_empty
    ) INTO v_transfer_result;
    
    IF NOT (v_transfer_result->>'success')::BOOLEAN THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Stock transfer failed: ' || (v_transfer_result->>'error')
        );
    END IF;
    
    -- Atomic UPSERT operation to prevent race conditions
    -- First, get the required quantities for the product in this trip
    WITH required_quantities AS (
        SELECT 
            COALESCE(SUM(ol.qty_full), 0) as required_qty_full,
            COALESCE(SUM(ol.qty_empty), 0) as required_qty_empty
        FROM truck_allocations ta
        JOIN order_lines ol ON ta.order_id = ol.order_id
        WHERE ta.trip_id = p_trip_id
          AND ol.product_id = p_product_id
          AND ta.status != 'cancelled'
    )
    INSERT INTO trip_loading_details (
        trip_id,
        product_id,
        required_qty_full,
        required_qty_empty,
        loaded_qty_full,
        loaded_qty_empty,
        loading_sequence,
        loading_status,
        loaded_at,
        notes,
        created_at,
        updated_at
    )
    SELECT 
        p_trip_id,
        p_product_id,
        rq.required_qty_full,
        rq.required_qty_empty,
        p_qty_full,
        p_qty_empty,
        p_loading_sequence,
        CASE 
            WHEN p_qty_full >= rq.required_qty_full AND 
                 p_qty_empty >= rq.required_qty_empty THEN 'complete'
            WHEN p_qty_full > 0 OR p_qty_empty > 0 THEN 'partial'
            ELSE 'pending'
        END,
        now(),
        p_notes,
        now(),
        now()
    FROM required_quantities rq
    ON CONFLICT (trip_id, product_id, loading_sequence) 
    DO UPDATE SET
        loaded_qty_full = trip_loading_details.loaded_qty_full + EXCLUDED.loaded_qty_full,
        loaded_qty_empty = trip_loading_details.loaded_qty_empty + EXCLUDED.loaded_qty_empty,
        loading_status = CASE 
            WHEN (trip_loading_details.loaded_qty_full + EXCLUDED.loaded_qty_full) >= trip_loading_details.required_qty_full AND 
                 (trip_loading_details.loaded_qty_empty + EXCLUDED.loaded_qty_empty) >= trip_loading_details.required_qty_empty THEN 'complete'
            WHEN (trip_loading_details.loaded_qty_full + EXCLUDED.loaded_qty_full) > 0 OR 
                 (trip_loading_details.loaded_qty_empty + EXCLUDED.loaded_qty_empty) > 0 THEN 'partial'
            ELSE 'pending'
        END,
        loaded_at = now(),
        notes = COALESCE(EXCLUDED.notes, trip_loading_details.notes),
        updated_at = now();
    
    RETURN json_build_object(
        'success', true,
        'trip_id', p_trip_id,
        'product_id', p_product_id,
        'loaded_qty_full', p_qty_full,
        'loaded_qty_empty', p_qty_empty,
        'transfer_result', v_transfer_result,
        'message', 'Stock loaded successfully'
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Update trigger for trip_loading_details to maintain timestamp
CREATE OR REPLACE FUNCTION update_trip_loading_details_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := now();
    
    -- Update loading status based on quantities
    IF NEW.loaded_qty_full >= NEW.required_qty_full AND NEW.loaded_qty_empty >= NEW.required_qty_empty THEN
        NEW.loading_status := 'complete';
    ELSIF NEW.loaded_qty_full < NEW.required_qty_full OR NEW.loaded_qty_empty < NEW.required_qty_empty THEN
        IF NEW.loaded_qty_full > 0 OR NEW.loaded_qty_empty > 0 THEN
            NEW.loading_status := 'short_loaded';
        ELSE
            NEW.loading_status := 'pending';
        END IF;
    ELSIF NEW.loaded_qty_full > NEW.required_qty_full OR NEW.loaded_qty_empty > NEW.required_qty_empty THEN
        NEW.loading_status := 'over_loaded';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_trip_loading_details_timestamp
    BEFORE UPDATE ON trip_loading_details
    FOR EACH ROW
    EXECUTE FUNCTION update_trip_loading_details_timestamp();

-- Update trigger for trip_variance_tracking timestamp
CREATE OR REPLACE FUNCTION update_trip_variance_tracking_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_trip_variance_tracking_timestamp
    BEFORE UPDATE ON trip_variance_tracking
    FOR EACH ROW
    EXECUTE FUNCTION update_trip_variance_tracking_timestamp();

-- =============================================================================
-- GRANT PERMISSIONS
-- =============================================================================

-- Grant permissions on new tables
GRANT ALL ON trip_loading_details TO authenticated;
GRANT ALL ON trip_variance_tracking TO authenticated;

-- Grant execute permissions on helper functions
GRANT EXECUTE ON FUNCTION calculate_trip_required_quantities(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_trip_loading_summary(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_trip_variance_summary(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_trip_short_loading_warnings(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION load_trip_stock(UUID, UUID, INTEGER, INTEGER, INTEGER, TEXT) TO authenticated;

COMMIT;

-- =============================================================================
-- VERIFICATION AND INITIAL DATA
-- =============================================================================

-- Verify table creation
SELECT 
    'Trip loading system verification:' as status,
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'trip_loading_details') as loading_details_table,
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'trip_variance_tracking') as variance_tracking_table,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'truck_routes' AND column_name = 'load_started_at') as route_loading_columns;

-- Test helper functions
SELECT 
    'Helper functions test:' as status,
    pg_function_is_visible('calculate_trip_required_quantities'::regproc) as calc_required_function,
    pg_function_is_visible('get_trip_loading_summary'::regproc) as loading_summary_function,
    pg_function_is_visible('get_trip_short_loading_warnings'::regproc) as short_loading_function;