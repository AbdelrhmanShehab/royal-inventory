'use strict';

class OperationalLocation {
  constructor({ id, tenantId, nodeId, name, description, isActive, displayOrder, createdAt, updatedAt }) {
    this.id = id;
    this.tenantId = tenantId;
    this.nodeId = nodeId;
    this.name = name;
    this.description = description || null;
    this.isActive = !!isActive;
    this.displayOrder = displayOrder || 0;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  static fromDatabase(row) {
    if (!row) return null;
    return new OperationalLocation({
      id: row.id,
      tenantId: row.tenantId,
      nodeId: row.nodeId,
      name: row.name,
      description: row.description,
      isActive: row.isActive,
      displayOrder: row.displayOrder,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  toJSON() {
    return {
      id: this.id,
      tenantId: this.tenantId,
      nodeId: this.nodeId,
      name: this.name,
      description: this.description,
      isActive: this.isActive,
      displayOrder: this.displayOrder,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

module.exports = OperationalLocation;
