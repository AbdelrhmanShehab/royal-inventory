'use strict';

/**
 * Custom Error Classes
 *
 * Extend these to throw typed errors from services/repos.
 * The global error handler (errorHandler.middleware.js) catches and formats them.
 */

class AppError extends Error {
  constructor(message, statusCode = 500, code = 'APP_ERROR', errors = null) {
    super(message);
    this.name       = this.constructor.name;
    this.statusCode = statusCode;
    this.code       = code;
    this.errors     = errors;
    this.isOperational = true; // distinguishes known errors from bugs
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message = 'بيانات غير صحيحة', errors = null) {
    super(message, 400, 'VALIDATION_ERROR', errors);
  }
}

class AuthenticationError extends AppError {
  constructor(message = 'غير مصرح — يرجى تسجيل الدخول') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

class AuthorizationError extends AppError {
  constructor(message = 'ليس لديك صلاحية للقيام بهذه العملية') {
    super(message, 403, 'FORBIDDEN');
  }
}

class NotFoundError extends AppError {
  constructor(message = 'العنصر المطلوب غير موجود') {
    super(message, 404, 'NOT_FOUND');
  }
}

class ConflictError extends AppError {
  constructor(message = 'هذه البيانات موجودة مسبقاً') {
    super(message, 409, 'CONFLICT');
  }
}

class BadRequestError extends AppError {
  constructor(message = 'طلب غير صالح') {
    super(message, 400, 'BAD_REQUEST');
  }
}

class DatabaseError extends AppError {
  constructor(message = 'خطأ في قاعدة البيانات') {
    super(message, 500, 'DATABASE_ERROR');
  }
}

class ComsysUnavailableError extends AppError {
  constructor(message = 'كوم سيس غير متاح حالياً — يرجى المحاولة لاحقاً') {
    super(message, 503, 'COMSYS_UNAVAILABLE');
  }
}

class InsufficientStockError extends AppError {
  constructor(message = 'الكمية المطلوبة أكبر من الرصيد المتاح', details = null) {
    super(message, 422, 'INSUFFICIENT_STOCK', details);
  }
}

module.exports = {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  BadRequestError,
  DatabaseError,
  ComsysUnavailableError,
  InsufficientStockError,
};
