import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { hashViewPin } from './view-pin-crypto';
import { resolveBulkViewPinFields } from './individual-recipient-pin';
import {
  assertSafeEditorItem,
  buildIndividualEditorLoadResult,
  buildIndividualEditorPrefill,
  formatSelectedRecipientsSummary,
  getIndividualEditorHeading,
  getIndividualPublishLabel,
  normalizeUniqueRecipientIds,
  prefillToFormState,
  toIndividualRecipientEditorItem,
} from './individual-recipient-editor-prefill';
import {
  INDIVIDUAL_RECIPIENT_UPDATE_COUNT_MISMATCH,
  loadIndividualRecipientEditorCore,
  publishIndividualRecipientsCore,
} from './publish-individual-recipients-core';
import {
  computeRecipientStatusCounts,
  toIndividualRecipientManagerItem,
} from './individual-recipient-manager';
import { createCardCore } from './create-card-core';
import { parseInternalCreateCardRequest } from './internal-card-request';
import type { CardWithOrder, DigitalCardRecipient } from './types';

const ROOT = path.join(__dirname, '..');

function recipient(
  number: number,
  overrides?: Partial<DigitalCardRecipient>
): DigitalCardRecipient {
  return {
    id: `recipient-${number}`,
    digital_card_id: 'card-ind-1',
    recipient_number: number,
    view_token: `viewTok${number}`.padEnd(12, '0').slice(0, 12),
    message: null,
    theme: 'thank_you',
    animation: 'soft_reveal',
    show_sender_links: false,
    sender_links: null,
    view_pin_enabled: false,
    view_pin_hash: null,
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

function individualCard(overrides?: Partial<CardWithOrder>): CardWithOrder {
  return {
    id: 'card-ind-1',
    order_id: 'ord-ind-1',
    card_mode: 'individual',
    public_token: 'parentCompat1',
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
      id: 'ord-ind-1',
      order_number: 'IND-001',
      created_at: '2026-08-12T06:00:00.000Z',
    },
    ...overrides,
  };
}

function createPublishMockSupabase(options: {
  card: CardWithOrder;
  recipients: DigitalCardRecipient[];
  updateMatchIds?: boolean;
  parentUpdateError?: boolean;
}) {
  const card = { ...options.card, order: { ...options.card.order } };
  const recipients = options.recipients.map((row) => ({ ...row }));
  const updateMatchIds = options.updateMatchIds ?? true;
  const parentUpdateError = options.parentUpdateError ?? false;

  const supabase = {
    from(table: string) {
      if (table === 'digital_cards') {
        return {
          select() {
            return {
              eq(column: string, value: unknown) {
                return {
                  async maybeSingle() {
                    if (column === 'edit_token' && value === card.edit_token) {
                      return { data: card, error: null };
                    }
                    return { data: null, error: null };
                  },
                  is(column2: string, value2: unknown) {
                    return {
                      select() {
                        return {
                          async maybeSingle() {
                            if (
                              column === 'id' &&
                              value === card.id &&
                              column2 === 'first_published_at' &&
                              value2 === null &&
                              !card.first_published_at
                            ) {
                              card.first_published_at = '2026-08-12T08:00:00.000Z';
                              card.updated_at = '2026-08-12T08:00:00.000Z';
                              return { data: { first_published_at: card.first_published_at }, error: null };
                            }
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
          update(patch: Record<string, unknown>) {
            return {
              eq(column: string, value: unknown) {
                const filters: Array<[string, unknown]> = [[column, value]];
                return {
                  is(column2: string, value2: unknown) {
                    filters.push([column2, value2]);
                    return {
                      select() {
                        return {
                          async maybeSingle() {
                            if (parentUpdateError) {
                              return { data: null, error: { message: 'parent update failed' } };
                            }
                            if (
                              filters.every(([key, filterValue]) => {
                                if (key === 'id') return card.id === filterValue;
                                if (key === 'first_published_at') return card.first_published_at === filterValue;
                                return true;
                              })
                            ) {
                              Object.assign(card, patch);
                              return {
                                data: { first_published_at: card.first_published_at ?? patch.first_published_at },
                                error: null,
                              };
                            }
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
      }

      if (table === 'digital_card_recipients') {
        return {
          select() {
            return {
              eq(column: string, value: unknown) {
                return {
                  order() {
                    const filtered = recipients
                      .filter((row) => row[column as keyof DigitalCardRecipient] === value)
                      .sort((a, b) => a.recipient_number - b.recipient_number);
                    return Promise.resolve({ data: filtered, error: null });
                  },
                  in(column2: string, values: unknown[]) {
                    return Promise.resolve({
                      data: recipients.filter(
                        (row) =>
                          row[column as keyof DigitalCardRecipient] === value &&
                          values.includes(row[column2 as keyof DigitalCardRecipient])
                      ),
                      error: null,
                    });
                  },
                };
              },
            };
          },
          update(patch: Record<string, unknown>) {
            return {
              eq(column: string, value: unknown) {
                return {
                  in(column2: string, values: unknown[]) {
                    return {
                      select() {
                        const matched = recipients.filter(
                          (row) =>
                            row[column as keyof DigitalCardRecipient] === value &&
                            (updateMatchIds
                              ? values.includes(row[column2 as keyof DigitalCardRecipient])
                              : false)
                        );
                        return Promise.resolve({
                          data: matched.map((row) => {
                            Object.assign(row, patch);
                            return {
                              id: row.id,
                              recipient_number: row.recipient_number,
                              view_token: row.view_token,
                              message: row.message,
                              theme: row.theme,
                              photo_path: row.photo_path,
                              photo_original_name: row.photo_original_name,
                              photo_mime_type: row.photo_mime_type,
                              photo_size_bytes: row.photo_size_bytes,
                              photo_uploaded_at: row.photo_uploaded_at,
                              status: row.status,
                              published_at: row.published_at,
                            };
                          }),
                          error: null,
                        });
                      },
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
    _state: { card, recipients },
  };

  return supabase;
}

describe('Individual editor headings and labels', () => {
  it('uses dynamic single heading', () => {
    expect(getIndividualEditorHeading([7], 37)).toBe('Personalise Gift #07');
    expect(getIndividualPublishLabel([7], 37)).toBe('Publish Gift #07');
  });

  it('uses dynamic multi heading', () => {
    expect(getIndividualEditorHeading([1, 5, 8], 37)).toBe('Personalise 3 Gifts');
    expect(getIndividualPublishLabel([1, 5, 8], 37)).toBe('Publish to 3 Gifts');
  });

  it('uses dynamic all heading', () => {
    expect(getIndividualEditorHeading([1, 2, 3], 3)).toBe('Personalise All 3 Gifts');
    expect(getIndividualPublishLabel([1, 2, 3], 3)).toBe('Publish to All 3 Gifts');
  });

  it('summarises many selected gifts compactly', () => {
    expect(formatSelectedRecipientsSummary([1, 2, 3, 4, 5])).toBe(
      'Gift #01, Gift #02, Gift #03, Gift #04 + 1 more'
    );
  });
});

describe('Individual editor prefill', () => {
  it('prefills single existing message, theme, and links', () => {
    const items = [
      toIndividualRecipientEditorItem(
        recipient(2, {
          message: 'Thank you for everything!',
          theme: 'farewell',
          show_sender_links: true,
          sender_links: {
            instagram: { enabled: true, label: 'Instagram', url: 'https://instagram.com/test' },
          },
        })
      ),
    ];
    const prefill = buildIndividualEditorPrefill(items);
    const form = prefillToFormState(prefill, items);
    expect(prefill.message).toEqual({ kind: 'value', value: 'Thank you for everything!' });
    expect(prefill.theme).toEqual({ kind: 'value', value: 'farewell' });
    expect(form.message).toBe('Thank you for everything!');
    expect(form.theme).toBe('farewell');
    expect(form.show_sender_links).toBe(true);
  });

  it('prefills identical multi-recipient content', () => {
    const items = [1, 2].map((number) =>
      toIndividualRecipientEditorItem(recipient(number, { message: 'Message A', theme: 'thank_you' }))
    );
    const prefill = buildIndividualEditorPrefill(items);
    expect(prefill.message.kind).toBe('value');
    expect(prefill.theme.kind).toBe('value');
  });

  it('detects mixed messages, themes, links, and PIN states', () => {
    const items = [
      toIndividualRecipientEditorItem(recipient(1, { message: 'Message A', theme: 'thank_you' })),
      toIndividualRecipientEditorItem(recipient(2, { message: 'Message B', theme: 'birthday', view_pin_enabled: true })),
    ];
    const load = buildIndividualEditorLoadResult(items, 3);
    expect(load.prefill.message.kind).toBe('mixed');
    expect(load.prefill.theme.kind).toBe('mixed');
    expect(load.warnings.has_mixed_content).toBe(true);
    expect(load.warnings.has_mixed_pin).toBe(true);
    expect(load.warnings.recipients_with_existing_content).toBe(2);
  });

  it('does not expose PIN hash in editor DTO', () => {
    const item = toIndividualRecipientEditorItem(
      recipient(1, { view_pin_hash: hashViewPin('1234'), view_pin_enabled: true })
    );
    assertSafeEditorItem(item);
    expect(item.view_pin_is_set).toBe(true);
    expect(Object.keys(item)).not.toContain('view_pin_hash');
  });
});

describe('loadIndividualRecipientEditorCore', () => {
  it('rejects empty selection', async () => {
    const supabase = createPublishMockSupabase({
      card: individualCard(),
      recipients: [recipient(1)],
    });
    const result = await loadIndividualRecipientEditorCore(supabase as never, {
      editToken: 'edit-ind-token',
      recipientIds: [],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/at least one/i);
  });

  it('rejects shared parent', async () => {
    const supabase = createPublishMockSupabase({
      card: individualCard({ card_mode: 'shared' }),
      recipients: [recipient(1)],
    });
    const result = await loadIndividualRecipientEditorCore(supabase as never, {
      editToken: 'edit-ind-token',
      recipientIds: ['recipient-1'],
    });
    expect(result.ok).toBe(false);
  });

  it('rejects recipient from another parent', async () => {
    const supabase = createPublishMockSupabase({
      card: individualCard(),
      recipients: [recipient(1, { digital_card_id: 'other-card' })],
    });
    const result = await loadIndividualRecipientEditorCore(supabase as never, {
      editToken: 'edit-ind-token',
      recipientIds: ['recipient-1'],
    });
    expect(result.ok).toBe(false);
  });
});

describe('publishIndividualRecipientsCore', () => {
  it('publishes one recipient without changing siblings', async () => {
    const supabase = createPublishMockSupabase({
      card: individualCard(),
      recipients: [recipient(1), recipient(2), recipient(3)],
    });
    const result = await publishIndividualRecipientsCore(supabase as never, {
      editToken: 'edit-ind-token',
      recipientIds: ['recipient-1'],
      content: {
        message: 'Message A',
        theme: 'thank_you',
        show_sender_links: false,
        sender_links: null,
        view_pin_enabled: false,
        view_pin: '',
      },
    });
    expect(result.ok).toBe(true);
    const rows = supabase._state.recipients;
    expect(rows[0]!.message).toBe('Message A');
    expect(rows[0]!.status).toBe('published');
    expect(rows[0]!.published_at).toBeTruthy();
    expect(rows[1]!.message).toBeNull();
    expect(rows[2]!.message).toBeNull();
  });

  it('supports copy-on-write override for one recipient later', async () => {
    const supabase = createPublishMockSupabase({
      card: individualCard({ first_published_at: '2026-08-12T07:00:00.000Z' }),
      recipients: [
        recipient(1, { message: 'Message A', status: 'published', published_at: '2026-08-12T07:00:00.000Z' }),
        recipient(2, { message: 'Message A', status: 'published', published_at: '2026-08-12T07:00:00.000Z' }),
        recipient(3, { message: 'Message A', status: 'published', published_at: '2026-08-12T07:00:00.000Z' }),
      ],
    });
    const result = await publishIndividualRecipientsCore(supabase as never, {
      editToken: 'edit-ind-token',
      recipientIds: ['recipient-2'],
      content: {
        message: 'Message B',
        theme: 'thank_you',
        show_sender_links: false,
        sender_links: null,
        view_pin_enabled: false,
        view_pin: '',
      },
    });
    expect(result.ok).toBe(true);
    const rows = supabase._state.recipients;
    expect(rows[0]!.message).toBe('Message A');
    expect(rows[1]!.message).toBe('Message B');
    expect(rows[2]!.message).toBe('Message A');
  });

  it('publishes selected recipients only', async () => {
    const supabase = createPublishMockSupabase({
      card: individualCard(),
      recipients: [recipient(1), recipient(2), recipient(3)],
    });
    const result = await publishIndividualRecipientsCore(supabase as never, {
      editToken: 'edit-ind-token',
      recipientIds: ['recipient-1', 'recipient-3'],
      content: {
        message: 'Shared message',
        theme: 'birthday',
        show_sender_links: false,
        sender_links: null,
        view_pin_enabled: false,
        view_pin: '',
      },
    });
    expect(result.ok).toBe(true);
    const rows = supabase._state.recipients;
    expect(rows[0]!.status).toBe('published');
    expect(rows[1]!.status).toBe('draft');
    expect(rows[2]!.status).toBe('published');
  });

  it('requires message and valid theme', async () => {
    const supabase = createPublishMockSupabase({
      card: individualCard(),
      recipients: [recipient(1)],
    });
    const empty = await publishIndividualRecipientsCore(supabase as never, {
      editToken: 'edit-ind-token',
      recipientIds: ['recipient-1'],
      content: {
        message: '   ',
        theme: 'thank_you',
        show_sender_links: false,
        sender_links: null,
        view_pin_enabled: false,
        view_pin: '',
      },
    });
    expect(empty.ok).toBe(false);

    const badTheme = await publishIndividualRecipientsCore(supabase as never, {
      editToken: 'edit-ind-token',
      recipientIds: ['recipient-1'],
      content: {
        message: 'Hello',
        theme: 'invalid',
        show_sender_links: false,
        sender_links: null,
        view_pin_enabled: false,
        view_pin: '',
      },
    });
    expect(badTheme.ok).toBe(false);
  });

  it('stores hashed PIN and clears hash when disabled', async () => {
    const supabase = createPublishMockSupabase({
      card: individualCard(),
      recipients: [recipient(1)],
    });
    const enabled = await publishIndividualRecipientsCore(supabase as never, {
      editToken: 'edit-ind-token',
      recipientIds: ['recipient-1'],
      content: {
        message: 'Hello',
        theme: 'thank_you',
        show_sender_links: false,
        sender_links: null,
        view_pin_enabled: true,
        view_pin: '1234',
      },
    });
    expect(enabled.ok).toBe(true);
    const hash = supabase._state.recipients[0]!.view_pin_hash;
    expect(hash).toBeTruthy();
    expect(hash).not.toBe('1234');

    const disabled = await publishIndividualRecipientsCore(supabase as never, {
      editToken: 'edit-ind-token',
      recipientIds: ['recipient-1'],
      content: {
        message: 'Hello',
        theme: 'thank_you',
        show_sender_links: false,
        sender_links: null,
        view_pin_enabled: false,
        view_pin: '',
      },
    });
    expect(disabled.ok).toBe(true);
    expect(supabase._state.recipients[0]!.view_pin_hash).toBeNull();
    expect(supabase._state.recipients[0]!.view_pin_enabled).toBe(false);
  });

  it('preserves view_token, recipient_number, and photo fields', async () => {
    const supabase = createPublishMockSupabase({
      card: individualCard(),
      recipients: [
        recipient(1, {
          view_token: 'keepToken123',
          photo_path: 'cards/x/photo.webp',
          photo_original_name: 'photo.jpg',
        }),
      ],
    });
    const before = { ...supabase._state.recipients[0]! };
    const result = await publishIndividualRecipientsCore(supabase as never, {
      editToken: 'edit-ind-token',
      recipientIds: ['recipient-1'],
      content: {
        message: 'Hello',
        theme: 'thank_you',
        show_sender_links: false,
        sender_links: null,
        view_pin_enabled: false,
        view_pin: '',
      },
    });
    expect(result.ok).toBe(true);
    const after = supabase._state.recipients[0]!;
    expect(after.view_token).toBe(before.view_token);
    expect(after.recipient_number).toBe(before.recipient_number);
    expect(after.photo_path).toBe(before.photo_path);
    expect(after.photo_original_name).toBe(before.photo_original_name);
  });

  it('initializes parent first_published_at once', async () => {
    const supabase = createPublishMockSupabase({
      card: individualCard({ first_published_at: null }),
      recipients: [recipient(1), recipient(2)],
    });
    const first = await publishIndividualRecipientsCore(supabase as never, {
      editToken: 'edit-ind-token',
      recipientIds: ['recipient-1'],
      content: {
        message: 'A',
        theme: 'thank_you',
        show_sender_links: false,
        sender_links: null,
        view_pin_enabled: false,
        view_pin: '',
      },
    });
    expect(first.ok).toBe(true);
    const firstPublishedAt = supabase._state.card.first_published_at;
    expect(firstPublishedAt).toBeTruthy();

    const second = await publishIndividualRecipientsCore(supabase as never, {
      editToken: 'edit-ind-token',
      recipientIds: ['recipient-2'],
      content: {
        message: 'B',
        theme: 'thank_you',
        show_sender_links: false,
        sender_links: null,
        view_pin_enabled: false,
        view_pin: '',
      },
    });
    expect(second.ok).toBe(true);
    expect(supabase._state.card.first_published_at).toBe(firstPublishedAt);
  });

  it('deduplicates recipient IDs safely', () => {
    expect(normalizeUniqueRecipientIds(['recipient-1', 'recipient-1', ' recipient-2 '])).toEqual([
      'recipient-1',
      'recipient-2',
    ]);
  });

  it('returns updatedCount matching requested recipients', async () => {
    const supabase = createPublishMockSupabase({
      card: individualCard(),
      recipients: [recipient(1), recipient(2), recipient(3)],
    });
    const result = await publishIndividualRecipientsCore(supabase as never, {
      editToken: 'edit-ind-token',
      recipientIds: ['recipient-1', 'recipient-2', 'recipient-3'],
      content: {
        message: 'A',
        theme: 'thank_you',
        show_sender_links: false,
        sender_links: null,
        view_pin_enabled: false,
        view_pin: '',
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.updatedCount).toBe(3);
    expect(result.updatedRecipientIds).toEqual(['recipient-1', 'recipient-2', 'recipient-3']);
  });

  it('fails when zero rows are updated', async () => {
    const supabase = createPublishMockSupabase({
      card: individualCard(),
      recipients: [recipient(1)],
      updateMatchIds: false,
    });
    const result = await publishIndividualRecipientsCore(supabase as never, {
      editToken: 'edit-ind-token',
      recipientIds: ['recipient-1'],
      content: {
        message: 'A',
        theme: 'thank_you',
        show_sender_links: false,
        sender_links: null,
        view_pin_enabled: false,
        view_pin: '',
      },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe(INDIVIDUAL_RECIPIENT_UPDATE_COUNT_MISMATCH);
    expect(result.error).toBe('INDIVIDUAL_RECIPIENT_UPDATE_COUNT_MISMATCH expected=1 actual=0');
  });

  it('does not treat parent lifecycle failure as recipient publish failure', async () => {
    const supabase = createPublishMockSupabase({
      card: individualCard({ first_published_at: null }),
      recipients: [recipient(1)],
      parentUpdateError: true,
    });
    const result = await publishIndividualRecipientsCore(supabase as never, {
      editToken: 'edit-ind-token',
      recipientIds: ['recipient-1'],
      content: {
        message: 'A',
        theme: 'thank_you',
        show_sender_links: false,
        sender_links: null,
        view_pin_enabled: false,
        view_pin: '',
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.updatedCount).toBe(1);
    expect(result.parentLifecycleWarning).toMatch(/parent lifecycle/i);
    expect(supabase._state.recipients[0]!.status).toBe('published');
    expect(supabase._state.recipients[0]!.message).toBe('A');
  });
});

describe('Phase 4B publish regression — bulk, override, manager DTO', () => {
  async function publishAllWithA(supabase: ReturnType<typeof createPublishMockSupabase>) {
    return publishIndividualRecipientsCore(supabase as never, {
      editToken: 'edit-ind-token',
      recipientIds: ['recipient-1', 'recipient-2', 'recipient-3'],
      content: {
        message: 'A',
        theme: 'thank_you',
        show_sender_links: false,
        sender_links: null,
        view_pin_enabled: false,
        view_pin: '',
      },
    });
  }

  it('persists A for all 3 and manager DTO shows 3/3 published', async () => {
    const supabase = createPublishMockSupabase({
      card: individualCard(),
      recipients: [recipient(1), recipient(2), recipient(3)],
    });
    const result = await publishAllWithA(supabase);
    expect(result.ok).toBe(true);

    const rows = supabase._state.recipients;
    expect(rows.every((row) => row.message === 'A' && row.status === 'published')).toBe(true);

    const managerItems = rows.map((row) => toIndividualRecipientManagerItem(row));
    const counts = computeRecipientStatusCounts(managerItems);
    expect(counts.published_count).toBe(3);
    expect(counts.not_started_count).toBe(0);
    expect(counts.draft_count).toBe(0);
  });

  it('overrides #02 with B without changing siblings', async () => {
    const supabase = createPublishMockSupabase({
      card: individualCard({ first_published_at: '2026-08-12T07:00:00.000Z' }),
      recipients: [
        recipient(1, { message: 'A', status: 'published', published_at: '2026-08-12T07:00:00.000Z' }),
        recipient(2, { message: 'A', status: 'published', published_at: '2026-08-12T07:00:00.000Z' }),
        recipient(3, { message: 'A', status: 'published', published_at: '2026-08-12T07:00:00.000Z' }),
      ],
    });
    const result = await publishIndividualRecipientsCore(supabase as never, {
      editToken: 'edit-ind-token',
      recipientIds: ['recipient-2'],
      content: {
        message: 'B',
        theme: 'thank_you',
        show_sender_links: false,
        sender_links: null,
        view_pin_enabled: false,
        view_pin: '',
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.updatedCount).toBe(1);

    const rows = supabase._state.recipients;
    expect(rows[0]!.message).toBe('A');
    expect(rows[1]!.message).toBe('B');
    expect(rows[2]!.message).toBe('A');
    expect(rows[1]!.status).toBe('published');

    const counts = computeRecipientStatusCounts(rows.map((row) => toIndividualRecipientManagerItem(row)));
    expect(counts.published_count).toBe(3);
  });

  it('published recipient with message never derives Not started', () => {
    const item = toIndividualRecipientManagerItem(
      recipient(2, { message: 'B', status: 'published', published_at: '2026-08-12T08:00:00.000Z' })
    );
    expect(item.status).toBe('published');
    expect(item.has_message).toBe(true);
    const counts = computeRecipientStatusCounts([item]);
    expect(counts.not_started_count).toBe(0);
    expect(counts.published_count).toBe(1);
  });
});

describe('Phase 4B server wiring guards', () => {
  it('publish and refresh actions use getSupabaseAdmin', () => {
    const source = fs.readFileSync(path.join(ROOT, 'lib/individual-recipient-editor-actions.ts'), 'utf8');
    expect(source).toMatch(/getSupabaseAdmin\(\)/);
    expect(source).not.toMatch(/getSupabase\(\)/);
  });

  it('recipient view actions use admin client with no-store fetch', () => {
    const viewSource = fs.readFileSync(path.join(ROOT, 'lib/recipient-view-actions.ts'), 'utf8');
    expect(viewSource).toMatch(/getSupabaseAdmin\(\)/);
    const adminSource = fs.readFileSync(path.join(ROOT, 'lib/supabase-admin.ts'), 'utf8');
    expect(adminSource).toMatch(/cache:\s*'no-store'/);
  });

  it('admin Supabase client uses no-store fetch', () => {
    const source = fs.readFileSync(path.join(ROOT, 'lib/supabase-admin.ts'), 'utf8');
    expect(source).toMatch(/cache:\s*'no-store'/);
  });

  it('recipient table migration keeps RLS without broad anon UPDATE', () => {
    const sql = fs.readFileSync(
      path.join(ROOT, 'supabase/migrations/20260812140000_add_card_mode_and_digital_card_recipients.sql'),
      'utf8'
    );
    expect(sql).toMatch(/ENABLE ROW LEVEL SECURITY/);
    expect(sql).not.toMatch(/anon_update_digital_card_recipients/);
  });

  it('manager preserves selection when refresh would fail after publish', () => {
    const source = fs.readFileSync(
      path.join(ROOT, 'components/individual/IndividualRecipientManager.tsx'),
      'utf8'
    );
    expect(source).toMatch(/if \(refreshed\.error \|\| !refreshed\.recipients\)/);
    expect(source).toMatch(/return;/);
  });

  it('editor only calls onPublished after verified ok response', () => {
    const source = fs.readFileSync(
      path.join(ROOT, 'components/individual/IndividualRecipientEditor.tsx'),
      'utf8'
    );
    expect(source).toMatch(/if \(!result\.ok\)/);
    expect(source).toMatch(/await onPublished\(\)/);
  });

  it('publish action returns updatedCount on success', () => {
    const source = fs.readFileSync(path.join(ROOT, 'lib/individual-recipient-editor-actions.ts'), 'utf8');
    expect(source).toMatch(/updatedCount/);
    expect(source).toMatch(/revalidatePath/);
  });
});

describe('resolveBulkViewPinFields', () => {
  it('handles mixed PIN state safely', () => {
    const result = resolveBulkViewPinFields(true, '', [
      { view_pin_enabled: true, view_pin_hash: 'hash-a' },
      { view_pin_enabled: false, view_pin_hash: null },
    ]);
    expect(result.error).toMatch(/new PIN/i);
  });
});

describe('Phase 4B production guards', () => {
  it('Individual manager opens real editor instead of placeholder', () => {
    const source = fs.readFileSync(
      path.join(ROOT, 'components/individual/IndividualRecipientManager.tsx'),
      'utf8'
    );
    expect(source).toMatch(/IndividualRecipientEditor/);
    expect(source).not.toMatch(/next phase/i);
  });

  it('Shared editor still uses photo upload and publish card labels', () => {
    const source = fs.readFileSync(path.join(ROOT, 'components/card/SharedCardEditor.tsx'), 'utf8');
    expect(source).toMatch(/CardPhotoUpload/);
    expect(source).toMatch(/Publish Card/);
    expect(source).not.toMatch(/IndividualRecipientEditor/);
  });

  it('no Individual photo mutation path added', () => {
    const files = [
      'lib/publish-individual-recipients-core.ts',
      'components/individual/IndividualRecipientEditor.tsx',
    ];
    for (const relative of files) {
      const source = fs.readFileSync(path.join(ROOT, relative), 'utf8');
      expect(source).not.toMatch(/upload-photo/);
      expect(source).not.toMatch(/photo_path\s*:/);
    }
  });

  it('server actions file exports async functions only pattern', () => {
    const source = fs.readFileSync(path.join(ROOT, 'lib/individual-recipient-editor-actions.ts'), 'utf8');
    expect(source).toMatch(/loadIndividualRecipientEditor/);
    expect(source).toMatch(/publishIndividualRecipients/);
    expect(source).not.toMatch(/^export const /m);
  });

  it('automation API and Shared create remain unchanged', async () => {
    expect(
      parseInternalCreateCardRequest({
        platform: 'shopee',
        order_id: '260810ABC123XY',
        recipient_count: 3,
      }).ok
    ).toBe(false);

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
