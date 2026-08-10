import crypto from 'crypto';
import { cookies } from 'next/headers';

export const ADMIN_SESSION_COOKIE = 'hommly_admin_session';
const SESSION_SALT = 'hommly-admin-v2';

function getConfiguredAdminCredentials(): { username: string; password: string } {
  const username = process.env.ADMIN_USERNAME?.trim();
  const password = process.env.ADMIN_PASSWORD?.trim();

  if (!username || !password) {
    throw new Error('ADMIN_USERNAME and ADMIN_PASSWORD must both be configured');
  }

  return { username, password };
}

function safeEqual(expected: string, actual: string): boolean {
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);

  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}

export function verifyAdminCredentials(username: string, password: string): boolean {
  try {
    const configured = getConfiguredAdminCredentials();
    return safeEqual(configured.username, username) && safeEqual(configured.password, password);
  } catch {
    return false;
  }
}

export function getAdminSessionToken(): string {
  const { username, password } = getConfiguredAdminCredentials();
  return crypto.createHmac('sha256', password).update(`${SESSION_SALT}:${username}`).digest('hex');
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
