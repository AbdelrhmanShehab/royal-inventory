'use strict';

const { verifyAccessToken, isTokenBlacklisted } = require('../utils/token');
const { AuthenticationError } = require('../utils/errors');
const nodeCache = require('../services/node.cache');

/**
 * authenticate — verifies JWT access token from Authorization header.
 *
 * Sets req.user = { id, role, nodeId, fullNameAr, jti }
 *
 * Rejects if:
 *   - No token provided
 *   - Token expired
 *   - Token signature invalid
 *   - Token is blacklisted (logged out)
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('رمز المصادقة مفقود — يرجى تسجيل الدخول');
    }

    const token = authHeader.split(' ')[1];

    // Verify signature & expiry
    const decoded = verifyAccessToken(token);

    // Check blacklist (logged out tokens)
    if (isTokenBlacklisted(decoded.jti)) {
      throw new AuthenticationError('انتهت جلسة العمل — يرجى تسجيل الدخول مجدداً');
    }

    // Attach user context to request
    req.user = {
      id:         decoded.sub,
      role:       decoded.role,
      nodeId:     decoded.nodeId,
      fullNameAr: decoded.fullNameAr,
      jti:        decoded.jti,
    };

    // Determine allowed node scope IDs (including descendants recursively)
    if (req.user.role === 'admin') {
      req.user.allowedNodeIds = null; // Unrestricted admin access
    } else {
      let allowed = await nodeCache.getAllowedNodeIdsForUser(req.user.id);
      if ((!allowed || allowed.length === 0) && req.user.nodeId) {
        allowed = [req.user.nodeId];
      }
      req.user.allowedNodeIds = allowed || [];
    }

    next();
  } catch (err) {
    // Map JWT errors to our AuthenticationError
    if (err.name === 'TokenExpiredError') {
      return next(new AuthenticationError('انتهت صلاحية الجلسة — يرجى تسجيل الدخول مجدداً'));
    }
    if (err.name === 'JsonWebTokenError') {
      return next(new AuthenticationError('رمز مصادقة غير صالح'));
    }
    next(err);
  }
};

/**
 * optionalAuth — like authenticate but does NOT reject if no token.
 * Sets req.user if token is present and valid, otherwise req.user = null.
 */
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }
  authenticate(req, res, next);
};

module.exports = { authenticate, optionalAuth };
