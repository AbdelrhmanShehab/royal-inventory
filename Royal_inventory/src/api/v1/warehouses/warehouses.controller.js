'use strict';

const repo = require('../../../repositories/system/warehouse.repo');
const asyncHandler = require('../../../utils/asyncHandler');
const R = require('../../../utils/response.helper');

const listWarehouses = asyncHandler(async (req, res) => {
  const division = req.query.division || null; // 'fb' or 'gs' or null for all
  const warehouses = await repo.getAllWarehouses(division);
  return R.success(res, warehouses, 'تم جلب المستودعات بنجاح');
});

module.exports = {
  listWarehouses,
};
