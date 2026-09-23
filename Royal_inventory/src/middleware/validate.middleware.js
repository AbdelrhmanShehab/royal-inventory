'use strict';

const { ValidationError } = require('../utils/errors');

/**
 * validate(schema, target?) — Joi validation middleware factory.
 *
 * @param {Joi.Schema} schema  - Joi schema to validate against
 * @param {'body'|'query'|'params'} target - which part of the request to validate (default: 'body')
 *
 * Usage:
 *   router.post('/login', validate(loginSchema), authController.login);
 *   router.get('/items', validate(paginationSchema, 'query'), itemsController.list);
 */
const validate = (schema, target = 'body') => (req, res, next) => {
  const { error, value } = schema.validate(req[target], {
    abortEarly:   false,   // collect ALL errors, not just first
    stripUnknown: true,    // remove unknown keys from input
    convert:      true,    // coerce types (string '5' → number 5)
  });

  if (error) {
    const errors = error.details.map((d) => ({
      field:   d.path.join('.'),
      message: d.message.replace(/['"]/g, ''),
    }));

    return next(new ValidationError('بيانات الإدخال غير صحيحة', errors));
  }

  // Replace req[target] with the validated + sanitized value
  Object.defineProperty(req, target, {
    value,
    writable: true,
    configurable: true,
    enumerable: true,
  });
  next();
};

module.exports = validate;
