import crypto from 'crypto';

const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

/** Length of the random recipient slug (~71 bits of entropy). */
const PUBLIC_TOKEN_LENGTH = 12;

/** Random suffix on edit links; order number is visible but this stays secret. */
const EDIT_SECRET_LENGTH = 10;

function randomBase62(length: number): string {
  const bytes = crypto.randomBytes(length);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += BASE62[bytes[i]! % 62];
  }
  return result;
}

/**
 * Short, URL-safe, unpredictable slug for /g/[publicToken].
 * Example: `5df1a09ac017` → https://hommly.online/g/5df1a09ac017
 */
export function generatePublicToken(): string {
  return randomBase62(PUBLIC_TOKEN_LENGTH);
}

/**
 * Makes order numbers safe inside a single URL path segment.
 */
export function sanitizeOrderNumberForUrl(orderNumber: string): string {
  const sanitized = orderNumber
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .replace(/_{2,}/g, '_')
    .replace(/-{2,}/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '');

  return sanitized || 'order';
}

/**
 * Edit link token: order number + unpredictable suffix for /e/[editToken].
 * Example: `test-20260804050603_k7Xm2pQ9wL`
 */
export function generateEditToken(orderNumber: string): string {
  const prefix = sanitizeOrderNumberForUrl(orderNumber);
  const secret = randomBase62(EDIT_SECRET_LENGTH);
  return `${prefix}_${secret}`;
}

export function isLegacyHexToken(token: string): boolean {
  return /^[a-f0-9]{64}$/i.test(token);
}
