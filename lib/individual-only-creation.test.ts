import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { createIndividualCardCore } from './create-individual-card-core';
import { handleInternalCreateCard } from './internal-card-api';
import {
  parseInternalCreateCardRequest,
  SHARED_CARD_CREATION_DISABLED,
} from './internal-card-request';
import { listPendingAdminAutomationCards } from './internal-pending-automation-api';
import { adminProductionAutomationMetadata, adminTestAutomationMetadata } from './card-automation-metadata';
import { resolveRecipientViewToken } from './recipient-view-resolver';
import type { CardMode, CardWithOrder, DigitalCardRecipient } from './types';

const ROOT = path.join(__dirname, '..');

function individualCard(overrides?: Partial<CardWithOrder>): CardWithOrder {
  return {
    id: 'card-ind',
    order_id: 'ord-1',
    card_mode: 'individual',
    platform: 'admin',
    external_order_id: null,
    creation_source: 'admin',
    automation_sync_status: 'pending',
    public_token: 'parentCompatTok',
    edit_token: 'edit-ind-token',
    message: null,
    theme: 'thank_you',
    animation: 'soft_reveal',
    status: 'draft',
    created_at: '2026-08-14T08:00:00.000Z',
    updated_at: '2026-08-14T08:00:00.000Z',
    published_at: null,
    order: {
      id: 'ord-1',
      order_number: 'HM-001-20260814120000',
      created_at: '2026-08-14T08:00:00.000Z',
    },
    ...overrides,
  };
}

function sharedHistoricalCard(overrides?: Partial<CardWithOrder>): CardWithOrder {
  return {
    ...individualCard(),
    id: 'card-shared-hist',
    card_mode: 'shared',
    platform: 'shopee',
    external_order_id: '260810ABC123XY',
    creation_source: 'automation',
    automation_sync_status: 'not_required',
    public_token: 'pubToken12ab',
    edit_token: 'edit-shared-hist',
    ...overrides,
  };
}

function assertParsed<T extends { ok: true }>(parsed: { ok: boolean } & Partial<T>): asserts parsed is T {
  expect(parsed.ok).toBe(true);
}

describe('Individual-only creation policy', () => {
  describe('Admin UI', () => {
    it('has no Shared card type option in normal create form', () => {
      const source = fs.readFileSync(path.join(ROOT, 'components/admin/AdminCardsClient.tsx'), 'utf8');
      expect(source).not.toMatch(/RadioGroupItem value="shared"/);
      expect(source).not.toMatch(/Card Type/);
      expect(source).toMatch(/createIndividualCard\(/);
      expect(source).not.toMatch(/\bcreateCard\(/);
      expect(source).toMatch(/id="quantity"/);
      expect(source).toMatch(/This creates one unique recipient QR for each gift/);
    });

    it('historical Shared cards still display Type: Shared in details', () => {
      const source = fs.readFileSync(path.join(ROOT, 'components/admin/AdminCardsClient.tsx'), 'utf8');
      expect(source).toMatch(/isIndividualCard\(selectedCard\) \? 'Individual' : 'Shared'/);
      expect(source).toMatch(/getAdminCardTypeLabel/);
    });
  });

  describe('internal API request parser', () => {
    it('rejects legacy request without recipient_count', () => {
      const parsed = parseInternalCreateCardRequest({
        platform: 'shopee',
        order_id: '260810ABC123XY',
      });
      expect(parsed.ok).toBe(false);
      if (parsed.ok) return;
      expect(parsed.error).toMatch(/recipient_count is required/i);
    });

    it('rejects explicit mode=shared', () => {
      const parsed = parseInternalCreateCardRequest({
        platform: 'shopee',
        order_id: '260810ABC123XY',
        mode: 'shared',
      });
      expect(parsed.ok).toBe(false);
      if (parsed.ok) return;
      expect(parsed.code).toBe(SHARED_CARD_CREATION_DISABLED);
    });

    it('accepts omitted mode with recipient_count as Individual', () => {
      const parsed = parseInternalCreateCardRequest({
        platform: 'shopee',
        order_id: '260810ABC123XY',
        recipient_count: 3,
      });
      assertParsed(parsed);
      expect(parsed.mode).toBe('individual');
      expect(parsed.recipientCount).toBe(3);
    });

    it('accepts explicit mode=individual with recipient_count', () => {
      const parsed = parseInternalCreateCardRequest({
        platform: 'shopee',
        order_id: '260810ABC123XY',
        mode: 'individual',
        recipient_count: 37,
      });
      assertParsed(parsed);
      expect(parsed.recipientCount).toBe(37);
    });
  });

  describe('CardMode type preserved for history', () => {
    it('still includes shared and individual', () => {
      const shared: CardMode = 'shared';
      const individual: CardMode = 'individual';
      expect(shared).toBe('shared');
      expect(individual).toBe('individual');
    });
  });
});

describe('Admin create metadata', () => {
  it('production Admin metadata is pending Individual', () => {
    const meta = adminProductionAutomationMetadata();
    expect(meta.creationSource).toBe('admin');
    expect(meta.automationSyncStatus).toBe('pending');
    expect(meta.persistAdminPlatform).toBe(true);
  });

  it('hidden test metadata stays not_required', () => {
    expect(adminTestAutomationMetadata().automationSyncStatus).toBe('not_required');
  });
});

describe('pending Admin automation queue', () => {
  it('returns Individual shape only and skips Shared admin rows', async () => {
    const pendingIndividual = individualCard({ id: 'pending-ind' });
    const unexpectedSharedAdmin = individualCard({
      id: 'unexpected-shared-admin',
      card_mode: 'shared',
      automation_sync_status: 'pending',
    });
    const recipients: DigitalCardRecipient[] = [
      {
        id: 'r1',
        digital_card_id: 'pending-ind',
        recipient_number: 1,
        view_token: 'viewTok001',
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
        created_at: '2026-08-14T08:00:00.000Z',
        updated_at: '2026-08-14T08:00:00.000Z',
      },
    ];

    const supabase = {
      from(table: string) {
        if (table === 'digital_cards') {
          return {
            select() {
              return {
                eq() {
                  return {
                    in() {
                      return {
                        order() {
                          return Promise.resolve({
                            data: [pendingIndividual, unexpectedSharedAdmin],
                            error: null,
                          });
                        },
                      };
                    },
                    or() {
                      return {
                        order() {
                          return Promise.resolve({
                            data: [pendingIndividual, unexpectedSharedAdmin],
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
        if (table === 'digital_card_recipients') {
          return {
            select() {
              return {
                eq(_column: string, value: unknown) {
                  return {
                    order() {
                      const rows = recipients.filter((row) => row.digital_card_id === value);
                      return Promise.resolve({ data: rows, error: null });
                    },
                  };
                },
              };
            },
          };
        }
        throw new Error(table);
      },
    };

    const result = await listPendingAdminAutomationCards(supabase as never, 'https://hommly.online');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.body.cards).toHaveLength(1);
    expect(result.body.cards[0]?.mode).toBe('individual');
    expect(result.body.cards[0]).not.toHaveProperty('recipient_view_url');
    expect(result.body.cards[0]?.recipients[0]?.view_url).toBe('https://hommly.online/g/viewTok001');
  });
});

describe('historical Shared runtime preserved', () => {
  it('Shared /g resolver still works', async () => {
    const card = sharedHistoricalCard();
    const supabase = {
      from(table: string) {
        if (table === 'digital_cards') {
          return {
            select() {
              return {
                eq(_col: string, val: unknown) {
                  return {
                    async maybeSingle() {
                      return {
                        data: val === card.public_token ? card : null,
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
            select() {
              return {
                eq() {
                  return {
                    async maybeSingle() {
                      return { data: null, error: null };
                    },
                  };
                },
              };
            },
          };
        }
        throw new Error(table);
      },
    };

    const result = await resolveRecipientViewToken(supabase as never, card.public_token);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.resolved.mode).toBe('shared');
    expect(result.resolved.card.id).toBe(card.id);
  });

  it('Shared /e loader still routes to shared editor context', () => {
    const source = fs.readFileSync(path.join(ROOT, 'lib/edit-page-loader.ts'), 'utf8');
    expect(source).toMatch(/card\.card_mode === 'shared'/);
    expect(source).toMatch(/kind: 'shared'/);
  });
});

describe('internal API routes Individual only', () => {
  it('handleInternalCreateCard uses createIndividualCardCore only', () => {
    const source = fs.readFileSync(path.join(ROOT, 'lib/internal-card-api.ts'), 'utf8');
    expect(source).toMatch(/createIndividualCardCore/);
    expect(source).not.toMatch(/createCardCore/);
  });
});
