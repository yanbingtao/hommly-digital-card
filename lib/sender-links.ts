export type SenderLinkKey = 'whatsapp' | 'instagram' | 'linkedin' | 'tiktok' | 'website' | 'email';

export interface SenderLinkEntry {
  enabled: boolean;
  label: string;
  url: string;
}

export type SenderLinks = Partial<Record<SenderLinkKey, SenderLinkEntry>>;

export interface SenderLinkFormInputs {
  whatsapp: string;
  instagram: string;
  linkedin: string;
  tiktok: string;
  website: string;
  email: string;
}

export const EMPTY_SENDER_LINK_FORM: SenderLinkFormInputs = {
  whatsapp: '',
  instagram: '',
  linkedin: '',
  tiktok: '',
  website: '',
  email: '',
};

const LINK_LABELS: Record<SenderLinkKey, string> = {
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  tiktok: 'TikTok',
  website: 'Website',
  email: 'Email',
};

const WHATSAPP_PREFILL = encodeURIComponent('Thank you for the lovely gift 😊');

const UNSAFE_PROTOCOL = /^(javascript|data|vbscript):/i;

function trim(value: string): string {
  return value.trim();
}

function isSafeHttpUrl(url: string): boolean {
  if (UNSAFE_PROTOCOL.test(url)) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function isSafeMailto(url: string): boolean {
  if (UNSAFE_PROTOCOL.test(url)) return false;
  return url.startsWith('mailto:') && url.length > 'mailto:'.length;
}

function toHttpsUrl(input: string): string | null {
  const value = trim(input);
  if (!value) return null;

  const normalized = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  if (!isSafeHttpUrl(normalized)) return null;

  const parsed = new URL(normalized);
  parsed.protocol = 'https:';
  return parsed.href;
}

function parseWhatsApp(input: string): string | null {
  const digits = trim(input).replace(/[\s+\-()]/g, '');
  if (!digits || !/^\d{8,15}$/.test(digits)) return null;
  return `https://wa.me/${digits}?text=${WHATSAPP_PREFILL}`;
}

function parseInstagram(input: string): string | null {
  const value = trim(input);
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) {
    const url = toHttpsUrl(value);
    if (!url || !/instagram\.com/i.test(url)) return null;
    return url;
  }
  const username = value.replace(/^@/, '');
  if (!/^[a-zA-Z0-9._]{1,30}$/.test(username)) return null;
  return `https://instagram.com/${username}`;
}

function parseLinkedIn(input: string): string | null {
  const value = trim(input);
  if (!value) return null;
  const url = toHttpsUrl(value);
  if (!url || !/linkedin\.com/i.test(url)) return null;
  return url;
}

function parseTikTok(input: string): string | null {
  const value = trim(input);
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) {
    const url = toHttpsUrl(value);
    if (!url || !/tiktok\.com/i.test(url)) return null;
    return url;
  }
  const username = value.replace(/^@/, '');
  if (!/^[a-zA-Z0-9._]{1,24}$/.test(username)) return null;
  return `https://www.tiktok.com/@${username}`;
}

function parseWebsite(input: string): string | null {
  return toHttpsUrl(input);
}

function parseEmail(input: string): string | null {
  const value = trim(input).replace(/^mailto:/i, '');
  if (!value || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return null;
  return `mailto:${value}`;
}

const PARSERS: Record<SenderLinkKey, (input: string) => string | null> = {
  whatsapp: parseWhatsApp,
  instagram: parseInstagram,
  linkedin: parseLinkedIn,
  tiktok: parseTikTok,
  website: parseWebsite,
  email: parseEmail,
};

export function buildSenderLinksFromForm(inputs: SenderLinkFormInputs): SenderLinks {
  const result: SenderLinks = {};

  (Object.keys(PARSERS) as SenderLinkKey[]).forEach((key) => {
    const url = PARSERS[key](inputs[key]);
    if (url) {
      result[key] = {
        enabled: true,
        label: LINK_LABELS[key],
        url,
      };
    }
  });

  return result;
}

export function parseSenderLinksFromDb(value: unknown): SenderLinks | null {
  let raw = value;

  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      return null;
    }
  }

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;

  const parsed: SenderLinks = {};
  for (const key of Object.keys(PARSERS) as SenderLinkKey[]) {
    const entry = (raw as SenderLinks)[key];
    if (!entry?.url || typeof entry.url !== 'string') continue;

    const url = trim(entry.url);
    const valid =
      key === 'email' ? isSafeMailto(url) : isSafeHttpUrl(url);

    if (!valid || UNSAFE_PROTOCOL.test(url)) continue;

    parsed[key] = {
      enabled: true,
      label: entry.label || LINK_LABELS[key],
      url,
    };
  }

  return Object.keys(parsed).length > 0 ? parsed : null;
}

export function senderLinksToFormInputs(links: SenderLinks | null): SenderLinkFormInputs {
  if (!links) return { ...EMPTY_SENDER_LINK_FORM };

  return {
    whatsapp: links.whatsapp?.url.match(/^https:\/\/wa\.me\/(\d+)/)?.[1] ?? '',
    instagram: links.instagram?.url.replace(/^https:\/\/(www\.)?instagram\.com\//, '@') ?? '',
    linkedin: links.linkedin?.url ?? '',
    tiktok: links.tiktok?.url.replace(/^https:\/\/(www\.)?tiktok\.com\/@/, '@') ?? '',
    website: links.website?.url ?? '',
    email: links.email?.url.replace(/^mailto:/i, '') ?? '',
  };
}

export interface VisibleSenderLink extends SenderLinkEntry {
  key: SenderLinkKey;
}

export function getVisibleSenderLinks(card: {
  show_sender_links?: boolean;
  sender_links?: SenderLinks | null;
}): VisibleSenderLink[] {
  if (!Boolean(card.show_sender_links)) return [];

  const links = parseSenderLinksFromDb(card.sender_links);
  if (!links) return [];

  const order: SenderLinkKey[] = ['whatsapp', 'instagram', 'linkedin', 'tiktok', 'website', 'email'];
  return order
    .map((key) => {
      const entry = links[key];
      if (!entry?.enabled || !entry.url) return null;
      return { key, ...entry };
    })
    .filter((entry): entry is VisibleSenderLink => entry !== null);
}

export function shouldShowSenderLinks(
  card: {
    status: string;
    show_sender_links?: boolean;
    sender_links?: SenderLinks | null;
  },
  options?: { pinVerified?: boolean }
): boolean {
  if (card.status !== 'published') return false;
  if (options?.pinVerified === false) return false;
  return getVisibleSenderLinks(card).length > 0;
}
