-- ==============================================================================
-- Migration: Add advanced production and capacity planning to laundry module
-- ==============================================================================

USE InventoryOps;
GO

-- 1. Expand laundry_machine_programs table
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'ops.laundry_machine_programs') AND name = N'recommended_capacity')
BEGIN
    ALTER TABLE ops.laundry_machine_programs ADD
        recommended_capacity   DECIMAL(18,2)   NULL,
        maximum_capacity       DECIMAL(18,2)   NULL,
        recipe_id              INT             NULL,
        duration_mins          INT             NULL,
        temperature_c          DECIMAL(18,2)   NULL,
        water_level_liters     DECIMAL(18,2)   NULL,
        spin_speed_rpm         INT             NULL;

    ALTER TABLE ops.laundry_machine_programs
        ADD CONSTRAINT fk_programs_recipe FOREIGN KEY (recipe_id) REFERENCES ops.laundry_recipes(recipe_id) ON DELETE SET NULL;

    PRINT '✅ Table [ops].[laundry_machine_programs] expanded with capacity fields';
END
GO

-- 2. Expand laundry_batches table
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'ops.laundry_batches') AND name = N'run_type')
BEGIN
    ALTER TABLE ops.laundry_batches ADD
        run_type        NVARCHAR(20)    NOT NULL DEFAULT 'PROGRAM'
                        CONSTRAINT chk_run_type CHECK (run_type IN ('PROGRAM', 'MANUAL', 'HYBRID')),
        guest_weight    DECIMAL(18,2)   NOT NULL DEFAULT 0.00,
        staff_weight    DECIMAL(18,2)   NOT NULL DEFAULT 0.00,
        special_weight  DECIMAL(18,2)   NOT NULL DEFAULT 0.00,
        spot_weight     DECIMAL(18,2)   NOT NULL DEFAULT 0.00;

    PRINT '✅ Table [ops].[laundry_batches] expanded with run_type and segmented weights';
END
GO

-- 3. Expand comsys_items table for chemical classifications
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'ops.comsys_items') AND name = N'chemical_classification')
BEGIN
    ALTER TABLE ops.comsys_items ADD
        chemical_classification NVARCHAR(30)    NULL
                                CONSTRAINT chk_chemical_class CHECK (chemical_classification IN ('production', 'maintenance'));

    PRINT '✅ Table [ops].[comsys_items] expanded with chemical_classification';
END
GO

-- 4. Seed classifications for standard items
UPDATE ops.comsys_items 
SET chemical_classification = 'production' 
WHERE item_code LIKE 'CHEM-%';

-- Add a maintenance chemical for testing
IF NOT EXISTS (SELECT 1 FROM ops.comsys_items WHERE item_code = 'CHEM-MAINT-001')
BEGIN
    INSERT INTO ops.comsys_items (item_code, item_name_ar, item_name_en, category_code, unit_code, unit_name_ar, item_type, chemical_classification, is_active)
    VALUES ('CHEM-MAINT-001', 'مادة تنظيف وصيانة الغسالات', 'Machine Descaler Cleaner', 'CHEM', 'LITER', 'لتر', 'consumable', 'maintenance', 1);
END
GO
