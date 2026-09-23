'use strict';

const Joi = require('joi');

const allocateSchema = Joi.object({
  itemCode: Joi.string().trim().max(50).required()
    .messages({ 'any.required': 'رمز الصنف مطلوب' }),
  quantity: Joi.number().positive().required()
    .messages({ 
      'any.required': 'الكمية مطلوبة',
      'number.positive': 'يجب أن تكون الكمية أكبر من الصفر'
    }),
  notes: Joi.string().trim().max(500).allow(null, '').optional(),
  referenceType: Joi.string().trim().max(50).allow(null, '').optional(),
  referenceId: Joi.string().trim().max(100).allow(null, '').optional(),
});

const consumeSchema = Joi.object({
  itemCode: Joi.string().trim().max(50).required()
    .messages({ 'any.required': 'رمز الصنف مطلوب' }),
  quantity: Joi.number().positive().required()
    .messages({ 
      'any.required': 'الكمية مطلوبة',
      'number.positive': 'يجب أن تكون الكمية أكبر من الصفر'
    }),
  notes: Joi.string().trim().max(500).allow(null, '').optional(),
});

const returnSchema = Joi.object({
  itemCode: Joi.string().trim().max(50).required()
    .messages({ 'any.required': 'رمز الصنف مطلوب' }),
  quantity: Joi.number().positive().required()
    .messages({ 
      'any.required': 'الكمية مطلوبة',
      'number.positive': 'يجب أن تكون الكمية أكبر من الصفر'
    }),
  notes: Joi.string().trim().max(500).allow(null, '').optional(),
});

const adjustmentSchema = Joi.object({
  itemCode: Joi.string().trim().max(50).required()
    .messages({ 'any.required': 'رمز الصنف مطلوب' }),
  quantity: Joi.number().invalid(0).required()
    .messages({ 
      'any.required': 'الكمية مطلوبة',
      'number.invalid': 'الكمية المعدلة لا يمكن أن تكون صفر'
    }),
  notes: Joi.string().trim().min(3).max(500).required()
    .messages({ 
      'any.required': 'ملاحظات التعديل مطلوبة',
      'string.min': 'يرجى إدخال سبب التعديل بوضوح في الملاحظات'
    }),
});

const transactionPathParamsSchema = Joi.object({
  locationId: Joi.number().integer().positive().required(),
});

const summaryPathParamsSchema = Joi.object({
  nodeId: Joi.number().integer().positive().required(),
  itemCode: Joi.string().trim().max(50).optional(),
});

module.exports = {
  allocateSchema,
  consumeSchema,
  returnSchema,
  adjustmentSchema,
  transactionPathParamsSchema,
  summaryPathParamsSchema,
};
