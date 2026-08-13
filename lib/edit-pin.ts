import crypto from 'crypto';

export const EDIT_PIN_LENGTH = 6;
export const EDIT_PIN_REGEX = /^\d{6}$/;

/** Cryptographically secure 6-digit PIN (leading zeroes allowed). */
export function generateEditPin(): string {
  // Rejection sampling keeps the distribution uniform over 000000–999999.
  const max = 1_000_000;
  const limit = Math.floor(0x100000000 / max) * max;
  let value: number;
  do {
    value = crypto.randomBytes(4).readUInt32BE(0);
  } while (value >= limit);
  return String(value % max).padStart(EDIT_PIN_LENGTH, '0');
}

export function isValidEditPin(pin: string): boolean {
  return EDIT_PIN_REGEX.test(pin);
}

export function normalizeEditPinInput(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, EDIT_PIN_LENGTH);
}
