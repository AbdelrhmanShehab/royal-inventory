'use strict';
require('dotenv').config();
const { connectSystemDB, getSystemDB } = require('./src/config/database');

async function run() {
  try {
    await connectSystemDB();
    const pool = getSystemDB();
    
    console.log('Adding division column to ops.inventory_nodes...');
    await pool.request().query(`
      IF NOT EXISTS (
        SELECT 1 FROM sys.columns 
        WHERE object_id = OBJECT_ID('ops.inventory_nodes') AND name = 'division'
      )
      BEGIN
        ALTER TABLE ops.inventory_nodes ADD division NVARCHAR(10) NOT NULL DEFAULT 'fb';
        PRINT '✅ Column [division] added to [ops].[inventory_nodes]';
      END
      ELSE
        PRINT '⚠️ Column [division] already exists';
    `);

    console.log('Verification completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
