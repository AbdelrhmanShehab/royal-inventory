-- ==============================================================================
-- Migration: Create tables for the Operational Distribution Layer
-- Schema: ops
-- ==============================================================================

USE InventoryOps;
GO

-- 1. Create ops.operational_locations table (if not exists)
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'ops.operational_locations') AND type = 'U')
BEGIN
    CREATE TABLE ops.operational_locations (
        id              INT             IDENTITY(1,1) PRIMARY KEY,
        tenant_id       INT             NOT NULL DEFAULT 1,
        node_id         INT             NOT NULL,
        name            NVARCHAR(100)   NOT NULL,
        description     NVARCHAR(500)   NULL,
        is_active       BIT             NOT NULL DEFAULT 1,
        display_order   INT             NOT NULL DEFAULT 0,
        created_at      DATETIME2       NOT NULL DEFAULT GETDATE(),
        updated_at      DATETIME2       NOT NULL DEFAULT GETDATE(),
        
        CONSTRAINT fk_op_loc_node FOREIGN KEY (node_id) REFERENCES ops.inventory_nodes(node_id)
    );

    CREATE INDEX ix_op_loc_node_id ON ops.operational_locations(node_id);
    CREATE INDEX ix_op_loc_tenant   ON ops.operational_locations(tenant_id, node_id);

    PRINT '✅ Table [ops].[operational_locations] created';
END
ELSE
    PRINT '⚠️ Table [ops].[operational_locations] already exists — skipped';
GO

-- 2. Create ops.operational_transactions table (if not exists)
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'ops.operational_transactions') AND type = 'U')
BEGIN
    CREATE TABLE ops.operational_transactions (
        id                      INT             IDENTITY(1,1) PRIMARY KEY,
        tenant_id               INT             NOT NULL DEFAULT 1,
        node_id                 INT             NOT NULL,
        location_id             INT             NOT NULL,
        item_code               NVARCHAR(50)    NOT NULL,
        transaction_type        NVARCHAR(20)    NOT NULL,
        quantity                DECIMAL(18,4)   NOT NULL,
        notes                   NVARCHAR(500)   NULL,
        reference_type          NVARCHAR(50)    NULL,
        reference_id            NVARCHAR(100)   NULL,
        created_by              INT             NOT NULL,
        created_at              DATETIME2       NOT NULL DEFAULT GETDATE(),

        CONSTRAINT fk_op_txn_node      FOREIGN KEY (node_id)     REFERENCES ops.inventory_nodes(node_id),
        CONSTRAINT fk_op_txn_location  FOREIGN KEY (location_id)  REFERENCES ops.operational_locations(id),
        CONSTRAINT fk_op_txn_user      FOREIGN KEY (created_by)   REFERENCES ops.app_users(user_id),
        CONSTRAINT chk_op_txn_type     CHECK (transaction_type IN ('ALLOCATE', 'CONSUME', 'RETURN', 'ADJUSTMENT')),
        CONSTRAINT chk_op_txn_qty      CHECK (quantity > 0 OR (transaction_type = 'ADJUSTMENT' AND quantity <> 0))
    );

    CREATE INDEX ix_op_txn_location ON ops.operational_transactions(location_id, item_code);
    CREATE INDEX ix_op_txn_node     ON ops.operational_transactions(node_id, item_code);
    CREATE INDEX ix_op_txn_type     ON ops.operational_transactions(transaction_type);
    CREATE INDEX ix_op_txn_date     ON ops.operational_transactions(created_at);

    PRINT '✅ Table [ops].[operational_transactions] created';
END
ELSE
    PRINT '⚠️ Table [ops].[operational_transactions] already exists — skipped';
GO
