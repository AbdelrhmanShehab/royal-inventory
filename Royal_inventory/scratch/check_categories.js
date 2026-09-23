'use strict';
require('dotenv').config();
const { connectSystemDB, getSystemDB, sql } = require('../src/config/database');

(async () => {
  try {
    await connectSystemDB();
    const pool = getSystemDB();
    
    // Check distinct category_codes
    const cats = await pool.request().query(`
      SELECT DISTINCT category_code, COUNT(*) as cnt
      FROM ops.comsys_items
      GROUP BY category_code
      ORDER BY category_code
    `);
    console.log('=== ALL CATEGORY CODES ===');
    console.table(cats.recordset);

    // Check if any items have category_code = '26'
    const cat26 = await pool.request().query(`
      SELECT TOP 5 item_code, item_name_ar, category_code, item_type
      FROM ops.comsys_items
      WHERE category_code = '26'
    `);
    console.log('\n=== ITEMS WITH category_code = 26 ===');
    console.table(cat26.recordset);

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
