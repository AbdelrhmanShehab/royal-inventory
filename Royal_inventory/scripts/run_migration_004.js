'use strict';
require('dotenv').config();
const { connectSystemDB } = require('../src/config/database');

(async () => {
  const pool = await connectSystemDB();
  try {
    // Step 1: Drop old constraint if exists
    await pool.request().query(`
      IF EXISTS (
        SELECT 1 FROM sys.check_constraints
        WHERE name = 'chk_role'
        AND parent_object_id = OBJECT_ID('ops.app_users')
      )
      BEGIN
        ALTER TABLE ops.app_users DROP CONSTRAINT chk_role
        PRINT 'Dropped old chk_role'
      END
    `);
    console.log('Step 1 done: constraint dropped (if existed)');

    // Step 2: Add new expanded constraint
    await pool.request().query(`
      ALTER TABLE ops.app_users
        ADD CONSTRAINT chk_role CHECK (
          role IN (
            'admin',
            'manager',
            'warehouse_manager',
            'warehouse_head',
            'accountant',
            'staff'
          )
        )
    `);
    console.log('✅ Step 2 done: new chk_role constraint added');

    // Step 3: Migrate legacy roles
    const r1 = await pool.request().query(
      "UPDATE ops.app_users SET role = 'warehouse_head' WHERE role = 'operator'"
    );
    console.log('✅ operator → warehouse_head:', r1.rowsAffected[0], 'rows migrated');

    const r2 = await pool.request().query(
      "UPDATE ops.app_users SET role = 'accountant' WHERE role = 'viewer'"
    );
    console.log('✅ viewer → accountant:', r2.rowsAffected[0], 'rows migrated');

    // Show final state
    const final = await pool.request().query('SELECT user_id, username, role FROM ops.app_users ORDER BY user_id');
    console.log('\n🎉 Migration 004 complete. Current users:');
    final.recordset.forEach(u => console.log(`  #${u.user_id} ${u.username} → ${u.role}`));

    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  }
})();
