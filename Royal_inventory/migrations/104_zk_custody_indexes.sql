-- ==============================================================================
-- Migration: 104_zk_custody_indexes.sql
-- Description: Create high-performance nonclustered indexes for Uniform Custody
--              and Handover/Receive transaction tables in Zktime & InventoryOps.
-- Target DB: Zktime (on 192.168.50.10) & InventoryOps (on 192.168.50.5)
-- ==============================================================================

-- ── 1. ZKTIME DATABASE INDEXES ──────────────────────────────────────────────
USE Zktime;
GO

-- A. CRITICAL: Composite index on ItemTransactions for instant LAST ACTION lookups
-- This eliminates full table scans and sorts during custody directory queries.
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.ItemTransactions') AND name = 'ix_ItemTransactions_UserItem_Date')
BEGIN
    CREATE NONCLUSTERED INDEX ix_ItemTransactions_UserItem_Date 
        ON dbo.ItemTransactions (UserItemID, TransactionDate DESC, TransactionID DESC) 
        INCLUDE (TransactionType, HandledBy, Notes);
    PRINT '✅ Index [ix_ItemTransactions_UserItem_Date] created on dbo.ItemTransactions';
END
ELSE
    PRINT '⚠️ Index [ix_ItemTransactions_UserItem_Date] already exists';
GO

-- B. Index on UserItems(ItemCode) for instant barcode search & custody transfers
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.UserItems') AND name = 'ix_UserItems_ItemCode')
BEGIN
    CREATE NONCLUSTERED INDEX ix_UserItems_ItemCode 
        ON dbo.UserItems (ItemCode) 
        INCLUDE (UserID, ItemID, AssignedDate);
    PRINT '✅ Index [ix_UserItems_ItemCode] created on dbo.UserItems';
END
ELSE
    PRINT '⚠️ Index [ix_UserItems_ItemCode] already exists';
GO

-- C. Index on UserItems(UserID) for instant employee custody lookups
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.UserItems') AND name = 'ix_UserItems_UserID')
BEGIN
    CREATE NONCLUSTERED INDEX ix_UserItems_UserID 
        ON dbo.UserItems (UserID) 
        INCLUDE (ItemID, ItemCode, AssignedDate);
    PRINT '✅ Index [ix_UserItems_UserID] created on dbo.UserItems';
END
ELSE
    PRINT '⚠️ Index [ix_UserItems_UserID] already exists';
GO

-- D. Index on USERINFO(BADGENUMBER) for rapid employee search by badge
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.USERINFO') AND name = 'ix_USERINFO_Badge')
BEGIN
    CREATE NONCLUSTERED INDEX ix_USERINFO_Badge 
        ON dbo.USERINFO (BADGENUMBER) 
        INCLUDE (NAME, DEFAULTDEPTID, TITLE);
    PRINT '✅ Index [ix_USERINFO_Badge] created on dbo.USERINFO';
END
ELSE
    PRINT '⚠️ Index [ix_USERINFO_Badge] already exists';
GO

-- E. Index on USERINFO(NAME) for rapid employee search by name
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.USERINFO') AND name = 'ix_USERINFO_Name')
BEGIN
    CREATE NONCLUSTERED INDEX ix_USERINFO_Name 
        ON dbo.USERINFO (NAME) 
        INCLUDE (BADGENUMBER, DEFAULTDEPTID, TITLE);
    PRINT '✅ Index [ix_USERINFO_Name] created on dbo.USERINFO';
END
ELSE
    PRINT '⚠️ Index [ix_USERINFO_Name] already exists';
GO

-- ── 2. INVENTORYOPS DATABASE INDEXES ────────────────────────────────────────
USE InventoryOps;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('ops.laundry_custody_transfers') AND name = 'ix_custody_transfers_composite')
BEGIN
    CREATE NONCLUSTERED INDEX ix_custody_transfers_composite 
        ON ops.laundry_custody_transfers (transferred_at DESC) 
        INCLUDE (transfer_id, item_code, item_name, from_zk_user_id, to_zk_user_id, transferred_by);
    PRINT '✅ Index [ix_custody_transfers_composite] created on ops.laundry_custody_transfers';
END
ELSE
    PRINT '⚠️ Index [ix_custody_transfers_composite] already exists';
GO
