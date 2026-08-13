import crypto from 'crypto';
import { getEditSessionHmacKey } from './edit-pin-crypto';

export const EDIT_PIN_SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 7; // 7 days

export type EditPinSessionPayload = {
  cardId: string;
  tokenFp: string;
  ver: number;
  exp: number;
};

export function fingerprintEditToken(editToken: string): string {
  return crypto.createHash('sha256').update(editToken).digest('hex').slice(0, 32);
}

function signPayload(encoded: string): string {
  return crypto.createHmac('sha256', getEditSessionHmacKey()).update(encoded).digest('base64url');
}

export function createEditPinSessionValue(
  cardId: string,
  editToken: string,
  sessionVersion: number
): string {
  const payload: EditPinSessionPayload = {
    cardId,
    tokenFp: fingerprintEditToken(editToken),
    ver: sessionVersion,
    exp: Math.floor(Date.now() / 1000) + EDIT_PIN_SESSION_MAX_AGE_SEC,
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return `${encoded}.${signPayload(encoded)}`;
}

export function parseEditPinSessionValue(
  raw: string | undefined | null
): EditPinSessionPayload | null {
  if (!raw) return null;
  const [encoded, sig] = raw.split('.');
  if (!encoded || !sig) return null;
  const expected = signPayload(encoded);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    const payload = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8')
    ) as EditPinSessionPayload;
    if (!payload.cardId || !payload.tokenFp || typeof payload.ver !== 'number') return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
