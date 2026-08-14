import { NextResponse } from 'next/server';
import {
  internalAutomationErrorResponse,
  unauthorizedAutomationResponse,
  verifyInternalAutomationRequest,
} from '@/lib/internal-automation-route';
import {
  claimAdminAutomationCard,
  parseAutomationCardIdBody,
} from '@/lib/internal-pending-automation-api';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const auth = verifyInternalAutomationRequest(request);
  if (!auth.ok) {
    return unauthorizedAutomationResponse(auth);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = parseAutomationCardIdBody(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const result = await claimAdminAutomationCard(supabase, parsed.cardId);
    if (!result.ok) {
      return internalAutomationErrorResponse(result.body, result.httpStatus);
    }
    return NextResponse.json(result.body, { status: result.httpStatus });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'internal error';
    if (message.includes('SUPABASE_SERVICE_ROLE_KEY')) {
      return NextResponse.json({ error: 'Server is not configured for automation' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Failed to claim card' }, { status: 500 });
  }
}
