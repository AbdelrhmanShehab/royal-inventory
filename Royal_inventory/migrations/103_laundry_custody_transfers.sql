-- Migration: 103_laundry_custody_transfers.sql
-- Description: Create audit log table for Uniform & Item custody reassignments between employees
-- Schema: ops

IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'ops.laundry_custody_transfers') AND type = 'U')
BEGIN
    CREATE TABLE ops.laundry_custody_transfers (
        transfer_id           INT IDENTITY(1,1) PRIMARY KEY,
        item_code             NVARCHAR(50)    NOT NULL,
        item_name             NVARCHAR(200)   NULL,
        from_zk_user_id       INT             NOT NULL,
        from_employee_name    NVARCHAR(150)   NULL,
        from_badge            NVARCHAR(50)    NULL,
        from_department       NVARCHAR(100)   NULL,
        to_zk_user_id         INT             NOT NULL,
        to_employee_name      NVARCHAR(150)   NULL,
        to_badge              NVARCHAR(50)    NULL,
        to_department         NVARCHAR(100)   NULL,
        user_item_id          INT             NULL,
        reason                NVARCHAR(500)   NULL,
        transferred_by        INT             NOT NULL, -- ops.app_users user_id
        transferred_by_name   NVARCHAR(100)   NULL,
        transferred_at        DATETIME2       NOT NULL DEFAULT GETDATE(),
        CONSTRAINT fk_custody_transfers_operator FOREIGN KEY (transferred_by) REFERENCES ops.app_users(user_id)
    );

    CREATE INDEX ix_custody_transfers_item ON ops.laundry_custody_transfers(item_code);
    CREATE INDEX ix_custody_transfers_from_user ON ops.laundry_custody_transfers(from_zk_user_id);
    CREATE INDEX ix_custody_transfers_to_user ON ops.laundry_custody_transfers(to_zk_user_id);
    CREATE INDEX ix_custody_transfers_date ON ops.laundry_custody_transfers(transferred_at DESC);

    PRINT '✅ Table [ops].[laundry_custody_transfers] created successfully';
END
ELSE
BEGIN
    PRINT '⚠️ Table [ops].[laundry_custody_transfers] already exists — skipped';
END
GO
