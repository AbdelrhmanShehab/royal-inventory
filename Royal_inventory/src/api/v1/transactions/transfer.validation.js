'use strict';

const Joi = require('joi');

const transferLineSchema = Joi.object({
  itemCode: Joi.string().trim().required()
    .messages({ 'any.required': 'كود الصنف مطلوب' }),
  quantity: Joi.number().positive().required()
    .messages({
      'any.required': 'الكمية المطلوبة للتحويل غير محددة',
      'number.positive': 'الكمية يجب أن تكون أكبر من الصفر'
    }),
  unitCode: Joi.string().trim().allow(null, '').optional(),
  unitCost: Joi.number().min(0).default(0),
  notes: Joi.string().trim().max(200).allow(null, '').optional(),
});

const createTransferSchema = Joi.object({
  txnType: Joi.string().valid('consumption','internal_transfer','return','damage','waste','disposal').default('internal_transfer'),
  fromNodeId: Joi.number().integer().positive().required()
    .messages({ 'any.required': 'مستودع المصدر (من) مطلوب' }),
  toNodeId: Joi.number().integer().positive().when('txnType', {
    is: Joi.valid('internal_transfer', 'return'),
    then: Joi.required(),
    otherwise: Joi.optional().allow(null, '')
  }).messages({ 'any.required': 'مستودع الوجهة (إلى) مطلوب' }),
  notes: Joi.string().trim().max(500).allow(null, '').optional(),
  reason: Joi.string().trim().max(200).allow(null, '').optional(),
  lines: Joi.array().items(transferLineSchema).min(1).required()
    .messages({
      'any.required': 'يجب تحديد الأصناف المراد نقلها',
      'array.min': 'يجب تحديد صنف واحد على الأقل للتحويل'
    }),
});

const listTransfersQuerySchema = Joi.object({
  nodeId: Joi.number().integer().positive().optional(),
});

module.exports = {
  createTransferSchema,
  listTransfersQuerySchema,
};

