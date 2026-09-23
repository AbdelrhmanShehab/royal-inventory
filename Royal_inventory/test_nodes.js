const { connectSystemDB } = require('./src/config/database');
(async () => {
  try {
    const pool = await connectSystemDB();
    const result = await pool.request().query(
      "WHERE TABLE_SCHEMA = 'ops' AND TABLE_NAME = 'inventory_nodes'"
      .replace('WHERE', 'SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE'));
    console.log(result.recordset.map(r => r.COLUMN_NAME).join(', '));
    process.exit(0);
  } catch(e) { console.error(e); process.exit(1); }
})();
