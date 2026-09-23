'use strict';
////eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsInJvbGUiOiJhZG1pbiIsIm5vZGVJZCI6bnVsbCwiZnVsbE5hbWVBciI6ItmF2K_ZitixINin2YTZhti42KfZhSIsImp0aSI6IjJkNDQ2NDEzLWZlZWMtNDc4My1iOTFhLWQ0NWJiODJjMDJlMSIsImlhdCI6MTc4MDc0ODgxOCwiZXhwIjoxNzgwNzQ5NzE4LCJhdWQiOiJpbnZlbnRvcnktb3BzLWNsaWVudCIsImlzcyI6ImludmVudG9yeV90cmFja2luZ19zeXN0ZW0ifQ.BxyE_MTbIAxHU2KJR8dqXZf17e7HV3r6akzbKqyKEx8 
/**
 * AES-256-GCM Encryption Utility
 *
 * Used for:
 *   - Encrypting sensitive config values stored outside .env (if needed)
 *   - Encrypting audit trail fields
 *   - Generating secure tokens
 *
 * The ENCRYPTION_KEY (from .env) must be exactly 32 bytes (64 hex chars).
 *
 * ⚠️  This is NOT used to store passwords — passwords are hashed with bcrypt.
 *     This is for REVERSIBLE encryption of sensitive non-password data.
 */

const crypto = require('crypto');
const config = require('../config/index');

const ALGORITHM  = 'aes-256-gcm';
const IV_LENGTH  = 16; // bytes
const TAG_LENGTH = 16; // bytes (auth tag)

// Parse the hex key from config
const getKey = () => Buffer.from(config.encryption.key, 'hex');

// ── Encrypt ───────────────────────────────────────────────────────────────────
/**
 * Encrypt plaintext string.
 * Returns: "iv:authTag:ciphertext" (all hex-encoded, colon-separated)
 */
const encrypt = (plaintext) => {
  if (!plaintext || typeof plaintext !== 'string') {
    throw new Error('[Encryption] plaintext must be a non-empty string');
  }

  const iv         = crypto.randomBytes(IV_LENGTH);
  const cipher     = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted  = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
};

// ── Decrypt ───────────────────────────────────────────────────────────────────
/**
 * Decrypt a value produced by encrypt().
 * Returns the original plaintext string.
 */
const decrypt = (encryptedString) => {
  if (!encryptedString || typeof encryptedString !== 'string') {
    throw new Error('[Encryption] encrypted value must be a non-empty string');
  }

  const parts = encryptedString.split(':');
  if (parts.length !== 3) {
    throw new Error('[Encryption] invalid encrypted string format');
  }

  const [ivHex, tagHex, cipherHex] = parts;
  const iv         = Buffer.from(ivHex,    'hex');
  const tag        = Buffer.from(tagHex,   'hex');
  const ciphertext = Buffer.from(cipherHex,'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
};

// ── Hash (one-way) ────────────────────────────────────────────────────────────
/**
 * Create a deterministic SHA-256 HMAC hash.
 * Used for: creating consistent lookup keys from sensitive data
 * NOT for passwords — use bcrypt for passwords.
 */
const hmacHash = (value) => {
  return crypto
    .createHmac('sha256', getKey())
    .update(value)
    .digest('hex');
};

// ── Secure Random ─────────────────────────────────────────────────────────────
/**
 * Generate a cryptographically secure random token.
 * Used for: refresh tokens, API keys, reset tokens.
 */
const generateSecureToken = (bytes = 32) => {
  return crypto.randomBytes(bytes).toString('hex');
};

/**
 * Generate a UUID v4
 */
const generateUUID = () => {
  return crypto.randomUUID();
};

// ── Key generation helper (for .env setup) ───────────────────────────────────
/**
 * Print a new random 32-byte hex key to console.
 * Run: node -e "require('./src/utils/encryption').printNewKey()"
 */
const printNewKey = () => {
  const key = crypto.randomBytes(32).toString('hex');
  console.log('\n🔑 New ENCRYPTION_KEY (add to .env):\n', key, '\n');
  return key;
};

module.exports = { encrypt, decrypt, hmacHash, generateSecureToken, generateUUID, printNewKey };
