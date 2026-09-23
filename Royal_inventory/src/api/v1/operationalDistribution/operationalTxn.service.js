'use strict';

const txnRepo = require('../../../repositories/system/operationalTxn.repo');
const locationRepo = require('../../../repositories/system/operationalLocation.repo');
const stockRepo = require('../../../repositories/system/stock.repo');
const itemRepo = require('../../../repositories/system/item.repo');
const logger = require('../../../utils/logger');
const { getOrSet, CACHE_KEYS, TTL } = require('../../../config/cache');
const { invalidateSummaryCache } = require('../../../services/operationalDistribution.cache');
const { NotFoundError, BadRequestError, InsufficientStockError } = require('../../../utils/errors');
const { TRANSACTION_TYPES } = require('./operationalTxn.model');

/**
 * Helper: Calculate net balance of an item in a specific operational location.
 * balance = allocated - consumed - returned + adjusted
 */
const getLocationBalance = async (locationId, itemCode) => {
  const aggregates = await txnRepo.getLocationAggregatedBalances(locationId, itemCode);
  if (!aggregates || aggregates.length === 0) return 0;
  const agg = aggregates[0];
  return parseFloat(agg.allocated || 0)
       - parseFloat(agg.consumed || 0)
       - parseFloat(agg.returned || 0)
       + parseFloat(agg.adjusted || 0);
};

/**
 * Helper: Calculate total net allocated stock of an item across all locations in a node.
 */
const getNodeNetAllocated = async (nodeId, itemCode) => {
  const nodeBalances = await txnRepo.getNodeAggregatedBalances(nodeId, itemCode);
  return nodeBalances.reduce((sum, row) => {
    return sum + (parseFloat(row.allocated || 0)
                - parseFloat(row.consumed || 0)
                - parseFloat(row.returned || 0)
                + parseFloat(row.adjusted || 0));
  }, 0);
};

/**
 * Validate that the location exists, is active, and belongs to the specified nodeId.
 */
const validateLocationAndNode = async (locationId, nodeId) => {
  const location = await locationRepo.getLocationById(locationId);
  if (!location) {
    throw new NotFoundError('الموقع التشغيلي غير موجود');
  }
  if (!location.isActive) {
    throw new BadRequestError('الموقع التشغيلي المحدد غير نشط');
  }
  if (location.nodeId !== nodeId) {
    throw new BadRequestError('الموقع التشغيلي المحدد لا ينتمي لعقدة المخزن الحالية');
  }
  return location;
};

/**
 * Validate that item exists in comsys items
 */
const validateItemExists = async (itemCode) => {
  const item = await itemRepo.getItemByCode(itemCode);
  if (!item) {
    throw new NotFoundError(`رمز الصنف [${itemCode}] غير موجود في بيانات كوم سيس`);
  }
  return item;
};

/**
 * ALLOCATE transaction
 */
const allocate = async ({ nodeId, locationId, itemCode, quantity, notes = null, referenceType = null, referenceId = null, createdBy }) => {
  // Validate location & item
  await validateLocationAndNode(locationId, nodeId);
  await validateItemExists(itemCode);

  // Fetch official stock quantity in this node
  const stockItem = await stockRepo.getStockByNodeAndItem(nodeId, itemCode);
  const officialQty = stockItem ? parseFloat(stockItem.qtyOperational) : 0;

  // Calculate current node-wide net allocation
  const currentNetAllocated = await getNodeNetAllocated(nodeId, itemCode);
  const newNetAllocated = currentNetAllocated + quantity;

  // Conflict Detection: If allocated > official, reject allocation to preserve stock integrity
  if (newNetAllocated > officialQty) {
    logger.error('[Conflict Rejection] Allocated quantity exceeds official stock balance', {
      nodeId,
      itemCode,
      officialQty,
      newNetAllocated,
      excess: newNetAllocated - officialQty
    });
    throw new BadRequestError(`الكمية المطلوبة للتخصيص (${quantity}) ستؤدي لتجاوز الرصيد المتاح بالمستودع الرئيسي (${officialQty})`);
  }

  const txnId = await txnRepo.createTransaction({
    tenantId: 1,
    nodeId,
    locationId,
    itemCode,
    transactionType: TRANSACTION_TYPES.ALLOCATE,
    quantity,
    notes,
    referenceType,
    referenceId,
    createdBy,
  });

  invalidateSummaryCache(nodeId, itemCode);
  return { txnId, syncStatus: newNetAllocated > officialQty ? 'OUT_OF_SYNC' : 'IN_SYNC' };
};

/**
 * CONSUME transaction
 */
const consume = async ({ nodeId, locationId, itemCode, quantity, notes = null, createdBy }) => {
  await validateLocationAndNode(locationId, nodeId);
  await validateItemExists(itemCode);

  // Check if location has enough balance
  const locBalance = await getLocationBalance(locationId, itemCode);
  if (quantity > locBalance) {
    throw new InsufficientStockError(
      `الكمية المطلوبة [${quantity}] غير متوفرة في الموقع التشغيلي. الرصيد الحالي: ${locBalance}`
    );
  }

  const txnId = await txnRepo.createTransaction({
    tenantId: 1,
    nodeId,
    locationId,
    itemCode,
    transactionType: TRANSACTION_TYPES.CONSUME,
    quantity,
    notes,
    createdBy,
  });

  invalidateSummaryCache(nodeId, itemCode);
  return { txnId };
};

/**
 * RETURN transaction
 */
const returnStock = async ({ nodeId, locationId, itemCode, quantity, notes = null, createdBy }) => {
  await validateLocationAndNode(locationId, nodeId);
  await validateItemExists(itemCode);

  // Check if location has enough balance to return
  const locBalance = await getLocationBalance(locationId, itemCode);
  if (quantity > locBalance) {
    throw new InsufficientStockError(
      `الكمية المراد إرجاعها [${quantity}] أكبر من رصيد الموقع التشغيلي المتاح. الرصيد الحالي: ${locBalance}`
    );
  }

  const txnId = await txnRepo.createTransaction({
    tenantId: 1,
    nodeId,
    locationId,
    itemCode,
    transactionType: TRANSACTION_TYPES.RETURN,
    quantity,
    notes,
    createdBy,
  });

  invalidateSummaryCache(nodeId, itemCode);
  return { txnId };
};

/**
 * ADJUSTMENT transaction
 */
const adjustment = async ({ nodeId, locationId, itemCode, quantity, notes, createdBy }) => {
  await validateLocationAndNode(locationId, nodeId);
  await validateItemExists(itemCode);

  // If negative adjustment, verify location balance will not drop below zero
  if (quantity < 0) {
    const locBalance = await getLocationBalance(locationId, itemCode);
    if (locBalance + quantity < 0) {
      throw new InsufficientStockError(
        `تعديل رصيد الموقع التشغيلي بقيمة سالبة [${quantity}] سيتسبب في رصيد سالب غير مسموح به. الرصيد الحالي: ${locBalance}`
      );
    }
  }

  const txnId = await txnRepo.createTransaction({
    tenantId: 1,
    nodeId,
    locationId,
    itemCode,
    transactionType: TRANSACTION_TYPES.ADJUSTMENT,
    quantity,
    notes,
    createdBy,
  });

  invalidateSummaryCache(nodeId, itemCode);
  return { txnId };
};

/**
 * Get Stock Summary for a Node (optionally filtered by itemCode)
 */
const getStockSummary = async (nodeId, itemCode = null) => {
  const cacheKey = itemCode 
    ? CACHE_KEYS.OP_STOCK_SUMMARY_ITEM(nodeId, itemCode)
    : CACHE_KEYS.OP_STOCK_SUMMARY(nodeId);

  return getOrSet(
    cacheKey,
    async () => {
      // 1. Fetch official stock from ops.operational_stock
      let officialStocks = [];
      if (itemCode) {
        const itemStock = await stockRepo.getStockByNodeAndItem(nodeId, itemCode);
        if (itemStock) officialStocks.push(itemStock);
      } else {
        officialStocks = await stockRepo.getStockByNode(nodeId);
      }

      // 2. Fetch aggregated operational transaction balances
      const aggregatedTxns = await txnRepo.getNodeAggregatedBalances(nodeId, itemCode);

      // 3. Fetch active locations for this node
      const locations = await locationRepo.getLocationsByNodeId(nodeId);

      // 4. Group all unique item codes
      const itemCodesSet = new Set([
        ...officialStocks.map(s => s.itemCode),
        ...aggregatedTxns.map(t => t.itemCode)
      ]);

      // Fetch details of all items from DB for naming and unit info
      const allItemsData = await itemRepo.getAllItems();
      const itemsMap = new Map(allItemsData.map(i => [i.itemCode, i]));

      let overallSyncStatus = 'IN_SYNC';
      const itemsSummaryList = [];

      for (const code of itemCodesSet) {
        const itemInfo = itemsMap.get(code);
        const officialItem = officialStocks.find(s => s.itemCode === code);
        const officialQty = officialItem ? parseFloat(officialItem.qtyOperational) : 0;

        // Aggregate across locations
        const itemTxns = aggregatedTxns.filter(t => t.itemCode === code);
        const totalAllocated = itemTxns.reduce((sum, t) => sum + parseFloat(t.allocated || 0), 0);
        const totalConsumed  = itemTxns.reduce((sum, t) => sum + parseFloat(t.consumed || 0), 0);
        const totalReturned  = itemTxns.reduce((sum, t) => sum + parseFloat(t.returned || 0), 0);
        const totalAdjusted  = itemTxns.reduce((sum, t) => sum + parseFloat(t.adjusted || 0), 0);

        const netAllocated = totalAllocated - totalConsumed - totalReturned + totalAdjusted;
        const availableToAllocate = officialQty - netAllocated;
        const itemSyncStatus = netAllocated > officialQty ? 'OUT_OF_SYNC' : 'IN_SYNC';

        if (itemSyncStatus === 'OUT_OF_SYNC') {
          overallSyncStatus = 'OUT_OF_SYNC';
        }

        // Map location breakdown details
        const locationBreakdown = locations.map(loc => {
          const locTxn = itemTxns.find(t => t.locationId === loc.id);
          const allocated = locTxn ? parseFloat(locTxn.allocated || 0) : 0;
          const consumed  = locTxn ? parseFloat(locTxn.consumed || 0) : 0;
          const returned  = locTxn ? parseFloat(locTxn.returned || 0) : 0;
          const adjusted  = locTxn ? parseFloat(locTxn.adjusted || 0) : 0;
          const balance   = allocated - consumed - returned + adjusted;

          return {
            locationId: loc.id,
            locationName: loc.name,
            allocated,
            consumed,
            returned,
            adjusted,
            balance,
          };
        });

        itemsSummaryList.push({
          itemCode: code,
          itemNameAr: itemInfo ? itemInfo.itemNameAr : (officialItem ? officialItem.itemNameAr : 'صنف غير معروف'),
          unitNameAr: itemInfo ? itemInfo.unitNameAr : (officialItem ? officialItem.unitNameAr : 'حبة'),
          officialQuantity: officialQty,
          totalAllocated,
          totalConsumed,
          totalReturned,
          totalAdjusted,
          netAllocated,
          availableToAllocate,
          syncStatus: itemSyncStatus,
          conflictDelta: itemSyncStatus === 'OUT_OF_SYNC' ? (officialQty - netAllocated) : 0,
          locations: locationBreakdown,
        });
      }

      return {
        nodeId,
        syncStatus: overallSyncStatus,
        items: itemsSummaryList,
      };
    },
    TTL.OP_STOCK_SUMMARY
  );
};

module.exports = {
  allocate,
  consume,
  returnStock,
  adjustment,
  getStockSummary,
};
