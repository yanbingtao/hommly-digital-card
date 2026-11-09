import { describe, expect, it } from 'vitest';
import { chooseAdminCard, parseManualLookupQuery } from './manual-card-lookup';
import type { CardWithOrder } from './types';

function card(id: string, orderNumber: string, source: 'admin' | 'automation' = 'admin'): CardWithOrder {
  return {
    id,
    order_id: `ord-${id}`,
    card_mode: 'individual',
    public_token: 'pub',
    edit_token: 'edit',
    message: null,
    theme: 'birthday',
    animation: 'none',
    status: 'published',
    created_at: '2026-11-09T00:00:00.000Z',
    updated_at: '2026-11-09T00:00:00.000Z',
    published_at: null,
    creation_source: source,
    order: {
      id: `ord-${id}`,
      order_number: orderNumber,
      created_at: '2026-11-09T00:00:00.000Z',
    },
  };
}

describe('parseManualLookupQuery', () => {
  it('accepts a Shopify GID only for Shopify', () => {
    const gid = 'gid://shopify/Order/9001';
    const shopify = parseManualLookupQuery(
      new URLSearchParams({ platform: 'shopify', order_id: gid })
    );
    expect(shopify.ok).toBe(true);
    const shopee = parseManualLookupQuery(
      new URLSearchParams({ platform: 'shopee', order_id: gid })
    );
    expect(shopee.ok).toBe(false);
  });

  it('keeps Shopee ids on Shopee and rejects them for Shopify', () => {
    expect(
      parseManualLookupQuery(
        new URLSearchParams({ platform: 'shopee', order_id: '260823CANARY01' })
      ).ok
    ).toBe(true);
    expect(
      parseManualLookupQuery(
        new URLSearchParams({ platform: 'shopify', order_id: '260823CANARY01' })
      ).ok
    ).toBe(false);
  });

  it('rejects a missing identifier', () => {
    const parsed = parseManualLookupQuery(new URLSearchParams({ platform: 'admin' }));
    expect(parsed.ok).toBe(false);
  });
});

describe('chooseAdminCard', () => {
  const setId = '11111111-1111-4111-8111-111111111111';
  const cards = [
    card(setId, 'HM-001-20261109090000'),
    card('22222222-2222-4222-8222-222222222222', 'HM-001-20261109100000'),
    card('33333333-3333-4333-8333-333333333333', 'WALKIN-9', 'automation'),
  ];

  it('finds one set by UUID or full order number', () => {
    const byId = chooseAdminCard(cards, setId);
    expect(byId.ok).toBe(true);
    const byNumber = chooseAdminCard(cards, 'HM-001-20261109090000');
    expect(byNumber.ok).toBe(true);
    if (byNumber.ok) {
      expect(byNumber.card.id).toBe(setId);
    }
  });

  it('does not treat a shared label as one set', () => {
    const ambiguous = chooseAdminCard(cards, 'HM-001');
    expect(ambiguous.ok).toBe(false);
    if (!ambiguous.ok) {
      expect(ambiguous.httpStatus).toBe(409);
    }
  });

  it('ignores automation cards', () => {
    const missing = chooseAdminCard(cards, 'WALKIN-9');
    expect(missing.ok).toBe(false);
  });
});
