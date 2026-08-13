import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import {
  aggregateAdminIndividualCardProgress,
  formatAdminIndividualReadySummary,
  formatAdminRecipientViewLinksLabel,
  getAdminCardTypeLabel,
  getAdminIndividualDisplayStatus,
  getAdminIndividualDisplayStatusLabel,
} from './admin-card-helpers';
import type { CardWithOrder } from './types';

const ROOT = path.join(__dirname, '..');

function individualCard(): Pick<CardWithOrder, 'card_mode'> {
  return { card_mode: 'individual' };
}

function sharedCard(): Pick<CardWithOrder, 'card_mode'> {
  return { card_mode: 'shared' };
}

function rowsForCard(
  cardId: string,
  total: number,
  published: number
): Array<{ digital_card_id: string; status: string | null; view_token: string | null }> {
  return Array.from({ length: total }, (_, index) => {
    const number = index + 1;
    const isPublished = number <= published;
    return {
      digital_card_id: cardId,
      status: isPublished ? 'published' : 'draft',
      view_token: `viewTok${String(number).padStart(2, '0')}ab`,
    };
  });
}

describe('Admin individual card progress', () => {
  it('untouched 15-gift card is Draft with 0 ready and 0 view links', () => {
    const progress = aggregateAdminIndividualCardProgress(rowsForCard('card-a', 15, 0));
    const summary = progress['card-a']!;
    expect(summary).toEqual({
      total_gifts: 15,
      published_gifts: 0,
      recipient_view_links: 0,
    });
    expect(getAdminIndividualDisplayStatus(summary)).toBe('draft');
    expect(getAdminIndividualDisplayStatusLabel('draft')).toBe('Draft');
    expect(getAdminCardTypeLabel(individualCard(), summary.total_gifts)).toBe(
      'Individual · 15 Gifts'
    );
    expect(formatAdminIndividualReadySummary(summary)).toBe('0 of 15 eCards ready');
    expect(formatAdminRecipientViewLinksLabel(summary.recipient_view_links)).toBe(
      '0 recipient view links in card details'
    );
  });

  it('partially published 15-gift card is In progress (1 of 15)', () => {
    const progress = aggregateAdminIndividualCardProgress(rowsForCard('card-b', 15, 1));
    const summary = progress['card-b']!;
    expect(summary).toEqual({
      total_gifts: 15,
      published_gifts: 1,
      recipient_view_links: 1,
    });
    expect(getAdminIndividualDisplayStatus(summary)).toBe('in_progress');
    expect(getAdminIndividualDisplayStatusLabel('in_progress')).toBe('In progress');
    expect(formatAdminIndividualReadySummary(summary)).toBe('1 of 15 eCards ready');
    expect(formatAdminRecipientViewLinksLabel(summary.recipient_view_links)).toBe(
      '1 recipient view link in card details'
    );
  });

  it('fully published 15-gift card is Ready with 15 view links', () => {
    const progress = aggregateAdminIndividualCardProgress(rowsForCard('card-c', 15, 15));
    const summary = progress['card-c']!;
    expect(summary.published_gifts).toBe(15);
    expect(summary.recipient_view_links).toBe(15);
    expect(getAdminIndividualDisplayStatus(summary)).toBe('ready');
    expect(getAdminIndividualDisplayStatusLabel('ready')).toBe('Ready');
    expect(formatAdminIndividualReadySummary(summary)).toBe('15 of 15 eCards ready');
  });

  it('re-editing a published gift does not double-count', () => {
    const first = aggregateAdminIndividualCardProgress(rowsForCard('card-d', 15, 1))['card-d']!;
    const again = aggregateAdminIndividualCardProgress(rowsForCard('card-d', 15, 1))['card-d']!;
    expect(first.published_gifts).toBe(1);
    expect(again.published_gifts).toBe(1);
    expect(formatAdminIndividualReadySummary(again)).toBe('1 of 15 eCards ready');
  });

  it('does not count draft gifts as recipient view links even if token exists', () => {
    const progress = aggregateAdminIndividualCardProgress([
      {
        digital_card_id: 'card-e',
        status: 'draft',
        view_token: 'viewTokDraft01',
      },
      {
        digital_card_id: 'card-e',
        status: 'published',
        view_token: 'viewTokReady01',
      },
    ])['card-e']!;
    expect(progress.total_gifts).toBe(2);
    expect(progress.published_gifts).toBe(1);
    expect(progress.recipient_view_links).toBe(1);
  });

  it('keeps Shared card type label unchanged', () => {
    expect(getAdminCardTypeLabel(sharedCard(), 15)).toBe('Shared');
  });
});

describe('Admin cleanup + progress wiring', () => {
  it('Clear expired cards & photos uses admin-authenticated cleanup core', () => {
    const actions = fs.readFileSync(path.join(ROOT, 'lib/actions.ts'), 'utf8');
    const cleanupFn = actions.slice(
      actions.indexOf('export async function runExpiredPhotoCleanup'),
      actions.indexOf('export async function adminRemoveCardPhoto')
    );
    expect(cleanupFn).toMatch(/assertAdminAuthenticated/);
    expect(cleanupFn).toMatch(/cleanupExpiredCardsAndPhotos/);

    const client = fs.readFileSync(
      path.join(ROOT, 'components/admin/AdminCardsClient.tsx'),
      'utf8'
    );
    expect(client).toMatch(/runExpiredPhotoCleanup/);
    expect(client).toMatch(/cleanupInFlightRef/);
    expect(client).toMatch(/Clearing…/);
    expect(client).toMatch(/Clear expired cards & photos/);
    expect(client).toMatch(/Delete expired cards and photos\?/);
    expect(client).toMatch(/Cleanup complete/);
    expect(client).not.toMatch(/scheduled-photo-cleanup/);
    expect(client).not.toMatch(/netlify\/functions/);
  });

  it('getCards aggregates individual progress via service-role recipient query', () => {
    const actions = fs.readFileSync(path.join(ROOT, 'lib/actions.ts'), 'utf8');
    expect(actions).toMatch(/fetchIndividualCardProgress/);
    expect(actions).toMatch(/getSupabaseAdmin/);
    expect(actions).toMatch(/aggregateAdminIndividualCardProgress/);
    expect(actions).toMatch(/individualProgress/);
    expect(actions).not.toMatch(/fetchIndividualRecipientCounts/);
  });

  it('Admin list shows ready progress and derived status helpers', () => {
    const client = fs.readFileSync(
      path.join(ROOT, 'components/admin/AdminCardsClient.tsx'),
      'utf8'
    );
    expect(client).toMatch(/formatAdminIndividualReadySummary/);
    expect(client).toMatch(/getAdminIndividualDisplayStatus/);
    expect(client).toMatch(/formatAdminRecipientViewLinksLabel/);
    expect(client).toMatch(/initialIndividualProgress/);
  });

  it('cleanup core uses service-role client', () => {
    const source = fs.readFileSync(path.join(ROOT, 'lib/card-photo-cleanup.ts'), 'utf8');
    expect(source).toMatch(/getSupabaseAdmin/);
    expect(source).not.toMatch(/from '\.\/supabase'/);
  });

  it('admin cards page is dynamic and passes individual progress', () => {
    const page = fs.readFileSync(
      path.join(ROOT, 'app/admin/(protected)/cards/page.tsx'),
      'utf8'
    );
    expect(page).toMatch(/force-dynamic/);
    expect(page).toMatch(/individualProgress/);
    expect(page).toMatch(/initialIndividualProgress/);
  });
});
