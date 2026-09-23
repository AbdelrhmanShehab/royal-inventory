const { getSystemDB, connectSystemDB } = require('../src/config/database');

async function alignStock() {
  await connectSystemDB();
  const pool = getSystemDB();

  await pool.request().query(`
    -- Node 11 Item 33005: 24 received, 20 transferred, 4 operational
    UPDATE ops.operational_stock
    SET qty_received = 24,
        qty_internal_in = 0,
        qty_returned_in = 0,
        qty_transferred_out = 20,
        qty_laundry = 0,
        qty_returned_out = 0,
        qty_consumed = 0,
        qty_damaged = 0,
        qty_wasted = 0,
        qty_disposed = 0
    WHERE node_id = 11 AND item_code = '33005';

    -- Node 11 Item 33007: 12 received, 8 operational, 2 laundry, 1 consumed, 1 damaged
    UPDATE ops.operational_stock
    SET qty_received = 12,
        qty_internal_in = 0,
        qty_returned_in = 0,
        qty_transferred_out = 0,
        qty_laundry = 2,
        qty_returned_out = 0,
        qty_consumed = 1,
        qty_damaged = 1,
        qty_wasted = 0,
        qty_disposed = 0
    WHERE node_id = 11 AND item_code = '33007';

    -- Node 11 Item 33008: 15 received, 10 transferred, 5 operational
    UPDATE ops.operational_stock
    SET qty_received = 15,
        qty_internal_in = 0,
        qty_returned_in = 0,
        qty_transferred_out = 10,
        qty_laundry = 0,
        qty_returned_out = 0,
        qty_consumed = 0,
        qty_damaged = 0,
        qty_wasted = 0,
        qty_disposed = 0
    WHERE node_id = 11 AND item_code = '33008';
  `);

  const res = await pool.request().query(`
    SELECT item_code, qty_received, qty_transferred_out, qty_laundry, qty_returned_out, qty_consumed, qty_damaged, qty_operational
    FROM ops.operational_stock
    WHERE node_id = 11 AND item_code IN ('33005', '33007', '33008', '33100')
  `);
  console.log("ALIGNED STOCK:", JSON.stringify(res.recordset, null, 2));
  process.exit(0);
}

alignStock();
