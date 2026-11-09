import { NextResponse } from 'next/server';
import {
  handleExtendRecipients,
  parseExtendRecipientsRequest,
} from '@/lib/extend-recipients-api';
import {
  unauthorizedAutomationResponse,
  verifyInternalAutomationRequest,
} from '@/lib/internal-automation-route';
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

  const parsed = parseExtendRecipientsRequest(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const result = await handleExtendRecipients(getSupabaseAdmin(), parsed);
    return NextResponse.json(result.body, { status: result.httpStatus });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'internal error';
    if (message.includes('SUPABASE_SERVICE_ROLE_KEY')) {
      return NextResponse.json({ error: 'Server is not configured for automation' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Failed to extend recipients' }, { status: 500 });
  }
}
