'use server';

import { cookies } from 'next/headers';
import {
  ADMIN_SESSION_COOKIE,
  getAdminCookieOptions,
  getAdminSessionToken,
} from '@/lib/admin-auth';

export async function loginAdmin(
  password: string,
  redirectTo = '/admin/cards'
): Promise<{ success: boolean; redirectTo?: string; error?: string }> {
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

  const safeRedirect = redirectTo.startsWith('/admin') ? redirectTo : '/admin/cards';

  return { success: true, redirectTo: safeRedirect };
}

export async function logoutAdmin(): Promise<{ success: boolean }> {
  cookies().delete(ADMIN_SESSION_COOKIE);
  return { success: true };
}
