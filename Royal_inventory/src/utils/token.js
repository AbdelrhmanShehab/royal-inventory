'use strict';

const jwt    = require('jsonwebtoken');
const config = require('../config/index');
const { generateSecureToken, generateUUID } = require('./encryption');
const { cache, CACHE_KEYS, TTL } = require('../config/cache');

/**
 * JWT Token Utility
 *
 * Access Token:  short-lived (15m) — sent in Authorization header
 * Refresh Token: long-lived (7d)   — sent in httpOnly cookie
 *
 * Strategy:
 *   - Access token contains: userId, role, nodeId, jti (unique ID for blacklisting)
 *   - Refresh token contains: userId, jti (linked to access jti)
 *   - On logout: access token jti is blacklisted in cache until expiry
 *   - On refresh: old refresh token is invalidated, new pair issued
 */

// ── Sign Access Token ─────────────────────────────────────────────────────────
const signAccessToken = (payload) => {
  const jti = generateUUID(); // unique token ID for blacklisting

  return jwt.sign(
    { ...payload, jti },
    config.jwt.accessSecret,
    {
      expiresIn:  config.jwt.accessExpires,
      issuer:     config.app.name,
      audience:   'inventory-ops-client',
    }
  );
};

// ── Sign Refresh Token ────────────────────────────────────────────────────────
const signRefreshToken = (userId) => {
  const jti = generateSecureToken(32); // random opaque ID

  return jwt.sign(
    { sub: userId, jti },
    config.jwt.refreshSecret,
    {
      expiresIn: config.jwt.refreshExpires,
      issuer:    config.app.name,
    }
  );
};

// ── Verify Access Token ───────────────────────────────────────────────────────
const verifyAccessToken = (token) => {
  return jwt.verify(token, config.jwt.accessSecret, {
    issuer:   config.app.name,
    audience: 'inventory-ops-client',
  });
};

// ── Verify Refresh Token ──────────────────────────────────────────────────────
const verifyRefreshToken = (token) => {
  return jwt.verify(token, config.jwt.refreshSecret, {
    issuer: config.app.name,
  });
};

// ── Blacklist (logout / token revocation) ─────────────────────────────────────
/**
 * Add a JTI to the blacklist (in-memory cache).
 * The token will be rejected on subsequent requests.
 */
const blacklistToken = (jti) => {
  cache.set(CACHE_KEYS.BLACKLIST_TOKEN(jti), true, TTL.TOKEN_BLACKLIST);
};

/**
 * Check if a JTI is blacklisted.
 */
const isTokenBlacklisted = (jti) => {
  return cache.get(CACHE_KEYS.BLACKLIST_TOKEN(jti)) === true;
};

// ── Issue token pair ──────────────────────────────────────────────────────────
/**
 * Create a new access + refresh token pair for a user.
 * @param {Object} user - { id, role, nodeId, fullNameAr }
 */
const issueTokenPair = (user) => {
  const accessToken  = signAccessToken({
    sub:        user.id,
    role:       user.role,
    nodeId:     user.nodeId,
    fullNameAr: user.fullNameAr,
  });

  const refreshToken = signRefreshToken(user.id);

  return { accessToken, refreshToken };
};

// ── Decode without verify (for logging/debugging only) ───────────────────────
const decodeToken = (token) => jwt.decode(token);

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  blacklistToken,
  isTokenBlacklisted,
  issueTokenPair,
  decodeToken,
};
