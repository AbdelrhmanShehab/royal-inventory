'use strict';

/**
 * Category Entity Model
 */
class Category {
  constructor({ categoryCode, categoryNameAr, categoryNameEn }) {
    this.categoryCode = categoryCode;
    this.categoryNameAr = categoryNameAr;
    this.categoryNameEn = categoryNameEn || null;
  }

  static fromDatabase(row) {
    if (!row) return null;
    return new Category({
      categoryCode: row.category_code,
      categoryNameAr: row.category_name_ar,
      categoryNameEn: row.category_name_en,
    });
  }
}

/**
 * Item Cache Entity Model
 */
class Item {
  constructor({ id, itemCode, itemNameAr, itemNameEn, categoryCode, unitCode, unitNameAr, itemType, division, isActive, syncedAt }) {
    this.id = id;
    this.itemCode = itemCode;
    this.itemNameAr = itemNameAr;
    this.itemNameEn = itemNameEn || null;
    this.categoryCode = categoryCode || null;
    this.unitCode = unitCode || null;
    this.unitNameAr = unitNameAr || null;
    this.itemType = itemType;
    this.division = division;
    this.isActive = !!isActive;
    this.syncedAt = syncedAt;
  }

  static fromDatabase(row) {
    if (!row) return null;
    return new Item({
      id: row.id,
      itemCode: row.itemCode,
      itemNameAr: row.itemNameAr,
      itemNameEn: row.itemNameEn,
      categoryCode: row.categoryCode,
      unitCode: row.unitCode,
      unitNameAr: row.unitNameAr,
      itemType: row.itemType,
      division: row.division,
      isActive: row.isActive,
      syncedAt: row.syncedAt,
    });
  }
}

module.exports = {
  Category,
  Item,
};
