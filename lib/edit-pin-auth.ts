import { headers } from 'next/headers';
import { verifyEditPinHash } from './edit-pin-crypto';
import {
  checkEditPinRateLimit,
  clearEditPinFailures,
  recordEditPinFailure,
} from './edit-pin-rate-limit';
import {
  ensureEditPinForCard,
  getEditPinCardByEditToken,
} from './edit-pin-service';
import {
  getEditPinSessionForCard,
  setEditPinSessionCookie,
} from './edit-pin-session';
import { isValidEditPin, normalizeEditPinInput } from './edit-pin';

export function getRequestIp(): string {
  try {
    const h = headers();
    const forwarded = h.get('x-forwarded-for')?.split(',')[0]?.trim();
    return forwarded || h.get('x-real-ip')?.trim() || 'unknown';
  } catch {
    return 'unknown';
  }
}

export async function hasValidEditPinSession(editToken: string): Promise<boolean> {
  const trimmed = editToken?.trim();
  if (!trimmed) return false;

  const { card, error } = await getEditPinCardByEditToken(trimmed);
  if (error || !card) return false;

  await ensureEditPinForCard(card.id);

  const { card: refreshed } = await getEditPinCardByEditToken(trimmed);
  if (!refreshed?.edit_pin_hash) return false;

  return getEditPinSessionForCard(
    refreshed.id,
    refreshed.edit_token,
    refreshed.edit_session_version ?? 0
  );
}

export async function assertBuyerEditAuthorized(
  editToken: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ok = await hasValidEditPinSession(editToken);
  if (!ok) {
    return { ok: false, error: 'Edit PIN verification required.' };
  }
  return { ok: true };
}

export type VerifyEditPinResult =
  | { ok: true }
  | { ok: false; error: string; rateLimited?: boolean };

export async function verifyEditPinAndCreateSession(
  editToken: string,
  pinInput: string
): Promise<VerifyEditPinResult> {
  const trimmedToken = editToken?.trim();
  if (!trimmedToken) {
    return { ok: false, error: 'That PIN doesn\'t match. Please try again.' };
  }

  const { card, error } = await getEditPinCardByEditToken(trimmedToken);
  if (error || !card) {
    return { ok: false, error: 'That PIN doesn\'t match. Please try again.' };
  }

  const ensure = await ensureEditPinForCard(card.id);
  if (ensure.error) {
    console.error('[edit-pin] ensure failed', { cardId: card.id });
    return { ok: false, error: 'Something went wrong. Please try again later.' };
  }

  const { card: fresh } = await getEditPinCardByEditToken(trimmedToken);
  if (!fresh?.edit_pin_hash) {
    return { ok: false, error: 'Something went wrong. Please try again later.' };
  }

  const ip = getRequestIp();
  const rate = await checkEditPinRateLimit(fresh.id, ip);
  if (!rate.ok) {
    return {
      ok: false,
      error: 'Too many attempts. Please try again later.',
      rateLimited: true,
    };
  }

  const pin = normalizeEditPinInput(pinInput);
  if (!isValidEditPin(pin) || !verifyEditPinHash(pin, fresh.edit_pin_hash)) {
    await recordEditPinFailure(fresh.id, ip);
    console.info('[edit-pin] verification failure', { cardId: fresh.id });
    return { ok: false, error: 'That PIN doesn\'t match. Please try again.' };
  }

  await clearEditPinFailures(fresh.id, ip);
  await setEditPinSessionCookie(
    fresh.id,
    fresh.edit_token,
    fresh.edit_session_version ?? 0
  );
  console.info('[edit-pin] verification success', { cardId: fresh.id });
  return { ok: true };
}
