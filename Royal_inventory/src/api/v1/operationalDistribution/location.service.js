'use strict';

const repo = require('../../../repositories/system/operationalLocation.repo');
const txnRepo = require('../../../repositories/system/operationalTxn.repo');
const hierarchyRepo = require('../../../repositories/system/hierarchy.repo');
const { getOrSet, CACHE_KEYS, TTL } = require('../../../config/cache');
const { invalidateLocationCache } = require('../../../services/operationalDistribution.cache');
const { NotFoundError, BadRequestError } = require('../../../utils/errors');

const createLocation = async (nodeId, { tenantId = 1, name, description = null, isActive = true, displayOrder = 0 }) => {
  const node = await hierarchyRepo.getNodeById(nodeId);
  if (!node) {
    throw new NotFoundError('عقدة المخزن المحددة غير موجودة');
  }
  if (!node.isActive) {
    throw new BadRequestError('عقدة المخزن المحددة غير نشطة');
  }

  // Check if name is unique under this node
  const existingLocations = await repo.getLocationsByNodeId(nodeId);
  const nameExists = existingLocations.some(l => l.name.toLowerCase() === name.trim().toLowerCase());
  if (nameExists) {
    throw new BadRequestError('يوجد موقع تشغيلي آخر بنفس الاسم تحت هذا المستودع');
  }

  const id = await repo.createLocation({ tenantId, nodeId, name, description, isActive, displayOrder });
  invalidateLocationCache(nodeId);
  return id;
};

const getLocation = async (id) => {
  const location = await repo.getLocationById(id);
  if (!location) {
    throw new NotFoundError('الموقع التشغيلي غير موجود');
  }
  return location;
};

const listLocations = async (nodeId) => {
  const node = await hierarchyRepo.getNodeById(nodeId);
  if (!node) {
    throw new NotFoundError('عقدة المخزن المحددة غير موجودة');
  }
  
  return getOrSet(
    CACHE_KEYS.OP_LOCATIONS(nodeId),
    () => repo.getLocationsByNodeId(nodeId),
    TTL.OP_LOCATIONS
  );
};

const updateLocation = async (id, { name, description, isActive, displayOrder }) => {
  const location = await getLocation(id);
  
  // Check name uniqueness if changed
  if (name.trim().toLowerCase() !== location.name.toLowerCase()) {
    const existingLocations = await repo.getLocationsByNodeId(location.nodeId);
    const nameExists = existingLocations.some(l => l.name.toLowerCase() === name.trim().toLowerCase());
    if (nameExists) {
      throw new BadRequestError('يوجد موقع تشغيلي آخر بنفس الاسم تحت هذا المستودع');
    }
  }

  await repo.updateLocation(id, { name, description, isActive, displayOrder });
  invalidateLocationCache(location.nodeId);
  return { message: 'تم تحديث الموقع التشغيلي بنجاح' };
};

const deleteLocation = async (id) => {
  const location = await getLocation(id);

  // Business rule: Deleting an operational location with transactions/stock is forbidden
  const txnCount = await txnRepo.getTransactionCountByLocation(id);
  if (txnCount > 0) {
    throw new BadRequestError('لا يمكن حذف هذا الموقع التشغيلي لأنه يحتوي على حركات مخزنية مسجلة');
  }

  await repo.deleteLocation(id);
  invalidateLocationCache(location.nodeId);
  return { message: 'تم حذف الموقع التشغيلي بنجاح' };
};

module.exports = {
  createLocation,
  getLocation,
  listLocations,
  updateLocation,
  deleteLocation,
};
