-- ==============================================================================
-- Migration 101: Expand Roles for Laundry Management Module
-- Adds: laundry_supervisor, laundry_cashier, uniform_clerk, laundry_operator
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
            'admin',              -- مدير النظام
            'manager',            -- مدير عام
            'warehouse_manager',  -- مدير مستودع
            'warehouse_head',     -- رئيس عهدة
            'accountant',         -- محاسب
            'staff',              -- موظف مستودع
            'laundry_supervisor', -- مشرف المغسلة
            'laundry_cashier',    -- كاشير المغسلة
            'uniform_clerk',      -- مسؤول عهد اليونيفورم
            'laundry_operator'    -- مشغل مغسلة
        )
    );
PRINT '✅ New expanded chk_role constraint added with laundry roles';
GO

PRINT '';
PRINT '🎉 Migration 101 complete — Laundry roles added to [ops].[app_users].';
-- ==============================================================================
