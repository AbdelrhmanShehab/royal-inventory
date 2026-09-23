'use strict';

const transferRepo = require('../../../repositories/system/transfer.repo');
const stockRepo = require('../../../repositories/system/stock.repo');
const hierarchyRepo = require('../../../repositories/system/hierarchy.repo');
const { getSystemDB } = require('../../../config/database');
const { NotFoundError, BadRequestError, DatabaseError } = require('../../../utils/errors');
const sql = require('mssql');

/**
 * Transfer Service — all business logic for drafting, submitting, approving, dispatching, and confirming transfers.
 */

const createTransferDraft = async ({ txnType = 'internal_transfer', createdBy, fromNodeId, toNodeId = null, notes = null, reason = null, lines = [], submitForApproval = false }) => {
  const isTransferOrReturn = txnType === 'internal_transfer' || txnType === 'return';
  if (isTransferOrReturn && fromNodeId === toNodeId) {
    throw new BadRequestError('لا يمكن التحويل لنفس المستودع');
  }
  if (!lines || lines.length === 0) {
    throw new BadRequestError('يجب إضافة صنف واحد على الأقل للعملية');
  }

  const fromNode = await hierarchyRepo.getNodeById(fromNodeId);
  if (!fromNode || !fromNode.isActive) throw new NotFoundError('مخزن المصدر غير موجود أو غير نشط');

  if (isTransferOrReturn) {
    const toNode = await hierarchyRepo.getNodeById(toNodeId);
    if (!toNode || !toNode.isActive) throw new NotFoundError('مخزن الوجهة غير موجود أو غير نشط');
  }

  const pool = getSystemDB();
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    const isSingleNodeOp = txnType === 'consumption' || txnType === 'damage' || txnType === 'waste' || txnType === 'disposal';
    const initialStatus = isSingleNodeOp ? 'confirmed' : (submitForApproval ? 'pending_approval' : 'draft');

    const txnId = await transferRepo.createTransferHeader({
      txnType,
      nodeId: fromNodeId,
      createdBy,
      notes,
      status: initialStatus,
    }, transaction);

    await transferRepo.createTransferDetail(txnId, {
      fromNodeId,
      toNodeId,
      reason,
    }, transaction);

    for (const line of lines) {
      const qty = parseFloat(line.quantity);
      if (isNaN(qty) || qty <= 0) {
        throw new BadRequestError(`كمية الصنف [${line.itemCode}] يجب أن تكون أكبر من الصفر`);
      }

      await transferRepo.createTransferLine(txnId, {
        itemCode: line.itemCode,
        quantity: qty,
        unitCode: line.unitCode || null,
        unitCost: parseFloat(line.unitCost || 0),
        notes: line.notes || null,
      }, transaction);

      if (isSingleNodeOp) {
        const field = txnType === 'consumption' ? 'qty_consumed'
          : txnType === 'damage' ? 'qty_damaged'
          : txnType === 'waste' ? 'qty_wasted'
          : 'qty_disposed';
        await stockRepo.adjustStock(fromNodeId, line.itemCode, field, qty, transaction);
      }
    }

    await transaction.commit();
    return { txnId };
  } catch (err) {
    await transaction.rollback();
    throw new DatabaseError(`فشل في إنشاء مسودة العملية التشغيلية: ${err.message}`);
  }
};

/**
 * submitForApproval — Submit draft to pending_approval state (initiator action)
 */
const submitForApproval = async (txnId, userId) => {
  const transfer = await transferRepo.getTransferById(txnId);
  if (!transfer) throw new NotFoundError('طلب الحركة غير موجود');
  if (transfer.status !== 'draft') {
    throw new BadRequestError('يمكن فقط إرسال المعاملات في حالة مسودة (Draft)');
  }

  const isTransferOrReturn = transfer.txnType === 'internal_transfer' || transfer.txnType === 'return';
  if (!isTransferOrReturn) {
    throw new BadRequestError('طلبات الاستهلاك والتخريد لا تتطلب موافقة متعددة الخطوات، يمكنك تأكيدها مباشرة');
  }

  await transferRepo.updateTransferStatus(txnId, 'pending_approval', userId);
  return { message: 'تم إرسال طلب التحويل بنجاح وبانتظار موافقة الإدارة' };
};

/**
 * approveTransfer — Approve pending request (manager action)
 */
const approveTransfer = async (txnId, userId) => {
  const transfer = await transferRepo.getTransferById(txnId);
  if (!transfer) throw new NotFoundError('طلب الحركة غير موجود');
  if (transfer.status !== 'pending_approval') {
    throw new BadRequestError('يمكن فقط اعتماد الطلبات التي في حالة انتظار الموافقة (Pending Approval)');
  }
  if (Number(transfer.createdBy) === Number(userId)) {
    throw new BadRequestError('لا يمكن للمنشئ اعتماد طلبه الخاص وفقاً لضوابط الفصل بين المهام (SoD)');
  }

  await transferRepo.updateTransferStatus(txnId, 'approved', userId);
  return { message: 'تم اعتماد طلب التحويل بنجاح، وبانتظار شحن الأصناف من المخزن المصدر' };
};

/**
 * dispatchTransfer — Dispatch/ship approved request, locks/deducts stock from source (source warehouse head/mgr action)
 */
const dispatchTransfer = async (txnId, userId) => {
  const transfer = await transferRepo.getTransferById(txnId);
  if (!transfer) throw new NotFoundError('طلب الحركة غير موجود');
  if (transfer.status !== 'approved') {
    throw new BadRequestError('يمكن فقط شحن الطلبات المعتمدة من الإدارة (Approved)');
  }

  // 1. Validation: check stock availability at source node in a single batch query
  const itemCodes = transfer.lines.map(l => l.itemCode);
  const stockRecords = await stockRepo.getBatchStockByNodeAndItems(transfer.fromNodeId, itemCodes);
  
  // Map stock records for O(1) lookup
  const stockMap = new Map();
  stockRecords.forEach(s => {
    stockMap.set(s.itemCode, s.qtyOperational);
  });

  for (const line of transfer.lines) {
    const availableQty = stockMap.get(line.itemCode) || 0;
    if (availableQty < line.quantity) {
      throw new BadRequestError(
        `رصيد الصنف [${line.itemCode}] غير كافٍ في مخزن المصدر لإتمام الشحن. المتاح: ${availableQty}، المطلوب: ${line.quantity}`
      );
    }
  }

  const pool = getSystemDB();
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    // 2. Deduct stock from source warehouse
    for (const line of transfer.lines) {
      const field = transfer.txnType === 'return' ? 'qty_returned_out'
        : transfer.txnType === 'laundry' ? 'qty_laundry'
        : 'qty_transferred_out';
      await stockRepo.adjustStock(transfer.fromNodeId, line.itemCode, field, line.quantity, transaction);
    }

    // 3. Update status to shipped (in transit)
    await transferRepo.updateTransferStatus(txnId, 'shipped', userId, transaction);

    await transaction.commit();
    return { message: 'تم شحن الأصناف وتحديث رصيد مخزن المصدر بنجاح، الشحنة الآن قيد التوصيل' };
  } catch (err) {
    await transaction.rollback();
    throw new DatabaseError(`فشل في عملية شحن التحويل: ${err.message}`);
  }
};

/**
 * receiveTransfer — Confirm receipt at destination, adds stock to destination (destination warehouse head/mgr action)
 */
const receiveTransfer = async (txnId, userId) => {
  const transfer = await transferRepo.getTransferById(txnId);
  if (!transfer) throw new NotFoundError('طلب الحركة غير موجود');
  if (transfer.status !== 'shipped') {
    throw new BadRequestError('يمكن فقط استلام وتأكيد الشحنات التي تم شحنها بالفعل (Shipped)');
  }

  const pool = getSystemDB();
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    // 1. Add stock to destination warehouse
    for (const line of transfer.lines) {
      if (transfer.txnType === 'internal_transfer') {
        await stockRepo.adjustStock(transfer.toNodeId, line.itemCode, 'qty_internal_in', line.quantity, transaction);
      } else if (transfer.txnType === 'return') {
        await stockRepo.adjustStock(transfer.toNodeId, line.itemCode, 'qty_returned_in', line.quantity, transaction);
      }
    }

    // 2. Update status to confirmed (completed)
    await transferRepo.updateTransferStatus(txnId, 'confirmed', userId, transaction);

    await transaction.commit();
    return { message: 'تم استلام وتأكيد الشحنة بنجاح وإضافتها للرصيد التشغيلي للمستودع المستلم' };
  } catch (err) {
    await transaction.rollback();
    throw new DatabaseError(`فشل في استلام وتأكيد التحويل: ${err.message}`);
  }
};

/**
 * cancelTransfer — Cancel request at any stage before confirmation (initiator or manager action)
 */
const cancelTransfer = async (txnId, userId) => {
  const transfer = await transferRepo.getTransferById(txnId);
  if (!transfer) throw new NotFoundError('طلب الحركة غير موجود');

  if (transfer.status === 'confirmed') {
    throw new BadRequestError('لا يمكن إلغاء الحركات المكتملة والمرحلة بالفعل');
  }
  if (transfer.status === 'cancelled') {
    throw new BadRequestError('هذا الطلب ملغي بالفعل');
  }

  const pool = getSystemDB();
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    // If already shipped, we must reverse the deducted stock back to the source warehouse
    if (transfer.status === 'shipped') {
      for (const line of transfer.lines) {
        const field = transfer.txnType === 'return' ? 'qty_returned_out'
          : transfer.txnType === 'laundry' ? 'qty_laundry'
          : 'qty_transferred_out';
        await stockRepo.adjustStock(transfer.fromNodeId, line.itemCode, field, -line.quantity, transaction);
      }
    }

    // Update status to cancelled
    await transferRepo.updateTransferStatus(txnId, 'cancelled', userId, transaction);

    await transaction.commit();
    return { message: 'تم إلغاء المعاملة وإرجاع الأرصدة لمخزن المصدر بنجاح' };
  } catch (err) {
    await transaction.rollback();
    throw new DatabaseError(`فشل في إلغاء المعاملة: ${err.message}`);
  }
};

/**
 * confirmTransfer — Keep for non-transfer single-node operations (consumption, waste, damage, disposal)
 */
const confirmTransfer = async (txnId, userId) => {
  const transfer = await transferRepo.getTransferById(txnId);
  if (!transfer) throw new NotFoundError('طلب الحركة غير موجود');

  const isTransferOrReturn = transfer.txnType === 'internal_transfer' || transfer.txnType === 'return';
  if (isTransferOrReturn) {
    throw new BadRequestError('التحويلات الداخلية والمرتجعات يجب أن تمر عبر تدفق الاعتماد والشحن والاستلام الكامل');
  }

  if (transfer.status !== 'draft') {
    throw new BadRequestError('يمكن فقط تأكيد طلبات الحركة التي في حالة مسودة (Draft)');
  }

  for (const line of transfer.lines) {
    const stock = await stockRepo.getStockByNodeAndItem(transfer.fromNodeId, line.itemCode);
    const availableQty = stock ? stock.qtyOperational : 0;
    if (availableQty < line.quantity) {
      throw new BadRequestError(
        `رصيد الصنف [${line.itemCode}] غير كافٍ في المخزن. المتاح: ${availableQty}، المطلوب: ${line.quantity}`
      );
    }
  }

  const pool = getSystemDB();
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    for (const line of transfer.lines) {
      if (transfer.txnType === 'consumption') {
        await stockRepo.adjustStock(transfer.fromNodeId, line.itemCode, 'qty_consumed', line.quantity, transaction);
      } else if (transfer.txnType === 'waste') {
        await stockRepo.adjustStock(transfer.fromNodeId, line.itemCode, 'qty_wasted', line.quantity, transaction);
      } else if (transfer.txnType === 'damage') {
        await stockRepo.adjustStock(transfer.fromNodeId, line.itemCode, 'qty_damaged', line.quantity, transaction);
      } else if (transfer.txnType === 'disposal') {
        await stockRepo.adjustStock(transfer.fromNodeId, line.itemCode, 'qty_disposed', line.quantity, transaction);
      }
    }

    await transferRepo.updateTransferStatus(txnId, 'confirmed', userId, transaction);

    await transaction.commit();
    return { message: 'تم تأكيد العملية وتحديث الأرصدة التشغيلية بنجاح' };
  } catch (err) {
    await transaction.rollback();
    throw new DatabaseError(`فشل في تأكيد العملية وتعديل الأرصدة: ${err.message}`);
  }
};

const getTransfer = async (txnId) => {
  const transfer = await transferRepo.getTransferById(txnId);
  if (!transfer) throw new NotFoundError('طلب الحركة غير موجود');
  return transfer;
};

const listTransfers = async (nodeId = null, allowedNodeIds = null) => {
  return transferRepo.getAllTransfers(nodeId, allowedNodeIds);
};

module.exports = {
  createTransferDraft,
  submitForApproval,
  approveTransfer,
  dispatchTransfer,
  receiveTransfer,
  cancelTransfer,
  confirmTransfer,
  getTransfer,
  listTransfers,
};
