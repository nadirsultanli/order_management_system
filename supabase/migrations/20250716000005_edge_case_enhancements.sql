-- =============================================================================
-- COMPREHENSIVE DATABASE SCHEMA ENHANCEMENTS FOR EDGE CASE HANDLING
-- AND ADVANCED CYLINDER MANAGEMENT FEATURES
-- =============================================================================
-- Migration: 20250716000005_edge_case_enhancements.sql
-- Description: Implements support for damaged/lost cylinders, partial fills,
--              cross-brand empty handling, customer deposit limits, and 
--              enhanced regulatory compliance tracking
-- =============================================================================

BEGIN;

-- =============================================================================
-- ENUMS AND TYPES
-- =============================================================================

-- Create damage status enum for cylinder condition tracking
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'damage_status_enum') THEN
        CREATE TYPE damage_status_enum AS ENUM (
            'good',
            'damaged', 
            'lost'
        );
    END IF;
END $$;

-- Create brand reconciliation status enum for cross-brand empty handling
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'brand_reconciliation_status_enum') THEN
        CREATE TYPE brand_reconciliation_status_enum AS ENUM (
            'pending',
            'matched',
            'generic_accepted'
        );
    END IF;
END $$;

-- Create compliance status enum for regulatory tracking
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'compliance_status_enum') THEN
        CREATE TYPE compliance_status_enum AS ENUM (
            'compliant',
            'warning',
            'overdue',
            'suspended'
        );
    END IF;
END $$;

-- Create cylinder disposition enum for damaged cylinder handling
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cylinder_disposition_enum') THEN
        CREATE TYPE cylinder_disposition_enum AS ENUM (
            'repair',
            'scrap',
            'return_to_manufacturer'
        );
    END IF;
END $$;

-- Enhance existing product variant type with EMPTY-SCRAP
DO $$
BEGIN
    -- Add EMPTY-SCRAP variant if it doesn't exist
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'product_variant_type') THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_enum 
            WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'product_variant_type')
            AND enumlabel = 'EMPTY-SCRAP'
        ) THEN
            ALTER TYPE product_variant_type ADD VALUE 'EMPTY-SCRAP';
        END IF;
    END IF;
END $$;

-- =============================================================================
-- EMPTY RETURN CREDITS TABLE ENHANCEMENTS - DAMAGED/LOST CYLINDERS
-- =============================================================================

-- Add damaged/lost cylinder tracking to empty_return_credits table
DO $$
BEGIN
    -- Add damage status column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'empty_return_credits' 
        AND column_name = 'damage_status'
    ) THEN
        ALTER TABLE empty_return_credits 
        ADD COLUMN damage_status damage_status_enum DEFAULT 'good';
    END IF;

    -- Add lost cylinder fee tracking
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'empty_return_credits' 
        AND column_name = 'lost_cylinder_fee_amount'
    ) THEN
        ALTER TABLE empty_return_credits 
        ADD COLUMN lost_cylinder_fee_amount NUMERIC(10,2) DEFAULT 0;
    END IF;

    -- Add damage report notes
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'empty_return_credits' 
        AND column_name = 'damage_report_notes'
    ) THEN
        ALTER TABLE empty_return_credits 
        ADD COLUMN damage_report_notes TEXT;
    END IF;

    -- Add cross-brand empty handling fields
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'empty_return_credits' 
        AND column_name = 'original_brand'
    ) THEN
        ALTER TABLE empty_return_credits 
        ADD COLUMN original_brand VARCHAR(100);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'empty_return_credits' 
        AND column_name = 'accepted_brand'
    ) THEN
        ALTER TABLE empty_return_credits 
        ADD COLUMN accepted_brand VARCHAR(100);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'empty_return_credits' 
        AND column_name = 'brand_reconciliation_status'
    ) THEN
        ALTER TABLE empty_return_credits 
        ADD COLUMN brand_reconciliation_status brand_reconciliation_status_enum DEFAULT 'pending';
    END IF;
END $$;

-- Add indexes for performance on new columns
CREATE INDEX IF NOT EXISTS idx_empty_return_credits_damage_status 
    ON empty_return_credits (damage_status) WHERE damage_status != 'good';

CREATE INDEX IF NOT EXISTS idx_empty_return_credits_brand_reconciliation 
    ON empty_return_credits (brand_reconciliation_status) WHERE brand_reconciliation_status != 'matched';

CREATE INDEX IF NOT EXISTS idx_empty_return_credits_original_brand 
    ON empty_return_credits (original_brand) WHERE original_brand IS NOT NULL;

-- =============================================================================
-- ORDER LINES TABLE ENHANCEMENTS - PARTIAL FILLS
-- =============================================================================

-- Add partial fill support to order_lines table
DO $$
BEGIN
    -- Add fill percentage column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'order_lines' 
        AND column_name = 'fill_percentage'
    ) THEN
        ALTER TABLE order_lines 
        ADD COLUMN fill_percentage NUMERIC(5,2) DEFAULT 100.00 
        CHECK (fill_percentage > 0 AND fill_percentage <= 100);
    END IF;

    -- Add partial fill flag
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'order_lines' 
        AND column_name = 'is_partial_fill'
    ) THEN
        ALTER TABLE order_lines 
        ADD COLUMN is_partial_fill BOOLEAN DEFAULT false;
    END IF;

    -- Add partial fill notes
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'order_lines' 
        AND column_name = 'partial_fill_notes'
    ) THEN
        ALTER TABLE order_lines 
        ADD COLUMN partial_fill_notes TEXT;
    END IF;
END $$;

-- Add indexes for partial fill queries
CREATE INDEX IF NOT EXISTS idx_order_lines_is_partial_fill 
    ON order_lines (is_partial_fill) WHERE is_partial_fill = true;

CREATE INDEX IF NOT EXISTS idx_order_lines_fill_percentage 
    ON order_lines (fill_percentage) WHERE fill_percentage < 100;

-- =============================================================================
-- CUSTOMERS TABLE ENHANCEMENTS - DEPOSIT LIMITS
-- =============================================================================

-- Add customer deposit limit management
DO $$
BEGIN
    -- Add deposit limit column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'customers' 
        AND column_name = 'deposit_limit'
    ) THEN
        ALTER TABLE customers 
        ADD COLUMN deposit_limit NUMERIC(12,2) DEFAULT NULL 
        CHECK (deposit_limit IS NULL OR deposit_limit >= 0);
    END IF;

    -- Add current deposit exposure (calculated field)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'customers' 
        AND column_name = 'current_deposit_exposure'
    ) THEN
        ALTER TABLE customers 
        ADD COLUMN current_deposit_exposure NUMERIC(12,2) DEFAULT 0 
        CHECK (current_deposit_exposure >= 0);
    END IF;

    -- Add deposit limit alerts flag
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'customers' 
        AND column_name = 'deposit_limit_alerts_enabled'
    ) THEN
        ALTER TABLE customers 
        ADD COLUMN deposit_limit_alerts_enabled BOOLEAN DEFAULT true;
    END IF;
END $$;

-- Add indexes for deposit limit queries
CREATE INDEX IF NOT EXISTS idx_customers_deposit_limit 
    ON customers (deposit_limit) WHERE deposit_limit IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_customers_deposit_exposure 
    ON customers (current_deposit_exposure) WHERE current_deposit_exposure > 0;

-- =============================================================================
-- CYLINDER ASSETS TABLE ENHANCEMENTS - REGULATORY COMPLIANCE
-- =============================================================================

-- Enhance cylinder_assets table with comprehensive regulatory compliance tracking
DO $$
BEGIN
    -- Add regulatory compliance fields if they don't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'cylinder_assets' 
        AND column_name = 'compliance_status'
    ) THEN
        ALTER TABLE cylinder_assets 
        ADD COLUMN compliance_status compliance_status_enum DEFAULT 'compliant';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'cylinder_assets' 
        AND column_name = 'regulatory_notes'
    ) THEN
        ALTER TABLE cylinder_assets 
        ADD COLUMN regulatory_notes TEXT;
    END IF;

    -- Add damaged cylinder disposition if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'cylinder_assets' 
        AND column_name = 'damaged_cylinder_disposition'
    ) THEN
        ALTER TABLE cylinder_assets 
        ADD COLUMN damaged_cylinder_disposition cylinder_disposition_enum;
    END IF;
END $$;

-- Add indexes for compliance tracking
CREATE INDEX IF NOT EXISTS idx_cylinder_assets_compliance_status 
    ON cylinder_assets (compliance_status) WHERE compliance_status != 'compliant';

CREATE INDEX IF NOT EXISTS idx_cylinder_assets_damaged_disposition 
    ON cylinder_assets (damaged_cylinder_disposition) WHERE damaged_cylinder_disposition IS NOT NULL;

-- =============================================================================
-- NEW TABLES - AUDIT TRAILS AND COMPLIANCE TRACKING
-- =============================================================================

-- Create cylinder condition history table for comprehensive audit trail
CREATE TABLE IF NOT EXISTS cylinder_condition_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cylinder_asset_id UUID NOT NULL REFERENCES cylinder_assets(id) ON DELETE CASCADE,
    
    -- Condition change tracking
    previous_condition VARCHAR(20),
    new_condition VARCHAR(20) NOT NULL,
    change_reason TEXT,
    change_description TEXT,
    
    -- Damage/loss specific fields
    damage_assessment TEXT,
    estimated_repair_cost NUMERIC(10,2),
    disposition_decision cylinder_disposition_enum,
    
    -- Location and personnel
    location_when_discovered VARCHAR(200),
    discovered_by_user_id UUID,
    warehouse_id UUID REFERENCES warehouses(id),
    truck_id UUID REFERENCES trucks(id),
    customer_id UUID REFERENCES customers(id),
    
    -- Supporting documentation
    photo_urls TEXT[], -- Array of photo URLs for documentation
    inspection_report_url TEXT,
    repair_invoice_url TEXT,
    
    -- Regulatory compliance
    regulatory_impact_assessment TEXT,
    compliance_officer_notes TEXT,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID,
    
    -- Constraints
    CONSTRAINT valid_condition_change CHECK (
        previous_condition != new_condition OR previous_condition IS NULL
    )
);

-- Create compliance alerts table for regulatory tracking
CREATE TABLE IF NOT EXISTS compliance_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cylinder_asset_id UUID REFERENCES cylinder_assets(id) ON DELETE CASCADE,
    
    -- Alert details
    alert_type VARCHAR(50) NOT NULL CHECK (alert_type IN (
        'inspection_due', 
        'pressure_test_due', 
        'inspection_overdue', 
        'pressure_test_overdue',
        'certification_expired',
        'regulatory_violation'
    )),
    alert_priority VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (alert_priority IN ('low', 'medium', 'high', 'critical')),
    alert_message TEXT NOT NULL,
    
    -- Timing
    due_date DATE,
    escalation_date DATE,
    
    -- Status and resolution
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'resolved', 'dismissed')),
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    acknowledged_by UUID,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by UUID,
    resolution_notes TEXT,
    
    -- Regulatory context
    regulatory_reference VARCHAR(100),
    compliance_requirements TEXT,
    potential_consequences TEXT,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID
);

-- =============================================================================
-- INDEXES FOR PERFORMANCE
-- =============================================================================

-- Cylinder condition history indexes
CREATE INDEX IF NOT EXISTS idx_cylinder_condition_history_asset 
    ON cylinder_condition_history (cylinder_asset_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cylinder_condition_history_condition 
    ON cylinder_condition_history (new_condition);

CREATE INDEX IF NOT EXISTS idx_cylinder_condition_history_disposition 
    ON cylinder_condition_history (disposition_decision) WHERE disposition_decision IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cylinder_condition_history_discovered_by 
    ON cylinder_condition_history (discovered_by_user_id) WHERE discovered_by_user_id IS NOT NULL;

-- Compliance alerts indexes
CREATE INDEX IF NOT EXISTS idx_compliance_alerts_cylinder_asset 
    ON compliance_alerts (cylinder_asset_id);

CREATE INDEX IF NOT EXISTS idx_compliance_alerts_type_status 
    ON compliance_alerts (alert_type, status);

CREATE INDEX IF NOT EXISTS idx_compliance_alerts_due_date 
    ON compliance_alerts (due_date) WHERE due_date IS NOT NULL AND status = 'active';

CREATE INDEX IF NOT EXISTS idx_compliance_alerts_priority 
    ON compliance_alerts (alert_priority, status) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_compliance_alerts_escalation 
    ON compliance_alerts (escalation_date) WHERE escalation_date IS NOT NULL AND status = 'active';

-- =============================================================================
-- ENHANCED FUNCTIONS AND PROCEDURES
-- =============================================================================

-- Function to calculate customer deposit exposure
CREATE OR REPLACE FUNCTION calculate_customer_deposit_exposure(p_customer_id UUID)
RETURNS NUMERIC AS $$
DECLARE
    total_exposure NUMERIC := 0;
BEGIN
    -- Calculate total pending deposit credits
    SELECT COALESCE(SUM(total_credit_amount * quantity_remaining / quantity), 0)
    INTO total_exposure
    FROM empty_return_credits
    WHERE customer_id = p_customer_id
      AND status IN ('pending', 'partial_returned', 'grace_period')
      AND damage_status = 'good'; -- Only count good cylinders
    
    RETURN total_exposure;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update customer deposit exposure
CREATE OR REPLACE FUNCTION update_customer_deposit_exposure(p_customer_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    new_exposure NUMERIC;
BEGIN
    -- Calculate new exposure
    new_exposure := calculate_customer_deposit_exposure(p_customer_id);
    
    -- Update customer record
    UPDATE customers
    SET current_deposit_exposure = new_exposure,
        updated_at = NOW()
    WHERE id = p_customer_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check deposit limit before order processing
CREATE OR REPLACE FUNCTION check_customer_deposit_limit(
    p_customer_id UUID,
    p_additional_deposit NUMERIC
) RETURNS TABLE (
    within_limit BOOLEAN,
    current_exposure NUMERIC,
    deposit_limit NUMERIC,
    available_limit NUMERIC,
    limit_exceeded_by NUMERIC
) AS $$
DECLARE
    customer_record RECORD;
    calculated_exposure NUMERIC;
BEGIN
    -- Get customer deposit information
    SELECT * INTO customer_record
    FROM customers
    WHERE id = p_customer_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Customer not found: %', p_customer_id;
    END IF;
    
    -- Calculate current exposure
    calculated_exposure := calculate_customer_deposit_exposure(p_customer_id);
    
    -- Return analysis
    RETURN QUERY SELECT
        CASE 
            WHEN customer_record.deposit_limit IS NULL THEN true -- No limit set
            WHEN (calculated_exposure + p_additional_deposit) <= customer_record.deposit_limit THEN true
            ELSE false
        END as within_limit,
        calculated_exposure as current_exposure,
        customer_record.deposit_limit as deposit_limit,
        CASE 
            WHEN customer_record.deposit_limit IS NULL THEN NULL
            ELSE GREATEST(0, customer_record.deposit_limit - calculated_exposure)
        END as available_limit,
        CASE 
            WHEN customer_record.deposit_limit IS NULL THEN 0
            ELSE GREATEST(0, (calculated_exposure + p_additional_deposit) - customer_record.deposit_limit)
        END as limit_exceeded_by;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to process damaged/lost cylinder claims
CREATE OR REPLACE FUNCTION process_damaged_lost_cylinder(
    p_credit_id UUID,
    p_damage_status damage_status_enum,
    p_damage_notes TEXT DEFAULT NULL,
    p_lost_fee_amount NUMERIC DEFAULT NULL,
    p_disposition cylinder_disposition_enum DEFAULT NULL,
    p_processed_by UUID DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    credit_record RECORD;
    cylinder_asset_id UUID;
BEGIN
    -- Get current credit record
    SELECT * INTO credit_record
    FROM empty_return_credits
    WHERE id = p_credit_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Empty return credit not found: %', p_credit_id;
    END IF;
    
    -- Update empty return credit
    UPDATE empty_return_credits
    SET 
        damage_status = p_damage_status,
        damage_report_notes = COALESCE(damage_report_notes, '') || 
            CASE WHEN damage_report_notes IS NOT NULL THEN E'\n' ELSE '' END ||
            'Damage/Loss processed on ' || CURRENT_DATE || ': ' || COALESCE(p_damage_notes, 'No additional notes'),
        lost_cylinder_fee_amount = CASE 
            WHEN p_damage_status = 'lost' THEN COALESCE(p_lost_fee_amount, total_credit_amount)
            ELSE lost_cylinder_fee_amount
        END,
        status = CASE 
            WHEN p_damage_status IN ('damaged', 'lost') THEN 'cancelled'::credit_status_enum
            ELSE status
        END,
        cancelled_reason = CASE 
            WHEN p_damage_status IN ('damaged', 'lost') THEN 'Cylinder ' || p_damage_status::text
            ELSE cancelled_reason
        END,
        updated_at = NOW()
    WHERE id = p_credit_id;
    
    -- Create condition history record if we can find the cylinder asset
    SELECT id INTO cylinder_asset_id
    FROM cylinder_assets ca
    WHERE ca.product_id = credit_record.product_id
      AND ca.sold_to_customer_id = credit_record.customer_id
      AND ca.is_active = true
    LIMIT 1; -- This is a simplified lookup - in practice you'd need better tracking
    
    IF cylinder_asset_id IS NOT NULL THEN
        INSERT INTO cylinder_condition_history (
            cylinder_asset_id,
            previous_condition,
            new_condition,
            change_reason,
            change_description,
            damage_assessment,
            disposition_decision,
            customer_id,
            created_by
        ) VALUES (
            cylinder_asset_id,
            'full', -- Assuming it was full when delivered
            CASE 
                WHEN p_damage_status = 'damaged' THEN 'damaged'
                WHEN p_damage_status = 'lost' THEN 'lost'
                ELSE 'empty'
            END,
            'Customer return processing',
            p_damage_notes,
            p_damage_notes,
            p_disposition,
            credit_record.customer_id,
            p_processed_by
        );
    END IF;
    
    -- Update customer deposit exposure
    PERFORM update_customer_deposit_exposure(credit_record.customer_id);
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to generate compliance alerts for overdue cylinders
CREATE OR REPLACE FUNCTION generate_compliance_alerts()
RETURNS INTEGER AS $$
DECLARE
    alert_count INTEGER := 0;
    cylinder_record RECORD;
    alert_type_val VARCHAR(50);
    alert_priority_val VARCHAR(20);
    alert_message_val TEXT;
    due_date_val DATE;
BEGIN
    -- Clear existing active alerts to avoid duplicates
    UPDATE compliance_alerts 
    SET status = 'resolved', resolved_at = NOW()
    WHERE status = 'active' 
      AND alert_type IN ('inspection_due', 'pressure_test_due', 'inspection_overdue', 'pressure_test_overdue');
    
    -- Generate alerts for cylinders with compliance issues
    FOR cylinder_record IN 
        SELECT * FROM cylinder_assets 
        WHERE is_active = true 
        AND (
            next_inspection_due <= CURRENT_DATE + INTERVAL '30 days' 
            OR next_pressure_test_due <= CURRENT_DATE + INTERVAL '30 days'
        )
    LOOP
        -- Check inspection status
        IF cylinder_record.next_inspection_due IS NOT NULL THEN
            IF cylinder_record.next_inspection_due < CURRENT_DATE THEN
                alert_type_val := 'inspection_overdue';
                alert_priority_val := 'high';
                alert_message_val := 'Cylinder inspection is overdue by ' || 
                    (CURRENT_DATE - cylinder_record.next_inspection_due) || ' days';
                due_date_val := cylinder_record.next_inspection_due;
            ELSIF cylinder_record.next_inspection_due <= CURRENT_DATE + INTERVAL '7 days' THEN
                alert_type_val := 'inspection_due';
                alert_priority_val := 'medium';
                alert_message_val := 'Cylinder inspection due in ' || 
                    (cylinder_record.next_inspection_due - CURRENT_DATE) || ' days';
                due_date_val := cylinder_record.next_inspection_due;
            END IF;
            
            -- Insert inspection alert
            IF alert_type_val IS NOT NULL THEN
                INSERT INTO compliance_alerts (
                    cylinder_asset_id, alert_type, alert_priority, alert_message, 
                    due_date, escalation_date, regulatory_reference, compliance_requirements
                ) VALUES (
                    cylinder_record.id, alert_type_val, alert_priority_val, alert_message_val,
                    due_date_val, due_date_val + INTERVAL '7 days',
                    'Cylinder Safety Regulations', 'Annual safety inspection required'
                );
                alert_count := alert_count + 1;
            END IF;
        END IF;
        
        -- Reset variables
        alert_type_val := NULL;
        alert_priority_val := NULL;
        alert_message_val := NULL;
        due_date_val := NULL;
        
        -- Check pressure test status
        IF cylinder_record.next_pressure_test_due IS NOT NULL THEN
            IF cylinder_record.next_pressure_test_due < CURRENT_DATE THEN
                alert_type_val := 'pressure_test_overdue';
                alert_priority_val := 'critical';
                alert_message_val := 'Cylinder pressure test is overdue by ' || 
                    (CURRENT_DATE - cylinder_record.next_pressure_test_due) || ' days';
                due_date_val := cylinder_record.next_pressure_test_due;
            ELSIF cylinder_record.next_pressure_test_due <= CURRENT_DATE + INTERVAL '30 days' THEN
                alert_type_val := 'pressure_test_due';
                alert_priority_val := 'high';
                alert_message_val := 'Cylinder pressure test due in ' || 
                    (cylinder_record.next_pressure_test_due - CURRENT_DATE) || ' days';
                due_date_val := cylinder_record.next_pressure_test_due;
            END IF;
            
            -- Insert pressure test alert
            IF alert_type_val IS NOT NULL THEN
                INSERT INTO compliance_alerts (
                    cylinder_asset_id, alert_type, alert_priority, alert_message, 
                    due_date, escalation_date, regulatory_reference, compliance_requirements
                ) VALUES (
                    cylinder_record.id, alert_type_val, alert_priority_val, alert_message_val,
                    due_date_val, due_date_val + INTERVAL '14 days',
                    'Pressure Vessel Regulations', '5-year pressure test required'
                );
                alert_count := alert_count + 1;
            END IF;
        END IF;
    END LOOP;
    
    RETURN alert_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to validate partial fill parameters
CREATE OR REPLACE FUNCTION validate_partial_fill(
    p_order_line_id UUID,
    p_fill_percentage NUMERIC,
    p_reason TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    line_record RECORD;
    product_record RECORD;
BEGIN
    -- Get order line and product information
    SELECT ol.*, p.name as product_name, p.capacity_kg
    INTO line_record
    FROM order_lines ol
    JOIN products p ON ol.product_id = p.id
    WHERE ol.id = p_order_line_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order line not found: %', p_order_line_id;
    END IF;
    
    -- Validate fill percentage
    IF p_fill_percentage <= 0 OR p_fill_percentage > 100 THEN
        RAISE EXCEPTION 'Fill percentage must be between 0 and 100, got: %', p_fill_percentage;
    END IF;
    
    -- Update order line
    UPDATE order_lines
    SET 
        fill_percentage = p_fill_percentage,
        is_partial_fill = (p_fill_percentage < 100),
        partial_fill_notes = CASE 
            WHEN p_fill_percentage < 100 THEN 
                COALESCE(partial_fill_notes, '') || 
                CASE WHEN partial_fill_notes IS NOT NULL THEN E'\n' ELSE '' END ||
                'Partial fill ' || p_fill_percentage || '% on ' || CURRENT_DATE ||
                CASE WHEN p_reason IS NOT NULL THEN ': ' || p_reason ELSE '' END
            ELSE partial_fill_notes
        END,
        updated_at = NOW()
    WHERE id = p_order_line_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Trigger to automatically update customer deposit exposure
CREATE OR REPLACE FUNCTION trigger_update_customer_deposit_exposure()
RETURNS TRIGGER AS $$
BEGIN
    -- Update deposit exposure when empty return credits change
    IF TG_OP = 'UPDATE' OR TG_OP = 'INSERT' THEN
        PERFORM update_customer_deposit_exposure(NEW.customer_id);
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        PERFORM update_customer_deposit_exposure(OLD.customer_id);
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on empty_return_credits
DROP TRIGGER IF EXISTS trg_update_customer_deposit_exposure ON empty_return_credits;
CREATE TRIGGER trg_update_customer_deposit_exposure
    AFTER INSERT OR UPDATE OR DELETE ON empty_return_credits
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_customer_deposit_exposure();

-- Trigger to update compliance_alerts updated_at timestamp
CREATE OR REPLACE FUNCTION update_compliance_alerts_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_compliance_alerts_timestamp
    BEFORE UPDATE ON compliance_alerts
    FOR EACH ROW
    EXECUTE FUNCTION update_compliance_alerts_timestamp();

-- =============================================================================
-- VIEWS FOR REPORTING AND ANALYSIS
-- =============================================================================

-- Comprehensive view for cylinder compliance dashboard
CREATE OR REPLACE VIEW v_cylinder_compliance_dashboard AS
SELECT 
    ca.id as cylinder_id,
    ca.serial_number,
    ca.current_condition,
    ca.regulatory_status,
    ca.compliance_status,
    
    -- Product information
    p.name as product_name,
    p.sku,
    p.capacity_kg,
    
    -- Location information
    w.name as warehouse_name,
    ca.current_location_type,
    
    -- Inspection status
    ca.last_inspection_date,
    ca.next_inspection_due,
    CASE 
        WHEN ca.next_inspection_due < CURRENT_DATE THEN 'overdue'
        WHEN ca.next_inspection_due <= CURRENT_DATE + INTERVAL '30 days' THEN 'due_soon'
        ELSE 'current'
    END as inspection_status,
    ca.next_inspection_due - CURRENT_DATE as days_until_inspection,
    
    -- Pressure test status
    ca.last_pressure_test_date,
    ca.next_pressure_test_due,
    CASE 
        WHEN ca.next_pressure_test_due < CURRENT_DATE THEN 'overdue'
        WHEN ca.next_pressure_test_due <= CURRENT_DATE + INTERVAL '60 days' THEN 'due_soon'
        ELSE 'current'
    END as pressure_test_status,
    ca.next_pressure_test_due - CURRENT_DATE as days_until_pressure_test,
    
    -- Active alerts
    (SELECT COUNT(*) FROM compliance_alerts 
     WHERE cylinder_asset_id = ca.id AND status = 'active') as active_alerts_count,
    
    -- Customer information (if sold)
    c.name as customer_name,
    ca.sale_date,
    
    -- Operational metrics
    ca.total_fill_cycles,
    ca.last_fill_date,
    ca.is_active,
    ca.retirement_date
    
FROM cylinder_assets ca
LEFT JOIN products p ON ca.product_id = p.id
LEFT JOIN warehouses w ON ca.warehouse_id = w.id
LEFT JOIN customers c ON ca.sold_to_customer_id = c.id
WHERE ca.is_active = true;

-- View for customer deposit analysis
CREATE OR REPLACE VIEW v_customer_deposit_analysis AS
SELECT 
    c.id as customer_id,
    c.name as customer_name,
    c.code as customer_code,
    c.deposit_limit,
    c.current_deposit_exposure,
    c.deposit_limit_alerts_enabled,
    
    -- Calculated fields
    CASE 
        WHEN c.deposit_limit IS NULL THEN NULL
        ELSE c.deposit_limit - c.current_deposit_exposure
    END as available_deposit_limit,
    
    CASE 
        WHEN c.deposit_limit IS NULL THEN NULL
        WHEN c.current_deposit_exposure = 0 THEN 0
        ELSE ROUND((c.current_deposit_exposure / c.deposit_limit) * 100, 2)
    END as deposit_utilization_percentage,
    
    -- Credit breakdown
    (SELECT COUNT(*) FROM empty_return_credits erc 
     WHERE erc.customer_id = c.id AND erc.status IN ('pending', 'partial_returned') 
     AND erc.damage_status = 'good') as active_good_credits,
    
    (SELECT COUNT(*) FROM empty_return_credits erc 
     WHERE erc.customer_id = c.id AND erc.damage_status = 'damaged') as damaged_cylinders,
    
    (SELECT COUNT(*) FROM empty_return_credits erc 
     WHERE erc.customer_id = c.id AND erc.damage_status = 'lost') as lost_cylinders,
    
    (SELECT SUM(lost_cylinder_fee_amount) FROM empty_return_credits erc 
     WHERE erc.customer_id = c.id AND erc.damage_status = 'lost') as total_lost_fees,
    
    -- Risk indicators
    CASE 
        WHEN c.deposit_limit IS NOT NULL AND c.current_deposit_exposure > c.deposit_limit THEN 'over_limit'
        WHEN c.deposit_limit IS NOT NULL AND c.current_deposit_exposure > (c.deposit_limit * 0.9) THEN 'near_limit'
        WHEN c.current_deposit_exposure > 0 THEN 'normal'
        ELSE 'no_exposure'
    END as risk_level
    
FROM customers c
WHERE c.is_active = true;

-- =============================================================================
-- COMMENTS AND DOCUMENTATION
-- =============================================================================

-- Table comments
COMMENT ON TABLE cylinder_condition_history IS 'Comprehensive audit trail for cylinder condition changes, damage assessment, and disposition decisions';
COMMENT ON TABLE compliance_alerts IS 'Regulatory compliance alerts and tracking for cylinder safety requirements';

-- Column comments for empty_return_credits enhancements
COMMENT ON COLUMN empty_return_credits.damage_status IS 'Condition of returned cylinder: good, damaged, or lost';
COMMENT ON COLUMN empty_return_credits.lost_cylinder_fee_amount IS 'Fee charged for lost cylinders (typically full deposit amount)';
COMMENT ON COLUMN empty_return_credits.damage_report_notes IS 'Detailed notes about damage assessment and processing';
COMMENT ON COLUMN empty_return_credits.original_brand IS 'Brand of the original cylinder provided to customer';
COMMENT ON COLUMN empty_return_credits.accepted_brand IS 'Brand of the cylinder returned by customer (may differ for cross-brand acceptance)';
COMMENT ON COLUMN empty_return_credits.brand_reconciliation_status IS 'Status of cross-brand return reconciliation process';

-- Column comments for order_lines enhancements
COMMENT ON COLUMN order_lines.fill_percentage IS 'Percentage of full capacity filled (100% = full fill, <100% = partial fill)';
COMMENT ON COLUMN order_lines.is_partial_fill IS 'Flag indicating if this line item is a partial fill';
COMMENT ON COLUMN order_lines.partial_fill_notes IS 'Notes explaining reason for partial fill and any special handling';

-- Column comments for customers enhancements
COMMENT ON COLUMN customers.deposit_limit IS 'Maximum deposit exposure allowed for this customer (NULL = no limit)';
COMMENT ON COLUMN customers.current_deposit_exposure IS 'Current total deposit amount pending return from customer';
COMMENT ON COLUMN customers.deposit_limit_alerts_enabled IS 'Whether to send alerts when approaching deposit limit';

-- Function comments
COMMENT ON FUNCTION calculate_customer_deposit_exposure IS 'Calculate total outstanding deposit exposure for a customer';
COMMENT ON FUNCTION check_customer_deposit_limit IS 'Validate if additional deposit would exceed customer limit';
COMMENT ON FUNCTION process_damaged_lost_cylinder IS 'Process damage/loss claims with audit trail and fee calculation';
COMMENT ON FUNCTION generate_compliance_alerts IS 'Generate regulatory compliance alerts for overdue cylinders';
COMMENT ON FUNCTION validate_partial_fill IS 'Validate and record partial fill parameters for order lines';

-- View comments
COMMENT ON VIEW v_cylinder_compliance_dashboard IS 'Comprehensive dashboard view for cylinder regulatory compliance monitoring';
COMMENT ON VIEW v_customer_deposit_analysis IS 'Customer deposit exposure analysis with risk indicators and breakdown';

-- =============================================================================
-- GRANT PERMISSIONS
-- =============================================================================

-- Grant execute permissions on new functions
GRANT EXECUTE ON FUNCTION calculate_customer_deposit_exposure(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION update_customer_deposit_exposure(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION check_customer_deposit_limit(UUID, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION process_damaged_lost_cylinder(UUID, damage_status_enum, TEXT, NUMERIC, cylinder_disposition_enum, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION generate_compliance_alerts() TO authenticated;
GRANT EXECUTE ON FUNCTION validate_partial_fill(UUID, NUMERIC, TEXT) TO authenticated;

-- Grant permissions on new tables
GRANT SELECT, INSERT, UPDATE ON cylinder_condition_history TO authenticated;
GRANT SELECT, INSERT, UPDATE ON compliance_alerts TO authenticated;

-- Grant permissions on views
GRANT SELECT ON v_cylinder_compliance_dashboard TO authenticated;
GRANT SELECT ON v_customer_deposit_analysis TO authenticated;

COMMIT;

-- =============================================================================
-- VERIFICATION AND TESTING
-- =============================================================================

-- Verify new columns were added
SELECT 
    'Schema verification completed' as status,
    COUNT(*) as total_new_columns
FROM information_schema.columns 
WHERE table_name IN ('empty_return_credits', 'order_lines', 'customers', 'cylinder_assets')
  AND column_name IN (
    'damage_status', 'lost_cylinder_fee_amount', 'damage_report_notes',
    'original_brand', 'accepted_brand', 'brand_reconciliation_status',
    'fill_percentage', 'is_partial_fill', 'partial_fill_notes',
    'deposit_limit', 'current_deposit_exposure', 'deposit_limit_alerts_enabled',
    'compliance_status', 'regulatory_notes', 'damaged_cylinder_disposition'
  );

-- Verify new tables were created
SELECT 
    'New tables verification' as status,
    COUNT(*) as new_tables_count
FROM information_schema.tables 
WHERE table_name IN ('cylinder_condition_history', 'compliance_alerts')
  AND table_schema = 'public';

-- Verify new functions were created
SELECT 
    'New functions verification' as status,
    COUNT(*) as new_functions_count
FROM information_schema.routines 
WHERE routine_name IN (
    'calculate_customer_deposit_exposure',
    'update_customer_deposit_exposure', 
    'check_customer_deposit_limit',
    'process_damaged_lost_cylinder',
    'generate_compliance_alerts',
    'validate_partial_fill'
)
  AND routine_schema = 'public';

-- Verify new views were created
SELECT 
    'New views verification' as status,
    COUNT(*) as new_views_count
FROM information_schema.views 
WHERE table_name IN ('v_cylinder_compliance_dashboard', 'v_customer_deposit_analysis')
  AND table_schema = 'public';