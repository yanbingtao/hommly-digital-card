'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  ADMIN_SESSION_COOKIE,
  assertAdminAuthenticated,
  getAdminCookieOptions,
  getAdminSessionToken,
} from '@/lib/admin-auth';

export async function loginAdmin(
  password: string,
  redirectTo = '/admin/cards'
): Promise<{ success: boolean; error?: string }> {
  const configuredPassword = process.env.ADMIN_PASSWORD?.trim();

  if (!configuredPassword) {
    return {
      success: false,
      error: 'Admin password is not configured. Set ADMIN_PASSWORD in .env.local.',
    };
  }

  if (password !== configuredPassword) {
    return { success: false, error: 'Incorrect password. Please try again.' };
  }

  cookies().set(ADMIN_SESSION_COOKIE, getAdminSessionToken(), getAdminCookieOptions());

  redirect(redirectTo.startsWith('/admin') ? redirectTo : '/admin/cards');
}

export async function logoutAdmin(): Promise<void> {
  cookies().delete(ADMIN_SESSION_COOKIE);
  redirect('/admin/login');
}

export async function requireAdminSession(): Promise<void> {
  await assertAdminAuthenticated();
}
