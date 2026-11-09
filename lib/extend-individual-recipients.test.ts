import { describe, expect, it } from 'vitest';
import { extendIndividualRecipients, EXTENSION_ERROR } from './extend-individual-recipients';
import { handleExtendRecipients, parseExtendRecipientsRequest } from './extend-recipients-api';
import type { CardWithOrder, DigitalCardRecipient } from './types';

const PIN = 'enc-pin-do-not-return';
const EDIT_TOKEN = 'edit-token-keep';
const GIFT_01_TOKEN = 'gift01viewtoken';

function card(): CardWithOrder {
  return {
    id: 'card-1',
    order_id: 'order-1',
    card_mode: 'individual',
    platform: 'shopify',
    external_order_id: 'gid://shopify/Order/9001',
    public_token: 'parent-token',
    edit_token: EDIT_TOKEN,
    edit_pin_encrypted: PIN,
    edit_pin_hash: 'hash-keep',
    message: null,
    theme: 'thank_you',
    animation: 'soft_reveal',
    status: 'published',
    created_at: '2026-11-09T05:06:12.836Z',
    updated_at: '2026-11-09T05:06:12.836Z',
    published_at: '2026-11-09T05:06:12.836Z',
    order: {
      id: 'order-1',
      order_number: 'gid-20261109050610',
      created_at: '2026-11-09T05:06:12.836Z',
    },
  };
}

function giftOne(): DigitalCardRecipient {
  return {
    id: 'recipient-1',
    digital_card_id: 'card-1',
    recipient_number: 1,
    view_token: GIFT_01_TOKEN,
    message: 'Happy birthday',
    theme: 'birthday',
    animation: 'confetti',
    show_sender_links: true,
    sender_links: null,
    view_pin_enabled: true,
    view_pin_hash: 'view-pin-hash',
    photo_media_id: 'media-1',
    photo_path: 'photos/gift-01.jpg',
    photo_original_name: 'cake.jpg',
    photo_mime_type: 'image/jpeg',
    photo_size_bytes: 1200,
    photo_uploaded_at: '2026-11-09T05:10:00.000Z',
    status: 'published',
    published_at: '2026-11-09T05:10:00.000Z',
    created_at: '2026-11-09T05:06:12.836Z',
    updated_at: '2026-11-09T05:10:00.000Z',
  };
}

function store(options?: { failOnNumber?: number }) {
  const parent = card();
  const recipients: DigitalCardRecipient[] = [giftOne()];
  let cardUpdates = 0;
  let tokenSerial = 2;
  const supabase = {
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
                        return { data: parent, error: null };
                      },
                    };
                  },
                };
              },
            };
          },
          update() {
            cardUpdates += 1;
            return { eq() { return Promise.resolve({ data: null, error: null }); } };
          },
        };
      }
      return {
        select() {
          return {
            eq(_column: string, cardId: string) {
              return {
                order() {
                  return Promise.resolve({
                    data: recipients
                      .filter((row) => row.digital_card_id === cardId)
                      .sort((a, b) => a.recipient_number - b.recipient_number),
                    error: null,
                  });
                },
              };
            },
          };
        },
        insert(row: { digital_card_id: string; recipient_number: number; view_token: string }) {
          return {
            select() {
              return {
                async single() {
                  if (options?.failOnNumber === row.recipient_number) {
                    return { data: null, error: { code: 'XX000', message: 'insert failed' } };
                  }
                  const duplicate = recipients.some(
                    (existing) =>
                      existing.digital_card_id === row.digital_card_id &&
                      existing.recipient_number === row.recipient_number
                  );
                  if (duplicate) {
                    return { data: null, error: { code: '23505', message: 'duplicate' } };
                  }
                  const saved: DigitalCardRecipient = {
                    ...giftOne(),
                    id: `recipient-${row.recipient_number}`,
                    recipient_number: row.recipient_number,
                    view_token: row.view_token,
                    message: null,
                    theme: 'thank_you',
                    animation: 'soft_reveal',
                    show_sender_links: false,
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
                    created_at: '2026-11-09T06:00:00.000Z',
                    updated_at: '2026-11-09T06:00:00.000Z',
                  };
                  recipients.push(saved);
                  return { data: saved, error: null };
                },
              };
            },
          };
        },
      };
    },
  };
  return {
    supabase: supabase as never,
    recipients,
    parent,
    cardUpdates: () => cardUpdates,
    nextToken: () => `new-token-${tokenSerial++}`,
  };
}

const ORDER = 'gid://shopify/Order/9001';

describe('extend individual recipients', () => {
  it('adds only gift 02 through 12 and keeps gift 01', async () => {
    const db = store();
    const result = await extendIndividualRecipients(db.supabase, {
      platform: 'shopify',
      externalOrderId: ORDER,
      recipientCount: 12,
      recipientTokenFactory: db.nextToken,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.status).toBe('extended');
    expect(result.addedNumbers).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(result.recipients).toHaveLength(12);
    expect(result.recipients[0].view_token).toBe(GIFT_01_TOKEN);
    expect(result.recipients[0].message).toBe('Happy birthday');
    expect(result.recipients[0].photo_path).toBe('photos/gift-01.jpg');
    expect(result.recipients[0].view_pin_hash).toBe('view-pin-hash');
    expect(result.recipients[0].updated_at).toBe('2026-11-09T05:10:00.000Z');
    expect(db.parent.edit_token).toBe(EDIT_TOKEN);
    expect(db.parent.edit_pin_encrypted).toBe(PIN);
    expect(db.cardUpdates()).toBe(0);
    expect(db.recipients.filter((row) => row.recipient_number === 1)).toHaveLength(1);
  });

  it('is unchanged when the same extension is repeated', async () => {
    const db = store();
    const input = {
      platform: 'shopify' as const,
      externalOrderId: ORDER,
      recipientCount: 12,
      recipientTokenFactory: db.nextToken,
    };
    await extendIndividualRecipients(db.supabase, input);
    const again = await extendIndividualRecipients(db.supabase, input);
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    expect(again.status).toBe('unchanged');
    expect(again.addedNumbers).toEqual([]);
    expect(db.recipients).toHaveLength(12);
    expect(db.recipients[0].view_token).toBe(GIFT_01_TOKEN);
  });

  it('lets two overlapping requests finish as one set', async () => {
    const db = store();
    const input = {
      platform: 'shopify',
      externalOrderId: ORDER,
      recipientCount: 12,
      recipientTokenFactory: db.nextToken,
    };
    const [first, second] = await Promise.all([
      extendIndividualRecipients(db.supabase, input),
      extendIndividualRecipients(db.supabase, input),
    ]);
    expect(first.ok && second.ok).toBe(true);
    expect(db.recipients).toHaveLength(12);
    expect(new Set(db.recipients.map((row) => row.recipient_number)).size).toBe(12);
    expect(db.recipients.find((row) => row.recipient_number === 1)?.view_token).toBe(GIFT_01_TOKEN);
    expect(db.parent.id).toBe('card-1');
  });

  it('keeps inserted recipients when a later insert fails and a retry finishes', async () => {
    const db = store({ failOnNumber: 5 });
    const input = {
      platform: 'shopify',
      externalOrderId: ORDER,
      recipientCount: 12,
      recipientTokenFactory: db.nextToken,
    };
    const failed = await extendIndividualRecipients(db.supabase, input);
    expect(failed.ok).toBe(false);
    if (failed.ok) return;
    expect(failed.code).toBe(EXTENSION_ERROR.EXTENSION_PARTIAL);
    expect(db.recipients.map((row) => row.recipient_number)).toEqual([1, 2, 3, 4]);
    expect(db.recipients[0].view_token).toBe(GIFT_01_TOKEN);
    const recovered = store();
    recovered.recipients.splice(0, recovered.recipients.length, ...db.recipients);
    const done = await extendIndividualRecipients(recovered.supabase, {
      ...input,
      recipientTokenFactory: recovered.nextToken,
    });
    expect(done.ok).toBe(true);
    if (!done.ok) return;
    expect(done.recipients).toHaveLength(12);
    expect(done.recipients[0].view_token).toBe(GIFT_01_TOKEN);
  });

  it('rejects a smaller count and a bad order id', async () => {
    const db = store();
    await extendIndividualRecipients(db.supabase, {
      platform: 'shopify',
      externalOrderId: ORDER,
      recipientCount: 12,
      recipientTokenFactory: db.nextToken,
    });
    const decrease = await extendIndividualRecipients(db.supabase, {
      platform: 'shopify',
      externalOrderId: ORDER,
      recipientCount: 4,
      recipientTokenFactory: db.nextToken,
    });
    expect(decrease.ok).toBe(false);
    if (decrease.ok) return;
    expect(decrease.code).toBe(EXTENSION_ERROR.RECIPIENT_COUNT_DECREASE_REJECTED);
    expect(db.recipients).toHaveLength(12);
    expect(parseExtendRecipientsRequest({
      platform: 'shopify',
      order_id: 'not-a-gid',
      recipient_count: 12,
    }).ok).toBe(false);
    expect(parseExtendRecipientsRequest({
      platform: 'shopee',
      order_id: '260823CANARY01',
      recipient_count: 2,
    }).ok).toBe(true);
  });

  it('does not put the edit PIN in the API response', async () => {
    const db = store();
    const parsed = parseExtendRecipientsRequest({
      platform: 'shopify',
      order_id: ORDER,
      recipient_count: 12,
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const response = await handleExtendRecipients(db.supabase, parsed);
    expect(response.ok).toBe(true);
    if (!response.ok) return;
    const encoded = JSON.stringify(response.body);
    expect(encoded).not.toContain(PIN);
    expect(encoded).not.toContain('edit_pin');
    expect(response.body.buyer_edit_url).toContain(`/e/${EDIT_TOKEN}`);
    expect(response.body.recipient_count).toBe(12);
    const recipients = response.body.recipients as { number: number; view_url: string }[];
    expect(recipients[0].view_url).toContain(`/g/${GIFT_01_TOKEN}`);
    expect(response.body.added_numbers).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });
});
