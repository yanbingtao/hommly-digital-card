import { NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/admin-auth';

export async function skuAccess(request?: Request): Promise<NextResponse | null> {
  if (process.env.SKU_IMAGES_ENABLED !== 'true') return NextResponse.json({ error: 'SKU image tools are not enabled.' }, { status: 503 });
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: 'Admin sign-in required.' }, { status: 401 });
  if (request && request.method !== 'GET') {
    const origin = request.headers.get('origin');
    if (!origin || origin !== new URL(request.url).origin) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  }
  return null;
}
