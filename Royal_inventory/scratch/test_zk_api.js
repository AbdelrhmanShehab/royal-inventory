'use strict';

const { connectZkDB, closeZkDB } = require('../src/config/zk.database');
const repo = require('../src/repositories/system/zk.repo');
const config = require('../src/config/index');

async function runTest() {
  console.log('=== Starting ZKTime Repository Methods Integration Test ===');
  console.log(`Target Server: ${config.zkDb.server}`);
  console.log(`Database Name: ${config.zkDb.database}`);

  try {
    const pool = await connectZkDB();
    if (!pool) {
      console.error('❌ Failed to establish connection pool.');
      return;
    }
    console.log('✅ Connection pool initialized successfully.\n');

    // 1. Test getLatestCheckins
    console.log('--- 1. Testing getLatestCheckins(5) ---');
    try {
      const checkins = await repo.getLatestCheckins(5);
      console.log(`Retrieved ${checkins.length} recent checkins.`);
      if (checkins.length > 0) {
        console.log('Sample check-in record:', checkins[0]);
      } else {
        console.log('No checkin records found in CHECKINOUT table.');
      }
    } catch (err) {
      console.error('❌ getLatestCheckins failed:', err.message);
    }

    // 2. Test getDashboardStats
    console.log('\n--- 2. Testing getDashboardStats() ---');
    try {
      const stats = await repo.getDashboardStats();
      console.log('Dashboard statistics:', stats);
    } catch (err) {
      console.error('❌ getDashboardStats failed:', err.message);
    }

    // 3. Test getRecentDashboardTxns
    console.log('\n--- 3. Testing getRecentDashboardTxns(5) ---');
    try {
      const recentTxns = await repo.getRecentDashboardTxns(5);
      console.log(`Retrieved ${recentTxns.length} recent transactions.`);
      if (recentTxns.length > 0) {
        console.log('Sample transaction record:', recentTxns[0]);
      }
    } catch (err) {
      console.error('❌ getRecentDashboardTxns failed:', err.message);
    }

    // 4. Test getDashboardChartData
    console.log('\n--- 4. Testing getDashboardChartData(7) ---');
    try {
      const chartData = await repo.getDashboardChartData(7);
      console.log(`Retrieved ${chartData.length} daily chart data points.`);
      if (chartData.length > 0) {
        console.log('Sample chart data point:', chartData[0]);
      }
    } catch (err) {
      console.error('❌ getDashboardChartData failed:', err.message);
    }

    // 5. Test getEmployeeDetails
    console.log('\n--- 5. Testing getEmployeeDetails() ---');
    try {
      let testUserCode = '230'; // fallback example from screenshot
      
      // Find a user from UserInfo safely using a simple query
      const userRes = await pool.request().query('SELECT TOP 1 BADGENUMBER FROM UserInfo');
      if (userRes.recordset.length > 0) {
        testUserCode = userRes.recordset[0].BADGENUMBER;
      }
      
      console.log(`Fetching details for employee code: "${testUserCode}"`);
      const details = await repo.getEmployeeDetails(testUserCode);
      if (details) {
        console.log('✅ Employee details found:');
        console.log(`   Name: ${details.employee.name}`);
        console.log(`   User Code: ${details.employee.userCode}`);
        console.log(`   Custody Items Count: ${details.custody.length}`);
        if (details.custody.length > 0) {
          console.log('   Sample custody item:', details.custody[0]);
        }
        console.log(`   Recent transactions count: ${details.history.length}`);
      } else {
        console.log(`❌ Employee details NOT found for userCode: "${testUserCode}"`);
      }
    } catch (err) {
      console.error('❌ getEmployeeDetails failed:', err.message);
    }

  } catch (err) {
    console.error('❌ Repository Integration Test Error:', err.message, err.stack);
  } finally {
    await closeZkDB();
    console.log('\n=== ZKTime Integration Test Finished ===');
  }
}

runTest();
