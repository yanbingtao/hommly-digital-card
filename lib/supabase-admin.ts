import { createClient, SupabaseClient } from '@supabase/supabase-js';

let adminClient: SupabaseClient | null = null;

/** Prevents Next.js App Router from caching Supabase REST reads (stale recipient state). */
export const supabaseAdminFetch: typeof fetch = (input, init) =>
  fetch(input, { ...init, cache: 'no-store' });

export function getSupabaseAdmin(): SupabaseClient {
  if (adminClient) return adminClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !serviceKey) {
    throw new Error(
      'Missing SUPABASE_SERVICE_ROLE_KEY. Add it to .env.local for server-side photo storage operations.'
    );
  }

  adminClient = createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      fetch: supabaseAdminFetch,
    },
  });

  return adminClient;
}
