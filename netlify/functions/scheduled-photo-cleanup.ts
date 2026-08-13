/**
 * Daily photo cleanup scheduler (03:00 UTC).
 * Invokes the secured Next.js route with AUTOMATION_SECRET.
 */
export default async function scheduledPhotoCleanup() {
  const siteUrl =
    process.env.URL ||
    process.env.DEPLOY_PRIME_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    '';

  const secret = process.env.AUTOMATION_SECRET?.trim();
  if (!siteUrl || !secret) {
    console.error('[scheduled-photo-cleanup] missing URL or AUTOMATION_SECRET');
    return new Response('Misconfigured', { status: 503 });
  }

  const target = new URL('/api/internal/photo-cleanup', siteUrl).toString();
  const response = await fetch(target, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
    },
  });

  const body = await response.text();
  if (!response.ok) {
    console.error('[scheduled-photo-cleanup] failed', response.status, body);
    return new Response(body, { status: response.status });
  }

  console.info('[scheduled-photo-cleanup] ok', body);
  return new Response(body, { status: 200 });
}

export const config = {
  schedule: '0 3 * * *',
};
