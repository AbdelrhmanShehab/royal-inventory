'use strict';

const service = require('./operationalTxn.service');
const locationRepo = require('../../../repositories/system/operationalLocation.repo');
const asyncHandler = require('../../../utils/asyncHandler');
const R = require('../../../utils/response.helper');
const { BadRequestError, AuthorizationError } = require('../../../utils/errors');

const getTxnParams = async (req) => {
  const locationId = parseInt(req.params.locationId, 10);
  const location = await locationRepo.getLocationById(locationId);
  if (!location) {
    throw new BadRequestError('الموقع التشغيلي المحدد غير موجود');
  }

  // Scoped user: check if they are allowed to manage/access this node
  if (req.user.allowedNodeIds && !req.user.allowedNodeIds.includes(location.nodeId)) {
    throw new AuthorizationError('ليس لديك صلاحية لإجراء عمليات على هذا المستودع التشغيلي');
  }

  return {
    locationId,
    nodeId: location.nodeId,
    createdBy: req.user.id,
  };
};

const allocate = asyncHandler(async (req, res) => {
  const { locationId, nodeId, createdBy } = await getTxnParams(req);
  const { itemCode, quantity, notes, referenceType, referenceId } = req.body;

  const result = await service.allocate({
    nodeId,
    locationId,
    itemCode,
    quantity: parseFloat(quantity),
    notes,
    referenceType,
    referenceId,
    createdBy,
  });

  return R.created(res, result, 'تم تخصيص الكمية بنجاح للموقع التشغيلي');
});

const consume = asyncHandler(async (req, res) => {
  const { locationId, nodeId, createdBy } = await getTxnParams(req);
  const { itemCode, quantity, notes } = req.body;

  const result = await service.consume({
    nodeId,
    locationId,
    itemCode,
    quantity: parseFloat(quantity),
    notes,
    createdBy,
  });

  return R.created(res, result, 'تم تسجيل استهلاك الكمية بنجاح من الموقع التشغيلي');
});

const returnStock = asyncHandler(async (req, res) => {
  const { locationId, nodeId, createdBy } = await getTxnParams(req);
  const { itemCode, quantity, notes } = req.body;

  const result = await service.returnStock({
    nodeId,
    locationId,
    itemCode,
    quantity: parseFloat(quantity),
    notes,
    createdBy,
  });

  return R.created(res, result, 'تم إرجاع الكمية بنجاح إلى رصيد المستودع المتاح');
});

const adjustment = asyncHandler(async (req, res) => {
  const { locationId, nodeId, createdBy } = await getTxnParams(req);
  const { itemCode, quantity, notes } = req.body;

  const result = await service.adjustment({
    nodeId,
    locationId,
    itemCode,
    quantity: parseFloat(quantity),
    notes,
    createdBy,
  });

  return R.created(res, result, 'تم إجراء التعديل المخزني بنجاح للموقع التشغيلي');
});

module.exports = {
  allocate,
  consume,
  returnStock,
  adjustment,
};
