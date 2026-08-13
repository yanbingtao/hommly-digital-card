'use server';

import { assertAdminAuthenticated } from './admin-auth';
import { clearEditPinSessionForCard } from './edit-pin-session';
import { verifyEditPinAndCreateSession } from './edit-pin-auth';
import {
  ensureEditPinForCard,
  resetEditPinForCard,
  revealEditPinForCard,
} from './edit-pin-service';

export async function verifyBuyerEditPinAction(
  editToken: string,
  pin: string
): Promise<{ ok: boolean; error?: string }> {
  const result = await verifyEditPinAndCreateSession(editToken, pin);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }
  return { ok: true };
}

export async function adminRevealEditPinAction(
  cardId: string
): Promise<{ pin: string | null; error: string | null }> {
  await assertAdminAuthenticated();
  const result = await revealEditPinForCard(cardId);
  if (result.pin) {
    console.info('[edit-pin] admin reveal', { cardId });
  }
  return result;
}

export async function adminResetEditPinAction(
  cardId: string
): Promise<{ pin: string | null; error: string | null }> {
  await assertAdminAuthenticated();
  const result = await resetEditPinForCard(cardId);
  if (result.pin) {
    await clearEditPinSessionForCard(cardId);
    console.info('[edit-pin] admin reset', { cardId });
  }
  return result;
}

export async function adminEnsureEditPinAction(
  cardId: string
): Promise<{ error: string | null }> {
  await assertAdminAuthenticated();
  const result = await ensureEditPinForCard(cardId);
  return { error: result.error };
}
