import { NextResponse } from 'next/server';
import {
  internalAutomationErrorResponse,
  unauthorizedAutomationResponse,
  verifyInternalAutomationRequest,
} from '@/lib/internal-automation-route';
import {
  buildEditPinLookupLogFields,
  buildEditPinLookupResponseBody,
  lookupEditPinByPlatformOrder,
  parseEditPinLookupQuery,
} from '@/lib/internal-edit-pin-lookup';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = verifyInternalAutomationRequest(request);
  if (!auth.ok) {
    return unauthorizedAutomationResponse(auth);
  }

  const url = new URL(request.url);
  const parsed = parseEditPinLookupQuery(url.searchParams);
  if (!parsed.ok) {
    return internalAutomationErrorResponse(
      { error: parsed.code, message: parsed.message },
      parsed.httpStatus
    );
  }

  try {
    const supabase = getSupabaseAdmin();
    const result = await lookupEditPinByPlatformOrder(
      supabase,
      parsed.platform,
      parsed.orderId
    );

    console.info(
      '[edit-pin-lookup]',
      buildEditPinLookupLogFields(result, parsed.platform, parsed.orderId)
    );

    if (!result.ok) {
      return internalAutomationErrorResponse(
        { error: result.code, message: result.message },
        result.httpStatus
      );
    }

    return NextResponse.json(buildEditPinLookupResponseBody(result), { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'internal error';
    if (message.includes('SUPABASE_SERVICE_ROLE_KEY')) {
      return NextResponse.json(
        { error: 'Server is not configured for automation' },
        { status: 503 }
      );
    }
    console.info('[edit-pin-lookup]', {
      platform: parsed.platform,
      order_id: parsed.orderId,
      ok: false,
      code: 'INTERNAL_ERROR',
    });
    return NextResponse.json({ error: 'Failed to look up Edit PIN' }, { status: 500 });
  }
}
