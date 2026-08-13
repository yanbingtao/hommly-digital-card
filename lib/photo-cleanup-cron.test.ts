import fs from 'fs';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { verifyCronRequest } from './automation-auth';

const ROOT = path.join(__dirname, '..');

const mocks = vi.hoisted(() => ({
  cleanupExpiredCardPhotos: vi.fn(),
}));

vi.mock('@/lib/card-photo-cleanup', () => ({
  cleanupExpiredCardPhotos: mocks.cleanupExpiredCardPhotos,
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
    process.env.CRON_SECRET = 'cron-secret-value-16chars';
    expect(verifyCronRequest('Bearer cron-secret-value-16chars').ok).toBe(true);
  });

  it('rejects missing or invalid authorization', () => {
    process.env.CRON_SECRET = 'cron-secret-value-16chars';
    expect(verifyCronRequest(null).ok).toBe(false);
    expect(verifyCronRequest('Bearer wrong').ok).toBe(false);
    expect(verifyCronRequest('cron-secret-value-16chars').ok).toBe(false);
  });

  it('rejects when CRON_SECRET is not configured', () => {
    delete process.env.CRON_SECRET;
    expect(verifyCronRequest('Bearer anything').ok).toBe(false);
    expect(verifyCronRequest('Bearer anything').error).toMatch(/not configured/i);
  });

  it('does not accept AUTOMATION_SECRET in place of CRON_SECRET', () => {
    process.env.CRON_SECRET = 'cron-secret-value-16chars';
    process.env.AUTOMATION_SECRET = 'automation-secret-value';
    expect(verifyCronRequest('Bearer automation-secret-value').ok).toBe(false);
  });
});

describe('/api/internal/photo-cleanup cron route', () => {
  const original = process.env.CRON_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = 'cron-secret-value-16chars';
    mocks.cleanupExpiredCardPhotos.mockResolvedValue({
      scanned: 2,
      cleaned: 1,
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

  it('runs cleanup when CRON_SECRET auth is valid (GET)', async () => {
    const { GET } = await import('../app/api/internal/photo-cleanup/route');
    const response = await GET(
      new Request('https://hommly.online/api/internal/photo-cleanup', {
        headers: { Authorization: 'Bearer cron-secret-value-16chars' },
      })
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.scanned).toBe(2);
    expect(body.cleaned).toBe(1);
    expect(body.failures).toBe(0);
    expect(mocks.cleanupExpiredCardPhotos).toHaveBeenCalledTimes(1);
  });

  it('rejects unauthorized requests without calling cleanup', async () => {
    const { GET } = await import('../app/api/internal/photo-cleanup/route');
    const response = await GET(new Request('https://hommly.online/api/internal/photo-cleanup'));
    expect(response.status).toBe(401);
    expect(mocks.cleanupExpiredCardPhotos).not.toHaveBeenCalled();
  });

  it('is idempotent across repeated valid invocations', async () => {
    const { GET } = await import('../app/api/internal/photo-cleanup/route');
    const request = () =>
      GET(
        new Request('https://hommly.online/api/internal/photo-cleanup', {
          headers: { Authorization: 'Bearer cron-secret-value-16chars' },
        })
      );

    const first = await request();
    const second = await request();
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(mocks.cleanupExpiredCardPhotos).toHaveBeenCalledTimes(2);
  });

  it('returns 500 when cleanup core throws', async () => {
    mocks.cleanupExpiredCardPhotos.mockRejectedValueOnce(new Error('db unavailable'));
    const { POST } = await import('../app/api/internal/photo-cleanup/route');
    const response = await POST(
      new Request('https://hommly.online/api/internal/photo-cleanup', {
        method: 'POST',
        headers: { Authorization: 'Bearer cron-secret-value-16chars' },
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

  it('removes Netlify scheduled photo cleanup function', () => {
    expect(
      fs.existsSync(path.join(ROOT, 'netlify/functions/scheduled-photo-cleanup.ts'))
    ).toBe(false);
    const netlifyToml = fs.readFileSync(path.join(ROOT, 'netlify.toml'), 'utf8');
    expect(netlifyToml).not.toMatch(/scheduled-photo-cleanup/);
    expect(netlifyToml).not.toMatch(/\[functions\]/);
  });

  it('photo-cleanup route authenticates with CRON_SECRET only', () => {
    const source = fs.readFileSync(
      path.join(ROOT, 'app/api/internal/photo-cleanup/route.ts'),
      'utf8'
    );
    expect(source).toMatch(/verifyCronRequest/);
    expect(source).toMatch(/cleanupExpiredCardPhotos/);
    expect(source).not.toMatch(/verifyAutomationRequest/);
  });

  it('admin manual cleanup still calls the shared cleanup core', () => {
    const source = fs.readFileSync(path.join(ROOT, 'lib/actions.ts'), 'utf8');
    expect(source).toMatch(/export async function runExpiredPhotoCleanup/);
    expect(source).toMatch(/cleanupExpiredCardPhotos/);
  });
});
