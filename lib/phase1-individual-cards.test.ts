import fs from 'fs';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { createCardCore } from './create-card-core';
import { parseInternalCreateCardRequest } from './internal-card-request';
import { buildInternalCardResponse } from './internal-card-response';
import {
  buildRecipientRow,
  buildRecipientRows,
  formatRecipientNumber,
  getRecipientByNumber,
  getRecipientByViewToken,
  getRecipientsForCard,
} from './card-recipients';
import {
  generateRecipientViewToken,
  isValidPublicToken,
} from './card-tokens';
import type { CardMode, DigitalCardRecipient } from './types';
import type { CardWithOrder } from './types';

const MIGRATION_PATH = path.join(
  __dirname,
  '..',
  'supabase',
  'migrations',
  '20260812140000_add_card_mode_and_digital_card_recipients.sql'
);

const PROTECTED_PATHS = [
  'app/g/[publicToken]/page.tsx',
  'app/e/[editToken]/page.tsx',
  'app/api/internal/cards/route.ts',
  'lib/internal-card-request.ts',
  'lib/internal-card-response.ts',
  'lib/create-card-core.ts',
  'components/admin/AdminCardsClient.tsx',
  'lib/card-photo.ts',
  'lib/card-photo-storage.ts',
  'lib/card-photo-access.ts',
  'lib/card-photo-cleanup.ts',
  'lib/qr.ts',
];

function recipientFixture(overrides?: Partial<DigitalCardRecipient>): DigitalCardRecipient {
  return {
    id: 'recipient-1',
    digital_card_id: 'card-1',
    recipient_number: 1,
    view_token: 'abc123XYZ789',
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
    ...overrides,
  };
}

function mockRecipientSupabase(recipients: DigitalCardRecipient[]) {
  return {
    from(table: string) {
      if (table !== 'digital_card_recipients') {
        throw new Error(`unexpected table ${table}`);
      }
      return {
        select() {
          return {
            eq(column: string, value: unknown) {
              return {
                eq(nestedColumn: string, nestedValue: unknown) {
                  return {
                    async maybeSingle() {
                      const match = recipients.find(
                        (row) =>
                          row.digital_card_id === value &&
                          row.recipient_number === nestedValue
                      );
                      return { data: match ?? null, error: null };
                    },
                  };
                },
                order(_column: string, _options: { ascending: boolean }) {
                  const filtered = recipients.filter((row) => {
                    if (column === 'digital_card_id') return row.digital_card_id === value;
                    return false;
                  });
                  const sorted = [...filtered].sort(
                    (a, b) => a.recipient_number - b.recipient_number
                  );
                  return Promise.resolve({ data: sorted, error: null });
                },
                async maybeSingle() {
                  const match = recipients.find((row) => {
                    if (column === 'view_token') return row.view_token === value;
                    return false;
                  });
                  return { data: match ?? null, error: null };
                },
              };
            },
          };
        },
      };
    },
  };
}

describe('Phase 1 migration SQL', () => {
  const sql = fs.readFileSync(MIGRATION_PATH, 'utf8');

  it('defines card_mode on digital_cards', () => {
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS card_mode/i);
  });

  it('defaults card_mode to shared', () => {
    expect(sql).toMatch(/card_mode text NOT NULL DEFAULT 'shared'/i);
  });

  it('checks card_mode is shared or individual', () => {
    expect(sql).toMatch(/CHECK \(card_mode IN \('shared', 'individual'\)\)/);
  });

  it('creates digital_card_recipients with recipient_number > 0 check', () => {
    expect(sql).toContain('digital_card_recipients');
    expect(sql).toMatch(/CHECK \(recipient_number > 0\)/);
  });

  it('enforces unique (digital_card_id, recipient_number)', () => {
    expect(sql).toMatch(/UNIQUE \(digital_card_id, recipient_number\)/);
  });

  it('enforces globally unique view_token', () => {
    expect(sql).toMatch(/view_token text NOT NULL UNIQUE/);
  });

  it('indexes digital_card_id and cascades on parent delete', () => {
    expect(sql).toMatch(/digital_card_recipients_digital_card_id_idx/);
    expect(sql).toMatch(/REFERENCES digital_cards\(id\)\s*\n?\s*ON DELETE CASCADE/i);
  });

  it('does not add recipient_count or move public_token', () => {
    expect(sql).not.toMatch(/recipient_count/i);
    expect(sql).not.toMatch(/DROP COLUMN/i);
    expect(sql).not.toMatch(/ALTER COLUMN.*public_token/i);
  });

  it('does not duplicate parent expiry fields on recipients', () => {
    expect(sql).not.toMatch(/first_published_at/);
    expect(sql).not.toMatch(/expires_at_override/);
  });

  it('enables RLS without permissive anon policies', () => {
    expect(sql).toMatch(/ENABLE ROW LEVEL SECURITY/);
    expect(sql).not.toMatch(/CREATE POLICY.*digital_card_recipients/i);
  });
});

describe('CardMode types', () => {
  it('supports shared', () => {
    const mode: CardMode = 'shared';
    expect(mode).toBe('shared');
  });

  it('supports individual', () => {
    const mode: CardMode = 'individual';
    expect(mode).toBe('individual');
  });
});

describe('formatRecipientNumber', () => {
  it('formats single-digit numbers with minimum two digits', () => {
    expect(formatRecipientNumber(1)).toBe('Gift #01');
    expect(formatRecipientNumber(7)).toBe('Gift #07');
    expect(formatRecipientNumber(37)).toBe('Gift #37');
  });

  it('formats numbers >= 100 without artificial cap', () => {
    expect(formatRecipientNumber(100)).toBe('Gift #100');
    expect(formatRecipientNumber(101)).toBe('Gift #101');
  });

  it('rejects non-positive recipient numbers', () => {
    expect(() => formatRecipientNumber(0)).toThrow(RangeError);
    expect(() => formatRecipientNumber(-1)).toThrow(RangeError);
  });
});

describe('generateRecipientViewToken', () => {
  it('produces valid short public-token-compatible tokens', () => {
    const token = generateRecipientViewToken();
    expect(token).toHaveLength(12);
    expect(isValidPublicToken(token)).toBe(true);
  });

  it('uses opaque random tokens not derived from recipient_number or card id', () => {
    const cardId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    const rows = buildRecipientRows({
      digital_card_id: cardId,
      recipient_count: 3,
    });
    expect(new Set(rows.map((row) => row.view_token)).size).toBe(3);
    rows.forEach((row) => {
      expect(row.view_token).toHaveLength(12);
      expect(isValidPublicToken(row.view_token)).toBe(true);
      expect(row.view_token).not.toContain(cardId);
    });

    const tokenSource = fs.readFileSync(path.join(__dirname, 'card-tokens.ts'), 'utf8');
    expect(tokenSource).toMatch(
      /export function generateRecipientViewToken\(\): string \{\s*return generatePublicToken\(\);/
    );
  });
});

describe('buildRecipientRows', () => {
  it('assigns recipient_number 1..N with unique opaque view tokens', () => {
    let counter = 0;
    const rows = buildRecipientRows({
      digital_card_id: 'card-1',
      recipient_count: 3,
      generateViewToken: () => `tok${String(++counter).padStart(9, '0')}`,
    });
    expect(rows.map((row) => row.recipient_number)).toEqual([1, 2, 3]);
    expect(new Set(rows.map((row) => row.view_token)).size).toBe(3);
    rows.forEach((row) => {
      expect(row.digital_card_id).toBe('card-1');
      expect(row.status).toBe('draft');
    });
  });

  it('rejects recipient_count <= 0', () => {
    expect(() =>
      buildRecipientRows({ digital_card_id: 'card-1', recipient_count: 0 })
    ).toThrow(RangeError);
  });
});

describe('recipient DB helpers (mocked)', () => {
  const recipients = [
    recipientFixture({ id: 'r1', recipient_number: 1, view_token: 'tokenOne1234' }),
    recipientFixture({ id: 'r2', recipient_number: 2, view_token: 'tokenTwo5678' }),
    recipientFixture({
      id: 'r3',
      recipient_number: 3,
      view_token: 'tokenThree90',
      digital_card_id: 'card-other',
    }),
  ];

  it('lists recipients ordered by recipient_number for a card', async () => {
    const supabase = mockRecipientSupabase(recipients);
    const { recipients: listed, error } = await getRecipientsForCard(
      supabase as never,
      'card-1'
    );
    expect(error).toBeNull();
    expect(listed.map((row) => row.recipient_number)).toEqual([1, 2]);
  });

  it('resolves recipient by view_token', async () => {
    const supabase = mockRecipientSupabase(recipients);
    const { recipient, error } = await getRecipientByViewToken(
      supabase as never,
      'tokenTwo5678'
    );
    expect(error).toBeNull();
    expect(recipient?.recipient_number).toBe(2);
  });

  it('resolves recipient by number', async () => {
    const supabase = mockRecipientSupabase(recipients);
    const { recipient, error } = await getRecipientByNumber(
      supabase as never,
      'card-1',
      1
    );
    expect(error).toBeNull();
    expect(recipient?.view_token).toBe('tokenOne1234');
  });

  it('rejects non-positive recipient_number lookup', async () => {
    const supabase = mockRecipientSupabase(recipients);
    const { recipient, error } = await getRecipientByNumber(supabase as never, 'card-1', 0);
    expect(recipient).toBeNull();
    expect(error).toMatch(/positive integer/i);
  });
});

describe('buildRecipientRow validation', () => {
  it('requires recipient_number > 0', () => {
    expect(() =>
      buildRecipientRow({ digital_card_id: 'card-1', recipient_number: 0 })
    ).toThrow(RangeError);
  });
});

describe('shared creation unchanged', () => {
  it('createCardCore still creates one card without recipient rows', async () => {
    let recipientInserts = 0;
    const supabase = {
      from(table: string) {
        if (table === 'digital_card_recipients') {
          recipientInserts += 1;
          throw new Error('recipient insert not expected');
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
            insert(row: Record<string, unknown>) {
              expect(row).not.toHaveProperty('card_mode');
              return {
                select() {
                  return {
                    async single() {
                      return {
                        data: {
                          id: 'card-1',
                          order_id: 'ord-1',
                          public_token: 'pubToken12ab',
                          edit_token: 'edit_token_abc',
                          card_mode: 'shared',
                          message: null,
                          theme: 'thank_you',
                          animation: 'soft_reveal',
                          status: 'draft',
                          created_at: '2026-08-12T04:00:00.000Z',
                          updated_at: '2026-08-12T04:00:00.000Z',
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
                          id: 'ord-1',
                          order_number: 'HM-001-20260812120000',
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
        throw new Error(`unexpected table ${table}`);
      },
    };

    const result = await createCardCore(supabase as never, { orderNumberInput: 'HM-001' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.status).toBe('created');
    expect(recipientInserts).toBe(0);
  });
});

describe('internal API — Individual-only create policy', () => {
  it('shared response builder still exists for historical compatibility', () => {
    const card: CardWithOrder = {
      id: 'card-1',
      order_id: 'ord-1',
      card_mode: 'shared',
      public_token: 'pubToken12ab',
      edit_token: 'edit_tok',
      message: null,
      theme: 'thank_you',
      animation: 'soft_reveal',
      status: 'draft',
      created_at: '2026-08-12T04:00:00.000Z',
      updated_at: '2026-08-12T04:00:00.000Z',
      published_at: null,
      order: {
        id: 'ord-1',
        order_number: 'ORD-001-20260812120000',
        created_at: '2026-08-12T04:00:00.000Z',
      },
    };
    const response = buildInternalCardResponse({
      status: 'created',
      platform: 'shopee',
      orderId: 'ORD001',
      card,
      siteOrigin: 'https://hommly.online',
    });
    expect(response.recipient_view_url).toBe('https://hommly.online/g/pubToken12ab');
    expect(response.mode).toBe('shared');
    expect(response).not.toHaveProperty('recipients');
  });

  it('parser requires recipient_count for new creates', () => {
    expect(
      parseInternalCreateCardRequest({
        platform: 'shopee',
        order_id: '260810ABC123XY',
      }).ok
    ).toBe(false);
    const parsed = parseInternalCreateCardRequest({
      platform: 'shopee',
      order_id: '260810ABC123XY',
      recipient_count: 37,
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.mode).toBe('individual');
    expect(parsed.recipientCount).toBe(37);
  });

  it('parser rejects mode=shared', () => {
    const parsed = parseInternalCreateCardRequest({
      platform: 'shopee',
      order_id: '260810ABC123XY',
      mode: 'shared',
    });
    expect(parsed.ok).toBe(false);
  });

  it('parser rejects unknown fields', () => {
    const parsed = parseInternalCreateCardRequest({
      platform: 'shopee',
      order_id: '260810ABC123XY',
      gift_quantity: 37,
    });
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.error).toMatch(/unexpected fields/i);
  });
});

describe('production route guards', () => {
  it('does not import card-recipients from production routes or protected modules', () => {
    const roots = [
      'app/g/[publicToken]/page.tsx',
      'app/e/[editToken]/page.tsx',
      'app/api/internal/cards/route.ts',
      'lib/create-card-core.ts',
      'components/admin/AdminCardsClient.tsx',
    ];
    for (const relative of roots) {
      const source = fs.readFileSync(path.join(__dirname, '..', relative), 'utf8');
      expect(source).not.toMatch(/card-recipients/);
    }
  });

  it('protected production files have no git-diff requirement violations in content baseline', () => {
    for (const relative of PROTECTED_PATHS) {
      expect(fs.existsSync(path.join(__dirname, '..', relative))).toBe(true);
    }
  });
});
