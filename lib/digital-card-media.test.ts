import fs from 'fs';
import path from 'path';
import { describe, expect, it, vi } from 'vitest';
import { getPhotoPathForResolvedView } from './card-photo-access';
import { hasCardPhoto, hasRecipientPhoto, normalizeIndividualMediaStoragePath } from './card-photo';
import { toRecipientDisplayMeta } from './recipient-display-card';
import {
  assignPhotoMediaToRecipients,
  cleanupUnreferencedMediaIds,
  clearPhotoMediaFromRecipients,
  countRecipientMediaReferences,
  createDigitalCardPhotoMedia,
  deleteAllDigitalCardMediaForCard,
  deleteDigitalCardMediaIfUnreferenced,
  resolveRecipientPhotoStoragePath,
  uploadIndividualPhotoMediaCore,
} from './digital-card-media';
import type { CardWithOrder, DigitalCardMedia, DigitalCardRecipient } from './types';

const ROOT = path.join(__dirname, '..');
const MIGRATION_PATH = path.join(
  ROOT,
  'supabase/migrations/20260812160000_add_digital_card_media.sql'
);

function media(overrides?: Partial<DigitalCardMedia>): DigitalCardMedia {
  return {
    id: 'media-a',
    digital_card_id: 'card-ind-1',
    storage_path: 'cards/card-ind-1/media/media-a.webp',
    original_name: 'photo.webp',
    mime_type: 'image/webp',
    size_bytes: 1024,
    media_type: 'photo',
    created_at: '2026-08-12T08:00:00.000Z',
    updated_at: '2026-08-12T08:00:00.000Z',
    ...overrides,
  };
}

function mediaB(): DigitalCardMedia {
  return media({
    id: 'media-b',
    storage_path: 'cards/card-ind-1/media/media-b.webp',
  });
}

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

function createMediaMockSupabase(options?: {
  recipients?: DigitalCardRecipient[];
  mediaRows?: DigitalCardMedia[];
}) {
  const recipients = (options?.recipients ?? []).map((row) => ({ ...row }));
  const mediaRows = (options?.mediaRows ?? []).map((row) => ({ ...row }));
  const deletedStorage: string[] = [];

  const supabase = {
    from(table: string) {
      if (table === 'digital_card_recipients') {
        return {
          select(columns?: string, opts?: { count?: string; head?: boolean }) {
            if (opts?.head) {
              return {
                eq(column: string, value: unknown) {
                  const count = recipients.filter(
                    (row) => row[column as keyof DigitalCardRecipient] === value
                  ).length;
                  return Promise.resolve({ count, error: null });
                },
              };
            }

            return {
              eq(column: string, value: unknown) {
                return {
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
                            values.includes(row[column2 as keyof DigitalCardRecipient])
                        );
                        for (const row of matched) {
                          Object.assign(row, patch);
                        }
                        return Promise.resolve({
                          data: matched.map((row) => ({ id: row.id })),
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

      if (table === 'digital_card_media') {
        return {
          select() {
            return {
              eq(column: string, value: unknown) {
                const rows =
                  column === 'digital_card_id'
                    ? mediaRows.filter((row) => row.digital_card_id === value)
                    : mediaRows.filter((row) => row[column as keyof DigitalCardMedia] === value);

                return {
                  async maybeSingle() {
                    return { data: rows[0] ?? null, error: null };
                  },
                  then(onFulfilled: (value: unknown) => unknown) {
                    return Promise.resolve({ data: rows, error: null }).then(onFulfilled);
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
                    const created = { ...(row as DigitalCardMedia) };
                    mediaRows.push(created);
                    return { data: created, error: null };
                  },
                };
              },
            };
          },
          delete() {
            return {
              eq(column: string, value: unknown) {
                const index = mediaRows.findIndex((row) => row[column as keyof DigitalCardMedia] === value);
                let removed: DigitalCardMedia[] = [];
                if (column === 'digital_card_id') {
                  removed = mediaRows.filter((row) => row.digital_card_id === value);
                  for (let i = mediaRows.length - 1; i >= 0; i -= 1) {
                    if (mediaRows[i]!.digital_card_id === value) mediaRows.splice(i, 1);
                  }
                } else if (index >= 0) {
                  removed = [mediaRows[index]!];
                  mediaRows.splice(index, 1);
                }
                return {
                  select() {
                    return Promise.resolve({ data: removed.map((row) => ({ id: row.id })), error: null });
                  },
                };
              },
            };
          },
        };
      }

      throw new Error(`unexpected table ${table}`);
    },
    _state: { recipients, mediaRows, deletedStorage },
  };

  return supabase;
}

describe('digital_card_media migration', () => {
  it('defines media table, FK, and RLS without broad anon policies', () => {
    const sql = fs.readFileSync(MIGRATION_PATH, 'utf8');
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS digital_card_media/);
    expect(sql).toMatch(/photo_media_id uuid/);
    expect(sql).toMatch(/REFERENCES digital_card_media\(id\)/);
    expect(sql).toMatch(/ON DELETE SET NULL/);
    expect(sql).toMatch(/ENABLE ROW LEVEL SECURITY/);
    expect(sql).not.toMatch(/CREATE POLICY.*digital_card_media/i);
  });
});

describe('storage path strategy', () => {
  it('uses card-scoped media path without recipient number', () => {
    expect(normalizeIndividualMediaStoragePath('card-ind-1', 'media-a', 'image/webp')).toBe(
      'cards/card-ind-1/media/media-a.webp'
    );
  });
});

describe('resolveRecipientPhotoStoragePath', () => {
  it('prefers photo_media_id storage path', () => {
    const row = recipient(1, { photo_media_id: 'media-a', photo_path: 'legacy/path.webp' });
    expect(resolveRecipientPhotoStoragePath(row, media())).toBe(
      'cards/card-ind-1/media/media-a.webp'
    );
  });

  it('falls back to legacy recipient photo_path', () => {
    const row = recipient(1, { photo_path: 'cards/card-ind-1/recipients/r1/photo.webp' });
    expect(resolveRecipientPhotoStoragePath(row, null)).toBe(
      'cards/card-ind-1/recipients/r1/photo.webp'
    );
  });

  it('rejects cross-card media references', () => {
    const row = recipient(1, { photo_media_id: 'media-a' });
    expect(
      resolveRecipientPhotoStoragePath(row, media({ digital_card_id: 'other-card' }))
    ).toBeNull();
  });
});

describe('assignPhotoMediaToRecipients', () => {
  it('assigns one media asset to one recipient', async () => {
    const supabase = createMediaMockSupabase({
      mediaRows: [media()],
      recipients: [recipient(1), recipient(2), recipient(3)],
    });
    const result = await assignPhotoMediaToRecipients(supabase as never, {
      digitalCardId: 'card-ind-1',
      recipientIds: ['recipient-1'],
      mediaId: 'media-a',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.updatedCount).toBe(1);
    expect(supabase._state.recipients[0]!.photo_media_id).toBe('media-a');
    expect(supabase._state.recipients[1]!.photo_media_id).toBeNull();
  });

  it('assigns one media asset to many recipients without duplicating media rows', async () => {
    const supabase = createMediaMockSupabase({
      mediaRows: [media()],
      recipients: [recipient(1), recipient(2), recipient(3)],
    });
    const result = await assignPhotoMediaToRecipients(supabase as never, {
      digitalCardId: 'card-ind-1',
      recipientIds: ['recipient-1', 'recipient-2', 'recipient-3'],
      mediaId: 'media-a',
    });
    expect(result.ok).toBe(true);
    expect(supabase._state.mediaRows).toHaveLength(1);
    expect(supabase._state.recipients.every((row) => row.photo_media_id === 'media-a')).toBe(true);
  });

  it('supports single-recipient override while siblings keep original media', async () => {
    const supabase = createMediaMockSupabase({
      mediaRows: [media(), mediaB()],
      recipients: [
        recipient(1, { photo_media_id: 'media-a' }),
        recipient(2, { photo_media_id: 'media-a' }),
        recipient(3, { photo_media_id: 'media-a' }),
      ],
    });
    const result = await assignPhotoMediaToRecipients(supabase as never, {
      digitalCardId: 'card-ind-1',
      recipientIds: ['recipient-2'],
      mediaId: 'media-b',
    });
    expect(result.ok).toBe(true);
    expect(supabase._state.recipients[0]!.photo_media_id).toBe('media-a');
    expect(supabase._state.recipients[1]!.photo_media_id).toBe('media-b');
    expect(supabase._state.recipients[2]!.photo_media_id).toBe('media-a');
  });

  it('rejects cross-card media assignment', async () => {
    const supabase = createMediaMockSupabase({
      mediaRows: [media({ digital_card_id: 'other-card' })],
      recipients: [recipient(1)],
    });
    const result = await assignPhotoMediaToRecipients(supabase as never, {
      digitalCardId: 'card-ind-1',
      recipientIds: ['recipient-1'],
      mediaId: 'media-a',
    });
    expect(result.ok).toBe(false);
  });

  it('rejects recipient from another card', async () => {
    const supabase = createMediaMockSupabase({
      mediaRows: [media()],
      recipients: [recipient(1, { digital_card_id: 'other-card' })],
    });
    const result = await assignPhotoMediaToRecipients(supabase as never, {
      digitalCardId: 'card-ind-1',
      recipientIds: ['recipient-1'],
      mediaId: 'media-a',
    });
    expect(result.ok).toBe(false);
  });
});

describe('clearPhotoMediaFromRecipients', () => {
  it('clears photo from selected recipients only', async () => {
    const supabase = createMediaMockSupabase({
      recipients: [
        recipient(1, { photo_media_id: 'media-a' }),
        recipient(2, { photo_media_id: 'media-a' }),
        recipient(3, { photo_media_id: 'media-a' }),
      ],
    });
    const result = await clearPhotoMediaFromRecipients(supabase as never, {
      digitalCardId: 'card-ind-1',
      recipientIds: ['recipient-2'],
    });
    expect(result.ok).toBe(true);
    expect(supabase._state.recipients[0]!.photo_media_id).toBe('media-a');
    expect(supabase._state.recipients[1]!.photo_media_id).toBeNull();
    expect(supabase._state.recipients[2]!.photo_media_id).toBe('media-a');
  });
});

describe('reference counting and deletion', () => {
  it('counts recipient references to media', async () => {
    const supabase = createMediaMockSupabase({
      recipients: [
        recipient(1, { photo_media_id: 'media-a' }),
        recipient(2, { photo_media_id: 'media-a' }),
        recipient(3, { photo_media_id: 'media-b' }),
      ],
    });
    const refs = await countRecipientMediaReferences(supabase as never, 'media-a');
    expect(refs.count).toBe(2);
  });

  it('does not delete referenced media', async () => {
    const deleteSpy = vi.spyOn(await import('./card-photo-storage'), 'deleteCardPhoto');
    const supabase = createMediaMockSupabase({
      mediaRows: [media()],
      recipients: [recipient(1, { photo_media_id: 'media-a' })],
    });
    const result = await deleteDigitalCardMediaIfUnreferenced(supabase as never, 'media-a');
    expect(result.deleted).toBe(false);
    expect(supabase._state.mediaRows).toHaveLength(1);
    expect(deleteSpy).not.toHaveBeenCalled();
    deleteSpy.mockRestore();
  });

  it('deletes zero-reference media row and storage', async () => {
    const deleteSpy = vi
      .spyOn(await import('./card-photo-storage'), 'deleteCardPhoto')
      .mockResolvedValue(undefined);
    const supabase = createMediaMockSupabase({
      mediaRows: [media()],
      recipients: [recipient(1, { photo_media_id: null })],
    });
    const result = await deleteDigitalCardMediaIfUnreferenced(supabase as never, 'media-a');
    expect(result.deleted).toBe(true);
    expect(supabase._state.mediaRows).toHaveLength(0);
    expect(deleteSpy).toHaveBeenCalledWith('cards/card-ind-1/media/media-a.webp');
    deleteSpy.mockRestore();
  });

  it('replacing subset does not delete old shared media', async () => {
    const deleteSpy = vi
      .spyOn(await import('./card-photo-storage'), 'deleteCardPhoto')
      .mockResolvedValue(undefined);
    const supabase = createMediaMockSupabase({
      mediaRows: [media(), mediaB()],
      recipients: [
        recipient(1, { photo_media_id: 'media-a' }),
        recipient(2, { photo_media_id: 'media-a' }),
        recipient(3, { photo_media_id: 'media-a' }),
      ],
    });
    const assign = await assignPhotoMediaToRecipients(supabase as never, {
      digitalCardId: 'card-ind-1',
      recipientIds: ['recipient-2'],
      mediaId: 'media-b',
    });
    expect(assign.ok).toBe(true);
    if (!assign.ok) return;

    const cleaned = await cleanupUnreferencedMediaIds(supabase as never, assign.previousMediaIds);
    expect(cleaned.cleaned).not.toContain('media-a');
    expect(supabase._state.mediaRows.some((row) => row.id === 'media-a')).toBe(true);
    deleteSpy.mockRestore();
  });

  it('replacing all allows old media cleanup', async () => {
    const deleteSpy = vi
      .spyOn(await import('./card-photo-storage'), 'deleteCardPhoto')
      .mockResolvedValue(undefined);
    const supabase = createMediaMockSupabase({
      mediaRows: [media(), mediaB()],
      recipients: [
        recipient(1, { photo_media_id: 'media-a' }),
        recipient(2, { photo_media_id: 'media-a' }),
        recipient(3, { photo_media_id: 'media-a' }),
      ],
    });
    const assign = await assignPhotoMediaToRecipients(supabase as never, {
      digitalCardId: 'card-ind-1',
      recipientIds: ['recipient-1', 'recipient-2', 'recipient-3'],
      mediaId: 'media-b',
    });
    expect(assign.ok).toBe(true);
    if (!assign.ok) return;

    const cleaned = await cleanupUnreferencedMediaIds(supabase as never, assign.previousMediaIds);
    expect(cleaned.cleaned).toContain('media-a');
    expect(supabase._state.mediaRows.some((row) => row.id === 'media-a')).toBe(false);
    deleteSpy.mockRestore();
  });
});

describe('uploadIndividualPhotoMediaCore lifecycle', () => {
  it('cleans orphan media when assignment fails', async () => {
    vi.spyOn(await import('./card-photo-storage'), 'deleteCardPhoto').mockResolvedValue(undefined);
    const uploadSpy = vi.spyOn(await import('./supabase-admin'), 'getSupabaseAdmin').mockReturnValue({
      storage: {
        from() {
          return {
            upload: async () => ({ error: null }),
          };
        },
      },
    } as never);

    const supabase = createMediaMockSupabase({
      recipients: [recipient(1, { digital_card_id: 'other-card' })],
    });

    const result = await uploadIndividualPhotoMediaCore(supabase as never, {
      digitalCardId: 'card-ind-1',
      buffer: new Uint8Array([
        0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 1, 2, 3,
      ]),
      mimeType: 'image/webp',
      sizeBytes: 15,
      recipientIds: ['recipient-1'],
    });

    expect(result.ok).toBe(false);
    expect(supabase._state.mediaRows).toHaveLength(0);
    uploadSpy.mockRestore();
  });
});

describe('Individual read path and Shared compatibility', () => {
  it('resolves Individual view photo from media metadata', () => {
    const resolved = {
      mode: 'individual' as const,
      card: {
        id: 'card-ind-1',
        card_mode: 'individual',
        photo_path: null,
      } as CardWithOrder,
      recipient: recipient(1, { photo_media_id: 'media-a', photo_path: null }),
      photo_media: media(),
    };
    expect(getPhotoPathForResolvedView(resolved)).toBe('cards/card-ind-1/media/media-a.webp');
    expect(hasRecipientPhoto(resolved.recipient)).toBe(true);
  });

  it('keeps legacy recipient photo_path fallback', () => {
    const row = recipient(1, {
      photo_path: 'cards/card-ind-1/recipients/r1/photo.webp',
      photo_uploaded_at: '2026-08-12T06:00:00.000Z',
    });
    expect(resolveRecipientPhotoStoragePath(row, null)).toBe(
      'cards/card-ind-1/recipients/r1/photo.webp'
    );
    expect(hasRecipientPhoto(row)).toBe(true);
  });

  it('Shared photo read remains unchanged', () => {
    const sharedCard = {
      photo_path: 'cards/card-shared/photo.webp',
      photo_uploaded_at: '2026-08-12T06:00:00.000Z',
    };
    expect(hasCardPhoto(sharedCard)).toBe(true);
    expect(getPhotoPathForResolvedView({
      mode: 'shared',
      card: sharedCard as CardWithOrder,
      recipient: null,
    })).toBe('cards/card-shared/photo.webp');
  });

  it('display model exposes photo_available only, not raw storage path', () => {
    const display = toRecipientDisplayMeta(
      {
        mode: 'individual',
        card: { id: 'card-ind-1', card_mode: 'individual' } as CardWithOrder,
        recipient: recipient(1, { photo_media_id: 'media-a' }),
        photo_media: media(),
      },
      'viewTok1'
    );
    expect(display.photo_available).toBe(true);
    expect(display).not.toHaveProperty('photo_path');
    expect(display).not.toHaveProperty('storage_path');
  });
});

describe('parent delete and cleanup architecture', () => {
  it('deleteAllDigitalCardMediaForCard removes storage objects and media rows', async () => {
    const deleteSpy = vi
      .spyOn(await import('./card-photo-storage'), 'deleteCardPhoto')
      .mockResolvedValue(undefined);
    const supabase = createMediaMockSupabase({
      mediaRows: [media(), mediaB()],
      recipients: [],
    });
    const result = await deleteAllDigitalCardMediaForCard(supabase as never, 'card-ind-1');
    expect(result.deletedRows).toBe(2);
    expect(result.deletedPaths).toHaveLength(2);
    expect(supabase._state.mediaRows).toHaveLength(0);
    deleteSpy.mockRestore();
  });

  it('deleteCard uses Individual media storage cleanup', () => {
    const source = fs.readFileSync(path.join(ROOT, 'lib/actions.ts'), 'utf8');
    expect(source).toMatch(/deleteIndividualCardMediaStorage/);
  });

  it('expiry cleanup hard-deletes card media via storage + order cascade', () => {
    const source = fs.readFileSync(path.join(ROOT, 'lib/card-photo-cleanup.ts'), 'utf8');
    expect(source).toMatch(/listDigitalCardMediaForCard/);
    expect(source).toMatch(/hardDeleteEligibleCard/);
    expect(source).toMatch(/from\('orders'\)\.delete\(\)/);
  });
});

describe('createDigitalCardPhotoMedia', () => {
  it('creates one media row for reusable assignment', async () => {
    const supabase = createMediaMockSupabase();
    const result = await createDigitalCardPhotoMedia(supabase as never, {
      id: 'media-a',
      digital_card_id: 'card-ind-1',
      storage_path: 'cards/card-ind-1/media/media-a.webp',
      mime_type: 'image/webp',
      size_bytes: 100,
    });
    expect(result.media?.id).toBe('media-a');
    expect(supabase._state.mediaRows).toHaveLength(1);
  });
});

describe('Phase 4B and Shared photo guards remain green', () => {
  it('Individual editor uses real photo section', () => {
    const source = fs.readFileSync(
      path.join(ROOT, 'components/individual/IndividualRecipientEditor.tsx'),
      'utf8'
    );
    expect(source).toMatch(/CardIndividualPhotoSection/);
    expect(source).not.toMatch(/CardPhotoPlaceholderSection/);
  });

  it('Shared editor still uses CardPhotoUpload', () => {
    const source = fs.readFileSync(path.join(ROOT, 'components/card/SharedCardEditor.tsx'), 'utf8');
    expect(source).toMatch(/CardPhotoUpload/);
  });
});
