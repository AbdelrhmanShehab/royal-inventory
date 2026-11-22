'use strict';

const ZKLib = require('zklib-js');
const sql = require('mssql');
const config = require('../src/config/index');

async function syncZkDeviceToDatabase() {
  const deviceIp = config.zkDb.deviceIp || '192.168.50.205';
  const sensorId = config.zkDb.laundrySensorId || '104';
  const zk = new ZKLib(deviceIp, 4370, 5000, 4000);

  console.log(`[ZK Sync] Connecting to device ${deviceIp}:4370...`);
  await zk.createSocket();
  const sn = (await zk.getSerialNumber() || config.zkDb.laundrySn || 'CQUL232462270').trim();
  console.log(`[ZK Sync] Connected! Serial: ${sn}`);

  const rawLogs = await zk.getAttendances();
  await zk.disconnect();

  const allLogs = rawLogs.data || rawLogs;
  console.log(`[ZK Sync] Total logs on device: ${allLogs.length}`);

  // Connect to ZK SQL Database
  const dbConfig = {
    server: config.zkDb.server,
    port: config.zkDb.port,
    database: config.zkDb.database,
    user: config.zkDb.user,
    password: config.zkDb.password,
    options: {
      encrypt: config.zkDb.encrypt,
      trustServerCertificate: config.zkDb.trustServerCertificate,
    }
  };

  const pool = await sql.connect(dbConfig);
  console.log(`[ZK Sync] Connected to SQL Server ${dbConfig.server} (${dbConfig.database})`);

  // Build BADGENUMBER -> USERID cache
  const usersRes = await pool.request().query('SELECT USERID, BADGENUMBER FROM dbo.USERINFO');
  const badgeMap = new Map();
  usersRes.recordset.forEach(u => {
    if (u.BADGENUMBER) badgeMap.set(String(u.BADGENUMBER).trim(), u.USERID);
    badgeMap.set(String(u.USERID), u.USERID);
  });

  // Only consider logs from the last 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recentLogs = allLogs.filter(l => new Date(l.recordTime) >= sevenDaysAgo);
  console.log(`[ZK Sync] Logs within last 7 days: ${recentLogs.length}`);

  let insertedCount = 0;
  for (const log of recentLogs) {
    const badgeStr = String(log.deviceUserId).trim();
    const userId = badgeMap.get(badgeStr) || parseInt(badgeStr, 10);
    if (!userId) continue;

    const checkTime = new Date(log.recordTime);
    const queryStr = `
      IF NOT EXISTS (SELECT 1 FROM dbo.CHECKINOUT WHERE USERID = @userId AND CHECKTIME = @checkTime)
      BEGIN
        INSERT INTO dbo.CHECKINOUT (USERID, CHECKTIME, CHECKTYPE, VERIFYCODE, SENSORID, WorkCode, sn, UserExtFmt)
        VALUES (@userId, @checkTime, 'I', 1, @sensorId, '0', @sn, 0);
        SELECT 1 AS inserted;
      END
      ELSE
      BEGIN
        SELECT 0 AS inserted;
      END
    `;

    const res = await pool.request()
      .input('userId', sql.Int, userId)
      .input('checkTime', sql.DateTime, checkTime)
      .input('sensorId', sql.NVarChar(50), sensorId)
      .input('sn', sql.NVarChar(50), sn)
      .query(queryStr);

    if (res.recordset[0]?.inserted === 1) {
      insertedCount++;
    }
  }

  console.log(`[ZK Sync] Successfully inserted ${insertedCount} new attendance logs into CHECKINOUT!`);
  await pool.close();
  return { totalDeviceLogs: allLogs.length, insertedCount };
}

if (require.main === module) {
  syncZkDeviceToDatabase()
    .then(r => {
      console.log('[ZK Sync] Done:', r);
      process.exit(0);
    })
    .catch(err => {
      console.error('[ZK Sync] Failed:', err);
      process.exit(1);
    });
}

module.exports = { syncZkDeviceToDatabase };
