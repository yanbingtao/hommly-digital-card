import crypto from 'crypto';
import { isValidViewPin } from './view-pin';

const PIN_ITERATIONS = 100_000;
const PIN_KEYLEN = 32;

export function hashViewPin(pin: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto
    .pbkdf2Sync(pin.trim(), salt, PIN_ITERATIONS, PIN_KEYLEN, 'sha256')
    .toString('hex');
  return `${salt}:${hash}`;
}

export function verifyViewPin(pin: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;

  const candidate = crypto
    .pbkdf2Sync(pin.trim(), salt, PIN_ITERATIONS, PIN_KEYLEN, 'sha256')
    .toString('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(candidate, 'hex'));
  } catch {
    return false;
  }
}

export function resolveViewPinFields(
  enabled: boolean,
  pin: string,
  existingHash: string | null
): { view_pin_enabled: boolean; view_pin_hash: string | null; error: string | null } {
  if (!enabled) {
    return { view_pin_enabled: false, view_pin_hash: null, error: null };
  }

  const trimmed = pin.trim();
  if (trimmed) {
    if (!isValidViewPin(trimmed)) {
      return {
        view_pin_enabled: true,
        view_pin_hash: existingHash,
        error: 'PIN must be 4–6 digits.',
      };
    }
    return {
      view_pin_enabled: true,
      view_pin_hash: hashViewPin(trimmed),
      error: null,
    };
  }

  if (existingHash) {
    return { view_pin_enabled: true, view_pin_hash: existingHash, error: null };
  }

  return {
    view_pin_enabled: true,
    view_pin_hash: null,
    error: 'Please enter a PIN, or turn off PIN protection.',
  };
}
