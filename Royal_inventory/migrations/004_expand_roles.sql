-- ==============================================================================
-- Migration 004: Expand Role System
-- Adds warehouse_manager, warehouse_head, accountant, staff roles
-- Migrates existing operator → warehouse_head, viewer → accountant
-- ==============================================================================

USE InventoryOps;
GO

-- ── Step 1: Drop existing role CHECK constraint ─────────────────────────────
IF EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE name = 'chk_role' AND parent_object_id = OBJECT_ID('ops.app_users')
)
BEGIN
    ALTER TABLE ops.app_users DROP CONSTRAINT chk_role;
    PRINT '✅ Dropped old chk_role constraint';
END
GO

-- ── Step 2: Add new expanded role CHECK constraint ──────────────────────────
ALTER TABLE ops.app_users
    ADD CONSTRAINT chk_role CHECK (
        role IN (
            'admin',             -- Level 5 — مدير النظام        — Full system
            'manager',           -- Level 4 — مدير عام           — All nodes read + approvals
            'warehouse_manager', -- Level 3 — مدير مستودع        — Assigned node + sub-nodes
            'warehouse_head',    -- Level 2 — رئيس عهدة          — Own node drafts + quick consume
            'accountant',        -- Level 1 — محاسب               — Read-only financial reports
            'staff'              -- Level 0 — موظف مستودع        — Own node quick consume only
        )
    );
PRINT '✅ New expanded chk_role constraint added';
GO

-- ── Step 3: Migrate legacy roles ────────────────────────────────────────────
-- operator → warehouse_head (closest equivalent)
UPDATE ops.app_users SET role = 'warehouse_head' WHERE role = 'operator';
PRINT '✅ Migrated [operator] → [warehouse_head]';

-- viewer → accountant (closest equivalent)
UPDATE ops.app_users SET role = 'accountant' WHERE role = 'viewer';
PRINT '✅ Migrated [viewer] → [accountant]';
GO

PRINT '';
PRINT '🎉 Migration 004 complete — role system expanded to 6 levels.';
PRINT '   Roles: admin, manager, warehouse_manager, warehouse_head, accountant, staff';
-- ==============================================================================
