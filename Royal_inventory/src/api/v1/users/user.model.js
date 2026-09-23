'use strict';

/**
 * User Entity Model — represents a system user in ops.app_users
 */
class User {
  constructor({
    id,
    username,
    fullNameAr,
    passwordHash,
    role,
    nodeId,
    isActive,
    nodeNameAr,
    lastLoginAt,
    lockedUntil,
    failedAttempts,
    createdAt,
    nodeIds,
  }) {
    this.id             = id;
    this.username       = username;
    this.fullNameAr     = fullNameAr;
    this.passwordHash   = passwordHash;
    this.role           = role;
    this.nodeId         = nodeId;
    this.nodeIds        = nodeIds || [];
    this.isActive       = !!isActive;
    this.nodeNameAr     = nodeNameAr     || null;
    this.lastLoginAt    = lastLoginAt    || null;
    this.lockedUntil    = lockedUntil    || null;
    this.failedAttempts = failedAttempts || 0;
    this.createdAt      = createdAt;
  }

  /** Factory method — instantiate from raw database row */
  static fromDatabase(row) {
    if (!row) return null;
    return new User({
      id:             row.id,
      username:       row.username,
      fullNameAr:     row.fullNameAr,
      passwordHash:   row.passwordHash,
      role:           row.role,
      nodeId:         row.nodeId,
      nodeIds:        row.nodeIds,
      isActive:       row.isActive,
      nodeNameAr:     row.nodeNameAr,
      lastLoginAt:    row.lastLoginAt,
      lockedUntil:    row.lockedUntil,
      failedAttempts: row.failedAttempts,
      createdAt:      row.createdAt,
    });
  }

  /** Sanitize for API JSON response — strips password hash */
  toJSON() {
    return {
      id:             this.id,
      username:       this.username,
      fullNameAr:     this.fullNameAr,
      role:           this.role,
      nodeId:         this.nodeId,
      nodeIds:        this.nodeIds,
      isActive:       this.isActive,
      nodeNameAr:     this.nodeNameAr,
      lastLoginAt:    this.lastLoginAt,
      lockedUntil:    this.lockedUntil,
      failedAttempts: this.failedAttempts,
      createdAt:      this.createdAt,
    };
  }

  /** True if the account is currently locked */
  isLocked() {
    return this.lockedUntil && new Date(this.lockedUntil) > new Date();
  }
}

module.exports = User;
