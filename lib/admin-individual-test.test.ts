import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import {
  createIndividualCardCore,
  verifyRecipientNumbering,
} from './create-individual-card-core';
import { createCardCore } from './create-card-core';
import { adminPublishIndividualRecipientCore } from './admin-individual-recipient-publish';
import { formatRecipientNumber } from './card-recipients';
import { buildRecipientViewUrl } from './individual-card-urls';
import { parseInternalCreateCardRequest } from './internal-card-request';
import {
  resolveRecipientViewToken,
} from './recipient-view-resolver';
import type { CardWithOrder, DigitalCardRecipient } from './types';

const ROOT = path.join(__dirname, '..');

function individualCardFixture(overrides?: Partial<CardWithOrder>): CardWithOrder {
  return {
    id: 'card-ind-1',
    order_id: 'ord-ind-1',
    card_mode: 'individual',
    platform: null,
    external_order_id: null,
    public_token: 'parentCompatTok',
    edit_token: 'edit-ind-1',
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
    first_published_at: null,
    order: {
      id: 'ord-ind-1',
      order_number: 'TEST-INDIVIDUAL-001',
      created_at: '2026-08-12T06:00:00.000Z',
    },
    ...overrides,
  };
}

function recipientFixture(
  cardId: string,
  number: number,
  overrides?: Partial<DigitalCardRecipient>
): DigitalCardRecipient {
  return {
    id: `recipient-${number}`,
    digital_card_id: cardId,
    recipient_number: number,
    view_token: `viewToken${number}`,
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
    created_at: '2026-08-12T06:00:00.000Z',
    updated_at: '2026-08-12T06:00:00.000Z',
    ...overrides,
  };
}

type PublishMockState = {
  cards: CardWithOrder[];
  recipients: DigitalCardRecipient[];
};

function createPublishMockSupabase(initial: PublishMockState) {
  const state: PublishMockState = {
    cards: initial.cards.map((card) => ({ ...card, order: { ...card.order } })),
    recipients: initial.recipients.map((recipient) => ({ ...recipient })),
  };

  const supabase = {
    from(table: string) {
      if (table === 'digital_cards') {
        return {
          select(_columns: string) {
            return {
              eq(column: string, value: unknown) {
                return {
                  async maybeSingle() {
                    const card = state.cards.find((row) => row[column as keyof CardWithOrder] === value);
                    return { data: card ?? null, error: null };
                  },
                  async single() {
                    const card = state.cards.find((row) => row[column as keyof CardWithOrder] === value);
                    if (!card) return { data: null, error: { message: 'not found' } };
                    return { data: card, error: null };
                  },
                };
              },
            };
          },
          update(patch: Record<string, unknown>) {
            return {
              eq(column: string, value: unknown) {
                return {
                  select(_columns: string) {
                    return {
                      async single() {
                        const card = state.cards.find((row) => row[column as keyof CardWithOrder] === value);
                        if (!card) return { data: null, error: { message: 'not found' } };
                        Object.assign(card, patch);
                        return { data: card, error: null };
                      },
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
                return {
                  async maybeSingle() {
                    const recipient = state.recipients.find(
                      (row) => row[column as keyof DigitalCardRecipient] === value
                    );
                    return { data: recipient ?? null, error: null };
                  },
                };
              },
            };
          },
          update(patch: Record<string, unknown>) {
            return {
              eq(column: string, value: unknown) {
                const filters: Array<[string, unknown]> = [[column, value]];
                return {
                  eq(column2: string, value2: unknown) {
                    filters.push([column2, value2]);
                    return {
                      select(_columns: string) {
                        return {
                          async single() {
                            const recipient = state.recipients.find((row) =>
                              filters.every(
                                ([key, filterValue]) =>
                                  row[key as keyof DigitalCardRecipient] === filterValue
                              )
                            );
                            if (!recipient) {
                              return { data: null, error: { message: 'not found' } };
                            }
                            Object.assign(recipient, patch);
                            return { data: recipient, error: null };
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

      throw new Error(`unexpected table ${table}`);
    },
    _state: state,
  };

  return supabase;
}

function createIndividualMockSupabase() {
  const orders: Array<{ id: string; order_number: string; created_at: string }> = [];
  const cards: Array<Record<string, unknown>> = [];
  const recipients: DigitalCardRecipient[] = [];
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
                    const order = {
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
            return {
              select() {
                return {
                  async single() {
                    const card = {
                      id: `card-${nextId++}`,
                      order_id: row.order_id,
                      card_mode: row.card_mode ?? 'individual',
                      public_token: row.public_token,
                      edit_token: row.edit_token,
                      platform: row.platform ?? null,
                      external_order_id: row.external_order_id ?? null,
                      status: 'draft',
                      theme: 'thank_you',
                      animation: 'soft_reveal',
                      message: null,
                      created_at: '2026-08-12T06:00:00.000Z',
                      updated_at: '2026-08-12T06:00:00.000Z',
                      published_at: null,
                      first_published_at: null,
                    };
                    cards.push(card);
                    return { data: card, error: null };
                  },
                };
              },
            };
          },
        };
      }

      if (table === 'digital_card_recipients') {
        return {
          select() {
            return {
              eq(_column: string, cardId: unknown) {
                return {
                  order() {
                    const filtered = recipients
                      .filter((row) => row.digital_card_id === cardId)
                      .sort((a, b) => a.recipient_number - b.recipient_number);
                    return Promise.resolve({ data: filtered, error: null });
                  },
                };
              },
            };
          },
          insert(rows: Record<string, unknown>[]) {
            return {
              select() {
                return (async () => {
                  const inserted = rows.map((row, index) => {
                    const stored = recipientFixture(
                      row.digital_card_id as string,
                      row.recipient_number as number,
                      {
                        id: `recipient-${nextId + index}`,
                        view_token: row.view_token as string,
                      }
                    );
                    recipients.push(stored);
                    return stored;
                  });
                  nextId += rows.length;
                  return { data: inserted, error: null };
                })();
              },
            };
          },
        };
      }

      throw new Error(`unexpected ${table}`);
    },
    _state: { orders, cards, recipients },
  };

  return supabase;
}

describe('Phase 3.6 admin Individual test tool', () => {
  it('test page lives under protected admin layout', () => {
    const pagePath = path.join(ROOT, 'app/admin/(protected)/cards/individual-test/page.tsx');
    const layoutPath = path.join(ROOT, 'app/admin/(protected)/layout.tsx');
    expect(fs.existsSync(pagePath)).toBe(true);
    const layoutSource = fs.readFileSync(layoutPath, 'utf8');
    expect(layoutSource).toMatch(/isAdminAuthenticated/);
    expect(layoutSource).toMatch(/redirect\('\/admin\/login/);
  });

  it('server actions assert admin authentication', () => {
    const source = fs.readFileSync(path.join(ROOT, 'lib/admin-individual-test-actions.ts'), 'utf8');
    expect(source).toMatch(/assertAdminAuthenticated/);
    expect(source).toMatch(/createIndividualCardCore/);
    expect(source).not.toMatch(/createCardCore/);
  });

  it('publish helper core does not expose public API route', () => {
    expect(fs.existsSync(path.join(ROOT, 'app/api/admin/individual-test/route.ts'))).toBe(false);
  });

  it('createIndividualCardCore with quantity 3 creates exactly 3 recipients', async () => {
    const supabase = createIndividualMockSupabase();
    let recipientTokenCounter = 0;
    const result = await createIndividualCardCore(supabase as never, {
      orderNumberInput: 'TEST-INDIVIDUAL-001',
      recipientCount: 3,
      platform: null,
      externalOrderId: null,
      tokenFactory: () => 'fixedParentTok1',
      recipientTokenFactory: () => `fixedRecipTok${recipientTokenCounter++}`,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.recipients).toHaveLength(3);
    expect(verifyRecipientNumbering(result.recipients, 3)).toBe(true);
    expect(result.card.platform).toBeNull();
    expect(result.card.external_order_id).toBeNull();
  });

  it('recipient URLs use recipient view tokens, not parent compatibility token', async () => {
    const supabase = createIndividualMockSupabase();
    let recipientTokenCounter = 0;
    const result = await createIndividualCardCore(supabase as never, {
      orderNumberInput: 'TEST-INDIVIDUAL-002',
      recipientCount: 2,
      platform: null,
      externalOrderId: null,
      tokenFactory: () => 'parentCompat12',
      recipientTokenFactory: () => `recipViewTok${recipientTokenCounter++}`,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    for (const recipient of result.recipients) {
      const url = buildRecipientViewUrl(recipient, 'https://hommly.online');
      expect(url).toContain(recipient.view_token);
      expect(url).not.toContain(result.card.public_token);
    }
  });

  it('compatibility parent token is labeled in UI source', () => {
    const source = fs.readFileSync(
      path.join(ROOT, 'components/admin/AdminIndividualTestClient.tsx'),
      'utf8'
    );
    expect(source).toMatch(/Compatibility token — NOT a recipient URL/);
    expect(source).toMatch(/Expected: unavailable/);
  });
});

describe('adminPublishIndividualRecipientCore', () => {
  it('publishes Gift #01 only and leaves siblings draft', async () => {
    const card = individualCardFixture();
    const recipients = [1, 2, 3].map((number) => recipientFixture(card.id, number));
    const supabase = createPublishMockSupabase({ cards: [card], recipients });

    const result = await adminPublishIndividualRecipientCore(supabase as never, {
      cardId: card.id,
      recipientId: recipients[0].id,
      message: 'Message A',
    });

    expect(result.error).toBeNull();
    expect(result.recipient?.status).toBe('published');
    expect(result.recipient?.message).toBe('Message A');
    expect(result.recipient?.published_at).toBeTruthy();
    expect(supabase._state.recipients[0].status).toBe('published');
    expect(supabase._state.recipients[1].status).toBe('draft');
    expect(supabase._state.recipients[2].status).toBe('draft');
    expect(supabase._state.recipients[1].message).toBeNull();
  });

  it('publishing Gift #02 does not overwrite Gift #01', async () => {
    const card = individualCardFixture({ first_published_at: '2026-08-12T07:00:00.000Z' });
    const recipients = [
      recipientFixture(card.id, 1, {
        status: 'published',
        message: 'Message A',
        published_at: '2026-08-12T07:00:00.000Z',
      }),
      recipientFixture(card.id, 2),
      recipientFixture(card.id, 3),
    ];
    const supabase = createPublishMockSupabase({ cards: [card], recipients });

    const result = await adminPublishIndividualRecipientCore(supabase as never, {
      cardId: card.id,
      recipientId: recipients[1].id,
      message: 'Message B',
    });

    expect(result.error).toBeNull();
    expect(supabase._state.recipients[0].message).toBe('Message A');
    expect(supabase._state.recipients[1].message).toBe('Message B');
    expect(supabase._state.recipients[2].message).toBeNull();
  });

  it('sets parent first_published_at on first recipient publish while parent stays draft', async () => {
    const card = individualCardFixture({ status: 'draft', first_published_at: null });
    const recipients = [recipientFixture(card.id, 1)];
    const supabase = createPublishMockSupabase({ cards: [card], recipients });

    const result = await adminPublishIndividualRecipientCore(supabase as never, {
      cardId: card.id,
      recipientId: recipients[0].id,
      message: 'Message A',
    });

    expect(result.error).toBeNull();
    expect(result.card?.status).toBe('draft');
    expect(result.card?.first_published_at).toBeTruthy();
  });

  it('rejects shared card parent', async () => {
    const card = individualCardFixture({ id: 'shared-card', card_mode: 'shared' });
    const recipients = [recipientFixture(card.id, 1)];
    const supabase = createPublishMockSupabase({ cards: [card], recipients });

    const result = await adminPublishIndividualRecipientCore(supabase as never, {
      cardId: card.id,
      recipientId: recipients[0].id,
      message: 'Message A',
    });

    expect(result.error).toMatch(/not an Individual card/i);
  });

  it('rejects recipient from another card', async () => {
    const card = individualCardFixture();
    const otherRecipient = recipientFixture('other-card-id', 1);
    const supabase = createPublishMockSupabase({ cards: [card], recipients: [otherRecipient] });

    const result = await adminPublishIndividualRecipientCore(supabase as never, {
      cardId: card.id,
      recipientId: otherRecipient.id,
      message: 'Message A',
    });

    expect(result.error).toMatch(/does not belong/i);
  });

  it('requires non-empty message', async () => {
    const card = individualCardFixture();
    const recipients = [recipientFixture(card.id, 1)];
    const supabase = createPublishMockSupabase({ cards: [card], recipients });

    const result = await adminPublishIndividualRecipientCore(supabase as never, {
      cardId: card.id,
      recipientId: recipients[0].id,
      message: '   ',
    });

    expect(result.error).toMatch(/Message is required/i);
  });
});

describe('Phase 3.6 production guards', () => {
  it('normal Admin Shared create UI unchanged', () => {
    const source = fs.readFileSync(
      path.join(ROOT, 'components/admin/AdminCardsClient.tsx'),
      'utf8'
    );
    expect(source).toMatch(/createCard\(/);
    expect(source).not.toMatch(/adminCreateIndividualTestCard/);
    expect(source).not.toMatch(/recipient_count/);
    expect(source).not.toMatch(/Individual Test/);
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

  it('individual parent compatibility token resolves unavailable', async () => {
    const card = individualCardFixture({ public_token: 'compatViewTk' });
    const recipient = recipientFixture(card.id, 1, {
      view_token: 'recipOneTok1',
      status: 'published',
      message: 'Message A',
      published_at: '2026-08-12T07:00:00.000Z',
    });

    const supabase = {
      from(table: string) {
        if (table === 'digital_card_recipients') {
          return {
            select() {
              return {
                eq(column: string, value: unknown) {
                  return {
                    async maybeSingle() {
                      const match =
                        column === 'view_token' && value === 'recipOneTok1' ? recipient : null;
                      return { data: match, error: null };
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
                      if (column === 'public_token' && value === 'compatViewTk') {
                        return { data: card, error: null };
                      }
                      if (column === 'id' && value === card.id) {
                        return { data: card, error: null };
                      }
                      return { data: null, error: null };
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

    const parentResolution = await resolveRecipientViewToken(supabase as never, 'compatViewTk');
    expect(parentResolution.ok).toBe(false);
    if (parentResolution.ok) return;
    expect(parentResolution.reason).toBe('unavailable');

    const recipientResolution = await resolveRecipientViewToken(supabase as never, 'recipOneTok1');
    expect(recipientResolution.ok).toBe(true);
    if (!recipientResolution.ok) return;
    expect(recipientResolution.resolved.mode).toBe('individual');
    expect(recipientResolution.resolved.recipient.view_token).toBe('recipOneTok1');
    expect(recipientResolution.resolved.recipient.view_token).not.toBe(card.public_token);
  });

  it('gift labels use zero-padded numbering', () => {
    expect(formatRecipientNumber(1)).toBe('Gift #01');
    expect(formatRecipientNumber(2)).toBe('Gift #02');
    expect(formatRecipientNumber(3)).toBe('Gift #03');
  });
});
