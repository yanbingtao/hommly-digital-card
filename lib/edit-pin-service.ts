import type { SupabaseClient } from '@supabase/supabase-js';
import { generateEditPin } from './edit-pin';
import {
  decryptEditPin,
  encryptEditPin,
  hashEditPin,
  isEditPinEncryptionConfigured,
} from './edit-pin-crypto';
import { getSupabaseAdmin } from './supabase-admin';

export type EditPinCardRow = {
  id: string;
  edit_token: string;
  edit_pin_hash: string | null;
  edit_pin_encrypted: string | null;
  edit_pin_created_at: string | null;
  edit_session_version: number | null;
};

export function buildEditPinStorage(pin: string): {
  edit_pin_hash: string;
  edit_pin_encrypted: string;
  edit_pin_created_at: string;
} {
  return {
    edit_pin_hash: hashEditPin(pin),
    edit_pin_encrypted: encryptEditPin(pin),
    edit_pin_created_at: new Date().toISOString(),
  };
}

/**
 * Ensure the card has an Edit PIN. Generates once (idempotent).
 * Returns plaintext only when newly generated (not on subsequent calls).
 */
export async function ensureEditPinForCard(
  cardId: string,
  supabase: SupabaseClient = getSupabaseAdmin()
): Promise<{ created: boolean; pin: string | null; error: string | null }> {
  if (!isEditPinEncryptionConfigured()) {
    return { created: false, pin: null, error: 'EDIT_PIN_ENCRYPTION_KEY is not configured' };
  }

  const { data: existing, error: readError } = await supabase
    .from('digital_cards')
    .select('id, edit_pin_hash, edit_pin_encrypted, edit_session_version')
    .eq('id', cardId)
    .maybeSingle();

  if (readError || !existing) {
    return { created: false, pin: null, error: readError?.message || 'Card not found' };
  }

  if (existing.edit_pin_hash && existing.edit_pin_encrypted) {
    return { created: false, pin: null, error: null };
  }

  const pin = generateEditPin();
  const storage = buildEditPinStorage(pin);
  const { data: updated, error: updateError } = await supabase
    .from('digital_cards')
    .update({
      ...storage,
      edit_session_version: existing.edit_session_version ?? 0,
    })
    .eq('id', cardId)
    .is('edit_pin_hash', null)
    .select('id, edit_pin_hash')
    .maybeSingle();

  // Race: another request created the PIN first.
  if (!updated) {
    const { data: again } = await supabase
      .from('digital_cards')
      .select('edit_pin_hash')
      .eq('id', cardId)
      .maybeSingle();
    if (again?.edit_pin_hash) {
      return { created: false, pin: null, error: null };
    }
    return { created: false, pin: null, error: updateError?.message || 'Failed to create Edit PIN' };
  }

  return { created: true, pin, error: null };
}

export async function resetEditPinForCard(
  cardId: string,
  supabase: SupabaseClient = getSupabaseAdmin()
): Promise<{ pin: string | null; error: string | null }> {
  if (!isEditPinEncryptionConfigured()) {
    return { pin: null, error: 'EDIT_PIN_ENCRYPTION_KEY is not configured' };
  }

  const { data: existing, error: readError } = await supabase
    .from('digital_cards')
    .select('id, edit_session_version')
    .eq('id', cardId)
    .maybeSingle();

  if (readError || !existing) {
    return { pin: null, error: readError?.message || 'Card not found' };
  }

  const pin = generateEditPin();
  const storage = buildEditPinStorage(pin);
  const nextVersion = (existing.edit_session_version ?? 0) + 1;

  const { error: updateError } = await supabase
    .from('digital_cards')
    .update({
      ...storage,
      edit_session_version: nextVersion,
    })
    .eq('id', cardId);

  if (updateError) {
    return { pin: null, error: updateError.message };
  }

  return { pin, error: null };
}

export async function revealEditPinForCard(
  cardId: string,
  supabase: SupabaseClient = getSupabaseAdmin()
): Promise<{ pin: string | null; error: string | null }> {
  if (!isEditPinEncryptionConfigured()) {
    return { pin: null, error: 'EDIT_PIN_ENCRYPTION_KEY is not configured' };
  }

  const ensured = await ensureEditPinForCard(cardId, supabase);
  if (ensured.error) {
    return { pin: null, error: ensured.error };
  }
  if (ensured.created && ensured.pin) {
    return { pin: ensured.pin, error: null };
  }

  const { data, error } = await supabase
    .from('digital_cards')
    .select('edit_pin_encrypted')
    .eq('id', cardId)
    .maybeSingle();

  if (error || !data?.edit_pin_encrypted) {
    return { pin: null, error: error?.message || 'Edit PIN not available' };
  }

  try {
    return { pin: decryptEditPin(data.edit_pin_encrypted), error: null };
  } catch {
    return { pin: null, error: 'Failed to decrypt Edit PIN' };
  }
}

export async function getEditPinCardByEditToken(
  editToken: string,
  supabase: SupabaseClient = getSupabaseAdmin()
): Promise<{ card: EditPinCardRow | null; error: string | null }> {
  const { data, error } = await supabase
    .from('digital_cards')
    .select(
      'id, edit_token, edit_pin_hash, edit_pin_encrypted, edit_pin_created_at, edit_session_version'
    )
    .eq('edit_token', editToken)
    .maybeSingle();

  if (error) return { card: null, error: error.message };
  return { card: (data as EditPinCardRow | null) ?? null, error: null };
}
