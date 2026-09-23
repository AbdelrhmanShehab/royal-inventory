'use strict';

const service = require('./operationalTxn.service');
const asyncHandler = require('../../../utils/asyncHandler');
const R = require('../../../utils/response.helper');

const getStockSummary = asyncHandler(async (req, res) => {
  const nodeId = parseInt(req.params.nodeId, 10);
  const itemCode = req.params.itemCode || null;

  // RBAC scope check: verify if the user has access to this nodeId
  if (req.user.allowedNodeIds && !req.user.allowedNodeIds.includes(nodeId)) {
    return R.forbidden(res, 'ليس لديك صلاحية لعرض أرصدة هذا المستودع التشغيلي');
  }

  const summary = await service.getStockSummary(nodeId, itemCode);
  return R.success(res, summary, 'تم جلب خلاصة الأرصدة التشغيلية بنجاح');
});

module.exports = {
  getStockSummary,
};
