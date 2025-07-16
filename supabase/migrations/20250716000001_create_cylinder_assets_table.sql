-- =============================================================================
-- CREATE CYLINDER ASSETS TABLE FOR SERIAL TRACKING AND COMPLIANCE
-- =============================================================================

-- Create cylinder_assets table for individual cylinder tracking
CREATE TABLE IF NOT EXISTS cylinder_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    serial_number VARCHAR(50) UNIQUE NOT NULL,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    
    -- Physical attributes
    tare_weight_kg DECIMAL(8,3), -- Individual tare weight (may differ from product specs)
    manufacturing_date DATE,
    manufacture_batch VARCHAR(50),
    
    -- Current status and condition
    current_condition VARCHAR(20) DEFAULT 'full' CHECK (current_condition IN ('full', 'empty', 'damaged', 'quarantine', 'under_maintenance')),
    current_location_type VARCHAR(20) DEFAULT 'warehouse' CHECK (current_location_type IN ('warehouse', 'truck', 'customer', 'supplier')),
    current_location_id UUID, -- References warehouse_id, truck_id, customer_id, or supplier_id
    
    -- Regulatory compliance
    last_pressure_test_date DATE,
    next_pressure_test_due DATE,
    pressure_test_interval_months INTEGER DEFAULT 60, -- 5 years standard
    last_inspection_date DATE,
    next_inspection_due DATE,
    inspection_interval_months INTEGER DEFAULT 12, -- Annual inspection
    certification_number VARCHAR(100),
    regulatory_status VARCHAR(20) DEFAULT 'compliant' CHECK (regulatory_status IN ('compliant', 'due_inspection', 'due_pressure_test', 'expired', 'failed')),
    
    -- Operational tracking
    total_fill_cycles INTEGER DEFAULT 0,
    last_fill_date DATE,
    last_empty_date DATE,
    is_active BOOLEAN DEFAULT true,
    retirement_date DATE,
    retirement_reason TEXT,
    
    -- Customer tracking (for outright sales)
    sold_to_customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    sale_date DATE,
    sale_order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID,
    updated_by UUID
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_cylinder_assets_serial_number ON cylinder_assets (serial_number);
CREATE INDEX IF NOT EXISTS idx_cylinder_assets_product_id ON cylinder_assets (product_id);
CREATE INDEX IF NOT EXISTS idx_cylinder_assets_warehouse_id ON cylinder_assets (warehouse_id);
CREATE INDEX IF NOT EXISTS idx_cylinder_assets_condition ON cylinder_assets (current_condition) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_cylinder_assets_location ON cylinder_assets (current_location_type, current_location_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_cylinder_assets_regulatory_status ON cylinder_assets (regulatory_status) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_cylinder_assets_pressure_test_due ON cylinder_assets (next_pressure_test_due) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_cylinder_assets_inspection_due ON cylinder_assets (next_inspection_due) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_cylinder_assets_customer ON cylinder_assets (sold_to_customer_id) WHERE sold_to_customer_id IS NOT NULL;

-- Create composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_cylinder_assets_warehouse_condition ON cylinder_assets (warehouse_id, current_condition) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_cylinder_assets_product_condition ON cylinder_assets (product_id, current_condition) WHERE is_active = true;

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_cylinder_assets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS trigger_update_cylinder_assets_updated_at ON cylinder_assets;
CREATE TRIGGER trigger_update_cylinder_assets_updated_at
    BEFORE UPDATE ON cylinder_assets
    FOR EACH ROW
    EXECUTE FUNCTION update_cylinder_assets_updated_at();

-- Function to automatically calculate next due dates
CREATE OR REPLACE FUNCTION calculate_cylinder_compliance_dates()
RETURNS TRIGGER AS $$
BEGIN
    -- Calculate next pressure test due date
    IF NEW.last_pressure_test_date IS NOT NULL AND NEW.pressure_test_interval_months IS NOT NULL THEN
        NEW.next_pressure_test_due = NEW.last_pressure_test_date + (NEW.pressure_test_interval_months || ' months')::INTERVAL;
    END IF;
    
    -- Calculate next inspection due date
    IF NEW.last_inspection_date IS NOT NULL AND NEW.inspection_interval_months IS NOT NULL THEN
        NEW.next_inspection_due = NEW.last_inspection_date + (NEW.inspection_interval_months || ' months')::INTERVAL;
    END IF;
    
    -- Update regulatory status based on due dates
    IF NEW.next_pressure_test_due IS NOT NULL AND NEW.next_pressure_test_due < CURRENT_DATE THEN
        NEW.regulatory_status = 'due_pressure_test';
    ELSIF NEW.next_inspection_due IS NOT NULL AND NEW.next_inspection_due < CURRENT_DATE THEN
        NEW.regulatory_status = 'due_inspection';
    ELSIF NEW.next_pressure_test_due IS NOT NULL AND NEW.next_pressure_test_due < CURRENT_DATE + INTERVAL '30 days' THEN
        NEW.regulatory_status = 'due_pressure_test';
    ELSIF NEW.next_inspection_due IS NOT NULL AND NEW.next_inspection_due < CURRENT_DATE + INTERVAL '30 days' THEN
        NEW.regulatory_status = 'due_inspection';
    ELSE
        NEW.regulatory_status = 'compliant';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically calculate compliance dates
DROP TRIGGER IF EXISTS trigger_calculate_cylinder_compliance_dates ON cylinder_assets;
CREATE TRIGGER trigger_calculate_cylinder_compliance_dates
    BEFORE INSERT OR UPDATE ON cylinder_assets
    FOR EACH ROW
    EXECUTE FUNCTION calculate_cylinder_compliance_dates();

-- Create view for cylinder assets with product information
CREATE OR REPLACE VIEW cylinder_assets_detailed AS
SELECT 
    ca.*,
    p.name as product_name,
    p.sku as product_sku,
    p.sku_variant,
    p.capacity_kg as product_capacity_kg,
    p.tare_weight_kg as product_tare_weight_kg,
    w.name as warehouse_name,
    w.code as warehouse_code,
    c.name as customer_name,
    c.code as customer_code,
    -- Calculated fields
    CASE 
        WHEN ca.next_pressure_test_due < CURRENT_DATE THEN 'overdue'
        WHEN ca.next_pressure_test_due < CURRENT_DATE + INTERVAL '30 days' THEN 'due_soon'
        ELSE 'current'
    END as pressure_test_status,
    CASE 
        WHEN ca.next_inspection_due < CURRENT_DATE THEN 'overdue'
        WHEN ca.next_inspection_due < CURRENT_DATE + INTERVAL '30 days' THEN 'due_soon'
        ELSE 'current'
    END as inspection_status,
    -- Days until next compliance requirement
    ca.next_pressure_test_due - CURRENT_DATE as days_until_pressure_test,
    ca.next_inspection_due - CURRENT_DATE as days_until_inspection
FROM cylinder_assets ca
LEFT JOIN products p ON ca.product_id = p.id
LEFT JOIN warehouses w ON ca.warehouse_id = w.id
LEFT JOIN customers c ON ca.sold_to_customer_id = c.id
WHERE ca.is_active = true;

-- Add comments for documentation
COMMENT ON TABLE cylinder_assets IS 'Individual cylinder tracking for serial numbers, compliance, and lifecycle management';
COMMENT ON COLUMN cylinder_assets.serial_number IS 'Unique serial number stamped on the cylinder';
COMMENT ON COLUMN cylinder_assets.current_condition IS 'Current physical condition: full, empty, damaged, quarantine, under_maintenance';
COMMENT ON COLUMN cylinder_assets.current_location_type IS 'Type of location where cylinder is currently located';
COMMENT ON COLUMN cylinder_assets.current_location_id IS 'ID of the specific location (warehouse, truck, customer, supplier)';
COMMENT ON COLUMN cylinder_assets.regulatory_status IS 'Compliance status: compliant, due_inspection, due_pressure_test, expired, failed';
COMMENT ON COLUMN cylinder_assets.total_fill_cycles IS 'Total number of times this cylinder has been filled';
COMMENT ON COLUMN cylinder_assets.pressure_test_interval_months IS 'Interval in months between pressure tests (typically 60 months)';
COMMENT ON COLUMN cylinder_assets.inspection_interval_months IS 'Interval in months between inspections (typically 12 months)';

-- Create RLS policies (if RLS is enabled)
-- ALTER TABLE cylinder_assets ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Users can view cylinder assets" ON cylinder_assets FOR SELECT USING (true);
-- CREATE POLICY "Users can manage cylinder assets" ON cylinder_assets FOR ALL USING (true);