'use strict';

const TRANSACTION_TYPES = Object.freeze({
  ALLOCATE:   'ALLOCATE',
  CONSUME:    'CONSUME',
  RETURN:     'RETURN',
  ADJUSTMENT: 'ADJUSTMENT',
});

class OperationalTransaction {
  constructor({ id, tenantId, nodeId, locationId, itemCode, transactionType, quantity, notes, referenceType, referenceId, createdBy, createdAt }) {
    this.id = id;
    this.tenantId = tenantId;
    this.nodeId = nodeId;
    this.locationId = locationId;
    this.itemCode = itemCode;
    this.transactionType = transactionType;
    this.quantity = parseFloat(quantity);
    this.notes = notes || null;
    this.referenceType = referenceType || null;
    this.referenceId = referenceId || null;
    this.createdBy = createdBy;
    this.createdAt = createdAt;
  }

  static fromDatabase(row) {
    if (!row) return null;
    return new OperationalTransaction({
      id: row.id,
      tenantId: row.tenantId,
      nodeId: row.nodeId,
      locationId: row.locationId,
      itemCode: row.itemCode,
      transactionType: row.transactionType,
      quantity: row.quantity,
      notes: row.notes,
      referenceType: row.referenceType,
      referenceId: row.referenceId,
      createdBy: row.createdBy,
      createdAt: row.createdAt,
    });
  }

  isAllocate() {
    return this.transactionType === TRANSACTION_TYPES.ALLOCATE;
  }

  isConsume() {
    return this.transactionType === TRANSACTION_TYPES.CONSUME;
  }

  isReturn() {
    return this.transactionType === TRANSACTION_TYPES.RETURN;
  }

  isAdjustment() {
    return this.transactionType === TRANSACTION_TYPES.ADJUSTMENT;
  }

  signedQuantity() {
    if (this.isAllocate()) return this.quantity;
    if (this.isConsume() || this.isReturn()) return -this.quantity;
    return this.quantity; // Adjustment is stored directly with its sign
  }

  toJSON() {
    return {
      id: this.id,
      tenantId: this.tenantId,
      nodeId: this.nodeId,
      locationId: this.locationId,
      itemCode: this.itemCode,
      transactionType: this.transactionType,
      quantity: this.quantity,
      notes: this.notes,
      referenceType: this.referenceType,
      referenceId: this.referenceId,
      createdBy: this.createdBy,
      createdAt: this.createdAt,
    };
  }
}

module.exports = {
  TRANSACTION_TYPES,
  OperationalTransaction,
};
