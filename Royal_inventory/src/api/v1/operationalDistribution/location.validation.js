'use strict';

const Joi = require('joi');

const createLocationSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required()
    .messages({ 'any.required': 'اسم الموقع التشغيلي مطلوب' }),
  description: Joi.string().trim().max(500).allow(null, '').optional(),
  isActive: Joi.boolean().default(true),
  displayOrder: Joi.number().integer().min(0).default(0),
});

const updateLocationSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required()
    .messages({ 'any.required': 'اسم الموقع التشغيلي مطلوب' }),
  description: Joi.string().trim().max(500).allow(null, '').optional(),
  isActive: Joi.boolean().required()
    .messages({ 'any.required': 'الحالة مطلوبة' }),
  displayOrder: Joi.number().integer().min(0).required()
    .messages({ 'any.required': 'ترتيب العرض مطلوب' }),
});

const locationPathParamsSchema = Joi.object({
  id: Joi.number().integer().positive().required(),
});

const nodePathParamsSchema = Joi.object({
  nodeId: Joi.number().integer().positive().required(),
});

module.exports = {
  createLocationSchema,
  updateLocationSchema,
  locationPathParamsSchema,
  nodePathParamsSchema,
};
