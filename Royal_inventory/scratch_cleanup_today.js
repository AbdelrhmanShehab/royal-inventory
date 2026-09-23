'use strict';

const sql = require('mssql');
require('dotenv').config();
const config = require('./src/config');

const mssqlConfig = {
  server: config.systemDb.server,
  port: config.systemDb.port,
  database: config.systemDb.database,
  user: config.systemDb.user,
  password: config.systemDb.password,
  options: {
    encrypt: config.systemDb.encrypt,
    trustServerCertificate: config.systemDb.trustServerCertificate,
    enableArithAbort: true,
  }
};

async function main() {
  try {
    const pool = new sql.ConnectionPool(mssqlConfig);
    await pool.connect();
    console.log('Connected to system DB!');

    // 1. Delete today's profitability record to recount fresh
    await pool.request().query("DELETE FROM ops.laundry_profitability WHERE date = '2026-07-02'");
    console.log('Deleted ops.laundry_profitability for today.');

    // 2. Delete today's ticket items and tickets imported from POS
    await pool.request().query(`
      DELETE FROM ops.laundry_ticket_items 
      WHERE ticket_id IN (SELECT ticket_id FROM ops.laundry_tickets WHERE pos_sale_id IS NOT NULL)
    `);
    console.log('Deleted ops.laundry_ticket_items.');

    await pool.request().query("DELETE FROM ops.laundry_tickets WHERE pos_sale_id IS NOT NULL");
    console.log('Deleted ops.laundry_tickets.');

    // 3. Clear sync logs to reset lastSync timestamp
    await pool.request().query("DELETE FROM ops.laundry_pos_sync_logs");
    console.log('Cleared ops.laundry_pos_sync_logs.');

    console.log('\n--- Cleanup successfully completed! ---');
    await pool.close();
  } catch (err) {
    console.error(err);
  }
}

main();
