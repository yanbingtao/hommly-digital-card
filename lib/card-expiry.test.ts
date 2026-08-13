import { describe, expect, it } from 'vitest';
import { addMonths, subDays, subMonths } from 'date-fns';
import {
  CARD_HARD_DELETE_MONTHS,
  getDefaultOrderExpiry,
  getEffectiveExpiry,
  getHardDeleteAt,
  getOrderDate,
  isCardEligibleForHardDelete,
  isCardExpired,
} from './card-expiry';

const ORDER = '2026-08-13T08:00:00.000Z';
const FIXED_NOW = new Date('2026-08-13T12:00:00.000Z');

function card(overrides: Record<string, unknown> = {}) {
  return {
    status: 'published',
    first_published_at: null,
    published_at: null,
    expires_at_override: null,
    order: {
      ordered_at: ORDER,
      created_at: ORDER,
    },
    ...overrides,
  };
}

describe('order-date eCard lifecycle', () => {
  it('A. order date + 6 months expiry', () => {
    const orderDate = new Date(ORDER);
    expect(getOrderDate(card())?.toISOString()).toBe(ORDER);
    expect(getEffectiveExpiry(card())?.toISOString()).toBe(addMonths(orderDate, 6).toISOString());
    expect(getDefaultOrderExpiry(card())?.toISOString()).toBe('2027-02-13T08:00:00.000Z');
  });

  it('B. late publish does not extend expiry', () => {
    const latePublish = addMonths(new Date(ORDER), 1).toISOString();
    const withLatePublish = card({
      first_published_at: latePublish,
      published_at: latePublish,
      status: 'published',
    });
    expect(getEffectiveExpiry(withLatePublish)?.toISOString()).toBe('2027-02-13T08:00:00.000Z');
  });

  it('C. multiple republishes do not change expiry', () => {
    const first = card({
      first_published_at: '2026-09-01T00:00:00.000Z',
      published_at: '2026-10-01T00:00:00.000Z',
    });
    const second = card({
      first_published_at: '2026-09-01T00:00:00.000Z',
      published_at: '2026-11-15T00:00:00.000Z',
    });
    expect(getEffectiveExpiry(first)?.toISOString()).toBe(getEffectiveExpiry(second)?.toISOString());
    expect(getEffectiveExpiry(first)?.toISOString()).toBe('2027-02-13T08:00:00.000Z');
  });

  it('D. draft never published still expires 6 months after order', () => {
    const draft = card({ status: 'draft', first_published_at: null, published_at: null });
    expect(getEffectiveExpiry(draft)?.toISOString()).toBe('2027-02-13T08:00:00.000Z');
    expect(
      isCardExpired({
        ...draft,
        // force "now" via comparing hard times — use eligibility helpers with fixed now
      })
    ).toBe(false);

    const oldDraft = card({
      status: 'draft',
      order: {
        ordered_at: subMonths(FIXED_NOW, 7).toISOString(),
        created_at: subMonths(FIXED_NOW, 7).toISOString(),
      },
    });
    const expiresAt = getEffectiveExpiry(oldDraft)!;
    expect(FIXED_NOW.getTime() >= expiresAt.getTime()).toBe(true);
  });

  it('E. hard cleanup at order date + 7 months', () => {
    const orderDate = new Date(ORDER);
    expect(getHardDeleteAt(card())?.toISOString()).toBe(addMonths(orderDate, 7).toISOString());
    expect(getHardDeleteAt(card())?.toISOString()).toBe('2027-03-13T08:00:00.000Z');

    const eligible = card({
      order: {
        ordered_at: subMonths(FIXED_NOW, 8).toISOString(),
        created_at: subMonths(FIXED_NOW, 8).toISOString(),
      },
    });
    expect(isCardEligibleForHardDelete(eligible, FIXED_NOW.getTime())).toBe(true);

    const notYet = card({
      order: {
        ordered_at: subMonths(FIXED_NOW, 6).toISOString(),
        created_at: subMonths(FIXED_NOW, 6).toISOString(),
      },
    });
    expect(isCardEligibleForHardDelete(notYet, FIXED_NOW.getTime())).toBe(false);
  });

  it('F. admin override takes precedence and cleanup uses override + 1 month', () => {
    const override = '2027-06-30T12:00:00.000Z';
    const withOverride = card({ expires_at_override: override });
    expect(getEffectiveExpiry(withOverride)?.toISOString()).toBe(override);
    expect(getDefaultOrderExpiry(withOverride)?.toISOString()).toBe('2027-02-13T08:00:00.000Z');
    expect(getHardDeleteAt(withOverride)?.toISOString()).toBe(
      addMonths(new Date(override), 1).toISOString()
    );
  });

  it('does not use first_published_at when order is older', () => {
    const c = card({
      first_published_at: subDays(subMonths(FIXED_NOW, 1), 0).toISOString(),
      order: {
        ordered_at: subMonths(FIXED_NOW, 10).toISOString(),
        created_at: subMonths(FIXED_NOW, 10).toISOString(),
      },
    });
    expect(isCardEligibleForHardDelete(c, FIXED_NOW.getTime())).toBe(true);
    expect(getOrderDate(c)?.toISOString()).toBe(subMonths(FIXED_NOW, 10).toISOString());
  });

  it('falls back to orders.created_at when ordered_at missing', () => {
    const c = card({
      order: { created_at: ORDER, ordered_at: null },
    });
    expect(getOrderDate(c)?.toISOString()).toBe(ORDER);
  });

  it('G. calendar month boundaries via date-fns addMonths', () => {
    const jan31 = new Date('2024-01-31T00:00:00.000Z');
    const c = card({
      order: { ordered_at: jan31.toISOString(), created_at: jan31.toISOString() },
    });
    expect(getEffectiveExpiry(c)?.toISOString()).toBe(addMonths(jan31, 6).toISOString());
    expect(getHardDeleteAt(c)?.toISOString()).toBe(addMonths(jan31, CARD_HARD_DELETE_MONTHS).toISOString());

    const aug31 = new Date('2025-08-31T00:00:00.000Z');
    const leap = new Date('2024-02-29T00:00:00.000Z');
    expect(getEffectiveExpiry(card({
      order: { ordered_at: aug31.toISOString(), created_at: aug31.toISOString() },
    }))?.toISOString()).toBe(addMonths(aug31, 6).toISOString());
    expect(getEffectiveExpiry(card({
      order: { ordered_at: leap.toISOString(), created_at: leap.toISOString() },
    }))?.toISOString()).toBe(addMonths(leap, 6).toISOString());
  });
});
