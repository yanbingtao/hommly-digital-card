import fs from 'fs';
import path from 'path';
import { describe, expect, it, vi } from 'vitest';
import {
  buildAdminIndividualRecipientItems,
  getAdminCardTypeLabel,
  isIndividualCard,
  validateAdminIndividualRecipientQuantity,
} from './admin-card-helpers';
import { createCardCore } from './create-card-core';
import { parseInternalCreateCardRequest } from './internal-card-request';
import type { CardWithOrder, DigitalCardRecipient } from './types';

const ROOT = path.join(__dirname, '..');

function individualCard(overrides?: Partial<CardWithOrder>): CardWithOrder {
  return {
    id: 'card-ind-1',
    order_id: 'ord-ind-1',
    card_mode: 'individual',
    public_token: 'compatParent1',
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

function sharedCard(overrides?: Partial<CardWithOrder>): CardWithOrder {
  return {
    id: 'card-shared-1',
    order_id: 'ord-shared-1',
    card_mode: 'shared',
    public_token: 'sharedPubTok1',
    edit_token: 'edit-shared-token',
    message: null,
    theme: 'thank_you',
    animation: 'soft_reveal',
    status: 'draft',
    created_at: '2026-08-12T06:00:00.000Z',
    updated_at: '2026-08-12T06:00:00.000Z',
    published_at: null,
    first_published_at: null,
    order: {
      id: 'ord-shared-1',
      order_number: 'SHARED-001',
      created_at: '2026-08-12T06:00:00.000Z',
    },
    ...overrides,
  };
}

function recipient(number: number, overrides?: Partial<DigitalCardRecipient>): DigitalCardRecipient {
  const token = `view${String(number).padStart(8, '0')}`;
  return {
    id: `recipient-${number}`,
    digital_card_id: 'card-ind-1',
    recipient_number: number,
    view_token: token,
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

describe('Phase 6A admin card helpers', () => {
  it('Shared is default card type label', () => {
    expect(getAdminCardTypeLabel(sharedCard(), null)).toBe('Shared');
    expect(isIndividualCard(sharedCard())).toBe(false);
  });

  it('Individual card type label includes gift count', () => {
    expect(getAdminCardTypeLabel(individualCard(), 37)).toBe('Individual · 37 Gifts');
    expect(getAdminCardTypeLabel(individualCard(), 1)).toBe('Individual · 1 Gift');
  });

  it('validates Individual quantity with friendly error', () => {
    expect(validateAdminIndividualRecipientQuantity(0).ok).toBe(false);
    expect(validateAdminIndividualRecipientQuantity('abc').ok).toBe(false);
    expect(validateAdminIndividualRecipientQuantity(3).ok).toBe(true);
    if (!validateAdminIndividualRecipientQuantity(0).ok) {
      expect(validateAdminIndividualRecipientQuantity(0).error).toBe(
        'Please enter a valid gift quantity.'
      );
    }
  });

  it('builds ordered recipient admin items without database ids', () => {
    const items = buildAdminIndividualRecipientItems(
      [recipient(3), recipient(1), recipient(2)],
      'https://hommly.online'
    );
    expect(items.map((item) => item.label)).toEqual(['Gift #01', 'Gift #02', 'Gift #03']);
    expect(items[0]!.viewUrl).toBe('https://hommly.online/g/view00000001');
    expect(items[0]).not.toHaveProperty('id');
    expect(items.every((item) => item.statusLabel.length > 0)).toBe(true);
  });
});

describe('Phase 6A admin UI wiring', () => {
  it('Shared is default mode in New Card form', () => {
    const source = fs.readFileSync(path.join(ROOT, 'components/admin/AdminCardsClient.tsx'), 'utf8');
    expect(source).toMatch(/card_type: 'shared'/);
    expect(source).toMatch(/RadioGroupItem value="shared"/);
  });

  it('Shared hides Quantity field', () => {
    const source = fs.readFileSync(path.join(ROOT, 'components/admin/AdminCardsClient.tsx'), 'utf8');
    expect(source).toMatch(/form\.card_type === 'individual'/);
    expect(source).toMatch(/This creates one unique recipient QR for each gift/);
  });

  it('Individual shows Quantity field', () => {
    const source = fs.readFileSync(path.join(ROOT, 'components/admin/AdminCardsClient.tsx'), 'utf8');
    expect(source).toMatch(/id="quantity"/);
    expect(source).toMatch(/createIndividualCard\(/);
  });

  it('Shared create uses createCard', () => {
    const source = fs.readFileSync(path.join(ROOT, 'components/admin/AdminCardsClient.tsx'), 'utf8');
    expect(source).toMatch(/createCard\(/);
    expect(source).not.toMatch(/adminCreateIndividualTestCard/);
  });

  it('Individual create uses createIndividualCard server action', () => {
    const actionsSource = fs.readFileSync(path.join(ROOT, 'lib/actions.ts'), 'utf8');
    expect(actionsSource).toMatch(/createIndividualCardCore/);
    expect(actionsSource).toMatch(/platform: null/);
    expect(actionsSource).toMatch(/externalOrderId: null/);
  });

  it('Individual result shows Edit URL and recipient View URLs only', () => {
    const source = fs.readFileSync(path.join(ROOT, 'components/admin/AdminCardsClient.tsx'), 'utf8');
    expect(source).toMatch(/Edit URL/);
    expect(source).toMatch(/AdminIndividualRecipientQrList/);
    expect(source).not.toMatch(/Compatibility token/);
    expect(source).toMatch(/Recipient View URLs/);
  });

  it('does not present parent public_token as Individual recipient View URL', () => {
    const source = fs.readFileSync(path.join(ROOT, 'components/admin/AdminCardsClient.tsx'), 'utf8');
    expect(source).toMatch(/isIndividualCard\(selectedCard\)/);
    expect(source).toMatch(/!isIndividualCard\(selectedCard\)/);
    expect(source).not.toMatch(/Preview Recipient[\s\S]*public_token[\s\S]*isIndividualCard/);
  });

  it('Individual recipients have compact View QR per recipient', () => {
    const source = fs.readFileSync(path.join(ROOT, 'components/admin/AdminIndividualRecipientQrCard.tsx'), 'utf8');
    expect(source).toMatch(/Download View QR/);
    expect(source).toMatch(/generateCompactQRCodeDataURL/);
    expect(source).toMatch(/individualRecipientViewQrFilename/);
  });

  it('Shared QR behavior remains dual QR download', () => {
    const source = fs.readFileSync(path.join(ROOT, 'components/admin/AdminCardsClient.tsx'), 'utf8');
    expect(source).toMatch(/Download QR Codes/);
    expect(source).toMatch(/recipientQrCode/);
    expect(source).toMatch(/Preview Recipient/);
  });

  it('existing Individual card loads recipient list via admin action', () => {
    const source = fs.readFileSync(path.join(ROOT, 'components/admin/AdminCardsClient.tsx'), 'utf8');
    expect(source).toMatch(/getAdminIndividualRecipients/);
  });

  it('hidden test tool remains available', () => {
    expect(fs.existsSync(path.join(ROOT, 'app/admin/(protected)/cards/individual-test/page.tsx'))).toBe(
      true
    );
  });
});

describe('Phase 6A creation routing', () => {
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

  it('Individual quantity validation rejects invalid values', () => {
    expect(validateAdminIndividualRecipientQuantity(0).ok).toBe(false);
    expect(validateAdminIndividualRecipientQuantity(-1).ok).toBe(false);
    expect(validateAdminIndividualRecipientQuantity(3.5).ok).toBe(false);
    expect(validateAdminIndividualRecipientQuantity(3).ok).toBe(true);
  });

  it('automation API supports individual mode with recipient_count', () => {
    expect(
      parseInternalCreateCardRequest({
        platform: 'shopee',
        order_id: '260810ABC123XY',
        mode: 'individual',
        recipient_count: 3,
      }).ok
    ).toBe(true);
    expect(
      parseInternalCreateCardRequest({
        platform: 'shopee',
        order_id: '260810ABC123XY',
        recipient_count: 3,
      }).ok
    ).toBe(false);
  });
});

describe('Phase 6A production guards', () => {
  it('AdminCardsClient does not import individual core or card-recipients directly', () => {
    const source = fs.readFileSync(path.join(ROOT, 'components/admin/AdminCardsClient.tsx'), 'utf8');
    expect(source).not.toMatch(/create-individual-card-core/);
    expect(source).not.toMatch(/card-recipients/);
    expect(source).toMatch(/createIndividualCard/);
    expect(source).toMatch(/getAdminIndividualRecipients/);
  });

  it('deleteCard still handles Individual media cleanup', () => {
    const source = fs.readFileSync(path.join(ROOT, 'lib/actions.ts'), 'utf8');
    expect(source).toMatch(/deleteIndividualCardMediaStorage/);
  });
});
