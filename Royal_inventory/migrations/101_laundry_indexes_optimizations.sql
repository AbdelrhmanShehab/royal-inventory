-- ==============================================================================
-- Migration: Add nonclustered indexes to foreign keys in laundry tables
-- ==============================================================================

USE InventoryOps;
GO

-- Index on ops.laundry_batch_items(batch_id)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('ops.laundry_batch_items') AND name = 'ix_laundry_batch_items_batch')
BEGIN
    CREATE NONCLUSTERED INDEX ix_laundry_batch_items_batch 
        ON ops.laundry_batch_items (batch_id)
        INCLUDE (item_code, quantity, role);
    PRINT '✅ Index [ix_laundry_batch_items_batch] created';
END
GO

-- Index on ops.laundry_transfer_items(transfer_id)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('ops.laundry_transfer_items') AND name = 'ix_laundry_transfer_items_transfer')
BEGIN
    CREATE NONCLUSTERED INDEX ix_laundry_transfer_items_transfer 
        ON ops.laundry_transfer_items (transfer_id)
        INCLUDE (item_code, sent_qty, received_qty, remaining_qty);
    PRINT '✅ Index [ix_laundry_transfer_items_transfer] created';
END
GO

-- Index on ops.laundry_receiving_items(receiving_id)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('ops.laundry_receiving_items') AND name = 'ix_laundry_receiving_items_receiving')
BEGIN
    CREATE NONCLUSTERED INDEX ix_laundry_receiving_items_receiving 
        ON ops.laundry_receiving_items (receiving_id)
        INCLUDE (item_code, expected_qty, actual_qty, rejected_qty);
    PRINT '✅ Index [ix_laundry_receiving_items_receiving] created';
END
GO

-- Index on ops.laundry_return_items(return_id)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('ops.laundry_return_items') AND name = 'ix_laundry_return_items_return')
BEGIN
    CREATE NONCLUSTERED INDEX ix_laundry_return_items_return 
        ON ops.laundry_return_items (return_id)
        INCLUDE (item_code, expected_qty, actual_qty, rejected_qty);
    PRINT '✅ Index [ix_laundry_return_items_return] created';
END
GO

-- Index on ops.laundry_consumptions(batch_id)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('ops.laundry_consumptions') AND name = 'ix_laundry_consumptions_batch')
BEGIN
    CREATE NONCLUSTERED INDEX ix_laundry_consumptions_batch 
        ON ops.laundry_consumptions (batch_id)
        INCLUDE (chemical_item_code, actual_qty);
    PRINT '✅ Index [ix_laundry_consumptions_batch] created';
END
GO
