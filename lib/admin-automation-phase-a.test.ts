import fs from 'fs';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { createCardCore } from './create-card-core';
import { createIndividualCardCore } from './create-individual-card-core';
import {
  ADMIN_AUTOMATION_PLATFORM,
  AUTOMATION_CLAIM_TIMEOUT_MINUTES,
  extractAdminOrderLabel,
  formatAutomationSyncStatusDetail,
  isStaleAutomationClaim,
} from './card-automation';
import {
  adminProductionAutomationMetadata,
  adminTestAutomationMetadata,
  automationApiMetadata,
} from './card-automation-metadata';
import {
  claimAdminAutomationCard,
  listPendingAdminAutomationCards,
  markAdminAutomationFailed,
  markAdminAutomationReady,
} from './internal-pending-automation-api';
import {
  parseBearerToken,
  verifyAutomationRequest,
} from './automation-auth';
import type { CardWithOrder, DigitalCardRecipient } from './types';

const ROOT = path.join(__dirname, '..');
const SITE_ORIGIN = 'https://hommly.online';

function sharedCard(overrides?: Partial<CardWithOrder>): CardWithOrder {
  return {
    id: 'card-shared-1',
    order_id: 'ord-1',
    card_mode: 'shared',
    platform: ADMIN_AUTOMATION_PLATFORM,
    external_order_id: null,
    creation_source: 'admin',
    automation_sync_status: 'pending',
    public_token: 'sharedPubTok1',
    edit_token: 'edit-shared',
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

function individualCard(overrides?: Partial<CardWithOrder>): CardWithOrder {
  return sharedCard({
    id: 'card-ind-1',
    card_mode: 'individual',
    public_token: 'parentCompatTok',
    ...overrides,
  });
}

function recipient(number: number, token: string, cardId = 'card-ind-1'): DigitalCardRecipient {
  return {
    id: `recipient-${number}`,
    digital_card_id: cardId,
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
    created_at: '2026-08-14T08:00:00.000Z',
    updated_at: '2026-08-14T08:00:00.000Z',
  };
}

type MockState = {
  cards: CardWithOrder[];
  recipients: DigitalCardRecipient[];
};

type QueryFilter = {
  op: 'eq' | 'in' | 'lt' | 'or';
  column: string;
  value: unknown;
};

function timestampFromLtExpr(expr: string): number | null {
  const match = expr.match(/automation_claimed_at\.lt\."([^"]+)"/);
  return match ? Date.parse(match[1]) : null;
}

function matchesOrFilter(card: CardWithOrder, expr: string): boolean {
  if (expr.includes('automation_sync_status.in.(pending,failed)')) {
    const status = card.automation_sync_status ?? 'not_required';
    if (status === 'pending' || status === 'failed') return true;
    if (status !== 'claimed') return false;
    if (!card.automation_claimed_at) return expr.includes('automation_claimed_at.is.null');
    const cutoffMs = timestampFromLtExpr(expr);
    return cutoffMs != null && Date.parse(card.automation_claimed_at) < cutoffMs;
  }
  if (!card.automation_claimed_at) return expr.includes('automation_claimed_at.is.null');
  const cutoffMs = timestampFromLtExpr(expr);
  return cutoffMs != null && Date.parse(card.automation_claimed_at) < cutoffMs;
}

function cardMatchesFilters(card: CardWithOrder, filters: QueryFilter[]): boolean {
  return filters.every((filter) => {
    if (filter.op === 'or') {
      return matchesOrFilter(card, String(filter.value));
    }
    const actual = card[filter.column as keyof CardWithOrder];
    if (filter.op === 'in') {
      return (filter.value as string[]).includes(String(actual));
    }
    if (filter.op === 'lt') {
      if (actual == null) return false;
      return Date.parse(String(actual)) < Date.parse(String(filter.value));
    }
    return actual === filter.value;
  });
}

function createAutomationMockSupabase(initial: MockState) {
  const state: MockState = {
    cards: [...initial.cards],
    recipients: [...initial.recipients],
  };

  return {
    state,
    from(table: string) {
      if (table === 'digital_cards') {
        return {
          select() {
            const filters: QueryFilter[] = [];
            const builder = {
              eq(column: string, value: unknown) {
                filters.push({ op: 'eq', column, value });
                return builder;
              },
              in(column: string, values: string[]) {
                filters.push({ op: 'in', column, value: values });
                return builder;
              },
              or(expr: string) {
                filters.push({ op: 'or', column: '', value: expr });
                return builder;
              },
              order() {
                const rows = state.cards.filter((card) => cardMatchesFilters(card, filters));
                return Promise.resolve({ data: rows, error: null });
              },
              async maybeSingle() {
                const match = state.cards.find((card) => cardMatchesFilters(card, filters));
                return { data: match ?? null, error: null };
              },
            };
            return builder;
          },
          update(patch: Record<string, unknown>) {
            const filters: QueryFilter[] = [];
            const builder = {
              eq(column: string, value: unknown) {
                filters.push({ op: 'eq', column, value });
                return builder;
              },
              in(column: string, values: string[]) {
                filters.push({ op: 'in', column, value: values });
                return builder;
              },
              lt(column: string, value: unknown) {
                filters.push({ op: 'lt', column, value });
                return builder;
              },
              or(expr: string) {
                filters.push({ op: 'or', column: '', value: expr });
                return builder;
              },
              select() {
                return {
                  async maybeSingle() {
                    const index = state.cards.findIndex((card) => cardMatchesFilters(card, filters));
                    if (index === -1) return { data: null, error: null };
                    state.cards[index] = { ...state.cards[index], ...patch };
                    return {
                      data: {
                        id: state.cards[index].id,
                        automation_sync_status: state.cards[index].automation_sync_status,
                        automation_claimed_at: state.cards[index].automation_claimed_at,
                      },
                      error: null,
                    };
                  },
                };
              },
            };
            return builder;
          },
          insert(row: Record<string, unknown>) {
            return {
              select() {
                return {
                  async single() {
                    const card = sharedCard({
                      id: `card-${state.cards.length + 1}`,
                      creation_source: row.creation_source as CardWithOrder['creation_source'],
                      automation_sync_status: row.automation_sync_status as CardWithOrder['automation_sync_status'],
                      platform: row.platform as string,
                      public_token: row.public_token as string,
                      edit_token: row.edit_token as string,
                    });
                    state.cards.push(card);
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
          select(_columns: string) {
            return {
              eq(column: string, value: unknown) {
                return {
                  order() {
                    const rows = state.recipients
                      .filter((row) => row[column as keyof DigitalCardRecipient] === value)
                      .sort((a, b) => a.recipient_number - b.recipient_number);
                    return Promise.resolve({ data: rows, error: null });
                  },
                };
              },
            };
          },
          insert(rows: Array<Record<string, unknown>>) {
            return {
              select(_columns: string) {
                const inserted = rows.map((row, index) =>
                  recipient(
                    row.recipient_number as number,
                    (row.view_token as string) ?? `tok${index + 1}`,
                    row.digital_card_id as string
                  )
                );
                state.recipients.push(...inserted);
                return Promise.resolve({ data: inserted, error: null });
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
                        order_number: 'HM-001-20260814120000',
                        created_at: '2026-08-14T08:00:00.000Z',
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

describe('card automation metadata', () => {
  it('uses a 30-minute server-owned claim timeout', () => {
    expect(AUTOMATION_CLAIM_TIMEOUT_MINUTES).toBe(30);
  });

  it('marks claimed rows stale only after the timeout', () => {
    const now = new Date('2026-08-14T10:00:00.000Z');
    expect(
      isStaleAutomationClaim(
        { automation_sync_status: 'claimed', automation_claimed_at: '2026-08-14T09:30:00.000Z' },
        now
      )
    ).toBe(false);
    expect(
      isStaleAutomationClaim(
        { automation_sync_status: 'claimed', automation_claimed_at: '2026-08-14T09:29:59.999Z' },
        now
      )
    ).toBe(true);
    expect(
      formatAutomationSyncStatusDetail(
        { automation_sync_status: 'claimed', automation_claimed_at: '2026-08-14T09:50:00.000Z' },
        now
      )
    ).toBe('Mac mini is preparing this card');
    expect(
      formatAutomationSyncStatusDetail(
        { automation_sync_status: 'claimed', automation_claimed_at: '2026-08-14T09:20:00.000Z' },
        now
      )
    ).toBe('Preparation delayed — waiting for automatic retry');
  });

  it('marks normal Admin production cards pending with admin platform', () => {
    const meta = adminProductionAutomationMetadata();
    expect(meta.creationSource).toBe('admin');
    expect(meta.automationSyncStatus).toBe('pending');
    expect(meta.persistAdminPlatform).toBe(true);
  });

  it('marks hidden Individual test cards not_required', () => {
    const meta = adminTestAutomationMetadata();
    expect(meta.automationSyncStatus).toBe('not_required');
  });

  it('marks Shopee automation cards not_required', () => {
    const meta = automationApiMetadata();
    expect(meta.creationSource).toBe('automation');
    expect(meta.automationSyncStatus).toBe('not_required');
  });
});

describe('Admin create → automation queue', () => {
  it('Admin Shared create stores pending admin metadata on insert row', async () => {
    let insertedRow: Record<string, unknown> | null = null;
    const supabase = {
      from(table: string) {
        if (table === 'digital_cards') {
          return {
            select() {
              return { eq: () => ({ eq: () => ({ async maybeSingle() { return { data: null, error: null }; } }) }) };
            },
            insert(row: Record<string, unknown>) {
              insertedRow = row;
              return {
                select() {
                  return {
                    async single() {
                      return {
                        data: { ...row, id: 'card-1', status: 'draft', theme: 'thank_you', animation: 'soft_reveal' },
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
                        data: { id: 'ord-1', order_number: 'HM-001-20260814120000', created_at: '2026-08-14T08:00:00.000Z' },
                        error: null,
                      };
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

    await createCardCore(supabase as never, {
      orderNumberInput: 'HM-001',
      automationMetadata: adminProductionAutomationMetadata(),
    });

    expect(insertedRow?.creation_source).toBe('admin');
    expect(insertedRow?.automation_sync_status).toBe('pending');
    expect(insertedRow?.platform).toBe(ADMIN_AUTOMATION_PLATFORM);
    expect(insertedRow?.external_order_id).toBeUndefined();
  });

  it('Admin Individual N=3 stores pending admin metadata', async () => {
    const supabase = createAutomationMockSupabase({ cards: [], recipients: [] });
    const result = await createIndividualCardCore(supabase as never, {
      orderNumberInput: 'HM-002',
      recipientCount: 3,
      platform: null,
      externalOrderId: null,
      automationMetadata: adminProductionAutomationMetadata(),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.recipients).toHaveLength(3);
    expect(supabase.state.cards[0]?.creation_source).toBe('admin');
    expect(supabase.state.cards[0]?.automation_sync_status).toBe('pending');
    expect(supabase.state.cards[0]?.platform).toBe(ADMIN_AUTOMATION_PLATFORM);
  });

  it('hidden Individual test metadata stays not_required', async () => {
    const supabase = createAutomationMockSupabase({ cards: [], recipients: [] });
    await createIndividualCardCore(supabase as never, {
      orderNumberInput: 'TEST-001',
      recipientCount: 2,
      automationMetadata: adminTestAutomationMetadata(),
    });
    expect(supabase.state.cards[0]?.automation_sync_status).toBe('not_required');
  });
});

describe('pending automation API', () => {
  const NOW = new Date('2026-08-14T10:00:00.000Z');

  it('returns only Admin Individual pending cards with canonical URLs', async () => {
    const pendingIndividual = individualCard({ id: 'card-ind-2' });
    const unexpectedSharedAdmin = sharedCard({
      id: 'unexpected-shared-admin',
      card_mode: 'shared',
      automation_sync_status: 'pending',
    });
    const automationCard = sharedCard({
      id: 'card-shopee',
      creation_source: 'automation',
      automation_sync_status: 'not_required',
      platform: 'shopee',
      external_order_id: '260810ABC123XY',
    });
    const readyAdmin = individualCard({
      id: 'card-ready',
      automation_sync_status: 'ready',
    });

    const supabase = createAutomationMockSupabase({
      cards: [pendingIndividual, unexpectedSharedAdmin, automationCard, readyAdmin],
      recipients: [
        recipient(1, 'tok1', 'card-ind-2'),
        recipient(2, 'tok2', 'card-ind-2'),
        recipient(3, 'tok3', 'card-ind-2'),
      ],
    });

    const result = await listPendingAdminAutomationCards(supabase as never, SITE_ORIGIN, NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.body.cards).toHaveLength(1);
    const payload = result.body.cards[0];
    expect(payload?.mode).toBe('individual');
    expect(payload?.platform).toBe('admin');
    expect(payload?.order_id).toBe('HM-001');
    expect(payload?.recipient_count).toBe(3);
    expect(payload).not.toHaveProperty('recipient_view_url');
    expect(payload).not.toHaveProperty('claim_stale');
    expect(payload?.recipients.map((row) => row.number)).toEqual([1, 2, 3]);
    expect(payload?.recipients.map((row) => row.view_url)).toEqual([
      'https://hommly.online/g/tok1',
      'https://hommly.online/g/tok2',
      'https://hommly.online/g/tok3',
    ]);
  });

  it('returns failed Admin Individual cards', async () => {
    const failed = individualCard({
      id: 'card-failed',
      automation_sync_status: 'failed',
      automation_last_error: 'print assets failed',
    });
    const supabase = createAutomationMockSupabase({
      cards: [failed],
      recipients: [recipient(1, 'tok1', 'card-failed')],
    });
    const result = await listPendingAdminAutomationCards(supabase as never, SITE_ORIGIN, NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.body.cards).toHaveLength(1);
    expect(result.body.cards[0]?.card_id).toBe('card-failed');
    expect(result.body.cards[0]?.automation_sync_status).toBe('failed');
    expect(result.body.cards[0]).not.toHaveProperty('claim_stale');
  });

  it('does not return fresh claimed cards', async () => {
    const freshClaimed = individualCard({
      id: 'card-fresh',
      automation_sync_status: 'claimed',
      automation_claimed_at: '2026-08-14T09:45:00.000Z',
    });
    const supabase = createAutomationMockSupabase({
      cards: [freshClaimed],
      recipients: [recipient(1, 'tok1', 'card-fresh')],
    });
    const result = await listPendingAdminAutomationCards(supabase as never, SITE_ORIGIN, NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.body.cards).toHaveLength(0);
  });

  it('returns stale claimed cards with actual claimed status', async () => {
    const staleClaimed = individualCard({
      id: 'card-stale',
      automation_sync_status: 'claimed',
      automation_claimed_at: '2026-08-14T09:29:59.000Z',
    });
    const supabase = createAutomationMockSupabase({
      cards: [staleClaimed],
      recipients: [recipient(1, 'tok1', 'card-stale')],
    });
    const result = await listPendingAdminAutomationCards(supabase as never, SITE_ORIGIN, NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.body.cards).toHaveLength(1);
    expect(result.body.cards[0]?.card_id).toBe('card-stale');
    expect(result.body.cards[0]?.automation_sync_status).toBe('claimed');
    expect(result.body.cards[0]?.claim_stale).toBe(true);
    expect(result.body.cards[0]?.mode).toBe('individual');
    expect(result.body.cards[0]).not.toHaveProperty('recipient_view_url');
  });

  it('treats claimed_at exactly at the 30-minute cutoff as still fresh', async () => {
    const atCutoff = individualCard({
      id: 'card-boundary',
      automation_sync_status: 'claimed',
      automation_claimed_at: '2026-08-14T09:30:00.000Z',
    });
    const supabase = createAutomationMockSupabase({
      cards: [atCutoff],
      recipients: [recipient(1, 'tok1', 'card-boundary')],
    });
    const result = await listPendingAdminAutomationCards(supabase as never, SITE_ORIGIN, NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.body.cards).toHaveLength(0);
  });

  it('returns claimed cards with missing claimed_at as stale', async () => {
    const missingTs = individualCard({
      id: 'card-missing-ts',
      automation_sync_status: 'claimed',
      automation_claimed_at: null,
    });
    const supabase = createAutomationMockSupabase({
      cards: [missingTs],
      recipients: [recipient(1, 'tok1', 'card-missing-ts')],
    });
    const result = await listPendingAdminAutomationCards(supabase as never, SITE_ORIGIN, NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.body.cards).toHaveLength(1);
    expect(result.body.cards[0]?.automation_sync_status).toBe('claimed');
    expect(result.body.cards[0]?.claim_stale).toBe(true);
  });

  it('does not return ready cards', async () => {
    const ready = individualCard({ id: 'card-ready-2', automation_sync_status: 'ready' });
    const supabase = createAutomationMockSupabase({
      cards: [ready],
      recipients: [recipient(1, 'tok1', 'card-ready-2')],
    });
    const result = await listPendingAdminAutomationCards(supabase as never, SITE_ORIGIN, NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.body.cards).toHaveLength(0);
  });

  it('excludes hidden individual-test, historical Shared, and Shopee automation cards', async () => {
    const hiddenTest = individualCard({
      id: 'card-hidden',
      automation_sync_status: 'not_required',
    });
    const historicalShared = sharedCard({
      id: 'card-shared-hist',
      card_mode: 'shared',
      automation_sync_status: 'pending',
    });
    const shopee = individualCard({
      id: 'card-shopee-ind',
      creation_source: 'automation',
      automation_sync_status: 'not_required',
      platform: 'shopee',
      external_order_id: '260810ABC123XY',
    });
    const supabase = createAutomationMockSupabase({
      cards: [hiddenTest, historicalShared, shopee],
      recipients: [recipient(1, 'tok1', 'card-hidden')],
    });
    const result = await listPendingAdminAutomationCards(supabase as never, SITE_ORIGIN, NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.body.cards).toHaveLength(0);
  });

  it('extracts admin order label without timestamp suffix', () => {
    expect(extractAdminOrderLabel('HM-001-20260814120000')).toBe('HM-001');
  });
});

describe('automation claim / ready / failed', () => {
  const NOW = new Date('2026-08-14T10:00:00.000Z');

  it('pending claim sets claimed_at and does not regenerate tokens', async () => {
    const card = individualCard();
    const supabase = createAutomationMockSupabase({
      cards: [card],
      recipients: [recipient(1, 'viewTok1')],
    });
    const originalToken = card.public_token;
    const originalViewToken = supabase.state.recipients[0]?.view_token;

    const first = await claimAdminAutomationCard(supabase as never, card.id, NOW);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.body.automation_sync_status).toBe('claimed');
    expect(supabase.state.cards[0].automation_claimed_at).toBe(NOW.toISOString());
    expect(supabase.state.cards[0].public_token).toBe(originalToken);
    expect(supabase.state.recipients[0]?.view_token).toBe(originalViewToken);
  });

  it('failed claim sets claimed_at', async () => {
    const card = individualCard({ automation_sync_status: 'failed' });
    const supabase = createAutomationMockSupabase({ cards: [card], recipients: [] });
    const result = await claimAdminAutomationCard(supabase as never, card.id, NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.body.automation_sync_status).toBe('claimed');
    expect(supabase.state.cards[0].automation_claimed_at).toBe(NOW.toISOString());
  });

  it('fresh claimed claim is idempotent and does not refresh claimed_at', async () => {
    const claimedAt = '2026-08-14T09:50:00.000Z';
    const card = individualCard({
      automation_sync_status: 'claimed',
      automation_claimed_at: claimedAt,
      public_token: 'keepPubTok',
    });
    const supabase = createAutomationMockSupabase({
      cards: [card],
      recipients: [recipient(1, 'keepViewTok')],
    });

    const result = await claimAdminAutomationCard(supabase as never, card.id, NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.body.automation_sync_status).toBe('claimed');
    expect(supabase.state.cards[0].automation_claimed_at).toBe(claimedAt);
    expect(supabase.state.cards[0].public_token).toBe('keepPubTok');
    expect(supabase.state.recipients[0]?.view_token).toBe('keepViewTok');
  });

  it('stale claimed reclaim refreshes claimed_at without changing tokens', async () => {
    const staleAt = '2026-08-14T09:20:00.000Z';
    const card = individualCard({
      automation_sync_status: 'claimed',
      automation_claimed_at: staleAt,
      public_token: 'keepPubTok',
    });
    const supabase = createAutomationMockSupabase({
      cards: [card],
      recipients: [recipient(1, 'keepViewTok')],
    });

    const result = await claimAdminAutomationCard(supabase as never, card.id, NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.body.automation_sync_status).toBe('claimed');
    expect(supabase.state.cards[0].automation_claimed_at).toBe(NOW.toISOString());
    expect(supabase.state.cards[0].public_token).toBe('keepPubTok');
    expect(supabase.state.recipients).toHaveLength(1);
    expect(supabase.state.recipients[0]?.view_token).toBe('keepViewTok');
    expect(supabase.state.recipients[0]?.recipient_number).toBe(1);
  });

  it('ready claim is idempotent and does not mutate claimed_at', async () => {
    const claimedAt = '2026-08-14T09:01:00.000Z';
    const card = individualCard({
      automation_sync_status: 'ready',
      automation_claimed_at: claimedAt,
    });
    const supabase = createAutomationMockSupabase({ cards: [card], recipients: [] });
    const first = await claimAdminAutomationCard(supabase as never, card.id, NOW);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.body.automation_sync_status).toBe('ready');
    const second = await claimAdminAutomationCard(supabase as never, card.id, NOW);
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.body.automation_sync_status).toBe('ready');
    expect(supabase.state.cards[0].automation_claimed_at).toBe(claimedAt);
    expect(supabase.state.cards[0].automation_sync_status).toBe('ready');
  });

  it('concurrent stale reclaim race keeps a single refreshed claim', async () => {
    const card = individualCard({
      automation_sync_status: 'claimed',
      automation_claimed_at: '2026-08-14T09:00:00.000Z',
    });
    const supabase = createAutomationMockSupabase({ cards: [card], recipients: [] });
    const [first, second] = await Promise.all([
      claimAdminAutomationCard(supabase as never, card.id, NOW),
      claimAdminAutomationCard(supabase as never, card.id, NOW),
    ]);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.body.automation_sync_status).toBe('claimed');
    expect(second.body.automation_sync_status).toBe('claimed');
    expect(supabase.state.cards[0].automation_sync_status).toBe('claimed');
    expect(supabase.state.cards[0].automation_claimed_at).toBe(NOW.toISOString());
  });

  it('rejects historical Shared admin cards from claim', async () => {
    const card = sharedCard({ card_mode: 'shared', automation_sync_status: 'pending' });
    const supabase = createAutomationMockSupabase({ cards: [card], recipients: [] });
    const result = await claimAdminAutomationCard(supabase as never, card.id, NOW);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.httpStatus).toBe(404);
  });

  it('rejects Shopee automation-created cards from claim', async () => {
    const card = individualCard({
      creation_source: 'automation',
      platform: 'shopee',
      external_order_id: '260810ABC123XY',
      automation_sync_status: 'pending',
    });
    const supabase = createAutomationMockSupabase({ cards: [card], recipients: [] });
    const result = await claimAdminAutomationCard(supabase as never, card.id, NOW);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.httpStatus).toBe(404);
  });

  it('ready is idempotent after claim', async () => {
    const card = individualCard({
      automation_sync_status: 'claimed',
      automation_claimed_at: '2026-08-14T08:01:00.000Z',
    });
    const supabase = createAutomationMockSupabase({ cards: [card], recipients: [] });

    const first = await markAdminAutomationReady(supabase as never, card.id);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.body.automation_sync_status).toBe('ready');

    const second = await markAdminAutomationReady(supabase as never, card.id);
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.body.automation_sync_status).toBe('ready');
  });

  it('failed then reclaim supports retry', async () => {
    const card = individualCard({ automation_sync_status: 'claimed' });
    const supabase = createAutomationMockSupabase({ cards: [card], recipients: [] });

    const failed = await markAdminAutomationFailed(supabase as never, card.id, 'Printer offline');
    expect(failed.ok).toBe(true);
    if (!failed.ok) return;
    expect(supabase.state.cards[0].automation_sync_status).toBe('failed');
    expect(supabase.state.cards[0].automation_last_error).toBe('Printer offline');

    const reclaim = await claimAdminAutomationCard(supabase as never, card.id, NOW);
    expect(reclaim.ok).toBe(true);
    if (!reclaim.ok) return;
    expect(reclaim.body.automation_sync_status).toBe('claimed');
    expect(supabase.state.cards[0].automation_claimed_at).toBe(NOW.toISOString());
  });
});

describe('automation auth and route guards', () => {
  const original = process.env.AUTOMATION_SECRET;

  afterEach(() => {
    if (original === undefined) delete process.env.AUTOMATION_SECRET;
    else process.env.AUTOMATION_SECRET = original;
  });

  it('requires bearer auth for internal automation routes', () => {
    process.env.AUTOMATION_SECRET = 'secret-value';
    expect(verifyAutomationRequest('Bearer secret-value').ok).toBe(true);
    expect(verifyAutomationRequest('Bearer wrong').ok).toBe(false);
    expect(parseBearerToken('Bearer secret-value')).toBe('secret-value');
  });

  it('registers pending and mutation routes with automation auth', () => {
    for (const route of [
      'app/api/internal/cards/pending-automation/route.ts',
      'app/api/internal/cards/automation-claim/route.ts',
      'app/api/internal/cards/automation-ready/route.ts',
      'app/api/internal/cards/automation-failed/route.ts',
    ]) {
      const source = fs.readFileSync(path.join(ROOT, route), 'utf8');
      expect(source).toMatch(/verifyInternalAutomationRequest/);
      expect(source).not.toMatch(/CUPS|Lark/i);
    }
  });

  it('migration defaults existing rows to not_required without pending backfill', () => {
    const sql = fs.readFileSync(
      path.join(ROOT, 'supabase/migrations/20260814180000_add_card_automation_sync.sql'),
      'utf8'
    );
    expect(sql).toMatch(/DEFAULT 'not_required'/);
    expect(sql).not.toMatch(/UPDATE digital_cards[\s\S]*pending/i);
  });

  it('Admin UI shows automation waiting copy', () => {
    const panel = fs.readFileSync(path.join(ROOT, 'components/admin/AdminAutomationStatusPanel.tsx'), 'utf8');
    const helpers = fs.readFileSync(path.join(ROOT, 'lib/card-automation.ts'), 'utf8');
    expect(panel).toMatch(/Waiting for Mac mini/);
    expect(panel).toMatch(/Print Full Set/);
    expect(panel).toMatch(/formatAutomationSyncStatusDetail/);
    expect(helpers).toMatch(/Mac mini is preparing this card/);
    expect(helpers).toMatch(/Preparation delayed — waiting for automatic retry/);
    expect(panel).not.toMatch(/physical printing is automatic/i);
  });

  it('actions use adminProductionAutomationMetadata for normal Admin create', () => {
    const source = fs.readFileSync(path.join(ROOT, 'lib/actions.ts'), 'utf8');
    expect(source).toMatch(/adminProductionAutomationMetadata\(\)/);
  });
});
