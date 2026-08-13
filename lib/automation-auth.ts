import crypto from 'crypto';

export const AUTOMATION_SECRET_ENV = 'AUTOMATION_SECRET';
/** Vercel Cron Jobs send this as `Authorization: Bearer <CRON_SECRET>`. */
export const CRON_SECRET_ENV = 'CRON_SECRET';

export type CronAuthFailureReason =
  | 'cron_secret_not_configured'
  | 'missing_authorization'
  | 'invalid_authorization_scheme'
  | 'missing_bearer_token'
  | 'invalid_bearer_token';

export type CronAuthDiagnostics = {
  cronSecretConfigured: boolean;
  cronSecretLength: number;
  cronSecretHadSurroundingWhitespace: boolean;
  authorizationPresent: boolean;
  authorizationScheme: string | null;
  providedTokenLength: number;
  providedTokenHadSurroundingWhitespace: boolean;
};

export function getConfiguredAutomationSecret(): string {
  return process.env[AUTOMATION_SECRET_ENV]?.trim() || '';
}

/**
 * Reads CRON_SECRET via dynamic env access (avoids Next.js static inlining of
 * `process.env.CRON_SECRET` at build time when the var was absent during build).
 */
export function getConfiguredCronSecret(): string {
  const raw = process.env[CRON_SECRET_ENV];
  if (raw == null) return '';
  return String(raw).trim();
}

export function getRawCronSecretEnv(): string | undefined {
  const raw = process.env[CRON_SECRET_ENV];
  return raw == null ? undefined : String(raw);
}

export function parseBearerToken(authorizationHeader: string | null | undefined): string | null {
  const parsed = parseAuthorizationHeader(authorizationHeader);
  if (parsed.scheme?.toLowerCase() !== 'bearer') return null;
  return parsed.token;
}

/**
 * Parses Authorization into scheme + token.
 * Accepts extra spaces after Bearer and trims the token (e.g. `Bearer   abc123  ` → `abc123`).
 */
export function parseAuthorizationHeader(authorizationHeader: string | null | undefined): {
  scheme: string | null;
  token: string | null;
  headerPresent: boolean;
  tokenHadSurroundingWhitespace: boolean;
} {
  if (authorizationHeader == null) {
    return {
      scheme: null,
      token: null,
      headerPresent: false,
      tokenHadSurroundingWhitespace: false,
    };
  }

  const raw = String(authorizationHeader);
  const trimmedHeader = raw.trim();
  if (!trimmedHeader) {
    return {
      scheme: null,
      token: null,
      headerPresent: false,
      tokenHadSurroundingWhitespace: false,
    };
  }

  // After scheme, require at least one whitespace; keep remaining so we can trim the token.
  const match = /^([A-Za-z]+)\s(.*)$/.exec(trimmedHeader);
  if (!match) {
    const schemeOnly = /^([A-Za-z]+)$/.exec(trimmedHeader);
    return {
      scheme: schemeOnly?.[1] ?? null,
      token: null,
      headerPresent: true,
      tokenHadSurroundingWhitespace: false,
    };
  }

  const scheme = match[1]!;
  const tokenRaw = match[2]!;
  const token = tokenRaw.trim();
  const tokenHadSurroundingWhitespace = token.length > 0 && token !== tokenRaw;

  if (scheme.toLowerCase() !== 'bearer' || !token || /\s/.test(token)) {
    return {
      scheme,
      token: null,
      headerPresent: true,
      tokenHadSurroundingWhitespace,
    };
  }

  return {
    scheme: 'Bearer',
    token,
    headerPresent: true,
    tokenHadSurroundingWhitespace,
  };
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

export function buildCronAuthDiagnostics(
  authorizationHeader: string | null | undefined
): CronAuthDiagnostics {
  const rawSecret = getRawCronSecretEnv();
  const configuredSecret = getConfiguredCronSecret();
  const parsed = parseAuthorizationHeader(authorizationHeader);

  return {
    cronSecretConfigured: configuredSecret.length > 0,
    cronSecretLength: configuredSecret.length,
    cronSecretHadSurroundingWhitespace:
      rawSecret != null && rawSecret.length > 0 && rawSecret !== rawSecret.trim(),
    authorizationPresent: parsed.headerPresent,
    authorizationScheme: parsed.scheme,
    providedTokenLength: parsed.token?.length ?? 0,
    providedTokenHadSurroundingWhitespace: parsed.tokenHadSurroundingWhitespace,
  };
}

/**
 * Authenticates Vercel Cron (and manual) invocations of scheduled internal routes.
 * Expects `Authorization: Bearer <CRON_SECRET>`.
 */
export function verifyCronRequest(authorizationHeader: string | null | undefined): {
  ok: boolean;
  error?: string;
  reason?: CronAuthFailureReason;
  diagnostics: CronAuthDiagnostics;
} {
  const diagnostics = buildCronAuthDiagnostics(authorizationHeader);
  const expected = getConfiguredCronSecret();

  if (!expected) {
    return {
      ok: false,
      error: 'cron secret is not configured',
      reason: 'cron_secret_not_configured',
      diagnostics,
    };
  }

  const parsed = parseAuthorizationHeader(authorizationHeader);
  if (!parsed.headerPresent) {
    return {
      ok: false,
      error: 'missing authorization',
      reason: 'missing_authorization',
      diagnostics,
    };
  }

  if (!parsed.scheme || parsed.scheme.toLowerCase() !== 'bearer') {
    return {
      ok: false,
      error: 'invalid authorization scheme',
      reason: 'invalid_authorization_scheme',
      diagnostics,
    };
  }

  if (!parsed.token) {
    return {
      ok: false,
      error: 'missing bearer token',
      reason: 'missing_bearer_token',
      diagnostics,
    };
  }

  if (!secretsMatch(parsed.token, expected)) {
    return {
      ok: false,
      error: 'invalid bearer token',
      reason: 'invalid_bearer_token',
      diagnostics,
    };
  }

  return { ok: true, diagnostics };
}

/** Safe server log helper — never includes secret values. */
export function logCronAuthDiagnostics(
  context: string,
  diagnostics: CronAuthDiagnostics,
  reason?: CronAuthFailureReason
): void {
  console.info(`[${context}] cron auth`, {
    reason: reason ?? 'ok',
    cronSecretConfigured: diagnostics.cronSecretConfigured,
    cronSecretLength: diagnostics.cronSecretLength,
    cronSecretHadSurroundingWhitespace: diagnostics.cronSecretHadSurroundingWhitespace,
    authorizationPresent: diagnostics.authorizationPresent,
    authorizationScheme: diagnostics.authorizationScheme,
    providedTokenLength: diagnostics.providedTokenLength,
    providedTokenHadSurroundingWhitespace: diagnostics.providedTokenHadSurroundingWhitespace,
  });
}
