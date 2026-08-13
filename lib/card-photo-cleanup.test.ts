import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { subMonths } from 'date-fns';
import { ORPHAN_MEDIA_SAFE_AGE_MS } from './card-photo-cleanup';

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  listDigitalCardMediaForCard: vi.fn(),
  cleanupUnreferencedMediaIds: vi.fn(),
  deleteCardPhoto: vi.fn(),
}));

vi.mock('./supabase-admin', () => ({
  getSupabaseAdmin: () => ({ from: mocks.from }),
}));

vi.mock('./digital-card-media', () => ({
  listDigitalCardMediaForCard: mocks.listDigitalCardMediaForCard,
  cleanupUnreferencedMediaIds: mocks.cleanupUnreferencedMediaIds,
  deleteAllDigitalCardMediaForCard: vi.fn(),
}));

vi.mock('./card-photo-storage', () => ({
  deleteCardPhoto: mocks.deleteCardPhoto,
  logPhotoCleanupIssue: vi.fn(),
}));

const NOW = new Date('2026-08-13T12:00:00.000Z');

function orderWithCard(overrides: {
  orderId: string;
  cardId: string;
  orderedAt: string;
  card_mode?: string;
  photo_path?: string | null;
  status?: string;
  expires_at_override?: string | null;
  first_published_at?: string | null;
}) {
  return {
    id: overrides.orderId,
    created_at: overrides.orderedAt,
    ordered_at: overrides.orderedAt,
    digital_cards: [
      {
        id: overrides.cardId,
        order_id: overrides.orderId,
        card_mode: overrides.card_mode ?? 'shared',
        photo_path: overrides.photo_path ?? null,
        status: overrides.status ?? 'draft',
        created_at: overrides.orderedAt,
        first_published_at: overrides.first_published_at ?? null,
        published_at: null,
        expires_at_override: overrides.expires_at_override ?? null,
      },
    ],
  };
}

function mockRangeChain(result: { data: unknown; error: null | { message: string } }) {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  chain.select = self;
  chain.or = self;
  chain.order = self;
  chain.eq = self;
  chain.lt = self;
  chain.not = self;
  chain.limit = async () => result;
  chain.range = async () => result;
  return chain;
}

function mockOrdersTable(options: {
  selectPages: unknown[][];
  deletedOrders?: string[];
}) {
  let selectPage = 0;
  return {
    select: () => {
      const page = options.selectPages[selectPage] ?? [];
      selectPage += 1;
      return mockRangeChain({ data: page, error: null });
    },
    delete: () => ({
      eq: async (_col: string, id: string) => {
        options.deletedOrders?.push(id);
        return { error: null };
      },
    }),
  };
}

describe('cleanupExpiredCardsAndPhotos', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    mocks.listDigitalCardMediaForCard.mockResolvedValue({ media: [], error: null });
    mocks.deleteCardPhoto.mockResolvedValue({ ok: true, path: 'x' });
    mocks.cleanupUnreferencedMediaIds.mockResolvedValue({ cleaned: [], errors: [] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('hard-deletes by order date + 7 months; late publish does not protect', async () => {
    const deletedOrders: string[] = [];
    const candidates = [
      orderWithCard({
        orderId: 'o-old',
        cardId: 'c-old',
        orderedAt: subMonths(NOW, 8).toISOString(),
        photo_path: 'cards/c-old/photo.webp',
        first_published_at: subMonths(NOW, 2).toISOString(),
      }),
      orderWithCard({
        orderId: 'o-recent',
        cardId: 'c-recent',
        orderedAt: subMonths(NOW, 6).toISOString(),
      }),
    ];
    const ordersTable = mockOrdersTable({ selectPages: [candidates, []], deletedOrders });

    mocks.from.mockImplementation((table: string) => {
      if (table === 'orders') {
        return ordersTable;
      }
      if (table === 'digital_cards') {
        return mockRangeChain({ data: [], error: null });
      }
      if (table === 'digital_card_recipients') {
        return {
          select: () => ({
            eq: async () => ({ data: [], error: null }),
          }),
        };
      }
      if (table === 'digital_card_media') {
        return mockRangeChain({ data: [], error: null });
      }
      throw new Error(`unexpected table ${table}`);
    });

    const { cleanupExpiredCardsAndPhotos } = await import('./card-photo-cleanup');
    const result = await cleanupExpiredCardsAndPhotos();

    expect(result.expiredCardsDeleted).toBe(1);
    expect(deletedOrders).toEqual(['o-old']);
  });

  it('deletes individual recipients after storage cleanup', async () => {
    const orderedAt = subMonths(NOW, 8).toISOString();
    const ordersTable = mockOrdersTable({
      selectPages: [
        [
          orderWithCard({
            orderId: 'o-ind',
            cardId: 'ind-old',
            orderedAt,
            card_mode: 'individual',
            status: 'published',
            first_published_at: orderedAt,
          }),
        ],
        [],
      ],
    });
    mocks.from.mockImplementation((table: string) => {
      if (table === 'orders') {
        return ordersTable;
      }
      if (table === 'digital_cards') {
        return mockRangeChain({ data: [], error: null });
      }
      if (table === 'digital_card_recipients') {
        return {
          select: () => ({
            eq: async () => ({
              data: [
                { id: 'r1', photo_path: 'cards/ind-old/recipients/r1/photo.webp' },
                { id: 'r2', photo_path: null },
              ],
              error: null,
            }),
          }),
        };
      }
      if (table === 'digital_card_media') {
        return mockRangeChain({ data: [], error: null });
      }
      throw new Error(`unexpected table ${table}`);
    });

    mocks.listDigitalCardMediaForCard.mockResolvedValue({
      media: [
        { id: 'm1', storage_path: 'cards/ind-old/media/m1.webp' },
        { id: 'm2', storage_path: 'cards/ind-old/media/m2.webp' },
      ],
      error: null,
    });

    const { cleanupExpiredCardsAndPhotos } = await import('./card-photo-cleanup');
    const result = await cleanupExpiredCardsAndPhotos();

    expect(result.expiredCardsDeleted).toBe(1);
    expect(result.recipientsDeleted).toBe(2);
    expect(result.mediaRowsDeleted).toBe(2);
    expect(result.legacyPathsDeleted).toBe(1);
  });

  it('respects future admin expiry override', async () => {
    const ordersTable = mockOrdersTable({
      selectPages: [
        [
          orderWithCard({
            orderId: 'o-keep',
            cardId: 'override-keep',
            orderedAt: subMonths(NOW, 12).toISOString(),
            expires_at_override: new Date(NOW.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString(),
          }),
        ],
        [],
      ],
    });
    mocks.from.mockImplementation((table: string) => {
      if (table === 'orders') {
        return ordersTable;
      }
      if (table === 'digital_cards') {
        return mockRangeChain({ data: [], error: null });
      }
      if (table === 'digital_card_media') {
        return mockRangeChain({ data: [], error: null });
      }
      return mockRangeChain({ data: [], error: null });
    });

    const { cleanupExpiredCardsAndPhotos } = await import('./card-photo-cleanup');
    const result = await cleanupExpiredCardsAndPhotos();
    expect(result.expiredCardsDeleted).toBe(0);
  });

  it('reports storage failure and continues with other cards', async () => {
    const deletedOrders: string[] = [];
    const ordersTable = mockOrdersTable({
      selectPages: [
        [
          orderWithCard({
            orderId: 'o-bad',
            cardId: 'bad',
            orderedAt: subMonths(NOW, 8).toISOString(),
            photo_path: 'cards/bad/photo.webp',
          }),
          orderWithCard({
            orderId: 'o-good',
            cardId: 'good',
            orderedAt: subMonths(NOW, 8).toISOString(),
            photo_path: 'cards/good/photo.webp',
          }),
        ],
        [],
      ],
      deletedOrders,
    });
    mocks.from.mockImplementation((table: string) => {
      if (table === 'orders') {
        return ordersTable;
      }
      if (table === 'digital_cards') {
        return mockRangeChain({ data: [], error: null });
      }
      if (table === 'digital_card_recipients') {
        return {
          select: () => ({
            eq: async () => ({ data: [], error: null }),
          }),
        };
      }
      if (table === 'digital_card_media') {
        return mockRangeChain({ data: [], error: null });
      }
      throw new Error(`unexpected table ${table}`);
    });

    mocks.deleteCardPhoto.mockImplementation(async (path: string) => {
      if (path.includes('bad')) {
        return { ok: false, path, error: 'storage down' };
      }
      return { ok: true, path };
    });

    const { cleanupExpiredCardsAndPhotos } = await import('./card-photo-cleanup');
    const result = await cleanupExpiredCardsAndPhotos();

    expect(result.errors.some((e) => e.includes('bad'))).toBe(true);
    expect(deletedOrders).toEqual(['o-good']);
    expect(result.expiredCardsDeleted).toBe(1);
  });

  it('is idempotent when a second run finds no cards', async () => {
    const ordersTable = mockOrdersTable({ selectPages: [[], []] });
    mocks.from.mockImplementation((table: string) => {
      if (table === 'orders') {
        return ordersTable;
      }
      return mockRangeChain({ data: [], error: null });
    });

    const { cleanupExpiredCardsAndPhotos } = await import('./card-photo-cleanup');
    const first = await cleanupExpiredCardsAndPhotos();
    const second = await cleanupExpiredCardsAndPhotos();
    expect(first.expiredCardsDeleted).toBe(0);
    expect(second.expiredCardsDeleted).toBe(0);
  });
});

describe('orphan media safety window', () => {
  it('uses a 24h safety age', () => {
    expect(ORPHAN_MEDIA_SAFE_AGE_MS).toBe(24 * 60 * 60 * 1000);
  });
});
