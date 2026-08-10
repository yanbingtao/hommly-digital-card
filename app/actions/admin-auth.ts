'use server';

import { cookies } from 'next/headers';
import {
  ADMIN_SESSION_COOKIE,
  getAdminCookieOptions,
  getAdminSessionToken,
  verifyAdminCredentials,
} from '@/lib/admin-auth';

export async function loginAdmin(
  username: string,
  password: string,
  redirectTo = '/admin/cards'
): Promise<{ success: boolean; redirectTo?: string; error?: string }> {
  const trimmedUsername = username.trim();
  const trimmedPassword = password;

  if (!process.env.ADMIN_USERNAME?.trim() || !process.env.ADMIN_PASSWORD?.trim()) {
    return {
      success: false,
      error: 'Admin credentials are not configured. Set ADMIN_USERNAME and ADMIN_PASSWORD in .env.local.',
    };
  }

  if (!trimmedUsername || !trimmedPassword) {
    return { success: false, error: 'Please enter both username and password.' };
  }

  if (!verifyAdminCredentials(trimmedUsername, trimmedPassword)) {
    return { success: false, error: 'Incorrect username or password. Please try again.' };
  }

  cookies().set(ADMIN_SESSION_COOKIE, getAdminSessionToken(), getAdminCookieOptions());

  const safeRedirect = redirectTo.startsWith('/admin') ? redirectTo : '/admin/cards';

  return { success: true, redirectTo: safeRedirect };
}

export async function logoutAdmin(): Promise<{ success: boolean }> {
  cookies().delete(ADMIN_SESSION_COOKIE);
  return { success: true };
}
