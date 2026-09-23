'use strict';

const comsysWarehouseRepo = require('../../../repositories/comsys/comsysWarehouses.repo');
const comsysItemRepo = require('../../../repositories/comsys/comsysItem.repo');
const systemSyncRepo = require('../../../repositories/system/comsysSync.repo');
const logger = require('../../../utils/logger');

/**
 * Sync Service — manages the execution flow of pulling data from Comsys
 * and caching it locally in our System DB.
 */

/**
 * Execute sync of warehouses for a specific division.
 * @param {'fb'|'gs'} division
 * @param {string} triggeredBy
 */
const syncWarehouses = async (division = 'fb', triggeredBy = 'system') => {
  logger.info(`[SyncService] Starting warehouses sync for division: ${division}`);
  const syncId = await systemSyncRepo.createSyncLog(`warehouses_${division}`, triggeredBy);

  try {
    const rawWarehouses = await comsysWarehouseRepo.getAllWarehouses(division);
    const count = await systemSyncRepo.upsertWarehouses(rawWarehouses, division);

    logger.info(`[SyncService] Warehouses sync completed: ${count} synced`);
    await systemSyncRepo.updateSyncLog(syncId, 'success', count);
    return count;
  } catch (err) {
    logger.error(`[SyncService] Warehouses sync failed: ${err.message}`);
    await systemSyncRepo.updateSyncLog(syncId, 'failed', 0, err.message);
    throw err;
  }
};

/**
 * Execute sync of items for a specific division.
 * @param {'fb'|'gs'} division
 * @param {string} triggeredBy
 */
const syncItems = async (division = 'fb', triggeredBy = 'system') => {
  logger.info(`[SyncService] Starting items sync for division: ${division}`);
  const syncId = await systemSyncRepo.createSyncLog(`items_${division}`, triggeredBy);

  try {
    const rawItems = await comsysItemRepo.getAllItems(division);
    const count = await systemSyncRepo.upsertItems(rawItems, division);

    logger.info(`[SyncService] Items sync completed: ${count} synced`);
    await systemSyncRepo.updateSyncLog(syncId, 'success', count);
    return count;
  } catch (err) {
    logger.error(`[SyncService] Items sync failed: ${err.message}`);
    await systemSyncRepo.updateSyncLog(syncId, 'failed', 0, err.message);
    throw err;
  }
};

/**
 * Execute sync of stock balances for a specific division.
 * @param {'fb'|'gs'} division
 * @param {string} triggeredBy
 */
const syncStockBalances = async (division = 'fb', triggeredBy = 'system') => {
  logger.info(`[SyncService] Starting stock balances sync for division: ${division}`);
  const syncId = await systemSyncRepo.createSyncLog(`stock_${division}`, triggeredBy);

  try {
    const rawBalances = await comsysWarehouseRepo.getAverageCost(division);
    const count = await systemSyncRepo.upsertStockBalances(rawBalances, division);

    logger.info(`[SyncService] Stock balances sync completed: ${count} synced`);
    await systemSyncRepo.updateSyncLog(syncId, 'success', count);
    return count;
  } catch (err) {
    logger.error(`[SyncService] Stock balances sync failed: ${err.message}`);
    await systemSyncRepo.updateSyncLog(syncId, 'failed', 0, err.message);
    throw err;
  }
};

/**
 * Execute full sync (warehouses, items, and stock balances) for a division.
 * @param {'fb'|'gs'} division
 * @param {string} triggeredBy
 */
const syncAll = async (division = 'fb', triggeredBy = 'system') => {
  logger.info(`[SyncService] Starting full sync for division: ${division}`);
  const wCount = await syncWarehouses(division, triggeredBy);
  const iCount = await syncItems(division, triggeredBy);
  const sCount = await syncStockBalances(division, triggeredBy);
  return { warehouses: wCount, items: iCount, stockBalances: sCount };
};

module.exports = {
  syncWarehouses,
  syncItems,
  syncStockBalances,
  syncAll,
};
