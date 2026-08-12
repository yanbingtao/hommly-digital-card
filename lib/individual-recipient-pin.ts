import { resolveViewPinFields } from './view-pin-crypto';

type PinRecipientState = {
  view_pin_enabled: boolean;
  view_pin_hash: string | null;
};

export function resolveBulkViewPinFields(
  enabled: boolean,
  pin: string,
  recipients: PinRecipientState[]
): {
  view_pin_enabled: boolean;
  view_pin_hash: string | null;
  error: string | null;
} {
  if (!enabled) {
    return { view_pin_enabled: false, view_pin_hash: null, error: null };
  }

  const trimmed = pin.trim();
  if (trimmed) {
    return resolveViewPinFields(true, trimmed, null);
  }

  const enabledFlags = Array.from(new Set(recipients.map((row) => row.view_pin_enabled)));
  if (enabledFlags.length > 1) {
    return {
      view_pin_enabled: true,
      view_pin_hash: null,
      error: 'Enter a new PIN to apply to all selected gifts, or turn off PIN protection.',
    };
  }

  if (recipients.length === 1) {
    return resolveViewPinFields(true, '', recipients[0]?.view_pin_hash ?? null);
  }

  const enabledRecipients = recipients.filter((row) => row.view_pin_enabled);
  const hashes = Array.from(new Set(enabledRecipients.map((row) => row.view_pin_hash).filter(Boolean)));
  if (hashes.length === 1 && hashes[0]) {
    return { view_pin_enabled: true, view_pin_hash: hashes[0], error: null };
  }

  return {
    view_pin_enabled: true,
    view_pin_hash: null,
    error: 'Enter a new PIN to apply to all selected gifts, or turn off PIN protection.',
  };
}
