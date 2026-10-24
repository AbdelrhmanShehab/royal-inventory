-- Stable ZK identity for staff tickets. Badge numbers and names are reusable.
-- Existing tickets stay unlinked: never guess their owner from a badge/name.
IF COL_LENGTH('ops.laundry_tickets', 'zk_user_id') IS NULL
BEGIN
    ALTER TABLE ops.laundry_tickets ADD zk_user_id INT NULL;
END;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('ops.laundry_tickets') AND name = 'ix_laundry_tickets_zk_user')
    CREATE INDEX ix_laundry_tickets_zk_user ON ops.laundry_tickets(zk_user_id) WHERE zk_user_id IS NOT NULL;
GO
