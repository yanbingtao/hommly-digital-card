import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ORPHAN_MEDIA_SAFE_AGE_MS } from './card-photo-cleanup';

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  deleteAllDigitalCardMediaForCard: vi.fn(),
  cleanupUnreferencedMediaIds: vi.fn(),
  deleteCardPhoto: vi.fn(),
  clearCardPhotoMetadata: vi.fn(),
  isCardExpired: vi.fn(),
  getEffectiveExpiry: vi.fn(),
}));

vi.mock('./supabase-admin', () => ({
  getSupabaseAdmin: () => ({ from: mocks.from }),
}));

vi.mock('./digital-card-media', () => ({
  deleteAllDigitalCardMediaForCard: mocks.deleteAllDigitalCardMediaForCard,
  cleanupUnreferencedMediaIds: mocks.cleanupUnreferencedMediaIds,
  listDigitalCardMediaForCard: vi.fn(),
}));

vi.mock('./card-photo-storage', () => ({
  deleteCardPhoto: mocks.deleteCardPhoto,
  clearCardPhotoMetadata: mocks.clearCardPhotoMetadata,
  logPhotoCleanupIssue: vi.fn(),
}));

vi.mock('./card-expiry', () => ({
  isCardExpired: mocks.isCardExpired,
  getEffectiveExpiry: mocks.getEffectiveExpiry,
}));

describe('cleanupExpiredCardPhotos', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('cleans expired individual media and legacy paths, preserves non-expired', async () => {
    const cards = [
      { id: 'ind-expired', card_mode: 'individual', photo_path: null },
      { id: 'shared-ok', card_mode: 'shared', photo_path: 'cards/shared-ok/photo.webp' },
      { id: 'shared-expired', card_mode: 'shared', photo_path: 'cards/shared-expired/photo.webp' },
    ];

    mocks.from.mockImplementation((table: string) => {
      if (table === 'digital_cards') {
        return {
          select: () => ({
            or: async () => ({ data: cards, error: null }),
          }),
        };
      }
      if (table === 'digital_card_recipients') {
        return {
          select: () => ({
            eq: () => ({
              not: async () => ({
                data: [{ id: 'r1', photo_path: 'cards/ind-expired/recipients/r1/photo.webp' }],
                error: null,
              }),
            }),
          }),
          update: () => ({
            eq: () => ({
              not: async () => ({ error: null }),
            }),
          }),
        };
      }
      if (table === 'digital_card_media') {
        return {
          select: () => ({
            lt: () => ({
              limit: async () => ({ data: [], error: null }),
            }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    });

    mocks.isCardExpired.mockImplementation((card: { id: string }) =>
      card.id.includes('expired')
    );
    mocks.getEffectiveExpiry.mockReturnValue(null);
    mocks.deleteAllDigitalCardMediaForCard.mockResolvedValue({
      deletedRows: 2,
      deletedPaths: ['a', 'b'],
      errors: [],
    });
    mocks.deleteCardPhoto.mockResolvedValue({ ok: true, path: 'x' });
    mocks.clearCardPhotoMetadata.mockResolvedValue(undefined);
    mocks.cleanupUnreferencedMediaIds.mockResolvedValue({ cleaned: [], errors: [] });

    const { cleanupExpiredCardPhotos } = await import('./card-photo-cleanup');
    const result = await cleanupExpiredCardPhotos();

    expect(result.cleaned).toBe(2);
    expect(result.mediaRowsDeleted).toBe(2);
    expect(result.storageFilesDeleted).toBeGreaterThanOrEqual(2);
    expect(result.legacyPathsDeleted).toBe(1);
    expect(mocks.clearCardPhotoMetadata).toHaveBeenCalledWith(expect.anything(), 'shared-expired');
    expect(mocks.deleteAllDigitalCardMediaForCard).toHaveBeenCalledWith(
      expect.anything(),
      'ind-expired'
    );
  });

  it('continues after one card failure', async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === 'digital_cards') {
        return {
          select: () => ({
            or: async () => ({
              data: [
                { id: 'bad', card_mode: 'individual', photo_path: null },
                { id: 'good', card_mode: 'shared', photo_path: 'cards/good/photo.webp' },
              ],
              error: null,
            }),
          }),
        };
      }
      if (table === 'digital_card_media') {
        return {
          select: () => ({
            lt: () => ({
              limit: async () => ({ data: [], error: null }),
            }),
          }),
        };
      }
      return {
        select: () => ({
          eq: () => ({
            not: async () => ({ data: [], error: null }),
          }),
        }),
      };
    });

    mocks.isCardExpired.mockReturnValue(true);
    mocks.getEffectiveExpiry.mockReturnValue(null);
    mocks.deleteAllDigitalCardMediaForCard.mockRejectedValueOnce(new Error('boom'));
    mocks.deleteCardPhoto.mockResolvedValue({ ok: true, path: 'cards/good/photo.webp' });
    mocks.clearCardPhotoMetadata.mockResolvedValue(undefined);
    mocks.cleanupUnreferencedMediaIds.mockResolvedValue({ cleaned: [], errors: [] });

    const { cleanupExpiredCardPhotos } = await import('./card-photo-cleanup');
    const result = await cleanupExpiredCardPhotos();

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.cleaned).toBe(1);
  });
});

describe('orphan media safety window', () => {
  it('uses a 24h safety age', () => {
    expect(ORPHAN_MEDIA_SAFE_AGE_MS).toBe(24 * 60 * 60 * 1000);
  });
});
