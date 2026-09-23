'use strict';
const { connectSystemDB, getSystemDB } = require('../src/config/database');

connectSystemDB().then(async () => {
  const pool = getSystemDB();
  const res = await pool.request().query(`
    SELECT TOP 50 item_code, item_name_ar, category_code, item_type
    FROM ops.comsys_items
  `);
  console.log('Sample Items:', res.recordset);
  
  // Also print distinct category codes
  const cats = await pool.request().query(`
    SELECT DISTINCT category_code
    FROM ops.comsys_items
  `);
  console.log('Distinct Categories:', cats.recordset.map(c => c.category_code));

  process.exit(0);
}).catch(e => { console.error(e.message); process.exit(1); });
