'use strict';

const cron = require('node-cron');
const syncService = require('../api/v1/sync/sync.service');
const laundryService = require('../api/v1/laundry/laundry.service');
const logger = require('../utils/logger');

let cronJobs = [];

const initCronJobs = () => {
  logger.info('⏰ Initializing Background Cron Schedulers...');

  // 1. Cron Job to run every 10 minutes
  // Pattern: '*/10 * * * *' (Every 10 minutes)
  const tenMinuteSyncJob = cron.schedule('*/10 * * * *', async () => {
    logger.info('🔄 [Cron] Starting scheduled 10-minute synchronization job...');
    
    // A. Sync Comsys F&B Division master data & stock balances
    try {
      logger.info('🔄 [Cron] Syncing Comsys F&B Division master data...');
      await syncService.syncAll('fb', 'system_cron');
      logger.info('✅ [Cron] Comsys F&B Division sync completed.');
    } catch (err) {
      logger.error('❌ [Cron] Comsys F&B Division sync failed:', { error: err.message });
    }

    // B. Sync Comsys General Stores (GS) Division master data & stock balances
    try {
      logger.info('🔄 [Cron] Syncing Comsys General Stores (GS) Division master data...');
      await syncService.syncAll('gs', 'system_cron');
      logger.info('✅ [Cron] Comsys General Stores (GS) Division sync completed.');
    } catch (err) {
      logger.error('❌ [Cron] Comsys General Stores (GS) Division sync failed:', { error: err.message });
    }

    // C. Sync Laundry POS Sales Orders
    try {
      logger.info('🔄 [Cron] Syncing Comsys Laundry POS Sales Orders...');
      await laundryService.syncComsysPOSOrders(1); // System user ID 1
      logger.info('✅ [Cron] Comsys Laundry POS sales sync completed.');
    } catch (err) {
      logger.error('❌ [Cron] Comsys Laundry POS sales sync failed:', { error: err.message });
    }
  });

  cronJobs.push(tenMinuteSyncJob);
  logger.info('⏰ Background Cron Schedulers started successfully ✅ (Running every 10 minutes)');
};

const stopCronJobs = () => {
  logger.info('⏰ Stopping Background Cron Schedulers...');
  cronJobs.forEach(job => job.stop());
  cronJobs = [];
};

module.exports = {
  initCronJobs,
  stopCronJobs,
};
