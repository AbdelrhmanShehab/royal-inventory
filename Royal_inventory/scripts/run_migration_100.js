'use strict';
/**
 * Run Migration 100 — Laundry Management Module
 */
const path = require('path');
const fs   = require('fs');
const { connectSystemDB, getSystemDB } = require('../src/config/database');

async function run() {
  await connectSystemDB();
  const pool = getSystemDB();
  const sql  = fs.readFileSync(path.join(__dirname, '../migrations/100_laundry_management_module.sql'), 'utf8');

  // Split on GO statements (SQL Server batch separator)
  const batches = sql.split(/^\s*GO\s*$/im).filter(b => b.trim());
  for (const batch of batches) {
    if (batch.trim()) {
      await pool.request().query(batch);
    }
  }
  console.log('✅ Migration 100 applied successfully');
  process.exit(0);
}

run().catch(e => { console.error('❌ Migration 100 failed:', e.message); process.exit(1); });
