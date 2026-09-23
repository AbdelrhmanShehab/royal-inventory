-- Migration: Create staging tables for bulk sync operations
USE InventoryOps;
GO

-- 1. Create ops.comsys_items_staging table
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'ops.comsys_items_staging') AND type = 'U')
BEGIN
    CREATE TABLE ops.comsys_items_staging (
        item_code       NVARCHAR(50)    NOT NULL,
        item_name_ar    NVARCHAR(200)   NOT NULL,
        item_name_en    NVARCHAR(200)   NULL,
        category_code   NVARCHAR(50)    NULL,
        unit_code       NVARCHAR(20)    NULL,
        unit_name_ar    NVARCHAR(50)    NULL,
        is_active       BIT             NOT NULL
    );
    PRINT '✅ Table [ops].[comsys_items_staging] created';
END
ELSE
    PRINT '⚠️  Table [ops].[comsys_items_staging] already exists — skipped';
GO

-- 2. Create ops.comsys_balances_staging table
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'ops.comsys_balances_staging') AND type = 'U')
BEGIN
    CREATE TABLE ops.comsys_balances_staging (
        store_code      NVARCHAR(50)    NULL,
        division        NVARCHAR(10)    NULL,
        item_code       NVARCHAR(50)    NULL,
        qty             DECIMAL(18,4)   NULL
    );
    PRINT '✅ Table [ops].[comsys_balances_staging] created';
END
ELSE
    PRINT '⚠️  Table [ops].[comsys_balances_staging] already exists — skipped';
GO
