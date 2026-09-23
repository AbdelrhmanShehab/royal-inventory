'use strict';
const { connectSystemDB, getSystemDB } = require('../src/config/database');

connectSystemDB().then(async () => {
  const pool = getSystemDB();
  const r = await pool.request().query(`
    SELECT column_name, data_type, character_maximum_length, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'ops' AND table_name = 'comsys_warehouses'
  `);
  console.log('=== comsys_warehouses columns ===');
  console.log(r.recordset);
  process.exit(0);
}).catch(e => { console.error(e.message); process.exit(1); });
