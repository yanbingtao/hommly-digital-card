import crypto from 'crypto';
import { cookies } from 'next/headers';

export const ADMIN_SESSION_COOKIE = 'hommly_admin_session';
const SESSION_SALT = 'hommly-admin-v1';

export function getAdminSessionToken(): string {
  const password = process.env.ADMIN_PASSWORD?.trim();

  if (!password) {
    throw new Error('ADMIN_PASSWORD is not configured');
  }

  return crypto.createHmac('sha256', password).update(SESSION_SALT).digest('hex');
}

export async function isAdminAuthenticated(): Promise<boolean> {
  try {
    const cookieStore = cookies();
    const session = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
    return session === getAdminSessionToken();
  } catch {
    return false;
  }
}

export async function assertAdminAuthenticated(): Promise<void> {
  if (!(await isAdminAuthenticated())) {
    throw new Error('Unauthorized');
  }
}

export function getAdminCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  };
}
