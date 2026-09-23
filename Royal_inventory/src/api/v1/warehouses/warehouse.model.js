'use strict';

/**
 * Warehouse Cache Entity Model
 */
class Warehouse {
  constructor({ id, storeCode, storeNameAr, storeNameEn, division, isActive, syncedAt }) {
    this.id = id;
    this.storeCode = storeCode;
    this.storeNameAr = storeNameAr;
    this.storeNameEn = storeNameEn || null;
    this.division = division;
    this.isActive = !!isActive;
    this.syncedAt = syncedAt;
  }

  static fromDatabase(row) {
    if (!row) return null;
    return new Warehouse({
      id: row.id,
      storeCode: row.storeCode,
      storeNameAr: row.storeNameAr,
      storeNameEn: row.storeNameEn,
      division: row.division,
      isActive: row.isActive,
      syncedAt: row.syncedAt,
    });
  }
}

module.exports = Warehouse;
