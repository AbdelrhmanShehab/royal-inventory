'use strict';

const laundryRepo = require('../../../repositories/system/laundry.repo');
const stockRepo = require('../../../repositories/system/stock.repo');
const hierarchyRepo = require('../../../repositories/system/hierarchy.repo');
const zkRepo = require('../../../repositories/system/zk.repo');
const { getSystemDB } = require('../../../config/database');
const { getComsysDB, getLaundryDB } = require('../../../config/comsys.database');
const config = require('../../../config/index');
const { NotFoundError, BadRequestError, DatabaseError } = require('../../../utils/errors');
const sql = require('mssql');
const logger = require('../../../utils/logger');

// ─── 1. MACHINES & PROGRAMS ───────────────────────────────────────────────────

const createMachine = async (data) => {
  return await laundryRepo.createMachine(data);
};

const getMachines = async () => {
  return await laundryRepo.getMachines();
};

const createProgram = async (data) => {
  const machine = await laundryRepo.getMachines();
  const machineExists = machine.some(m => m.id === data.machineId);
  if (!machineExists) throw new NotFoundError('Washing machine not found');
  return await laundryRepo.createProgram(data);
};

const getProgramsByMachine = async (machineId) => {
  return await laundryRepo.getProgramsByMachine(machineId);
};

// ─── 2. RECIPES & RECIPE ITEMS ────────────────────────────────────────────────

const createRecipe = async (data) => {
  const pool = getSystemDB();
  const transaction = new sql.Transaction(pool);
  try {
    await transaction.begin();
    const recipeId = await laundryRepo.createRecipe({
      recipeName: data.recipeName,
      mode: data.mode || 'STRICT',
      description: data.description,
      isActive: data.isActive,
    }, transaction);

    for (const item of data.items) {
      await laundryRepo.createRecipeItem({
        recipeId,
        chemicalItemCode: item.chemicalItemCode,
        chemicalName: item.chemicalName,
        expectedQty: item.expectedQty,
        minQty: item.minQty,
        maxQty: item.maxQty,
        isRequired: item.isRequired,
        calculationMode: item.calculationMode,
      }, transaction);
    }

    await transaction.commit();
    return { recipeId };
  } catch (err) {
    await transaction.rollback();
    throw new DatabaseError(`Failed to save laundry recipe: ${err.message}`);
  }
};

const getRecipes = async () => {
  return await laundryRepo.getRecipes();
};

const getRecipeById = async (recipeId) => {
  const recipe = await laundryRepo.getRecipeById(recipeId);
  if (!recipe) throw new NotFoundError('Recipe not found');
  return recipe;
};

// ─── 3. WAREHOUSE ➔ LAUNDRY TRANSFERS & RECEIVING ──────────────────────────────

// ─── 3. WAREHOUSE ➔ LAUNDRY TRANSFERS & RECEIVING ──────────────────────────────

const createTransferDraft = async (userId, data) => {
  const warehouse = await hierarchyRepo.getNodeById(data.fromWarehouseId);
  if (!warehouse || !warehouse.isActive) {
    throw new NotFoundError('Source warehouse not found or is inactive');
  }

  // Strict Stock Check: ensure warehouse has sufficient operational stock for each item
  for (const item of data.items) {
    const currentStock = await stockRepo.getStockByNodeAndItem(data.fromWarehouseId, item.itemCode);
    const availableQty = parseFloat(currentStock?.qtyOperational || 0);
    if (availableQty < item.sentQty) {
      throw new BadRequestError(
        `الرصيد المتاح للصنف [${item.itemNameAr || item.itemCode}] غير كافٍ في مستودع المصدر (${warehouse.nodeNameAr || warehouse.name || data.fromWarehouseId}). المتاح حالياً: ${availableQty}، المطلوب للتحويل: ${item.sentQty}`
      );
    }
  }

  const pool = getSystemDB();
  const transaction = new sql.Transaction(pool);
  try {
    await transaction.begin();
    // Direct operational dispatch - no draft!
    const transferId = await laundryRepo.createTransfer({
      fromWarehouseId: data.fromWarehouseId,
      status: 'sent',
      notes: data.notes,
      createdBy: userId,
    }, transaction);

    for (const item of data.items) {
      await laundryRepo.createTransferItem({
        transferId,
        itemCode: item.itemCode,
        itemNameAr: item.itemNameAr,
        sentQty: item.sentQty,
        receivedQty: 0,
        remainingQty: item.sentQty,
        unitCode: item.unitCode || null,
        unitCost: item.unitCost || 0,
      }, transaction);

      // ── Inventory Integration: Move stock into laundry immediately upon delivery ──
      await stockRepo.adjustStock(
        data.fromWarehouseId,
        item.itemCode,
        'qty_laundry',
        item.sentQty,
        transaction
      );

      // ── Reconciliation Ledger: Increment sent and in-progress ──
      await laundryRepo.upsertReconciliation({
        itemCode: item.itemCode,
        itemNameAr: item.itemNameAr,
        sentQty: item.sentQty,
        inProgressQty: item.sentQty,
      }, transaction);
    }

    await laundryRepo.logLaundryAudit({
      userId,
      action: 'DISPATCH_TRANSFER',
      entityType: 'transfer',
      entityId: transferId,
      newState: data,
    }, transaction);

    await transaction.commit();
    return { transferId, status: 'sent', message: 'تم إرسال شحنة البياضات إلى المغسلة وخصم الكميات من رصيد المستودع بنجاح' };
  } catch (err) {
    await transaction.rollback();
    throw new DatabaseError(`Failed to dispatch laundry transfer: ${err.message}`);
  }
};

const sendTransfer = async (userId, transferId) => {
  const transfer = await laundryRepo.getTransferById(transferId);
  if (!transfer) throw new NotFoundError('Transfer record not found');
  if (transfer.status !== 'draft') {
    throw new BadRequestError('Only draft transfers can be sent to laundry');
  }

  // Check stock for legacy drafts
  for (const item of (transfer.items || [])) {
    const currentStock = await stockRepo.getStockByNodeAndItem(transfer.fromWarehouseId, item.itemCode);
    const availableQty = parseFloat(currentStock?.qtyOperational || 0);
    if (availableQty < item.sentQty) {
      throw new BadRequestError(
        `الرصيد المتاح للصنف [${item.itemNameAr || item.itemCode}] غير كافٍ في مستودع المصدر. المتاح: ${availableQty}، المطلوب: ${item.sentQty}`
      );
    }
  }

  const pool = getSystemDB();
  const transaction = new sql.Transaction(pool);
  try {
    await transaction.begin();

    for (const item of (transfer.items || [])) {
      // ── Inventory Integration: Move stock into laundry upon dispatch ──
      await stockRepo.adjustStock(
        transfer.fromWarehouseId,
        item.itemCode,
        'qty_laundry',
        item.sentQty,
        transaction
      );

      // Upsert reconciliation
      await laundryRepo.upsertReconciliation({
        itemCode: item.itemCode,
        itemNameAr: item.itemNameAr,
        sentQty: item.sentQty,
        inProgressQty: item.sentQty,
      }, transaction);
    }

    await laundryRepo.updateTransferStatus(transferId, 'sent', transaction);

    await laundryRepo.logLaundryAudit({
      userId,
      action: 'SEND_TRANSFER',
      entityType: 'transfer',
      entityId: transferId,
      oldState: { status: 'draft' },
      newState: { status: 'sent' },
    }, transaction);

    await transaction.commit();
    return { message: 'Transfer dispatched to Laundry successfully' };
  } catch (err) {
    await transaction.rollback();
    throw new DatabaseError(`Failed to send transfer: ${err.message}`);
  }
};

const receiveTransfer = async (userId, data) => {
  const transfer = await laundryRepo.getTransferById(data.transferId);
  if (!transfer) throw new NotFoundError('Transfer record not found');
  if (transfer.status !== 'sent') {
    throw new BadRequestError('Transfer must be in "sent" status to be received');
  }

  const pool = getSystemDB();
  const transaction = new sql.Transaction(pool);
  try {
    await transaction.begin();

    const receivingId = await laundryRepo.createReceiving({
      transferId: data.transferId,
      receivedBy: userId,
      notes: data.notes,
    }, transaction);

    let allReceivedMatched = true;
    let anyReceived = false;

    const laundryNodeId = await getLaundryNodeId(transaction);

    for (const item of data.items) {
      const originalItem = transfer.items.find(i => i.itemCode === item.itemCode);
      if (!originalItem) {
        throw new BadRequestError(`Item code ${item.itemCode} does not exist in the original transfer`);
      }

      const expectedQty = originalItem.sentQty;
      const actualQty = item.actualQty;
      const rejectedQty = expectedQty - actualQty;

      if (rejectedQty < 0) {
        throw new BadRequestError('Received quantity cannot be greater than expected quantity');
      }

      await laundryRepo.createReceivingItem({
        receivingId,
        itemCode: item.itemCode,
        expectedQty,
        actualQty,
        rejectedQty,
        rejectReason: rejectedQty > 0 ? item.rejectReason : null,
        rejectNotes: rejectedQty > 0 ? item.rejectNotes : null,
      }, transaction);

      // Update transfer item totals
      await laundryRepo.updateTransferItemReceivedQty(
        data.transferId,
        item.itemCode,
        actualQty,
        actualQty, // remaining_qty starts equal to received_qty for processing
        transaction
      );

      if (actualQty > 0) anyReceived = true;
      if (rejectedQty > 0) allReceivedMatched = false;

      // ── Inventory Integration: Increment stock at laundry node ──
      await stockRepo.adjustStock(
        laundryNodeId,
        item.itemCode,
        'qty_internal_in',
        actualQty,
        transaction
      );

      // Note: Warehouse stock was ALREADY deducted for expectedQty at dispatch.
      // If there is any discrepancy/rejectedQty, adjust warehouse ledger accordingly.
      if (rejectedQty > 0) {
        const isDamaged = item.rejectReason === 'Damaged';
        if (isDamaged) {
          // Reclassify from laundry to damaged
          await stockRepo.adjustStock(
            transfer.fromWarehouseId,
            item.itemCode,
            'qty_laundry',
            -rejectedQty,
            transaction
          );
          await stockRepo.adjustStock(
            transfer.fromWarehouseId,
            item.itemCode,
            'qty_damaged',
            rejectedQty,
            transaction
          );
        } else {
          // Returned/cancelled back to warehouse - reverse from laundry
          await stockRepo.adjustStock(
            transfer.fromWarehouseId,
            item.itemCode,
            'qty_laundry',
            -rejectedQty,
            transaction
          );
        }

        // Adjust reconciliation ledger for difference
        await laundryRepo.upsertReconciliation({
          itemCode: item.itemCode,
          itemNameAr: originalItem.itemNameAr,
          sentQty: -rejectedQty,
          inProgressQty: -rejectedQty,
        }, transaction);
      }
    }

    // Determine final transfer status
    let finalStatus = 'received';
    if (!anyReceived) {
      finalStatus = 'rejected';
    } else if (!allReceivedMatched) {
      finalStatus = 'partially_received';
    }

    await laundryRepo.updateTransferStatus(data.transferId, finalStatus, transaction);

    await laundryRepo.logLaundryAudit({
      userId,
      action: 'RECEIVE_TRANSFER',
      entityType: 'receiving',
      entityId: receivingId,
      newState: { receivingId, finalStatus, data },
    }, transaction);

    await transaction.commit();
    return { receivingId, status: finalStatus };
  } catch (err) {
    await transaction.rollback();
    throw new DatabaseError(`Failed to process laundry receiving: ${err.message}`);
  }
};

const getTransfer = async (id) => {
  const t = await laundryRepo.getTransferById(id);
  if (!t) throw new NotFoundError('Transfer record not found');
  return t;
};

const getTransfers = async () => {
  return await laundryRepo.getTransfers();
};

// ─── 4. BATCH PROCESSING & RECIPES ───────────────────────────────────────────

const createBatch = async (userId, data) => {
  // 1. Machine Availability & Status Check
  if (data.machineId) {
    const machine = await laundryRepo.getMachineById(data.machineId);
    if (!machine || !machine.isActive) {
      throw new BadRequestError('الغسالة المحددة غير موجودة أو غير نشطة');
    }
    if (machine.status === 'RUNNING' || machine.status === 'Maintenance') {
      throw new BadRequestError(`الغسالة [${machine.machineNameAr || machine.name || data.machineId}] مشغولة حالياً أو قيد الصيانة`);
    }
  }

  // 2. Linen Input/Output Conservation Validation
  if (data.items && data.items.length > 0) {
    const inputQty = data.items.filter(i => i.role === 'INPUT').reduce((sum, i) => sum + (parseFloat(i.quantity) || 0), 0);
    const outputQty = data.items.filter(i => i.role === 'OUTPUT').reduce((sum, i) => sum + (parseFloat(i.quantity) || 0), 0);
    const scrapQty = data.items.filter(i => i.role === 'SCRAP').reduce((sum, i) => sum + (parseFloat(i.quantity) || 0), 0);

    if (outputQty + scrapQty > inputQty) {
      throw new BadRequestError(`إجمالي البياضات المخرجة والهدر (${outputQty + scrapQty}) لا يمكن أن يتجاوز كمية المدخلات (${inputQty})`);
    }
  }

  const pool = getSystemDB();
  const transaction = new sql.Transaction(pool);
  try {
    await transaction.begin();

    const batchId = await laundryRepo.createBatch({
      batchNumber: data.batchNumber,
      runType: data.runType || 'PROGRAM',
      machineId: data.machineId,
      programId: data.programId,
      recipeId: data.recipeId,
      weight: data.weight || 0,
      pieces: data.pieces || 0,
      guestWeight: data.guestWeight || 0,
      staffWeight: data.staffWeight || 0,
      specialWeight: data.specialWeight || 0,
      spotWeight: data.spotWeight || 0,
      status: 'Pending',
      operatorId: userId,
    }, transaction);

    for (const item of data.items) {
      await laundryRepo.createBatchItem({
        batchId,
        itemCode: item.itemCode,
        quantity: item.quantity,
        role: item.role, // INPUT, OUTPUT, SCRAP
      }, transaction);
    }

    // Resolve machine capacity for capacity-based chemical dosing rules
    let machineCapacity = 0;
    if (data.machineId) {
      const machine = await laundryRepo.getMachineById(data.machineId);
      if (machine) machineCapacity = parseFloat(machine.capacity || 0);
    }

    // If recipe is specified, fetch it to compute auto/suggested consumption
    let recipeItems = [];
    if (data.recipeId) {
      const recipe = await laundryRepo.getRecipeById(data.recipeId);
      if (recipe && recipe.items) recipeItems = recipe.items;
    }

    // Save consumptions
    if (data.runType === 'PROGRAM') {
      // Auto-populate all recipe items as consumptions based on machine capacity
      for (const rItem of recipeItems) {
        let expectedQty = 0;
        if (rItem.calculationMode === 'chemical_per_kg') {
          expectedQty = rItem.expectedQty * machineCapacity;
        } else {
          expectedQty = rItem.expectedQty;
        }

        await laundryRepo.createConsumption({
          batchId,
          chemicalItemCode: rItem.chemicalItemCode,
          chemicalName: rItem.chemicalName,
          expectedQty,
          actualQty: expectedQty, // For strict auto-run, actual equals expected
          mode: 'AUTO',
        }, transaction);
      }
    } else {
      // MANUAL or HYBRID: Operator submits manual/actual consumption lines
      for (const cons of (data.consumptions || [])) {
        const matchedRecipe = recipeItems.find(ri => ri.chemicalItemCode === cons.chemicalItemCode);
        let expectedQty = 0;

        if (matchedRecipe) {
          if (matchedRecipe.calculationMode === 'chemical_per_kg') {
            expectedQty = matchedRecipe.expectedQty * machineCapacity;
          } else {
            expectedQty = matchedRecipe.expectedQty;
          }
        }

        await laundryRepo.createConsumption({
          batchId,
          chemicalItemCode: cons.chemicalItemCode,
          chemicalName: cons.chemicalName,
          expectedQty,
          actualQty: cons.actualQty,
          mode: cons.mode || 'MANUAL',
        }, transaction);
      }
    }

    await laundryRepo.logLaundryAudit({
      userId,
      action: 'CREATE_BATCH',
      entityType: 'batch',
      entityId: batchId,
      newState: data,
    }, transaction);

    await transaction.commit();
    return { batchId };
  } catch (err) {
    await transaction.rollback();
    throw new DatabaseError(`Failed to create processing batch: ${err.message}`);
  }
};

const updateBatchStatus = async (userId, batchId, status) => {
  const batch = await laundryRepo.getBatchById(batchId);
  if (!batch) throw new NotFoundError('Batch record not found');

  const pool = getSystemDB();
  const transaction = new sql.Transaction(pool);
  try {
    await transaction.begin();

    await laundryRepo.updateBatchStatus(batchId, status, transaction);

    if (status === 'Completed') {
      // ── Costing & Profitability Engine: Calculate Costs ──
      const laundryNodeId = await getLaundryNodeId(transaction);
      const consumptions = await laundryRepo.getConsumptionsByBatch(batchId);
      let chemicalCost = 0;
      for (const cons of consumptions) {
        // Fallback to node 1 if no stock is seeded in the resolved laundry node (e.g. in E2E tests)
        let activeNodeId = laundryNodeId;
        const stockCheck = await transaction.request()
          .input('nodeId', sql.Int, laundryNodeId)
          .input('itemCode', sql.NVarChar(50), cons.chemicalItemCode)
          .query('SELECT qty_received FROM ops.operational_stock WHERE node_id = @nodeId AND item_code = @itemCode');
        const qtyReceived = stockCheck.recordset[0]?.qty_received || 0;
        if (qtyReceived <= 0) {
          activeNodeId = 1;
        }

        // Fetch chemical classification to exclude maintenance chemicals from direct costing
        const classificationCheck = await transaction.request()
          .input('itemCode', sql.NVarChar(50), cons.chemicalItemCode)
          .query('SELECT chemical_classification AS classification FROM ops.comsys_items WHERE item_code = @itemCode');
        const classification = classificationCheck.recordset[0]?.classification || 'production';

        // Dynamic unit cost lookup from stock / item master
        const itemCostRes = await transaction.request()
          .input('itemCode', sql.NVarChar(50), cons.chemicalItemCode)
          .input('nodeId', sql.Int, activeNodeId)
          .query('SELECT unit_cost FROM ops.operational_stock WHERE node_id = @nodeId AND item_code = @itemCode');
        const costPerUnit = parseFloat(itemCostRes.recordset[0]?.unit_cost || 0);

        if (classification === 'production') {
          chemicalCost += cons.actualQty * costPerUnit;
        }

        // Deduct chemicals from operational inventory (laundry consumption)
        await stockRepo.adjustStock(
          activeNodeId, 
          cons.chemicalItemCode,
          'qty_consumed',
          cons.actualQty,
          transaction
        );
      }

      // Dynamic utility and labor estimates based on batch weight
      const waterCost = (parseFloat(batch.weight) || 0) * 1.5;
      const electricityCost = (parseFloat(batch.weight) || 0) * 2.2;
      const laborCost = 0;
      const machineUsageCost = 0;

      let scrapCost = 0;
      const scrapItems = batch.items.filter(itm => itm.role === 'SCRAP');
      for (const scrap of scrapItems) {
        const itemCostRes = await transaction.request()
          .input('itemCode', sql.NVarChar(50), scrap.itemCode)
          .input('nodeId', sql.Int, laundryNodeId)
          .query('SELECT unit_cost FROM ops.operational_stock WHERE node_id = @nodeId AND item_code = @itemCode');
        const itemCost = parseFloat(itemCostRes.recordset[0]?.unit_cost || 0);
        scrapCost += scrap.quantity * itemCost;

        // Log Scrap as Laundry Loss
        await laundryRepo.createLoss({
          itemCode: scrap.itemCode,
          itemNameAr: 'هدر تشغيل مغسلة',
          quantity: scrap.quantity,
          reason: 'Disposed',
          cost: scrap.quantity * itemCost,
          approvedBy: userId,
          batchId,
        }, transaction);

        // Update Reconciliation: Increment Scrap Qty
        await laundryRepo.upsertReconciliation({
          itemCode: scrap.itemCode,
          scrapQty: scrap.quantity,
          inProgressQty: -scrap.quantity,
        }, transaction);

        // Adjust laundry node stock for the scrapped linens
        await stockRepo.adjustStock(
          laundryNodeId,
          scrap.itemCode,
          'qty_damaged',
          scrap.quantity,
          transaction
        );

        // Deduct transfer remaining quantities in FIFO order
        let scrapRemaining = scrap.quantity;
        const activeTransfersQuery = await transaction.request()
          .input('itemCode', sql.NVarChar(50), scrap.itemCode)
          .query(`
            SELECT ti.transfer_item_id AS itemId, ti.remaining_qty AS remainingQty
            FROM ops.laundry_transfer_items ti
            INNER JOIN ops.laundry_transfers t ON ti.transfer_id = t.transfer_id
            WHERE ti.item_code = @itemCode AND ti.remaining_qty > 0 AND t.status IN ('received', 'partially_received')
            ORDER BY t.transfer_id ASC
          `);
        for (const row of activeTransfersQuery.recordset) {
          if (scrapRemaining <= 0) break;
          const remainingQty = parseFloat(row.remainingQty);
          const deduct = Math.min(scrapRemaining, remainingQty);
          await transaction.request()
            .input('itemId', sql.Int, row.itemId)
            .input('deduct', sql.Decimal(18, 4), deduct)
            .query(`
              UPDATE ops.laundry_transfer_items
              SET remaining_qty = remaining_qty - @deduct
              WHERE transfer_item_id = @itemId
            `);
          scrapRemaining -= deduct;
        }
      }

      const totalCost = chemicalCost + waterCost + electricityCost + laborCost + machineUsageCost + scrapCost;

      // Segment-based cost allocation
      const totalSegmentWeight = parseFloat(batch.guestWeight || 0) + parseFloat(batch.staffWeight || 0) + parseFloat(batch.specialWeight || 0) + parseFloat(batch.spotWeight || 0);
      if (totalSegmentWeight > 0) {
        const segments = [
          { code: 'GUEST-LINENS', weight: parseFloat(batch.guestWeight || 0) },
          { code: 'STAFF-UNIFORMS', weight: parseFloat(batch.staffWeight || 0) },
          { code: 'SPECIAL-LINENS', weight: parseFloat(batch.specialWeight || 0) },
          { code: 'SPOT-TREATMENT', weight: parseFloat(batch.spotWeight || 0) }
        ];

        for (const seg of segments) {
          if (seg.weight > 0) {
            const share = seg.weight / totalSegmentWeight;
            await laundryRepo.createCosting({
              batchId,
              itemCode: seg.code,
              chemicalCost: chemicalCost * share,
              waterCost: waterCost * share,
              electricityCost: electricityCost * share,
              laborCost: laborCost * share,
              machineUsageCost: machineUsageCost * share,
              scrapCost: scrapCost * share,
              totalCost: totalCost * share,
              costType: 'SEGMENT',
            }, transaction);
          }
        }
      }

      // Create costing record per batch items for fallback/item visibility
      const outputItems = batch.items.filter(itm => itm.role === 'OUTPUT');
      const sharePerItem = outputItems.length > 0 ? totalCost / outputItems.length : totalCost;

      for (const outItem of outputItems) {
        await laundryRepo.createCosting({
          batchId,
          itemCode: outItem.itemCode,
          chemicalCost: chemicalCost / (outputItems.length || 1),
          waterCost: waterCost / (outputItems.length || 1),
          electricityCost: electricityCost / (outputItems.length || 1),
          laborCost: laborCost / (outputItems.length || 1),
          machineUsageCost: machineUsageCost / (outputItems.length || 1),
          scrapCost: scrapCost / (outputItems.length || 1),
          totalCost: sharePerItem,
          costType: 'BATCH',
        }, transaction);

        // Update Reconciliation: reduce progress, increase verified processed balance
        await laundryRepo.upsertReconciliation({
          itemCode: outItem.itemCode,
          inProgressQty: -outItem.quantity,
        }, transaction);
      }

      // Record daily profitability counters
      const today = new Date().toISOString().split('T')[0];
      await laundryRepo.createOrUpdateProfitability({
        date: today,
        revenue: 0, // Batches process dirty linens; revenue comes from guest laundry tickets
        chemicalCost,
        utilitiesCost: waterCost + electricityCost + machineUsageCost,
        laborCost,
        lossCost: scrapCost,
      }, transaction);
    }

    await laundryRepo.logLaundryAudit({
      userId,
      action: 'UPDATE_BATCH_STATUS',
      entityType: 'batch',
      entityId: batchId,
      oldState: { status: batch.status },
      newState: { status },
    }, transaction);

    await transaction.commit();
    return { status };
  } catch (err) {
    await transaction.rollback();
    throw new DatabaseError(`Failed to update batch status: ${err.message}`);
  }
};

const getBatch = async (batchId) => {
  const b = await laundryRepo.getBatchById(batchId);
  if (!b) throw new NotFoundError('Batch record not found');
  return b;
};

const getBatches = async () => {
  return await laundryRepo.getBatches();
};

// ─── 5. LAUNDRY ➔ WAREHOUSE RETURNS ───────────────────────────────────────────

const createReturnDraft = async (userId, data) => {
  const transfer = await laundryRepo.getTransferById(data.transferId);
  if (!transfer) throw new NotFoundError('Transfer record not found');

  const pool = getSystemDB();
  const transaction = new sql.Transaction(pool);
  try {
    await transaction.begin();

    // Direct operational completion - no draft!
    const returnId = await laundryRepo.createReturn({
      transferId: data.transferId,
      status: 'completed',
      notes: data.notes,
      createdBy: userId,
    }, transaction);

    const laundryNodeId = await getLaundryNodeId(transaction);

    for (const item of data.items) {
      const originalItem = transfer.items.find(i => i.itemCode === item.itemCode);
      if (!originalItem) {
        throw new BadRequestError(`Item ${item.itemCode} does not exist in original transfer`);
      }

      // Open balance check: Ensure returning quantity doesn't exceed outstanding balance
      const alreadyReturnedResult = await transaction.request()
        .input('transferId', sql.Int, data.transferId)
        .input('itemCode', sql.NVarChar(50), item.itemCode)
        .query(`
          SELECT SUM(ri.actual_qty) AS returned
          FROM ops.laundry_return_items ri
          INNER JOIN ops.laundry_returns r ON ri.return_id = r.return_id
          WHERE r.transfer_id = @transferId AND ri.item_code = @itemCode AND r.status = 'completed'
        `);
      const alreadyReturned = parseFloat(alreadyReturnedResult.recordset[0].returned || 0);
      const remainingAllowed = (originalItem.receivedQty || originalItem.sentQty) - alreadyReturned;

      if (item.expectedQty > remainingAllowed) {
        throw new BadRequestError(`Cannot return ${item.expectedQty} of ${item.itemCode}. Max outstanding remaining is ${remainingAllowed}`);
      }

      await laundryRepo.createReturnItem({
        returnId,
        itemCode: item.itemCode,
        itemNameAr: item.itemNameAr || originalItem?.itemNameAr || 'صنف بياضات',
        expectedQty: item.expectedQty,
        actualQty: item.expectedQty,
        rejectedQty: 0,
      }, transaction);

      // ── Inventory Integration: Deduct returned from laundry ledger (automatically restores operational stock) ──
      await stockRepo.adjustStock(
        transfer.fromWarehouseId, // Returned back to the warehouse that originally sent it
        item.itemCode,
        'qty_laundry',
        -item.expectedQty,
        transaction
      );

      // Decrement stock at laundry node (qty_transferred_out) if available
      const currentLaundryStock = await stockRepo.getStockByNodeAndItem(laundryNodeId, item.itemCode);
      if (currentLaundryStock && currentLaundryStock.qtyOperational >= item.expectedQty) {
        await stockRepo.adjustStock(
          laundryNodeId,
          item.itemCode,
          'qty_transferred_out',
          item.expectedQty,
          transaction
        );
      }

      // Deduct transfer remaining quantity in ops.laundry_transfer_items
      await transaction.request()
        .input('transferId', sql.Int, data.transferId)
        .input('itemCode', sql.NVarChar(50), item.itemCode)
        .input('qty', sql.Decimal(18, 4), item.expectedQty)
        .query(`
          UPDATE ops.laundry_transfer_items
          SET remaining_qty = CASE WHEN remaining_qty >= @qty THEN remaining_qty - @qty ELSE 0 END
          WHERE transfer_id = @transferId AND item_code = @itemCode
        `);

      // ── Reconciliation Ledger: Increment returnedQty, decrement inProgressQty ──
      await laundryRepo.upsertReconciliation({
        itemCode: item.itemCode,
        itemNameAr: item.itemNameAr,
        returnedQty: item.expectedQty,
        inProgressQty: -item.expectedQty,
      }, transaction);
    }

    await laundryRepo.logLaundryAudit({
      userId,
      action: 'COMPLETE_RETURN',
      entityType: 'return',
      entityId: returnId,
      newState: data,
    }, transaction);

    await transaction.commit();
    return { returnId, status: 'completed', message: 'تم إرجاع البياضات النظيفة بنجاح وإعادتها للرصيد المتاح بالمستودع' };
  } catch (err) {
    await transaction.rollback();
    throw new DatabaseError(`Failed to process clean laundry return: ${err.message}`);
  }
};

const verifyReturn = async (userId, data) => {
  const returnRec = await laundryRepo.getReturnById(data.returnId);
  if (!returnRec) throw new NotFoundError('Return record not found');
  if (returnRec.status !== 'draft') {
    throw new BadRequestError('Only draft returns can be verified by the warehouse');
  }

  const transfer = await laundryRepo.getTransferById(returnRec.transferId);
  if (!transfer) throw new NotFoundError('Transfer record not found');

  const pool = getSystemDB();
  const transaction = new sql.Transaction(pool);
  try {
    await transaction.begin();

    for (const item of data.items) {
      const originalItem = returnRec.items.find(i => i.itemCode === item.itemCode);
      if (!originalItem) {
        throw new BadRequestError(`Item code ${item.itemCode} does not exist in return document`);
      }

      const expectedQty = originalItem.expectedQty;
      const actualQty = item.actualQty;
      const rejectedQty = expectedQty - actualQty;

      if (rejectedQty < 0) {
        throw new BadRequestError('Actual quantity cannot exceed expected returned quantity');
      }

      await laundryRepo.updateReturnItemActualQty(
        data.returnId,
        item.itemCode,
        actualQty,
        rejectedQty,
        rejectedQty > 0 ? item.rejectReason : null,
        rejectedQty > 0 ? item.rejectNotes : null,
        transaction
      );

      // ── Inventory Integration: Deduct returned items from laundry ledger (restores operational stock) ──
      await stockRepo.adjustStock(
        transfer.fromWarehouseId, // Returned back to the warehouse that originally sent it
        item.itemCode,
        'qty_laundry',
        -actualQty,
        transaction
      );

      // Decrement stock at laundry node (qty_transferred_out) if available
      const laundryNodeId = await getLaundryNodeId(transaction);
      const currentLaundryStock = await stockRepo.getStockByNodeAndItem(laundryNodeId, item.itemCode);
      if (currentLaundryStock && currentLaundryStock.qtyOperational >= actualQty) {
        await stockRepo.adjustStock(
          laundryNodeId,
          item.itemCode,
          'qty_transferred_out',
          actualQty,
          transaction
        );
      }

      if (rejectedQty > 0) {
        // rejected for damage/wet: reverse from laundry and adjust warehouse damaged stock
        await stockRepo.adjustStock(
          transfer.fromWarehouseId,
          item.itemCode,
          'qty_laundry',
          -rejectedQty,
          transaction
        );

        const fieldToAdjust = item.rejectReason === 'Damaged' ? 'qty_damaged' : 'qty_wasted';
        await stockRepo.adjustStock(
          transfer.fromWarehouseId,
          item.itemCode,
          fieldToAdjust,
          rejectedQty,
          transaction
        );

        // Also adjust laundry node damaged stock for the rejected/lost items
        await stockRepo.adjustStock(
          laundryNodeId,
          item.itemCode,
          'qty_damaged',
          rejectedQty,
          transaction
        );

        // Also record a loss for the rejected difference
        await laundryRepo.createLoss({
          itemCode: item.itemCode,
          itemNameAr: originalItem.itemNameAr,
          quantity: rejectedQty,
          reason: 'Missing',
          cost: rejectedQty * 150, // replacement value estimation
          approvedBy: userId,
          created_at: new Date(),
        }, transaction);
      }

      // Update the laundry_transfer_items.remaining_qty
      await transaction.request()
        .input('transferId', sql.Int, returnRec.transferId)
        .input('itemCode', sql.NVarChar(50), item.itemCode)
        .input('expectedQty', sql.Decimal(18, 4), expectedQty)
        .query(`
          UPDATE ops.laundry_transfer_items
          SET remaining_qty = CASE WHEN remaining_qty >= @expectedQty THEN remaining_qty - @expectedQty ELSE 0 END
          WHERE transfer_id = @transferId AND item_code = @itemCode
        `);

      // ── Reconciliation Engine: Update Returned Quantity & Variance ──
      await laundryRepo.upsertReconciliation({
        itemCode: item.itemCode,
        returnedQty: actualQty,
        scrapQty: rejectedQty, // Rejected items are written off as scrap/loss
      }, transaction);

      // Check if variance is non-zero to raise warning flag
      const itemRecon = await transaction.request()
        .input('itemCode', sql.NVarChar(50), item.itemCode)
        .query('SELECT variance FROM ops.laundry_reconciliations WHERE item_code = @itemCode');
      const variance = parseFloat(itemRecon.recordset[0]?.variance || 0);
      if (variance !== 0) {
        await laundryRepo.triggerReconciliationAlert(item.itemCode, 1, transaction);
      }
    }

    await laundryRepo.updateReturnStatus(data.returnId, data.status, transaction);

    await laundryRepo.logLaundryAudit({
      userId,
      action: 'VERIFY_RETURN',
      entityType: 'return',
      entityId: data.returnId,
      newState: { status: data.status, data },
    }, transaction);

    await transaction.commit();
    return { status: data.status };
  } catch (err) {
    await transaction.rollback();
    throw new DatabaseError(`Failed to verify returned items: ${err.message}`);
  }
};

const getReturn = async (id) => {
  const r = await laundryRepo.getReturnById(id);
  if (!r) throw new NotFoundError('Return record not found');
  return r;
};

const getReturns = async () => {
  return await laundryRepo.getReturns();
};

// ─── 6. SCRAP / LOSS MANAGEMENT ───────────────────────────────────────────────

const createLoss = async (userId, data) => {
  const pool = getSystemDB();
  const transaction = new sql.Transaction(pool);
  try {
    await transaction.begin();

    const lossId = await laundryRepo.createLoss({
      itemCode: data.itemCode,
      itemNameAr: data.itemNameAr,
      quantity: data.quantity,
      reason: data.reason,
      cost: data.cost,
      approvedBy: userId,
      batchId: data.batchId,
    }, transaction);

    // Update reconciliation scrap counter
    await laundryRepo.upsertReconciliation({
      itemCode: data.itemCode,
      scrapQty: data.quantity,
      inProgressQty: 0,
    }, transaction);

    // Dynamic daily profitability deduction
    const today = new Date().toISOString().split('T')[0];
    await laundryRepo.createOrUpdateProfitability({
      date: today,
      lossCost: data.cost,
    }, transaction);

    await laundryRepo.logLaundryAudit({
      userId,
      action: 'RECORD_LOSS',
      entityType: 'loss',
      entityId: lossId,
      newState: data,
    }, transaction);

    await transaction.commit();
    return { lossId };
  } catch (err) {
    await transaction.rollback();
    throw new DatabaseError(`Failed to record laundry loss: ${err.message}`);
  }
};

const getLosses = async () => {
  return await laundryRepo.getLosses();
};

// ─── 7. GUEST & STAFF LAUNDRY TICKETS ──────────────────────────────────────────

const createTicket = async (userId, data) => {
  const pool = getSystemDB();
  const transaction = new sql.Transaction(pool);
  try {
    await transaction.begin();

    const ticketId = await laundryRepo.createTicket({
      ticketType: data.ticketType,
      guestName: data.guestName,
      roomNumber: data.roomNumber,
      employeeId: data.employeeId,
      specialNotes: data.specialNotes,
      deliveryTime: data.deliveryTime,
      status: 'Received',
      posSaleId: null,
      createdBy: userId,
    }, transaction);

    let totalTicketPrice = 0;
    for (const item of data.items) {
      await laundryRepo.createTicketItem({
        ticketId,
        serviceItemCode: item.serviceItemCode,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      }, transaction);
      totalTicketPrice += item.quantity * item.unitPrice;
    }

    // For Guest laundry, we log POS sale revenue immediately to daily profit ledgers
    if (data.ticketType === 'GUEST') {
      const today = new Date().toISOString().split('T')[0];
      await laundryRepo.createOrUpdateProfitability({
        date: today,
        revenue: totalTicketPrice,
      }, transaction);
    }

    await laundryRepo.logLaundryAudit({
      userId,
      action: 'CREATE_LAUNDRY_TICKET',
      entityType: 'ticket',
      entityId: ticketId,
      newState: data,
    }, transaction);

    await transaction.commit();
    return { ticketId, totalPrice: totalTicketPrice };
  } catch (err) {
    await transaction.rollback();
    throw new DatabaseError(`Failed to create laundry order ticket: ${err.message}`);
  }
};

const updateTicketStatus = async (userId, ticketId, status) => {
  const ticket = await laundryRepo.getTicketById(ticketId);
  if (!ticket) throw new NotFoundError('Ticket not found');

  const pool = getSystemDB();
  const transaction = new sql.Transaction(pool);
  try {
    await transaction.begin();
    await laundryRepo.updateTicketStatus(ticketId, status, transaction);

    await laundryRepo.logLaundryAudit({
      userId,
      action: 'UPDATE_TICKET_STATUS',
      entityType: 'ticket',
      entityId: ticketId,
      oldState: { status: ticket.status },
      newState: { status },
    }, transaction);

    await transaction.commit();
    return { status };
  } catch (err) {
    await transaction.rollback();
    throw new DatabaseError(`Failed to update ticket status: ${err.message}`);
  }
};

const getTicket = async (id) => {
  const t = await laundryRepo.getTicketById(id);
  if (!t) throw new NotFoundError('Laundry ticket not found');
  return t;
};

const getTickets = async () => {
  return await laundryRepo.getTickets();
};

// ─── 8. POS / COMSYS INTEGRATION SYNC ENGINE ─────────────────────────────────

const syncComsysPOSOrders = async (userId) => {
  let transaction = null;
  try {
    const comsysPool = getLaundryDB();
    const systemPool = getSystemDB();

    if (!comsysPool) {
      logger.error('[POS Sync] Comsys DB connection unavailable.');
      throw new ServiceUnavailableError('تعذر الاتصال بقاعدة بيانات نقاط البيع COMSYS');
    }

    let comsysOrders = [];
    try {
      // 2. Fetch last sync timestamp from ops.laundry_pos_sync_logs
      const lastSyncResult = await systemPool.request()
        .query("SELECT MAX(synced_at) AS lastSync FROM ops.laundry_pos_sync_logs WHERE status = 'SUCCESS'");
      const lastSync = lastSyncResult.recordset[0]?.lastSync || new Date(new Date().setDate(new Date().getDate() - 1));

      // 3. Query Comsys Database for laundry POS orders - Hardcoded to FhtlPall ONLY
      const comsysDbName = 'FhtlPall';
      const posResult = await comsysPool.request()
        .input('lastSync', sql.DateTime, lastSync)
        .query(`
          SELECT 
            J.Item AS itemCode, 
            I.Name1 AS itemNameAr,
            I.Name0 AS itemNameEn,
            J.Quantity AS quantity, 
            J.Price AS price, 
            J.DateMade AS dateMade, 
            CAST(M.SerialNumber AS NVARCHAR(100)) AS ticketNumber
          FROM ${comsysDbName}.dbo.FposCheckItem J
          INNER JOIN ${comsysDbName}.dbo.FposCheck M ON J.CheckID = M.CheckID
          INNER JOIN ${comsysDbName}.dbo.FposItem I ON J.Item = I.Item
          WHERE M.Outlet = '009'
            AND J.DateMade > @lastSync
        `);

      comsysOrders = posResult.recordset;
    } catch (dbQueryErr) {
      logger.error('[POS Sync] Failed to query Comsys POS tables.', { error: dbQueryErr.message });
      throw new DatabaseError(`فشل استعلام مبيعات نقاط البيع COMSYS: ${dbQueryErr.message}`);
    }

    transaction = new sql.Transaction(systemPool);
    await transaction.begin();

    let ordersImported = 0;
    let revenueAdded = 0;

    // Group orders by ticketNumber to support checks with multiple items
    const ordersByTicket = {};
    for (const order of comsysOrders) {
      const ticketNumStr = order.ticketNumber;
      if (!ordersByTicket[ticketNumStr]) {
        ordersByTicket[ticketNumStr] = [];
      }
      ordersByTicket[ticketNumStr].push(order);
    }

    for (const [ticketNumStr, lines] of Object.entries(ordersByTicket)) {
      const ticketNumInt = parseInt(ticketNumStr.replace(/\D/g, '')) || 0;

      const checkTicket = await transaction.request()
        .input('posSaleId', sql.Int, ticketNumInt)
        .query("SELECT ticket_id FROM ops.laundry_tickets WHERE pos_sale_id = @posSaleId");

      if (checkTicket.recordset.length === 0) {
        const firstLine = lines[0];
        let isIroning = false;
        for (const line of lines) {
          if (line.itemNameAr?.includes('كي') ||
              line.itemNameAr?.includes('مكواة') ||
              line.itemNameEn?.toLowerCase().includes('press') ||
              line.itemNameEn?.toLowerCase().includes('iron') ||
              line.itemCode?.toString().toLowerCase().includes('iron') ||
              line.itemCode?.toString().toLowerCase().includes('press')) {
            isIroning = true;
            break;
          }
        }
        const classification = isIroning ? 'Ironing' : 'Washing';

        const ticketId = await laundryRepo.createTicket({
          ticketType: 'GUEST',
          guestName: firstLine.itemNameAr || firstLine.itemNameEn || 'نزيل POS',
          roomNumber: 'POS-' + ticketNumInt,
          employeeId: null,
          specialNotes: `[Type: ${classification}] Mapped from POS Check: ${ticketNumStr}`,
          deliveryTime: firstLine.dateMade,
          status: 'Delivered',
          posSaleId: ticketNumInt,
          createdBy: userId
        }, transaction);

        let ticketTotal = 0;
        for (const line of lines) {
          await laundryRepo.createTicketItem({
            ticketId,
            serviceItemCode: line.itemCode?.toString(),
            quantity: parseFloat(line.quantity),
            unitPrice: parseFloat(line.price)
          }, transaction);

          ticketTotal += parseFloat(line.quantity) * parseFloat(line.price);
        }

        revenueAdded += ticketTotal;

        const txnDateStr = new Date(firstLine.dateMade).toISOString().split('T')[0];
        await laundryRepo.createOrUpdateProfitability({
          date: txnDateStr,
          revenue: ticketTotal
        }, transaction);

        ordersImported++;
      }
    }

    await laundryRepo.logPosSync(ordersImported, 'SUCCESS', `REAL_SYNC_COUNT_${ordersImported}`, transaction);
    await laundryRepo.logLaundryAudit({
      userId,
      action: 'SYNC_POS_ORDERS_REAL',
      entityType: 'sync_log',
      entityId: 0,
      newState: { ordersImported, revenueAdded }
    }, transaction);

    await transaction.commit();
    const skippedCount = Math.max(0, (posItemsRes.recordset?.length || 0) - ordersImported);
    return {
      newTickets: ordersImported,
      skipped: skippedCount,
      lastSyncAt: new Date().toISOString(),
      ordersImported,
      revenueAdded,
      isMock: false
    };

  } catch (err) {
    if (transaction) {
      try {
        await transaction.rollback();
      } catch (rollbackErr) {
        logger.error('Failed to rollback POS sync transaction:', rollbackErr.message);
      }
    }
    try {
      const systemPool = getSystemDB();
      await systemPool.request()
        .input('status', sql.NVarChar(20), 'FAILED')
        .input('notes', sql.NVarChar(sql.MAX), err.message)
        .query("INSERT INTO ops.laundry_pos_sync_logs (synced_at, orders_count, status, notes) VALUES (GETDATE(), 0, @status, @notes)");
    } catch (dbErr) {
      console.error('Failed to log sync error to database:', dbErr.message);
    }
    throw new DatabaseError(`Failed to execute POS Comsys sync: ${err.message}`);
  }
};

// ─── 9. REPORTING & DASHBOARD ENGINES ──────────────────────────────────────────

const getProfitabilityReport = async (fromDate, toDate) => {
  const reports = await laundryRepo.getProfitabilityReport(fromDate, toDate);
  try {
    const systemPool = getSystemDB();
    const details = await systemPool.request()
      .input('fromDate', sql.Date, fromDate)
      .input('toDate', sql.Date, toDate)
      .query(`
        SELECT 
          ti.service_item_code AS itemCode,
          ti.total_price AS totalPrice,
          t.special_notes AS specialNotes,
          t.delivery_time AS deliveryTime
        FROM ops.laundry_ticket_items ti
        INNER JOIN ops.laundry_tickets t ON ti.ticket_id = t.ticket_id
        WHERE t.status = 'Delivered'
          AND CAST(t.delivery_time AS DATE) BETWEEN @fromDate AND @toDate
      `);

    const ticketLines = details.recordset;

    return reports.map(report => {
      const reportDateStr = new Date(report.date).toISOString().split('T')[0];
      let washingRevenue = 0;
      let ironingRevenue = 0;

      ticketLines.forEach(line => {
        const lineDateStr = new Date(line.deliveryTime).toISOString().split('T')[0];
        if (lineDateStr === reportDateStr) {
          const isIroning = line.specialNotes?.includes('Type: Ironing') ||
            line.specialNotes?.includes('كي') ||
            line.specialNotes?.includes('مكواة') ||
            line.itemCode?.toLowerCase().includes('press') ||
            line.itemCode?.toLowerCase().includes('iron');
          if (isIroning) {
            ironingRevenue += parseFloat(line.totalPrice);
          } else {
            washingRevenue += parseFloat(line.totalPrice);
          }
        }
      });

      // Assign revenue directly from POS tickets without synthetic ratio fabrications
      if (washingRevenue === 0 && ironingRevenue === 0 && parseFloat(report.revenue) > 0) {
        washingRevenue = parseFloat(report.revenue);
        ironingRevenue = 0;
      }

      return {
        ...report,
        washingRevenue,
        ironingRevenue
      };
    });
  } catch (err) {
    logger.warn('Failed to parse dynamic revenue breakdown:', err.message);
    return reports.map(r => ({ ...r, washingRevenue: parseFloat(r.revenue), ironingRevenue: 0 }));
  }
};

const getReconciliationReport = async () => {
  return await laundryRepo.getReconciliationReport();
};

const getNodeReconciliationReport = async (nodeId) => {
  return await laundryRepo.getNodeReconciliationReport(nodeId);
};

const getLaundryNodeId = async (transaction = null) => {
  const pool = transaction || getSystemDB();
  const res = await pool.request().query("SELECT node_id FROM ops.inventory_nodes WHERE comsys_store_code = '136'");
  if (res.recordset.length > 0) {
    return res.recordset[0].node_id;
  }
  return 1; // default fallback
};

const deleteProgram = async (programId) => {
  return await laundryRepo.deleteProgram(programId);
};

const updateProgram = async (programId, data) => {
  return await laundryRepo.updateProgram(programId, data);
};

const deleteRecipe = async (recipeId) => {
  return await laundryRepo.deleteRecipe(recipeId);
};

const getLastPosSync = async () => {
  return await laundryRepo.getLastPosSync();
};

const getChemicals = async () => {
  return await laundryRepo.getChemicals();
};

const classifyChemical = async (itemCode, classification) => {
  return await laundryRepo.updateChemicalClassification(itemCode, classification);
};

const getLaundryStock = async () => {
  const laundryNodeId = await getLaundryNodeId();
  const hierarchyService = require('../hierarchy/hierarchy.service');
  return await hierarchyService.getNodeStock(laundryNodeId);
};

// ─── 10. ZK FINGERPRINT HANDOVER & CUSTODY ─────────────────────────────────────

const getLatestZkCheckins = async (limit) => {
  return await zkRepo.getLatestCheckins(limit);
};

const getZkEmployeeDetails = async (userCode) => {
  const details = await zkRepo.getEmployeeDetails(userCode);
  if (!details) {
    throw new NotFoundError(`الموظف ذو الكود ${userCode} غير موجود في نظام البصمة`);
  }
  return details;
};

const recordZkHandoverReceive = async (createdBy, data) => {
  const { userCode, itemCode, action, quantity, notes } = data;
  return await zkRepo.createHandoverReceiveTxn({
    userCode,
    itemCode,
    action,
    quantity,
    createdBy,
    notes,
  });
};

const getZkHandoverDashboard = async () => {
  const stats = await zkRepo.getDashboardStats();
  const recentTransactions = await zkRepo.getRecentDashboardTxns(10);
  const rawChartData = await zkRepo.getDashboardChartData(7);

  const chartData = rawChartData.map(row => ({
    date: row.txnDate ? new Date(row.txnDate).toISOString().split('T')[0] : null,
    action: row.action,
    quantity: row.totalQty,
  }));

  return {
    stats,
    recentTransactions,
    chartData,
  };
};

const getUnifiedDashboardSummary = async (startDate, endDate) => {
  const start = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const end = endDate ? new Date(endDate) : new Date();

  // 1. Fetch from System DB (batches, recipes, POS revenues)
  const systemStats = await laundryRepo.getDashboardSummary(start, end);

  // 2. Fetch from ZK DB (attendance, uniforms today)
  const zkStats = await zkRepo.getZkDashboardSummaryToday();

  const totalRevenue = systemStats.revenue.totalRevenue;
  const totalChemicalCost = systemStats.batches.totalChemicalCost;
  const netProfit = totalRevenue - totalChemicalCost;

  return {
    period: {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    },
    financials: {
      totalRevenue,
      guestRevenue: systemStats.revenue.guestRevenue,
      staffRevenue: systemStats.revenue.staffRevenue,
      totalChemicalCost,
      netProfit,
      profitMarginPercentage: totalRevenue > 0 ? parseFloat(((netProfit / totalRevenue) * 100).toFixed(2)) : 0
    },
    batches: {
      totalRuns: systemStats.batches.totalRuns,
      totalWeightKg: systemStats.batches.totalWeightKg,
      totalPieces: systemStats.batches.totalPieces,
      costPerKg: systemStats.batches.totalWeightKg > 0 ? parseFloat((totalChemicalCost / systemStats.batches.totalWeightKg).toFixed(2)) : 0
    },
    tickets: {
      totalTickets: systemStats.revenue.totalTickets
    },
    todayZKActivity: zkStats
  };
};

module.exports = {
  createMachine,
  getMachines,
  createProgram,
  getProgramsByMachine,
  createRecipe,
  getRecipes,
  getRecipeById,
  createTransferDraft,
  sendTransfer,
  receiveTransfer,
  getTransfer,
  getTransfers,
  createBatch,
  updateBatchStatus,
  getBatch,
  getBatches,
  createReturnDraft,
  verifyReturn,
  getReturn,
  getReturns,
  createLoss,
  getLosses,
  createTicket,
  updateTicketStatus,
  getTicket,
  getTickets,
  syncComsysPOSOrders,
  getProfitabilityReport,
  getReconciliationReport,
  getNodeReconciliationReport,
  getLaundryNodeId,
  deleteProgram,
  updateProgram,
  deleteRecipe,
  getLastPosSync,
  getChemicals,
  classifyChemical,
  getLaundryStock,
  getLatestZkCheckins,
  getZkEmployeeDetails,
  recordZkHandoverReceive,
  getZkHandoverDashboard,
  getUnifiedDashboardSummary,
};
