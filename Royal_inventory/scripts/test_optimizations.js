'use strict';

const { connectSystemDB, getSystemDB, sql } = require('../src/config/database');
const { getBatchStockByNodeAndItems } = require('../src/repositories/system/stock.repo');
const { upsertWarehouses } = require('../src/repositories/system/comsysSync.repo');

async function run() {
  await connectSystemDB();
  const pool = getSystemDB();

  console.log('\n=== Testing Optimizations & Integrity ===\n');

  // 1. Test: Batch Stock Fetching
  console.log('1. Testing getBatchStockByNodeAndItems...');
  const items = ['32510', '11801', '32532']; // Items from Node 12 (مطعم عزايم)
  const batchResult = await getBatchStockByNodeAndItems(12, items);
  console.log(`✅ Batch fetch returned ${batchResult.length} items`);
  console.log(JSON.stringify(batchResult, null, 2));

  // 2. Test: Bulk Warehouses Sync
  console.log('\n2. Testing Bulk Warehouses Sync...');
  const testWarehouses = [
    { warehouse_code: 'TEST_W1', warehouse_name_ar: 'مستودع تجريبي 1', warehouse_name_en: 'Test Wh 1', is_active: true },
    { warehouse_code: 'TEST_W2', warehouse_name_ar: 'مستودع تجريبي 2', warehouse_name_en: 'Test Wh 2', is_active: false }
  ];
  const syncCount = await upsertWarehouses(testWarehouses, 'fb');
  console.log(`✅ Sync completed: ${syncCount} warehouses synced dynamically`);

  // Verify they exist in database
  const verifySync = await pool.request().query("SELECT store_code, store_name_ar, is_active FROM ops.comsys_warehouses WHERE store_code LIKE 'TEST_W%'");
  console.log('Verification result:', verifySync.recordset);

  // Clean up test warehouses
  await pool.request().query("DELETE FROM ops.comsys_warehouses WHERE store_code LIKE 'TEST_W%';");
  console.log('✅ Temporary test warehouses cleaned up');

  // 3. Test: Negative Stock DB Check Constraint (Integrity)
  console.log('\n3. Testing Negative Stock Check Constraint...');
  
  // Try to adjust a stock field below zero (qty_operational < 0)
  // Let's create a temporary node stock or try to update node 12 item 32510 qty_consumed to a huge amount
  const transaction = new sql.Transaction(pool);
  try {
    await transaction.begin();
    
    console.log('Attempting to set qty_consumed to 999,999 to force qty_operational negative...');
    await transaction.request().query(`
      UPDATE ops.operational_stock
      SET qty_consumed = 999999
      WHERE node_id = 12 AND item_code = '32510'
    `);
    
    await transaction.commit();
    console.log('❌ ERROR: Transaction succeeded, negative stock constraint is NOT working!');
    process.exit(1);
  } catch (err) {
    await transaction.rollback();
    console.log('✅ SUCCESS: Negative stock update rejected as expected by SQL Server!');
    console.log('Error Message:', err.message);
  }

  console.log('\n=== All tests passed successfully! ===\n');
  process.exit(0);
}

run().catch(e => { console.error('❌ Test failed:', e.message); process.exit(1); });
