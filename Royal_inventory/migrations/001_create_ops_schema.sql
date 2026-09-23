-- ==============================================================================
-- Migration: Create ops schema and all system tables inside FHtlPTrain
-- Run once before starting the application
-- Schema: ops  (our tables)
-- Schema: dbo  (Comsys tables — NOT touched here)
-- ==============================================================================

USE InventoryOps;
GO

-- ── 1. Create ops schema (if not exists) ────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'ops')
BEGIN
    EXEC('CREATE SCHEMA ops');
    PRINT '✅ Schema [ops] created';
END
ELSE
    PRINT '⚠️  Schema [ops] already exists — skipped';
GO

-- ==============================================================================
-- 2. USERS & AUTH
-- ==============================================================================

IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'ops.app_users') AND type = 'U')
BEGIN
    CREATE TABLE ops.app_users (
        user_id             INT             IDENTITY(1,1) PRIMARY KEY,
        username            NVARCHAR(50)    NOT NULL,
        full_name_ar        NVARCHAR(100)   NOT NULL,
        password_hash       NVARCHAR(255)   NOT NULL,
        role                NVARCHAR(20)    NOT NULL DEFAULT 'operator'
                            CONSTRAINT chk_role CHECK (role IN ('admin','manager','operator','viewer')),
        node_id             INT             NULL,       -- FK added after ops.inventory_nodes
        is_active           BIT             NOT NULL DEFAULT 1,
        last_login_at       DATETIME2       NULL,
        failed_attempts     INT             NOT NULL DEFAULT 0,
        locked_until        DATETIME2       NULL,
        password_changed_at DATETIME2       NULL,
        created_at          DATETIME2       NOT NULL DEFAULT GETDATE(),
        updated_at          DATETIME2       NOT NULL DEFAULT GETDATE(),
        CONSTRAINT uq_username UNIQUE (username)
    );
    PRINT '✅ Table [ops].[app_users] created';
END
ELSE
    PRINT '⚠️  Table [ops].[app_users] already exists — skipped';
GO

-- ==============================================================================
-- 3. HOTEL GROUPS (Top-level grouping)
-- ==============================================================================

IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'ops.hotel_groups') AND type = 'U')
BEGIN
    CREATE TABLE ops.hotel_groups (
        group_id        INT             IDENTITY(1,1) PRIMARY KEY,
        group_name_ar   NVARCHAR(100)   NOT NULL,
        group_name_en   NVARCHAR(100)   NULL,
        group_code      NVARCHAR(20)    NOT NULL,
        is_active       BIT             NOT NULL DEFAULT 1,
        created_at      DATETIME2       NOT NULL DEFAULT GETDATE(),
        CONSTRAINT uq_group_code UNIQUE (group_code)
    );
    PRINT '✅ Table [ops].[hotel_groups] created';
END
ELSE
    PRINT '⚠️  Table [ops].[hotel_groups] already exists — skipped';
GO

-- ==============================================================================
-- 4. INVENTORY NODES (Hierarchy — maps to Comsys warehouses)
-- ==============================================================================

IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'ops.inventory_nodes') AND type = 'U')
BEGIN
    CREATE TABLE ops.inventory_nodes (
        node_id             INT             IDENTITY(1,1) PRIMARY KEY,
        -- Link to Comsys warehouse (NULL for parent/group nodes)
        comsys_store_code   NVARCHAR(50)    NULL,       -- matches dbo warehouse code
        group_id            INT             NOT NULL,
        parent_node_id      INT             NULL,        -- self-reference for hierarchy
        node_name_ar        NVARCHAR(100)   NOT NULL,
        node_type           NVARCHAR(20)    NOT NULL DEFAULT 'child'
                            CONSTRAINT chk_node_type CHECK (node_type IN ('parent','child')),
        manager_name        NVARCHAR(100)   NULL,
        is_active           BIT             NOT NULL DEFAULT 1,
        created_at          DATETIME2       NOT NULL DEFAULT GETDATE(),
        updated_at          DATETIME2       NOT NULL DEFAULT GETDATE(),

        CONSTRAINT fk_node_group  FOREIGN KEY (group_id)       REFERENCES ops.hotel_groups(group_id),
        CONSTRAINT fk_node_parent FOREIGN KEY (parent_node_id) REFERENCES ops.inventory_nodes(node_id)
    );

    -- Index for tree traversal
    CREATE INDEX ix_nodes_parent   ON ops.inventory_nodes(parent_node_id);
    CREATE INDEX ix_nodes_group    ON ops.inventory_nodes(group_id);
    CREATE INDEX ix_nodes_comsys   ON ops.inventory_nodes(comsys_store_code);

    PRINT '✅ Table [ops].[inventory_nodes] created';
END
ELSE
    PRINT '⚠️  Table [ops].[inventory_nodes] already exists — skipped';
GO

-- Add FK from app_users → inventory_nodes (now that nodes table exists)
IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE name = 'fk_users_node' AND parent_object_id = OBJECT_ID('ops.app_users')
)
BEGIN
    ALTER TABLE ops.app_users
        ADD CONSTRAINT fk_users_node
        FOREIGN KEY (node_id) REFERENCES ops.inventory_nodes(node_id);
    PRINT '✅ FK [ops].[app_users] → [ops].[inventory_nodes] added';
END
GO

-- ==============================================================================
-- 5. COMSYS SYNC CACHE (local copy of Comsys master data)
-- ==============================================================================

-- Items cache (synced from dbo)
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'ops.comsys_items') AND type = 'U')
BEGIN
    CREATE TABLE ops.comsys_items (
        item_id         INT             IDENTITY(1,1) PRIMARY KEY,
        item_code       NVARCHAR(50)    NOT NULL,
        item_name_ar    NVARCHAR(200)   NOT NULL,
        item_name_en    NVARCHAR(200)   NULL,
        category_code   NVARCHAR(50)    NULL,
        unit_code       NVARCHAR(20)    NULL,
        unit_name_ar    NVARCHAR(50)    NULL,
        item_type       NVARCHAR(20)    NOT NULL DEFAULT 'consumable'
                        CONSTRAINT chk_item_type CHECK (item_type IN ('consumable','returnable','durable')),
        is_active       BIT             NOT NULL DEFAULT 1,
        synced_at       DATETIME2       NOT NULL DEFAULT GETDATE(),
        CONSTRAINT uq_item_code UNIQUE (item_code)
    );
    CREATE INDEX ix_items_code ON ops.comsys_items(item_code);
    PRINT '✅ Table [ops].[comsys_items] created';
END
ELSE
    PRINT '⚠️  Table [ops].[comsys_items] already exists — skipped';
GO

-- Warehouses cache (synced from dbo)
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'ops.comsys_warehouses') AND type = 'U')
BEGIN
    CREATE TABLE ops.comsys_warehouses (
        warehouse_id    INT             IDENTITY(1,1) PRIMARY KEY,
        store_code      NVARCHAR(50)    NOT NULL,
        store_name_ar   NVARCHAR(200)   NOT NULL,
        store_name_en   NVARCHAR(200)   NULL,
        is_active       BIT             NOT NULL DEFAULT 1,
        synced_at       DATETIME2       NOT NULL DEFAULT GETDATE(),
        CONSTRAINT uq_store_code UNIQUE (store_code)
    );
    PRINT '✅ Table [ops].[comsys_warehouses] created';
END
ELSE
    PRINT '⚠️  Table [ops].[comsys_warehouses] already exists — skipped';
GO

-- ==============================================================================
-- 6. OPERATIONAL STOCK LEDGER
-- ==============================================================================

IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'ops.operational_stock') AND type = 'U')
BEGIN
    CREATE TABLE ops.operational_stock (
        stock_id                INT             IDENTITY(1,1) PRIMARY KEY,
        node_id                 INT             NOT NULL,
        item_code               NVARCHAR(50)    NOT NULL,   -- links to ops.comsys_items.item_code
        -- Inflows
        qty_received            DECIMAL(18,4)   NOT NULL DEFAULT 0,   -- from Comsys transfers
        qty_internal_in         DECIMAL(18,4)   NOT NULL DEFAULT 0,   -- internal transfers IN
        qty_returned_in         DECIMAL(18,4)   NOT NULL DEFAULT 0,   -- returned items received
        -- Outflows
        qty_consumed            DECIMAL(18,4)   NOT NULL DEFAULT 0,
        qty_damaged             DECIMAL(18,4)   NOT NULL DEFAULT 0,
        qty_wasted              DECIMAL(18,4)   NOT NULL DEFAULT 0,
        qty_disposed            DECIMAL(18,4)   NOT NULL DEFAULT 0,
        qty_transferred_out     DECIMAL(18,4)   NOT NULL DEFAULT 0,
        -- Computed balance (updated after every transaction)
        qty_operational         AS (
            (qty_received + qty_internal_in + qty_returned_in)
            - (qty_consumed + qty_damaged + qty_wasted + qty_disposed + qty_transferred_out)
        ) PERSISTED,
        last_updated            DATETIME2       NOT NULL DEFAULT GETDATE(),

        CONSTRAINT fk_stock_node FOREIGN KEY (node_id) REFERENCES ops.inventory_nodes(node_id),
        CONSTRAINT uq_stock_node_item UNIQUE (node_id, item_code)
    );
    CREATE INDEX ix_stock_node      ON ops.operational_stock(node_id);
    CREATE INDEX ix_stock_item      ON ops.operational_stock(item_code);
    PRINT '✅ Table [ops].[operational_stock] created';
END
ELSE
    PRINT '⚠️  Table [ops].[operational_stock] already exists — skipped';
GO

-- ==============================================================================
-- 7. TRANSACTIONS
-- ==============================================================================

-- Transaction Header
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'ops.transaction_headers') AND type = 'U')
BEGIN
    CREATE TABLE ops.transaction_headers (
        txn_id          INT             IDENTITY(1,1) PRIMARY KEY,
        txn_type        NVARCHAR(30)    NOT NULL
                        CONSTRAINT chk_txn_type CHECK (txn_type IN (
                            'consumption','internal_transfer','return','damage','waste','disposal'
                        )),
        node_id         INT             NOT NULL,
        created_by      INT             NOT NULL,
        txn_date        DATE            NOT NULL DEFAULT CAST(GETDATE() AS DATE),
        reference_no    NVARCHAR(50)    NULL,
        notes           NVARCHAR(500)   NULL,
        status          NVARCHAR(20)    NOT NULL DEFAULT 'draft'
                        CONSTRAINT chk_status CHECK (status IN ('draft','confirmed','cancelled')),
        confirmed_by    INT             NULL,
        confirmed_at    DATETIME2       NULL,
        cancelled_by    INT             NULL,
        cancelled_at    DATETIME2       NULL,
        created_at      DATETIME2       NOT NULL DEFAULT GETDATE(),

        CONSTRAINT fk_txn_node        FOREIGN KEY (node_id)      REFERENCES ops.inventory_nodes(node_id),
        CONSTRAINT fk_txn_created_by  FOREIGN KEY (created_by)   REFERENCES ops.app_users(user_id),
        CONSTRAINT fk_txn_confirmed   FOREIGN KEY (confirmed_by) REFERENCES ops.app_users(user_id),
        CONSTRAINT fk_txn_cancelled   FOREIGN KEY (cancelled_by) REFERENCES ops.app_users(user_id)
    );
    CREATE INDEX ix_txn_node    ON ops.transaction_headers(node_id);
    CREATE INDEX ix_txn_date    ON ops.transaction_headers(txn_date);
    CREATE INDEX ix_txn_type    ON ops.transaction_headers(txn_type);
    CREATE INDEX ix_txn_status  ON ops.transaction_headers(status);
    PRINT '✅ Table [ops].[transaction_headers] created';
END
ELSE
    PRINT '⚠️  Table [ops].[transaction_headers] already exists — skipped';
GO

-- Transaction Lines (one per item per transaction)
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'ops.transaction_lines') AND type = 'U')
BEGIN
    CREATE TABLE ops.transaction_lines (
        line_id         INT             IDENTITY(1,1) PRIMARY KEY,
        txn_id          INT             NOT NULL,
        item_code       NVARCHAR(50)    NOT NULL,
        quantity        DECIMAL(18,4)   NOT NULL,
        unit_code       NVARCHAR(20)    NULL,
        unit_cost       DECIMAL(18,4)   NULL DEFAULT 0,
        total_cost      AS (quantity * ISNULL(unit_cost, 0)) PERSISTED,
        notes           NVARCHAR(200)   NULL,

        CONSTRAINT fk_line_txn  FOREIGN KEY (txn_id) REFERENCES ops.transaction_headers(txn_id)
    );
    CREATE INDEX ix_line_txn  ON ops.transaction_lines(txn_id);
    CREATE INDEX ix_line_item ON ops.transaction_lines(item_code);
    PRINT '✅ Table [ops].[transaction_lines] created';
END
ELSE
    PRINT '⚠️  Table [ops].[transaction_lines] already exists — skipped';
GO

-- Transaction Details (transfer/return/damage specifics)
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'ops.transaction_details') AND type = 'U')
BEGIN
    CREATE TABLE ops.transaction_details (
        detail_id           INT             IDENTITY(1,1) PRIMARY KEY,
        txn_id              INT             NOT NULL,
        from_node_id        INT             NULL,
        to_node_id          INT             NULL,
        reason              NVARCHAR(200)   NULL,
        condition_note      NVARCHAR(200)   NULL,    -- good / damaged / expired
        evidence_url        NVARCHAR(500)   NULL,    -- photo/doc attachment path
        estimated_value     DECIMAL(18,4)   NULL,
        disposal_method     NVARCHAR(100)   NULL,
        created_at          DATETIME2       NOT NULL DEFAULT GETDATE(),

        CONSTRAINT fk_detail_txn       FOREIGN KEY (txn_id)       REFERENCES ops.transaction_headers(txn_id),
        CONSTRAINT fk_detail_from_node FOREIGN KEY (from_node_id) REFERENCES ops.inventory_nodes(node_id),
        CONSTRAINT fk_detail_to_node   FOREIGN KEY (to_node_id)   REFERENCES ops.inventory_nodes(node_id)
    );
    PRINT '✅ Table [ops].[transaction_details] created';
END
ELSE
    PRINT '⚠️  Table [ops].[transaction_details] already exists — skipped';
GO

-- ==============================================================================
-- 8. SYNC LOG
-- ==============================================================================

IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'ops.sync_logs') AND type = 'U')
BEGIN
    CREATE TABLE ops.sync_logs (
        sync_id             INT             IDENTITY(1,1) PRIMARY KEY,
        sync_type           NVARCHAR(50)    NOT NULL,   -- 'items','warehouses','transfers','balances'
        triggered_by        NVARCHAR(50)    NULL,        -- 'scheduler' or username
        started_at          DATETIME2       NOT NULL DEFAULT GETDATE(),
        completed_at        DATETIME2       NULL,
        records_synced      INT             NULL DEFAULT 0,
        status              NVARCHAR(20)    NOT NULL DEFAULT 'running'
                            CONSTRAINT chk_sync_status CHECK (status IN ('running','success','failed')),
        error_message       NVARCHAR(MAX)   NULL
    );
    CREATE INDEX ix_sync_type   ON ops.sync_logs(sync_type);
    CREATE INDEX ix_sync_date   ON ops.sync_logs(started_at);
    PRINT '✅ Table [ops].[sync_logs] created';
END
ELSE
    PRINT '⚠️  Table [ops].[sync_logs] already exists — skipped';
GO

-- ==============================================================================
-- 9. AUDIT LOG
-- ==============================================================================

IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'ops.audit_logs') AND type = 'U')
BEGIN
    CREATE TABLE ops.audit_logs (
        log_id          INT             IDENTITY(1,1) PRIMARY KEY,
        user_id         INT             NULL,
        username        NVARCHAR(50)    NULL,
        action          NVARCHAR(50)    NOT NULL,    -- LOGIN, CREATE_TXN, APPROVE, etc.
        entity_type     NVARCHAR(50)    NULL,        -- 'transaction', 'stock', etc.
        entity_id       INT             NULL,
        old_value       NVARCHAR(MAX)   NULL,        -- JSON
        new_value       NVARCHAR(MAX)   NULL,        -- JSON
        ip_address      NVARCHAR(45)    NULL,
        logged_at       DATETIME2       NOT NULL DEFAULT GETDATE()
    );
    CREATE INDEX ix_audit_user   ON ops.audit_logs(user_id);
    CREATE INDEX ix_audit_date   ON ops.audit_logs(logged_at);
    CREATE INDEX ix_audit_entity ON ops.audit_logs(entity_type, entity_id);
    PRINT '✅ Table [ops].[audit_logs] created';
END
ELSE
    PRINT '⚠️  Table [ops].[audit_logs] already exists — skipped';
GO

-- ==============================================================================
-- 10. SEED: Default admin user
-- Password = Admin@1234 (bcrypt hash — change immediately after first login!)
-- ==============================================================================

IF NOT EXISTS (SELECT 1 FROM ops.app_users WHERE username = 'admin')
BEGIN
    INSERT INTO ops.app_users (username, full_name_ar, password_hash, role, is_active)
    VALUES (
        'admin',
        N'مدير النظام',
        '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TiNdifZNuVLpxhFOoK5CcDn0yFTq',  -- Admin@1234
        'admin',
        1
    );
    PRINT '✅ Default admin user created (username: admin / password: Admin@1234)';
    PRINT '⚠️  CHANGE THE PASSWORD IMMEDIATELY AFTER FIRST LOGIN!';
END
ELSE
    PRINT '⚠️  Admin user already exists — skipped';
GO

-- ==============================================================================
PRINT '';
PRINT '🎉 Migration complete! ops schema is ready inside FHtlPTrain.';
PRINT '   Our tables : ops.app_users, ops.hotel_groups, ops.inventory_nodes,';
PRINT '                ops.comsys_items, ops.comsys_warehouses,';
PRINT '                ops.operational_stock, ops.transaction_headers,';
PRINT '                ops.transaction_lines, ops.transaction_details,';
PRINT '                ops.sync_logs, ops.audit_logs';
PRINT '   Comsys dbo : UNTOUCHED ✅';
-- ==============================================================================
