-- Create accessory_categories table
CREATE TABLE IF NOT EXISTS accessory_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create accessories table
CREATE TABLE IF NOT EXISTS accessories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    sku VARCHAR(100) NOT NULL UNIQUE,
    category_id UUID REFERENCES accessory_categories(id) ON DELETE SET NULL,
    price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    vat_code VARCHAR(50) NOT NULL DEFAULT 'standard',
    deposit_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    is_serialized BOOLEAN NOT NULL DEFAULT FALSE,
    saleable BOOLEAN NOT NULL DEFAULT TRUE,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_accessories_sku ON accessories(sku);
CREATE INDEX IF NOT EXISTS idx_accessories_category_id ON accessories(category_id);
CREATE INDEX IF NOT EXISTS idx_accessories_active ON accessories(active);
CREATE INDEX IF NOT EXISTS idx_accessories_saleable ON accessories(saleable);
CREATE INDEX IF NOT EXISTS idx_accessories_created_at ON accessories(created_at);

CREATE INDEX IF NOT EXISTS idx_accessory_categories_slug ON accessory_categories(slug);
CREATE INDEX IF NOT EXISTS idx_accessory_categories_name ON accessory_categories(name);

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_accessories_updated_at 
    BEFORE UPDATE ON accessories 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_accessory_categories_updated_at 
    BEFORE UPDATE ON accessory_categories 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert some default accessory categories
INSERT INTO accessory_categories (name, slug, description) VALUES
    ('Gas Regulators', 'gas-regulators', 'Pressure regulators for gas cylinders'),
    ('Hoses & Fittings', 'hoses-fittings', 'Gas hoses and connection fittings'),
    ('Safety Equipment', 'safety-equipment', 'Safety devices and protective equipment'),
    ('Tools & Equipment', 'tools-equipment', 'Maintenance and installation tools'),
    ('Consumables', 'consumables', 'Disposable items and consumable supplies')
ON CONFLICT (slug) DO NOTHING;

-- Insert some sample accessories
INSERT INTO accessories (name, sku, category_id, price, vat_code, description) VALUES
    ('Dual-stage Regulator', 'ACC-REG-001', (SELECT id FROM accessory_categories WHERE slug = 'gas-regulators'), 45.00, 'standard', 'High-quality dual-stage gas regulator'),
    ('Gas Hose 5m', 'ACC-HOSE-001', (SELECT id FROM accessory_categories WHERE slug = 'hoses-fittings'), 25.00, 'standard', '5-meter gas hose with fittings'),
    ('Safety Gloves', 'ACC-SAFETY-001', (SELECT id FROM accessory_categories WHERE slug = 'safety-equipment'), 15.00, 'standard', 'Heat-resistant safety gloves'),
    ('Cylinder Wrench', 'ACC-TOOL-001', (SELECT id FROM accessory_categories WHERE slug = 'tools-equipment'), 8.50, 'standard', 'Specialized wrench for cylinder connections'),
    ('Thread Seal Tape', 'ACC-CONSUMABLE-001', (SELECT id FROM accessory_categories WHERE slug = 'consumables'), 2.00, 'standard', 'PTFE thread seal tape')
ON CONFLICT (sku) DO NOTHING; 