'use strict';

const router       = require('express').Router();
const repo         = require('../../../repositories/system/permissions.repo');
const asyncHandler = require('../../../utils/asyncHandler');
const R            = require('../../../utils/response.helper');
const { authenticate }               = require('../../../middleware/auth.middleware');
const { authorize, invalidatePermissionsCache } = require('../../../middleware/rbac.middleware');

/**
 * Permissions management routes — admin only
 * Base: /api/v1/admin/permissions
 */

// GET /api/v1/admin/permissions — fetch full matrix
router.get('/',
  authenticate,
  authorize('admin'),
  asyncHandler(async (req, res) => {
    const matrix = await repo.getAllPermissions();
    return R.success(res, matrix, 'تم جلب مصفوفة الصلاحيات بنجاح');
  })
);

// PUT /api/v1/admin/permissions — bulk save entire matrix
router.put('/',
  authenticate,
  authorize('admin'),
  asyncHandler(async (req, res) => {
    const { updates } = req.body;
    if (!Array.isArray(updates) || updates.length === 0) {
      return R.badRequest(res, 'يجب إرسال مصفوفة updates');
    }
    // Validate each entry
    for (const u of updates) {
      if (!u.role || !u.permissionKey || typeof u.allowed !== 'boolean') {
        return R.badRequest(res, 'كل عنصر يجب أن يحتوي على: role, permissionKey, allowed (boolean)');
      }
    }
    const result = await repo.bulkUpdatePermissions(updates);
    // Invalidate in-memory cache so middleware picks up new rules immediately
    invalidatePermissionsCache();
    return R.success(res, result, `تم حفظ ${result.updated} صلاحية بنجاح`);
  })
);

// PATCH /api/v1/admin/permissions/:role/:permKey — toggle single permission
router.patch('/:role/:permKey',
  authenticate,
  authorize('admin'),
  asyncHandler(async (req, res) => {
    const { role, permKey } = req.params;
    const { allowed } = req.body;
    if (typeof allowed !== 'boolean') {
      return R.badRequest(res, 'الحقل allowed مطلوب (boolean)');
    }
    // Protect: cannot remove admin's manage_permissions right
    if (role === 'admin' && permKey === 'manage_permissions') {
      return R.badRequest(res, 'لا يمكن سحب صلاحية إدارة الصلاحيات من المدير');
    }
    const result = await repo.updatePermission(role, permKey, allowed);
    // Invalidate cache immediately
    invalidatePermissionsCache();
    return R.success(res, result, 'تم تحديث الصلاحية بنجاح');
  })
);

module.exports = router;
