import fs from 'fs';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  parseAuthorizationHeader,
  parseBearerToken,
  verifyCronRequest,
} from './automation-auth';

const ROOT = path.join(__dirname, '..');

const mocks = vi.hoisted(() => ({
  cleanupExpiredCardsAndPhotos: vi.fn(),
}));

vi.mock('@/lib/card-photo-cleanup', () => ({
  cleanupExpiredCardsAndPhotos: mocks.cleanupExpiredCardsAndPhotos,
  cleanupExpiredCardPhotos: mocks.cleanupExpiredCardsAndPhotos,
}));

describe('verifyCronRequest', () => {
  const original = process.env.CRON_SECRET;
  const originalAutomation = process.env.AUTOMATION_SECRET;

  afterEach(() => {
    if (original === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = original;
    if (originalAutomation === undefined) delete process.env.AUTOMATION_SECRET;
    else process.env.AUTOMATION_SECRET = originalAutomation;
  });

  it('accepts a valid CRON_SECRET bearer token', () => {
    process.env.CRON_SECRET = 'abc123';
    const result = verifyCronRequest('Bearer abc123');
    expect(result.ok).toBe(true);
    expect(result.diagnostics.cronSecretConfigured).toBe(true);
    expect(result.diagnostics.cronSecretLength).toBe(6);
    expect(result.diagnostics.providedTokenLength).toBe(6);
  });

  it('rejects wrong secret with invalid_bearer_token', () => {
    process.env.CRON_SECRET = 'abc123';
    const result = verifyCronRequest('Bearer wrong');
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('invalid_bearer_token');
  });

  it('rejects missing Authorization', () => {
    process.env.CRON_SECRET = 'abc123';
    const result = verifyCronRequest(null);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('missing_authorization');
  });

  it('rejects when CRON_SECRET is not configured', () => {
    delete process.env.CRON_SECRET;
    const result = verifyCronRequest('Bearer anything');
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('cron_secret_not_configured');
    expect(result.diagnostics.cronSecretConfigured).toBe(false);
    expect(result.diagnostics.cronSecretLength).toBe(0);
  });

  it('does not accept AUTOMATION_SECRET in place of CRON_SECRET', () => {
    process.env.CRON_SECRET = 'cron-secret-value-16chars';
    process.env.AUTOMATION_SECRET = 'automation-secret-value';
    expect(verifyCronRequest('Bearer automation-secret-value').ok).toBe(false);
  });

  it('trims surrounding whitespace on Bearer tokens', () => {
    process.env.CRON_SECRET = 'abc123';
    // Chosen behaviour: trim and accept.
    expect(verifyCronRequest('Bearer   abc123   ').ok).toBe(true);
    expect(parseBearerToken('Bearer   abc123   ')).toBe('abc123');
    expect(parseAuthorizationHeader('Bearer   abc123   ').tokenHadSurroundingWhitespace).toBe(true);
  });

  it('rejects non-Bearer schemes', () => {
    process.env.CRON_SECRET = 'abc123';
    const result = verifyCronRequest('Basic abc123');
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('invalid_authorization_scheme');
    expect(result.diagnostics.authorizationScheme).toBe('Basic');
  });

  it('trims CRON_SECRET env whitespace before compare', () => {
    process.env.CRON_SECRET = '  abc123  ';
    expect(verifyCronRequest('Bearer abc123').ok).toBe(true);
    expect(verifyCronRequest('Bearer abc123').diagnostics.cronSecretHadSurroundingWhitespace).toBe(
      true
    );
  });
});

describe('/api/internal/photo-cleanup cron route', () => {
  const original = process.env.CRON_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = 'abc123';
    mocks.cleanupExpiredCardsAndPhotos.mockResolvedValue({
      scanned: 2,
      cleaned: 1,
      expiredCardsDeleted: 1,
      recipientsDeleted: 3,
      mediaRowsDeleted: 1,
      storageFilesDeleted: 1,
      legacyPathsDeleted: 0,
      orphanMediaCleaned: 0,
      warnings: [],
      errors: [],
    });
  });

  afterEach(() => {
    if (original === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = original;
  });

  it('returns 200 when CRON_SECRET auth is valid (GET)', async () => {
    const { GET } = await import('../app/api/internal/photo-cleanup/route');
    const response = await GET(
      new Request('https://hommly.online/api/internal/photo-cleanup', {
        headers: { Authorization: 'Bearer abc123' },
      })
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.expiredCardsDeleted).toBe(1);
    expect(body.recipientsDeleted).toBe(3);
    expect(mocks.cleanupExpiredCardsAndPhotos).toHaveBeenCalledTimes(1);
  });

  it('returns 401 for wrong secret', async () => {
    const { GET } = await import('../app/api/internal/photo-cleanup/route');
    const response = await GET(
      new Request('https://hommly.online/api/internal/photo-cleanup', {
        headers: { Authorization: 'Bearer wrong' },
      })
    );
    expect(response.status).toBe(401);
    expect(mocks.cleanupExpiredCardsAndPhotos).not.toHaveBeenCalled();
  });

  it('returns 401 when Authorization is missing', async () => {
    const { GET } = await import('../app/api/internal/photo-cleanup/route');
    const response = await GET(new Request('https://hommly.online/api/internal/photo-cleanup'));
    expect(response.status).toBe(401);
    expect(mocks.cleanupExpiredCardsAndPhotos).not.toHaveBeenCalled();
  });

  it('returns 503 when CRON_SECRET is missing from server config', async () => {
    delete process.env.CRON_SECRET;
    vi.resetModules();
    const { GET } = await import('../app/api/internal/photo-cleanup/route');
    const response = await GET(
      new Request('https://hommly.online/api/internal/photo-cleanup', {
        headers: { Authorization: 'Bearer abc123' },
      })
    );
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.code).toBe('CRON_SECRET_NOT_CONFIGURED');
    expect(mocks.cleanupExpiredCardsAndPhotos).not.toHaveBeenCalled();
  });

  it('returns 401 for Basic scheme', async () => {
    const { GET } = await import('../app/api/internal/photo-cleanup/route');
    const response = await GET(
      new Request('https://hommly.online/api/internal/photo-cleanup', {
        headers: { Authorization: 'Basic abc123' },
      })
    );
    expect(response.status).toBe(401);
  });

  it('is idempotent across repeated valid invocations', async () => {
    const { GET } = await import('../app/api/internal/photo-cleanup/route');
    const request = () =>
      GET(
        new Request('https://hommly.online/api/internal/photo-cleanup', {
          headers: { Authorization: 'Bearer abc123' },
        })
      );

    expect((await request()).status).toBe(200);
    expect((await request()).status).toBe(200);
    expect(mocks.cleanupExpiredCardsAndPhotos).toHaveBeenCalledTimes(2);
  });

  it('returns 500 when cleanup core throws', async () => {
    mocks.cleanupExpiredCardsAndPhotos.mockRejectedValueOnce(new Error('db unavailable'));
    const { POST } = await import('../app/api/internal/photo-cleanup/route');
    const response = await POST(
      new Request('https://hommly.online/api/internal/photo-cleanup', {
        method: 'POST',
        headers: { Authorization: 'Bearer abc123' },
      })
    );
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.ok).toBe(false);
  });
});

describe('Vercel cron configuration guards', () => {
  it('registers daily photo cleanup cron at 03:00 UTC', () => {
    const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8')) as {
      crons: Array<{ path: string; schedule: string }>;
    };
    expect(config.crons).toEqual([
      { path: '/api/internal/photo-cleanup', schedule: '0 3 * * *' },
    ]);
  });

  it('photo-cleanup route uses nodejs runtime and CRON_SECRET auth', () => {
    const source = fs.readFileSync(
      path.join(ROOT, 'app/api/internal/photo-cleanup/route.ts'),
      'utf8'
    );
    expect(source).toMatch(/runtime = 'nodejs'/);
    expect(source).toMatch(/verifyCronRequest/);
    expect(source).toMatch(/logCronAuthDiagnostics/);
    expect(source).toMatch(/CRON_SECRET_NOT_CONFIGURED/);
    expect(source).not.toMatch(/verifyAutomationRequest/);
  });
});
