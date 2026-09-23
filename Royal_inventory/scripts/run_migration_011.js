'use strict';

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { connectSystemDB, getSystemDB } = require('../src/config/database');

async function runMigration() {
  await connectSystemDB();
  const pool = getSystemDB();

  const sql = fs.readFileSync(
    path.join(__dirname, '../migrations/011_seed_role_permissions.sql'),
    'utf8'
  );

  // Split on GO statements
  const batches = sql.split(/^\s*GO\s*$/im).filter(b => b.trim().length > 0);

  console.log(`Running migration 011 — ${batches.length} batches...\n`);

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i].trim();
    if (!batch || batch.startsWith('USE ') || batch.startsWith('--')) continue;
    try {
      await pool.request().query(batch);
      console.log(`✅ Batch ${i + 1} OK`);
    } catch (err) {
      console.error(`❌ Batch ${i + 1} failed: ${err.message}`);
      console.error('SQL:', batch.substring(0, 200));
    }
  }

  // Verify results
  const result = await pool.request().query(`
    SELECT role, COUNT(*) as cnt, 
           SUM(CASE WHEN allowed = 1 THEN 1 ELSE 0 END) as granted
    FROM ops.role_permissions 
    GROUP BY role 
    ORDER BY role
  `);
  console.log('\n📊 Final permission matrix:');
  console.table(result.recordset);
  process.exit(0);
}

runMigration().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
