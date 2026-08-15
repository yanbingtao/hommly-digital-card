import fs from 'fs';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { decryptEditPin, hashEditPin } from './edit-pin-crypto';
import { buildEditPinStorage, revealEditPinForCard } from './edit-pin-service';
import {
  buildEditPinLookupLogFields,
  buildEditPinLookupResponseBody,
  EDIT_PIN_LOOKUP_ERROR,
  lookupEditPinByPlatformOrder,
  parseEditPinLookupQuery,
} from './internal-edit-pin-lookup';
import { buildIndividualInternalCardResponse } from './internal-card-response';
import type { CardWithOrder, DigitalCardRecipient } from './types';

const ROOT = path.join(__dirname, '..');
const TEST_KEY = Buffer.alloc(32, 11).toString('base64');

function individualCard(overrides?: Partial<CardWithOrder> & {
  edit_pin_encrypted?: string | null;
  edit_pin_hash?: string | null;
}): CardWithOrder {
  return {
    id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    order_id: 'ord-1',
    card_mode: 'individual',
    platform: 'shopee',
    external_order_id: '260814ABCD12',
    public_token: 'publicTokParent1',
    edit_token: 'editTokSecret99',
    message: null,
    theme: 'thank_you',
    animation: 'soft_reveal',
    status: 'draft',
    created_at: '2026-08-14T06:00:00.000Z',
    updated_at: '2026-08-14T06:00:00.000Z',
    published_at: null,
    first_published_at: null,
    edit_pin_hash: null,
    edit_pin_encrypted: null,
    order: {
      id: 'ord-1',
      order_number: '260814ABCD12-20260814120000',
      created_at: '2026-08-14T06:00:00.000Z',
    },
    ...overrides,
  };
}

function recipient(n: number): DigitalCardRecipient {
  return {
    id: `r-${n}`,
    digital_card_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    recipient_number: n,
    view_token: `viewTok${String(n).padStart(8, '0')}`,
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
    created_at: '2026-08-14T06:00:00.000Z',
    updated_at: '2026-08-14T06:00:00.000Z',
  };
}

type MockCard = CardWithOrder & {
  edit_pin_encrypted?: string | null;
  edit_pin_hash?: string | null;
};

function createLookupSupabase(cards: MockCard[]) {
  const ordersById = new Map<string, { id: string; order_number: string }>();
  for (const card of cards) {
    const orderId = card.order_id;
    const orderNumber = card.order?.order_number || '';
    if (orderId && orderNumber) {
      ordersById.set(orderId, { id: orderId, order_number: orderNumber });
    }
  }

  return {
    from(table: string) {
      if (table === 'orders') {
        let likePattern: string | null = null;
        const builder = {
          select(_cols: string) {
            return builder;
          },
          like(col: string, pattern: string) {
            if (col === 'order_number') likePattern = pattern;
            return builder;
          },
          then(
            resolve: (value: { data: unknown; error: null }) => unknown,
            reject?: (reason: unknown) => unknown
          ) {
            try {
              const prefix = (likePattern || '').replace(/%$/, '');
              const data = [...ordersById.values()].filter((row) =>
                row.order_number.startsWith(prefix)
              );
              return Promise.resolve({ data, error: null }).then(resolve, reject);
            } catch (err) {
              return Promise.reject(err).then(resolve, reject);
            }
          },
        };
        return builder;
      }
      if (table !== 'digital_cards') {
        throw new Error(`unexpected table ${table}`);
      }
      let platformFilter: string | null = null;
      let orderIdFilter: string | null = null;
      let orderIdIn: string[] | null = null;
      let cardModeFilter: string | null = null;
      const builder = {
        select(_cols: string) {
          return builder;
        },
        eq(col: string, value: string) {
          if (col === 'platform') platformFilter = value;
          if (col === 'external_order_id') orderIdFilter = value;
          if (col === 'card_mode') cardModeFilter = value;
          return builder;
        },
        in(col: string, values: string[]) {
          if (col === 'order_id') orderIdIn = values;
          return builder;
        },
        async maybeSingle() {
          const match = cards.find(
            (c) => c.platform === platformFilter && c.external_order_id === orderIdFilter
          );
          if (!match) {
            return { data: null, error: null };
          }
          return {
            data: {
              id: match.id,
              platform: match.platform,
              external_order_id: match.external_order_id,
              card_mode: match.card_mode,
              creation_source: match.creation_source ?? null,
              edit_pin_encrypted: match.edit_pin_encrypted ?? null,
              order: match.order ? { order_number: match.order.order_number } : null,
            },
            error: null,
          };
        },
        then(
          resolve: (value: { data: unknown; error: null }) => unknown,
          reject?: (reason: unknown) => unknown
        ) {
          try {
            let rows = cards.slice();
            if (orderIdIn) {
              rows = rows.filter((c) => orderIdIn!.includes(c.order_id));
            }
            if (cardModeFilter) {
              rows = rows.filter((c) => (c.card_mode ?? 'shared') === cardModeFilter);
            }
            return Promise.resolve({
              data: rows.map((match) => ({
                id: match.id,
                platform: match.platform,
                external_order_id: match.external_order_id,
                card_mode: match.card_mode,
                creation_source: match.creation_source ?? null,
                edit_pin_encrypted: match.edit_pin_encrypted ?? null,
                order: match.order ? { order_number: match.order.order_number } : null,
              })),
              error: null,
            }).then(resolve, reject);
          } catch (err) {
            return Promise.reject(err).then(resolve, reject);
          }
        },
      };
      return builder;
    },
  };
}

function createRevealSupabase(card: MockCard) {
  const state = { ...card };
  return {
    from(table: string) {
      if (table !== 'digital_cards') throw new Error(`unexpected ${table}`);
      return {
        select(_cols: string) {
          return {
            eq(_col: string, id: string) {
              return {
                async maybeSingle() {
                  if (id !== state.id) return { data: null, error: null };
                  return {
                    data: {
                      id: state.id,
                      edit_token: state.edit_token,
                      edit_pin_hash: state.edit_pin_hash ?? null,
                      edit_pin_encrypted: state.edit_pin_encrypted ?? null,
                      edit_pin_created_at: state.edit_pin_created_at ?? null,
                      edit_session_version: state.edit_session_version ?? 0,
                    },
                    error: null,
                  };
                },
                is(_col: string, _val: null) {
                  return {
                    select() {
                      return {
                        async maybeSingle() {
                          return { data: null, error: null };
                        },
                      };
                    },
                  };
                },
              };
            },
          };
        },
        update() {
          return {
            eq() {
              return {
                is() {
                  return {
                    select() {
                      return {
                        async maybeSingle() {
                          return { data: null, error: null };
                        },
                      };
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  };
}

describe('Admin Reveal behavior (unchanged)', () => {
  const previousKey = process.env.EDIT_PIN_ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.EDIT_PIN_ENCRYPTION_KEY = TEST_KEY;
  });

  afterEach(() => {
    if (previousKey === undefined) delete process.env.EDIT_PIN_ENCRYPTION_KEY;
    else process.env.EDIT_PIN_ENCRYPTION_KEY = previousKey;
  });

  it('Admin Reveal still decrypts persisted edit_pin_encrypted via revealEditPinForCard', async () => {
    const pin = '728046';
    const storage = buildEditPinStorage(pin);
    const card = individualCard({
      edit_pin_hash: storage.edit_pin_hash,
      edit_pin_encrypted: storage.edit_pin_encrypted,
    });
    const result = await revealEditPinForCard(card.id, createRevealSupabase(card) as never);
    expect(result.error).toBeNull();
    expect(result.pin).toBe(pin);
  });

  it('adminRevealEditPinAction still delegates to revealEditPinForCard', () => {
    const source = fs.readFileSync(path.join(ROOT, 'lib/edit-pin-actions.ts'), 'utf8');
    expect(source).toMatch(/adminRevealEditPinAction/);
    expect(source).toMatch(/revealEditPinForCard\(cardId\)/);
    expect(source).toMatch(/console\.info\('\[edit-pin\] admin reveal',\s*\{\s*cardId\s*\}\)/);
    expect(source).not.toMatch(/console\.\w+\([^)]*result\.pin/);
    expect(source).not.toMatch(/edit_pin:\s*result\.pin/);
  });
});

describe('parseEditPinLookupQuery', () => {
  it('accepts platform=shopee and valid order_id', () => {
    const parsed = parseEditPinLookupQuery(
      new URLSearchParams({ platform: 'shopee', order_id: '260814ABCD12' })
    );
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.platform).toBe('shopee');
      expect(parsed.orderId).toBe('260814ABCD12');
    }
  });

  it('rejects missing or non-automation platform', () => {
    expect(parseEditPinLookupQuery(new URLSearchParams({ order_id: '260814ABCD12' })).ok).toBe(
      false
    );
    const admin = parseEditPinLookupQuery(
      new URLSearchParams({ platform: 'admin', order_id: '260814ABCD12' })
    );
    expect(admin.ok).toBe(false);
    if (!admin.ok) {
      expect(admin.code).toBe(EDIT_PIN_LOOKUP_ERROR.INVALID_PLATFORM);
      expect(admin.httpStatus).toBe(400);
    }
  });

  it('rejects malformed order_id', () => {
    const bad = parseEditPinLookupQuery(
      new URLSearchParams({ platform: 'shopee', order_id: 'bad id' })
    );
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.code).toBe(EDIT_PIN_LOOKUP_ERROR.INVALID_ORDER_ID);
    }
  });
});

describe('lookupEditPinByPlatformOrder', () => {
  const previousKey = process.env.EDIT_PIN_ENCRYPTION_KEY;
  const pin = '728046';

  beforeEach(() => {
    process.env.EDIT_PIN_ENCRYPTION_KEY = TEST_KEY;
  });

  afterEach(() => {
    if (previousKey === undefined) delete process.env.EDIT_PIN_ENCRYPTION_KEY;
    else process.env.EDIT_PIN_ENCRYPTION_KEY = previousKey;
  });

  it('returns the already-persisted recoverable PIN for Shopee Individual', async () => {
    const storage = buildEditPinStorage(pin);
    const card = individualCard({
      edit_pin_hash: storage.edit_pin_hash,
      edit_pin_encrypted: storage.edit_pin_encrypted,
    });
    const result = await lookupEditPinByPlatformOrder(
      createLookupSupabase([card]) as never,
      'shopee',
      '260814ABCD12'
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.edit_pin).toBe(pin);
      expect(result.edit_pin).toBe(decryptEditPin(storage.edit_pin_encrypted));
      expect(result.platform).toBe('shopee');
      expect(result.order_id).toBe('260814ABCD12');
      expect(result.card_name).toBe('260814ABCD12-20260814120000');
      expect(result.matchPath).toBe('canonical');
    }
  });

  it('recovers legacy Individual cards missing external_order_id via exact order_number prefix', async () => {
    const storage = buildEditPinStorage(pin);
    const legacy = individualCard({
      id: 'bbbbbbbb-bbbb-cccc-dddd-eeeeeeeeeeee',
      platform: null,
      external_order_id: null,
      creation_source: 'automation',
      edit_pin_hash: storage.edit_pin_hash,
      edit_pin_encrypted: storage.edit_pin_encrypted,
      order: {
        id: 'ord-1',
        order_number: '260815EAUNGANW-20260815113910',
        created_at: '2026-08-15T03:39:10.000Z',
      },
    });
    const result = await lookupEditPinByPlatformOrder(
      createLookupSupabase([legacy]) as never,
      'shopee',
      '260815EAUNGANW'
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.edit_pin).toBe(pin);
      expect(result.matchPath).toBe('legacy_order_number_prefix');
      expect(result.card_name).toBe('260815EAUNGANW-20260815113910');
    }
  });

  it('fails safely when multiple legacy prefix matches exist', async () => {
    const storage = buildEditPinStorage(pin);
    const a = individualCard({
      id: '11111111-bbbb-cccc-dddd-eeeeeeeeeeee',
      platform: null,
      external_order_id: null,
      order_id: 'ord-a',
      edit_pin_encrypted: storage.edit_pin_encrypted,
      order: {
        id: 'ord-a',
        order_number: '260815EAUNGANW-20260815110000',
        created_at: '2026-08-15T03:00:00.000Z',
      },
    });
    const b = individualCard({
      id: '22222222-bbbb-cccc-dddd-eeeeeeeeeeee',
      platform: null,
      external_order_id: null,
      order_id: 'ord-b',
      edit_pin_encrypted: storage.edit_pin_encrypted,
      order: {
        id: 'ord-b',
        order_number: '260815EAUNGANW-20260815113910',
        created_at: '2026-08-15T03:39:10.000Z',
      },
    });
    const result = await lookupEditPinByPlatformOrder(
      createLookupSupabase([a, b]) as never,
      'shopee',
      '260815EAUNGANW'
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe(EDIT_PIN_LOOKUP_ERROR.CARD_NOT_FOUND);
      expect(result.httpStatus).toBe(404);
    }
  });

  it('does not regenerate or rotate the PIN (no writes / no generateEditPin)', async () => {
    const storage = buildEditPinStorage(pin);
    const card = individualCard({
      edit_pin_hash: storage.edit_pin_hash,
      edit_pin_encrypted: storage.edit_pin_encrypted,
    });
    const supabase = createLookupSupabase([card]) as never;
    const generateSpy = vi.spyOn(await import('./edit-pin'), 'generateEditPin');
    const first = await lookupEditPinByPlatformOrder(supabase, 'shopee', '260814ABCD12');
    const second = await lookupEditPinByPlatformOrder(supabase, 'shopee', '260814ABCD12');
    expect(first.ok && second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(first.edit_pin).toBe(pin);
      expect(second.edit_pin).toBe(pin);
      expect(first.edit_pin).toBe(second.edit_pin);
    }
    expect(generateSpy).not.toHaveBeenCalled();
    generateSpy.mockRestore();

    const source = fs.readFileSync(path.join(ROOT, 'lib/internal-edit-pin-lookup.ts'), 'utf8');
    expect(source).toMatch(/decryptEditPin/);
    expect(source).not.toMatch(/generateEditPin|ensureEditPinForCard|resetEditPinForCard|\.update\(|\.insert\(/);
  });

  it('returns 404 for missing order', async () => {
    const result = await lookupEditPinByPlatformOrder(
      createLookupSupabase([]) as never,
      'shopee',
      '260814MISSING'
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe(EDIT_PIN_LOOKUP_ERROR.CARD_NOT_FOUND);
      expect(result.httpStatus).toBe(404);
    }
  });

  it('does not return platform=admin cards as Shopee cards', async () => {
    const storage = buildEditPinStorage(pin);
    const adminCard = individualCard({
      platform: 'admin',
      external_order_id: null,
      creation_source: 'admin',
      edit_pin_hash: storage.edit_pin_hash,
      edit_pin_encrypted: storage.edit_pin_encrypted,
      order: {
        id: 'ord-admin',
        order_number: '260815EAUNGANW-20260815113910',
        created_at: '2026-08-14T06:00:00.000Z',
      },
    });
    const result = await lookupEditPinByPlatformOrder(
      createLookupSupabase([adminCard]) as never,
      'shopee',
      '260815EAUNGANW'
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe(EDIT_PIN_LOOKUP_ERROR.CARD_NOT_FOUND);
    }
  });

  it('safely rejects historical Shared cards', async () => {
    const storage = buildEditPinStorage(pin);
    const shared = individualCard({
      card_mode: 'shared',
      edit_pin_hash: storage.edit_pin_hash,
      edit_pin_encrypted: storage.edit_pin_encrypted,
    });
    const result = await lookupEditPinByPlatformOrder(
      createLookupSupabase([shared]) as never,
      'shopee',
      '260814ABCD12'
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe(EDIT_PIN_LOOKUP_ERROR.SHARED_CARD_NOT_SUPPORTED);
      expect(result.httpStatus).toBe(409);
    }
  });

  it('safely rejects missing encrypted PIN (nonrecoverable)', async () => {
    const card = individualCard({
      edit_pin_hash: hashEditPin(pin),
      edit_pin_encrypted: null,
    });
    const result = await lookupEditPinByPlatformOrder(
      createLookupSupabase([card]) as never,
      'shopee',
      '260814ABCD12'
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe(EDIT_PIN_LOOKUP_ERROR.EDIT_PIN_NOT_AVAILABLE);
      expect(result.httpStatus).toBe(422);
    }
  });

  it('safely rejects decrypt failure / invalid ciphertext', async () => {
    const card = individualCard({
      edit_pin_encrypted: 'v1:dead:beef:cafe',
      edit_pin_hash: hashEditPin(pin),
    });
    const result = await lookupEditPinByPlatformOrder(
      createLookupSupabase([card]) as never,
      'shopee',
      '260814ABCD12'
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe(EDIT_PIN_LOOKUP_ERROR.EDIT_PIN_DECRYPT_FAILED);
    }
  });

  it('response body is minimal and excludes secrets', () => {
    const body = buildEditPinLookupResponseBody({
      ok: true,
      platform: 'shopee',
      order_id: '260814ABCD12',
      card_name: '260814ABCD12-20260814120000',
      edit_pin: pin,
      cardId: 'aaaaaaaa',
      matchPath: 'canonical',
    });
    expect(body).toEqual({
      platform: 'shopee',
      order_id: '260814ABCD12',
      card_name: '260814ABCD12-20260814120000',
      edit_pin: pin,
    });
    const serialized = JSON.stringify(body);
    expect(serialized).not.toMatch(/edit_token|public_token|view_token|edit_pin_hash|recipient/);
    expect(serialized).not.toMatch(/buyer_edit_url|view_url|photo_path/);
  });

  it('safe logs never include plaintext PIN or tokens', () => {
    const okLog = buildEditPinLookupLogFields(
      {
        ok: true,
        platform: 'shopee',
        order_id: '260814ABCD12',
        card_name: 'x',
        edit_pin: pin,
        cardId: 'aaaaaaaa',
        matchPath: 'canonical',
      },
      'shopee',
      '260814ABCD12'
    );
    const failLog = buildEditPinLookupLogFields(
      {
        ok: false,
        code: EDIT_PIN_LOOKUP_ERROR.CARD_NOT_FOUND,
        message: 'Card not found',
        httpStatus: 404,
      },
      'shopee',
      '260814ABCD12'
    );
    const joined = JSON.stringify({ okLog, failLog });
    expect(joined).not.toContain(pin);
    expect(joined).not.toMatch(/edit_token|edit_pin":/);
    expect(okLog).toMatchObject({
      platform: 'shopee',
      order_id: '260814ABCD12',
      card_id: 'aaaaaaaa',
      ok: true,
    });
  });
});

describe('Edit PIN does not leak into other automation APIs', () => {
  it('create API Individual response contains no plaintext PIN', () => {
    const response = buildIndividualInternalCardResponse({
      status: 'created',
      platform: 'shopee',
      orderId: '260814ABCD12',
      card: individualCard({
        edit_pin_hash: 'salt:hash',
        edit_pin_encrypted: 'v1:iv:tag:data',
      }),
      recipients: [recipient(1), recipient(2)],
      siteOrigin: 'https://hommly.online',
    });
    const serialized = JSON.stringify(response);
    expect(serialized).not.toMatch(/edit_pin|728046|edit_pin_hash|edit_pin_encrypted/);
    expect(serialized).toMatch(/buyer_edit_url/);
    expect(serialized).toMatch(/recipients/);
  });

  it('pending Admin automation API builders contain no plaintext PIN', () => {
    const pending = fs.readFileSync(
      path.join(ROOT, 'lib/internal-pending-automation-api.ts'),
      'utf8'
    );
    expect(pending).toMatch(/buildIndividualInternalCardResponse/);
    expect(pending).not.toMatch(/edit_pin|decryptEditPin|revealEditPin/);
  });

  it('no broad RLS changes for Edit PIN lookup', () => {
    const migrations = fs.readdirSync(path.join(ROOT, 'supabase/migrations'));
    for (const file of migrations) {
      if (!file.includes('edit_pin') && !file.includes('automation')) continue;
      const sql = fs.readFileSync(path.join(ROOT, 'supabase/migrations', file), 'utf8');
      expect(sql).not.toMatch(/CREATE POLICY[\s\S]*edit_pin/i);
      expect(sql).not.toMatch(/GRANT[\s\S]*edit_pin/i);
    }
    const lookup = fs.readFileSync(path.join(ROOT, 'lib/internal-edit-pin-lookup.ts'), 'utf8');
    expect(lookup).not.toMatch(/CREATE POLICY|ENABLE ROW LEVEL SECURITY/);
  });
});

describe('edit-pin route wiring', () => {
  it('registers GET with AUTOMATION_SECRET auth and uses read-only lookup', () => {
    const route = fs.readFileSync(
      path.join(ROOT, 'app/api/internal/cards/edit-pin/route.ts'),
      'utf8'
    );
    expect(route).toMatch(/verifyInternalAutomationRequest/);
    expect(route).toMatch(/unauthorizedAutomationResponse/);
    expect(route).toMatch(/lookupEditPinByPlatformOrder/);
    expect(route).toMatch(/parseEditPinLookupQuery/);
    expect(route).toMatch(/export async function GET/);
    expect(route).not.toMatch(/generateEditPin|ensureEditPinForCard|resetEditPinForCard/);
    expect(route).toMatch(/buildEditPinLookupLogFields/);
  });

  it('auth helpers still return 401 for missing/wrong bearer', async () => {
    const { verifyAutomationRequest } = await import('./automation-auth');
    const original = process.env.AUTOMATION_SECRET;
    process.env.AUTOMATION_SECRET = 'expected-secret';
    try {
      expect(verifyAutomationRequest(null).ok).toBe(false);
      expect(verifyAutomationRequest('Bearer wrong').ok).toBe(false);
      expect(verifyAutomationRequest('Bearer expected-secret').ok).toBe(true);
    } finally {
      if (original === undefined) delete process.env.AUTOMATION_SECRET;
      else process.env.AUTOMATION_SECRET = original;
    }

    const route = fs.readFileSync(
      path.join(ROOT, 'app/api/internal/cards/edit-pin/route.ts'),
      'utf8'
    );
    expect(route).toMatch(/if \(!auth\.ok\)/);
    expect(route).toMatch(/unauthorizedAutomationResponse/);
  });
});
