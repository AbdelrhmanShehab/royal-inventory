-- Migration 008: Performance Optimizations & Database Integrity
-- Adds Staging Warehouses table, unique constraints, check constraints, and performance nonclustered indexes.

USE InventoryOps;
GO

-- ── 1. Create Staging Table for Warehouses ───────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'ops.comsys_warehouses_staging') AND type = 'U')
BEGIN
    CREATE TABLE ops.comsys_warehouses_staging (
        store_code      NVARCHAR(50)    NOT NULL,
        store_name_ar   NVARCHAR(200)   NOT NULL,
        store_name_en   NVARCHAR(200)   NULL,
        is_active       BIT             NOT NULL
    );
    PRINT '✅ Table [ops].[comsys_warehouses_staging] created';
END
ELSE
    PRINT '⚠️  Table [ops].[comsys_warehouses_staging] already exists — skipped';
GO

-- ── 2. Add Constraint to Prevent Negative Stock (Race Conditions Protection) ─
IF NOT EXISTS (
    SELECT 1 FROM sys.check_constraints 
    WHERE parent_object_id = OBJECT_ID('ops.operational_stock') AND name = 'chk_positive_qty'
)
BEGIN
    ALTER TABLE ops.operational_stock 
        ADD CONSTRAINT chk_positive_qty CHECK (qty_operational >= 0);
    PRINT '✅ Constraint [chk_positive_qty] (qty_operational >= 0) added to [ops].[operational_stock]';
END
ELSE
    PRINT '⚠️  Constraint [chk_positive_qty] already exists — skipped';
GO

-- ── 3. Performance Indexes ──────────────────────────────────────────────────

-- A. Index for operational_stock on node_id & item_code (very common join & filter)
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes 
    WHERE object_id = OBJECT_ID('ops.operational_stock') AND name = 'ix_stock_node_item'
)
BEGIN
    CREATE NONCLUSTERED INDEX ix_stock_node_item 
        ON ops.operational_stock (node_id, item_code)
        INCLUDE (qty_operational);
    PRINT '✅ Index [ix_stock_node_item] created';
END
GO

-- B. Index for comsys_items on division
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes 
    WHERE object_id = OBJECT_ID('ops.comsys_items') AND name = 'ix_comsys_items_division'
)
BEGIN
    CREATE NONCLUSTERED INDEX ix_comsys_items_division 
        ON ops.comsys_items (division)
        INCLUDE (item_code, item_name_ar, unit_name_ar);
    PRINT '✅ Index [ix_comsys_items_division] created';
END
GO

-- C. Index for comsys_warehouses on store_code & division
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes 
    WHERE object_id = OBJECT_ID('ops.comsys_warehouses') AND name = 'ix_comsys_warehouses_code_div'
)
BEGIN
    CREATE NONCLUSTERED INDEX ix_comsys_warehouses_code_div 
        ON ops.comsys_warehouses (store_code, division);
    PRINT '✅ Index [ix_comsys_warehouses_code_div] created';
END
GO

-- D. Index for inventory_nodes on comsys_store_code & division
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes 
    WHERE object_id = OBJECT_ID('ops.inventory_nodes') AND name = 'ix_inventory_nodes_comsys_div'
)
BEGIN
    CREATE NONCLUSTERED INDEX ix_inventory_nodes_comsys_div 
        ON ops.inventory_nodes (comsys_store_code, division)
        INCLUDE (node_id);
    PRINT '✅ Index [ix_inventory_nodes_comsys_div] created';
END
GO
