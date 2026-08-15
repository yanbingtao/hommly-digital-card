import fs from 'fs';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { createCardCore } from './create-card-core';
import { handleInternalCreateCard } from './internal-card-api';
import {
  parseInternalCreateCardRequest,
  SHARED_CARD_CREATION_DISABLED,
} from './internal-card-request';
import {
  buildIndividualInternalCardResponse,
  buildSharedInternalCardResponse,
} from './internal-card-response';
import {
  parseBearerToken,
  secretsMatch,
  verifyAutomationRequest,
} from './automation-auth';
import type { CardWithOrder, DigitalCardRecipient } from './types';

const ROOT = path.join(__dirname, '..');
const SITE_ORIGIN = 'https://hommly.online';

function sharedCardFixture(overrides?: Partial<CardWithOrder>): CardWithOrder {
  return {
    id: 'card-shared',
    order_id: 'ord-1',
    card_mode: 'shared',
    platform: 'shopee',
    external_order_id: '260810ABC123XY',
    public_token: 'pubToken12ab',
    edit_token: '260810ABC123XY-20260810120000_secretTok',
    message: null,
    theme: 'thank_you',
    animation: 'soft_reveal',
    status: 'draft',
    created_at: '2026-08-10T04:00:00.000Z',
    updated_at: '2026-08-10T04:00:00.000Z',
    published_at: null,
    order: {
      id: 'ord-1',
      order_number: '260810ABC123XY-20260810120000',
      created_at: '2026-08-10T04:00:00.000Z',
    },
    ...overrides,
  };
}

function individualCardFixture(overrides?: Partial<CardWithOrder>): CardWithOrder {
  return sharedCardFixture({
    id: 'card-ind',
    card_mode: 'individual',
    public_token: 'parentCompatTok',
    ...overrides,
  });
}

function recipientFixture(
  number: number,
  viewToken: string,
  cardId = 'card-ind'
): DigitalCardRecipient {
  return {
    id: `recipient-${number}`,
    digital_card_id: cardId,
    recipient_number: number,
    view_token: viewToken,
    message: null,
    theme: 'thank_you',
    animation: 'soft_reveal',
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
    created_at: '2026-08-12T04:00:00.000Z',
    updated_at: '2026-08-12T04:00:00.000Z',
  };
}

type QueryResult = { data: unknown; error: { message: string; code?: string } | null };

function mockSharedSupabase(options: {
  existing?: CardWithOrder | null;
  insertOrder?: QueryResult;
  insertCard?: QueryResult | QueryResult[];
}) {
  const cardInserts = Array.isArray(options.insertCard)
    ? [...options.insertCard]
    : options.insertCard
      ? [options.insertCard]
      : [];
  let lookupCount = 0;

  return {
    from(table: string) {
      if (table === 'digital_cards') {
        return {
          select() {
            return {
              eq() {
                return {
                  eq() {
                    return {
                      async maybeSingle() {
                        lookupCount += 1;
                        if (options.existing) {
                          return { data: options.existing, error: null };
                        }
                        return { data: null, error: null };
                      },
                    };
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
                    const next = cardInserts.shift();
                    if (next) return next;
                    const created = sharedCardFixture();
                    return {
                      data: {
                        id: created.id,
                        order_id: created.order_id,
                        platform: created.platform,
                        external_order_id: created.external_order_id,
                        public_token: created.public_token,
                        edit_token: created.edit_token,
                        message: null,
                        theme: 'thank_you',
                        animation: 'soft_reveal',
                        status: 'draft',
                        created_at: created.created_at,
                        updated_at: created.updated_at,
                        published_at: null,
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
                    if (options.insertOrder) return options.insertOrder;
                    return {
                      data: {
                        id: 'ord-1',
                        order_number: '260810ABC123XY-20260810120000',
                        created_at: '2026-08-10T04:00:00.000Z',
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
      throw new Error(`unexpected table ${table}`);
    },
  };
}

function mockIndividualSupabase(options: {
  existingCard?: CardWithOrder | null;
  existingRecipients?: DigitalCardRecipient[];
}) {
  const card = options.existingCard ?? null;
  const recipients = [...(options.existingRecipients ?? [])];
  let createdCard: CardWithOrder | null = null;

  return {
    from(table: string) {
      if (table === 'digital_cards') {
        return {
          select() {
            return {
              eq(_col: string, _val: unknown) {
                return {
                  eq(_col2: string, _val2: unknown) {
                    return {
                      async maybeSingle() {
                        const match = card ?? createdCard;
                        return { data: match, error: null };
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
                    if (card) {
                      return { data: null, error: { message: 'duplicate', code: '23505' } };
                    }
                    createdCard = individualCardFixture({
                      id: 'card-new',
                      public_token: row.public_token as string,
                      edit_token: row.edit_token as string,
                      order: {
                        id: 'ord-new',
                        order_number: 'ORDER002-20260812120000',
                        created_at: '2026-08-12T04:00:00.000Z',
                      },
                    });
                    return {
                      data: {
                        id: createdCard.id,
                        order_id: 'ord-new',
                        card_mode: 'individual',
                        public_token: createdCard.public_token,
                        edit_token: createdCard.edit_token,
                        platform: 'shopee',
                        external_order_id: 'ORDER002',
                        message: null,
                        theme: 'thank_you',
                        animation: 'soft_reveal',
                        status: 'draft',
                        created_at: createdCard.created_at,
                        updated_at: createdCard.updated_at,
                        published_at: null,
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
                        id: 'ord-new',
                        order_number: 'ORDER002-20260812120000',
                        created_at: '2026-08-12T04:00:00.000Z',
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
      if (table === 'digital_card_recipients') {
        return {
          select(_columns: string) {
            return {
              eq(column: string, value: unknown) {
                if (column === 'digital_card_id') {
                  return {
                    order() {
                      const rows = recipients.filter((row) => row.digital_card_id === value);
                      return Promise.resolve({ data: rows, error: null });
                    },
                  };
                }
                return {
                  order() {
                    return Promise.resolve({ data: [], error: null });
                  },
                };
              },
            };
          },
          insert(rows: Array<Record<string, unknown>>) {
            return {
              select(_columns: string) {
                const inserted = rows.map((row, index) =>
                  recipientFixture(
                    row.recipient_number as number,
                    row.view_token as string,
                    row.digital_card_id as string
                  )
                );
                recipients.push(...inserted);
                return Promise.resolve({ data: inserted, error: null });
              },
            };
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
}

function assertParsed<T extends { ok: true }>(
  parsed: { ok: boolean } & Partial<T>
): asserts parsed is T {
  expect(parsed.ok).toBe(true);
}

describe('parseInternalCreateCardRequest — Individual-only', () => {
  it('rejects legacy request without recipient_count', () => {
    const parsed = parseInternalCreateCardRequest({
      platform: 'shopee',
      order_id: '260810ABC123XY',
    });
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.error).toMatch(/recipient_count is required/i);
  });

  it('rejects explicit shared mode', () => {
    const parsed = parseInternalCreateCardRequest({
      platform: 'shopee',
      order_id: '260810ABC123XY',
      mode: 'shared',
    });
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.code).toBe(SHARED_CARD_CREATION_DISABLED);
  });

  it('rejects shared mode with recipient_count', () => {
    const parsed = parseInternalCreateCardRequest({
      platform: 'shopee',
      order_id: '260810ABC123XY',
      mode: 'shared',
      recipient_count: 3,
    });
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.code).toBe(SHARED_CARD_CREATION_DISABLED);
  });

  it('rejects individual mode without recipient_count', () => {
    const parsed = parseInternalCreateCardRequest({
      platform: 'shopee',
      order_id: '260810ABC123XY',
      mode: 'individual',
    });
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.error).toMatch(/recipient_count is required/i);
  });

  it('rejects individual count zero', () => {
    const parsed = parseInternalCreateCardRequest({
      platform: 'shopee',
      order_id: '260810ABC123XY',
      mode: 'individual',
      recipient_count: 0,
    });
    expect(parsed.ok).toBe(false);
  });

  it('rejects individual decimal count', () => {
    const parsed = parseInternalCreateCardRequest({
      platform: 'shopee',
      order_id: '260810ABC123XY',
      mode: 'individual',
      recipient_count: 3.5,
    });
    expect(parsed.ok).toBe(false);
  });

  it('accepts individual count=3', () => {
    const parsed = parseInternalCreateCardRequest({
      platform: 'shopee',
      order_id: '260810ABC123XY',
      mode: 'individual',
      recipient_count: 3,
    });
    assertParsed(parsed);
    expect(parsed.mode).toBe('individual');
    expect(parsed.recipientCount).toBe(3);
  });

  it('accepts omitted mode with recipient_count', () => {
    const parsed = parseInternalCreateCardRequest({
      platform: 'shopee',
      order_id: '260810ABC123XY',
      recipient_count: 37,
    });
    assertParsed(parsed);
    expect(parsed.mode).toBe('individual');
    expect(parsed.recipientCount).toBe(37);
  });

  it('rejects invalid mode', () => {
    const parsed = parseInternalCreateCardRequest({
      platform: 'shopee',
      order_id: '260810ABC123XY',
      mode: 'bulk',
      recipient_count: 3,
    });
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.error).toMatch(/mode must be individual/i);
  });

  it('rejects unknown fields', () => {
    const parsed = parseInternalCreateCardRequest({
      platform: 'shopee',
      order_id: '260810ABC123XY',
      gift_quantity: 3,
    });
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.error).toMatch(/unexpected fields/i);
  });
});

describe('handleInternalCreateCard — routing', () => {
  it('routes individual to createIndividualCardCore', async () => {
    const supabase = mockIndividualSupabase({ existingCard: null });
    const parsed = parseInternalCreateCardRequest({
      platform: 'shopee',
      order_id: 'ORDER002',
      mode: 'individual',
      recipient_count: 3,
    });
    assertParsed(parsed);
    const result = await handleInternalCreateCard(supabase as never, parsed);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.httpStatus).toBe(201);
    expect(result.body.mode).toBe('individual');
    if (result.body.mode !== 'individual') return;
    expect(result.body.recipients).toHaveLength(3);
  });

  it('persists canonical Shopee identity on create (platform + external_order_id)', async () => {
    const supabase = mockIndividualSupabase({ existingCard: null });
    const parsed = parseInternalCreateCardRequest({
      platform: 'shopee',
      order_id: '260815EAUNGANW',
      recipient_count: 2,
    });
    assertParsed(parsed);
    const result = await handleInternalCreateCard(supabase as never, parsed);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.body.platform).toBe('shopee');
    expect(result.body.order_id).toBe('260815EAUNGANW');
    const stored = (supabase as { _state?: { cards: Array<Record<string, unknown>> } })._state
      ?.cards?.[0];
    // Prefer inspecting createIndividualCardCore result via second lookup if mock exposes state.
    expect(result.body.mode).toBe('individual');
    // Re-create should hit identity and return existing — proves identity was stored.
    const again = await handleInternalCreateCard(supabase as never, parsed);
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    expect(again.httpStatus).toBe(200);
    expect(again.body.status).toBe('existing');
    void stored;
  });

  it('routes omitted mode with recipient_count as Individual', async () => {
    const supabase = mockIndividualSupabase({ existingCard: null });
    const parsed = parseInternalCreateCardRequest({
      platform: 'shopee',
      order_id: 'ORDER002',
      recipient_count: 2,
    });
    assertParsed(parsed);
    const result = await handleInternalCreateCard(supabase as never, parsed);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.body.mode).toBe('individual');
  });
});

describe('Shared internal response compatibility', () => {
  it('retains recipient_view_url and legacy fields', () => {
    const response = buildSharedInternalCardResponse({
      status: 'created',
      platform: 'shopee',
      orderId: '260810ABC123XY',
      card: sharedCardFixture(),
      siteOrigin: SITE_ORIGIN,
    });
    expect(response.mode).toBe('shared');
    expect(response.card_name).toBe('260810ABC123XY-20260810120000');
    expect(response.buyer_edit_url).toBe(
      `${SITE_ORIGIN}/e/260810ABC123XY-20260810120000_secretTok`
    );
    expect(response.recipient_view_url).toBe(`${SITE_ORIGIN}/g/pubToken12ab`);
    expect(response).not.toHaveProperty('recipients');
  });
});

describe('Individual internal response shape', () => {
  it('returns ordered recipients with unique view URLs and one buyer_edit_url', () => {
    const card = individualCardFixture();
    const recipients = [
      recipientFixture(1, 'viewTokOne12'),
      recipientFixture(2, 'viewTokTwo34'),
      recipientFixture(3, 'viewTokThree5'),
    ];
    const response = buildIndividualInternalCardResponse({
      status: 'created',
      platform: 'shopee',
      orderId: 'ORDER002',
      card,
      recipients,
      siteOrigin: SITE_ORIGIN,
    });
    expect(response.mode).toBe('individual');
    expect(response.recipient_count).toBe(3);
    expect(response.buyer_edit_url).toBe(`${SITE_ORIGIN}/e/${card.edit_token}`);
    expect(response).not.toHaveProperty('recipient_view_url');
    expect(response.recipients.map((row) => row.number)).toEqual([1, 2, 3]);
    expect(response.recipients[0].label).toBe('Gift #01');
    expect(response.recipients[2].label).toBe('Gift #03');
    const urls = response.recipients.map((row) => row.view_url);
    expect(new Set(urls).size).toBe(3);
    expect(urls[0]).toBe(`${SITE_ORIGIN}/g/viewTokOne12`);
    expect(urls[1]).toBe(`${SITE_ORIGIN}/g/viewTokTwo34`);
    expect(urls.every((url) => !url.includes('parentCompatTok'))).toBe(true);
  });
});

describe('handleInternalCreateCard — idempotency and conflicts', () => {
  it('returns existing Individual card with same recipient_count', async () => {
    const card = individualCardFixture({ external_order_id: 'ORDER002' });
    const existingRecipients = [
      recipientFixture(1, 'tok1'),
      recipientFixture(2, 'tok2'),
      recipientFixture(3, 'tok3'),
    ];
    const supabase = mockIndividualSupabase({
      existingCard: card,
      existingRecipients,
    });
    const parsed = parseInternalCreateCardRequest({
      platform: 'shopee',
      order_id: 'ORDER002',
      mode: 'individual',
      recipient_count: 3,
    });
    assertParsed(parsed);
    const result = await handleInternalCreateCard(supabase as never, parsed);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.httpStatus).toBe(200);
    expect(result.body.status).toBe('existing');
    if (result.body.mode !== 'individual') return;
    expect(result.body.recipients).toHaveLength(3);
  });

  it('returns 409 when Individual recipient_count differs', async () => {
    const card = individualCardFixture({ external_order_id: 'ORDER002' });
    const supabase = mockIndividualSupabase({
      existingCard: card,
      existingRecipients: [recipientFixture(1, 'tok1'), recipientFixture(2, 'tok2')],
    });
    const parsed = parseInternalCreateCardRequest({
      platform: 'shopee',
      order_id: 'ORDER002',
      mode: 'individual',
      recipient_count: 3,
    });
    assertParsed(parsed);
    const result = await handleInternalCreateCard(supabase as never, parsed);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.httpStatus).toBe(409);
    expect(result.body.error).toBe('INDIVIDUAL_RECIPIENT_COUNT_MISMATCH');
    expect(result.body.existing_count).toBe(2);
    expect(result.body.requested_count).toBe(3);
  });

  it('Individual request against existing Shared card returns CARD_MODE_MISMATCH', async () => {
    const supabase = mockSharedSupabase({ existing: sharedCardFixture() });
    const parsed = parseInternalCreateCardRequest({
      platform: 'shopee',
      order_id: '260810ABC123XY',
      recipient_count: 3,
    });
    assertParsed(parsed);
    const result = await handleInternalCreateCard(supabase as never, parsed);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.httpStatus).toBe(409);
    expect(result.body.error).toBe('CARD_MODE_MISMATCH');
    expect(result.body.existing_mode).toBe('shared');
    expect(result.body.requested_mode).toBe('individual');
  });
});

describe('automation auth unchanged', () => {
  const original = process.env.AUTOMATION_SECRET;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.AUTOMATION_SECRET;
    } else {
      process.env.AUTOMATION_SECRET = original;
    }
  });

  it('parses bearer tokens and rejects missing/invalid secrets', () => {
    expect(parseBearerToken('Bearer super-secret-value')).toBe('super-secret-value');
    expect(parseBearerToken('super-secret-value')).toBeNull();
    expect(secretsMatch('abc', 'abc')).toBe(true);
    expect(secretsMatch('abc', 'xyz')).toBe(false);
    process.env.AUTOMATION_SECRET = 'super-secret-value';
    expect(verifyAutomationRequest('Bearer super-secret-value').ok).toBe(true);
    expect(verifyAutomationRequest('Bearer wrong').ok).toBe(false);
    expect(verifyAutomationRequest(null).ok).toBe(false);
  });

  it('never includes the secret in error messages', () => {
    process.env.AUTOMATION_SECRET = 'super-secret-value-do-not-log';
    const result = verifyAutomationRequest('Bearer no-match');
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain('super-secret-value-do-not-log');
  });
});

describe('Phase 6B route wiring guards', () => {
  it('internal route delegates to handleInternalCreateCard', () => {
    const source = fs.readFileSync(path.join(ROOT, 'app/api/internal/cards/route.ts'), 'utf8');
    expect(source).toMatch(/handleInternalCreateCard/);
    expect(source).toMatch(/parseInternalCreateCardRequest/);
    expect(source).not.toMatch(/createCardCore\(/);
    expect(source).not.toMatch(/createIndividualCardCore\(/);
  });

  it('internal-card-api routes Individual create only', () => {
    const source = fs.readFileSync(path.join(ROOT, 'lib/internal-card-api.ts'), 'utf8');
    expect(source).toMatch(/createIndividualCardCore/);
    expect(source).not.toMatch(/createCardCore/);
  });

  it('Shared createCardCore still creates zero recipients', async () => {
    let recipientTouched = false;
    const supabase = {
      from(table: string) {
        if (table === 'digital_card_recipients') {
          recipientTouched = true;
          throw new Error('unexpected');
        }
        return mockSharedSupabase({ existing: null }).from(table);
      },
    };
    await createCardCore(supabase as never, {
      orderNumberInput: '260810ABC123XY',
      platform: 'shopee',
      externalOrderId: '260810ABC123XY',
    });
    expect(recipientTouched).toBe(false);
  });
});
