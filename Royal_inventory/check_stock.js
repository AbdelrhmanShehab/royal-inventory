'use strict';
require('dotenv').config();
const { connectSystemDB, getSystemDB } = require('./src/config/database');
const sql = require('mssql');

async function checkStock() {
  try {
    await connectSystemDB();
    const pool = getSystemDB();
    console.log('Querying ops.operational_stock...');
    const result = await pool.request().query(`
      SELECT s.node_id, n.node_name_ar, n.node_type, s.item_code, i.item_name_ar, s.qty_operational
      FROM ops.operational_stock s
      JOIN ops.inventory_nodes n ON s.node_id = n.node_id
      LEFT JOIN ops.comsys_items i ON s.item_code = i.item_code
    `);
    console.log('Stocks count:', result.recordset.length);
    console.log('Stocks sample:', JSON.stringify(result.recordset.slice(0, 10), null, 2));
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

checkStock();
