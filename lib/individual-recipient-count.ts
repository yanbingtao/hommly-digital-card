/**
 * Technical upper bound for a single Individual Card insert batch.
 * Prevents accidental runaway inserts (typos, bad automation payloads) without
 * imposing a product-level business cap.
 */
export const MAX_INDIVIDUAL_RECIPIENT_COUNT = 10_000;

export function validateIndividualRecipientCount(
  value: unknown
): { ok: true; count: number } | { ok: false; error: string } {
  if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) {
    return { ok: false, error: 'recipient count must be a finite integer' };
  }

  if (!Number.isInteger(value)) {
    return { ok: false, error: 'recipient count must be a finite integer' };
  }

  if (value <= 0) {
    return { ok: false, error: 'recipient count must be greater than zero' };
  }

  if (value > MAX_INDIVIDUAL_RECIPIENT_COUNT) {
    return {
      ok: false,
      error: `recipient count must not exceed ${MAX_INDIVIDUAL_RECIPIENT_COUNT}`,
    };
  }

  return { ok: true, count: value };
}
