import { NextResponse } from 'next/server';
import { verifyAutomationRequest } from '@/lib/automation-auth';

export type InternalAutomationAuthResult =
  | { ok: true }
  | { ok: false; error?: string };

export function unauthorizedAutomationResponse(auth: Extract<InternalAutomationAuthResult, { ok: false }>) {
  const status = auth.error === 'automation secret is not configured' ? 503 : 401;
  return NextResponse.json({ error: 'Unauthorized' }, { status });
}

export function verifyInternalAutomationRequest(request: Request): InternalAutomationAuthResult {
  const auth = verifyAutomationRequest(request.headers.get('authorization'));
  if (auth.ok) {
    return { ok: true };
  }
  return { ok: false, error: auth.error };
}

export function internalAutomationErrorResponse(
  body: Record<string, unknown>,
  status: number
) {
  return NextResponse.json(body, { status });
}
