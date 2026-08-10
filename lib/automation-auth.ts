import crypto from 'crypto';

export const AUTOMATION_SECRET_ENV = 'AUTOMATION_SECRET';

export function getConfiguredAutomationSecret(): string {
  return process.env[AUTOMATION_SECRET_ENV]?.trim() || '';
}

export function parseBearerToken(authorizationHeader: string | null | undefined): string | null {
  const header = String(authorizationHeader || '').trim();
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  return match?.[1] ?? null;
}

function dummyCompare(expected: string): void {
  const buffer = Buffer.from(expected);
  crypto.timingSafeEqual(buffer, buffer);
}

export function secretsMatch(provided: string, expected: string): boolean {
  if (!provided || !expected) {
    if (expected) dummyCompare(expected);
    return false;
  }
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  if (providedBuffer.length !== expectedBuffer.length) {
    dummyCompare(expected);
    return false;
  }
  return crypto.timingSafeEqual(providedBuffer, expectedBuffer);
}

export function verifyAutomationRequest(authorizationHeader: string | null | undefined): {
  ok: boolean;
  error?: string;
} {
  const expected = getConfiguredAutomationSecret();
  if (!expected) {
    return { ok: false, error: 'automation secret is not configured' };
  }
  const provided = parseBearerToken(authorizationHeader);
  if (!provided) {
    return { ok: false, error: 'missing bearer token' };
  }
  if (!secretsMatch(provided, expected)) {
    return { ok: false, error: 'invalid bearer token' };
  }
  return { ok: true };
}
