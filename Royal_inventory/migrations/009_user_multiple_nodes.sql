-- Migration 009: Multiple Warehouses per User
-- Creates junction table for many-to-many relationship between users and nodes.

USE InventoryOps;
GO

IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'ops.user_nodes') AND type = 'U')
BEGIN
    CREATE TABLE ops.user_nodes (
        user_id INT NOT NULL,
        node_id INT NOT NULL,
        CONSTRAINT pk_user_nodes PRIMARY KEY (user_id, node_id),
        CONSTRAINT fk_user_nodes_user FOREIGN KEY (user_id) REFERENCES ops.app_users(user_id) ON DELETE CASCADE,
        CONSTRAINT fk_user_nodes_node FOREIGN KEY (node_id) REFERENCES ops.inventory_nodes(node_id) ON DELETE NO ACTION
    );
    PRINT '✅ Table [ops].[user_nodes] created';
END
ELSE
    PRINT '⚠️  Table [ops].[user_nodes] already exists — skipped';
GO

-- Seed table with existing user assignments safely
INSERT INTO ops.user_nodes (user_id, node_id)
SELECT u.user_id, u.node_id
FROM ops.app_users u
WHERE u.node_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM ops.user_nodes un
      WHERE un.user_id = u.user_id AND un.node_id = u.node_id
  );
PRINT '✅ Seeded existing user assignments into [ops].[user_nodes]';
GO
