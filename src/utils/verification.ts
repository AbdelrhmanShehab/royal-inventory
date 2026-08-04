/**
 * Verification and validation utilities for Royal Inventory Frontend
 */

export interface ValidationResult {
  isValid: boolean;
  error: string | null;
}

/**
 * Sanitizes input text by trimming outer spaces
 */
export const sanitizeInput = (val: string): string => {
  if (!val) return '';
  return val.trim();
};

/**
 * Validates username input
 */
export const validateUsername = (username: string): ValidationResult => {
  const sanitized = sanitizeInput(username);
  
  if (!sanitized) {
    return {
      isValid: false,
      error: 'يرجى إدخال اسم المستخدم',
    };
  }

  return {
    isValid: true,
    error: null,
  };
};

/**
 * Validates password input for login (min 6 chars)
 */
export const validatePassword = (password: string): ValidationResult => {
  if (!password) {
    return {
      isValid: false,
      error: 'يرجى إدخال كلمة المرور',
    };
  }

  if (password.length < 6) {
    return {
      isValid: false,
      error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل',
    };
  }

  return {
    isValid: true,
    error: null,
  };
};

/**
 * Checks if a JWT token is expired
 */
export const isTokenExpired = (token: string | null): boolean => {
  if (!token) return true;

  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;

    // Decode base64url payload
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );

    const decoded = JSON.parse(jsonPayload);
    if (!decoded || !decoded.exp) {
      return false; // If no exp claim, treat as non-expired
    }

    const currentTime = Math.floor(Date.now() / 1000);
    // Add 10s grace period buffer
    return decoded.exp < (currentTime + 10);
  } catch (err) {
    console.error('Error parsing JWT token expiration:', err);
    return true; // Treat invalid token as expired
  }
};
