import fs from 'fs';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { createCardCore, buildOrderNumber } from './create-card-core';
import { parseInternalCreateCardRequest } from './internal-card-request';
import { buildInternalCardResponse } from './internal-card-response';
import {
  parseBearerToken,
  secretsMatch,
  verifyAutomationRequest,
} from './automation-auth';
import type { CardWithOrder } from './types';

function cardFixture(overrides?: Partial<CardWithOrder>): CardWithOrder {
  return {
    id: 'card-1',
    order_id: 'ord-1',
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

type QueryResult = { data: unknown; error: { message: string; code?: string } | null };

function mockSupabase(options: {
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
                        if (lookupCount === 1 && options.existing) {
                          return { data: options.existing, error: null };
                        }
                        if (lookupCount > 1 && options.existing) {
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
                    const created = cardFixture();
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

describe('createCardCore', () => {
  it('creates a new card once when no existing platform+order exists', async () => {
    const supabase = mockSupabase({ existing: null });
    const result = await createCardCore(supabase as never, {
      orderNumberInput: '260810ABC123XY',
      platform: 'shopee',
      externalOrderId: '260810ABC123XY',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.status).toBe('created');
    expect(result.card.order.order_number).toContain('260810ABC123XY-');
    expect(result.card.order.order_number).toMatch(/^260810ABC123XY-\d{14}$/);
  });

  it('returns existing card without inserting another', async () => {
    const existing = cardFixture();
    const supabase = mockSupabase({ existing });
    const result = await createCardCore(supabase as never, {
      orderNumberInput: '260810ABC123XY',
      platform: 'shopee',
      externalOrderId: '260810ABC123XY',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.status).toBe('existing');
    expect(result.card.order.order_number).toBe('260810ABC123XY-20260810120000');
  });

  it('treats unique violation on platform+order as existing', async () => {
    const existing = cardFixture();
    const supabase = mockSupabase({
      existing: null,
      insertCard: [
        { data: null, error: { message: 'duplicate key', code: '23505' } },
      ],
    });
    // After unique failure, findCardByPlatformOrder is called again.
    let lookups = 0;
    const from = supabase.from.bind(supabase);
    supabase.from = ((table: string) => {
      const builder = from(table);
      if (table !== 'digital_cards') return builder;
      return {
        ...builder,
        select() {
          return {
            eq() {
              return {
                eq() {
                  return {
                    async maybeSingle() {
                      lookups += 1;
                      if (lookups === 1) return { data: null, error: null };
                      return { data: existing, error: null };
                    },
                  };
                },
              };
            },
          };
        },
      };
    }) as typeof supabase.from;

    const result = await createCardCore(supabase as never, {
      orderNumberInput: '260810ABC123XY',
      platform: 'shopee',
      externalOrderId: '260810ABC123XY',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.status).toBe('existing');
    expect(result.card.id).toBe('card-1');
  });

  it('admin create without platform still creates through the same core', async () => {
    const supabase = mockSupabase({ existing: null });
    const result = await createCardCore(supabase as never, {
      orderNumberInput: 'HM-2024-001',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.status).toBe('created');
  });
});

describe('card name generation', () => {
  it('appends a timestamp and never invents a second independent name', () => {
    const name = buildOrderNumber('260810ABC123XY', new Date('2026-08-10T04:01:02Z'));
    expect(name).toMatch(/^260810ABC123XY-\d{14}$/);
  });
});

describe('internal request validation', () => {
  it('accepts a valid shopee order id', () => {
    const parsed = parseInternalCreateCardRequest({
      platform: 'shopee',
      order_id: '260810ABC123XY',
    });
    expect(parsed.ok).toBe(true);
  });

  it('rejects malformed order ids', () => {
    expect(parseInternalCreateCardRequest({ platform: 'shopee', order_id: 'bad id' }).ok).toBe(
      false
    );
    expect(parseInternalCreateCardRequest({ platform: 'shopee', order_id: 'ab' }).ok).toBe(false);
    expect(parseInternalCreateCardRequest({ platform: 'shopee', order_id: '' }).ok).toBe(false);
    expect(parseInternalCreateCardRequest({ platform: 'lazada', order_id: '260810ABC123XY' }).ok).toBe(
      false
    );
  });
});

describe('internal response', () => {
  it('uses the authoritative server card_name', () => {
    const response = buildInternalCardResponse({
      status: 'created',
      platform: 'shopee',
      orderId: '260810ABC123XY',
      card: cardFixture(),
      siteOrigin: 'https://hommly.online',
    });
    expect(response.card_name).toBe('260810ABC123XY-20260810120000');
    expect(response.buyer_edit_url).toBe(
      'https://hommly.online/e/260810ABC123XY-20260810120000_secretTok'
    );
    expect(response.recipient_view_url).toBe('https://hommly.online/g/pubToken12ab');
  });
});

describe('automation auth', () => {
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

  it('admin createCard source delegates to createCardCore', () => {
    const source = fs.readFileSync(path.join(__dirname, 'actions.ts'), 'utf8');
    expect(source).toContain("import { createCardCore } from './create-card-core'");
    expect(source).toContain('createCardCore(getSupabase()');
    expect(source).not.toMatch(/\.from\('digital_cards'\)\s*\n?\s*\.insert/);
  });

  it('enforces UNIQUE(platform, external_order_id) in the migration', () => {
    const sql = fs.readFileSync(
      path.join(__dirname, '..', 'supabase', 'migrations', '20260810100000_add_platform_external_order_id.sql'),
      'utf8'
    );
    expect(sql).toMatch(/UNIQUE INDEX[\s\S]*platform[\s\S]*external_order_id/i);
    expect(sql).toContain('platform');
    expect(sql).toContain('external_order_id');
  });
});

describe('secret logging', () => {
  const original = process.env.AUTOMATION_SECRET;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.AUTOMATION_SECRET;
    } else {
      process.env.AUTOMATION_SECRET = original;
    }
  });

  it('never includes the secret in error messages', () => {
    process.env.AUTOMATION_SECRET = 'super-secret-value-do-not-log';
    const result = verifyAutomationRequest('Bearer no-match');
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain('super-secret-value-do-not-log');
  });
});
