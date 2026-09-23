'use strict';

const { AuthorizationError } = require('../utils/errors');
const permissionsCache = require('../services/permissions.cache');

/**
 * Role Hierarchy (higher level = more permissions)
 *
 * Level 5 — admin             — مدير النظام    — Full system access
 * Level 4 — manager           — مدير عام        — All nodes read + approvals
 * Level 3 — warehouse_manager — مدير مستودع    — Own node + sub-nodes, create & confirm txns
 * Level 2 — warehouse_head    — رئيس عهدة      — Own node, create drafts + quick consume
 * Level 1 — accountant        — محاسب            — Read-only financial reports
 * Level 0 — staff             — موظف مستودع    — Own node quick consume only
 */
const ROLE_HIERARCHY = {
  staff:             0,
  accountant:        1,
  warehouse_head:    2,
  warehouse_manager: 3,
  manager:           4,
  admin:             5,
};

/** Roles that are scoped to a specific warehouse node */
const WAREHOUSE_ROLES = ['warehouse_manager', 'warehouse_head', 'staff'];

/** Arabic display labels per role */
const ROLE_LABELS_AR = {
  admin:             'مدير النظام',
  manager:           'مدير عام',
  warehouse_manager: 'مدير مستودع',
  warehouse_head:    'رئيس عهدة',
  accountant:        'محاسب',
  staff:             'موظف مستودع',
};

/**
 * authorize(...roles) — restrict access to users with specific roles.
 *
 * Usage:
 *   router.post('/sync', authenticate, authorize('admin'), syncController.runSync);
 *   router.get('/reports', authenticate, authorize('manager', 'admin'), reportController.get);
 */
const authorize = (...allowedRoles) => (req, res, next) => {
  if (!req.user) {
    return next(new AuthorizationError());
  }

  if (!allowedRoles.includes(req.user.role)) {
    return next(
      new AuthorizationError(
        `صلاحية "${req.user.role}" لا تكفي — مطلوب: ${allowedRoles.join(' أو ')}`
      )
    );
  }

  next();
};

/**
 * authorizeMinLevel(minRole) — allows any role at or above the minimum.
 *
 * Usage:
 *   router.get('/stock', authenticate, authorizeMinLevel('warehouse_head'), ...);
 *   → allows: warehouse_head, warehouse_manager, manager, admin
 *   → rejects: staff, accountant
 */
const authorizeMinLevel = (minRole) => (req, res, next) => {
  if (!req.user) return next(new AuthorizationError());

  const userLevel = ROLE_HIERARCHY[req.user.role] ?? -1;
  const minLevel  = ROLE_HIERARCHY[minRole]       ?? 99;

  if (userLevel < minLevel) {
    return next(new AuthorizationError(
      `مستوى الصلاحية "${req.user.role}" لا يكفي للوصول لهذه الوظيفة`
    ));
  }

  next();
};

/**
 * authorizeOwnNode — ensures warehouse-scoped roles can only access their assigned node.
 * Admin and manager bypass this check entirely.
 * warehouse_manager can access sub-nodes of their assigned parent.
 *
 * Usage: router.post('/transactions', authenticate, authorizeOwnNode, ...);
 * Requires req.body.nodeId or req.params.nodeId.
 */
const authorizeOwnNode = (req, res, next) => {
  if (!req.user) return next(new AuthorizationError());

  // Admins and managers can access any node
  if (['admin', 'manager'].includes(req.user.role)) return next();

  // Accountants can read but not write — handled separately via authorize()
  if (req.user.role === 'accountant') return next();

  const requestedNodeId = parseInt(req.body?.nodeId || req.params?.nodeId, 10);

  if (!requestedNodeId || requestedNodeId !== req.user.nodeId) {
    return next(
      new AuthorizationError('يمكنك فقط إجراء عمليات على مستودعك المخصص')
    );
  }

  next();
};

/**
 * authorizeWarehouseScope — like authorizeOwnNode but stricter:
 * only warehouse_manager, warehouse_head, and staff need node scoping.
 * Admin/manager/accountant pass through freely.
 */
const authorizeWarehouseScope = (req, res, next) => {
  if (!req.user) return next(new AuthorizationError());

  if (!WAREHOUSE_ROLES.includes(req.user.role)) return next();

  const requestedNodeId = parseInt(req.body?.nodeId || req.params?.nodeId, 10);

  if (!requestedNodeId || requestedNodeId !== req.user.nodeId) {
    return next(
      new AuthorizationError('صلاحياتك مقيدة بمستودعك المخصص فقط')
    );
  }

  next();
};

/**
 * authorizePermission(permKey) — DB-driven permission check.
 * Reads from ops.role_permissions table (cached in memory, 5-min TTL).
 * Falls back to deny-all if DB is unreachable.
 *
 * Usage:
 *   router.post('/submit', authenticate, authorizePermission('submit_approval'), ...);
 */
const authorizePermission = (permKey) => async (req, res, next) => {
  if (!req.user) return next(new AuthorizationError());

  try {
    const allowed = await permissionsCache.hasPermission(req.user.role, permKey);
    if (!allowed) {
      return next(new AuthorizationError(
        `الدور "${req.user.role}" لا يملك صلاحية: ${permKey}`
      ));
    }
    next();
  } catch (err) {
    return next(new AuthorizationError('تعذّر التحقق من الصلاحيات — حاول مجدداً'));
  }
};

module.exports = {
  authorize,
  authorizeMinLevel,
  authorizePermission,
  authorizeOwnNode,
  authorizeWarehouseScope,
  ROLE_HIERARCHY,
  WAREHOUSE_ROLES,
  ROLE_LABELS_AR,
  invalidatePermissionsCache: permissionsCache.invalidateCache,
};
