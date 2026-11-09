import { NextResponse } from 'next/server';
import {
  internalAutomationErrorResponse,
  unauthorizedAutomationResponse,
  verifyInternalAutomationRequest,
} from '@/lib/internal-automation-route';
import { lookupExistingCard, parseManualLookupQuery } from '@/lib/manual-card-lookup';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = verifyInternalAutomationRequest(request);
  if (!auth.ok) {
    return unauthorizedAutomationResponse(auth);
  }

  const parsed = parseManualLookupQuery(new URL(request.url).searchParams);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.httpStatus });
  }

  try {
    const result = await lookupExistingCard(getSupabaseAdmin(), parsed.platform, parsed.orderId);
    if (!result.ok) {
      return internalAutomationErrorResponse({ error: result.error }, result.httpStatus);
    }
    return NextResponse.json(result.body, { status: result.httpStatus });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'internal error';
    if (message.includes('SUPABASE_SERVICE_ROLE_KEY')) {
      return NextResponse.json({ error: 'Server is not configured for automation' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Failed to look up card' }, { status: 500 });
  }
}
