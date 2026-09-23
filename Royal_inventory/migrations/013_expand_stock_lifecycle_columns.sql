-- ==============================================================================
-- Migration 013: Expand Operational Stock Ledger for Full Item Lifecycle Tracking
-- Enables direct tracking for:
--   - qty_laundry (items currently out at laundry)
--   - qty_returned_out (items returned to main store / supplier)
-- Ensures the fundamental inventory conservation identity holds across the app:
--   qty_received + qty_internal_in =
--     qty_operational + qty_transferred_out + qty_laundry + qty_returned_out + qty_consumed + (qty_damaged + qty_wasted + qty_disposed)
-- ==============================================================================

USE InventoryOps;
GO

-- 1. Drop check constraint and index dependent on qty_operational
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'chk_positive_qty' AND parent_object_id = OBJECT_ID('ops.operational_stock'))
BEGIN
    ALTER TABLE ops.operational_stock DROP CONSTRAINT chk_positive_qty;
    PRINT '✅ Dropped constraint chk_positive_qty';
END
GO

IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_stock_node_item' AND object_id = OBJECT_ID('ops.operational_stock'))
BEGIN
    DROP INDEX ix_stock_node_item ON ops.operational_stock;
    PRINT '✅ Dropped index ix_stock_node_item';
END
GO

-- 2. Drop computed column
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('ops.operational_stock') AND name = 'qty_operational')
BEGIN
    ALTER TABLE ops.operational_stock DROP COLUMN qty_operational;
    PRINT '✅ Dropped computed column qty_operational';
END
GO

-- 3. Add dedicated columns for laundry and returns out
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('ops.operational_stock') AND name = 'qty_laundry')
BEGIN
    ALTER TABLE ops.operational_stock ADD qty_laundry DECIMAL(18,4) NOT NULL DEFAULT 0;
    PRINT '✅ Added column qty_laundry';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('ops.operational_stock') AND name = 'qty_returned_out')
BEGIN
    ALTER TABLE ops.operational_stock ADD qty_returned_out DECIMAL(18,4) NOT NULL DEFAULT 0;
    PRINT '✅ Added column qty_returned_out';
END
GO

-- 4. Recreate computed column qty_operational incorporating all outflow channels
ALTER TABLE ops.operational_stock ADD qty_operational AS (
    (qty_received + qty_internal_in + qty_returned_in)
    - (qty_consumed + qty_damaged + qty_wasted + qty_disposed + qty_transferred_out + qty_laundry + qty_returned_out)
) PERSISTED;
PRINT '✅ Recreated computed column qty_operational';
GO

-- 5. Recreate index and positive quantity check
CREATE INDEX ix_stock_node_item ON ops.operational_stock (node_id, item_code, qty_operational);
ALTER TABLE ops.operational_stock ADD CONSTRAINT chk_positive_qty CHECK (qty_operational >= 0);
PRINT '✅ Recreated index ix_stock_node_item and constraint chk_positive_qty';
GO
