import crypto from 'crypto';
import { isValidEditPin } from './edit-pin';

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEYLEN = 32;
const SALT_BYTES = 16;

const AES_ALGO = 'aes-256-gcm';
const IV_BYTES = 12;

function getEncryptionKey(): Buffer {
  const raw = process.env.EDIT_PIN_ENCRYPTION_KEY?.trim();
  if (!raw) {
    throw new Error('EDIT_PIN_ENCRYPTION_KEY is not configured');
  }
  // Accept 32-byte base64 or 64-char hex.
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, 'hex');
  }
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new Error('EDIT_PIN_ENCRYPTION_KEY must be 32 bytes (base64 or 64-char hex)');
  }
  return key;
}

export function isEditPinEncryptionConfigured(): boolean {
  try {
    getEncryptionKey();
    return true;
  } catch {
    return false;
  }
}

/** scrypt hash stored as saltHex:hashHex */
export function hashEditPin(pin: string): string {
  if (!isValidEditPin(pin)) {
    throw new Error('Edit PIN must be exactly 6 digits');
  }
  const salt = crypto.randomBytes(SALT_BYTES);
  const hash = crypto.scryptSync(pin, salt, SCRYPT_KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

export function verifyEditPinHash(pin: string, stored: string): boolean {
  if (!isValidEditPin(pin) || !stored) return false;
  const [saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex) return false;
  try {
    const salt = Buffer.from(saltHex, 'hex');
    const expected = Buffer.from(hashHex, 'hex');
    const candidate = crypto.scryptSync(pin, salt, expected.length, {
      N: SCRYPT_N,
      r: SCRYPT_R,
      p: SCRYPT_P,
    });
    return crypto.timingSafeEqual(expected, candidate);
  } catch {
    return false;
  }
}

/** AES-256-GCM: v1:iv:tag:ciphertext (base64url parts) */
export function encryptEditPin(pin: string): string {
  if (!isValidEditPin(pin)) {
    throw new Error('Edit PIN must be exactly 6 digits');
  }
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(AES_ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(pin, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    'v1',
    iv.toString('base64url'),
    tag.toString('base64url'),
    ciphertext.toString('base64url'),
  ].join(':');
}

export function decryptEditPin(payload: string): string {
  const [version, ivB64, tagB64, dataB64] = payload.split(':');
  if (version !== 'v1' || !ivB64 || !tagB64 || !dataB64) {
    throw new Error('Invalid encrypted Edit PIN payload');
  }
  const key = getEncryptionKey();
  const iv = Buffer.from(ivB64, 'base64url');
  const tag = Buffer.from(tagB64, 'base64url');
  const data = Buffer.from(dataB64, 'base64url');
  const decipher = crypto.createDecipheriv(AES_ALGO, key, iv);
  decipher.setAuthTag(tag);
  const pin = Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  if (!isValidEditPin(pin)) {
    throw new Error('Decrypted Edit PIN is invalid');
  }
  return pin;
}

/** Derive HMAC key for edit sessions from the encryption key (single env var). */
export function getEditSessionHmacKey(): Buffer {
  const key = getEncryptionKey();
  return crypto.createHmac('sha256', key).update('hommly-edit-session-v1').digest();
}
