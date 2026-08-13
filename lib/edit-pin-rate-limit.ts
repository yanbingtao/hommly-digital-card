import crypto from 'crypto';
import { getSupabaseAdmin } from './supabase-admin';

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;

export type EditPinRateLimitResult =
  | { ok: true; remaining: number }
  | { ok: false; retryAfterSec: number };

function scopeKey(cardId: string, ip: string): string {
  return crypto.createHash('sha256').update(`${cardId}|${ip}`).digest('hex');
}

export async function checkEditPinRateLimit(
  cardId: string,
  ip: string
): Promise<EditPinRateLimitResult> {
  const supabase = getSupabaseAdmin();
  const key = scopeKey(cardId, ip);
  const now = Date.now();

  const { data } = await supabase
    .from('edit_pin_rate_limits')
    .select('fail_count, window_started_at, locked_until')
    .eq('scope_key', key)
    .maybeSingle();

  if (data?.locked_until) {
    const lockedUntil = new Date(data.locked_until).getTime();
    if (lockedUntil > now) {
      return { ok: false, retryAfterSec: Math.ceil((lockedUntil - now) / 1000) };
    }
  }

  if (data?.window_started_at) {
    const windowStart = new Date(data.window_started_at).getTime();
    if (now - windowStart > WINDOW_MS) {
      return { ok: true, remaining: MAX_FAILURES };
    }
    const fails = data.fail_count ?? 0;
    if (fails >= MAX_FAILURES) {
      const lockedUntil = new Date(windowStart + WINDOW_MS).toISOString();
      await supabase
        .from('edit_pin_rate_limits')
        .upsert({
          scope_key: key,
          fail_count: fails,
          window_started_at: data.window_started_at,
          locked_until: lockedUntil,
          updated_at: new Date().toISOString(),
        });
      return {
        ok: false,
        retryAfterSec: Math.ceil((windowStart + WINDOW_MS - now) / 1000),
      };
    }
    return { ok: true, remaining: MAX_FAILURES - fails };
  }

  return { ok: true, remaining: MAX_FAILURES };
}

export async function recordEditPinFailure(cardId: string, ip: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const key = scopeKey(cardId, ip);
  const now = new Date();
  const { data } = await supabase
    .from('edit_pin_rate_limits')
    .select('fail_count, window_started_at, locked_until')
    .eq('scope_key', key)
    .maybeSingle();

  const windowStart = data?.window_started_at ? new Date(data.window_started_at) : now;
  const inWindow = now.getTime() - windowStart.getTime() <= WINDOW_MS;
  const failCount = inWindow ? (data?.fail_count ?? 0) + 1 : 1;
  const nextWindowStart = inWindow ? windowStart : now;
  const lockedUntil =
    failCount >= MAX_FAILURES
      ? new Date(nextWindowStart.getTime() + WINDOW_MS).toISOString()
      : null;

  await supabase.from('edit_pin_rate_limits').upsert({
    scope_key: key,
    fail_count: failCount,
    window_started_at: nextWindowStart.toISOString(),
    locked_until: lockedUntil,
    updated_at: now.toISOString(),
  });
}

export async function clearEditPinFailures(cardId: string, ip: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const key = scopeKey(cardId, ip);
  await supabase.from('edit_pin_rate_limits').delete().eq('scope_key', key);
}

export const EDIT_PIN_RATE_LIMIT = {
  maxFailures: MAX_FAILURES,
  windowMs: WINDOW_MS,
} as const;
