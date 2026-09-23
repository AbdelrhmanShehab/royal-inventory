-- ==============================================================================
-- Migration: Create Laundry Management Module Tables inside InventoryOps
-- ==============================================================================

USE InventoryOps;
GO

-- 1. LAUNDRY MACHINES
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'ops.laundry_machines') AND type = 'U')
BEGIN
    CREATE TABLE ops.laundry_machines (
        machine_id      INT             IDENTITY(1,1) PRIMARY KEY,
        machine_name    NVARCHAR(100)   NOT NULL,
        capacity_kg     DECIMAL(18,2)   NOT NULL DEFAULT 0.00,
        is_active       BIT             NOT NULL DEFAULT 1,
        created_at      DATETIME2       NOT NULL DEFAULT GETDATE()
    );
    PRINT '✅ Table [ops].[laundry_machines] created';
END
ELSE
    PRINT '⚠️  Table [ops].[laundry_machines] already exists — skipped';
GO

-- 2. LAUNDRY MACHINE PROGRAMS
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'ops.laundry_machine_programs') AND type = 'U')
BEGIN
    CREATE TABLE ops.laundry_machine_programs (
        program_id      INT             IDENTITY(1,1) PRIMARY KEY,
        machine_id      INT             NOT NULL,
        program_name    NVARCHAR(100)   NOT NULL,
        description     NVARCHAR(500)   NULL,
        is_active       BIT             NOT NULL DEFAULT 1,
        created_at      DATETIME2       NOT NULL DEFAULT GETDATE(),
        CONSTRAINT fk_programs_machine FOREIGN KEY (machine_id) REFERENCES ops.laundry_machines(machine_id)
    );
    PRINT '✅ Table [ops].[laundry_machine_programs] created';
END
ELSE
    PRINT '⚠️  Table [ops].[laundry_machine_programs] already exists — skipped';
GO

-- 3. LAUNDRY RECIPES
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'ops.laundry_recipes') AND type = 'U')
BEGIN
    CREATE TABLE ops.laundry_recipes (
        recipe_id       INT             IDENTITY(1,1) PRIMARY KEY,
        recipe_name     NVARCHAR(100)   NOT NULL,
        mode            NVARCHAR(20)    NOT NULL DEFAULT 'STRICT'
                        CONSTRAINT chk_recipe_mode CHECK (mode IN ('STRICT', 'FLEXIBLE', 'MANUAL')),
        description     NVARCHAR(500)   NULL,
        is_active       BIT             NOT NULL DEFAULT 1,
        created_at      DATETIME2       NOT NULL DEFAULT GETDATE()
    );
    PRINT '✅ Table [ops].[laundry_recipes] created';
END
ELSE
    PRINT '⚠️  Table [ops].[laundry_recipes] already exists — skipped';
GO

-- 4. LAUNDRY RECIPE ITEMS
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'ops.laundry_recipe_items') AND type = 'U')
BEGIN
    CREATE TABLE ops.laundry_recipe_items (
        recipe_item_id      INT             IDENTITY(1,1) PRIMARY KEY,
        recipe_id           INT             NOT NULL,
        chemical_item_code  NVARCHAR(50)    NOT NULL,
        chemical_name       NVARCHAR(200)   NOT NULL,
        expected_qty        DECIMAL(18,4)   NOT NULL DEFAULT 0.0000,
        min_qty             DECIMAL(18,4)   NOT NULL DEFAULT 0.0000,
        max_qty             DECIMAL(18,4)   NOT NULL DEFAULT 0.0000,
        is_required         BIT             NOT NULL DEFAULT 1,
        calculation_mode    NVARCHAR(30)    NOT NULL DEFAULT 'fixed_consumption'
                            CONSTRAINT chk_calc_mode CHECK (calculation_mode IN ('chemical_per_kg', 'fixed_consumption', 'manual_override')),
        CONSTRAINT fk_recipe_items_recipe FOREIGN KEY (recipe_id) REFERENCES ops.laundry_recipes(recipe_id) ON DELETE CASCADE
    );
    PRINT '✅ Table [ops].[laundry_recipe_items] created';
END
ELSE
    PRINT '⚠️  Table [ops].[laundry_recipe_items] already exists — skipped';
GO

-- 5. LAUNDRY TRANSFERS (Warehouse ➔ Laundry)
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'ops.laundry_transfers') AND type = 'U')
BEGIN
    CREATE TABLE ops.laundry_transfers (
        transfer_id         INT             IDENTITY(1,1) PRIMARY KEY,
        from_warehouse_id   INT             NOT NULL, -- Node ID (ops.inventory_nodes)
        status              NVARCHAR(30)    NOT NULL DEFAULT 'draft'
                            CONSTRAINT chk_laundry_transfer_status CHECK (status IN ('draft', 'sent', 'in_transit', 'received', 'partially_received', 'rejected', 'closed')),
        notes               NVARCHAR(500)   NULL,
        created_by          INT             NOT NULL,
        created_at          DATETIME2       NOT NULL DEFAULT GETDATE(),
        updated_at          DATETIME2       NOT NULL DEFAULT GETDATE(),
        CONSTRAINT fk_transfers_warehouse FOREIGN KEY (from_warehouse_id) REFERENCES ops.inventory_nodes(node_id),
        CONSTRAINT fk_transfers_creator FOREIGN KEY (created_by) REFERENCES ops.app_users(user_id)
    );
    PRINT '✅ Table [ops].[laundry_transfers] created';
END
ELSE
    PRINT '⚠️  Table [ops].[laundry_transfers] already exists — skipped';
GO

-- 6. LAUNDRY TRANSFER ITEMS
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'ops.laundry_transfer_items') AND type = 'U')
BEGIN
    CREATE TABLE ops.laundry_transfer_items (
        transfer_item_id    INT             IDENTITY(1,1) PRIMARY KEY,
        transfer_id         INT             NOT NULL,
        item_code           NVARCHAR(50)    NOT NULL,
        item_name_ar        NVARCHAR(200)   NOT NULL,
        sent_qty            DECIMAL(18,4)   NOT NULL DEFAULT 0.0000,
        received_qty        DECIMAL(18,4)   NOT NULL DEFAULT 0.0000,
        remaining_qty       DECIMAL(18,4)   NOT NULL DEFAULT 0.0000,
        unit_code           NVARCHAR(20)    NULL,
        unit_cost           DECIMAL(18,4)   NOT NULL DEFAULT 0.0000,
        CONSTRAINT fk_transfer_items_header FOREIGN KEY (transfer_id) REFERENCES ops.laundry_transfers(transfer_id) ON DELETE CASCADE
    );
    PRINT '✅ Table [ops].[laundry_transfer_items] created';
END
ELSE
    PRINT '⚠️  Table [ops].[laundry_transfer_items] already exists — skipped';
GO

-- 7. LAUNDRY RECEIVINGS
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'ops.laundry_receivings') AND type = 'U')
BEGIN
    CREATE TABLE ops.laundry_receivings (
        receiving_id        INT             IDENTITY(1,1) PRIMARY KEY,
        transfer_id         INT             NOT NULL,
        received_by         INT             NOT NULL,
        notes               NVARCHAR(500)   NULL,
        created_at          DATETIME2       NOT NULL DEFAULT GETDATE(),
        CONSTRAINT fk_receivings_transfer FOREIGN KEY (transfer_id) REFERENCES ops.laundry_transfers(transfer_id),
        CONSTRAINT fk_receivings_receiver FOREIGN KEY (received_by) REFERENCES ops.app_users(user_id)
    );
    PRINT '✅ Table [ops].[laundry_receivings] created';
END
ELSE
    PRINT '⚠️  Table [ops].[laundry_receivings] already exists — skipped';
GO

-- 8. LAUNDRY RECEIVING ITEMS
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'ops.laundry_receiving_items') AND type = 'U')
BEGIN
    CREATE TABLE ops.laundry_receiving_items (
        receiving_item_id   INT             IDENTITY(1,1) PRIMARY KEY,
        receiving_id        INT             NOT NULL,
        item_code           NVARCHAR(50)    NOT NULL,
        expected_qty        DECIMAL(18,4)   NOT NULL DEFAULT 0.0000,
        actual_qty          DECIMAL(18,4)   NOT NULL DEFAULT 0.0000,
        rejected_qty        DECIMAL(18,4)   NOT NULL DEFAULT 0.0000,
        reject_reason       NVARCHAR(100)   NULL,
        reject_notes        NVARCHAR(500)   NULL,
        CONSTRAINT fk_receiving_items_header FOREIGN KEY (receiving_id) REFERENCES ops.laundry_receivings(receiving_id) ON DELETE CASCADE
    );
    PRINT '✅ Table [ops].[laundry_receiving_items] created';
END
ELSE
    PRINT '⚠️  Table [ops].[laundry_receiving_items] already exists — skipped';
GO

-- 9. LAUNDRY BATCHES (Processing Cycles)
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'ops.laundry_batches') AND type = 'U')
BEGIN
    CREATE TABLE ops.laundry_batches (
        batch_id        INT             IDENTITY(1,1) PRIMARY KEY,
        batch_number    NVARCHAR(50)    NOT NULL,
        machine_id      INT             NULL,
        program_id      INT             NULL,
        recipe_id       INT             NULL,
        weight          DECIMAL(18,2)   NOT NULL DEFAULT 0.00,
        pieces          INT             NOT NULL DEFAULT 0,
        status          NVARCHAR(20)    NOT NULL DEFAULT 'Pending'
                        CONSTRAINT chk_batch_status CHECK (status IN ('Pending', 'Running', 'Paused', 'Completed', 'Cancelled')),
        operator_id     INT             NOT NULL,
        started_at      DATETIME2       NULL,
        finished_at     DATETIME2       NULL,
        created_at      DATETIME2       NOT NULL DEFAULT GETDATE(),
        CONSTRAINT uq_batch_number UNIQUE (batch_number),
        CONSTRAINT fk_batches_machine FOREIGN KEY (machine_id) REFERENCES ops.laundry_machines(machine_id),
        CONSTRAINT fk_batches_program FOREIGN KEY (program_id) REFERENCES ops.laundry_machine_programs(program_id),
        CONSTRAINT fk_batches_recipe  FOREIGN KEY (recipe_id) REFERENCES ops.laundry_recipes(recipe_id),
        CONSTRAINT fk_batches_operator FOREIGN KEY (operator_id) REFERENCES ops.app_users(user_id)
    );
    PRINT '✅ Table [ops].[laundry_batches] created';
END
ELSE
    PRINT '⚠️  Table [ops].[laundry_batches] already exists — skipped';
GO

-- 10. LAUNDRY BATCH ITEMS
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'ops.laundry_batch_items') AND type = 'U')
BEGIN
    CREATE TABLE ops.laundry_batch_items (
        batch_item_id   INT             IDENTITY(1,1) PRIMARY KEY,
        batch_id        INT             NOT NULL,
        item_code       NVARCHAR(50)    NOT NULL,
        quantity        DECIMAL(18,4)   NOT NULL DEFAULT 0.0000,
        role            NVARCHAR(20)    NOT NULL -- 'INPUT', 'OUTPUT', 'SCRAP'
                        CONSTRAINT chk_batch_item_role CHECK (role IN ('INPUT', 'OUTPUT', 'SCRAP')),
        CONSTRAINT fk_batch_items_header FOREIGN KEY (batch_id) REFERENCES ops.laundry_batches(batch_id) ON DELETE CASCADE
    );
    PRINT '✅ Table [ops].[laundry_batch_items] created';
END
ELSE
    PRINT '⚠️  Table [ops].[laundry_batch_items] already exists — skipped';
GO

-- 11. LAUNDRY CONSUMPTIONS
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'ops.laundry_consumptions') AND type = 'U')
BEGIN
    CREATE TABLE ops.laundry_consumptions (
        consumption_id      INT             IDENTITY(1,1) PRIMARY KEY,
        batch_id            INT             NULL,
        chemical_item_code  NVARCHAR(50)    NOT NULL,
        chemical_name       NVARCHAR(200)   NOT NULL,
        expected_qty        DECIMAL(18,4)   NOT NULL DEFAULT 0.0000,
        actual_qty          DECIMAL(18,4)   NOT NULL DEFAULT 0.0000,
        variance            DECIMAL(18,4)   NOT NULL DEFAULT 0.0000,
        mode                NVARCHAR(20)    NOT NULL DEFAULT 'AUTO'
                            CONSTRAINT chk_consumption_mode CHECK (mode IN ('AUTO', 'MANUAL', 'FLEXIBLE')),
        created_at          DATETIME2       NOT NULL DEFAULT GETDATE(),
        CONSTRAINT fk_consumptions_batch FOREIGN KEY (batch_id) REFERENCES ops.laundry_batches(batch_id) ON DELETE CASCADE
    );
    PRINT '✅ Table [ops].[laundry_consumptions] created';
END
ELSE
    PRINT '⚠️  Table [ops].[laundry_consumptions] already exists — skipped';
GO

-- 12. LAUNDRY RETURNS (Laundry ➔ Warehouse)
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'ops.laundry_returns') AND type = 'U')
BEGIN
    CREATE TABLE ops.laundry_returns (
        return_id           INT             IDENTITY(1,1) PRIMARY KEY,
        transfer_id         INT             NOT NULL,
        status              NVARCHAR(30)    NOT NULL DEFAULT 'draft'
                            CONSTRAINT chk_laundry_return_status CHECK (status IN ('draft', 'sent', 'partial_received', 'completed', 'rejected', 'disputed')),
        notes               NVARCHAR(500)   NULL,
        created_by          INT             NOT NULL,
        created_at          DATETIME2       NOT NULL DEFAULT GETDATE(),
        CONSTRAINT fk_returns_transfer FOREIGN KEY (transfer_id) REFERENCES ops.laundry_transfers(transfer_id),
        CONSTRAINT fk_returns_creator FOREIGN KEY (created_by) REFERENCES ops.app_users(user_id)
    );
    PRINT '✅ Table [ops].[laundry_returns] created';
END
ELSE
    PRINT '⚠️  Table [ops].[laundry_returns] already exists — skipped';
GO

-- 13. LAUNDRY RETURN ITEMS
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'ops.laundry_return_items') AND type = 'U')
BEGIN
    CREATE TABLE ops.laundry_return_items (
        return_item_id      INT             IDENTITY(1,1) PRIMARY KEY,
        return_id           INT             NOT NULL,
        item_code           NVARCHAR(50)    NOT NULL,
        item_name_ar        NVARCHAR(200)   NOT NULL,
        expected_qty        DECIMAL(18,4)   NOT NULL DEFAULT 0.0000,
        actual_qty          DECIMAL(18,4)   NOT NULL DEFAULT 0.0000,
        rejected_qty        DECIMAL(18,4)   NOT NULL DEFAULT 0.0000,
        reject_reason       NVARCHAR(100)   NULL,
        reject_notes        NVARCHAR(500)   NULL,
        CONSTRAINT fk_return_items_header FOREIGN KEY (return_id) REFERENCES ops.laundry_returns(return_id) ON DELETE CASCADE
    );
    PRINT '✅ Table [ops].[laundry_return_items] created';
END
ELSE
    PRINT '⚠️  Table [ops].[laundry_return_items] already exists — skipped';
GO

-- 14. LAUNDRY LOSSES
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'ops.laundry_losses') AND type = 'U')
BEGIN
    CREATE TABLE ops.laundry_losses (
        loss_id         INT             IDENTITY(1,1) PRIMARY KEY,
        item_code       NVARCHAR(50)    NOT NULL,
        item_name_ar    NVARCHAR(200)   NOT NULL,
        quantity        DECIMAL(18,4)   NOT NULL DEFAULT 0.0000,
        reason          NVARCHAR(100)   NOT NULL
                        CONSTRAINT chk_loss_reason CHECK (reason IN ('Torn', 'Burned', 'Shrinkage', 'Missing', 'Stained', 'Disposed')),
        cost            DECIMAL(18,4)   NOT NULL DEFAULT 0.0000,
        approved_by     INT             NOT NULL,
        batch_id        INT             NULL,
        created_at      DATETIME2       NOT NULL DEFAULT GETDATE(),
        CONSTRAINT fk_losses_approver FOREIGN KEY (approved_by) REFERENCES ops.app_users(user_id),
        CONSTRAINT fk_losses_batch FOREIGN KEY (batch_id) REFERENCES ops.laundry_batches(batch_id)
    );
    PRINT '✅ Table [ops].[laundry_losses] created';
END
ELSE
    PRINT '⚠️  Table [ops].[laundry_losses] already exists — skipped';
GO

-- 15. LAUNDRY TICKETS (Guest & Staff Orders)
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'ops.laundry_tickets') AND type = 'U')
BEGIN
    CREATE TABLE ops.laundry_tickets (
        ticket_id       INT             IDENTITY(1,1) PRIMARY KEY,
        ticket_type     NVARCHAR(20)    NOT NULL
                        CONSTRAINT chk_ticket_type CHECK (ticket_type IN ('GUEST', 'STAFF')),
        guest_name      NVARCHAR(100)   NULL,
        room_number     NVARCHAR(20)    NULL,
        employee_id     INT             NULL,
        special_notes   NVARCHAR(500)   NULL,
        delivery_time   DATETIME2       NULL,
        status          NVARCHAR(20)    NOT NULL DEFAULT 'Received'
                        CONSTRAINT chk_ticket_status CHECK (status IN ('Received', 'Processing', 'Ready', 'Delivered')),
        pos_sale_id     INT             NULL,
        created_by      INT             NOT NULL,
        created_at      DATETIME2       NOT NULL DEFAULT GETDATE(),
        updated_at      DATETIME2       NOT NULL DEFAULT GETDATE(),
        CONSTRAINT fk_tickets_creator FOREIGN KEY (created_by) REFERENCES ops.app_users(user_id)
    );
    PRINT '✅ Table [ops].[laundry_tickets] created';
END
ELSE
    PRINT '⚠️  Table [ops].[laundry_tickets] already exists — skipped';
GO

-- 16. LAUNDRY TICKET ITEMS
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'ops.laundry_ticket_items') AND type = 'U')
BEGIN
    CREATE TABLE ops.laundry_ticket_items (
        ticket_item_id      INT             IDENTITY(1,1) PRIMARY KEY,
        ticket_id           INT             NOT NULL,
        service_item_code   NVARCHAR(50)    NOT NULL,
        quantity            DECIMAL(18,4)   NOT NULL DEFAULT 0.0000,
        unit_price          DECIMAL(18,4)   NOT NULL DEFAULT 0.0000,
        total_price         DECIMAL(18,4)   NOT NULL DEFAULT 0.0000,
        CONSTRAINT fk_ticket_items_header FOREIGN KEY (ticket_id) REFERENCES ops.laundry_tickets(ticket_id) ON DELETE CASCADE
    );
    PRINT '✅ Table [ops].[laundry_ticket_items] created';
END
ELSE
    PRINT '⚠️  Table [ops].[laundry_ticket_items] already exists — skipped';
GO

-- 17. LAUNDRY COSTING
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'ops.laundry_costing') AND type = 'U')
BEGIN
    CREATE TABLE ops.laundry_costing (
        cost_id             INT             IDENTITY(1,1) PRIMARY KEY,
        batch_id            INT             NULL,
        item_code           NVARCHAR(50)    NOT NULL,
        chemical_cost       DECIMAL(18,4)   NOT NULL DEFAULT 0.0000,
        water_cost          DECIMAL(18,4)   NOT NULL DEFAULT 0.0000,
        electricity_cost    DECIMAL(18,4)   NOT NULL DEFAULT 0.0000,
        labor_cost          DECIMAL(18,4)   NOT NULL DEFAULT 0.0000,
        machine_usage_cost  DECIMAL(18,4)   NOT NULL DEFAULT 0.0000,
        scrap_cost          DECIMAL(18,4)   NOT NULL DEFAULT 0.0000,
        total_cost          DECIMAL(18,4)   NOT NULL DEFAULT 0.0000,
        cost_type           NVARCHAR(20)    NOT NULL DEFAULT 'BATCH'
                            CONSTRAINT chk_cost_type CHECK (cost_type IN ('KG', 'BATCH', 'ITEM', 'SERVICE')),
        created_at          DATETIME2       NOT NULL DEFAULT GETDATE(),
        CONSTRAINT fk_costing_batch FOREIGN KEY (batch_id) REFERENCES ops.laundry_batches(batch_id) ON DELETE SET NULL
    );
    PRINT '✅ Table [ops].[laundry_costing] created';
END
ELSE
    PRINT '⚠️  Table [ops].[laundry_costing] already exists — skipped';
GO

-- 18. LAUNDRY PROFITABILITY
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'ops.laundry_profitability') AND type = 'U')
BEGIN
    CREATE TABLE ops.laundry_profitability (
        profit_id       INT             IDENTITY(1,1) PRIMARY KEY,
        date            DATE            NOT NULL,
        revenue         DECIMAL(18,4)   NOT NULL DEFAULT 0.0000,
        chemical_cost   DECIMAL(18,4)   NOT NULL DEFAULT 0.0000,
        utilities_cost  DECIMAL(18,4)   NOT NULL DEFAULT 0.0000,
        labor_cost      DECIMAL(18,4)   NOT NULL DEFAULT 0.0000,
        loss_cost       DECIMAL(18,4)   NOT NULL DEFAULT 0.0000,
        net_profit      DECIMAL(18,4)   NOT NULL DEFAULT 0.0000,
        created_at      DATETIME2       NOT NULL DEFAULT GETDATE(),
        CONSTRAINT uq_profit_date UNIQUE (date)
    );
    PRINT '✅ Table [ops].[laundry_profitability] created';
END
ELSE
    PRINT '⚠️  Table [ops].[laundry_profitability] already exists — skipped';
GO

-- 19. LAUNDRY RECONCILIATIONS
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'ops.laundry_reconciliations') AND type = 'U')
BEGIN
    CREATE TABLE ops.laundry_reconciliations (
        reconciliation_id   INT             IDENTITY(1,1) PRIMARY KEY,
        item_code           NVARCHAR(50)    NOT NULL,
        item_name_ar        NVARCHAR(200)   NOT NULL,
        sent_qty            DECIMAL(18,4)   NOT NULL DEFAULT 0.0000,
        returned_qty        DECIMAL(18,4)   NOT NULL DEFAULT 0.0000,
        scrap_qty           DECIMAL(18,4)   NOT NULL DEFAULT 0.0000,
        in_progress_qty     DECIMAL(18,4)   NOT NULL DEFAULT 0.0000,
        variance            DECIMAL(18,4)   NOT NULL DEFAULT 0.0000,
        alert_triggered     BIT             NOT NULL DEFAULT 0,
        reconciled_at       DATETIME2       NOT NULL DEFAULT GETDATE(),
        CONSTRAINT uq_recon_item UNIQUE (item_code)
    );
    PRINT '✅ Table [ops].[laundry_reconciliations] created';
END
ELSE
    PRINT '⚠️  Table [ops].[laundry_reconciliations] already exists — skipped';
GO

-- 20. LAUNDRY POS SYNC LOGS
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'ops.laundry_pos_sync_logs') AND type = 'U')
BEGIN
    CREATE TABLE ops.laundry_pos_sync_logs (
        sync_id             INT             IDENTITY(1,1) PRIMARY KEY,
        synced_at           DATETIME2       NOT NULL DEFAULT GETDATE(),
        orders_imported     INT             NOT NULL DEFAULT 0,
        status              NVARCHAR(20)    NOT NULL,
        error_message       NVARCHAR(MAX)   NULL
    );
    PRINT '✅ Table [ops].[laundry_pos_sync_logs] created';
END
ELSE
    PRINT '⚠️  Table [ops].[laundry_pos_sync_logs] already exists — skipped';
GO

-- 21. LAUNDRY AUDIT LOGS
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'ops.laundry_audit_logs') AND type = 'U')
BEGIN
    CREATE TABLE ops.laundry_audit_logs (
        log_id          INT             IDENTITY(1,1) PRIMARY KEY,
        user_id         INT             NULL,
        action          NVARCHAR(50)    NOT NULL,
        entity_type     NVARCHAR(50)    NOT NULL,
        entity_id       INT             NOT NULL,
        old_state       NVARCHAR(MAX)   NULL, -- JSON
        new_state       NVARCHAR(MAX)   NULL, -- JSON
        logged_at       DATETIME2       NOT NULL DEFAULT GETDATE()
    );
    PRINT '✅ Table [ops].[laundry_audit_logs] created';
END
ELSE
    PRINT '⚠️  Table [ops].[laundry_audit_logs] already exists — skipped';
GO
