import { NextResponse } from 'next/server';
import {
  internalAutomationErrorResponse,
  unauthorizedAutomationResponse,
  verifyInternalAutomationRequest,
} from '@/lib/internal-automation-route';
import { listPendingAdminAutomationCards } from '@/lib/internal-pending-automation-api';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = verifyInternalAutomationRequest(request);
  if (!auth.ok) {
    return unauthorizedAutomationResponse(auth);
  }

  try {
    const supabase = getSupabaseAdmin();
    const result = await listPendingAdminAutomationCards(supabase);
    if (!result.ok) {
      return internalAutomationErrorResponse(result.body, result.httpStatus);
    }
    return NextResponse.json(result.body, { status: result.httpStatus });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'internal error';
    if (message.includes('SUPABASE_SERVICE_ROLE_KEY')) {
      return NextResponse.json({ error: 'Server is not configured for automation' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Failed to list pending automation cards' }, { status: 500 });
  }
}
