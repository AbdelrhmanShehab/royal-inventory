'use strict';

/**
 * HotelGroup Entity Model
 */
class HotelGroup {
  constructor({ id, groupNameAr, groupNameEn, groupCode, isActive, createdAt }) {
    this.id = id;
    this.groupNameAr = groupNameAr;
    this.groupNameEn = groupNameEn || null;
    this.groupCode = groupCode;
    this.isActive = !!isActive;
    this.createdAt = createdAt;
  }

  static fromDatabase(row) {
    if (!row) return null;
    return new HotelGroup({
      id: row.id,
      groupNameAr: row.groupNameAr,
      groupNameEn: row.groupNameEn,
      groupCode: row.groupCode,
      isActive: row.isActive,
      createdAt: row.createdAt,
    });
  }
}

/**
 * InventoryNode (Warehouse Tree Node) Entity Model
 */
class InventoryNode {
  constructor({ id, comsysStoreCode, groupId, parentNodeId, nodeNameAr, nodeType, managerName, isActive, division, hasLaundryAccess }) {
    this.id = id;
    this.comsysStoreCode = comsysStoreCode || null;
    this.groupId = groupId;
    this.parentNodeId = parentNodeId || null;
    this.nodeNameAr = nodeNameAr;
    this.nodeType = nodeType;
    this.managerName = managerName || null;
    this.isActive = !!isActive;
    this.division = division || 'fb';
    this.hasLaundryAccess = !!hasLaundryAccess;
  }

  static fromDatabase(row) {
    if (!row) return null;
    return new InventoryNode({
      id: row.id,
      comsysStoreCode: row.comsysStoreCode,
      groupId: row.groupId,
      parentNodeId: row.parentNodeId,
      nodeNameAr: row.nodeNameAr,
      nodeType: row.nodeType,
      managerName: row.managerName,
      isActive: row.isActive,
      division: row.division,
      hasLaundryAccess: row.hasLaundryAccess,
    });
  }

  isParent() {
    return this.nodeType === 'parent';
  }

  isChild() {
    return this.nodeType === 'child';
  }
}

module.exports = {
  HotelGroup,
  InventoryNode,
};
