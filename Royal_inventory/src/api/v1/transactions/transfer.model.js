'use strict';

/**
 * TransferLine Entity Model
 */
class TransferLine {
  constructor({ lineId, itemCode, itemNameAr, quantity, unitCode, unitCost, totalCost, notes }) {
    this.lineId = lineId;
    this.itemCode = itemCode;
    this.itemNameAr = itemNameAr || null;
    this.quantity = parseFloat(quantity);
    this.unitCode = unitCode || null;
    this.unitCost = parseFloat(unitCost || 0);
    this.totalCost = parseFloat(totalCost || 0);
    this.notes = notes || null;
  }

  static fromDatabase(row) {
    if (!row) return null;
    return new TransferLine({
      lineId: row.lineId,
      itemCode: row.itemCode,
      itemNameAr: row.itemNameAr,
      quantity: row.quantity,
      unitCode: row.unitCode,
      unitCost: row.unitCost,
      totalCost: row.totalCost,
      notes: row.notes,
    });
  }
}

/**
 * TransferTransaction Entity Model
 */
class TransferTransaction {
  constructor({ txnId, txnType, nodeId, createdBy, creatorUsername, createdByNameAr, txnDate, notes, status, confirmedBy, confirmedAt, confirmerUsername, confirmerNameAr, fromNodeId, fromNodeNameAr, toNodeId, toNodeNameAr, reason, lines = [], createdAt, itemCount, timeline = [] }) {
    this.txnId = txnId;
    this.txnType = txnType;
    this.nodeId = nodeId;
    this.createdBy = createdBy;
    this.creatorUsername = creatorUsername || null;
    this.createdByNameAr = createdByNameAr || null;
    this.txnDate = txnDate;
    this.notes = notes || null;
    this.status = status;
    this.confirmedBy = confirmedBy || null;
    this.confirmedAt = confirmedAt || null;
    this.confirmerUsername = confirmerUsername || null;
    this.confirmerNameAr = confirmerNameAr || null;
    this.fromNodeId = fromNodeId;
    this.fromNodeNameAr = fromNodeNameAr || null;
    this.toNodeId = toNodeId;
    this.toNodeNameAr = toNodeNameAr || null;
    this.reason = reason || null;
    this.lines = lines;
    this.createdAt = createdAt || null;
    this.itemCount = itemCount !== undefined ? Number(itemCount) : (lines ? lines.length : 0);
    this.timeline = timeline;
  }

  static fromDatabase(row) {
    if (!row) return null;
    return new TransferTransaction({
      txnId: row.txnId,
      txnType: row.txnType,
      nodeId: row.nodeId,
      createdBy: row.createdBy,
      creatorUsername: row.creatorUsername,
      createdByNameAr: row.createdByNameAr,
      txnDate: row.txnDate,
      notes: row.notes,
      status: row.status,
      confirmedBy: row.confirmedBy,
      confirmedAt: row.confirmedAt,
      confirmerUsername: row.confirmerUsername,
      confirmerNameAr: row.confirmerNameAr,
      fromNodeId: row.fromNodeId,
      fromNodeNameAr: row.fromNodeNameAr,
      toNodeId: row.toNodeId,
      toNodeNameAr: row.toNodeNameAr,
      reason: row.reason,
      lines: [], // to be set from lines table query
      createdAt: row.createdAt,
      itemCount: row.itemCount !== undefined ? Number(row.itemCount) : 0,
      timeline: row.timeline || [],
    });
  }

  isDraft() {
    return this.status === 'draft';
  }

  isConfirmed() {
    return this.status === 'confirmed';
  }
}

module.exports = {
  TransferLine,
  TransferTransaction,
};
