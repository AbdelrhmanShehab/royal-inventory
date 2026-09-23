'use strict';
require('dotenv').config();
const { connectSystemDB, getSystemDB } = require('../src/config/database');

async function run() {
  try {
    await connectSystemDB();
    const pool = getSystemDB();
    
    console.log('Checking columns of ops.inventory_nodes...');
    const result = await pool.request().query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'ops' AND TABLE_NAME = 'inventory_nodes'
    `);
    
    const columns = result.recordset.map(r => r.COLUMN_NAME.toLowerCase());
    console.log('Columns:', columns);
    
    if (!columns.includes('has_laundry_access')) {
      console.log('Adding column has_laundry_access...');
      await pool.request().query(`
        ALTER TABLE ops.inventory_nodes 
        ADD has_laundry_access BIT NOT NULL DEFAULT 0;
      `);
      console.log('Column has_laundry_access added successfully!');
    } else {
      console.log('Column has_laundry_access already exists.');
    }

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

run();
