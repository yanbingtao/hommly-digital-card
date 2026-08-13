import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { addMonths } from 'date-fns';
import { getPhotoPathForResolvedView, verifyViewerPinForResolved } from './card-photo-access';
import { buildRecipientViewUrl } from './individual-card-urls';
import {
  getRecipientViewPinSource,
  isIndividualRecipientViewAvailable,
  isResolvedRecipientViewAvailable,
  isSharedRecipientViewAvailable,
  resolveRecipientViewToken,
} from './recipient-view-resolver';
import { toRecipientDisplayContent } from './recipient-display-card';
import { hashViewPin } from './view-pin-crypto';
import type { CardWithOrder, DigitalCardMedia, DigitalCardRecipient } from './types';

const MIGRATION_PATH = path.join(
  __dirname,
  '..',
  'supabase',
  'migrations',
  '20260812140000_add_card_mode_and_digital_card_recipients.sql'
);

function sharedCard(overrides?: Partial<CardWithOrder>): CardWithOrder {
  return {
    id: 'card-shared',
    order_id: 'ord-1',
    card_mode: 'shared',
    public_token: 'sharedViewTk',
    edit_token: 'edit_shared',
    message: 'Shared message',
    theme: 'thank_you',
    animation: 'soft_reveal',
    status: 'published',
    show_sender_links: false,
    sender_links: null,
    view_pin_enabled: false,
    view_pin_hash: null,
    created_at: '2026-08-12T06:00:00.000Z',
    updated_at: '2026-08-12T06:00:00.000Z',
    published_at: '2026-08-12T06:00:00.000Z',
    first_published_at: '2026-08-12T06:00:00.000Z',
    photo_path: 'cards/card-shared/photo.webp',
    photo_uploaded_at: '2026-08-12T06:00:00.000Z',
    order: {
      id: 'ord-1',
      order_number: 'ORD-001',
      created_at: '2026-08-12T06:00:00.000Z',
    },
    ...overrides,
  };
}

function individualParent(overrides?: Partial<CardWithOrder>): CardWithOrder {
  return {
    id: 'card-ind',
    order_id: 'ord-ind',
    card_mode: 'individual',
    public_token: 'compatViewTk',
    edit_token: 'edit_individual',
    message: null,
    theme: 'thank_you',
    animation: 'soft_reveal',
    status: 'draft',
    show_sender_links: false,
    sender_links: null,
    view_pin_enabled: false,
    view_pin_hash: null,
    created_at: '2026-08-12T06:00:00.000Z',
    updated_at: '2026-08-12T06:00:00.000Z',
    published_at: null,
    first_published_at: '2026-08-12T06:00:00.000Z',
    photo_path: null,
    photo_uploaded_at: null,
    order: {
      id: 'ord-ind',
      order_number: 'IND-001',
      created_at: '2026-08-12T06:00:00.000Z',
    },
    ...overrides,
  };
}

function recipient(
  number: number,
  viewToken: string,
  overrides?: Partial<DigitalCardRecipient>
): DigitalCardRecipient {
  return {
    id: `recipient-${number}`,
    digital_card_id: 'card-ind',
    recipient_number: number,
    view_token: viewToken,
    message: `Message for gift ${number}`,
    theme: 'thank_you',
    animation: 'soft_reveal',
    show_sender_links: false,
    sender_links: null,
    view_pin_enabled: false,
    view_pin_hash: null,
    photo_media_id: null,
    photo_path: number === 1 ? 'cards/card-ind/recipients/r1/photo.webp' : null,
    photo_original_name: null,
    photo_mime_type: null,
    photo_size_bytes: null,
    photo_uploaded_at: number === 1 ? '2026-08-12T06:00:00.000Z' : null,
    status: 'published',
    published_at: '2026-08-12T06:00:00.000Z',
    created_at: '2026-08-12T06:00:00.000Z',
    updated_at: '2026-08-12T06:00:00.000Z',
    ...overrides,
  };
}

function createResolverMockSupabase(options: {
  recipients?: DigitalCardRecipient[];
  cards?: CardWithOrder[];
  mediaRows?: DigitalCardMedia[];
}) {
  const recipients = [...(options.recipients ?? [])];
  const cards = [...(options.cards ?? [])];
  const mediaRows = [...(options.mediaRows ?? [])];

  return {
    from(table: string) {
      if (table === 'digital_card_recipients') {
        return {
          select() {
            return {
              eq(column: string, value: unknown) {
                return {
                  async maybeSingle() {
                    const match = recipients.find(
                      (row) => row[column as keyof DigitalCardRecipient] === value
                    );
                    return { data: match ?? null, error: null };
                  },
                };
              },
            };
          },
        };
      }

      if (table === 'digital_card_media') {
        return {
          select() {
            return {
              eq(column: string, value: unknown) {
                return {
                  async maybeSingle() {
                    const match = mediaRows.find((row) => row[column as keyof DigitalCardMedia] === value);
                    return { data: match ?? null, error: null };
                  },
                };
              },
            };
          },
        };
      }

      if (table === 'digital_cards') {
        return {
          select() {
            return {
              eq(column: string, value: unknown) {
                return {
                  async maybeSingle() {
                    const match = cards.find((row) => {
                      if (column === 'public_token') return row.public_token === value;
                      if (column === 'id') return row.id === value;
                      return false;
                    });
                    return { data: match ?? null, error: null };
                  },
                };
              },
            };
          },
        };
      }

      throw new Error(`unexpected table ${table}`);
    },
  };
}

describe('resolveRecipientViewToken', () => {
  it('resolves Shared public token to shared card', async () => {
    const supabase = createResolverMockSupabase({ cards: [sharedCard()] });
    const result = await resolveRecipientViewToken(supabase as never, 'sharedViewTk');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.resolved.mode).toBe('shared');
    expect(result.resolved.card.message).toBe('Shared message');
  });

  it('resolves Individual recipient view_token to recipient + parent', async () => {
    const supabase = createResolverMockSupabase({
      cards: [individualParent()],
      recipients: [recipient(1, 'indRecipTok1')],
    });
    const result = await resolveRecipientViewToken(supabase as never, 'indRecipTok1');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.resolved.mode).toBe('individual');
    expect(result.resolved.recipient.recipient_number).toBe(1);
  });

  it('returns different messages for #01 and #02', async () => {
    const supabase = createResolverMockSupabase({
      cards: [individualParent()],
      recipients: [
        recipient(1, 'indRecipTok1', { message: 'Message A' }),
        recipient(2, 'indRecipTok2', { message: 'Message B' }),
      ],
    });
    const one = await resolveRecipientViewToken(supabase as never, 'indRecipTok1');
    const two = await resolveRecipientViewToken(supabase as never, 'indRecipTok2');
    expect(one.ok && two.ok).toBe(true);
    if (!one.ok || !two.ok) return;
    if (one.resolved.mode !== 'individual' || two.resolved.mode !== 'individual') return;
    expect(one.resolved.recipient.message).toBe('Message A');
    expect(two.resolved.recipient.message).toBe('Message B');
  });

  it('rejects Individual parent compatibility public_token', async () => {
    const supabase = createResolverMockSupabase({ cards: [individualParent()] });
    const result = await resolveRecipientViewToken(supabase as never, 'compatViewTk');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('unavailable');
  });

  it('rejects ambiguous token collision across tables', async () => {
    const supabase = createResolverMockSupabase({
      cards: [sharedCard({ public_token: 'collisViewTk' })],
      recipients: [recipient(1, 'collisViewTk')],
    });
    const result = await resolveRecipientViewToken(supabase as never, 'collisViewTk');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('ambiguous_token');
  });

  it('returns invalid_token and not_found appropriately', async () => {
    const supabase = createResolverMockSupabase({});
    expect((await resolveRecipientViewToken(supabase as never, '')).ok).toBe(false);
    expect((await resolveRecipientViewToken(supabase as never, 'bad-token')).ok).toBe(false);
    expect((await resolveRecipientViewToken(supabase as never, 'unknownTok12')).ok).toBe(false);
  });
});

describe('recipient view availability', () => {
  it('marks draft Individual recipient unavailable', () => {
    expect(
      isIndividualRecipientViewAvailable(
        individualParent(),
        recipient(1, 'indRecipTok1', { status: 'draft' })
      )
    ).toBe(false);
  });

  it('marks published Individual recipient available when parent not expired', () => {
    expect(
      isIndividualRecipientViewAvailable(individualParent(), recipient(1, 'indRecipTok1'))
    ).toBe(true);
  });

  it('marks Individual recipient unavailable when parent expired', () => {
    const expiredAt = addMonths(new Date(), -7).toISOString();
    const parent = individualParent({ first_published_at: expiredAt, published_at: expiredAt });
    expect(isIndividualRecipientViewAvailable(parent, recipient(1, 'indRecipTok1'))).toBe(false);
  });

  it('applies parent expiry override to Individual recipient', () => {
    const parent = individualParent({
      first_published_at: addMonths(new Date(), -8).toISOString(),
      expires_at_override: addMonths(new Date(), 2).toISOString(),
    });
    expect(isIndividualRecipientViewAvailable(parent, recipient(1, 'indRecipTok1'))).toBe(true);
  });

  it('keeps Shared availability rules unchanged', () => {
    expect(isSharedRecipientViewAvailable(sharedCard())).toBe(true);
    expect(isSharedRecipientViewAvailable(sharedCard({ status: 'draft' }))).toBe(false);
  });
});

describe('mode-aware PIN and photo sources', () => {
  it('uses recipient PIN hash for Individual mode', async () => {
    const hash = hashViewPin('1234');
    const resolved = {
      mode: 'individual' as const,
      card: individualParent({ view_pin_hash: hashViewPin('9999') }),
      recipient: recipient(1, 'indRecipTok1', {
        view_pin_enabled: true,
        view_pin_hash: hash,
      }),
      photo_media: null,
    };
    expect(getRecipientViewPinSource(resolved).view_pin_hash).toBe(hash);
    expect((await verifyViewerPinForResolved(resolved, '1234')).allowed).toBe(true);
    expect((await verifyViewerPinForResolved(resolved, '5678')).allowed).toBe(false);
  });

  it('skips PIN gate when Viewing PIN is disabled on the recipient', async () => {
    const resolved = {
      mode: 'individual' as const,
      card: individualParent(),
      recipient: recipient(1, 'indRecipTok1', {
        view_pin_enabled: false,
        view_pin_hash: null,
      }),
      photo_media: null,
    };
    expect(getRecipientViewPinSource(resolved).view_pin_enabled).toBe(false);
    expect((await verifyViewerPinForResolved(resolved, null)).allowed).toBe(true);
    expect((await verifyViewerPinForResolved(resolved, undefined)).allowed).toBe(true);
  });

  it('uses parent PIN hash for Shared mode', async () => {
    const hash = hashViewPin('4321');
    const resolved = {
      mode: 'shared' as const,
      card: sharedCard({ view_pin_enabled: true, view_pin_hash: hash }),
      recipient: null,
    };
    expect((await verifyViewerPinForResolved(resolved, '4321')).allowed).toBe(true);
  });

  it('uses recipient photo media path when photo_media_id is set', async () => {
    const photoMedia: DigitalCardMedia = {
      id: 'media-a',
      digital_card_id: 'card-ind',
      storage_path: 'cards/card-ind/media/media-a.webp',
      original_name: 'photo.webp',
      mime_type: 'image/webp',
      size_bytes: 100,
      created_at: '2026-08-12T08:00:00.000Z',
      updated_at: '2026-08-12T08:00:00.000Z',
    };
    const supabase = createResolverMockSupabase({
      cards: [individualParent()],
      recipients: [recipient(1, 'indRecipTok1', { photo_media_id: 'media-a', photo_path: null })],
      mediaRows: [photoMedia],
    });
    const result = await resolveRecipientViewToken(supabase as never, 'indRecipTok1');
    expect(result.ok).toBe(true);
    if (!result.ok || result.resolved.mode !== 'individual') return;
    expect(getPhotoPathForResolvedView(result.resolved)).toBe('cards/card-ind/media/media-a.webp');
  });

  it('uses recipient photo path for Individual and parent path for Shared', () => {
    const individualResolved = {
      mode: 'individual' as const,
      card: individualParent(),
      recipient: recipient(1, 'indRecipTok1'),
      photo_media: null,
    };
    expect(getPhotoPathForResolvedView(individualResolved)).toBe(
      'cards/card-ind/recipients/r1/photo.webp'
    );
    expect(getPhotoPathForResolvedView({ mode: 'shared', card: sharedCard(), recipient: null })).toBe(
      'cards/card-shared/photo.webp'
    );
  });

  it('buildRecipientViewUrl never uses parent compatibility token', () => {
    const url = buildRecipientViewUrl(recipient(1, 'indRecipTok1'), 'https://hommly.online');
    expect(url).toBe('https://hommly.online/g/indRecipTok1');
    expect(url).not.toContain('compatViewTk');
  });
});

describe('RLS and production guards', () => {
  it('Phase 1 migration has no broad anon SELECT on digital_card_recipients', () => {
    const sql = fs.readFileSync(MIGRATION_PATH, 'utf8');
    expect(sql).toMatch(/ENABLE ROW LEVEL SECURITY/);
    expect(sql).not.toMatch(/CREATE POLICY.*digital_card_recipients/i);
  });

  it('/g route uses server actions not browser supabase', () => {
    const page = fs.readFileSync(
      path.join(__dirname, '..', 'app/g/[publicToken]/page.tsx'),
      'utf8'
    );
    expect(page).not.toMatch(/createBrowserSupabase/);
    expect(page).toMatch(/fetchRecipientViewMeta/);
  });
});

describe('resolved availability for photos', () => {
  it('blocks draft Individual recipient views', async () => {
    const supabase = createResolverMockSupabase({
      cards: [individualParent()],
      recipients: [recipient(1, 'indRecipTok1', { status: 'draft' })],
    });
    const result = await resolveRecipientViewToken(supabase as never, 'indRecipTok1');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(isResolvedRecipientViewAvailable(result.resolved)).toBe(false);
  });

  it('display model omits sensitive fields', () => {
    const display = toRecipientDisplayContent(
      {
        mode: 'individual',
        card: individualParent(),
        recipient: recipient(1, 'indRecipTok1'),
        photo_media: null,
      },
      'indRecipTok1'
    );
    expect(display).not.toHaveProperty('edit_token');
    expect(display).not.toHaveProperty('photo_path');
    expect(display).not.toHaveProperty('view_pin_hash');
  });
});
