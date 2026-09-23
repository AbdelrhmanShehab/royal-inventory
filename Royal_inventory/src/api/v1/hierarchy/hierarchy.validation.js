'use strict';

const Joi = require('joi');

const createGroupSchema = Joi.object({
  groupNameAr: Joi.string().trim().min(3).max(100).required()
    .messages({ 'any.required': 'اسم المجموعة باللغة العربية مطلوب' }),
  groupNameEn: Joi.string().trim().max(100).allow(null, '').optional(),
  groupCode: Joi.string().trim().uppercase().min(2).max(20).required()
    .messages({ 'any.required': 'رمز المجموعة (Code) مطلوب' }),
  isActive: Joi.boolean().default(true),
});

const createNodeSchema = Joi.object({
  comsysStoreCode: Joi.string().trim().max(50).allow(null, '').optional(),
  groupId: Joi.number().integer().positive().required()
    .messages({ 'any.required': 'المجموعة (Group) مطلوبة' }),
  parentNodeId: Joi.number().integer().positive().allow(null).optional(),
  nodeNameAr: Joi.string().trim().min(3).max(100).required()
    .messages({ 'any.required': 'اسم العقدة مطلوب' }),
  nodeType: Joi.string().valid('parent', 'child').required()
    .messages({ 'any.required': 'نوع العقدة (parent/child) مطلوب' }),
  managerName: Joi.string().trim().max(100).allow(null, '').optional(),
  isActive: Joi.boolean().default(true),
  division: Joi.string().valid('fb', 'gs').default('fb').optional(),
  hasLaundryAccess: Joi.boolean().optional(),
});

const updateNodeSchema = Joi.object({
  comsysStoreCode: Joi.string().trim().max(50).allow(null, '').optional(),
  parentNodeId: Joi.number().integer().positive().allow(null).optional(),
  nodeNameAr: Joi.string().trim().min(3).max(100).required()
    .messages({ 'any.required': 'اسم العقدة مطلوب' }),
  nodeType: Joi.string().valid('parent', 'child').required()
    .messages({ 'any.required': 'نوع العقدة (parent/child) مطلوب' }),
  managerName: Joi.string().trim().max(100).allow(null, '').optional(),
  isActive: Joi.boolean().required()
    .messages({ 'any.required': 'حالة العقدة مطلوبة' }),
  division: Joi.string().valid('fb', 'gs').optional(),
  hasLaundryAccess: Joi.boolean().optional(),
});

const treeQuerySchema = Joi.object({
  groupId: Joi.number().integer().positive().optional(),
  ignoreScope: Joi.string().valid('true', 'false').optional(),
});

const nodePathParamsSchema = Joi.object({
  id: Joi.number().integer().positive().required(),
});

module.exports = {
  createGroupSchema,
  createNodeSchema,
  updateNodeSchema,
  treeQuerySchema,
  nodePathParamsSchema,
};
