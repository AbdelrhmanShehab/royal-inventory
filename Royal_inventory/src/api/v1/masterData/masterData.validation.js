'use strict';

const Joi = require('joi');

const categoriesQuerySchema = Joi.object({
  division: Joi.string().valid('fb', 'gs').default('fb')
    .messages({ 'any.only': 'القسم غير صالح. يجب أن يكون fb أو gs' }),
});

const itemsQuerySchema = Joi.object({
  division: Joi.string().valid('fb', 'gs').optional()
    .messages({ 'any.only': 'القسم غير صالح. يجب أن يكون fb أو gs' }),
  categoryCode: Joi.string().trim().allow(null, '').optional(),
});

module.exports = {
  categoriesQuerySchema,
  itemsQuerySchema,
};
