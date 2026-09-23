'use strict';
const { connectSystemDB, getSystemDB, sql } = require('../src/config/database');

connectSystemDB().then(async () => {
  const pool = getSystemDB();

  // Check which nodes have stock data and which don't
  const r = await pool.request().query(`
    SELECT n.node_id, n.node_name_ar, n.node_type,
           COUNT(s.stock_id) AS stockRecords,
           ISNULL(SUM(s.qty_operational), 0) AS totalQty
    FROM ops.inventory_nodes n
    LEFT JOIN ops.operational_stock s ON n.node_id = s.node_id
    WHERE n.is_active = 1
    GROUP BY n.node_id, n.node_name_ar, n.node_type
    ORDER BY totalQty DESC
  `);
  
  console.log('=== Nodes stock summary ===');
  r.recordset.forEach(row => {
    console.log(`Node ${row.node_id} [${row.node_type}] "${row.node_name_ar}": ${row.stockRecords} items, total=${row.totalQty}`);
  });

  // Check what user Msamir is assigned to
  const u = await pool.request().query(`
    SELECT u.id, u.username, u.warehouse_node_id, u.role,
           n.node_name_ar, n.node_type
    FROM ops.system_users u
    LEFT JOIN ops.inventory_nodes n ON u.warehouse_node_id = n.node_id
    WHERE u.username = 'Msamir' OR u.username = 'msamir'
  `);
  console.log('\n=== User Msamir details ===');
  console.log(JSON.stringify(u.recordset, null, 2));

  process.exit(0);
}).catch(e => { console.error('ERROR:', e.message); process.exit(1); });
