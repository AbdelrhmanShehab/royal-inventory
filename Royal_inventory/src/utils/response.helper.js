'use strict';

/**
 * Standard API Response Helpers
 *
 * ALL responses follow this shape:
 * {
 *   success: boolean,
 *   message: string,
 *   data:    any | null,
 *   meta:    object | null,   ← pagination, counts, etc.
 *   errors:  array  | null,   ← validation errors
 *   code:    string | null,   ← machine-readable error code
 * }
 */

const success = (res, data = null, message = 'تمت العملية بنجاح', statusCode = 200, meta = null) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    meta,
    errors: null,
    code:   null,
  });
};

const created = (res, data = null, message = 'تم الإنشاء بنجاح') => {
  return success(res, data, message, 201);
};

const noContent = (res) => {
  return res.status(204).send();
};

const error = (res, message = 'حدث خطأ في الخادم', statusCode = 500, errors = null, code = null) => {
  return res.status(statusCode).json({
    success: false,
    message,
    data:    null,
    meta:    null,
    errors,
    code,
  });
};

const badRequest = (res, message = 'بيانات غير صحيحة', errors = null, code = 'VALIDATION_ERROR') => {
  return error(res, message, 400, errors, code);
};

const unauthorized = (res, message = 'غير مصرح — يرجى تسجيل الدخول', code = 'UNAUTHORIZED') => {
  return error(res, message, 401, null, code);
};

const forbidden = (res, message = 'ليس لديك صلاحية للقيام بهذه العملية', code = 'FORBIDDEN') => {
  return error(res, message, 403, null, code);
};

const notFound = (res, message = 'العنصر المطلوب غير موجود', code = 'NOT_FOUND') => {
  return error(res, message, 404, null, code);
};

const conflict = (res, message = 'هذه البيانات موجودة مسبقاً', code = 'CONFLICT') => {
  return error(res, message, 409, null, code);
};

const tooManyRequests = (res, message = 'طلبات كثيرة — يرجى الانتظار قبل المحاولة مجدداً') => {
  return error(res, message, 429, null, 'RATE_LIMITED');
};

const serverError = (res, message = 'خطأ في الخادم — يرجى المحاولة لاحقاً') => {
  return error(res, message, 500, null, 'SERVER_ERROR');
};

/**
 * Build paginated meta object
 */
const paginationMeta = (page, limit, total) => ({
  page:        parseInt(page, 10),
  limit:       parseInt(limit, 10),
  total,
  totalPages:  Math.ceil(total / limit),
  hasNextPage: page * limit < total,
  hasPrevPage: page > 1,
});

module.exports = {
  success,
  created,
  noContent,
  error,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  tooManyRequests,
  serverError,
  paginationMeta,
};
