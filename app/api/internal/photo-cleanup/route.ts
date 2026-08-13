import { NextResponse } from 'next/server';
import { logCronAuthDiagnostics, verifyCronRequest } from '@/lib/automation-auth';
import { cleanupExpiredCardPhotos } from '@/lib/card-photo-cleanup';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Daily photo cleanup endpoint.
 * Invoked by Vercel Cron (GET) with `Authorization: Bearer <CRON_SECRET>`.
 * Safe to call more than once (idempotent cleanup core).
 */
async function runCleanup(request: Request) {
  const auth = verifyCronRequest(request.headers.get('authorization'));

  if (!auth.ok) {
    logCronAuthDiagnostics('photo-cleanup', auth.diagnostics, auth.reason);

    if (auth.reason === 'cron_secret_not_configured') {
      // Server misconfiguration — not a client credential mistake.
      console.error('[photo-cleanup] CRON_SECRET is not configured');
      return NextResponse.json(
        { error: 'Server misconfigured', code: 'CRON_SECRET_NOT_CONFIGURED' },
        { status: 503 }
      );
    }

    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Temporary safe confirmation that Production loaded CRON_SECRET (length only).
  console.info('[photo-cleanup] CRON_SECRET configured', {
    cronSecretConfigured: true,
    cronSecretLength: auth.diagnostics.cronSecretLength,
  });

  try {
    const result = await cleanupExpiredCardPhotos();
    return NextResponse.json({
      ok: true,
      scanned: result.scanned,
      cleaned: result.cleaned,
      mediaRowsDeleted: result.mediaRowsDeleted,
      storageFilesDeleted: result.storageFilesDeleted,
      legacyPathsDeleted: result.legacyPathsDeleted,
      orphanMediaCleaned: result.orphanMediaCleaned,
      warnings: result.warnings.length,
      failures: result.errors.length,
      // Keep short error codes for ops logs; never include eCard content.
      errors: result.errors,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'cleanup failed';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

/** Vercel Cron invokes scheduled paths with GET. */
export async function GET(request: Request) {
  return runCleanup(request);
}

/** Manual / curl testing may use POST with the same Bearer auth. */
export async function POST(request: Request) {
  return runCleanup(request);
}
