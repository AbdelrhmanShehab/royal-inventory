'use strict';
require('dotenv').config();
const { connectSystemDB, getSystemDB } = require('../src/config/database');

async function run() {
  try {
    await connectSystemDB();
    const pool = getSystemDB();
    
    console.log('Querying ops.hotel_groups...');
    const groups = await pool.request().query('SELECT * FROM ops.hotel_groups');
    console.table(groups.recordset);

    console.log('\nQuerying ops.inventory_nodes...');
    const nodes = await pool.request().query('SELECT * FROM ops.inventory_nodes');
    console.table(nodes.recordset);

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

run();
