import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { formatRecipientNumber } from './card-recipients';
import {
  buildIndividualEditPageContext,
} from './edit-page-loader';
import {
  assertSafeManagerItem,
  clearRecipientSelection,
  computeRecipientStatusCounts,
  filterRecipientsByUiStatus,
  getPersonaliseActionLabel,
  getPublishedProgressPercent,
  getRecipientPersonalisationStatus,
  getSelectedRecipientNumbers,
  selectAllRecipientIds,
  setSingleRecipientSelection,
  sortRecipientsByNumber,
  toIndividualRecipientManagerItem,
  toggleRecipientSelection,
  type IndividualRecipientManagerItem,
} from './individual-recipient-manager';
import { createCardCore } from './create-card-core';
import { parseInternalCreateCardRequest } from './internal-card-request';
import { isParentLifecycleExpired } from './recipient-view-resolver';
import type { CardWithOrder, DigitalCardRecipient } from './types';

const ROOT = path.join(__dirname, '..');

function item(
  number: number,
  overrides?: Partial<IndividualRecipientManagerItem>
): IndividualRecipientManagerItem {
  return {
    id: `recipient-${number}`,
    recipient_number: number,
    status: 'draft',
    has_message: false,
    has_photo: false,
    has_sender_links: false,
    view_pin_enabled: false,
    ...overrides,
  };
}

function dbRecipient(number: number, overrides?: Partial<DigitalCardRecipient>): DigitalCardRecipient {
  return {
    id: `recipient-${number}`,
    digital_card_id: 'card-ind-1',
    recipient_number: number,
    view_token: `viewToken${number}`.padEnd(12, '0').slice(0, 12),
    message: null,
    theme: 'thank_you',
    animation: 'soft_reveal',
    show_sender_links: false,
    sender_links: null,
    view_pin_enabled: false,
    view_pin_hash: 'secret-hash',
    photo_path: 'cards/card-ind-1/recipients/r1/photo.webp',
    photo_original_name: null,
    photo_mime_type: null,
    photo_size_bytes: null,
    photo_uploaded_at: null,
    status: 'draft',
    published_at: null,
    created_at: '2026-08-12T06:00:00.000Z',
    updated_at: '2026-08-12T06:00:00.000Z',
    ...overrides,
  };
}

describe('getRecipientPersonalisationStatus', () => {
  it('derives Not started correctly', () => {
    expect(getRecipientPersonalisationStatus(item(1))).toBe('not_started');
  });

  it('derives Draft correctly', () => {
    expect(getRecipientPersonalisationStatus(item(2, { has_message: true }))).toBe('draft');
    expect(getRecipientPersonalisationStatus(item(3, { view_pin_enabled: true }))).toBe('draft');
  });

  it('derives Published correctly', () => {
    expect(getRecipientPersonalisationStatus(item(4, { status: 'published' }))).toBe('published');
  });
});

describe('recipient manager counts and progress', () => {
  it('status counts sum to total', () => {
    const items = [
      item(1, { status: 'published' }),
      item(2, { has_message: true }),
      item(3),
      item(4, { status: 'published' }),
    ];
    const counts = computeRecipientStatusCounts(items);
    expect(counts.published_count + counts.draft_count + counts.not_started_count).toBe(
      counts.total_count
    );
    expect(counts.total_count).toBe(4);
    expect(counts.published_count).toBe(2);
    expect(counts.draft_count).toBe(1);
    expect(counts.not_started_count).toBe(1);
  });

  it('published progress is correct', () => {
    const counts = computeRecipientStatusCounts([
      item(1, { status: 'published' }),
      item(2),
      item(3, { status: 'published' }),
    ]);
    expect(getPublishedProgressPercent(counts)).toBe(67);
  });
});

describe('recipient labels and ordering', () => {
  it('formats Gift #01 and Gift #37', () => {
    expect(formatRecipientNumber(1)).toBe('Gift #01');
    expect(formatRecipientNumber(37)).toBe('Gift #37');
  });

  it('orders recipients by number', () => {
    const sorted = sortRecipientsByNumber([item(3), item(1), item(2)]);
    expect(sorted.map((row) => row.recipient_number)).toEqual([1, 2, 3]);
  });
});

describe('selection helpers', () => {
  const items = [item(1), item(2), item(3)];

  it('selects one recipient', () => {
    const selected = setSingleRecipientSelection(items[0]!.id);
    expect([...selected]).toEqual(['recipient-1']);
  });

  it('selects multiple recipients', () => {
    let selected = toggleRecipientSelection(new Set(), items[0]!.id);
    selected = toggleRecipientSelection(selected, items[2]!.id);
    expect([...selected]).toEqual(['recipient-1', 'recipient-3']);
  });

  it('selects all recipients', () => {
    const selected = selectAllRecipientIds(items);
    expect(selected.size).toBe(3);
  });

  it('clears selection', () => {
    expect(clearRecipientSelection().size).toBe(0);
  });

  it('selection survives filter changes', () => {
    const selected = setSingleRecipientSelection(items[0]!.id);
    const draftOnly = filterRecipientsByUiStatus(items, 'draft');
    expect(draftOnly).toHaveLength(0);
    expect(selected.has(items[0]!.id)).toBe(true);
  });

  it('Edit selects exactly one recipient', () => {
    const selected = setSingleRecipientSelection(items[1]!.id);
    expect(selected.size).toBe(1);
    expect([...selected][0]).toBe('recipient-2');
  });

  it('Personalise Selected placeholder uses selected numbers', () => {
    const selected = new Set([items[0]!.id, items[2]!.id]);
    expect(getSelectedRecipientNumbers(selected, items)).toEqual([1, 3]);
    expect(getPersonaliseActionLabel(2, 3)).toBe('Personalise Selected');
    expect(getPersonaliseActionLabel(3, 3)).toBe('Personalise All Gifts');
  });
});

describe('filters', () => {
  const items = [
    item(1, { status: 'published' }),
    item(2, { has_message: true }),
    item(3),
  ];

  it('filters All', () => {
    expect(filterRecipientsByUiStatus(items, 'all')).toHaveLength(3);
  });

  it('filters Not started', () => {
    expect(filterRecipientsByUiStatus(items, 'not_started').map((row) => row.recipient_number)).toEqual([
      3,
    ]);
  });

  it('filters Draft', () => {
    expect(filterRecipientsByUiStatus(items, 'draft').map((row) => row.recipient_number)).toEqual([2]);
  });

  it('filters Published', () => {
    expect(filterRecipientsByUiStatus(items, 'published').map((row) => row.recipient_number)).toEqual([
      1,
    ]);
  });
});

describe('safe DTO mapping', () => {
  it('does not expose view_pin_hash, photo_path, or message text', () => {
    const dto = toIndividualRecipientManagerItem(
      dbRecipient(1, {
        message: 'Secret message',
        photo_path: 'cards/secret.webp',
        view_pin_hash: 'hash-value',
        view_token: 'secretToken1',
      })
    );
    expect(dto.has_message).toBe(true);
    expect(dto.has_photo).toBe(true);
    assertSafeManagerItem(dto);
    expect(Object.keys(dto)).toEqual([
      'id',
      'recipient_number',
      'status',
      'has_message',
      'has_photo',
      'has_sender_links',
      'view_pin_enabled',
    ]);
  });
});

describe('edit page mode routing', () => {
  it('Shared card routes to SharedCardEditor', () => {
    const source = fs.readFileSync(path.join(ROOT, 'app/e/[editToken]/page.tsx'), 'utf8');
    expect(source).toMatch(/SharedCardEditor/);
    expect(source).toMatch(/context\.kind === 'individual'/);
    expect(source).toMatch(/return <SharedCardEditor editToken=\{context\.editToken\} \/>/);
  });

  it('Individual card routes to Recipient Manager', () => {
    const source = fs.readFileSync(path.join(ROOT, 'app/e/[editToken]/page.tsx'), 'utf8');
    expect(source).toMatch(/IndividualRecipientManager/);
    expect(source).toMatch(/editToken=\{params\.editToken\}/);
    expect(source).toMatch(/context\.kind === 'individual'/);
  });

  it('Shared editor component does not import Individual manager', () => {
    const source = fs.readFileSync(path.join(ROOT, 'components/card/SharedCardEditor.tsx'), 'utf8');
    expect(source).not.toMatch(/IndividualRecipientManager/);
    expect(source).toMatch(/Customize Your Surprise/);
  });

  it('Individual manager does not import Shared editor', () => {
    const source = fs.readFileSync(
      path.join(ROOT, 'components/individual/IndividualRecipientManager.tsx'),
      'utf8'
    );
    expect(source).not.toMatch(/SharedCardEditor/);
    expect(source).toMatch(/Personalise Your Gifts/);
  });

  it('loads recipients server-side via edit-page-loader', () => {
    const loader = fs.readFileSync(path.join(ROOT, 'lib/edit-page-loader.ts'), 'utf8');
    expect(loader).toMatch(/getSupabaseAdmin/);
    expect(loader).toMatch(/getRecipientsForCard/);
    expect(loader).not.toMatch(/createBrowserSupabase/);
  });
});

describe('buildIndividualEditPageContext', () => {
  function individualCard(overrides?: Partial<CardWithOrder>): CardWithOrder {
    return {
      id: 'card-ind',
      order_id: 'ord-ind',
      card_mode: 'individual',
      public_token: 'publicToken1',
      edit_token: 'edit-ind-token',
      message: null,
      theme: 'thank_you',
      animation: 'soft_reveal',
      status: 'draft',
      created_at: '2026-08-12T06:00:00.000Z',
      updated_at: '2026-08-12T06:00:00.000Z',
      published_at: null,
      first_published_at: null,
      order: {
        id: 'ord-ind',
        order_number: 'IND-001',
        created_at: '2026-08-12T06:00:00.000Z',
      },
      ...overrides,
    };
  }

  it('returns individual_load_error for zero recipients', () => {
    const result = buildIndividualEditPageContext(individualCard(), []);
    expect(result.kind).toBe('individual_load_error');
  });

  it('returns safe individual context for recipients on same card only', () => {
    const result = buildIndividualEditPageContext(individualCard(), [
      dbRecipient(1, { digital_card_id: 'card-ind' }),
      dbRecipient(2, { digital_card_id: 'card-ind' }),
    ]);
    expect(result.kind).toBe('individual');
    if (result.kind !== 'individual') return;
    expect(result.recipients).toHaveLength(2);
    expect(result.recipients[0]!.recipient_number).toBe(1);
    for (const row of result.recipients) {
      assertSafeManagerItem(row);
    }
  });

  it('blocks expired individual parent before manager render', () => {
    const result = buildIndividualEditPageContext(
      individualCard({ first_published_at: '2020-01-01T00:00:00.000Z' }),
      [dbRecipient(1)]
    );
    expect(result.kind).toBe('expired');
  });
});

describe('expired individual parent blocks manager', () => {
  it('uses parent lifecycle expiry for individual cards', () => {
    const card: CardWithOrder = {
      id: 'card-ind',
      order_id: 'ord-ind',
      card_mode: 'individual',
      public_token: 'publicToken1',
      edit_token: 'edit-ind-token',
      message: null,
      theme: 'thank_you',
      animation: 'soft_reveal',
      status: 'draft',
      created_at: '2026-08-12T06:00:00.000Z',
      updated_at: '2026-08-12T06:00:00.000Z',
      published_at: null,
      first_published_at: '2020-01-01T00:00:00.000Z',
      expires_at_override: null,
      order: {
        id: 'ord-ind',
        order_number: 'IND-001',
        created_at: '2026-08-12T06:00:00.000Z',
      },
    };
    expect(isParentLifecycleExpired(card)).toBe(true);
  });
});

describe('Phase 4A production guards', () => {
  it('Individual manager has no recipient content mutation', () => {
    const files = [
      'components/individual/IndividualRecipientManager.tsx',
      'components/individual/RecipientManagerRow.tsx',
      'lib/edit-page-loader.ts',
      'lib/individual-recipient-manager.ts',
    ];
    for (const relative of files) {
      const source = fs.readFileSync(path.join(ROOT, relative), 'utf8');
      expect(source).not.toMatch(/digital_card_recipients[\s\S]*\.update/);
      expect(source).not.toMatch(/\.update\([\s\S]*message/);
    }
  });

  it('no broad recipient RLS policy added', () => {
    const migration = fs.readFileSync(
      path.join(
        ROOT,
        'supabase/migrations/20260812140000_add_card_mode_and_digital_card_recipients.sql'
      ),
      'utf8'
    );
    expect(migration).toMatch(/ENABLE ROW LEVEL SECURITY/);
    expect(migration).not.toMatch(/CREATE POLICY[\s\S]*digital_card_recipients/);
  });

  it('normal Admin Shared create UI unchanged', () => {
    const source = fs.readFileSync(path.join(ROOT, 'components/admin/AdminCardsClient.tsx'), 'utf8');
    expect(source).toMatch(/createCard\(/);
    expect(source).not.toMatch(/IndividualRecipientManager/);
  });

  it('automation API still rejects mode and recipient_count', () => {
    expect(
      parseInternalCreateCardRequest({
        platform: 'shopee',
        order_id: '260810ABC123XY',
        mode: 'individual',
      }).ok
    ).toBe(false);
    expect(
      parseInternalCreateCardRequest({
        platform: 'shopee',
        order_id: '260810ABC123XY',
        recipient_count: 3,
      }).ok
    ).toBe(false);
  });

  it('Shared createCardCore still creates zero recipients', async () => {
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

  it('hidden admin test tool remains available', () => {
    expect(fs.existsSync(path.join(ROOT, 'app/admin/(protected)/cards/individual-test/page.tsx'))).toBe(
      true
    );
  });
});
