import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import {
  COMPACT_QR_WIDTH,
  formatGiftNumberForFilename,
  generateCompactQRCodeDataURL,
  generateQRCodeDataURL,
  individualRecipientViewQrFilename,
  STANDARD_QR_WIDTH,
} from './qr';
import {
  computeBuyerFacingStatusCounts,
  filterRecipientsByBuyerStatus,
  formatSelectedGiftCountLabel,
  getBatchEditActionLabel,
  getBuyerFacingRecipientStatus,
} from './individual-recipient-manager';
import type { IndividualRecipientManagerItem } from './individual-recipient-manager';

const ROOT = path.join(__dirname, '..');

function item(
  number: number,
  overrides?: Partial<IndividualRecipientManagerItem>
): IndividualRecipientManagerItem {
  return {
    id: `recipient-${number}`,
    recipient_number: number,
    status: 'draft',
    has_message: false,
    has_photo: false,
    has_sender_links: false,
    view_pin_enabled: false,
    ...overrides,
  };
}

describe('QR helpers', () => {
  it('generates compact QR at 96px width', async () => {
    const dataUrl = await generateCompactQRCodeDataURL('https://hommly.online/g/token-a');
    expect(dataUrl.startsWith('data:image/png;base64,')).toBe(true);
    expect(COMPACT_QR_WIDTH).toBe(96);
    expect(STANDARD_QR_WIDTH).toBe(256);
  });

  it('formats gift numbers for filenames', () => {
    expect(formatGiftNumberForFilename(1)).toBe('01');
    expect(formatGiftNumberForFilename(37)).toBe('37');
    expect(formatGiftNumberForFilename(100)).toBe('100');
  });

  it('builds recipient View QR filenames without database ids', () => {
    expect(individualRecipientViewQrFilename('HM-2024-001', 1)).toBe('HM-2024-001_gift_01_view_qr.png');
    expect(individualRecipientViewQrFilename('HM-2024-001', 100)).toBe(
      'HM-2024-001_gift_100_view_qr.png'
    );
  });

  it('encodes different URLs for different recipients', async () => {
    const [qr1, qr2] = await Promise.all([
      generateCompactQRCodeDataURL('https://hommly.online/g/recipient-one'),
      generateCompactQRCodeDataURL('https://hommly.online/g/recipient-two'),
    ]);
    expect(qr1).not.toBe(qr2);
  });

  it('Edit QR uses standard width helper', async () => {
    const editQr = await generateQRCodeDataURL('https://hommly.online/e/edit-token');
    expect(editQr.startsWith('data:image/png;base64,')).toBe(true);
  });
});

describe('buyer-facing recipient manager presentation', () => {
  it('maps published recipients to Published', () => {
    expect(getBuyerFacingRecipientStatus(item(1, { status: 'published' }))).toBe('published');
  });

  it('maps draft recipients to Not started', () => {
    expect(getBuyerFacingRecipientStatus(item(2, { has_message: true }))).toBe('not_started');
    expect(getBuyerFacingRecipientStatus(item(3))).toBe('not_started');
  });

  it('summary counts exclude Draft', () => {
    const counts = computeBuyerFacingStatusCounts([
      item(1, { status: 'published' }),
      item(2, { has_message: true }),
      item(3),
    ]);
    expect(counts.published_count).toBe(1);
    expect(counts.not_started_count).toBe(2);
    expect(counts.total_count).toBe(3);
  });

  it('filters exclude Draft as its own category', () => {
    const items = [
      item(1, { status: 'published' }),
      item(2, { has_message: true }),
      item(3),
    ];
    expect(filterRecipientsByBuyerStatus(items, 'published').map((row) => row.recipient_number)).toEqual([
      1,
    ]);
    expect(filterRecipientsByBuyerStatus(items, 'not_started').map((row) => row.recipient_number)).toEqual([
      2, 3,
    ]);
  });

  it('uses Personalise selected for one selection', () => {
    expect(getBatchEditActionLabel(1)).toBe('Personalise selected →');
  });

  it('uses Personalise selected for multiple selections', () => {
    expect(getBatchEditActionLabel(2)).toBe('Personalise selected →');
    expect(getBatchEditActionLabel(37)).toBe('Personalise selected →');
  });

  it('formats selected gift count grammar', () => {
    expect(formatSelectedGiftCountLabel(1)).toBe('1 gift selected');
    expect(formatSelectedGiftCountLabel(3)).toBe('3 gifts selected');
  });
});

describe('Admin Individual modal UI guards', () => {
  it('modal uses viewport-constrained scroll layout', () => {
    const source = fs.readFileSync(path.join(ROOT, 'components/admin/AdminCardsClient.tsx'), 'utf8');
    expect(source).toMatch(/max-h-\[90vh\]/);
    expect(source).toMatch(/overflow-y-auto/);
    expect(source).not.toMatch(/max-h-64/);
  });

  it('Individual Edit QR still appears with updated caption', () => {
    const source = fs.readFileSync(path.join(ROOT, 'components/admin/AdminCardsClient.tsx'), 'utf8');
    expect(source).toMatch(/Download Edit QR/);
    expect(source).toMatch(/Scan to open Edit Page/);
    expect(source).toMatch(/Edit URL — Buyer\/Sender/);
  });

  it('every Individual recipient has View QR and download', () => {
    const source = fs.readFileSync(path.join(ROOT, 'components/admin/AdminIndividualRecipientQrCard.tsx'), 'utf8');
    expect(source).toMatch(/AdminIndividualRecipientQrList/);
    expect(source).toMatch(/generateCompactQRCodeDataURL/);
    expect(source).toMatch(/Download View QR/);
    expect(source).toMatch(/COMPACT_QR_WIDTH/);
  });

  it('Shared card QR behavior remains dual QR download', () => {
    const source = fs.readFileSync(path.join(ROOT, 'components/admin/AdminCardsClient.tsx'), 'utf8');
    expect(source).toMatch(/Download QR Codes/);
    expect(source).toMatch(/recipientQrCode/);
    expect(source).toMatch(/Preview Recipient/);
  });
});

describe('Individual Recipient Manager UI guards', () => {
  it('removes Draft from buyer manager UI', () => {
    const managerSource = fs.readFileSync(
      path.join(ROOT, 'components/individual/IndividualRecipientManager.tsx'),
      'utf8'
    );
    const labelSource = fs.readFileSync(
      path.join(ROOT, 'lib/individual-recipient-manager.ts'),
      'utf8'
    );
    expect(managerSource).not.toMatch(/Draft:/);
    expect(managerSource).not.toMatch(/id: 'draft'/);
    expect(managerSource).toMatch(/To personalise/);
    expect(managerSource).toMatch(/getBatchEditActionLabel/);
    expect(managerSource).toMatch(/batchEditLabel/);
    expect(labelSource).toMatch(/Personalise selected/);
  });

  it('row-level Edit remains for ready gifts', () => {
    const rowSource = fs.readFileSync(
      path.join(ROOT, 'components/individual/RecipientManagerRow.tsx'),
      'utf8'
    );
    const labelSource = fs.readFileSync(
      path.join(ROOT, 'lib/individual-recipient-manager.ts'),
      'utf8'
    );
    expect(rowSource).toMatch(/getRecipientRowActionLabel/);
    expect(labelSource).toMatch(/Edit →/);
    expect(labelSource).toMatch(/Personalise →/);
    expect(rowSource).not.toMatch(/\bDraft\b/);
  });
});
