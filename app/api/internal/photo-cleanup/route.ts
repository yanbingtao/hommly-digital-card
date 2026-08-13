import { NextResponse } from 'next/server';
import { verifyAutomationRequest } from '@/lib/automation-auth';
import { cleanupExpiredCardPhotos } from '@/lib/card-photo-cleanup';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function runCleanup(request: Request) {
  const auth = verifyAutomationRequest(request.headers.get('authorization'));
  if (!auth.ok) {
    const status = auth.error === 'automation secret is not configured' ? 503 : 401;
    return NextResponse.json({ error: 'Unauthorized' }, { status });
  }

  try {
    const result = await cleanupExpiredCardPhotos();
    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'cleanup failed';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

/** Netlify / external schedulers may use GET or POST. */
export async function GET(request: Request) {
  return runCleanup(request);
}

export async function POST(request: Request) {
  return runCleanup(request);
}
