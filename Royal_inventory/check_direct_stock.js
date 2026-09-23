'use strict';
require('dotenv').config();
const { connectSystemDB, getSystemDB } = require('./src/config/database');

async function run() {
  try {
    await connectSystemDB();
    const pool = getSystemDB();
    const result = await pool.request().query(`
      SELECT count(*) as count FROM ops.operational_stock
    `);
    console.log('Operational Stock Count:', result.recordset[0].count);

    const result2 = await pool.request().query(`
      SELECT TOP 10 s.*, n.node_name_ar, i.item_name_ar
      FROM ops.operational_stock s
      JOIN ops.inventory_nodes n ON s.node_id = n.node_id
      LEFT JOIN ops.comsys_items i ON s.item_code = i.item_code AND i.division = n.division
      WHERE s.qty_operational > 0
    `);
    console.log('Stock samples with positive quantities:', result2.recordset);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
