'use strict';
/**
 * Run Migration 012 — Operational Distribution Layer
 */
const path = require('path');
const fs   = require('fs');
const { connectSystemDB, getSystemDB } = require('../src/config/database');

async function run() {
  await connectSystemDB();
  const pool = getSystemDB();
  const sql  = fs.readFileSync(path.join(__dirname, '../migrations/012_operational_distribution.sql'), 'utf8');

  // Split on GO statements (SQL Server batch separator)
  const batches = sql.split(/^\s*GO\s*$/im).filter(b => b.trim());
  for (const batch of batches) {
    if (batch.trim()) {
      await pool.request().query(batch);
    }
  }
  console.log('✅ Migration 012 applied successfully');
  process.exit(0);
}

run().catch(e => { console.error('❌ Migration 012 failed:', e.message); process.exit(1); });
