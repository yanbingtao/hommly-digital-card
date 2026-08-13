import { cookies } from 'next/headers';
import {
  createEditPinSessionValue,
  EDIT_PIN_SESSION_MAX_AGE_SEC,
  fingerprintEditToken,
  parseEditPinSessionValue,
} from './edit-pin-session-token';

export const EDIT_PIN_SESSION_COOKIE = 'hommly_edit_pin_session';
export {
  createEditPinSessionValue,
  fingerprintEditToken,
  parseEditPinSessionValue,
  EDIT_PIN_SESSION_MAX_AGE_SEC,
} from './edit-pin-session-token';

export function getEditPinSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: EDIT_PIN_SESSION_MAX_AGE_SEC,
  };
}

/**
 * Multi-card sessions are stored as a JSON map cardId -> session token,
 * so verifying Card A does not unlock Card B, and both can coexist.
 */
type SessionJar = Record<string, string>;

function readSessionJar(): SessionJar {
  try {
    const raw = cookies().get(EDIT_PIN_SESSION_COOKIE)?.value;
    if (!raw) return {};
    if (raw.startsWith('{')) {
      const parsed = JSON.parse(raw) as SessionJar;
      return parsed && typeof parsed === 'object' ? parsed : {};
    }
    const single = parseEditPinSessionValue(raw);
    return single ? { [single.cardId]: raw } : {};
  } catch {
    return {};
  }
}

export async function setEditPinSessionCookie(
  cardId: string,
  editToken: string,
  sessionVersion: number
): Promise<void> {
  const value = createEditPinSessionValue(cardId, editToken, sessionVersion);
  const jar = readSessionJar();
  jar[cardId] = value;
  cookies().set(EDIT_PIN_SESSION_COOKIE, JSON.stringify(jar), getEditPinSessionCookieOptions());
}

export async function clearEditPinSessionForCard(cardId: string): Promise<void> {
  const jar = readSessionJar();
  if (!(cardId in jar)) return;
  delete jar[cardId];
  if (Object.keys(jar).length === 0) {
    cookies().set(EDIT_PIN_SESSION_COOKIE, '', {
      ...getEditPinSessionCookieOptions(),
      maxAge: 0,
    });
    return;
  }
  cookies().set(EDIT_PIN_SESSION_COOKIE, JSON.stringify(jar), getEditPinSessionCookieOptions());
}

export function getEditPinSessionForCard(
  cardId: string,
  editToken: string,
  sessionVersion: number
): boolean {
  const jar = readSessionJar();
  const raw = jar[cardId];
  const payload = parseEditPinSessionValue(raw);
  if (!payload) return false;
  if (payload.cardId !== cardId) return false;
  if (payload.tokenFp !== fingerprintEditToken(editToken)) return false;
  if (payload.ver !== sessionVersion) return false;
  return true;
}
