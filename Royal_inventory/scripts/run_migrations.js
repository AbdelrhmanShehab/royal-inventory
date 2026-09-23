'use strict';

/**
 * Production Migration Runner
 * Executes all SQL migrations in the migrations folder in order.
 * Can be run via: node scripts/run_migrations.js
 */

const fs = require('fs');
const path = require('path');
const { connectSystemDB, getSystemDB, closeSystemDB } = require('../src/config/database');

async function runAllMigrations() {
  console.log('====================================================');
  console.log('  AQSA-ERP / Royal Inventory - Migration Runner');
  console.log('====================================================\n');

  const migrationsDir = path.resolve(__dirname, '../migrations');
  if (!fs.existsSync(migrationsDir)) {
    console.error(`❌ Migrations directory not found at: ${migrationsDir}`);
    process.exit(1);
  }

  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.log('ℹ️ No migration SQL files found in', migrationsDir);
    process.exit(0);
  }

  console.log(`Found ${files.length} migration file(s) to process:\n`);
  files.forEach(f => console.log(`  - ${f}`));
  console.log('\nConnecting to System Database...');

  await connectSystemDB();
  const pool = getSystemDB();

  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    console.log(`\n----------------------------------------------------`);
    console.log(`Executing migration: ${file}...`);
    const sqlContent = fs.readFileSync(filePath, 'utf8');

    // Split on GO statements (SQL Server batch delimiter)
    const batches = sqlContent.split(/^\s*GO\s*$/im).filter(b => b.trim());

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i].trim();
      if (batch) {
        try {
          await pool.request().query(batch);
        } catch (batchErr) {
          console.error(`❌ Error executing batch ${i + 1} of ${file}:`, batchErr.message);
          throw batchErr;
        }
      }
    }
    console.log(`✅ ${file} applied successfully.`);
  }

  console.log('\n====================================================');
  console.log('🎉 All migrations processed successfully!');
  console.log('====================================================\n');

  await closeSystemDB();
  process.exit(0);
}

runAllMigrations().catch(err => {
  console.error('\n❌ Migration run failed:', err.message);
  process.exit(1);
});
