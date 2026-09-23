'use strict';
/**
 * Run Migration 013 — Expand operational stock ledger for full item lifecycle
 */
const path = require('path');
const fs   = require('fs');
const { connectSystemDB, getSystemDB } = require('../src/config/database');

async function run() {
  await connectSystemDB();
  const pool = getSystemDB();
  const sql = fs.readFileSync(path.join(__dirname, '../migrations/013_expand_stock_lifecycle_columns.sql'), 'utf8');

  const batches = sql.split(/^\s*GO\s*$/im).filter(b => b.trim());
  for (const batch of batches) {
    if (batch.trim()) {
      await pool.request().query(batch);
    }
  }
  console.log('✅ Migration 013 applied successfully');
  process.exit(0);
}

run().catch(e => { console.error('❌ Migration failed:', e.message); process.exit(1); });
