import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseClient: SupabaseClient | null = null;

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !key) {
    throw new Error(
      'Missing Supabase env vars. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local, then restart the dev server (npm run dev).'
    );
  }

  if (!url.startsWith('https://') || !url.includes('.supabase.co')) {
    throw new Error(
      `Invalid NEXT_PUBLIC_SUPABASE_URL. It should look like https://your-project-id.supabase.co`
    );
  }

  return { url, key };
}

export function getSupabase(): SupabaseClient {
  if (!supabaseClient) {
    const { url, key } = getSupabaseConfig();
    supabaseClient = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return supabaseClient;
}

export function getConnectionErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes('Missing Supabase env vars') || message.includes('Invalid NEXT_PUBLIC_SUPABASE_URL')) {
    return message;
  }

  if (message.includes('fetch failed')) {
    return [
      'Could not connect to Supabase.',
      'Check that your Supabase project is active (not paused),',
      'NEXT_PUBLIC_SUPABASE_URL is correct in .env.local,',
      'and you restarted the dev server after adding env vars.',
      'If using a new Publishable key, try the Legacy anon key from Supabase → Settings → API Keys.',
    ].join(' ');
  }

  return message || 'Unknown error';
}
