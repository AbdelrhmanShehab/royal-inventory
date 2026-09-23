'use strict';

const comsysCategoryRepo = require('../../../repositories/comsys/comsysCategory.repo');
const localItemRepo = require('../../../repositories/system/item.repo');
const asyncHandler = require('../../../utils/asyncHandler');
const R = require('../../../utils/response.helper');

const getCategories = asyncHandler(async (req, res) => {
  const division = req.query.division || 'fb'; // default to fb (F&B)
  const categories = await comsysCategoryRepo.getAllCategories(division);
  return R.success(res, categories, 'تم جلب التصنيفات بنجاح');
});

const getItems = asyncHandler(async (req, res) => {
  const division = req.query.division || null;
  const categoryCode = req.query.categoryCode || null;
  const items = await localItemRepo.getAllItems(division, categoryCode);
  return R.success(res, items, 'تم جلب الأصناف بنجاح');
});

module.exports = {
  getCategories,
  getItems,
};
