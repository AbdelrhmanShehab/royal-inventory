'use strict';

/**
 * ZK Live Device Listener & Sync Service
 * Connects directly to the physical ZKTeco device (192.168.50.205:4370)
 * Captures real-time fingerprint punches and persists them immediately into Zktime.dbo.CHECKINOUT
 */

const ZKLib = require('zklib-js');
const { getZkDB, sql } = require('../config/zk.database');
const config = require('../config/index');
const logger = require('../utils/logger');

let zkInstance = null;
let isConnected = false;
let isConnecting = false;
let shouldRun = false;
let reconnectTimer = null;
let safetySyncTimer = null;
let badgeMap = new Map();
let lastBadgeRefresh = 0;

/**
 * Refresh badge to userId mapping from Zktime.dbo.USERINFO
 */
const refreshBadgeCache = async () => {
  try {
    const pool = getZkDB();
    if (!pool) return;

    const res = await pool.request().query('SELECT USERID, BADGENUMBER, NAME FROM dbo.USERINFO');
    const newMap = new Map();
    res.recordset.forEach(u => {
      if (u.BADGENUMBER) {
        newMap.set(String(u.BADGENUMBER).trim(), { userId: u.USERID, name: u.NAME });
      }
      newMap.set(String(u.USERID), { userId: u.USERID, name: u.NAME });
    });
    badgeMap = newMap;
    lastBadgeRefresh = Date.now();
  } catch (err) {
    logger.warn('[ZK Listener] Failed to refresh badge cache from USERINFO:', { error: err.message });
  }
};

/**
 * Save a punch to dbo.CHECKINOUT in Zktime database
 */
const persistPunch = async (deviceUserId, checkTimeRaw) => {
  try {
    const pool = getZkDB();
    if (!pool) {
      logger.warn('[ZK Listener] ZK DB pool not available, cannot persist punch');
      return false;
    }

    if (Date.now() - lastBadgeRefresh > 5 * 60 * 1000) {
      await refreshBadgeCache();
    }

    const badgeStr = String(deviceUserId || '').trim();
    const userMeta = badgeMap.get(badgeStr);
    const userId = userMeta ? userMeta.userId : parseInt(badgeStr, 10);
    const userName = userMeta ? userMeta.name : 'Unknown';

    if (!userId || isNaN(userId)) {
      logger.warn(`[ZK Listener] Could not resolve userId for deviceUserId: ${badgeStr}`);
      return false;
    }

    const checkTime = checkTimeRaw instanceof Date ? checkTimeRaw : new Date(checkTimeRaw);
    if (isNaN(checkTime.getTime())) {
      logger.warn(`[ZK Listener] Invalid checkTime: ${checkTimeRaw}`);
      return false;
    }

    const sensorId = String(config.zkDb.laundrySensorId || '104');
    const serialNumber = String(config.zkDb.laundrySn || 'CQUL232462270');

    const res = await pool.request()
      .input('userId', sql.Int, userId)
      .input('checkTime', sql.DateTime, checkTime)
      .input('sensorId', sql.NVarChar(50), sensorId)
      .input('sn', sql.NVarChar(50), serialNumber)
      .query(`
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
      `);

    const inserted = res.recordset[0]?.inserted === 1;
    if (inserted) {
      logger.info(`✅ [ZK Live] Fingerprint recorded for ${userName} (Badge: ${badgeStr}, ID: ${userId}) at ${checkTime.toISOString()}`);
    }
    return inserted;
  } catch (err) {
    logger.error('[ZK Listener] Error persisting punch to CHECKINOUT:', { error: err.message });
    return false;
  }
};

/**
 * Safety Sync: Pull recent logs from device to guarantee zero missed punches
 */
const syncRecentLogs = async () => {
  if (!zkInstance || !isConnected) return;
  try {
    const rawLogs = await zkInstance.getAttendances();
    const allLogs = rawLogs.data || rawLogs || [];
    if (!Array.isArray(allLogs) || allLogs.length === 0) return;

    // Check last 24 hours (and ignore corrupted future dates)
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const maxFuture = new Date(Date.now() + 60 * 60 * 1000);
    const recent = allLogs.filter(l => {
      const d = new Date(l.recordTime);
      return !isNaN(d.getTime()) && d >= cutoff && d <= maxFuture;
    });

    let inserted = 0;
    for (const log of recent) {
      const didInsert = await persistPunch(log.deviceUserId, log.recordTime);
      if (didInsert) inserted++;
    }

    if (inserted > 0) {
      logger.info(`🔄 [ZK Sync] Synced ${inserted} punch(es) from device to database.`);
    }
  } catch (err) {
    // If device was busy, quietly retry next interval
    logger.debug('[ZK Sync] Periodic log sync notice:', { error: err.message });
  }
};

/**
 * Connect to device and bind real-time event listener
 */
const connectDevice = async () => {
  if (!shouldRun || isConnected || isConnecting) return;
  isConnecting = true;

  const deviceIp = config.zkDb.deviceIp || '192.168.50.205';
  const devicePort = 4370;

  try {
    logger.info(`🔌 [ZK Listener] Connecting to physical reader ${deviceIp}:${devicePort}...`);
    zkInstance = new ZKLib(deviceIp, devicePort, 5000, 4000);

    await zkInstance.createSocket();
    const sn = await zkInstance.getSerialNumber();
    isConnected = true;
    isConnecting = false;
    logger.info(`✅ [ZK Listener] Connected to reader ${deviceIp} (SN: ${String(sn).trim()})`);

    await refreshBadgeCache();
    await syncRecentLogs();

    // Register real-time event callback
    await zkInstance.getRealTimeLogs(async (realtimeLog) => {
      if (!realtimeLog) return;
      const uid = realtimeLog.userId;
      const attTime = realtimeLog.attTime || new Date();
      if (uid) {
        logger.info(`⚡ [ZK Listener] Real-time punch detected: Badge ${uid}`);
        await persistPunch(uid, attTime);
      }
    });

  } catch (err) {
    isConnecting = false;
    isConnected = false;
    zkInstance = null;
    logger.warn(`⚠️ [ZK Listener] Reader connection failed: ${err.message}. Retrying in 5 seconds...`);
    scheduleReconnect();
  }
};

const scheduleReconnect = () => {
  if (!shouldRun) return;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(() => {
    connectDevice();
  }, 5000);
};

/**
 * Start service lifecycle
 */
const startZkListener = async () => {
  shouldRun = true;
  await refreshBadgeCache();
  await connectDevice();

  // Connection watchdog: Check connection health and reconnect if disconnected
  if (!safetySyncTimer) {
    safetySyncTimer = setInterval(async () => {
      if (!shouldRun) return;
      if (!isConnected && !isConnecting) {
        await connectDevice();
      }
    }, 5000);
  }
};

/**
 * Stop service lifecycle
 */
const stopZkListener = async () => {
  shouldRun = false;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (safetySyncTimer) {
    clearInterval(safetySyncTimer);
    safetySyncTimer = null;
  }
  if (zkInstance) {
    try {
      await zkInstance.disconnect();
    } catch {
      // Ignore disconnect error on shutdown
    }
    zkInstance = null;
  }
  isConnected = false;
  isConnecting = false;
  logger.info('[ZK Listener] Stopped.');
};

module.exports = {
  startZkListener,
  stopZkListener,
  syncRecentLogs,
  refreshBadgeCache,
};
