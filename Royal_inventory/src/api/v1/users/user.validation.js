'use strict';

const Joi = require('joi');

const VALID_ROLES = ['admin', 'manager', 'warehouse_manager', 'warehouse_head', 'accountant', 'staff'];

const createUserSchema = Joi.object({
  username: Joi.string().trim().lowercase().min(3).max(50).required()
    .messages({
      'any.required': 'اسم المستخدم مطلوب',
      'string.empty': 'اسم المستخدم لا يمكن أن يكون فارغاً',
      'string.min': 'اسم المستخدم يجب أن يكون 3 أحرف على الأقل',
    }),
  fullNameAr: Joi.string().trim().min(3).max(100).required()
    .messages({
      'any.required': 'الاسم باللغة العربية مطلوب',
      'string.empty': 'الاسم لا يمكن أن يكون فارغاً',
      'string.min': 'الاسم يجب أن يكون 3 أحرف على الأقل',
    }),
  password: Joi.string().min(6).max(100).required()
    .messages({
      'any.required': 'كلمة المرور مطلوبة',
      'string.empty': 'كلمة المرور لا يمكن أن تكون فارغة',
      'string.min': 'كلمة المرور يجب أن تكون 6 أحرف على الأقل',
    }),
  role: Joi.string().valid(...VALID_ROLES).required()
    .messages({
      'any.required': 'دور المستخدم مطلوب',
      'any.only': 'الدور المحدد غير صالح',
    }),
  nodeId: Joi.number().integer().positive().allow(null).optional(),
  nodeIds: Joi.array().items(Joi.number().integer().positive()).min(1).unique().optional()
    .messages({
      'array.min': 'يجب تحديد مستودع واحد على الأقل في قائمة المستودعات',
      'array.unique': 'قائمة المستودعات تحتوي على قيم مكررة',
    }),
  isActive: Joi.boolean().default(true),
});

const updateUserSchema = Joi.object({
  fullNameAr: Joi.string().trim().min(3).max(100).required()
    .messages({
      'any.required': 'الاسم باللغة العربية مطلوب',
      'string.empty': 'الاسم لا يمكن أن يكون فارغاً',
      'string.min': 'الاسم يجب أن يكون 3 أحرف على الأقل',
    }),
  role: Joi.string().valid(...VALID_ROLES).required()
    .messages({
      'any.required': 'دور المستخدم مطلوب',
      'any.only': 'الدور المحدد غير صالح',
    }),
  nodeId: Joi.number().integer().positive().allow(null).optional(),
  nodeIds: Joi.array().items(Joi.number().integer().positive()).min(1).unique().optional()
    .messages({
      'array.min': 'يجب تحديد مستودع واحد على الأقل في قائمة المستودعات',
      'array.unique': 'قائمة المستودعات تحتوي على قيم مكررة',
    }),
  isActive: Joi.boolean().required()
    .messages({
      'any.required': 'حالة الحساب (نشط/معطل) مطلوبة',
    }),
});

const resetPasswordSchema = Joi.object({
  newPassword: Joi.string().min(6).max(100).required()
    .messages({
      'any.required': 'كلمة المرور الجديدة مطلوبة',
      'string.empty': 'كلمة المرور لا يمكن أن تكون فارغة',
      'string.min': 'كلمة المرور يجب أن تكون 6 أحرف على الأقل',
    }),
});

module.exports = {
  createUserSchema,
  updateUserSchema,
  resetPasswordSchema,
};
