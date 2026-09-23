'use strict';
require('dotenv').config();
const { connectSystemDB, getSystemDB } = require('../src/config/database');

async function run() {
  try {
    await connectSystemDB();
    const pool = getSystemDB();
    
    console.log('Checking triggers on ops.operational_stock...');
    const triggers = await pool.request().query(`
      SELECT name, OBJECT_NAME(parent_id) AS parent_table
      FROM sys.triggers
      WHERE OBJECT_NAME(parent_id) = 'operational_stock'
    `);
    console.table(triggers.recordset);

    console.log('\nChecking computed column definition for qty_operational...');
    const computed = await pool.request().query(`
      SELECT name, definition 
      FROM sys.computed_columns
      WHERE OBJECT_NAME(object_id) = 'operational_stock'
    `);
    console.table(computed.recordset);

    console.log('\nChecking column schemas of ops.operational_stock...');
    const columns = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE, COLUMN_DEFAULT, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'ops' AND TABLE_NAME = 'operational_stock'
    `);
    console.table(columns.recordset);

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

run();
