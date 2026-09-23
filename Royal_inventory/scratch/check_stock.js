const { getSystemDB, connectSystemDB } = require('../src/config/database');
(async () => {
  try {
    await connectSystemDB();
    const pool = getSystemDB();

    const idx = await pool.request().query(`
      SELECT i.name AS index_name, c.name AS column_name
      FROM sys.indexes i
      JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
      JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
      WHERE i.object_id = OBJECT_ID('ops.operational_stock')
    `);
    console.log("INDEXES ON ops.operational_stock:\n", JSON.stringify(idx.recordset, null, 2));

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
