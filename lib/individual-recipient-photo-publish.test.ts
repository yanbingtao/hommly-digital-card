import fs from 'fs';
import path from 'path';
import { describe, expect, it, vi } from 'vitest';
import { getPhotoPathForResolvedView } from './card-photo-access';
import { toRecipientDisplayMeta } from './recipient-display-card';
import {
  isPhotoPublishReady,
  prefillToFormState,
  getIndividualPublishOverwriteCopy,
} from './individual-recipient-editor-prefill';
import type { IndividualEditorPrefillState } from './individual-recipient-editor-types';
import {
  applyIndividualRecipientPhotoOnPublish,
  buildPhotoPrefillState,
  getRecipientPhotoPrefillKey,
  resolveIndividualRecipientPhotoPreviewUrl,
} from './individual-recipient-photo';
import { publishIndividualRecipientsCore } from './publish-individual-recipients-core';
import type { CardWithOrder, DigitalCardMedia, DigitalCardRecipient } from './types';

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

function media(overrides?: Partial<DigitalCardMedia>): DigitalCardMedia {
  return {
    id: 'media-a',
    digital_card_id: 'card-ind-1',
    storage_path: 'cards/card-ind-1/media/media-a.webp',
    original_name: 'photo.webp',
    mime_type: 'image/webp',
    size_bytes: 1024,
    created_at: '2026-08-12T08:00:00.000Z',
    updated_at: '2026-08-12T08:00:00.000Z',
    ...overrides,
  };
}

function createPhotoPublishMockSupabase(options: {
  card?: CardWithOrder;
  recipients: DigitalCardRecipient[];
  mediaRows?: DigitalCardMedia[];
}) {
  const card = { ...(options.card ?? individualCard()), order: { ...(options.card ?? individualCard()).order } };
  const recipients = options.recipients.map((row) => ({ ...row }));
  const mediaRows = (options.mediaRows ?? []).map((row) => ({ ...row }));

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
                    if (column === 'id' && value === card.id) {
                      return { data: card, error: null };
                    }
                    return { data: null, error: null };
                  },
                  is() {
                    return {
                      select() {
                        return {
                          async maybeSingle() {
                            return { data: { first_published_at: card.first_published_at }, error: null };
                          },
                        };
                      },
                    };
                  },
                  order() {
                    return Promise.resolve({
                      data: recipients.sort((a, b) => a.recipient_number - b.recipient_number),
                      error: null,
                    });
                  },
                };
              },
            };
          },
          update() {
            return {
              eq() {
                return {
                  is() {
                    return {
                      select() {
                        return {
                          async maybeSingle() {
                            return { data: { first_published_at: '2026-08-12T08:00:00.000Z' }, error: null };
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
                  order() {
                    return Promise.resolve({
                      data: recipients
                        .filter((row) => row[column as keyof DigitalCardRecipient] === value)
                        .sort((a, b) => a.recipient_number - b.recipient_number),
                      error: null,
                    });
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
                      select(selectArg?: string) {
                        const matched = recipients.filter(
                          (row) =>
                            row[column as keyof DigitalCardRecipient] === value &&
                            values.includes(row[column2 as keyof DigitalCardRecipient])
                        );
                        for (const row of matched) {
                          Object.assign(row, patch);
                        }
                        if (selectArg?.includes('recipient_number')) {
                          return Promise.resolve({
                            data: matched.map((row) => ({
                              id: row.id,
                              recipient_number: row.recipient_number,
                              view_token: row.view_token,
                              message: row.message,
                              theme: row.theme,
                              status: row.status,
                              published_at: row.published_at,
                            })),
                            error: null,
                          });
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
                if (index >= 0) mediaRows.splice(index, 1);
                return Promise.resolve({ error: null });
              },
            };
          },
        };
      }

      throw new Error(`unexpected ${table}`);
    },
    _state: { card, recipients, mediaRows },
  };

  return supabase;
}

function mixedPhotoPrefill(): IndividualEditorPrefillState {
  return {
    message: { kind: 'value', value: '' },
    theme: { kind: 'value', value: 'thank_you' },
    show_sender_links: { kind: 'value', value: false },
    sender_links: { kind: 'value', value: { instagram: '', tiktok: '', youtube: '', website: '' } },
    view_pin_enabled: { kind: 'value', value: false },
    photo: { kind: 'mixed' },
  };
}

describe('Individual photo prefill and mixed state', () => {
  it('detects mixed photo state', () => {
    const rows = [
      recipient(1, { photo_media_id: 'media-a' }),
      recipient(2, { photo_media_id: 'media-b' }),
      recipient(3),
    ];
    expect(buildPhotoPrefillState(rows).kind).toBe('mixed');
  });

  it('requires explicit photo choice for mixed multi-select prefill', () => {
    const form = prefillToFormState(mixedPhotoPrefill(), [
      { id: 'r1', recipient_number: 1, message: null, theme: 'thank_you', animation: 'soft_reveal', show_sender_links: false, sender_links: null, view_pin_enabled: false, status: 'draft', published_at: null, view_pin_is_set: false, has_photo: true },
      { id: 'r2', recipient_number: 2, message: null, theme: 'thank_you', animation: 'soft_reveal', show_sender_links: false, sender_links: null, view_pin_enabled: false, status: 'draft', published_at: null, view_pin_is_set: false, has_photo: true },
    ]);
    expect(form.photo_mode).toBeNull();
    expect(form.photo_mixed).toBe(true);
    expect(isPhotoPublishReady(form)).toBe(false);
  });

  it('prefills one_photo for single recipient with existing photo', () => {
    const prefill: IndividualEditorPrefillState = {
      message: { kind: 'value', value: 'Hi' },
      theme: { kind: 'value', value: 'thank_you' },
      show_sender_links: { kind: 'value', value: false },
      sender_links: { kind: 'value', value: { instagram: '', tiktok: '', youtube: '', website: '' } },
      view_pin_enabled: { kind: 'value', value: false },
      photo: { kind: 'value', value: 'shared' },
    };
    const form = prefillToFormState(prefill, [
      { id: 'r1', recipient_number: 1, message: 'Hi', theme: 'thank_you', animation: 'soft_reveal', show_sender_links: false, sender_links: null, view_pin_enabled: false, status: 'draft', published_at: null, view_pin_is_set: false, has_photo: true },
    ]);
    expect(form.photo_mode).toBe('one_photo');
    expect(form.photo_has_existing).toBe(true);
    expect(isPhotoPublishReady(form)).toBe(true);
  });

  it('prefills one_photo when all selected share same photo', () => {
    const prefill: IndividualEditorPrefillState = {
      message: { kind: 'value', value: '' },
      theme: { kind: 'value', value: 'thank_you' },
      show_sender_links: { kind: 'value', value: false },
      sender_links: { kind: 'value', value: { instagram: '', tiktok: '', youtube: '', website: '' } },
      view_pin_enabled: { kind: 'value', value: false },
      photo: { kind: 'value', value: 'shared' },
    };
    const form = prefillToFormState(prefill, [
      { id: 'r1', recipient_number: 1, message: null, theme: 'thank_you', animation: 'soft_reveal', show_sender_links: false, sender_links: null, view_pin_enabled: false, status: 'draft', published_at: null, view_pin_is_set: false, has_photo: true },
      { id: 'r2', recipient_number: 2, message: null, theme: 'thank_you', animation: 'soft_reveal', show_sender_links: false, sender_links: null, view_pin_enabled: false, status: 'draft', published_at: null, view_pin_is_set: false, has_photo: true },
    ]);
    expect(form.photo_mode).toBe('one_photo');
    expect(form.photo_mixed).toBe(false);
  });

  it('recognizes legacy photo_path', () => {
    const row = recipient(1, { photo_path: 'cards/card-ind-1/recipients/r1/photo.webp' });
    expect(getRecipientPhotoPrefillKey(row)).toBe('legacy:recipient-1');
  });
});

describe('applyIndividualRecipientPhotoOnPublish', () => {
  it('clears photos when final state is disabled', async () => {
    vi.spyOn(await import('./card-photo-storage'), 'deleteCardPhoto').mockResolvedValue(undefined);
    const supabase = createPhotoPublishMockSupabase({
      recipients: [
        recipient(1, { photo_media_id: 'media-a' }),
        recipient(2, { photo_media_id: 'media-a' }),
      ],
      mediaRows: [media()],
    });

    const result = await applyIndividualRecipientPhotoOnPublish(supabase as never, {
      digitalCardId: 'card-ind-1',
      recipientIds: ['recipient-1', 'recipient-2'],
      photo: { enabled: false },
      recipientsBefore: supabase._state.recipients,
    });

    expect(result.ok).toBe(true);
    expect(supabase._state.recipients.every((row) => row.photo_media_id === null)).toBe(true);
  });

  it('assigns one uploaded media to three recipients', async () => {
    vi.spyOn(await import('./supabase-admin'), 'getSupabaseAdmin').mockReturnValue({
      storage: { from: () => ({ upload: async () => ({ error: null }) }) },
    } as never);
    vi.spyOn(await import('./card-photo-storage'), 'deleteCardPhoto').mockResolvedValue(undefined);

    const supabase = createPhotoPublishMockSupabase({
      recipients: [recipient(1), recipient(2), recipient(3)],
    });

    const result = await applyIndividualRecipientPhotoOnPublish(supabase as never, {
      digitalCardId: 'card-ind-1',
      recipientIds: ['recipient-1', 'recipient-2', 'recipient-3'],
      photo: {
        enabled: true,
        source: 'new_upload',
        buffer: new Uint8Array([1, 2, 3]),
        mimeType: 'image/webp',
        originalName: 'photo.webp',
        sizeBytes: 3,
      },
      recipientsBefore: supabase._state.recipients,
    });

    expect(result.ok).toBe(true);
    expect(supabase._state.mediaRows).toHaveLength(1);
    expect(supabase._state.recipients.every((row) => row.photo_media_id === supabase._state.mediaRows[0]!.id)).toBe(
      true
    );
  });

  it('assigns existing shared media without re-upload', async () => {
    vi.spyOn(await import('./card-photo-storage'), 'deleteCardPhoto').mockResolvedValue(undefined);
    const supabase = createPhotoPublishMockSupabase({
      recipients: [
        recipient(1, { photo_media_id: 'media-a' }),
        recipient(2, { photo_media_id: 'media-a' }),
      ],
      mediaRows: [media()],
    });

    const result = await applyIndividualRecipientPhotoOnPublish(supabase as never, {
      digitalCardId: 'card-ind-1',
      recipientIds: ['recipient-1', 'recipient-2'],
      photo: { enabled: true, source: 'existing_media', mediaId: 'media-a' },
      recipientsBefore: supabase._state.recipients,
    });

    expect(result.ok).toBe(true);
    expect(supabase._state.recipients.every((row) => row.photo_media_id === 'media-a')).toBe(true);
  });

  it('overrides one recipient while siblings keep media A', async () => {
    vi.spyOn(await import('./supabase-admin'), 'getSupabaseAdmin').mockReturnValue({
      storage: { from: () => ({ upload: async () => ({ error: null }) }) },
    } as never);
    vi.spyOn(await import('./card-photo-storage'), 'deleteCardPhoto').mockResolvedValue(undefined);

    const supabase = createPhotoPublishMockSupabase({
      recipients: [
        recipient(1, { photo_media_id: 'media-a' }),
        recipient(2, { photo_media_id: 'media-a' }),
        recipient(3, { photo_media_id: 'media-a' }),
      ],
      mediaRows: [media()],
    });

    const result = await applyIndividualRecipientPhotoOnPublish(supabase as never, {
      digitalCardId: 'card-ind-1',
      recipientIds: ['recipient-2'],
      photo: {
        enabled: true,
        source: 'new_upload',
        buffer: new Uint8Array([4, 5, 6]),
        mimeType: 'image/webp',
        sizeBytes: 3,
      },
      recipientsBefore: supabase._state.recipients,
    });

    expect(result.ok).toBe(true);
    expect(supabase._state.recipients[0]!.photo_media_id).toBe('media-a');
    expect(supabase._state.recipients[1]!.photo_media_id).not.toBe('media-a');
    expect(supabase._state.recipients[2]!.photo_media_id).toBe('media-a');
    expect(supabase._state.mediaRows.some((row) => row.id === 'media-a')).toBe(true);
  });

  it('clears photo from selected recipients only', async () => {
    vi.spyOn(await import('./card-photo-storage'), 'deleteCardPhoto').mockResolvedValue(undefined);
    const supabase = createPhotoPublishMockSupabase({
      recipients: [
        recipient(1, { photo_media_id: 'media-a' }),
        recipient(2, { photo_media_id: 'media-a' }),
        recipient(3, { photo_media_id: 'media-a' }),
      ],
      mediaRows: [media()],
    });

    const result = await applyIndividualRecipientPhotoOnPublish(supabase as never, {
      digitalCardId: 'card-ind-1',
      recipientIds: ['recipient-2'],
      photo: { enabled: false },
      recipientsBefore: supabase._state.recipients,
    });

    expect(result.ok).toBe(true);
    expect(supabase._state.recipients[0]!.photo_media_id).toBe('media-a');
    expect(supabase._state.recipients[1]!.photo_media_id).toBeNull();
    expect(supabase._state.recipients[2]!.photo_media_id).toBe('media-a');
  });
});

describe('publishIndividualRecipientsCore full overwrite', () => {
  it('message publish with photo disabled clears selected photos', async () => {
    const supabase = createPhotoPublishMockSupabase({
      recipients: [
        recipient(1, { photo_media_id: 'media-a', message: 'Old' }),
        recipient(2, { photo_media_id: 'media-b', message: 'Old' }),
      ],
      mediaRows: [media(), media({ id: 'media-b', storage_path: 'cards/card-ind-1/media/media-b.webp' })],
    });

    const result = await publishIndividualRecipientsCore(supabase as never, {
      editToken: 'edit-ind-token',
      recipientIds: ['recipient-1', 'recipient-2'],
      content: {
        message: 'New message only',
        theme: 'thank_you',
        show_sender_links: false,
        sender_links: null,
        view_pin_enabled: false,
        view_pin: '',
        photo_enabled: false,
      },
    });

    expect(result.ok).toBe(true);
    expect(supabase._state.recipients[0]!.photo_media_id).toBeNull();
    expect(supabase._state.recipients[1]!.photo_media_id).toBeNull();
    expect(supabase._state.recipients[0]!.message).toBe('New message only');
  });

  it('gives selected recipients identical final content including photo', async () => {
    vi.spyOn(await import('./supabase-admin'), 'getSupabaseAdmin').mockReturnValue({
      storage: { from: () => ({ upload: async () => ({ error: null }) }) },
    } as never);
    vi.spyOn(await import('./card-photo-storage'), 'deleteCardPhoto').mockResolvedValue(undefined);

    const supabase = createPhotoPublishMockSupabase({
      recipients: [
        recipient(1, { photo_media_id: 'media-a', message: 'A', theme: 'thank_you' }),
        recipient(2, { photo_media_id: 'media-b', message: 'B', theme: 'birthday' }),
        recipient(3, { message: 'C' }),
      ],
      mediaRows: [
        media(),
        media({ id: 'media-b', storage_path: 'cards/card-ind-1/media/media-b.webp' }),
      ],
    });

    const result = await publishIndividualRecipientsCore(supabase as never, {
      editToken: 'edit-ind-token',
      recipientIds: ['recipient-1', 'recipient-3'],
      content: {
        message: 'New Message',
        theme: 'farewell',
        show_sender_links: false,
        sender_links: null,
        view_pin_enabled: false,
        view_pin: '',
        photo_enabled: true,
        photo_file_base64: Buffer.from([1, 2, 3]).toString('base64'),
        photo_mime_type: 'image/webp',
        photo_original_name: 'photo.webp',
        photo_size_bytes: 3,
      },
    });

    expect(result.ok).toBe(true);
    const selected = [supabase._state.recipients[0]!, supabase._state.recipients[2]!];
    expect(selected.every((row) => row.message === 'New Message')).toBe(true);
    expect(selected.every((row) => row.theme === 'farewell')).toBe(true);
    const sharedMediaId = selected[0]!.photo_media_id;
    expect(sharedMediaId).toBeTruthy();
    expect(selected[1]!.photo_media_id).toBe(sharedMediaId);
    expect(supabase._state.recipients[1]!.message).toBe('B');
    expect(supabase._state.recipients[1]!.photo_media_id).toBe('media-b');
  });

  it('returns failure when photo assignment fails after content publish', async () => {
    const photoSpy = vi
      .spyOn(await import('./individual-recipient-photo'), 'applyIndividualRecipientPhotoOnPublish')
      .mockResolvedValue({ ok: false, error: 'Photo assignment failed.' });

    const supabase = createPhotoPublishMockSupabase({
      recipients: [recipient(1)],
    });

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
        photo_enabled: false,
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.contentPublished).toBe(true);
    photoSpy.mockRestore();
  });
});

describe('Individual photo preview and /g resolution', () => {
  it('resolves shared media preview without exposing storage path', async () => {
    vi.spyOn(await import('./card-photo-storage'), 'createPhotoSignedUrl').mockResolvedValue(
      'https://signed.example/photo'
    );
    const supabase = createPhotoPublishMockSupabase({
      recipients: [
        recipient(1, { photo_media_id: 'media-a' }),
        recipient(2, { photo_media_id: 'media-a' }),
      ],
      mediaRows: [media()],
    });

    const preview = await resolveIndividualRecipientPhotoPreviewUrl(supabase as never, {
      editToken: 'edit-ind-token',
      recipientIds: ['recipient-1', 'recipient-2'],
    });

    expect(preview.mixed).toBe(false);
    expect(preview.signedUrl).toBe('https://signed.example/photo');
  });

  it('/g resolves correct photo per recipient after override', () => {
    const resolvedA = {
      mode: 'individual' as const,
      card: individualCard(),
      recipient: recipient(1, { photo_media_id: 'media-a' }),
      photo_media: media(),
    };
    const resolvedB = {
      mode: 'individual' as const,
      card: individualCard(),
      recipient: recipient(2, { photo_media_id: 'media-b' }),
      photo_media: media({ id: 'media-b', storage_path: 'cards/card-ind-1/media/media-b.webp' }),
    };
    expect(getPhotoPathForResolvedView(resolvedA)).toContain('media-a');
    expect(getPhotoPathForResolvedView(resolvedB)).toContain('media-b');

    const display = toRecipientDisplayMeta(resolvedB, 'viewTok2');
    expect(display.photo_available).toBe(true);
    expect(display).not.toHaveProperty('storage_path');
  });
});

describe('Publish overwrite copy', () => {
  it('shows single-recipient replace copy', () => {
    expect(getIndividualPublishOverwriteCopy([7], 37)).toBe(
      'Publishing will replace the current personalisation for Gift #07.'
    );
  });

  it('shows multi-select copy', () => {
    expect(getIndividualPublishOverwriteCopy([1, 2, 3], 37)).toBe(
      'Publishing will apply these settings to all 3 selected gifts.'
    );
  });

  it('shows select-all copy', () => {
    expect(getIndividualPublishOverwriteCopy([1, 2, 3], 3)).toBe(
      'Publishing will apply these settings to all 3 gifts.'
    );
  });
});

describe('Phase 5B guards', () => {
  it('Shared editor still uses CardPhotoUpload', () => {
    const source = fs.readFileSync(path.join(ROOT, 'components/card/SharedCardEditor.tsx'), 'utf8');
    expect(source).toMatch(/CardPhotoUpload/);
    expect(source).not.toMatch(/CardIndividualPhotoSection/);
  });

  it('publish payload uses final photo_enabled state', () => {
    const source = fs.readFileSync(path.join(ROOT, 'lib/individual-recipient-editor-actions.ts'), 'utf8');
    expect(source).toMatch(/photo_enabled/);
    expect(source).not.toMatch(/photo_action/);
  });

  it('editor requires explicit photo choice before publish', () => {
    const source = fs.readFileSync(path.join(ROOT, 'components/individual/IndividualRecipientEditor.tsx'), 'utf8');
    expect(source).toMatch(/isPhotoPublishReady/);
    expect(source).toMatch(/photo_enabled/);
    expect(source).not.toMatch(/photo_action/);
    expect(source).toMatch(/publishInFlightRef/);
  });

  it('photo section uses explicit no photo / one photo radios', () => {
    const source = fs.readFileSync(path.join(ROOT, 'components/card/CardIndividualPhotoSection.tsx'), 'utf8');
    expect(source).toMatch(/No photo/);
    expect(source).toMatch(/Use one photo for all selected gifts/);
    expect(source).not.toMatch(/Publishing other changes will keep/i);
  });
});
