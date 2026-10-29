-- ==============================================================================
-- Migration 105: Seed transfer_laundry_custody permission
-- Roles with access: admin, manager, warehouse_manager, warehouse_head, laundry_supervisor, uniform_clerk
-- Roles without access: accountant, staff, laundry_cashier, laundry_operator
-- ==============================================================================

USE InventoryOps;
GO

MERGE ops.role_permissions AS target
USING (VALUES
  ('admin',              'transfer_laundry_custody', 1),
  ('manager',            'transfer_laundry_custody', 1),
  ('warehouse_manager',  'transfer_laundry_custody', 1),
  ('warehouse_head',     'transfer_laundry_custody', 1),
  ('laundry_supervisor', 'transfer_laundry_custody', 1),
  ('uniform_clerk',      'transfer_laundry_custody', 1),
  ('accountant',         'transfer_laundry_custody', 0),
  ('staff',              'transfer_laundry_custody', 0),
  ('laundry_cashier',    'transfer_laundry_custody', 0),
  ('laundry_operator',   'transfer_laundry_custody', 0)
) AS source (role, permission_key, allowed)
ON target.role = source.role AND target.permission_key = source.permission_key
WHEN MATCHED THEN
  UPDATE SET allowed = source.allowed, updated_at = GETDATE()
WHEN NOT MATCHED THEN
  INSERT (role, permission_key, allowed, updated_at)
  VALUES (source.role, source.permission_key, source.allowed, GETDATE());

PRINT '✅ transfer_laundry_custody permission seeded in ops.role_permissions';
GO
