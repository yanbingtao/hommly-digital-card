export function getConfiguredSiteOrigin(): string {
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? '';
}

export function getSiteOrigin(): string {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }

  return getConfiguredSiteOrigin();
}
