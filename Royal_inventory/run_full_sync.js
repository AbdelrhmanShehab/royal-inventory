'use strict';
require('dotenv').config();
const { connectSystemDB } = require('./src/config/database');
const { connectComsysDB } = require('./src/config/comsys.database');
const syncService = require('./src/api/v1/sync/sync.service');

async function run() {
  try {
    console.log('Connecting to databases...');
    await connectSystemDB();
    await connectComsysDB();

    console.log('Triggering full sync (warehouses, items, and stock balances)...');
    const result = await syncService.syncAll('fb', 'console-migration');
    console.log('Sync completed successfully!');
    console.log('Result:', result);
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

run();
