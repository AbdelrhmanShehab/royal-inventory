'use strict';
/**
 * Run Migration 009 — Multiple Warehouses per User
 */
const path = require('path');
const fs   = require('fs');
const { connectSystemDB, getSystemDB } = require('../src/config/database');

async function run() {
  await connectSystemDB();
  const pool = getSystemDB();
  const sql  = fs.readFileSync(path.join(__dirname, '../migrations/009_user_multiple_nodes.sql'), 'utf8');

  // Split on GO statements (SQL Server batch separator)
  const batches = sql.split(/^\s*GO\s*$/im).filter(b => b.trim());
  for (const batch of batches) {
    if (batch.trim()) {
      await pool.request().query(batch);
    }
  }
  console.log('✅ Migration 009 applied successfully');
  process.exit(0);
}

run().catch(e => { console.error('❌ Migration 009 failed:', e.message); process.exit(1); });
