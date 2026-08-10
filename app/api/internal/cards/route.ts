import { NextResponse } from 'next/server';
import { verifyAutomationRequest } from '@/lib/automation-auth';
import { createCardCore } from '@/lib/create-card-core';
import { parseInternalCreateCardRequest } from '@/lib/internal-card-request';
import { buildInternalCardResponse } from '@/lib/internal-card-response';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const auth = verifyAutomationRequest(request.headers.get('authorization'));
  if (!auth.ok) {
    const status = auth.error === 'automation secret is not configured' ? 503 : 401;
    return NextResponse.json({ error: 'Unauthorized' }, { status });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = parseInternalCreateCardRequest(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const result = await createCardCore(supabase, {
      orderNumberInput: parsed.orderId,
      platform: parsed.platform,
      externalOrderId: parsed.orderId,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
    return NextResponse.json(
      buildInternalCardResponse({
        status: result.status,
        platform: parsed.platform,
        orderId: parsed.orderId,
        card: result.card,
      })
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'internal error';
    if (message.includes('SUPABASE_SERVICE_ROLE_KEY')) {
      return NextResponse.json({ error: 'Server is not configured for automation' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Failed to create card' }, { status: 500 });
  }
}
