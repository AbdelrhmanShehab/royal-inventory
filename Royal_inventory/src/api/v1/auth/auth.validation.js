'use strict';

const Joi = require('joi');

const loginSchema = Joi.object({
  username: Joi.string().trim().min(3).max(50).required()
    .messages({ 'any.required': 'اسم المستخدم مطلوب', 'string.min': 'اسم المستخدم قصير جداً' }),
  password: Joi.string().min(6).max(100).required()
    .messages({ 'any.required': 'كلمة المرور مطلوبة', 'string.min': 'كلمة المرور قصيرة جداً' }),
});

const refreshSchema = Joi.object({
  refreshToken: Joi.string().required()
    .messages({ 'any.required': 'رمز التجديد مطلوب' }),
});

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string()
    .min(8).max(100)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .required()
    .messages({
      'string.pattern.base': 'كلمة المرور يجب أن تحتوي على حرف كبير وصغير ورقم ورمز خاص',
      'string.min': 'كلمة المرور يجب أن تكون 8 أحرف على الأقل',
    }),
  confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required()
    .messages({ 'any.only': 'كلمة المرور وتأكيدها غير متطابقين' }),
});

module.exports = { loginSchema, refreshSchema, changePasswordSchema };
