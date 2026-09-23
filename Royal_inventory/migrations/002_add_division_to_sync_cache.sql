-- Migration: Add division column to sync cache tables
USE InventoryOps;
GO

-- 1. Add division to comsys_warehouses
IF NOT EXISTS (
    SELECT 1 FROM sys.columns 
    WHERE object_id = OBJECT_ID('ops.comsys_warehouses') AND name = 'division'
)
BEGIN
    ALTER TABLE ops.comsys_warehouses ADD division NVARCHAR(10) NOT NULL DEFAULT 'fb';
    PRINT '✅ Column [division] added to [ops].[comsys_warehouses]';
END
ELSE
    PRINT '⚠️  Column [division] already exists in [ops].[comsys_warehouses]';
GO

-- 2. Add division to comsys_items
IF NOT EXISTS (
    SELECT 1 FROM sys.columns 
    WHERE object_id = OBJECT_ID('ops.comsys_items') AND name = 'division'
)
BEGIN
    ALTER TABLE ops.comsys_items ADD division NVARCHAR(10) NOT NULL DEFAULT 'fb';
    PRINT '✅ Column [division] added to [ops].[comsys_items]';
END
ELSE
    PRINT '⚠️  Column [division] already exists in [ops].[comsys_items]';
GO

-- 3. Drop the unique constraint uq_item_code on comsys_items and recreate it as composite (item_code, division)
-- to allow the same item code to exist in both fb and gs divisions.
IF EXISTS (
    SELECT 1 FROM sys.objects 
    WHERE name = 'uq_item_code' AND parent_object_id = OBJECT_ID('ops.comsys_items')
)
BEGIN
    ALTER TABLE ops.comsys_items DROP CONSTRAINT uq_item_code;
    PRINT '✅ Dropped constraint [uq_item_code]';
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.objects 
    WHERE name = 'uq_item_code_division' AND parent_object_id = OBJECT_ID('ops.comsys_items')
)
BEGIN
    ALTER TABLE ops.comsys_items ADD CONSTRAINT uq_item_code_division UNIQUE (item_code, division);
    PRINT '✅ Added composite constraint [uq_item_code_division]';
END
GO

-- 4. Drop unique constraint uq_store_code on comsys_warehouses and recreate as composite (store_code, division)
IF EXISTS (
    SELECT 1 FROM sys.objects 
    WHERE name = 'uq_store_code' AND parent_object_id = OBJECT_ID('ops.comsys_warehouses')
)
BEGIN
    ALTER TABLE ops.comsys_warehouses DROP CONSTRAINT uq_store_code;
    PRINT '✅ Dropped constraint [uq_store_code]';
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.objects 
    WHERE name = 'uq_store_code_division' AND parent_object_id = OBJECT_ID('ops.comsys_warehouses')
)
BEGIN
    ALTER TABLE ops.comsys_warehouses ADD CONSTRAINT uq_store_code_division UNIQUE (store_code, division);
    PRINT '✅ Added composite constraint [uq_store_code_division]';
END
GO
