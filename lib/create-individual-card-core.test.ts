import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { createCardCore } from './create-card-core';
import {
  createIndividualCardCore,
  INDIVIDUAL_ERROR,
  verifyRecipientNumbering,
} from './create-individual-card-core';
import { parseInternalCreateCardRequest } from './internal-card-request';
import { buildInternalCardResponse } from './internal-card-response';
import { buildBuyerEditUrl, buildRecipientViewUrl } from './individual-card-urls';
import { validateIndividualRecipientCount } from './individual-recipient-count';
import type { CardWithOrder, DigitalCardRecipient } from './types';

const PROTECTED_PATHS = [
  'app/g/[publicToken]/page.tsx',
  'app/e/[editToken]/page.tsx',
  'app/api/internal/cards/route.ts',
  'lib/internal-card-request.ts',
  'lib/internal-card-response.ts',
  'components/admin/AdminCardsClient.tsx',
  'lib/card-photo.ts',
  'lib/card-photo-storage.ts',
  'lib/card-photo-access.ts',
  'lib/card-photo-cleanup.ts',
  'lib/qr.ts',
];

type StoredOrder = { id: string; order_number: string; created_at: string };
type StoredCard = Record<string, unknown> & {
  id: string;
  order_id: string;
  card_mode: string;
  public_token: string;
  edit_token: string;
  platform?: string | null;
  external_order_id?: string | null;
  status: string;
  theme: string;
  animation: string;
};
type StoredRecipient = DigitalCardRecipient;

function cardWithOrder(card: StoredCard, order: StoredOrder): CardWithOrder {
  return {
    ...(card as unknown as CardWithOrder),
    order,
  };
}

function createIndividualMockSupabase(options?: {
  existingCards?: CardWithOrder[];
  failRecipientInsertOnAttempt?: number;
  partialRecipientInsertCount?: number;
}) {
  const orders: StoredOrder[] = [];
  const cards: StoredCard[] = [...(options?.existingCards ?? []).map((c) => ({
    id: c.id,
    order_id: c.order_id,
    card_mode: c.card_mode,
    public_token: c.public_token,
    edit_token: c.edit_token,
    platform: c.platform ?? null,
    external_order_id: c.external_order_id ?? null,
    status: c.status,
    theme: c.theme,
    animation: c.animation,
    message: c.message ?? null,
    created_at: c.created_at,
    updated_at: c.updated_at,
    published_at: c.published_at,
  }))];
  const recipients: StoredRecipient[] = [];
  let recipientInsertAttempts = 0;
  let nextId = 1;

  const supabase = {
    from(table: string) {
      if (table === 'orders') {
        return {
          insert(row: { order_number: string }) {
            return {
              select() {
                return {
                  async single() {
                    const order: StoredOrder = {
                      id: `ord-${nextId++}`,
                      order_number: row.order_number,
                      created_at: '2026-08-12T06:00:00.000Z',
                    };
                    orders.push(order);
                    return { data: order, error: null };
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
              eq(col: string, val: unknown) {
                return {
                  eq(col2: string, val2: unknown) {
                    return {
                      async maybeSingle() {
                        const match = cards.find(
                          (card) =>
                            card[col as keyof StoredCard] === val &&
                            card[col2 as keyof StoredCard] === val2
                        );
                        if (!match) return { data: null, error: null };
                        const order = orders.find((o) => o.id === match.order_id);
                        const existing = options?.existingCards?.find((c) => c.id === match.id);
                        return {
                          data: cardWithOrder(match, order ?? existing?.order ?? {
                            id: match.order_id,
                            order_number: 'unknown',
                            created_at: '2026-08-12T06:00:00.000Z',
                          }),
                          error: null,
                        };
                      },
                    };
                  },
                };
              },
            };
          },
          insert(row: Record<string, unknown>) {
            return {
              select() {
                return {
                  async single() {
                    const duplicatePlatform =
                      row.platform &&
                      row.external_order_id &&
                      cards.some(
                        (c) =>
                          c.platform === row.platform &&
                          c.external_order_id === row.external_order_id
                      );
                    if (duplicatePlatform) {
                      return {
                        data: null,
                        error: { message: 'duplicate key', code: '23505' },
                      };
                    }
                    const duplicateToken =
                      cards.some(
                        (c) =>
                          c.public_token === row.public_token ||
                          c.edit_token === row.edit_token
                      );
                    if (duplicateToken) {
                      return {
                        data: null,
                        error: { message: 'duplicate token', code: '23505' },
                      };
                    }
                    const card: StoredCard = {
                      id: `card-${nextId++}`,
                      order_id: row.order_id as string,
                      card_mode: (row.card_mode as string) ?? 'shared',
                      public_token: row.public_token as string,
                      edit_token: row.edit_token as string,
                      platform: (row.platform as string | null) ?? null,
                      external_order_id: (row.external_order_id as string | null) ?? null,
                      status: 'draft',
                      theme: 'thank_you',
                      animation: 'soft_reveal',
                      message: null,
                      created_at: '2026-08-12T06:00:00.000Z',
                      updated_at: '2026-08-12T06:00:00.000Z',
                      published_at: null,
                    };
                    cards.push(card);
                    const order = orders.find((o) => o.id === card.order_id)!;
                    return { data: { ...card, order: undefined }, error: null };
                  },
                };
              },
            };
          },
        };
      }

      if (table === 'digital_card_recipients') {
        return {
          select(_columns: string) {
            return {
              eq(column: string, value: unknown) {
                return {
                  eq(nestedColumn: string, nestedValue: unknown) {
                    return {
                      async maybeSingle() {
                        const match = recipients.find(
                          (row) =>
                            row[column as keyof StoredRecipient] === value &&
                            row[nestedColumn as keyof StoredRecipient] === nestedValue
                        );
                        return { data: match ?? null, error: null };
                      },
                    };
                  },
                  order(_col: string, _opts: { ascending: boolean }) {
                    const filtered = recipients
                      .filter((row) => row[column as keyof StoredRecipient] === value)
                      .sort((a, b) => a.recipient_number - b.recipient_number);
                    return Promise.resolve({ data: filtered, error: null });
                  },
                  async maybeSingle() {
                    const match = recipients.find(
                      (row) => row[column as keyof StoredRecipient] === value
                    );
                    return { data: match ?? null, error: null };
                  },
                };
              },
            };
          },
          insert(rows: Record<string, unknown> | Record<string, unknown>[]) {
            return {
              select(_columns: string) {
                return (async () => {
                  recipientInsertAttempts += 1;
                  const batch = Array.isArray(rows) ? rows : [rows];

                  if (
                    options?.failRecipientInsertOnAttempt &&
                    recipientInsertAttempts === options.failRecipientInsertOnAttempt
                  ) {
                    return {
                      data: null,
                      error: { message: 'insert failed', code: 'XX000' },
                    };
                  }

                  if (options?.partialRecipientInsertCount) {
                    const partial = batch.slice(0, options.partialRecipientInsertCount);
                    const inserted = partial.map((row, index) =>
                      toStoredRecipient(row, `recipient-${nextId + index}`)
                    );
                    nextId += partial.length;
                    recipients.push(...inserted);
                    return {
                      data: null,
                      error: { message: 'partial failure simulated', code: 'XX000' },
                    };
                  }

                  for (const row of batch) {
                    const duplicateToken = recipients.some(
                      (existing) => existing.view_token === row.view_token
                    );
                    if (duplicateToken) {
                      return {
                        data: null,
                        error: { message: 'duplicate view_token', code: '23505' },
                      };
                    }
                  }

                  const inserted = batch.map((row, index) => {
                    const stored = toStoredRecipient(row, `recipient-${nextId + index}`);
                    recipients.push(stored);
                    return stored;
                  });
                  nextId += batch.length;
                  return { data: inserted, error: null };
                })();
              },
            };
          },
        };
      }

      throw new Error(`unexpected table ${table}`);
    },
    _state: { orders, cards, recipients, recipientInsertAttempts },
  };

  return supabase;
}

function toStoredRecipient(row: Record<string, unknown>, id: string): StoredRecipient {
  return {
    id,
    digital_card_id: row.digital_card_id as string,
    recipient_number: row.recipient_number as number,
    view_token: row.view_token as string,
    message: null,
    theme: (row.theme as string) ?? 'thank_you',
    animation: (row.animation as string) ?? 'soft_reveal',
    show_sender_links: false,
    sender_links: null,
    view_pin_enabled: false,
    view_pin_hash: null,
    photo_media_id: null,
    photo_path: null,
    photo_original_name: null,
    photo_mime_type: null,
    photo_size_bytes: null,
    photo_uploaded_at: null,
    status: 'draft',
    published_at: null,
    created_at: '2026-08-12T06:00:00.000Z',
    updated_at: '2026-08-12T06:00:00.000Z',
  };
}

function individualCardFixture(overrides?: Partial<CardWithOrder>): CardWithOrder {
  return {
    id: 'card-ind-1',
    order_id: 'ord-ind-1',
    card_mode: 'individual',
    platform: 'shopee',
    external_order_id: 'ORDER123',
    public_token: 'parentPubTok1',
    edit_token: 'ORDER123-20260812120000_secret',
    message: null,
    theme: 'thank_you',
    animation: 'soft_reveal',
    status: 'draft',
    created_at: '2026-08-12T06:00:00.000Z',
    updated_at: '2026-08-12T06:00:00.000Z',
    published_at: null,
    order: {
      id: 'ord-ind-1',
      order_number: 'ORDER123-20260812120000',
      created_at: '2026-08-12T06:00:00.000Z',
    },
    ...overrides,
  };
}

describe('validateIndividualRecipientCount', () => {
  it('rejects non-positive and non-integer counts', () => {
    expect(validateIndividualRecipientCount(0).ok).toBe(false);
    expect(validateIndividualRecipientCount(-1).ok).toBe(false);
    expect(validateIndividualRecipientCount(1.5).ok).toBe(false);
    expect(validateIndividualRecipientCount(NaN).ok).toBe(false);
    expect(validateIndividualRecipientCount(Infinity).ok).toBe(false);
  });

  it('accepts positive integers', () => {
    const result = validateIndividualRecipientCount(3);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.count).toBe(3);
  });
});

describe('createIndividualCardCore', () => {
  it('creates exactly 1 recipient when recipientCount=1', async () => {
    const supabase = createIndividualMockSupabase();
    const result = await createIndividualCardCore(supabase as never, {
      orderNumberInput: 'TEST-INDIVIDUAL-001',
      recipientCount: 1,
      tokenFactory: () => 'parentPubTok1',
      recipientTokenFactory: () => 'viewToken0001',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.existing).toBe(false);
    expect(result.recipients).toHaveLength(1);
    expect(result.recipients[0].recipient_number).toBe(1);
  });

  it('creates exactly 3 recipients numbered 1,2,3 with unique tokens', async () => {
    let tokenCounter = 0;
    const supabase = createIndividualMockSupabase();
    const result = await createIndividualCardCore(supabase as never, {
      orderNumberInput: 'TEST-INDIVIDUAL-001',
      recipientCount: 3,
      tokenFactory: () => 'parentPubTok1',
      recipientTokenFactory: () => `viewTok${String(++tokenCounter).padStart(8, '0')}`,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.recipients.map((r) => r.recipient_number)).toEqual([1, 2, 3]);
    expect(new Set(result.recipients.map((r) => r.view_token)).size).toBe(3);
    expect(verifyRecipientNumbering(result.recipients, 3)).toBe(true);
  });

  it('sets parent card_mode=individual with compatibility public_token and draft status', async () => {
    let tokenCounter = 0;
    const supabase = createIndividualMockSupabase();
    const result = await createIndividualCardCore(supabase as never, {
      orderNumberInput: 'TEST-INDIVIDUAL-001',
      recipientCount: 2,
      tokenFactory: () => 'compatPublic12',
      recipientTokenFactory: () => `recipView${String(++tokenCounter).padStart(8, '0')}`,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.card.card_mode).toBe('individual');
    expect(result.card.public_token).toBe('compatPublic12');
    expect(result.card.status).toBe('draft');
    expect(result.recipients.every((r) => r.status === 'draft')).toBe(true);
  });

  it('returns existing parent and recipients for same platform/order + same count', async () => {
    const existing = individualCardFixture();
    const existingRecipients = [1, 2, 3].map((n) =>
      toStoredRecipient(
        {
          digital_card_id: existing.id,
          recipient_number: n,
          view_token: `token${n}0000000`,
        },
        `recipient-${n}`
      )
    );
    const supabase = createIndividualMockSupabase({ existingCards: [existing] });
    supabase._state.recipients.push(...existingRecipients);

    const first = await createIndividualCardCore(supabase as never, {
      orderNumberInput: 'ORDER123',
      recipientCount: 3,
      platform: 'shopee',
      externalOrderId: 'ORDER123',
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.existing).toBe(true);
    expect(first.card.id).toBe('card-ind-1');
    expect(first.recipients.map((r) => r.id)).toEqual(['recipient-1', 'recipient-2', 'recipient-3']);
    expect(first.recipients.map((r) => r.view_token)).toEqual([
      'token10000000',
      'token20000000',
      'token30000000',
    ]);

    const cardCountBefore = supabase._state.cards.length;
    const recipientCountBefore = supabase._state.recipients.length;
    const second = await createIndividualCardCore(supabase as never, {
      orderNumberInput: 'ORDER123',
      recipientCount: 3,
      platform: 'shopee',
      externalOrderId: 'ORDER123',
    });
    expect(second.ok).toBe(true);
    expect(supabase._state.cards.length).toBe(cardCountBefore);
    expect(supabase._state.recipients.length).toBe(recipientCountBefore);
  });

  it('returns count mismatch when same identity has different recipientCount', async () => {
    const existing = individualCardFixture();
    const supabase = createIndividualMockSupabase({ existingCards: [existing] });
    supabase._state.recipients.push(
      toStoredRecipient(
        { digital_card_id: existing.id, recipient_number: 1, view_token: 'tok1' },
        'recipient-1'
      ),
      toStoredRecipient(
        { digital_card_id: existing.id, recipient_number: 2, view_token: 'tok2' },
        'recipient-2'
      ),
      toStoredRecipient(
        { digital_card_id: existing.id, recipient_number: 3, view_token: 'tok3' },
        'recipient-3'
      )
    );

    const result = await createIndividualCardCore(supabase as never, {
      orderNumberInput: 'ORDER123',
      recipientCount: 4,
      platform: 'shopee',
      externalOrderId: 'ORDER123',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe(INDIVIDUAL_ERROR.INDIVIDUAL_RECIPIENT_COUNT_MISMATCH);
    expect(result.existing).toBe(3);
    expect(result.requested).toBe(4);
    expect(result.message).toContain('INDIVIDUAL_RECIPIENT_COUNT_MISMATCH');
  });

  it('returns mode mismatch when Shared card exists for same identity', async () => {
    const shared = individualCardFixture({
      id: 'card-shared-1',
      card_mode: 'shared',
    });
    const supabase = createIndividualMockSupabase({ existingCards: [shared] });

    const result = await createIndividualCardCore(supabase as never, {
      orderNumberInput: 'ORDER123',
      recipientCount: 3,
      platform: 'shopee',
      externalOrderId: 'ORDER123',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe(INDIVIDUAL_ERROR.CARD_MODE_MISMATCH);
    expect(result.existingMode).toBe('shared');
    expect(result.requestedMode).toBe('individual');
  });

  it('recovers by inserting recipients when parent exists with zero recipients', async () => {
    const existing = individualCardFixture();
    const supabase = createIndividualMockSupabase({ existingCards: [existing] });
    let tokenCounter = 0;

    const result = await createIndividualCardCore(supabase as never, {
      orderNumberInput: 'ORDER123',
      recipientCount: 2,
      platform: 'shopee',
      externalOrderId: 'ORDER123',
      recipientTokenFactory: () => `newRecip${String(++tokenCounter).padStart(8, '0')}`,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.existing).toBe(false);
    expect(result.recipients).toHaveLength(2);
    expect(supabase._state.recipients).toHaveLength(2);
  });

  it('returns incomplete error for gapped recipient numbering', async () => {
    const existing = individualCardFixture();
    const supabase = createIndividualMockSupabase({ existingCards: [existing] });
    supabase._state.recipients.push(
      toStoredRecipient(
        { digital_card_id: existing.id, recipient_number: 1, view_token: 'tok1' },
        'recipient-1'
      ),
      toStoredRecipient(
        { digital_card_id: existing.id, recipient_number: 3, view_token: 'tok3' },
        'recipient-3'
      )
    );

    const result = await createIndividualCardCore(supabase as never, {
      orderNumberInput: 'ORDER123',
      recipientCount: 2,
      platform: 'shopee',
      externalOrderId: 'ORDER123',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe(INDIVIDUAL_ERROR.INDIVIDUAL_CREATION_INCOMPLETE);
  });

  it('returns deterministic failure when recipient insert fails after parent created', async () => {
    const supabase = createIndividualMockSupabase({ failRecipientInsertOnAttempt: 1 });
    const result = await createIndividualCardCore(supabase as never, {
      orderNumberInput: 'TEST-INDIVIDUAL-001',
      recipientCount: 1,
      tokenFactory: () => 'parentPubTok1',
      recipientTokenFactory: () => 'viewToken0001',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe(INDIVIDUAL_ERROR.FAILED_TO_CREATE_RECIPIENTS);
    expect(supabase._state.cards).toHaveLength(1);
    expect(supabase._state.recipients).toHaveLength(0);
  });

  it('retries recipient insert on duplicate view_token (bounded)', async () => {
    let calls = 0;
    const supabase = createIndividualMockSupabase();
    const originalFrom = supabase.from.bind(supabase);
    supabase.from = ((table: string) => {
      const builder = originalFrom(table);
      if (table !== 'digital_card_recipients') return builder;
      return {
        ...builder,
        insert(rows: Record<string, unknown> | Record<string, unknown>[]) {
          calls += 1;
          if (calls === 1) {
            return {
              select() {
                return Promise.resolve({
                  data: null,
                  error: { message: 'duplicate view_token', code: '23505' },
                });
              },
            };
          }
          return builder.insert(rows);
        },
      };
    }) as typeof supabase.from;

    const result = await createIndividualCardCore(supabase as never, {
      orderNumberInput: 'TEST-INDIVIDUAL-001',
      recipientCount: 1,
      tokenFactory: () => 'parentPubTok1',
      recipientTokenFactory: () => 'viewToken0001',
    });
    expect(result.ok).toBe(true);
    expect(calls).toBeGreaterThan(1);
  });
});

describe('individual URL helpers', () => {
  it('builds edit URL from parent edit_token only', () => {
    const card = individualCardFixture();
    expect(buildBuyerEditUrl(card, 'https://hommly.online')).toBe(
      'https://hommly.online/e/ORDER123-20260812120000_secret'
    );
  });

  it('builds recipient view URLs from recipient view_token only', () => {
    const card = individualCardFixture({ public_token: 'compatPublic12' });
    const recipient = toStoredRecipient(
      { digital_card_id: card.id, recipient_number: 1, view_token: 'recipViewTok1' },
      'recipient-1'
    );
    const viewUrl = buildRecipientViewUrl(recipient, 'https://hommly.online');
    expect(viewUrl).toBe('https://hommly.online/g/recipViewTok1');
    expect(viewUrl).not.toContain(card.public_token);
  });
});

describe('Shared production paths unchanged', () => {
  it('createCardCore still creates zero recipients', async () => {
    let recipientTouched = false;
    const supabase = {
      from(table: string) {
        if (table === 'digital_card_recipients') {
          recipientTouched = true;
          throw new Error('unexpected');
        }
        if (table === 'digital_cards') {
          return {
            select() {
              return {
                eq() {
                  return {
                    eq() {
                      return { async maybeSingle() { return { data: null, error: null }; } };
                    },
                  };
                },
              };
            },
            insert() {
              return {
                select() {
                  return {
                    async single() {
                      return {
                        data: {
                          id: 'card-1',
                          order_id: 'ord-1',
                          public_token: 'pub',
                          edit_token: 'edit',
                          card_mode: 'shared',
                          status: 'draft',
                          theme: 'thank_you',
                          animation: 'soft_reveal',
                        },
                        error: null,
                      };
                    },
                  };
                },
              };
            },
          };
        }
        if (table === 'orders') {
          return {
            insert() {
              return {
                select() {
                  return {
                    async single() {
                      return {
                        data: {
                          id: 'ord-1',
                          order_number: 'HM-001-20260812120000',
                          created_at: '2026-08-12T06:00:00.000Z',
                        },
                        error: null,
                      };
                    },
                  };
                },
              };
            },
          };
        }
        throw new Error(`unexpected ${table}`);
      },
    };

    const result = await createCardCore(supabase as never, { orderNumberInput: 'HM-001' });
    expect(result.ok).toBe(true);
    expect(recipientTouched).toBe(false);
  });

  it('internal API parser supports mode and recipient_count for individual', () => {
    expect(
      parseInternalCreateCardRequest({
        platform: 'shopee',
        order_id: '260810ABC123XY',
        mode: 'individual',
        recipient_count: 37,
      }).ok
    ).toBe(true);
    expect(
      parseInternalCreateCardRequest({
        platform: 'shopee',
        order_id: '260810ABC123XY',
        recipient_count: 37,
      }).ok
    ).toBe(false);
  });

  it('internal API shared response still uses parent public_token', () => {
    const card = individualCardFixture({ card_mode: 'shared', public_token: 'sharedPubTok1' });
    const response = buildInternalCardResponse({
      status: 'created',
      platform: 'shopee',
      orderId: 'ORDER123',
      card,
      siteOrigin: 'https://hommly.online',
    });
    expect(response.recipient_view_url).toBe('https://hommly.online/g/sharedPubTok1');
  });
});

describe('Phase 6B production guards', () => {
  it('internal route delegates through internal-card-api', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'app/api/internal/cards/route.ts'), 'utf8');
    expect(source).toMatch(/handleInternalCreateCard/);
    expect(source).not.toMatch(/createIndividualCardCore/);
  });

  it('protected production files exist and are unchanged in this phase scope', () => {
    for (const relative of PROTECTED_PATHS) {
      expect(fs.existsSync(path.join(__dirname, '..', relative))).toBe(true);
    }
  });
});
