'use strict';

const service = require('./location.service');
const asyncHandler = require('../../../utils/asyncHandler');
const R = require('../../../utils/response.helper');

const createLocation = asyncHandler(async (req, res) => {
  const nodeId = parseInt(req.params.nodeId, 10);
  if (req.user.allowedNodeIds && !req.user.allowedNodeIds.includes(nodeId)) {
    return R.forbidden(res, 'ليس لديك صلاحية لإضافة مواقع لهذا المستودع');
  }

  const { tenantId, name, description, isActive, displayOrder } = req.body;
  const id = await service.createLocation(nodeId, { tenantId, name, description, isActive, displayOrder });
  return R.created(res, { id }, 'تم إنشاء الموقع التشغيلي بنجاح');
});

const listLocations = asyncHandler(async (req, res) => {
  const nodeId = parseInt(req.params.nodeId, 10);
  if (req.user.allowedNodeIds && !req.user.allowedNodeIds.includes(nodeId)) {
    return R.forbidden(res, 'ليس لديك صلاحية لعرض مواقع هذا المستودع');
  }

  const locations = await service.listLocations(nodeId);
  return R.success(res, locations, 'تم جلب المواقع التشغيلية بنجاح');
});

const updateLocation = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const location = await service.getLocation(id);
  if (req.user.allowedNodeIds && !req.user.allowedNodeIds.includes(location.nodeId)) {
    return R.forbidden(res, 'ليس لديك صلاحية لتعديل مواقع هذا المستودع');
  }

  const { name, description, isActive, displayOrder } = req.body;
  const result = await service.updateLocation(id, { name, description, isActive, displayOrder });
  return R.success(res, result, 'تم تحديث الموقع التشغيلي بنجاح');
});

const deleteLocation = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const location = await service.getLocation(id);
  if (req.user.allowedNodeIds && !req.user.allowedNodeIds.includes(location.nodeId)) {
    return R.forbidden(res, 'ليس لديك صلاحية لحذف مواقع هذا المستودع');
  }

  const result = await service.deleteLocation(id);
  return R.success(res, result, 'تم حذف الموقع التشغيلي بنجاح');
});

module.exports = {
  createLocation,
  listLocations,
  updateLocation,
  deleteLocation,
};
