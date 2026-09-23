-- ==============================================================================
-- Migration 011: Seed complete role permissions matrix
-- Fixes: warehouse_manager, warehouse_head, accountant, staff missing from
--        ops.role_permissions → causes silent 403 on submit-approval and others
-- ==============================================================================

USE InventoryOps;
GO

-- ─── warehouse_manager ───────────────────────────────────────────────────────
MERGE ops.role_permissions AS target
USING (VALUES
  ('warehouse_manager', 'create_draft',      1),
  ('warehouse_manager', 'submit_approval',   1),
  ('warehouse_manager', 'approve_transfer',  0),  -- approval is manager-only
  ('warehouse_manager', 'dispatch_transfer', 1),
  ('warehouse_manager', 'receive_transfer',  1),
  ('warehouse_manager', 'cancel_transfer',   1),
  ('warehouse_manager', 'confirm_transfer',  1),
  ('warehouse_manager', 'quick_consume',     1),
  ('warehouse_manager', 'view_all_nodes',    0),
  ('warehouse_manager', 'manage_nodes',      0),
  ('warehouse_manager', 'manage_users',      0),
  ('warehouse_manager', 'run_sync',          0),
  ('warehouse_manager', 'view_reports',      1),
  ('warehouse_manager', 'manage_permissions',0)
) AS source (role, permission_key, allowed)
ON target.role = source.role AND target.permission_key = source.permission_key
WHEN MATCHED THEN
  UPDATE SET allowed = source.allowed, updated_at = GETDATE()
WHEN NOT MATCHED THEN
  INSERT (role, permission_key, allowed, updated_at)
  VALUES (source.role, source.permission_key, source.allowed, GETDATE());

PRINT '✅ warehouse_manager permissions seeded/updated';
GO

-- ─── warehouse_head ──────────────────────────────────────────────────────────
MERGE ops.role_permissions AS target
USING (VALUES
  ('warehouse_head', 'create_draft',      1),
  ('warehouse_head', 'submit_approval',   1),
  ('warehouse_head', 'approve_transfer',  0),
  ('warehouse_head', 'dispatch_transfer', 1),
  ('warehouse_head', 'receive_transfer',  1),
  ('warehouse_head', 'cancel_transfer',   0),
  ('warehouse_head', 'confirm_transfer',  1),
  ('warehouse_head', 'quick_consume',     1),
  ('warehouse_head', 'view_all_nodes',    0),
  ('warehouse_head', 'manage_nodes',      0),
  ('warehouse_head', 'manage_users',      0),
  ('warehouse_head', 'run_sync',          0),
  ('warehouse_head', 'view_reports',      0),
  ('warehouse_head', 'manage_permissions',0)
) AS source (role, permission_key, allowed)
ON target.role = source.role AND target.permission_key = source.permission_key
WHEN MATCHED THEN
  UPDATE SET allowed = source.allowed, updated_at = GETDATE()
WHEN NOT MATCHED THEN
  INSERT (role, permission_key, allowed, updated_at)
  VALUES (source.role, source.permission_key, source.allowed, GETDATE());

PRINT '✅ warehouse_head permissions seeded/updated';
GO

-- ─── accountant ──────────────────────────────────────────────────────────────
MERGE ops.role_permissions AS target
USING (VALUES
  ('accountant', 'create_draft',      0),
  ('accountant', 'submit_approval',   0),
  ('accountant', 'approve_transfer',  0),
  ('accountant', 'dispatch_transfer', 0),
  ('accountant', 'receive_transfer',  0),
  ('accountant', 'cancel_transfer',   0),
  ('accountant', 'confirm_transfer',  0),
  ('accountant', 'quick_consume',     0),
  ('accountant', 'view_all_nodes',    1),
  ('accountant', 'manage_nodes',      0),
  ('accountant', 'manage_users',      0),
  ('accountant', 'run_sync',          0),
  ('accountant', 'view_reports',      1),
  ('accountant', 'manage_permissions',0)
) AS source (role, permission_key, allowed)
ON target.role = source.role AND target.permission_key = source.permission_key
WHEN MATCHED THEN
  UPDATE SET allowed = source.allowed, updated_at = GETDATE()
WHEN NOT MATCHED THEN
  INSERT (role, permission_key, allowed, updated_at)
  VALUES (source.role, source.permission_key, source.allowed, GETDATE());

PRINT '✅ accountant permissions seeded/updated';
GO

-- ─── staff ───────────────────────────────────────────────────────────────────
MERGE ops.role_permissions AS target
USING (VALUES
  ('staff', 'create_draft',      0),
  ('staff', 'submit_approval',   0),
  ('staff', 'approve_transfer',  0),
  ('staff', 'dispatch_transfer', 0),
  ('staff', 'receive_transfer',  0),
  ('staff', 'cancel_transfer',   0),
  ('staff', 'confirm_transfer',  0),
  ('staff', 'quick_consume',     1),
  ('staff', 'view_all_nodes',    0),
  ('staff', 'manage_nodes',      0),
  ('staff', 'manage_users',      0),
  ('staff', 'run_sync',          0),
  ('staff', 'view_reports',      0),
  ('staff', 'manage_permissions',0)
) AS source (role, permission_key, allowed)
ON target.role = source.role AND target.permission_key = source.permission_key
WHEN MATCHED THEN
  UPDATE SET allowed = source.allowed, updated_at = GETDATE()
WHEN NOT MATCHED THEN
  INSERT (role, permission_key, allowed, updated_at)
  VALUES (source.role, source.permission_key, source.allowed, GETDATE());

PRINT '✅ staff permissions seeded/updated';
GO

PRINT '✅ Migration 011: All role permissions seeded successfully';
GO
